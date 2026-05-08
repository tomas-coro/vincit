'use strict';
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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
