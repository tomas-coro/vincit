'use strict';
const db = require('./db.js');
const { sendPushToUser, isPrefEnabled } = require('./routes/push.js');

// Static catalog. UI uses these ids and renders title/desc from i18n.
// "category": positive | challenge | shadow | mission | social
const CATALOG = [
  // ── Vittorie / scala ──
  { id: 'first_win',     icon: '🎯', tier: 'bronze', category: 'positive' },
  { id: 'wins_5',        icon: '🥉', tier: 'bronze', category: 'positive' },
  { id: 'wins_10',       icon: '🥉', tier: 'bronze', category: 'positive' },
  { id: 'wins_25',       icon: '🥈', tier: 'silver', category: 'positive' },
  { id: 'wins_50',       icon: '🥈', tier: 'silver', category: 'positive' },
  { id: 'wins_100',      icon: '🥇', tier: 'gold',   category: 'positive' },
  { id: 'wins_250',      icon: '👑', tier: 'gold',   category: 'positive' },
  // Streaks (win)
  { id: 'streak_3',      icon: '🔥', tier: 'bronze', category: 'positive' },
  { id: 'streak_5',      icon: '🔥', tier: 'silver', category: 'positive' },
  { id: 'streak_10',     icon: '🔥', tier: 'gold',   category: 'positive' },
  // Volume of resolved bets
  { id: 'total_10',      icon: '🎲', tier: 'bronze', category: 'positive' },
  { id: 'total_50',      icon: '🎲', tier: 'silver', category: 'positive' },
  { id: 'total_100',     icon: '🎲', tier: 'gold',   category: 'positive' },
  // Cumulative net earnings
  { id: 'earnings_500',  icon: '💎', tier: 'gold',   category: 'positive' },
  { id: 'earnings_1000', icon: '👑', tier: 'gold',   category: 'positive' },

  // ── Sfide / quote ──
  { id: 'bluff',         icon: '🃏', tier: 'silver', category: 'challenge' },
  { id: 'outsider',      icon: '🌙', tier: 'silver', category: 'challenge' },
  { id: 'miracle',       icon: '💫', tier: 'gold',   category: 'challenge' },
  { id: 'bigwin_25',     icon: '💰', tier: 'bronze', category: 'challenge' },
  { id: 'bigwin_100',    icon: '💎', tier: 'silver', category: 'challenge' },
  { id: 'bigwin_500',    icon: '🎰', tier: 'gold',   category: 'challenge' },
  { id: 'safe_bet',      icon: '🛡', tier: 'silver', category: 'challenge' },
  { id: 'daredevil',     icon: '🎢', tier: 'gold',   category: 'challenge' },
  { id: 'high_roller',   icon: '🪙', tier: 'silver', category: 'challenge' },

  // ── Missioni / azioni speciali ──
  { id: 'surprise_won',  icon: '🤫', tier: 'silver', category: 'mission' },
  { id: 'surprise_5',    icon: '🤫', tier: 'gold',   category: 'mission' },
  { id: 'target_won',    icon: '🛡', tier: 'silver', category: 'mission' },
  { id: 'epic_pegno',    icon: '🎁', tier: 'silver', category: 'mission' },
  { id: 'pegno_lover',   icon: '🎁', tier: 'gold',   category: 'mission' },
  { id: 'night_owl',     icon: '🌙', tier: 'silver', category: 'mission' },
  { id: 'early_bird',    icon: '🌅', tier: 'silver', category: 'mission' },
  { id: 'marathon',      icon: '🏃', tier: 'gold',   category: 'mission' },
  { id: 'commentator',   icon: '💬', tier: 'silver', category: 'mission' },
  { id: 'quick_resolve', icon: '⚡', tier: 'silver', category: 'mission' },
  { id: 'comeback',      icon: '⚖',  tier: 'silver', category: 'mission' },
  { id: 'comeback_5',    icon: '🔥', tier: 'gold',   category: 'mission' },
  { id: 'equilibrium',   icon: '⚖',  tier: 'silver', category: 'mission' },

  // ── Lato oscuro ──
  { id: 'first_loss',      icon: '🥲', tier: 'bronze', category: 'shadow' },
  { id: 'loss_streak_3',   icon: '🧊', tier: 'bronze', category: 'shadow' },
  { id: 'loss_streak_5',   icon: '❄️', tier: 'silver', category: 'shadow' },
  { id: 'loss_streak_10',  icon: '💀', tier: 'gold',   category: 'shadow' },
  { id: 'total_losses_25', icon: '📉', tier: 'silver', category: 'shadow' },
  { id: 'losses_50',       icon: '🪦', tier: 'gold',   category: 'shadow' },
  { id: 'outsider_lost',   icon: '🎢', tier: 'silver', category: 'shadow' },
  { id: 'worst_loss',      icon: '💸', tier: 'silver', category: 'shadow' },

  // ── Sociale ──
  { id: 'flamed_5',        icon: '🔥', tier: 'silver', category: 'social' },
  { id: 'paparazzo',       icon: '📷', tier: 'silver', category: 'social' },
  { id: 'counter_winner',  icon: '⚡', tier: 'silver', category: 'social' },
  { id: 'targeted_5',      icon: '🎯', tier: 'gold',   category: 'social' },
  { id: 'multi_group',     icon: '🌐', tier: 'silver', category: 'social' },
  { id: 'recruiter',       icon: '📣', tier: 'silver', category: 'social' },
];

// Returns map { id → { current, target } }; UI derives unlocked = current >= target
async function computeProgressFor(userId) {
  // Resolved bets created by user (used by most progress calcs)
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

  // All bets created by user (resolved or not) — used for time-of-day / max-stake calcs
  const { rows: allMine } = await db.query(
    `SELECT created_at, stake, pegno, is_surprise, status FROM bets WHERE creator=$1`,
    [userId]
  );

  const wins   = resolved.filter(b => b.status === 'won');
  const losses = resolved.filter(b => b.status === 'lost');

  // Streaks
  let bestWinStreak = 0, curWin = 0;
  let bestLossStreak = 0, curLoss = 0;
  for (const b of resolved) {
    if (b.status === 'won')  { curWin++;  curLoss = 0; if (curWin > bestWinStreak)  bestWinStreak  = curWin;  }
    else                     { curLoss++; curWin  = 0; if (curLoss > bestLossStreak) bestLossStreak = curLoss; }
  }

  // Quota analysis
  const winQuotas = wins.map(b => parseFloat(b.quota || 0));
  const lossQuotas = losses.map(b => parseFloat(b.quota || 0));
  const winMaxQuota = winQuotas.reduce((mx, q) => Math.max(mx, q), 0);
  const safeBetCount = wins.filter(b => parseFloat(b.quota) <= 1.30).length;
  const daredevilCount = wins.filter(b => parseFloat(b.quota) >= 5).length;
  const outsiderLost = losses.some(b => parseFloat(b.quota) >= 5) ? 1 : 0;

  // Single-bet net winnings (delta)
  const winDeltas = wins.map(b => Number(b.potential_win) - Number(b.stake));
  const maxSingleWin = winDeltas.reduce((mx, d) => Math.max(mx, d), 0);
  const totalEarnings = winDeltas.reduce((s, d) => s + d, 0);

  // Single-bet stakes
  const maxStakePlaced = allMine.reduce((mx, b) => Math.max(mx, Number(b.stake) || 0), 0);
  const worstLoss = losses.some(b => Number(b.stake) >= 50) ? 1 : 0;

  // Surprise / target / pegno wins
  const wonSurprise = wins.some(b => b.is_surprise === 1) ? 1 : 0;
  const surpriseResolvedCount = resolved.filter(b => b.is_surprise === 1).length;
  const wonPegno    = wins.some(b => (b.pegno || '').trim().length > 0) ? 1 : 0;
  const pegnoCreated = allMine.filter(b => (b.pegno || '').trim().length > 0).length;

  // Time-of-day & marathon
  const hourBuckets = { night: 0, morning: 0 }; // 00:00–04:59 / 05:00–07:59
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

  // Quick resolve (resolved within 1h of creation)
  const quickResolveCount = resolved.filter(b => {
    const ra = Number(b.resolved_at) || 0;
    const ca = Number(b.created_at) || 0;
    return ra > 0 && ca > 0 && (ra - ca) <= 60 * 60 * 1000;
  }).length;

  // Comments authored on user's resolved bets (proxy: comment present)
  const commentsCount = resolved.filter(b => (b.comment || '').trim().length > 0).length;

  // Target reveal (this user was the target of any resolved bet)
  const { rows: targetRows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM bets WHERE target_user=$1 AND status IN ('won','lost')`,
    [userId]
  );
  const targetCount = targetRows[0]?.n ?? 0;

  // Comeback / comeback_5
  let lossesBeforeWin = 0;
  let comeback3 = 0, comeback5 = 0;
  for (const b of resolved) {
    if (b.status === 'lost') lossesBeforeWin++;
    else {
      if (lossesBeforeWin >= 3) comeback3 = 1;
      if (lossesBeforeWin >= 5) comeback5 = 1;
      lossesBeforeWin = 0;
    }
  }

  // Reactions left by user
  const { rows: rx } = await db.query(
    `SELECT COUNT(*)::int AS photos FROM reactions WHERE bettor=$1 AND image_url IS NOT NULL`,
    [userId]
  );
  const photosSent = rx[0]?.photos ?? 0;

  // Flamed bets I created
  const { rows: fl } = await db.query(
    `SELECT COUNT(*)::int AS n FROM bets WHERE creator=$1 AND flamed=1`,
    [userId]
  );
  const flamedMine = fl[0]?.n ?? 0;

  // Counter-bet wins
  const { rows: cw } = await db.query(
    `SELECT COUNT(*)::int AS n FROM counter_bets WHERE bettor=$1 AND status='won'`,
    [userId]
  );
  const counterWins = cw[0]?.n ?? 0;

  // Multi-group membership
  const { rows: g } = await db.query(
    `SELECT COUNT(*)::int AS n FROM user_groups WHERE user_id=$1`,
    [userId]
  );
  const groupCount = g[0]?.n ?? 0;

  // Recruiter: any non-self member in a group I own
  const { rows: rec } = await db.query(
    `SELECT COUNT(*)::int AS n FROM user_groups ug
     WHERE ug.user_id != $1
       AND ug.group_id IN (SELECT group_id FROM user_groups WHERE user_id=$1 AND role='owner')`,
    [userId]
  );
  const recruits = rec[0]?.n ?? 0;

  return {
    // Positive / scale
    first_win:       { current: wins.length,   target: 1 },
    wins_5:          { current: wins.length,   target: 5 },
    wins_10:         { current: wins.length,   target: 10 },
    wins_25:         { current: wins.length,   target: 25 },
    wins_50:         { current: wins.length,   target: 50 },
    wins_100:        { current: wins.length,   target: 100 },
    wins_250:        { current: wins.length,   target: 250 },
    streak_3:        { current: bestWinStreak, target: 3 },
    streak_5:        { current: bestWinStreak, target: 5 },
    streak_10:       { current: bestWinStreak, target: 10 },
    total_10:        { current: resolved.length, target: 10 },
    total_50:        { current: resolved.length, target: 50 },
    total_100:       { current: resolved.length, target: 100 },
    earnings_500:    { current: totalEarnings, target: 500 },
    earnings_1000:   { current: totalEarnings, target: 1000 },

    // Challenge
    bluff:           { current: winMaxQuota >= 3  ? 3  : winMaxQuota, target: 3 },
    outsider:        { current: winMaxQuota >= 5  ? 5  : winMaxQuota, target: 5 },
    miracle:         { current: winMaxQuota >= 10 ? 10 : winMaxQuota, target: 10 },
    bigwin_25:       { current: Math.min(25, maxSingleWin),  target: 25 },
    bigwin_100:      { current: Math.min(100, maxSingleWin), target: 100 },
    bigwin_500:      { current: Math.min(500, maxSingleWin), target: 500 },
    safe_bet:        { current: safeBetCount,   target: 10 },
    daredevil:       { current: daredevilCount, target: 5 },
    high_roller:     { current: Math.min(100, maxStakePlaced), target: 100 },

    // Mission
    surprise_won:    { current: wonSurprise,         target: 1 },
    surprise_5:      { current: surpriseResolvedCount, target: 5 },
    target_won:      { current: targetCount >= 1 ? 1 : 0, target: 1 },
    epic_pegno:      { current: wonPegno,            target: 1 },
    pegno_lover:     { current: pegnoCreated,        target: 10 },
    night_owl:       { current: hourBuckets.night,   target: 5 },
    early_bird:      { current: hourBuckets.morning, target: 5 },
    marathon:        { current: bestDayCount,        target: 10 },
    commentator:     { current: commentsCount,       target: 10 },
    quick_resolve:   { current: quickResolveCount,   target: 5 },
    comeback:        { current: comeback3,           target: 1 },
    comeback_5:      { current: comeback5,           target: 1 },
    equilibrium:     { current: Math.min(wins.length, losses.length), target: 10 },

    // Shadow
    first_loss:       { current: losses.length,    target: 1 },
    loss_streak_3:    { current: bestLossStreak,   target: 3 },
    loss_streak_5:    { current: bestLossStreak,   target: 5 },
    loss_streak_10:   { current: bestLossStreak,   target: 10 },
    total_losses_25:  { current: losses.length,    target: 25 },
    losses_50:        { current: losses.length,    target: 50 },
    outsider_lost:    { current: outsiderLost,     target: 1 },
    worst_loss:       { current: worstLoss,        target: 1 },

    // Social
    flamed_5:         { current: flamedMine,    target: 5 },
    paparazzo:        { current: photosSent,    target: 5 },
    counter_winner:   { current: counterWins,   target: 10 },
    targeted_5:       { current: targetCount,   target: 5 },
    multi_group:      { current: groupCount,    target: 3 },
    recruiter:        { current: recruits >= 1 ? 1 : 0, target: 1 },
  };
}

function unlockedIdsFromProgress(progress) {
  const out = [];
  for (const [id, p] of Object.entries(progress)) {
    if (p.current >= p.target) out.push(id);
  }
  return out;
}

async function refreshAchievements(userId) {
  try {
    const progress = await computeProgressFor(userId);
    const qualified = unlockedIdsFromProgress(progress);
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

module.exports = {
  CATALOG, refreshAchievements, listForUser,
  computeProgressFor, unlockedIdsFromProgress,
};
