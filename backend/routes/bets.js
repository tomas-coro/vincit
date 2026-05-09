'use strict';
const express = require('express');
const db = require('../db.js');
const { sendPushToUser } = require('./push.js');
const { requireOwner } = require('../middleware/auth.js');

module.exports = function(broadcastUpdate) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    try {
      const creator = req.userId;
      const roomId  = req.roomId;
      const { id, title, quota, stake, potentialWin,
              category, isSecret, isCounterable, pegno, expiresAt, createdAt, opponent } = req.body;

      const { rows: roomRows } = await db.query(
        'SELECT acceptance_threshold FROM rooms WHERE id=$1', [roomId]
      );
      const threshold = roomRows[0]?.acceptance_threshold ?? 20;
      const isPending = !isSecret && opponent && stake >= threshold;
      const status = isPending ? 'pending' : 'active';

      await db.transaction(async (client) => {
        await client.query(
          `INSERT INTO bets
             (id, creator, room_id, title, quota, stake, potential_win,
              category, is_secret, is_counterable, pegno, expires_at, created_at, status, opponent)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [id, creator, roomId, title, quota, stake, potentialWin,
           category, isSecret ? 1 : 0, isCounterable ? 1 : 0,
           pegno || null, expiresAt || null, createdAt, status, opponent || null]
        );
        if (!isPending) {
          await client.query(
            'UPDATE credits SET amount = amount - $1 WHERE "user" = $2',
            [stake, creator]
          );
        }
      });

      broadcastUpdate(roomId);
      const { rows: partners } = await db.query(
        'SELECT id FROM users WHERE room_id=$1 AND id!=$2', [roomId, creator]
      );
      if (partners[0]) {
        const targetUser = partners[0].id;
        const { rows: prefs } = await db.query('SELECT on_new_bet FROM notification_prefs WHERE "user"=$1', [targetUser]);
        if (prefs[0]?.on_new_bet !== false) sendPushToUser(targetUser, { title:'BetCouple 🎲', body:`Nuova bet: "${title}"`, url:'/' });
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
      const { rows } = await db.query('SELECT * FROM bets WHERE id = $1', [req.params.id]);
      const bet = rows[0];
      if (!bet) return res.status(404).json({ error: 'Bet not found' });
      if (bet.room_id !== req.roomId) return res.status(403).json({ error: 'Forbidden' });

      const { rows: counters } = await db.query(
        'SELECT * FROM counter_bets WHERE bet_id = $1', [bet.id]
      );

      await db.transaction(async (client) => {
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

      broadcastUpdate(req.roomId);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/:id/counter', async (req, res) => {
    try {
      const bettor = req.userId;
      const { id, side, quotaUsed, stake, potentialWin } = req.body;

      const { rows } = await db.query('SELECT * FROM bets WHERE id=$1', [req.params.id]);
      const bet = rows[0];
      if (!bet) return res.status(404).json({ error: 'Bet not found' });
      if (bet.room_id !== req.roomId) return res.status(403).json({ error: 'Forbidden' });

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

      broadcastUpdate(req.roomId);
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
      if (!rows[0] || rows[0].room_id !== req.roomId) return res.status(403).json({ error: 'Forbidden' });
      await db.query('UPDATE bets SET comment = $1 WHERE id = $2', [comment, req.params.id]);
      broadcastUpdate(req.roomId);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/:id/edit', async (req, res) => {
    try {
      const creator = req.userId;
      const { title, quota, category, pegno, expiresAt } = req.body;
      if (!title?.trim()) return res.status(400).json({ error: 'Invalid' });
      const { rows } = await db.query('SELECT * FROM bets WHERE id=$1', [req.params.id]);
      const bet = rows[0];
      if (!bet)                                    return res.status(404).json({ error: 'Not found' });
      if (bet.room_id !== req.roomId)              return res.status(403).json({ error: 'Forbidden' });
      if (bet.creator !== creator)                 return res.status(403).json({ error: 'Forbidden' });
      if (bet.status !== 'active')                 return res.status(403).json({ error: 'Already resolved' });
      if (Date.now() - bet.created_at > 60000)     return res.status(403).json({ error: 'Window expired' });
      const potentialWin = Math.round(bet.stake * parseFloat(quota));
      await db.query(
        `UPDATE bets SET title=$1, quota=$2, potential_win=$3, category=$4, pegno=$5, expires_at=$6 WHERE id=$7`,
        [title.trim(), parseFloat(quota), potentialWin, category, pegno||null, expiresAt||null, bet.id]
      );
      broadcastUpdate(req.roomId);
      res.json({ ok: true });
    } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
  });

  router.post('/:id/accept', async (req, res) => {
    try {
      const { rows } = await db.query('SELECT * FROM bets WHERE id=$1', [req.params.id]);
      const bet = rows[0];
      if (!bet) return res.status(404).json({ error: 'Not found' });
      if (bet.room_id !== req.roomId) return res.status(403).json({ error: 'Forbidden' });
      if (bet.status !== 'pending') return res.status(400).json({ error: 'Not pending' });
      if (bet.opponent !== req.userId) return res.status(403).json({ error: 'Not the opponent' });

      await db.transaction(async (client) => {
        await client.query('UPDATE bets SET status=$1 WHERE id=$2', ['active', bet.id]);
        await client.query(
          'UPDATE credits SET amount = amount - $1 WHERE "user" = $2',
          [bet.stake, bet.creator]
        );
      });

      broadcastUpdate(req.roomId);
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
      if (bet.room_id !== req.roomId) return res.status(403).json({ error: 'Forbidden' });
      if (bet.status !== 'pending') return res.status(400).json({ error: 'Not pending' });
      if (bet.opponent !== req.userId) return res.status(403).json({ error: 'Not the opponent' });

      await db.query('UPDATE bets SET status=$1 WHERE id=$2', ['rejected', bet.id]);
      broadcastUpdate(req.roomId);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const creator = req.userId;
      const { rows } = await db.query('SELECT * FROM bets WHERE id = $1', [req.params.id]);
      const bet = rows[0];
      if (!bet) return res.status(404).json({ error: 'Not found' });
      if (bet.room_id !== req.roomId)                        return res.status(403).json({ error: 'Forbidden' });
      if (bet.creator !== creator)                           return res.status(403).json({ error: 'Forbidden' });
      if (!['active','pending'].includes(bet.status))        return res.status(403).json({ error: 'Already resolved' });
      if (Date.now() - bet.created_at > 60 * 1000)          return res.status(403).json({ error: 'Window expired' });

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

      broadcastUpdate(req.roomId);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/:id/flame', async (req, res) => {
    try {
      const { rows } = await db.query('SELECT room_id FROM bets WHERE id=$1', [req.params.id]);
      if (!rows[0] || rows[0].room_id !== req.roomId) return res.status(403).json({ error: 'Forbidden' });
      await db.query(
        'UPDATE bets SET flamed = ((flamed | 1) - (flamed & 1)) WHERE id = $1',
        [req.params.id]
      );
      broadcastUpdate(req.roomId);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/reset', async (req, res) => {
    try {
      if (!(await requireOwner(req, res))) return;
      await db.query('DELETE FROM bets WHERE room_id=$1', [req.roomId]);
      await db.query(
        'UPDATE credits SET amount=100 WHERE "user" IN (SELECT id FROM users WHERE room_id=$1)',
        [req.roomId]
      );
      broadcastUpdate(req.roomId);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.get('/export/:user', async (req, res) => {
    try {
      const u = req.params.user;
      const [betsRes, creditsRes, profileRes] = await Promise.all([
        db.query('SELECT * FROM bets WHERE creator=$1 AND room_id=$2 ORDER BY created_at DESC', [u, req.roomId]),
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
