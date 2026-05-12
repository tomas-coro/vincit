'use strict';
const { Pool } = require('pg');

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
    ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS on_group_bet   BOOLEAN DEFAULT true;
    ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS on_challenged  BOOLEAN DEFAULT true;
    ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS on_targeted    BOOLEAN DEFAULT true;
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

  // Migrate legacy balance_500 (was based on current balance) → earnings_500 (cumulative winnings)
  await pool.query(`
    UPDATE achievements SET achievement_id='earnings_500' WHERE achievement_id='balance_500';
  `).catch(() => { /* nothing to migrate */ });

  // Track resolve time for the quick_resolve trophy
  await pool.query(`
    ALTER TABLE bets ADD COLUMN IF NOT EXISTS resolved_at BIGINT;
  `);

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
