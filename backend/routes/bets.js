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
              category, isSecret, isCounterable, pegno, expiresAt, opponent, isSurprise, targetUser,
              allowedMembers } = req.body;

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

      // A surprise bet requires an opponent and is never broadcasted as counterable
      const surprise = !!isSurprise && !!opponent && !isSecret;
      const counterable = isCounterable && !isSecret && !surprise;

      // Pot mode: any TARGETED non-surprise bet must wait for the opponent to
      // accept (and pick their stake). Surprise stays auto-active (otherwise
      // the surprise would be spoiled). Open / vault never go pending.
      const isTargetedAccept = !isSecret && !!opponent && !surprise;
      const isPending = isTargetedAccept || (!isSecret && opponent && stake >= threshold);
      const status = isPending ? 'pending' : 'active';

      // Validate target: must be in the same group, can't be creator, can't equal opponent (for clarity)
      let target = null;
      if (targetUser && typeof targetUser === 'string' && targetUser !== creator) {
        const { rows: m } = await db.query(
          'SELECT 1 FROM user_groups WHERE group_id=$1 AND user_id=$2',
          [roomId, targetUser]
        );
        if (m.length) target = targetUser;
      }

      // Validate allowed_members: must be array of group member ids; empty
      // / missing means "open to everyone" (legacy). Creator is always
      // implicitly included even if missing from the list.
      let allowed = null;
      if (Array.isArray(allowedMembers) && allowedMembers.length > 0) {
        const { rows: validMembers } = await db.query(
          'SELECT user_id FROM user_groups WHERE group_id=$1 AND user_id = ANY($2)',
          [roomId, allowedMembers]
        );
        const set = new Set(validMembers.map(r => r.user_id));
        set.add(creator);
        allowed = Array.from(set);
        // If everyone in the group is selected, treat it as legacy "open to all".
        const { rows: [{ count }] } = await db.query(
          'SELECT COUNT(*) FROM user_groups WHERE group_id=$1', [roomId]
        );
        if (allowed.length >= parseInt(count, 10)) allowed = null;
      }

      await db.transaction(async (client) => {
        await client.query(
          `INSERT INTO bets
             (id, creator, room_id, title, quota, stake, potential_win,
              category, is_secret, is_counterable, pegno, expires_at, created_at, status, opponent, is_surprise, target_user, allowed_members)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [id, creator, roomId, title, quota, stake, potentialWin,
           category, isSecret ? 1 : 0, counterable ? 1 : 0,
           pegno || null, expiresAt || null, createdAt, status, opponent || null, surprise ? 1 : 0, target, allowed]
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
      // Milestones may fire from the act of creating (first_bet, first_vault,
      // first_pegno_set, surprise count, night_owl, marathon, epic_night)
      refreshAchievements(creator);

      res.status(201).json({ id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/:id/resolve', async (req, res) => {
    try {
      const { outcome, force } = req.body;
      if (!['won', 'lost'].includes(outcome))
        return res.status(400).json({ error: 'outcome must be won or lost' });

      // Outcome of the consensual workflow, decided inside the transaction.
      // 'resolved' triggers the rest of the original flow (credits + notifs).
      // 'proposed' parks the proposal and returns early.
      // 'disputed'  marks the bet disputed and returns early.
      let phase = 'resolved';
      let proposalBy = null;

      await db.transaction(async (client) => {
        const { rows } = await client.query(
          'SELECT * FROM bets WHERE id = $1 FOR UPDATE', [req.params.id]
        );
        const bet = rows[0];
        if (!bet) { res.status(404).json({ error: 'Bet not found' }); return; }
        if (bet.room_id !== req.activeRoomId) { res.status(403).json({ error: 'Forbidden' }); return; }
        if (!['active', 'disputed'].includes(bet.status)) { res.status(400).json({ error: 'Bet not active' }); return; }
        if (bet.creator !== req.userId && bet.opponent !== req.userId)
          { res.status(403).json({ error: 'Forbidden' }); return; }

        const hasOpponent = bet.opponent && bet.opponent !== bet.creator;
        const consensual  = hasOpponent && !force;

        if (consensual) {
          // Three-state machine: no proposal yet → park one. Other party
          // matches → resolve. Other party disagrees → dispute.
          if (!bet.pending_outcome) {
            await client.query(
              `UPDATE bets SET pending_outcome=$1, pending_outcome_by=$2, pending_outcome_at=$3,
                              status='active'
               WHERE id=$4`,
              [outcome, req.userId, Date.now(), bet.id]
            );
            phase = 'proposed';
            proposalBy = req.userId;
            return; // exit tx; payout + notif happen outside per-phase
          }
          if (bet.pending_outcome_by === req.userId) {
            // Same party reiterating their proposal — keep state, signal idempotency.
            phase = 'already_proposed';
            proposalBy = bet.pending_outcome_by;
            return;
          }
          // Other party is responding to an existing proposal.
          if (outcome !== bet.pending_outcome) {
            await client.query(
              `UPDATE bets SET status='disputed',
                              pending_outcome=NULL, pending_outcome_by=NULL, pending_outcome_at=NULL
               WHERE id=$1`,
              [bet.id]
            );
            phase = 'disputed';
            return;
          }
          // Agreement — fall through to resolve below.
        }

        const { rows: counters } = await client.query(
          'SELECT * FROM counter_bets WHERE bet_id = $1', [bet.id]
        );

        await client.query(
          `UPDATE bets SET status=$1, resolved_at=$2,
                          pending_outcome=NULL, pending_outcome_by=NULL, pending_outcome_at=NULL
           WHERE id=$3`,
          [outcome, Date.now(), bet.id]
        );

        // Pot-mode payout: winner takes both stakes (creator\'s + opponent\'s).
        // Loser keeps their deduction. Legacy free-bet payout otherwise.
        if (bet.opponent_stake != null) {
          const pot = bet.stake + bet.opponent_stake;
          const winnerId = outcome === 'won' ? bet.creator : bet.opponent;
          await client.query(
            'UPDATE credits SET amount = amount + $1 WHERE "user" = $2',
            [pot, winnerId]
          );
        } else if (outcome === 'won') {
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

        if (phase === 'resolved') {
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
                  // Pot mode: tailor the message so the recipient sees their own
                  // outcome and the exact swing in credits.
                  let title, body;
                  if (bet.opponent_stake != null) {
                    const won = outcome === 'won';
                    const isCreator = u === bet.creator;
                    const winnerIsMe = (won && isCreator) || (!won && bet.opponent === u);
                    const myLoss  = isCreator ? bet.stake : bet.opponent_stake;
                    const myGain  = isCreator ? bet.opponent_stake : bet.stake;
                    const pot     = bet.stake + bet.opponent_stake;
                    title = winnerIsMe ? '💰 Pot vinto' : '💸 Pot perso';
                    body  = winnerIsMe
                      ? `+${myGain} ₡ (piatto ${pot} ₡) · "${bet.title}"`
                      : `−${myLoss} ₡ (piatto ${pot} ₡) · "${bet.title}"`;
                  } else {
                    title = outcome === 'won' ? '✅ Bet vinta' : '❌ Bet persa';
                    body  = `"${bet.title}"`;
                  }
                  sendPushToUser(u, { title, body, url: '/' });
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
        } else if (phase === 'proposed') {
          // Tell the OTHER party there's something to confirm.
          try {
            const { rows: [bet] } = await db.query('SELECT * FROM bets WHERE id=$1', [req.params.id]);
            const otherParty = req.userId === bet.creator ? bet.opponent : bet.creator;
            if (otherParty && await isPrefEnabled(otherParty, 'on_resolved')) {
              sendPushToUser(otherParty, {
                title: '⚖️ Conferma esito',
                body:  `"${bet.title}" · ${outcome === 'won' ? 'dice SÌ' : 'dice NO'} — sei d'accordo?`,
                url:   '/',
              });
            }
          } catch (e) { console.error('notify on propose failed', e); }
        } else if (phase === 'disputed') {
          // Both parties already know — push both so it shows in the badge stream.
          try {
            const { rows: [bet] } = await db.query('SELECT * FROM bets WHERE id=$1', [req.params.id]);
            for (const u of [bet.creator, bet.opponent].filter(Boolean)) {
              if (u === req.userId) continue;
              if (await isPrefEnabled(u, 'on_resolved')) {
                sendPushToUser(u, {
                  title: '⚠️ Esiti discordi',
                  body:  `"${bet.title}" · usate l'Overtime per decidere`,
                  url:   '/',
                });
              }
            }
          } catch (e) { console.error('notify on dispute failed', e); }
        }

        res.json({ ok: true, phase, proposalBy });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/bets/:id/withdraw-resolve — proposer takes back their proposed
  // outcome. Returns the bet to plain 'active' with no pending fields. Either
  // party can also withdraw a proposal that's stalling, including the
  // non-proposer (so a stubborn proposer can't lock the bet forever).
  router.post('/:id/withdraw-resolve', async (req, res) => {
    try {
      const { rows } = await db.query('SELECT * FROM bets WHERE id=$1', [req.params.id]);
      const bet = rows[0];
      if (!bet)                                         return res.status(404).json({ error: 'Bet not found' });
      if (bet.room_id !== req.activeRoomId)             return res.status(403).json({ error: 'Forbidden' });
      if (!bet.pending_outcome)                         return res.status(400).json({ error: 'no_pending' });
      if (bet.creator !== req.userId && bet.opponent !== req.userId)
                                                        return res.status(403).json({ error: 'Forbidden' });

      await db.query(
        `UPDATE bets SET pending_outcome=NULL, pending_outcome_by=NULL, pending_outcome_at=NULL
         WHERE id=$1`,
        [req.params.id]
      );
      broadcastUpdate(req.activeRoomId);
      res.json({ ok: true });
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
      // Subset enforcement
      if (Array.isArray(bet.allowed_members) && bet.allowed_members.length > 0) {
        const ok = bet.creator === bettor || bet.opponent === bettor
                || bet.target_user === bettor || bet.allowed_members.includes(bettor);
        if (!ok) return res.status(403).json({ error: 'Not invited to this bet' });
      }

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

      // Optional pot-mode stake. If absent we fall back to legacy free-bet
      // behavior (creator-only stake, casino payout on win).
      let opponentStake = null;
      if (req.body && req.body.stake != null) {
        const s = parseInt(req.body.stake, 10);
        if (!Number.isInteger(s) || s < 1) return res.status(400).json({ error: 'stake_invalid' });
        // Check opponent has the credits
        const { rows: cr } = await db.query('SELECT amount FROM credits WHERE "user"=$1', [req.userId]);
        const have = cr[0]?.amount ?? 0;
        if (s > have) return res.status(400).json({ error: 'insufficient_credits' });
        opponentStake = s;
      }

      await db.transaction(async (client) => {
        if (opponentStake != null) {
          await client.query(
            'UPDATE bets SET status=$1, opponent_stake=$2 WHERE id=$3',
            ['active', opponentStake, bet.id]
          );
          // Deduct both stakes: creator\'s X (held now for the first time) +
          // opponent\'s chosen Y. Winner-takes-pot at resolve time.
          await client.query(
            'UPDATE credits SET amount = amount - $1 WHERE "user" = $2',
            [bet.stake, bet.creator]
          );
          await client.query(
            'UPDATE credits SET amount = amount - $1 WHERE "user" = $2',
            [opponentStake, req.userId]
          );
        } else {
          // Legacy: deduct only creator stake.
          await client.query('UPDATE bets SET status=$1 WHERE id=$2', ['active', bet.id]);
          await client.query(
            'UPDATE credits SET amount = amount - $1 WHERE "user" = $2',
            [bet.stake, bet.creator]
          );
        }
      });

      broadcastUpdate(req.activeRoomId);

      // Ping the creator: their challenge has been accepted. Pot mode includes
      // the total pot in the body so they see the stakes are now locked in.
      try {
        if (bet.creator !== req.userId && await isPrefEnabled(bet.creator, 'on_challenged')) {
          const body = opponentStake != null
            ? `Hanno accettato · piatto ${bet.stake + opponentStake} ₡ · "${bet.title}"`
            : `Hanno accettato la tua bet: "${bet.title}"`;
          sendPushToUser(bet.creator, {
            title: '✅ Sfida accettata',
            body,
            url:   '/',
          });
        }
      } catch (e) { console.error('notify on accept failed', e); }

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PATCH /api/bets/:id/allowed-members — owner or moderate_bets co-admin
  // can edit the invitee list while the bet is still active. Cannot remove
  // anyone who has already counter-bet (their stake would be orphaned).
  router.patch('/:id/allowed-members', async (req, res) => {
    try {
      const { rows } = await db.query('SELECT * FROM bets WHERE id=$1', [req.params.id]);
      const bet = rows[0];
      if (!bet) return res.status(404).json({ error: 'not_found' });
      if (bet.room_id !== req.activeRoomId) return res.status(403).json({ error: 'forbidden' });
      if (!['active','pending'].includes(bet.status)) return res.status(400).json({ error: 'not_active' });

      // Authz: creator gets a free pass; otherwise need moderate_bets.
      if (bet.creator !== req.userId) {
        if (!(await requirePermission(req, res, 'moderate_bets'))) return;
      }

      const incoming = Array.isArray(req.body?.ids) ? req.body.ids : null;

      // Empty / null => fall back to fully open.
      if (!incoming || incoming.length === 0) {
        await db.query('UPDATE bets SET allowed_members=NULL WHERE id=$1', [bet.id]);
        broadcastUpdate(req.activeRoomId);
        return res.json({ ok: true, allowedMembers: null });
      }

      // Validate every id is a current group member.
      const { rows: members } = await db.query(
        'SELECT user_id FROM user_groups WHERE group_id=$1 AND user_id = ANY($2)',
        [bet.room_id, incoming]
      );
      const set = new Set(members.map(r => r.user_id));
      set.add(bet.creator);

      // Can\'t remove an existing counter-bettor.
      const { rows: cbs } = await db.query(
        'SELECT DISTINCT bettor FROM counter_bets WHERE bet_id=$1',
        [bet.id]
      );
      for (const r of cbs) set.add(r.bettor);

      const arr = Array.from(set);
      // If the new list spans the whole group, collapse back to NULL.
      const { rows: [{ count }] } = await db.query(
        'SELECT COUNT(*) FROM user_groups WHERE group_id=$1', [bet.room_id]
      );
      const finalList = arr.length >= parseInt(count, 10) ? null : arr;

      await db.query('UPDATE bets SET allowed_members=$1 WHERE id=$2', [finalList, bet.id]);
      broadcastUpdate(req.activeRoomId);
      res.json({ ok: true, allowedMembers: finalList });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'server_error' });
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

  // POST /api/bets/test-reset — like /reset but ALSO wipes trophies of all
  // group members. Use it during testing to keep stats and achievements clean.
  router.post('/test-reset', async (req, res) => {
    try {
      if (!(await requirePermission(req, res, 'reset_season'))) return;
      const roomId = req.activeRoomId;

      await db.transaction(async (client) => {
        const { rows: members } = await client.query(
          'SELECT user_id FROM user_groups WHERE group_id=$1', [roomId]
        );
        const userIds = members.map(m => m.user_id);

        // Cascade DELETE on counter_bets / reactions
        await client.query(
          'DELETE FROM reactions WHERE bet_id IN (SELECT id FROM bets WHERE room_id=$1)', [roomId]
        );
        await client.query(
          'DELETE FROM counter_bets WHERE bet_id IN (SELECT id FROM bets WHERE room_id=$1)', [roomId]
        );
        await client.query('DELETE FROM bets WHERE room_id=$1', [roomId]);

        // Reset credits to 100 for these members
        if (userIds.length) {
          await client.query(
            `UPDATE credits SET amount=100 WHERE "user" = ANY($1)`,
            [userIds]
          );
          await client.query(
            `DELETE FROM achievements WHERE user_id = ANY($1)`,
            [userIds]
          );
        }
      });

      broadcastUpdate(roomId);
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
