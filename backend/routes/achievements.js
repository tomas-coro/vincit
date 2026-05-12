'use strict';
const express = require('express');
const router = express.Router();
const { CATALOG, listForUser } = require('../achievements.js');

// GET /api/achievements — list this user's unlocked achievements + the catalog
router.get('/', async (req, res) => {
  try {
    const unlocked = await listForUser(req.userId);
    res.json({
      catalog:  CATALOG,
      unlocked, // [{ achievement_id, unlocked_at }]
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
