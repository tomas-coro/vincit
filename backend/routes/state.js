'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db.js');

async function buildState() {
  const profiles = {};
  const { rows: profileRows } = await db.query('SELECT * FROM profiles');
  profileRows.forEach(r => {
    profiles[r.user] = { name: r.name, avatar: r.avatar, colorKey: r.color_key };
  });

  const pinProtected = {};
  profileRows.forEach(r => {
    pinProtected[r.user] = r.pin_hash !== null;
  });

  const credits = {};
  const { rows: creditRows } = await db.query('SELECT * FROM credits');
  creditRows.forEach(r => {
    credits[r.user] = r.amount;
  });

  const { rows: allCounters } = await db.query('SELECT * FROM counter_bets');
  const countersByBetId = {};
  allCounters.forEach(r => {
    if (!countersByBetId[r.bet_id]) countersByBetId[r.bet_id] = [];
    countersByBetId[r.bet_id].push({
      id:           r.id,
      betId:        r.bet_id,
      bettor:       r.bettor,
      side:         r.side,
      quotaUsed:    r.quota_used,
      stake:        r.stake,
      potentialWin: r.potential_win,
      status:       r.status,
    });
  });

  const { rows: betRows } = await db.query('SELECT * FROM bets ORDER BY created_at DESC');
  const bets = betRows.map(r => ({
    id:            r.id,
    creator:       r.creator,
    title:         r.title,
    quota:         r.quota,
    stake:         r.stake,
    potentialWin:  r.potential_win,
    category:      r.category,
    isSecret:      r.is_secret === 1,
    isCounterable: r.is_counterable === 1,
    pegno:         r.pegno,
    expiresAt:     r.expires_at,
    createdAt:     r.created_at,
    status:        r.status,
    flamed:        r.flamed === 1,
    comment:       r.comment || null,
    counterBets:   countersByBetId[r.id] || [],
  }));

  const { rows: catRows } = await db.query('SELECT * FROM categories');
  const categories = catRows.map(r => ({
    id:    r.id,
    e:     r.emoji,
    label: r.label,
    color: r.color,
  }));

  const { rows: reactionRows } = await db.query('SELECT * FROM reactions');
  const reactions = reactionRows.map(r => ({
    bet_id: r.bet_id,
    bettor: r.bettor,
    emoji:  r.emoji,
  }));

  return { profiles, credits, bets, categories, pinProtected, reactions };
}

router.get('/', async (req, res) => {
  try {
    res.json(await buildState());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
