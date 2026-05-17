'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db.js');

async function buildState(roomId, viewerId) {
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
  // Comment counts per bet — cheap aggregated query so the BetCard can
  // show "💬 N" without per-bet round-trips. Actual messages are still
  // fetched on-demand when the user expands the thread.
  const { rows: msgCountRows } = await db.query(
    `SELECT bm.bet_id, COUNT(*)::int AS n
     FROM bet_messages bm JOIN bets b ON b.id = bm.bet_id
     WHERE b.room_id=$1
     GROUP BY bm.bet_id`,
    [roomId]
  );
  const messageCounts = {};
  for (const r of msgCountRows) messageCounts[r.bet_id] = r.n;
  // Visibility filter:
  // - Vault (is_secret): only creator (the existing client-side handles this too)
  // - Surprise (is_surprise) while active/pending: only creator + opponent
  // - Subset (allowed_members IS NOT NULL): only listed members (+ creator,
  //   target, opponent, who are always in the loop)
  // - Resolved (won/lost/rejected): always visible to group (even if was surprise)
  const visibleRows = betRows.filter(r => {
    if (r.is_secret === 1) return r.creator === viewerId;
    if (r.is_surprise === 1 && ['active', 'pending', 'disputed'].includes(r.status)) {
      return r.creator === viewerId || r.opponent === viewerId;
    }
    if (Array.isArray(r.allowed_members) && r.allowed_members.length > 0) {
      if (r.creator === viewerId) return true;
      if (r.opponent === viewerId) return true;
      if (r.target_user === viewerId) return true;
      return r.allowed_members.includes(viewerId);
    }
    return true;
  });
  const bets = visibleRows.map(r => ({
    id:               r.id,
    creator:          r.creator,
    title:            r.title,
    quota:            r.quota,
    stake:            r.stake,
    potentialWin:     r.potential_win,
    category:         r.category,
    isSecret:         r.is_secret === 1,
    isSurprise:       r.is_surprise === 1,
    isCounterable:    r.is_counterable === 1,
    pegno:            r.pegno,
    expiresAt:        r.expires_at,
    createdAt:        r.created_at,
    status:           r.status,
    flamed:           r.flamed === 1,
    comment:          r.comment || null,
    counterBets:      countersByBetId[r.id] || [],
    opponent:         r.opponent || null,
    targetUser:       r.target_user || null,
    allowedMembers:   Array.isArray(r.allowed_members) ? r.allowed_members : null,
    opponentStake:    r.opponent_stake ?? null,
    pendingOutcome:   r.pending_outcome || null,
    pendingOutcomeBy: r.pending_outcome_by || null,
    pendingOutcomeAt: r.pending_outcome_at ?? null,
    messageCount:     messageCounts[r.id] ?? 0,
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

  const { rows: feedRows } = await db.query(
    `SELECT * FROM events
     WHERE room_id=$1 AND feed_visible=true
       AND (
         event_type IN ('bet_created','bet_resolved_group')
         OR (event_type IN ('bet_won','bet_lost') AND feed_actor_id=$2)
         OR (event_type = 'challenge_received'    AND feed_target_id=$2)
         OR (event_type = 'bet_accepted'          AND feed_target_id=$2)
         OR (event_type IN ('trophy_unlocked','streak_milestone') AND feed_actor_id=$2)
       )
     ORDER BY created_at DESC LIMIT 50`,
    [roomId, viewerId]
  );

  return { profiles, credits, bets, categories, reactions, settings, feedEvents: feedRows };
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
    res.json(await buildState(groupId, req.userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
