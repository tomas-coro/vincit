'use strict';
const express = require('express');
const db = require('../db.js');

module.exports = function(broadcastUpdate) {
  const router = express.Router();

  router.put('/', async (req, res) => {
    try {
      const { tomas, giulia } = req.body;
      await db.transaction(async (client) => {
        await client.query('UPDATE credits SET amount = $1 WHERE "user" = $2', [tomas, 'tomas']);
        await client.query('UPDATE credits SET amount = $1 WHERE "user" = $2', [giulia, 'giulia']);
      });
      broadcastUpdate();
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/:user', async (req, res) => {
    try {
      const { delta } = req.body;
      if (!Number.isInteger(delta) || delta === 0) {
        return res.status(400).json({ error: 'Delta deve essere un intero non zero' });
      }
      if (delta < -10000 || delta > 10000) {
        return res.status(400).json({ error: 'Delta fuori range' });
      }
      const { rows } = await db.query('SELECT amount FROM credits WHERE "user" = $1', [req.params.user]);
      if (!rows.length) return res.status(404).json({ error: 'User not found' });
      const current = rows[0].amount;
      if (current + delta < 0) {
        return res.status(400).json({ error: 'Crediti insufficienti' });
      }
      const { rows: updated } = await db.query(
        'UPDATE credits SET amount = amount + $1 WHERE "user" = $2 RETURNING amount',
        [delta, req.params.user]
      );
      broadcastUpdate();
      res.json({ user: req.params.user, newAmount: updated[0].amount });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
