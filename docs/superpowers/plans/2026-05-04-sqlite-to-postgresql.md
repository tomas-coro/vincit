# SQLite → PostgreSQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace better-sqlite3 with the `pg` package so data persists across Render deploys.

**Architecture:** Swap the synchronous SQLite API for an async pg Pool; export `{ query, transaction }` from `db.js`; convert every route handler to `async`/`await`; use `$1,$2` placeholders throughout.

**Tech Stack:** Node.js, Express, CommonJS (`require`), `pg` npm package, PostgreSQL.

---

## File Map

| File | Action | Change |
|---|---|---|
| `backend/package.json` | Modify | Remove `better-sqlite3`, add `pg` |
| `backend/db.js` | Rewrite | pg Pool, async init, export `{ query, transaction }` |
| `backend/routes/state.js` | Rewrite | async `buildState()`, async route handler |
| `backend/routes/profiles.js` | Modify | async handler, `db.query()` |
| `backend/routes/credits.js` | Modify | async handler, `db.transaction()` |
| `backend/routes/bets.js` | Rewrite | async handlers, `db.query()` + `db.transaction()` |
| `backend/routes/categories.js` | Modify | async handlers, `db.query()` |
| `backend/.env` | Modify | Add `DATABASE_URL` |
| `backend/routes/events.js` | No change | No DB usage |
| `backend/server.js` | No change | Structure unchanged |
| `.gitignore` | Verify | `*.db` pattern already covers `betcouple.db` |

**Key PostgreSQL gotchas:**
- `user` is a reserved keyword → always quote as `"user"` in SQL.
- Boolean columns (`is_secret`, `is_counterable`, `flamed`) stay as `INTEGER` (0/1) so existing `=== 1` comparisons in `state.js` keep working.
- `INSERT OR IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`.
- Placeholders `?` → `$1`, `$2`, …

---

### Task 1: Swap dependency — better-sqlite3 → pg

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Edit package.json**

Replace the `dependencies` block with:

```json
{
  "name": "betcouple-backend",
  "private": true,
  "scripts": { "dev": "node --watch server.js", "start": "node server.js" },
  "dependencies": {
    "pg": "^8.12.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2"
  }
}
```

- [ ] **Step 2: Reinstall dependencies**

```bash
cd backend
npm install
```

Expected: `node_modules/pg` folder present; `better-sqlite3` folder absent.

- [ ] **Step 3: Verify pg is installed**

```bash
ls backend/node_modules/pg
```

Expected: directory listing (index.js, lib/, etc.)

---

### Task 2: Rewrite backend/db.js for pg

**Files:**
- Rewrite: `backend/db.js`

- [ ] **Step 1: Write the new db.js**

```js
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
      expires_at     INTEGER,
      created_at     INTEGER NOT NULL,
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
```

- [ ] **Step 2: Check that db.js has no ES module syntax**

```bash
grep -n "^import\|^export" backend/db.js
```

Expected: no output (CommonJS only).

---

### Task 3: Rewrite routes/state.js for async pg

**Files:**
- Rewrite: `backend/routes/state.js`

- [ ] **Step 1: Write the new state.js**

```js
'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db.js');

async function buildState() {
  const profiles = {};
  const { rows: profileRows } = await db.query('SELECT * FROM profiles');
  profileRows.forEach(r => {
    profiles[r.user] = { name: r.name, avatar: r.avatar, colorKey: r.color_key };
  });

  const credits = {};
  const { rows: creditRows } = await db.query('SELECT * FROM credits');
  creditRows.forEach(r => {
    credits[r.user] = r.amount;
  });

  const { rows: allCounters } = await db.query('SELECT * FROM counter_bets');
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

  const { rows: betRows } = await db.query('SELECT * FROM bets ORDER BY created_at DESC');
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
    counterBets:   countersByBetId[r.id] || [],
  }));

  const { rows: catRows } = await db.query('SELECT * FROM categories');
  const categories = catRows.map(r => ({
    id:    r.id,
    e:     r.emoji,
    label: r.label,
    color: r.color,
  }));

  return { profiles, credits, bets, categories };
}

router.get('/', async (req, res) => {
  try {
    res.json(await buildState());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
```

---

### Task 4: Rewrite routes/profiles.js for async pg

**Files:**
- Modify: `backend/routes/profiles.js`

- [ ] **Step 1: Write the new profiles.js**

```js
'use strict';
const express = require('express');
const db = require('../db.js');

module.exports = function(broadcastUpdate) {
  const router = express.Router();

  router.put('/:user', async (req, res) => {
    try {
      const { name, avatar, colorKey } = req.body;
      await db.query(
        'UPDATE profiles SET name = $1, avatar = $2, color_key = $3 WHERE "user" = $4',
        [name, avatar, colorKey, req.params.user]
      );
      broadcastUpdate();
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
```

---

### Task 5: Rewrite routes/credits.js for async pg

**Files:**
- Modify: `backend/routes/credits.js`

- [ ] **Step 1: Write the new credits.js**

```js
'use strict';
const express = require('express');
const db = require('../db.js');

module.exports = function(broadcastUpdate) {
  const router = express.Router();

  router.put('/', async (req, res) => {
    try {
      const { tomas, giulia } = req.body;
      await db.transaction(async (client) => {
        await client.query('UPDATE credits SET amount = $1 WHERE "user" = $2', [tomas, 'tomas']);
        await client.query('UPDATE credits SET amount = $1 WHERE "user" = $2', [giulia, 'giulia']);
      });
      broadcastUpdate();
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
```

---

### Task 6: Rewrite routes/bets.js for async pg

**Files:**
- Rewrite: `backend/routes/bets.js`

- [ ] **Step 1: Write the new bets.js**

```js
'use strict';
const express = require('express');
const db = require('../db.js');

module.exports = function(broadcastUpdate) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    try {
      const { id, creator, title, quota, stake, potentialWin,
              category, isSecret, isCounterable, pegno, expiresAt, createdAt } = req.body;

      await db.transaction(async (client) => {
        await client.query(
          `INSERT INTO bets
             (id, creator, title, quota, stake, potential_win,
              category, is_secret, is_counterable, pegno, expires_at, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [id, creator, title, quota, stake, potentialWin,
           category, isSecret ? 1 : 0, isCounterable ? 1 : 0,
           pegno || null, expiresAt || null, createdAt]
        );
        await client.query(
          'UPDATE credits SET amount = amount - $1 WHERE "user" = $2',
          [stake, creator]
        );
      });

      broadcastUpdate();
      res.status(201).json({ id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/:id/resolve', async (req, res) => {
    try {
      const { outcome } = req.body;
      const { rows } = await db.query('SELECT * FROM bets WHERE id = $1', [req.params.id]);
      const bet = rows[0];
      if (!bet) return res.status(404).json({ error: 'Bet not found' });

      const { rows: counters } = await db.query(
        'SELECT * FROM counter_bets WHERE bet_id = $1', [bet.id]
      );

      await db.transaction(async (client) => {
        await client.query('UPDATE bets SET status = $1 WHERE id = $2', [outcome, bet.id]);

        if (outcome === 'won') {
          await client.query(
            'UPDATE credits SET amount = amount + $1 WHERE "user" = $2',
            [bet.potential_win, bet.creator]
          );
        }

        for (const cb of counters) {
          const cbWon = (outcome === 'won' && cb.side === 'yes') ||
                        (outcome === 'lost' && cb.side === 'no');
          await client.query(
            'UPDATE counter_bets SET status = $1 WHERE id = $2',
            [cbWon ? 'won' : 'lost', cb.id]
          );
          if (cbWon) {
            await client.query(
              'UPDATE credits SET amount = amount + $1 WHERE "user" = $2',
              [cb.potential_win, cb.bettor]
            );
          }
        }
      });

      broadcastUpdate();
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/:id/counter', async (req, res) => {
    try {
      const { id, bettor, side, quotaUsed, stake, potentialWin } = req.body;

      await db.transaction(async (client) => {
        await client.query(
          `INSERT INTO counter_bets
             (id, bet_id, bettor, side, quota_used, stake, potential_win)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, req.params.id, bettor, side, quotaUsed, stake, potentialWin]
        );
        await client.query(
          'UPDATE credits SET amount = amount - $1 WHERE "user" = $2',
          [stake, bettor]
        );
      });

      broadcastUpdate();
      res.status(201).json({ id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/:id/flame', async (req, res) => {
    try {
      await db.query(
        'UPDATE bets SET flamed = ((flamed | 1) - (flamed & 1)) WHERE id = $1',
        [req.params.id]
      );
      broadcastUpdate();
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
```

---

### Task 7: Rewrite routes/categories.js for async pg

**Files:**
- Modify: `backend/routes/categories.js`

- [ ] **Step 1: Write the new categories.js**

```js
'use strict';
const express = require('express');
const db = require('../db.js');

module.exports = function(broadcastUpdate) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    try {
      const { id, emoji, label, color } = req.body;
      await db.query(
        'INSERT INTO categories (id, emoji, label, color) VALUES ($1,$2,$3,$4)',
        [id, emoji, label, color]
      );
      broadcastUpdate();
      res.status(201).json({ id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await db.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
      broadcastUpdate();
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
```

---

### Task 8: Update backend/.env

**Files:**
- Modify: `backend/.env`

- [ ] **Step 1: Add DATABASE_URL for local dev**

The file should contain:

```
PORT=5174
ALLOWED_ORIGIN=*
DATABASE_URL=postgresql://localhost/betcouple
```

Remove `DB_PATH` (no longer used). The `DATABASE_URL` for Render will be set as an environment variable in the Render dashboard — it will override this local value.

- [ ] **Step 2: Verify .gitignore covers .env**

```bash
grep "\.env" .gitignore
```

Expected: `.env` line present (it's there).

---

### Task 9: Verify and commit

- [ ] **Step 1: Ensure local PostgreSQL has the database**

```bash
createdb betcouple 2>/dev/null || echo "already exists"
```

- [ ] **Step 2: Start the backend**

```bash
cd backend && node server.js &
```

Wait 2 seconds for schema init, then:

- [ ] **Step 3: Hit the state endpoint**

```bash
curl -s http://localhost:5174/api/state | python3 -m json.tool | head -30
```

Expected: JSON with `profiles`, `credits`, `bets`, `categories` keys and seed data for tomas/giulia.

- [ ] **Step 4: Kill the server**

```bash
kill %1
```

- [ ] **Step 5: Verify .gitignore covers betcouple.db**

```bash
grep "\.db" .gitignore
```

Expected: `*.db` line present.

- [ ] **Step 6: Commit everything**

```bash
git add backend/package.json backend/db.js backend/routes/state.js \
        backend/routes/profiles.js backend/routes/credits.js \
        backend/routes/bets.js backend/routes/categories.js \
        backend/.env
git commit -m "feat: migrate SQLite to PostgreSQL for Render deploy"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- [x] `package.json`: remove better-sqlite3, add pg — Task 1
- [x] `db.js` rewrite with Pool, SSL, $1/$2, async init, `{ query }` export — Task 2
- [x] `routes/state.js` async — Task 3
- [x] `routes/profiles.js` async — Task 4
- [x] `routes/credits.js` async + transaction — Task 5
- [x] `routes/bets.js` async + transactions — Task 6
- [x] `routes/categories.js` async — Task 7
- [x] `backend/.env` DATABASE_URL — Task 8
- [x] `.gitignore` *.db already present — Task 9 Step 5
- [x] Verify + commit — Task 9

**Placeholder scan:** No TBD / TODO / "similar to" references found.

**Type consistency:**
- `db.query(text, params)` used consistently across all route files.
- `db.transaction(async (client) => { await client.query(...) })` used consistently in credits, bets.
- `rows[0]` for single-row results, `rows` for multi-row — consistent throughout.
- `"user"` quoted in all SQL WHERE/UPDATE/INSERT clauses — consistent.
