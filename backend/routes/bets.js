'use strict';
const express = require('express');
const db = require('../db.js');

module.exports = function(broadcastUpdate) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    try {
      const { id, creator, title, quota, stake, potentialWin,
              category, isSecret, isCounterable, pegno, expiresAt, createdAt } = req.body;

      await db.transaction(async (client) => {
        await client.query(
          `INSERT INTO bets
             (id, creator, title, quota, stake, potential_win,
              category, is_secret, is_counterable, pegno, expires_at, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [id, creator, title, quota, stake, potentialWin,
           category, isSecret ? 1 : 0, isCounterable ? 1 : 0,
           pegno || null, expiresAt || null, createdAt]
        );
        await client.query(
          'UPDATE credits SET amount = amount - $1 WHERE "user" = $2',
          [stake, creator]
        );
      });

      broadcastUpdate();
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

      broadcastUpdate();
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/:id/counter', async (req, res) => {
    try {
      const { id, bettor, side, quotaUsed, stake, potentialWin } = req.body;

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

      broadcastUpdate();
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
      await db.query('UPDATE bets SET comment = $1 WHERE id = $2', [comment, req.params.id]);
      broadcastUpdate();
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/:id/flame', async (req, res) => {
    try {
      await db.query(
        'UPDATE bets SET flamed = ((flamed | 1) - (flamed & 1)) WHERE id = $1',
        [req.params.id]
      );
      broadcastUpdate();
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
