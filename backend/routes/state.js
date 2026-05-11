'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db.js');

async function buildState(roomId) {
  const profiles = {};
  // Prefer user_groups (multi-group), fall back to users.room_id for legacy rows
  const { rows: members } = await db.query(
    `SELECT DISTINCT u.id, u.name, u.avatar, u.avatar_url, u.color_key
     FROM users u
     LEFT JOIN user_groups ug ON ug.user_id = u.id
     WHERE ug.group_id = $1 OR (u.room_id = $1 AND NOT EXISTS (SELECT 1 FROM user_groups WHERE group_id=$1))`,
    [roomId]
  );
  for (const u of members) profiles[u.id] = { name:u.name, avatar:u.avatar, avatarUrl:u.avatar_url, color:u.color_key, colorKey:u.color_key };

  const credits = {};
  const { rows: creditRows } = await db.query(
    `SELECT c.user, c.amount FROM credits c
     WHERE c.user IN (
       SELECT user_id FROM user_groups WHERE group_id=$1
       UNION SELECT id FROM users WHERE room_id=$1 AND NOT EXISTS (SELECT 1 FROM user_groups WHERE group_id=$1)
     )`,
    [roomId]
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
    opponent:      r.opponent || null,
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
    bet_id:    r.bet_id,
    bettor:    r.bettor,
    emoji:     r.emoji,
    image_url: r.image_url,
  }));

  const { rows: roomRows } = await db.query(
    'SELECT acceptance_threshold, max_stake FROM rooms WHERE id=$1', [roomId]
  );
  const settings = roomRows[0]
    ? { acceptance_threshold: roomRows[0].acceptance_threshold ?? 20, max_stake: roomRows[0].max_stake ?? 100 }
    : { acceptance_threshold: 20, max_stake: 100 };

  return { profiles, credits, bets, categories, reactions, settings };
}

router.get('/', async (req, res) => {
  try {
    let groupId = req.roomId;
    if (req.query.groupId && req.query.groupId !== req.roomId) {
      const { rows } = await db.query(
        'SELECT 1 FROM user_groups WHERE group_id=$1 AND user_id=$2',
        [req.query.groupId, req.userId]
      );
      if (!rows.length) return res.status(403).json({ error: 'not_member' });
      groupId = req.query.groupId;
    }
    res.json(await buildState(groupId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
