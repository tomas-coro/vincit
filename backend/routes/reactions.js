'use strict';
const express = require('express');
const db = require('../db.js');

const VALID_EMOJIS = ['🔥', '😂', '👀', '💀', '⚡'];

module.exports = function(broadcastUpdate) {
  const router = express.Router();

  // POST /api/bets/:id/reaction
  router.post('/:id/reaction', async (req, res) => {
    try {
      const { bettor, emoji } = req.body;
      if (!VALID_EMOJIS.includes(emoji)) {
        return res.status(400).json({ error: 'Emoji non valida' });
      }
      await db.query(
        `INSERT INTO reactions (bet_id, bettor, emoji)
         VALUES ($1, $2, $3)
         ON CONFLICT (bet_id, bettor) DO UPDATE SET emoji = $3`,
        [req.params.id, bettor, emoji]
      );
      broadcastUpdate();
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /api/bets/:id/reaction/:bettor
  router.delete('/:id/reaction/:bettor', async (req, res) => {
    try {
      await db.query(
        'DELETE FROM reactions WHERE bet_id = $1 AND bettor = $2',
        [req.params.id, req.params.bettor]
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
