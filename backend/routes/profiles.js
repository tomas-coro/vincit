'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db.js');

module.exports = function(broadcastUpdate) {
  const router = express.Router();

  router.put('/:user', async (req, res) => {
    try {
      const { name, avatar, colorKey } = req.body;
      await db.query(
        'UPDATE profiles SET name = $1, avatar = $2, color_key = $3 WHERE "user" = $4',
        [name, avatar, colorKey, req.params.user]
      );
      broadcastUpdate();
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/:user/pin', async (req, res) => {
    try {
      const { pin } = req.body;
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: 'PIN non valido' });
      }
      const pinHash = await bcrypt.hash(pin, 10);
      await db.query(
        'UPDATE profiles SET pin_hash = $1 WHERE "user" = $2',
        [pinHash, req.params.user]
      );
      broadcastUpdate();
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/:user/pin/verify', async (req, res) => {
    try {
      const { pin } = req.body;
      const result = await db.query(
        'SELECT pin_hash FROM profiles WHERE "user" = $1',
        [req.params.user]
      );
      if (result.rows.length === 0 || result.rows[0].pin_hash === null) {
        return res.json({ valid: false });
      }
      const isValid = await bcrypt.compare(pin, result.rows[0].pin_hash);
      res.json({ valid: isValid });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/:user/pin', async (req, res) => {
    try {
      const { currentPin } = req.body;
      const result = await db.query(
        'SELECT pin_hash FROM profiles WHERE "user" = $1',
        [req.params.user]
      );
      if (result.rows.length === 0 || result.rows[0].pin_hash === null) {
        return res.status(401).json({ error: 'PIN errato' });
      }
      const isValid = await bcrypt.compare(currentPin, result.rows[0].pin_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'PIN errato' });
      }
      await db.query(
        'UPDATE profiles SET pin_hash = NULL WHERE "user" = $1',
        [req.params.user]
      );
      broadcastUpdate();
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
