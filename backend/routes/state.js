'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db.js');

async function buildState(roomId) {
  const profiles = {};
  const { rows: users } = await db.query(
    'SELECT id, name, avatar, color_key FROM users WHERE room_id=$1', [roomId]
  );
  for (const u of users) profiles[u.id] = { name:u.name, avatar:u.avatar, color:u.color_key, colorKey:u.color_key };
  console.log('[state] roomId:', roomId, 'profiles:', Object.keys(profiles));

  const credits = {};
  const { rows: creditRows } = await db.query(
    'SELECT c.user, c.amount FROM credits c JOIN users u ON u.id=c.user WHERE u.room_id=$1', [roomId]
  );
  creditRows.forEach(r => { credits[r.user] = r.amount; });

  const { rows: allCounters } = await db.query(
    `SELECT cb.* FROM counter_bets cb
     JOIN bets b ON b.id = cb.bet_id
     WHERE b.room_id=$1`, [roomId]
  );
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

  const { rows: betRows } = await db.query(
    'SELECT * FROM bets WHERE room_id=$1 ORDER BY created_at DESC', [roomId]
  );
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

  const { rows: catRows } = await db.query(
    'SELECT * FROM categories WHERE room_id=$1 OR room_id IS NULL', [roomId]
  );
  const categories = catRows.map(r => ({
    id:    r.id,
    e:     r.emoji,
    label: r.label,
    color: r.color,
  }));

  const { rows: reactionRows } = await db.query(
    `SELECT r.* FROM reactions r
     JOIN bets b ON b.id = r.bet_id
     WHERE b.room_id=$1`, [roomId]
  );
  const reactions = reactionRows.map(r => ({
    bet_id: r.bet_id,
    bettor: r.bettor,
    emoji:  r.emoji,
  }));

  return { profiles, credits, bets, categories, reactions };
}

router.get('/', async (req, res) => {
  try {
    res.json(await buildState(req.roomId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
