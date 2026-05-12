'use strict';
const db = require('./db.js');
const { sendPushToUser, isPrefEnabled } = require('./routes/push.js');

// Leveled trophy catalog. Each entry has `levels: [t1..t5]` thresholds.
// The frontend renders 5 segments and the current level badge.
// categories: positive | challenge | mission | shadow | social
const CATALOG = [
  // ── Positive (scale / volume / earnings) ──
  { id: 'wins',           icon: '🏆', category: 'positive',  levels: [1, 5, 25, 100, 250] },
  { id: 'win_streak',     icon: '🔥', category: 'positive',  levels: [3, 5, 10, 15, 25] },
  { id: 'volume',         icon: '🎲', category: 'positive',  levels: [10, 50, 100, 250, 500] },
  { id: 'earnings',       icon: '💎', category: 'positive',  levels: [100, 500, 1000, 5000, 10000] },

  // ── Challenge (odds / single payout / stake size) ──
  { id: 'high_odds',      icon: '🌙', category: 'challenge', levels: [2, 3, 5, 10, 20] },
  { id: 'daredevil',      icon: '🎢', category: 'challenge', levels: [5, 10, 20, 50, 100] },
  { id: 'safe_bet',       icon: '🛡', category: 'challenge', levels: [10, 25, 50, 100, 250] },
  { id: 'single_win',     icon: '💰', category: 'challenge', levels: [25, 100, 250, 500, 1000] },
  { id: 'high_roller',    icon: '🪙', category: 'challenge', levels: [100, 250, 500, 1000, 5000] },

  // ── Mission (special actions / time / surprise / target / comeback) ──
  { id: 'surprise',       icon: '🤫', category: 'mission',   levels: [1, 5, 10, 25, 50] },
  { id: 'pegno',          icon: '🎁', category: 'mission',   levels: [1, 5, 10, 25, 50] },
  { id: 'night_owl',      icon: '🌙', category: 'mission',   levels: [5, 15, 30, 50, 100] },
  { id: 'early_bird',     icon: '🌅', category: 'mission',   levels: [5, 15, 30, 50, 100] },
  { id: 'marathon',       icon: '🏃', category: 'mission',   levels: [10, 15, 20, 30, 50] },
  { id: 'commentator',    icon: '💬', category: 'mission',   levels: [10, 25, 50, 100, 250] },
  { id: 'quick_resolve',  icon: '⚡', category: 'mission',   levels: [5, 10, 25, 50, 100] },
  { id: 'comeback',       icon: '⚖',  category: 'mission',   levels: [3, 5, 7, 10, 15] },
  { id: 'equilibrium',    icon: '☯',  category: 'mission',   levels: [10, 25, 50, 100, 250] },

  // ── Shadow (losses / worst stakes / cruel losses) ──
  { id: 'losses',         icon: '🪦', category: 'shadow',    levels: [1, 5, 25, 50, 100] },
  { id: 'loss_streak',    icon: '❄️', category: 'shadow',    levels: [3, 5, 10, 15, 25] },
  { id: 'worst_loss',     icon: '💸', category: 'shadow',    levels: [50, 100, 250, 500, 1000] },
  { id: 'outsider_lost',  icon: '🎢', category: 'shadow',    levels: [1, 3, 5, 10, 20] },

  // ── Social (group interactions) ──
  { id: 'flamed',         icon: '🔥', category: 'social',    levels: [5, 15, 30, 50, 100] },
  { id: 'paparazzo',      icon: '📷', category: 'social',    levels: [5, 15, 30, 50, 100] },
  { id: 'counter_winner', icon: '⚡', category: 'social',    levels: [10, 25, 50, 100, 250] },
  { id: 'targeted',       icon: '🎯', category: 'social',    levels: [1, 5, 10, 25, 50] },
  { id: 'multi_group',    icon: '🌐', category: 'social',    levels: [3, 5, 8, 12, 20] },
  { id: 'recruiter',      icon: '📣', category: 'social',    levels: [1, 3, 5, 10, 25] },
];

// Computes per-achievement progress as: { current, level, max_level, target_next, max_target }
async function computeProgressFor(userId) {
  const { rows: resolved } = await db.query(
    `SELECT id, creator, status, quota, stake, potential_win,
            is_surprise, target_user, opponent, pegno, comment,
            COALESCE(created_at, 0) AS created_at,
            COALESCE(resolved_at, 0) AS resolved_at
     FROM bets
     WHERE creator=$1 AND status IN ('won','lost')
     ORDER BY created_at ASC`,
    [userId]
  );
  const { rows: allMine } = await db.query(
    `SELECT created_at, stake, pegno, is_surprise, status FROM bets WHERE creator=$1`,
    [userId]
  );

  const wins   = resolved.filter(b => b.status === 'won');
  const losses = resolved.filter(b => b.status === 'lost');

  // Streaks
  let bestWinStreak = 0, curWin = 0;
  let bestLossStreak = 0, curLoss = 0;
  let bestComeback = 0, lossesBeforeWin = 0;
  for (const b of resolved) {
    if (b.status === 'won')  {
      curWin++; curLoss = 0;
      if (curWin > bestWinStreak) bestWinStreak = curWin;
      if (lossesBeforeWin > bestComeback) bestComeback = lossesBeforeWin;
      lossesBeforeWin = 0;
    } else {
      curLoss++; curWin = 0; lossesBeforeWin++;
      if (curLoss > bestLossStreak) bestLossStreak = curLoss;
    }
  }

  const winQuotas = wins.map(b => parseFloat(b.quota || 0));
  const winMaxQuota = winQuotas.reduce((mx, q) => Math.max(mx, q), 0);
  const safeBetCount = wins.filter(b => parseFloat(b.quota) <= 1.30).length;
  const daredevilCount = wins.filter(b => parseFloat(b.quota) >= 5).length;
  const highOddsLostCount = losses.filter(b => parseFloat(b.quota) >= 5).length;

  const winDeltas = wins.map(b => Number(b.potential_win) - Number(b.stake));
  const maxSingleWin = winDeltas.reduce((mx, d) => Math.max(mx, d), 0);
  const totalEarnings = winDeltas.reduce((s, d) => s + d, 0);

  const maxStakePlaced = allMine.reduce((mx, b) => Math.max(mx, Number(b.stake) || 0), 0);
  const maxStakeLost   = losses.reduce((mx, b) => Math.max(mx, Number(b.stake) || 0), 0);

  const surpriseResolvedCount = resolved.filter(b => b.is_surprise === 1).length;
  const pegnoWinsCount        = wins.filter(b => (b.pegno || '').trim().length > 0).length;

  // Time-of-day & marathon
  const hourBuckets = { night: 0, morning: 0 };
  const byDay = {};
  for (const b of allMine) {
    const d = new Date(Number(b.created_at) || 0);
    const h = d.getHours();
    if (h < 5) hourBuckets.night++;
    if (h >= 5 && h < 8) hourBuckets.morning++;
    const k = d.toISOString().slice(0, 10);
    byDay[k] = (byDay[k] || 0) + 1;
  }
  const bestDayCount = Object.values(byDay).reduce((mx, n) => Math.max(mx, n), 0);

  const quickResolveCount = resolved.filter(b => {
    const ra = Number(b.resolved_at) || 0;
    const ca = Number(b.created_at) || 0;
    return ra > 0 && ca > 0 && (ra - ca) <= 60 * 60 * 1000;
  }).length;

  const commentsCount = resolved.filter(b => (b.comment || '').trim().length > 0).length;

  const { rows: targetRows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM bets WHERE target_user=$1 AND status IN ('won','lost')`,
    [userId]
  );
  const targetCount = targetRows[0]?.n ?? 0;

  const { rows: rx } = await db.query(
    `SELECT COUNT(*)::int AS photos FROM reactions WHERE bettor=$1 AND image_url IS NOT NULL`,
    [userId]
  );
  const photosSent = rx[0]?.photos ?? 0;

  const { rows: fl } = await db.query(
    `SELECT COUNT(*)::int AS n FROM bets WHERE creator=$1 AND flamed=1`,
    [userId]
  );
  const flamedMine = fl[0]?.n ?? 0;

  const { rows: cw } = await db.query(
    `SELECT COUNT(*)::int AS n FROM counter_bets WHERE bettor=$1 AND status='won'`,
    [userId]
  );
  const counterWins = cw[0]?.n ?? 0;

  const { rows: g } = await db.query(
    `SELECT COUNT(*)::int AS n FROM user_groups WHERE user_id=$1`,
    [userId]
  );
  const groupCount = g[0]?.n ?? 0;

  const { rows: rec } = await db.query(
    `SELECT COUNT(*)::int AS n FROM user_groups ug
     WHERE ug.user_id != $1
       AND ug.group_id IN (SELECT group_id FROM user_groups WHERE user_id=$1 AND role='owner')`,
    [userId]
  );
  const recruits = rec[0]?.n ?? 0;

  // Map of computed current values keyed by achievement id
  const CURRENT = {
    wins:           wins.length,
    win_streak:     bestWinStreak,
    volume:         resolved.length,
    earnings:       totalEarnings,
    high_odds:      winMaxQuota,
    daredevil:      daredevilCount,
    safe_bet:       safeBetCount,
    single_win:     maxSingleWin,
    high_roller:    maxStakePlaced,
    surprise:       surpriseResolvedCount,
    pegno:          pegnoWinsCount,
    night_owl:      hourBuckets.night,
    early_bird:     hourBuckets.morning,
    marathon:       bestDayCount,
    commentator:    commentsCount,
    quick_resolve:  quickResolveCount,
    comeback:       bestComeback,
    equilibrium:    Math.min(wins.length, losses.length),
    losses:         losses.length,
    loss_streak:    bestLossStreak,
    worst_loss:     maxStakeLost,
    outsider_lost:  highOddsLostCount,
    flamed:         flamedMine,
    paparazzo:      photosSent,
    counter_winner: counterWins,
    targeted:       targetCount,
    multi_group:    groupCount,
    recruiter:      recruits,
  };

  const out = {};
  for (const entry of CATALOG) {
    const current = CURRENT[entry.id] ?? 0;
    let level = 0;
    for (let i = entry.levels.length - 1; i >= 0; i--) {
      if (current >= entry.levels[i]) { level = i + 1; break; }
    }
    const max_level = entry.levels.length;
    const isMax = level >= max_level;
    out[entry.id] = {
      current,
      level,
      max_level,
      target_next: isMax ? null : entry.levels[level],
      max_target:  entry.levels[entry.levels.length - 1],
    };
  }
  return out;
}

// Insert newly-reached levels into achievements table and notify the user.
async function refreshAchievements(userId) {
  try {
    const progress = await computeProgressFor(userId);

    const { rows: existing } = await db.query(
      `SELECT achievement_id, MAX(level)::int AS max_level
       FROM achievements WHERE user_id=$1
       GROUP BY achievement_id`,
      [userId]
    );
    const haveMax = Object.fromEntries(existing.map(r => [r.achievement_id, r.max_level]));

    const newUnlocks = []; // [{ id, level }]
    const now = Date.now();
    for (const [id, p] of Object.entries(progress)) {
      const had = haveMax[id] || 0;
      if (p.level > had) {
        for (let lvl = had + 1; lvl <= p.level; lvl++) {
          await db.query(
            `INSERT INTO achievements(user_id, achievement_id, level, unlocked_at)
             VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
            [userId, id, lvl, now]
          );
          newUnlocks.push({ id, level: lvl });
        }
      }
    }

    if (newUnlocks.length && await isPrefEnabled(userId, 'on_resolved')) {
      const first = newUnlocks[0];
      sendPushToUser(userId, {
        title: newUnlocks.length === 1
          ? `🏆 Trofeo Lv ${first.level} sbloccato!`
          : `🏆 ${newUnlocks.length} livelli sbloccati!`,
        body:  newUnlocks.length === 1
          ? `Hai raggiunto Lv ${first.level}`
          : `Hai sbloccato ${newUnlocks.length} nuovi livelli`,
        url:   '/',
      });
    }
    return newUnlocks;
  } catch (e) {
    console.error('[achievements] refresh failed', e);
    return [];
  }
}

// Returns one row per unlocked level so the frontend can show "Lv 3 reached 12 Mar"
async function listForUser(userId) {
  const { rows } = await db.query(
    `SELECT achievement_id, level, unlocked_at FROM achievements WHERE user_id=$1 ORDER BY achievement_id, level`,
    [userId]
  );
  return rows;
}

module.exports = {
  CATALOG, refreshAchievements, listForUser, computeProgressFor,
};
