'use strict';
const crypto  = require('crypto');
const express = require('express');
const db = require('../db.js');
const { sendPushToUser, isPrefEnabled } = require('./push.js');
const { refreshAchievements } = require('../achievements.js');
const { requireOwner, requirePermission } = require('../middleware/auth.js');

module.exports = function(broadcastUpdate) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    try {
      const creator = req.userId;
      const roomId  = req.activeRoomId;
      const { title, quota: quotaRaw, stake: stakeRaw,
              category, isSecret, isCounterable, pegno, expiresAt, opponent, isSurprise, targetUser } = req.body;

      const quota = parseFloat(quotaRaw);
      const stake = parseInt(stakeRaw, 10);
      if (!Number.isFinite(quota) || quota < 1.01 || quota > 100)
        return res.status(400).json({ error: 'quota must be 1.01–100' });
      if (!Number.isInteger(stake) || stake < 1)
        return res.status(400).json({ error: 'stake must be a positive integer' });

      const id           = `b_${crypto.randomUUID()}`;
      const createdAt    = Date.now();
      const potentialWin = Math.round(stake * quota);

      const { rows: roomRows } = await db.query(
        'SELECT acceptance_threshold FROM rooms WHERE id=$1', [roomId]
      );
      const threshold = roomRows[0]?.acceptance_threshold ?? 20;
      const isPending = !isSecret && opponent && stake >= threshold;
      const status = isPending ? 'pending' : 'active';

      // A surprise bet requires an opponent and is never broadcasted as counterable
      const surprise = !!isSurprise && !!opponent && !isSecret;
      const counterable = isCounterable && !isSecret && !surprise;

      // Validate target: must be in the same group, can't be creator, can't equal opponent (for clarity)
      let target = null;
      if (targetUser && typeof targetUser === 'string' && targetUser !== creator) {
        const { rows: m } = await db.query(
          'SELECT 1 FROM user_groups WHERE group_id=$1 AND user_id=$2',
          [roomId, targetUser]
        );
        if (m.length) target = targetUser;
      }

      await db.transaction(async (client) => {
        await client.query(
          `INSERT INTO bets
             (id, creator, room_id, title, quota, stake, potential_win,
              category, is_secret, is_counterable, pegno, expires_at, created_at, status, opponent, is_surprise, target_user)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
          [id, creator, roomId, title, quota, stake, potentialWin,
           category, isSecret ? 1 : 0, counterable ? 1 : 0,
           pegno || null, expiresAt || null, createdAt, status, opponent || null, surprise ? 1 : 0, target]
        );
        if (!isPending) {
          await client.query(
            'UPDATE credits SET amount = amount - $1 WHERE "user" = $2',
            [stake, creator]
          );
        }
      });

      broadcastUpdate(roomId);

      // Granular notifications:
      // - Vault: nobody
      // - Surprise: only the opponent (uses on_challenged)
      // - Targeted (opponent set, not surprise): opponent (on_challenged) + rest of group (on_group_bet)
      // - Open: rest of group (on_group_bet)
      // Target user, separately (on_targeted), only if not surprise (else spoiler).
      if (!isSecret) {
        if (opponent && opponent !== creator) {
          if (await isPrefEnabled(opponent, 'on_challenged')) {
            sendPushToUser(opponent, {
              title: '🎯 Sfida diretta',
              body:  `Sei stato sfidato: "${title}"`,
              url:   '/',
            });
          }
        }
        if (!surprise) {
          const { rows: members } = await db.query(
            `SELECT user_id AS id FROM user_groups WHERE group_id=$1 AND user_id NOT IN ($2,$3)`,
            [roomId, creator, opponent || creator]
          );
          for (const m of members) {
            if (await isPrefEnabled(m.id, 'on_group_bet')) {
              sendPushToUser(m.id, {
                title: 'BetCouple 🎲',
                body:  `Nuova bet nel gruppo: "${title}"`,
                url:   '/',
              });
            }
          }
        }
        if (target && !surprise && target !== creator && target !== opponent) {
          if (await isPrefEnabled(target, 'on_targeted')) {
            sendPushToUser(target, {
              title: '🎯 Sei nel mirino',
              body:  `Stanno scommettendo su di te: "${title}"`,
              url:   '/',
            });
          }
        }
      }
      res.status(201).json({ id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/:id/resolve', async (req, res) => {
    try {
      const { outcome } = req.body;
      if (!['won', 'lost'].includes(outcome))
        return res.status(400).json({ error: 'outcome must be won or lost' });

      await db.transaction(async (client) => {
        const { rows } = await client.query(
          'SELECT * FROM bets WHERE id = $1 FOR UPDATE', [req.params.id]
        );
        const bet = rows[0];
        if (!bet) { res.status(404).json({ error: 'Bet not found' }); return; }
        if (bet.room_id !== req.activeRoomId) { res.status(403).json({ error: 'Forbidden' }); return; }
        if (bet.status !== 'active') { res.status(400).json({ error: 'Bet not active' }); return; }
        if (bet.creator !== req.userId && bet.opponent !== req.userId)
          { res.status(403).json({ error: 'Forbidden' }); return; }

        const { rows: counters } = await client.query(
          'SELECT * FROM counter_bets WHERE bet_id = $1', [bet.id]
        );

        await client.query('UPDATE bets SET status = $1 WHERE id = $2', [outcome, bet.id]);

        if (outcome === 'won') {
          await client.query(
            'UPDATE credits SET amount = amount + $1 WHERE "user" = $2',
            [bet.potential_win, bet.creator]
          );
        }

        for (const cb of counters) {
          const cbWon = (outcome === 'won' && cb.side === 'yes') ||
                        (outcome === 'lost' && cb.side === 'no');
          await client.query(
            'UPDATE counter_bets SET status = $1 WHERE id = $2',
            [cbWon ? 'won' : 'lost', cb.id]
          );
          if (cbWon) {
            await client.query(
              'UPDATE credits SET amount = amount + $1 WHERE "user" = $2',
              [cb.potential_win, cb.bettor]
            );
          }
        }
      });

      if (!res.headersSent) {
        broadcastUpdate(req.activeRoomId);

        // Push notification to interested parties: opponent + counter bettors + target (not the resolver)
        try {
          const { rows: [bet] } = await db.query('SELECT * FROM bets WHERE id=$1', [req.params.id]);
          if (bet) {
            // Achievements check for everyone whose stats just changed (creator, opponent, target)
            const checkIds = new Set([bet.creator]);
            if (bet.opponent) checkIds.add(bet.opponent);
            if (bet.target_user) checkIds.add(bet.target_user);
            for (const u of checkIds) refreshAchievements(u);

            const notifyIds = new Set();
            if (bet.opponent && bet.opponent !== req.userId) notifyIds.add(bet.opponent);
            if (bet.creator !== req.userId) notifyIds.add(bet.creator);
            const { rows: cbs } = await db.query('SELECT DISTINCT bettor FROM counter_bets WHERE bet_id=$1', [bet.id]);
            for (const r of cbs) if (r.bettor !== req.userId) notifyIds.add(r.bettor);

            for (const u of notifyIds) {
              if (await isPrefEnabled(u, 'on_resolved')) {
                sendPushToUser(u, {
                  title: outcome === 'won' ? '✅ Bet vinta' : '❌ Bet persa',
                  body:  `"${bet.title}"`,
                  url:   '/',
                });
              }
            }

            // Target gets a dedicated notification (uses on_targeted) — for surprise bets this is
            // the moment they finally discover the bet existed at all.
            if (bet.target_user && bet.target_user !== req.userId
                && bet.target_user !== bet.creator && bet.target_user !== bet.opponent) {
              if (await isPrefEnabled(bet.target_user, 'on_targeted')) {
                sendPushToUser(bet.target_user, {
                  title: bet.is_surprise === 1 ? '🤫 Sorpresa, eri tu il bersaglio' : '🎯 Bet su di te risolta',
                  body:  `"${bet.title}" · ${outcome === 'won' ? 'esito SÌ' : 'esito NO'}`,
                  url:   '/',
                });
              }
            }
          }
        } catch (e) { console.error('notify on resolve failed', e); }

        res.json({ ok: true });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/:id/counter', async (req, res) => {
    try {
      const bettor = req.userId;
      const { side, stake: stakeRaw } = req.body;

      if (!['yes', 'no'].includes(side))
        return res.status(400).json({ error: 'side must be yes or no' });
      const stake = parseInt(stakeRaw, 10);
      if (!Number.isInteger(stake) || stake < 1)
        return res.status(400).json({ error: 'stake must be a positive integer' });

      const { rows } = await db.query('SELECT * FROM bets WHERE id=$1', [req.params.id]);
      const bet = rows[0];
      if (!bet) return res.status(404).json({ error: 'Bet not found' });
      if (bet.room_id !== req.activeRoomId) return res.status(403).json({ error: 'Forbidden' });
      if (bet.status !== 'active') return res.status(400).json({ error: 'Bet not active' });
      if (!bet.is_counterable) return res.status(400).json({ error: 'Bet not counterable' });
      if (bet.is_secret) return res.status(400).json({ error: 'Cannot counter secret bet' });

      const quotaUsed  = side === 'yes' ? parseFloat(bet.quota) : parseFloat((parseFloat(bet.quota) / (parseFloat(bet.quota) - 1)).toFixed(2));
      const potentialWin = Math.round(stake * quotaUsed);
      const id         = `cb_${crypto.randomUUID()}`;

      await db.transaction(async (client) => {
        await client.query(
          `INSERT INTO counter_bets
             (id, bet_id, bettor, side, quota_used, stake, potential_win)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, req.params.id, bettor, side, quotaUsed, stake, potentialWin]
        );
        await client.query(
          'UPDATE credits SET amount = amount - $1 WHERE "user" = $2',
          [stake, bettor]
        );
      });

      broadcastUpdate(req.activeRoomId);
      res.status(201).json({ id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/:id/comment', async (req, res) => {
    try {
      const { comment } = req.body;
      if (typeof comment === 'string' && comment.length > 280) {
        return res.status(400).json({ error: 'Commento troppo lungo' });
      }
      const { rows } = await db.query('SELECT room_id FROM bets WHERE id=$1', [req.params.id]);
      if (!rows[0] || rows[0].room_id !== req.activeRoomId) return res.status(403).json({ error: 'Forbidden' });
      await db.query('UPDATE bets SET comment = $1 WHERE id = $2', [comment, req.params.id]);
      broadcastUpdate(req.activeRoomId);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/:id/edit', async (req, res) => {
    try {
      const me = req.userId;
      const { title, quota, category, pegno, expiresAt } = req.body;
      if (!title?.trim()) return res.status(400).json({ error: 'Invalid' });
      const parsedQuota = parseFloat(quota);
      if (!Number.isFinite(parsedQuota) || parsedQuota < 1.01 || parsedQuota > 100)
        return res.status(400).json({ error: 'quota must be 1.01–100' });
      const { rows } = await db.query('SELECT * FROM bets WHERE id=$1', [req.params.id]);
      const bet = rows[0];
      if (!bet)                              return res.status(404).json({ error: 'Not found' });
      if (bet.room_id !== req.activeRoomId)  return res.status(403).json({ error: 'Forbidden' });
      if (bet.status !== 'active')           return res.status(403).json({ error: 'Already resolved' });

      // Owner of the bet within the 60s window: free pass.
      // Otherwise (someone else, or past window): require moderate_bets permission.
      const ownerWindow = bet.creator === me && (Date.now() - bet.created_at <= 60000);
      if (!ownerWindow) {
        if (!(await requirePermission(req, res, 'moderate_bets'))) return;
      }

      const potentialWin = Math.round(bet.stake * parsedQuota);
      await db.query(
        `UPDATE bets SET title=$1, quota=$2, potential_win=$3, category=$4, pegno=$5, expires_at=$6 WHERE id=$7`,
        [title.trim(), parsedQuota, potentialWin, category, pegno||null, expiresAt||null, bet.id]
      );
      broadcastUpdate(req.activeRoomId);
      res.json({ ok: true });
    } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
  });

  router.post('/:id/accept', async (req, res) => {
    try {
      const { rows } = await db.query('SELECT * FROM bets WHERE id=$1', [req.params.id]);
      const bet = rows[0];
      if (!bet) return res.status(404).json({ error: 'Not found' });
      if (bet.room_id !== req.activeRoomId) return res.status(403).json({ error: 'Forbidden' });
      if (bet.status !== 'pending') return res.status(400).json({ error: 'Not pending' });
      if (bet.opponent !== req.userId) return res.status(403).json({ error: 'Not the opponent' });

      await db.transaction(async (client) => {
        await client.query('UPDATE bets SET status=$1 WHERE id=$2', ['active', bet.id]);
        await client.query(
          'UPDATE credits SET amount = amount - $1 WHERE "user" = $2',
          [bet.stake, bet.creator]
        );
      });

      broadcastUpdate(req.activeRoomId);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/:id/reject', async (req, res) => {
    try {
      const { rows } = await db.query('SELECT * FROM bets WHERE id=$1', [req.params.id]);
      const bet = rows[0];
      if (!bet) return res.status(404).json({ error: 'Not found' });
      if (bet.room_id !== req.activeRoomId) return res.status(403).json({ error: 'Forbidden' });
      if (bet.status !== 'pending') return res.status(400).json({ error: 'Not pending' });
      if (bet.opponent !== req.userId) return res.status(403).json({ error: 'Not the opponent' });

      await db.query('UPDATE bets SET status=$1 WHERE id=$2', ['rejected', bet.id]);
      broadcastUpdate(req.activeRoomId);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const me = req.userId;
      const { rows } = await db.query('SELECT * FROM bets WHERE id = $1', [req.params.id]);
      const bet = rows[0];
      if (!bet) return res.status(404).json({ error: 'Not found' });
      if (bet.room_id !== req.activeRoomId)                  return res.status(403).json({ error: 'Forbidden' });
      if (!['active','pending'].includes(bet.status))        return res.status(403).json({ error: 'Already resolved' });

      // Owner of the bet within the 60s window: free pass.
      // Otherwise (someone else, or past window): require moderate_bets permission.
      const ownerWindow = bet.creator === me && (Date.now() - bet.created_at <= 60 * 1000);
      if (!ownerWindow) {
        if (!(await requirePermission(req, res, 'moderate_bets'))) return;
      }

      const { rows: counters } = await db.query('SELECT * FROM counter_bets WHERE bet_id = $1', [bet.id]);

      await db.transaction(async (client) => {
        if (bet.status === 'active') {
          await client.query(
            'UPDATE credits SET amount = amount + $1 WHERE "user" = $2',
            [bet.stake, bet.creator]
          );
        }
        for (const cb of counters) {
          await client.query(
            'UPDATE credits SET amount = amount + $1 WHERE "user" = $2',
            [cb.stake, cb.bettor]
          );
        }
        await client.query('DELETE FROM bets WHERE id = $1', [bet.id]);
      });

      broadcastUpdate(req.activeRoomId);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/:id/flame', async (req, res) => {
    try {
      const { rows } = await db.query('SELECT room_id FROM bets WHERE id=$1', [req.params.id]);
      if (!rows[0] || rows[0].room_id !== req.activeRoomId) return res.status(403).json({ error: 'Forbidden' });
      await db.query(
        'UPDATE bets SET flamed = ((flamed | 1) - (flamed & 1)) WHERE id = $1',
        [req.params.id]
      );
      broadcastUpdate(req.activeRoomId);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/reset', async (req, res) => {
    try {
      if (!(await requirePermission(req, res, 'reset_season'))) return;
      await db.query('DELETE FROM bets WHERE room_id=$1', [req.activeRoomId]);
      await db.query(
        'UPDATE credits SET amount=100 WHERE "user" IN (SELECT id FROM users WHERE room_id=$1)',
        [req.activeRoomId]
      );
      broadcastUpdate(req.activeRoomId);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.get('/export/:user', async (req, res) => {
    try {
      if (req.params.user !== req.userId) return res.status(403).json({ error: 'Forbidden' });
      const u = req.params.user;
      const [betsRes, creditsRes, profileRes] = await Promise.all([
        db.query('SELECT * FROM bets WHERE creator=$1 AND room_id=$2 ORDER BY created_at DESC', [u, req.activeRoomId]),
        db.query('SELECT * FROM credits WHERE "user"=$1', [u]),
        db.query('SELECT id,name,avatar,color_key FROM users WHERE id=$1', [u]),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        user: u,
        profile: profileRes.rows[0] ?? null,
        credits: creditsRes.rows[0]?.amount ?? 0,
        bets: betsRes.rows,
      };
      res.setHeader('Content-Disposition', `attachment; filename="betcouple-${u}-${Date.now()}.json"`);
      res.setHeader('Content-Type', 'application/json');
      res.json(payload);
    } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
  });

  return router;
};
