'use strict';
const { Pool, types } = require('pg');

// BIGINT (OID 20) ships as a string by default to preserve precision past 2^53.
// All our BIGINT columns are millisecond timestamps that fit safely in a Number,
// so we parse them as numbers — otherwise the frontend ends up doing
// "string + number" concatenation (e.g. createdAt + 60000) and miscalculating
// time windows by trillions.
types.setTypeParser(20, val => val == null ? null : parseInt(val, 10));

const needsSsl =
  process.env.NODE_ENV === 'production' ||
  /render\.com|amazonaws\.com|neon\.tech|supabase\.co|sslmode=require/i.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      "user"    TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      avatar    TEXT NOT NULL DEFAULT '🃏',
      color_key TEXT NOT NULL DEFAULT 'blue'
    );

    CREATE TABLE IF NOT EXISTS credits (
      "user"  TEXT PRIMARY KEY,
      amount  REAL NOT NULL DEFAULT 100
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id          TEXT PRIMARY KEY,
      invite_code TEXT UNIQUE NOT NULL,
      created_at  BIGINT NOT NULL,
      paired_at   BIGINT
    );

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      name          TEXT NOT NULL,
      avatar        TEXT DEFAULT '😊',
      color_key     TEXT DEFAULT 'blue',
      password_hash TEXT NOT NULL,
      vault_pin     TEXT,
      room_id       TEXT REFERENCES rooms(id),
      created_at    BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bets (
      id             TEXT PRIMARY KEY,
      creator        TEXT NOT NULL,
      title          TEXT NOT NULL,
      quota          REAL NOT NULL,
      stake          INTEGER NOT NULL,
      potential_win  INTEGER NOT NULL,
      category       TEXT NOT NULL DEFAULT 'altro',
      is_secret      INTEGER NOT NULL DEFAULT 0,
      is_counterable INTEGER NOT NULL DEFAULT 0,
      pegno          TEXT,
      expires_at     BIGINT,
      created_at     BIGINT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'active',
      flamed         INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS counter_bets (
      id            TEXT PRIMARY KEY,
      bet_id        TEXT NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
      bettor        TEXT NOT NULL,
      side          TEXT NOT NULL CHECK(side IN ('yes','no')),
      quota_used    REAL NOT NULL,
      stake         INTEGER NOT NULL,
      potential_win INTEGER NOT NULL,
      status        TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS categories (
      id    TEXT PRIMARY KEY,
      emoji TEXT NOT NULL,
      label TEXT NOT NULL,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      "user"       TEXT NOT NULL,
      endpoint     TEXT PRIMARY KEY,
      subscription JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_prefs (
      "user"       TEXT PRIMARY KEY,
      on_new_bet   BOOLEAN DEFAULT true,
      on_resolved  BOOLEAN DEFAULT true,
      on_expiry    BOOLEAN DEFAULT true
    );
  `);

  await pool.query(`
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin_hash TEXT;
    ALTER TABLE bets ADD COLUMN IF NOT EXISTS comment TEXT;
    CREATE TABLE IF NOT EXISTS reactions (
      bet_id TEXT NOT NULL,
      bettor TEXT NOT NULL,
      emoji  TEXT NOT NULL,
      PRIMARY KEY (bet_id, bettor)
    );
  `);

  await pool.query(`
    ALTER TABLE bets ALTER COLUMN created_at TYPE BIGINT;
    ALTER TABLE bets ALTER COLUMN expires_at TYPE BIGINT;
  `);

  await pool.query(`
    ALTER TABLE bets ADD COLUMN IF NOT EXISTS room_id TEXT;
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS room_id TEXT;
  `);

  await pool.query(`
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS name                 TEXT DEFAULT 'My Group';
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS emoji                TEXT DEFAULT '🎲';
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max_size             INTEGER DEFAULT 10;
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS acceptance_threshold INTEGER DEFAULT 20;
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max_stake            INTEGER DEFAULT 100;

    CREATE TABLE IF NOT EXISTS user_groups (
      group_id  TEXT NOT NULL REFERENCES rooms(id)  ON DELETE CASCADE,
      user_id   TEXT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
      role      TEXT NOT NULL DEFAULT 'member',
      joined_at BIGINT NOT NULL,
      PRIMARY KEY (group_id, user_id)
    );
  `);

  await pool.query(`
    INSERT INTO user_groups (group_id, user_id, role, joined_at)
      SELECT room_id, id, 'owner', created_at
      FROM users WHERE room_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  `);

  await pool.query(`
    ALTER TABLE bets ADD COLUMN IF NOT EXISTS opponent TEXT;
  `);

  await pool.query(`
    ALTER TABLE users    ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
  `);

  await pool.query(`
    ALTER TABLE reactions ADD COLUMN IF NOT EXISTS image_url TEXT;
    ALTER TABLE reactions ALTER COLUMN emoji DROP NOT NULL;
  `);

  await pool.query(`
    ALTER TABLE bets ADD COLUMN IF NOT EXISTS is_surprise INTEGER NOT NULL DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE user_groups ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);

  await pool.query(`
    ALTER TABLE bets ADD COLUMN IF NOT EXISTS target_user TEXT;
    CREATE INDEX IF NOT EXISTS idx_bets_target_user ON bets(target_user);
  `);

  // Granular notification preferences (replaces the legacy on_new_bet umbrella)
  await pool.query(`
    ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS on_group_bet     BOOLEAN DEFAULT true;
    ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS on_challenged    BOOLEAN DEFAULT true;
    ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS on_targeted      BOOLEAN DEFAULT true;
    ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS on_friend_request BOOLEAN DEFAULT true;
    ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS on_friend_accept  BOOLEAN DEFAULT true;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS achievements (
      user_id        TEXT NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked_at    BIGINT NOT NULL,
      PRIMARY KEY (user_id, achievement_id)
    );
    CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);
  `);

  // Migration to leveled achievements (one row per level reached).
  await pool.query(`ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_pkey`);
  await pool.query(`ALTER TABLE achievements ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1`);
  await pool.query(`ALTER TABLE achievements ADD CONSTRAINT achievements_pkey PRIMARY KEY (user_id, achievement_id, level)`)
    .catch(() => {}); // already in place
  // Drop legacy unlocks tied to retired achievement_ids — they'll be recomputed
  // by refreshAchievements at the next bet resolve / page load.
  await pool.query(`
    DELETE FROM achievements WHERE achievement_id NOT IN (
      'wins','win_streak','volume','earnings',
      'single_win','high_odds','daredevil','safe_bet','high_roller',
      'surprise','pegno','night_owl','early_bird','marathon',
      'commentator','quick_resolve','comeback','equilibrium',
      'losses','loss_streak','worst_loss','outsider_lost',
      'flamed','paparazzo','counter_winner','targeted',
      'multi_group','recruiter',
      'first_bet','first_react','first_photo','first_vault',
      'first_pegno_set','first_join',
      'epic_night','perfect_run','outsider_streak',
      'social_butterfly','loaded','half_marathon'
    )
  `);

  // Drop achievement rows above the current per-family max_level — when we
  // shrink a family from 5 → 3 levels, we don't want stale Lv 4/5 entries.
  try {
    const { CATALOG } = require('./achievements.js');
    for (const a of CATALOG) {
      await pool.query(
        'DELETE FROM achievements WHERE achievement_id=$1 AND level > $2',
        [a.id, a.levels.length]
      );
    }
  } catch (e) {
    console.warn('[migration] level-trim sweep failed (non-fatal):', e.message);
  }

  // Migrate legacy balance_500 (was based on current balance) → earnings_500 (cumulative winnings)
  await pool.query(`
    UPDATE achievements SET achievement_id='earnings_500' WHERE achievement_id='balance_500';
  `).catch(() => { /* nothing to migrate */ });

  // Track resolve time for the quick_resolve trophy
  await pool.query(`
    ALTER TABLE bets ADD COLUMN IF NOT EXISTS resolved_at BIGINT;
  `);

  // Subset bets: open bets that target only a few group members.
  // NULL = open to the whole group (legacy behavior).
  await pool.query(`
    ALTER TABLE bets ADD COLUMN IF NOT EXISTS allowed_members TEXT[];
  `);

  // Pot-mode targeted bets: when the opponent accepts they pick their own
  // stake. NULL = legacy free-bet behavior (creator-only stake, casino payout).
  await pool.query(`
    ALTER TABLE bets ADD COLUMN IF NOT EXISTS opponent_stake INTEGER;
  `);

  // Forgot-password tokens. Each row is single-use, short-lived.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      token       TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  BIGINT NOT NULL,
      expires_at  BIGINT NOT NULL,
      used_at     BIGINT
    );
    CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
  `);

  // Explicit friendships (accepted) + pending requests.
  // Friendships are stored in canonical pair order (user_id_a < user_id_b)
  // so the (a, b) PK is enough — no need to insert both directions.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS friendships (
      user_id_a   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_id_b   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  BIGINT NOT NULL,
      PRIMARY KEY (user_id_a, user_id_b),
      CHECK (user_id_a < user_id_b)
    );
    CREATE INDEX IF NOT EXISTS idx_friendships_b ON friendships(user_id_b);
    CREATE TABLE IF NOT EXISTS friend_requests (
      from_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at    BIGINT NOT NULL,
      PRIMARY KEY (from_user_id, to_user_id),
      CHECK (from_user_id <> to_user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_user_id);
  `);

  // Super-admin flag. Promoted via the ADMIN_EMAIL env var on every boot.
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
  `);

  // Consensual-resolve fields. When a bet has an opponent, /resolve no longer
  // settles unilaterally — it parks a proposed outcome here, and the bet
  // only settles once the OTHER party confirms the same outcome. If they
  // disagree the bet enters status='disputed' (settled through Overtime).
  await pool.query(`
    ALTER TABLE bets ADD COLUMN IF NOT EXISTS pending_outcome    TEXT;
    ALTER TABLE bets ADD COLUMN IF NOT EXISTS pending_outcome_by TEXT;
    ALTER TABLE bets ADD COLUMN IF NOT EXISTS pending_outcome_at BIGINT;
  `);
  if (process.env.ADMIN_EMAIL) {
    await pool.query(
      'UPDATE users SET is_admin=true WHERE LOWER(email)=LOWER($1)',
      [process.env.ADMIN_EMAIL.trim()]
    ).catch(e => console.warn('[admin-promote]', e.message));
  }

  // ── Email case-insensitivity migration ───────────────────────────────
  // Original schema declared `email TEXT UNIQUE`, which is case-sensitive in
  // Postgres. That let `Anna@x.com` and `anna@x.com` coexist as two distinct
  // accounts — login looks up LOWER(email), but landed on whichever row the
  // engine returned first, so password resets routinely missed the account
  // people were actually using.
  //
  // Fix: normalize all addresses to lowercase, then add a UNIQUE INDEX on
  // LOWER(email). Both steps are idempotent. If there are still duplicates
  // that can't be normalized without collision, the index creation fails
  // loudly (caught below) — the admin must merge/delete via the panel and
  // the next boot will succeed.
  try {
    const { rowCount: normalized } = await pool.query(`
      UPDATE users SET email = LOWER(email)
      WHERE email <> LOWER(email)
        AND NOT EXISTS (
          SELECT 1 FROM users u2
          WHERE u2.id <> users.id AND u2.email = LOWER(users.email)
        )
    `);
    if (normalized) console.log(`[email-normalize] Lowercased ${normalized} email row(s)`);
  } catch (e) {
    console.warn('[email-normalize]', e.message);
  }
  try {
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
        ON users (LOWER(email))
    `);
  } catch (e) {
    console.error(
      '[email-unique-index] FAILED — case-insensitive duplicates still exist. ' +
      'Resolve them in /api/admin/integrity then restart. Error:', e.message
    );
  }

  // Friendship has to be EXPLICIT — no auto-friending from shared groups.
  // An earlier version of this migration auto-converted every group overlap
  // into an accepted friendship; that was wrong. The one-shot wipe below
  // erases those phantom friendships so people can build the list
  // intentionally. Guarded by _system_flags so we don\'t wipe legitimate
  // friendships every restart.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _system_flags (
      id      TEXT PRIMARY KEY,
      set_at  BIGINT NOT NULL
    );
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _system_flags WHERE id = 'wiped_implicit_friendships_v1') THEN
        DELETE FROM friendships;
        DELETE FROM friend_requests;
        INSERT INTO _system_flags (id, set_at)
        VALUES ('wiped_implicit_friendships_v1', EXTRACT(EPOCH FROM NOW())::bigint * 1000);
      END IF;
    END $$;
  `).catch(e => console.error('[friendship-wipe]', e.message));

  // One-shot cleanup: drop auto-created "My Group" rooms that are still empty
  // (1 member, 0 bets, 0 custom categories). This wipes the auto-room that
  // old register flow used to create per user. Safe to re-run.
  try {
    const { rows: dangling } = await pool.query(`
      SELECT r.id
      FROM rooms r
      WHERE r.name = 'My Group'
        AND (SELECT COUNT(*) FROM user_groups WHERE group_id = r.id) <= 1
        AND NOT EXISTS (SELECT 1 FROM bets       WHERE room_id = r.id)
        AND NOT EXISTS (SELECT 1 FROM categories WHERE room_id = r.id)
    `);
    if (dangling.length) {
      const ids = dangling.map(r => r.id);
      // users.room_id has no ON DELETE CASCADE — null it first.
      await pool.query('UPDATE users SET room_id = NULL WHERE room_id = ANY($1)', [ids]);
      await pool.query('DELETE FROM rooms WHERE id = ANY($1)', [ids]);
      console.log(`[cleanup] Deleted ${dangling.length} dangling "My Group" room(s)`);
    }
  } catch (e) {
    console.warn('[cleanup] My Group sweep failed (non-fatal):', e.message);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bet_templates (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      name        TEXT NOT NULL,
      title       TEXT NOT NULL,
      quota       REAL NOT NULL,
      stake       INTEGER NOT NULL,
      category    TEXT,
      bet_type    TEXT NOT NULL DEFAULT 'open',
      pegno       TEXT,
      created_at  BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bet_templates_user ON bet_templates(user_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_bets_room_id     ON bets(room_id);
    CREATE INDEX IF NOT EXISTS idx_bets_creator     ON bets(creator);
    CREATE INDEX IF NOT EXISTS idx_bets_status      ON bets(status) WHERE status IN ('active','pending');
    CREATE INDEX IF NOT EXISTS idx_ug_user_id       ON user_groups(user_id);
    CREATE INDEX IF NOT EXISTS idx_counter_bet_id   ON counter_bets(bet_id);
    CREATE INDEX IF NOT EXISTS idx_reactions_bet_id ON reactions(bet_id);
  `);

  // Comment thread under each bet — Twitter-style replies. Anyone in the
  // bet's room can post. Author can delete their own. Cascades on bet
  // deletion.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bet_messages (
      id          TEXT PRIMARY KEY,
      bet_id      TEXT NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
      author_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body        TEXT NOT NULL,
      created_at  BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bet_messages_bet ON bet_messages(bet_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_bet_messages_author ON bet_messages(author_id);
  `);

  // Push pref for new comments under bets the user has interacted with
  // (created, opponent, target, counter-bet). Default true so people
  // discover the feature.
  await pool.query(`
    ALTER TABLE notification_prefs
      ADD COLUMN IF NOT EXISTS on_bet_message BOOLEAN DEFAULT true;
  `);

  await pool.query(`
    INSERT INTO profiles ("user", name, avatar, color_key)
      VALUES ('tomas',  'Tomas',  '🃏', 'blue'),
             ('giulia', 'Giulia', '♥️', 'purple')
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    INSERT INTO credits ("user", amount)
      VALUES ('tomas',  100),
             ('giulia', 100)
    ON CONFLICT DO NOTHING
  `);

  // One-time backfill: utenti esistenti senza riga in credits → 100
  await pool.query(`
    INSERT INTO credits ("user", amount)
      SELECT id, 100 FROM users
      WHERE id NOT IN (SELECT "user" FROM credits)
    ON CONFLICT ("user") DO NOTHING
  `);

  console.log('DB schema ready');
})().catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { query, transaction };
