'use strict';
const db = require('./db.js');
const { sendPushToUser, isPrefEnabled } = require('./routes/push.js');

// Trophy catalog. Each entry has `levels: [t1, ..., tN]` thresholds.
// Length of `levels` controls how many segments the UI ladder shows.
// Categories: positive | challenge | mission | shadow | social | unique
const CATALOG = [
  // ─── Positive ──────────────────────────────────────────────────────
  { id: 'first_bet',      icon: '🌱', category: 'positive',  levels: [1, 10, 50, 100, 250] },     // 5 — total bets created
  { id: 'wins',           icon: '🏆', category: 'positive',  levels: [1, 5, 25, 100, 250] },       // 5
  { id: 'win_streak',     icon: '🔥', category: 'positive',  levels: [3, 5, 10, 15, 25] },        // 5
  { id: 'volume',         icon: '🎲', category: 'positive',  levels: [10, 50, 150, 400] },        // 4
  { id: 'earnings',       icon: '💎', category: 'positive',  levels: [100, 500, 2000, 5000] },    // 4

  // ─── Challenge ─────────────────────────────────────────────────────
  { id: 'high_odds',      icon: '🌠', category: 'challenge', levels: [2, 3, 5, 10, 20] },         // 5
  { id: 'daredevil',      icon: '🪂', category: 'challenge', levels: [3, 10, 25] },               // 3
  { id: 'safe_bet',       icon: '🛡', category: 'challenge', levels: [10, 30, 75, 150] },         // 4
  { id: 'single_win',     icon: '💰', category: 'challenge', levels: [25, 100, 300, 800] },       // 4
  { id: 'high_roller',    icon: '🪙', category: 'challenge', levels: [100, 500, 2000] },          // 3

  // ─── Mission ───────────────────────────────────────────────────────
  { id: 'surprise',       icon: '🤫', category: 'mission',   levels: [1, 5, 15] },                 // 3
  { id: 'pegno',          icon: '🎁', category: 'mission',   levels: [1, 5, 15, 40] },             // 4
  { id: 'night_owl',      icon: '🦉', category: 'mission',   levels: [3, 15, 40] },                // 3
  { id: 'early_bird',     icon: '🌅', category: 'mission',   levels: [3, 15, 40] },                // 3
  { id: 'marathon',       icon: '🏃', category: 'mission',   levels: [10, 20, 35] },               // 3
  { id: 'commentator',    icon: '💬', category: 'mission',   levels: [5, 20, 50, 150, 400] },     // 5 — counts comments in the bet message thread
  { id: 'quick_resolve',  icon: '⏱️', category: 'mission',   levels: [3, 10, 25] },                // 3
  { id: 'comeback',       icon: '💪', category: 'mission',   levels: [3, 5, 8, 12] },              // 4
  { id: 'equilibrium',    icon: '☯',  category: 'mission',   levels: [10, 30, 80] },               // 3

  // ─── Shadow ────────────────────────────────────────────────────────
  { id: 'losses',         icon: '🥀', category: 'shadow',    levels: [1, 10, 30, 75] },            // 4
  { id: 'loss_streak',    icon: '❄️', category: 'shadow',    levels: [3, 7, 15] },                 // 3
  { id: 'worst_loss',     icon: '💸', category: 'shadow',    levels: [50, 150, 500] },             // 3
  { id: 'outsider_lost',  icon: '💔', category: 'shadow',    levels: [1, 3, 8] },                  // 3

  // ─── Social ────────────────────────────────────────────────────────
  { id: 'flamed',         icon: '⭐', category: 'social',    levels: [3, 15, 40, 100, 250] },     // 5
  { id: 'paparazzo',      icon: '📷', category: 'social',    levels: [3, 15, 40, 100, 250] },     // 5
  { id: 'reactor',        icon: '👋', category: 'social',    levels: [5, 25, 100, 250, 500] },    // 5 — reactions you've GIVEN (emoji + photo)
  { id: 'counter_winner', icon: '🥊', category: 'social',    levels: [3, 15, 40, 100] },           // 4
  { id: 'targeted',       icon: '🎯', category: 'social',    levels: [1, 5, 15, 40] },             // 4
  { id: 'multi_group',    icon: '🌐', category: 'social',    levels: [2, 4, 8] },                  // 3
  { id: 'recruiter',      icon: '📣', category: 'social',    levels: [1, 3, 8] },                  // 3

  // ─── Unique milestones (one-shot) ──────────────────────────────────
  // Easy — most players unlock these in the first session
  { id: 'first_react',    icon: '👋', category: 'unique',    levels: [1] },
  { id: 'first_photo',    icon: '📸', category: 'unique',    levels: [1] },
  { id: 'first_vault',    icon: '🔒', category: 'unique',    levels: [1] },
  { id: 'first_pegno_set',icon: '🎁', category: 'unique',    levels: [1] },
  { id: 'first_join',     icon: '🤝', category: 'unique',    levels: [1] },
  // Rare — particular conditions
  { id: 'epic_night',     icon: '🌃', category: 'unique',    levels: [1] }, // 5 bets between 0-5 in a single day
  { id: 'perfect_run',    icon: '🎼', category: 'unique',    levels: [1] }, // 5 wins in a row on odds ≥ 3
  { id: 'outsider_streak',icon: '🦄', category: 'unique',    levels: [1] }, // 3 wins in a row on odds ≥ 5
  { id: 'social_butterfly',icon:'🦋', category: 'unique',    levels: [1] }, // counters from 5 distinct people
  { id: 'loaded',         icon: '👑', category: 'unique',    levels: [1] }, // balance ≥ 1000
  { id: 'half_marathon',  icon: '🏅', category: 'unique',    levels: [1] }, // a single bet with stake ≥ 200 won

  // ─── Secret (easter-egg) ────────────────────────────────────────────
  // Hidden from the trophy list until the user unlocks AT LEAST one of
  // them; after the first unlock the remaining two appear as "???"
  // placeholders so the player knows there's more to find.
  { id: 'egg_dice',       icon: '🎲', category: 'secret',    levels: [1], secret: true }, // all 6 faces rolled on the empty-state die
  { id: 'egg_coin',       icon: '🪙', category: 'secret',    levels: [1], secret: true }, // first toss of the header credit-symbol coin
  { id: 'egg_jackpot',    icon: '🎰', category: 'secret',    levels: [1], secret: true }, // create a bet titled "777" / "JACKPOT" / "💎💎💎"
];

// Whitelist of secret achievement IDs that the easter-egg endpoint accepts.
const SECRET_IDS = new Set(CATALOG.filter(e => e.secret).map(e => e.id));

async function unlockSecret(userId, achievementId) {
  if (!SECRET_IDS.has(achievementId)) {
    throw new Error('unknown_secret');
  }
  // Was it already unlocked? If so, this call is a no-op.
  const { rows: existing } = await db.query(
    'SELECT 1 FROM achievements WHERE user_id=$1 AND achievement_id=$2 AND level=1',
    [userId, achievementId]
  );
  if (existing.length) return { ok: true, alreadyUnlocked: true };

  await db.query(
    `INSERT INTO achievements(user_id, achievement_id, level, unlocked_at)
     VALUES($1,$2,1,$3) ON CONFLICT DO NOTHING`,
    [userId, achievementId, Date.now()]
  );

  // Friendly push notification — opt-in via the resolved-pref toggle.
  try {
    if (await isPrefEnabled(userId, 'on_resolved')) {
      sendPushToUser(userId, {
        title: '🏆 Trofeo segreto sbloccato!',
        body:  'Hai trovato un easter egg — controlla la collezione',
        url:   '/',
      });
    }
  } catch (e) { console.error('[secret-unlock notify]', e); }

  return { ok: true, alreadyUnlocked: false };
}

// Returns map { id → { current, level, max_level, target_next, max_target } }
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
    `SELECT created_at, stake, pegno, is_surprise, is_secret, status FROM bets WHERE creator=$1`,
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

  // Specialized streaks on odds threshold (consecutive wins where quota ≥ X)
  let perfectRun = 0, perfectMax = 0;
  let outsiderRun = 0, outsiderMax = 0;
  for (const b of resolved) {
    if (b.status === 'won' && parseFloat(b.quota) >= 3) {
      perfectRun++; if (perfectRun > perfectMax) perfectMax = perfectRun;
    } else perfectRun = 0;
    if (b.status === 'won' && parseFloat(b.quota) >= 5) {
      outsiderRun++; if (outsiderRun > outsiderMax) outsiderMax = outsiderRun;
    } else outsiderRun = 0;
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
  const maxWinningStake = wins.reduce((mx, b) => Math.max(mx, Number(b.stake) || 0), 0);

  const surpriseResolvedCount = resolved.filter(b => b.is_surprise === 1).length;
  const pegnoWinsCount        = wins.filter(b => (b.pegno || '').trim().length > 0).length;
  const pegnoCreatedAny       = allMine.some(b => (b.pegno || '').trim().length > 0) ? 1 : 0;
  const vaultCreatedAny       = allMine.some(b => b.is_secret === 1) ? 1 : 0;
  const totalBetsCreated      = allMine.length;

  // Time-of-day & marathon (best single-day count, best night-of-bets count)
  const hourBuckets = { night: 0, morning: 0 };
  const byDay = {};
  const nightByDay = {};
  for (const b of allMine) {
    const d = new Date(Number(b.created_at) || 0);
    const h = d.getHours();
    if (h < 5) hourBuckets.night++;
    if (h >= 5 && h < 8) hourBuckets.morning++;
    const k = d.toISOString().slice(0, 10);
    byDay[k] = (byDay[k] || 0) + 1;
    if (h < 5) nightByDay[k] = (nightByDay[k] || 0) + 1;
  }
  const bestDayCount       = Object.values(byDay).reduce((mx, n) => Math.max(mx, n), 0);
  const bestNightDay       = Object.values(nightByDay).reduce((mx, n) => Math.max(mx, n), 0);
  const epicNightHit       = bestNightDay >= 5 ? 1 : 0;

  const quickResolveCount = resolved.filter(b => {
    const ra = Number(b.resolved_at) || 0;
    const ca = Number(b.created_at) || 0;
    return ra > 0 && ca > 0 && (ra - ca) <= 60 * 60 * 1000;
  }).length;

  // Commentator now counts messages the user has POSTED in the comment
  // thread under any bet (the new bet_messages table). The old
  // single-comment-on-resolve field is still respected for backward compat
  // and added on top — old players don't lose progress.
  const { rows: bmRows } = await db.query(
    'SELECT COUNT(*)::int AS n FROM bet_messages WHERE author_id=$1',
    [userId]
  );
  const threadMessagesCount = bmRows[0]?.n ?? 0;
  const legacyResolveComments = resolved.filter(b => (b.comment || '').trim().length > 0).length;
  const commentsCount = threadMessagesCount + legacyResolveComments;

  // Reactor: total reactions GIVEN (emoji + photo) — independent count
  // from photosSent (paparazzo) so both trophies progress together.
  const { rows: rxGiven } = await db.query(
    'SELECT COUNT(*)::int AS n FROM reactions WHERE bettor=$1',
    [userId]
  );
  const reactionsGiven = rxGiven[0]?.n ?? 0;

  const { rows: targetRows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM bets WHERE target_user=$1 AND status IN ('won','lost')`,
    [userId]
  );
  const targetCount = targetRows[0]?.n ?? 0;

  // Reactions left by user (count emoji + photo)
  const { rows: rxAny } = await db.query(
    `SELECT COUNT(*)::int AS n FROM reactions WHERE bettor=$1`,
    [userId]
  );
  const anyReactGiven = rxAny[0]?.n ? 1 : 0;

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

  // Distinct people that counter-bet on my own bets (social_butterfly)
  const { rows: distinctCounter } = await db.query(
    `SELECT COUNT(DISTINCT cb.bettor)::int AS n
     FROM counter_bets cb JOIN bets b ON b.id = cb.bet_id
     WHERE b.creator=$1 AND cb.bettor != $1`,
    [userId]
  );
  const socialButterflyHit = (distinctCounter[0]?.n ?? 0) >= 5 ? 1 : 0;

  const { rows: g } = await db.query(
    `SELECT COUNT(*)::int AS n FROM user_groups WHERE user_id=$1`,
    [userId]
  );
  const groupCount = g[0]?.n ?? 0;

  // First join: at least one membership where role != 'owner' (i.e. joined an existing group)
  const { rows: jm } = await db.query(
    `SELECT 1 FROM user_groups WHERE user_id=$1 AND role != 'owner' LIMIT 1`,
    [userId]
  );
  const firstJoinHit = jm.length ? 1 : 0;

  const { rows: rec } = await db.query(
    `SELECT COUNT(*)::int AS n FROM user_groups ug
     WHERE ug.user_id != $1
       AND ug.group_id IN (SELECT group_id FROM user_groups WHERE user_id=$1 AND role='owner')`,
    [userId]
  );
  const recruits = rec[0]?.n ?? 0;

  // Balance milestone (point-in-time)
  const { rows: cr } = await db.query('SELECT amount FROM credits WHERE "user"=$1', [userId]);
  const balance = cr[0]?.amount ?? 0;
  const loadedHit = balance >= 1000 ? 1 : 0;

  // Map of computed current values
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
    reactor:        reactionsGiven,
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

    // first_bet has become a leveled "Creatore" trophy in the positive category
    first_bet:       totalBetsCreated,

    // Unique milestones
    first_react:     anyReactGiven,
    first_photo:     photosSent >= 1 ? 1 : 0,
    first_vault:     vaultCreatedAny,
    first_pegno_set: pegnoCreatedAny,
    first_join:      firstJoinHit,
    epic_night:      epicNightHit,
    perfect_run:     perfectMax >= 5 ? 1 : 0,
    outsider_streak: outsiderMax >= 3 ? 1 : 0,
    social_butterfly: socialButterflyHit,
    loaded:          loadedHit,
    half_marathon:   maxWinningStake >= 200 ? 1 : 0,
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

    const newUnlocks = [];
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

async function listForUser(userId) {
  const { rows } = await db.query(
    `SELECT achievement_id, level, unlocked_at FROM achievements WHERE user_id=$1 ORDER BY achievement_id, level`,
    [userId]
  );
  return rows;
}

module.exports = {
  CATALOG, refreshAchievements, listForUser, computeProgressFor, unlockSecret, SECRET_IDS,
};
