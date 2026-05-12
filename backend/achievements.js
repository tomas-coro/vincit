'use strict';
const db = require('./db.js');
const { sendPushToUser, isPrefEnabled } = require('./routes/push.js');

// Static catalog. UI uses these ids and renders the icon/title from i18n.
const CATALOG = [
  { id: 'first_win',    icon: '🎯', tier: 'bronze' },
  { id: 'wins_5',       icon: '🥉', tier: 'bronze' },
  { id: 'wins_25',      icon: '🥈', tier: 'silver' },
  { id: 'wins_100',     icon: '🥇', tier: 'gold'   },
  { id: 'streak_3',     icon: '🔥', tier: 'bronze' },
  { id: 'streak_5',     icon: '🔥', tier: 'silver' },
  { id: 'streak_10',    icon: '🔥', tier: 'gold'   },
  { id: 'outsider',     icon: '🌙', tier: 'silver' },
  { id: 'miracle',      icon: '💫', tier: 'gold'   },
  { id: 'total_10',     icon: '🎲', tier: 'bronze' },
  { id: 'total_50',     icon: '🎲', tier: 'silver' },
  { id: 'surprise_won', icon: '🤫', tier: 'silver' },
  { id: 'target_won',   icon: '🛡', tier: 'silver' },
  { id: 'comeback',     icon: '⚖',  tier: 'silver' },
  { id: 'bluff',        icon: '🃏', tier: 'silver' },
  { id: 'balance_500',  icon: '💎', tier: 'gold'   },
];

// Evaluate user's stats and return ids of achievements they qualify for.
async function computeUnlocked(userId) {
  const out = new Set();

  // Pull all the user's resolved bets in chronological order (across all their groups)
  const { rows: bets } = await db.query(
    `SELECT id, creator, status, quota, stake, potential_win, is_surprise, target_user, opponent,
            COALESCE(created_at, 0) AS created_at
     FROM bets
     WHERE creator=$1 AND status IN ('won','lost')
     ORDER BY created_at ASC`,
    [userId]
  );

  const totalResolved = bets.length;
  const wins = bets.filter(b => b.status === 'won');
  const winCount = wins.length;

  if (winCount >= 1)   out.add('first_win');
  if (winCount >= 5)   out.add('wins_5');
  if (winCount >= 25)  out.add('wins_25');
  if (winCount >= 100) out.add('wins_100');
  if (totalResolved >= 10) out.add('total_10');
  if (totalResolved >= 50) out.add('total_50');

  // Win streak
  let cur = 0, best = 0;
  for (const b of bets) {
    if (b.status === 'won') { cur++; if (cur > best) best = cur; }
    else cur = 0;
  }
  if (best >= 3)  out.add('streak_3');
  if (best >= 5)  out.add('streak_5');
  if (best >= 10) out.add('streak_10');

  // High-odds wins
  if (wins.some(b => parseFloat(b.quota) >= 5))  out.add('outsider');
  if (wins.some(b => parseFloat(b.quota) >= 10)) out.add('miracle');
  if (wins.some(b => parseFloat(b.quota) >= 3))  out.add('bluff');

  // Surprise win (bet creator won a bet that was marked surprise)
  if (wins.some(b => b.is_surprise === 1)) out.add('surprise_won');

  // "Target win": this user is the target on a bet that resolved (regardless of outcome)
  const { rows: targetRows } = await db.query(
    `SELECT 1 FROM bets WHERE target_user=$1 AND status IN ('won','lost') LIMIT 1`,
    [userId]
  );
  if (targetRows.length) out.add('target_won');

  // Comeback: win after 3 consecutive losses
  let lossStreak = 0;
  for (const b of bets) {
    if (b.status === 'lost') lossStreak++;
    else {
      if (lossStreak >= 3) { out.add('comeback'); break; }
      lossStreak = 0;
    }
  }

  // Balance milestone (across all groups: simple aggregate from credits table)
  const { rows: cr } = await db.query('SELECT amount FROM credits WHERE "user"=$1', [userId]);
  if (cr[0]?.amount >= 500) out.add('balance_500');

  return [...out];
}

// Check what's new and insert + notify.
async function refreshAchievements(userId) {
  try {
    const qualified = await computeUnlocked(userId);
    if (!qualified.length) return [];
    const { rows: already } = await db.query(
      'SELECT achievement_id FROM achievements WHERE user_id=$1', [userId]
    );
    const had = new Set(already.map(r => r.achievement_id));
    const newOnes = qualified.filter(id => !had.has(id));
    if (!newOnes.length) return [];

    const now = Date.now();
    for (const a of newOnes) {
      await db.query(
        `INSERT INTO achievements(user_id, achievement_id, unlocked_at)
         VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
        [userId, a, now]
      );
    }

    // Fire-and-forget push notification (single message per unlock burst)
    if (await isPrefEnabled(userId, 'on_resolved')) {
      sendPushToUser(userId, {
        title: newOnes.length === 1 ? '🏆 Trofeo sbloccato!' : `🏆 ${newOnes.length} trofei sbloccati!`,
        body:  newOnes.length === 1
          ? `Hai sbloccato un nuovo trofeo`
          : `Hai sbloccato ${newOnes.length} trofei nuovi`,
        url:   '/',
      });
    }
    return newOnes;
  } catch (e) {
    console.error('[achievements] refresh failed', e);
    return [];
  }
}

async function listForUser(userId) {
  const { rows } = await db.query(
    'SELECT achievement_id, unlocked_at FROM achievements WHERE user_id=$1',
    [userId]
  );
  return rows;
}

module.exports = { CATALOG, refreshAchievements, listForUser, computeUnlocked };
