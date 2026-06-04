'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcrypt');
const db      = require('../db.js');
const { validatePassword } = require('../passwordPolicy.js');

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required');
const SECRET = process.env.JWT_SECRET;
const BCRYPT_ROUNDS = 10;

// Admin gate. Two ways to authenticate, either is enough:
//   - X-Admin-Key header matching process.env.ADMIN_KEY (for curl/ops)
//   - A regular Bearer JWT belonging to a user with is_admin=true
// If neither auth path is configured AND no key is set, the routes 404.
async function adminGate(req, res, next) {
  const key  = process.env.ADMIN_KEY;
  const hkey = req.headers['x-admin-key'];
  if (key && hkey && hkey === key) return next();

  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    try {
      const { userId } = jwt.verify(auth.slice(7), SECRET);
      const { rows } = await db.query('SELECT is_admin FROM users WHERE id=$1', [userId]);
      if (rows[0]?.is_admin === true) {
        req.adminUserId = userId;
        return next();
      }
      return res.status(403).json({ error: 'forbidden' });
    } catch { /* fall through to 401 */ }
  }
  if (!key) return res.status(404).json({ error: 'not_found' });
  return res.status(401).json({ error: 'unauthorized' });
}

const router = express.Router();
router.use(adminGate);

// GET /api/admin/users — full listing with counts for every cross-reference.
router.get('/users', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        u.id, u.email, u.name, u.avatar, u.color_key,
        u.is_admin,
        u.room_id AS legacy_room_id,
        u.created_at,
        (SELECT COUNT(*)::int FROM user_groups       WHERE user_id = u.id) AS group_count,
        (SELECT COUNT(*)::int FROM bets              WHERE creator = u.id) AS bets_created,
        (SELECT COUNT(*)::int FROM bets              WHERE opponent = u.id OR target_user = u.id) AS bets_against,
        (SELECT amount         FROM credits          WHERE "user" = u.id) AS credits,
        (SELECT COUNT(*)::int FROM friendships      WHERE user_id_a = u.id OR user_id_b = u.id) AS friend_count,
        (SELECT COUNT(*)::int FROM friend_requests  WHERE from_user_id = u.id) AS friend_requests_out,
        (SELECT COUNT(*)::int FROM friend_requests  WHERE to_user_id   = u.id) AS friend_requests_in,
        (SELECT EXISTS(SELECT 1 FROM rooms r WHERE r.id = u.room_id)) AS legacy_room_exists
      FROM users u
      ORDER BY u.created_at DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error('[admin:users]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/admin/users/by-email/:email — case-insensitive lookup
router.get('/users/by-email/:email', async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();
    const { rows: [u] } = await db.query(
      `SELECT id, email, name, avatar, color_key, room_id AS legacy_room_id, created_at
       FROM users WHERE LOWER(email) = $1`, [email]
    );
    if (!u) return res.status(404).json({ error: 'not_found' });

    const { rows: groups } = await db.query(`
      SELECT r.id, r.name, r.emoji, r.invite_code, ug.role, ug.joined_at
      FROM user_groups ug
      JOIN rooms r ON r.id = ug.group_id
      WHERE ug.user_id = $1
      ORDER BY ug.joined_at
    `, [u.id]);

    const { rows: betsCreated } = await db.query(
      `SELECT id, title, status, room_id, created_at FROM bets
       WHERE creator = $1 ORDER BY created_at DESC LIMIT 50`, [u.id]
    );

    const { rows: friends } = await db.query(`
      SELECT CASE WHEN f.user_id_a = $1 THEN f.user_id_b ELSE f.user_id_a END AS friend_id,
             ou.name, ou.email, f.created_at
      FROM friendships f
      JOIN users ou ON ou.id = CASE WHEN f.user_id_a = $1 THEN f.user_id_b ELSE f.user_id_a END
      WHERE f.user_id_a = $1 OR f.user_id_b = $1
      ORDER BY f.created_at DESC
    `, [u.id]);

    const { rows: legacyRoom } = u.legacy_room_id
      ? await db.query('SELECT id, name, emoji FROM rooms WHERE id=$1', [u.legacy_room_id])
      : { rows: [] };

    res.json({
      user: u,
      groups,
      bets_created: betsCreated,
      friends,
      legacy_room: legacyRoom[0] || null,
    });
  } catch (e) {
    console.error('[admin:user]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// DELETE /api/admin/users/:id — wipe a user and every row that references them
// across TEXT-only columns that don\'t have ON DELETE CASCADE. Use with care.
router.delete('/users/:id', async (req, res) => {
  try {
    const uid = req.params.id;
    await db.transaction(async (client) => {
      // Reactions on bets involving the user (no FK from reactions→bets, so
      // we have to clean them ourselves before nuking the bets themselves).
      await client.query(`
        DELETE FROM reactions
        WHERE bettor = $1
           OR bet_id IN (SELECT id FROM bets WHERE creator=$1 OR opponent=$1 OR target_user=$1)
      `, [uid]);
      await client.query('DELETE FROM counter_bets       WHERE bettor = $1', [uid]);
      // bets → counter_bets, bet_messages cascade via FK on bet_id.
      await client.query('DELETE FROM bets               WHERE creator = $1 OR opponent = $1 OR target_user = $1', [uid]);
      await client.query('DELETE FROM credits            WHERE "user" = $1',  [uid]);
      await client.query('DELETE FROM achievements       WHERE user_id = $1', [uid]);
      await client.query('DELETE FROM notification_prefs WHERE "user" = $1',  [uid]);
      await client.query('DELETE FROM push_subscriptions WHERE "user" = $1',  [uid]);
      await client.query('DELETE FROM bet_templates      WHERE user_id = $1', [uid]);
      await client.query('DELETE FROM profiles           WHERE "user" = $1',  [uid]);
      // user_groups + friendships + friend_requests + password_resets + bet_messages cascade.
      await client.query('DELETE FROM users WHERE id = $1', [uid]);
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('[admin:delete-user]', e);
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

// POST /api/admin/users/:id/reset-trophies — wipe every achievement row for
// the target user. The client should also recompute progress on next state
// fetch.
//
// When the request body includes { full: true } we ALSO bump users.fresh_reset_at,
// which signals the target's client (on its next /me load) to wipe the per-
// device LS flags that gate the onboarding tour + secret-trophy easter-egg
// popups. Result: the target sees the "fresh account" experience on their
// next visit, exactly like a brand-new signup.
router.post('/users/:id/reset-trophies', async (req, res) => {
  try {
    const full = req.body?.full === true;
    const { rowCount } = await db.query(
      'DELETE FROM achievements WHERE user_id=$1', [req.params.id]
    );
    if (full) {
      await db.query(
        'UPDATE users SET fresh_reset_at=$1 WHERE id=$2',
        [Date.now(), req.params.id]
      );
    }
    res.json({ ok: true, deleted: rowCount, full });
  } catch (e) {
    console.error('[admin:reset-trophies]', e);
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

// POST /api/admin/users/:id/toggle-admin — flip the is_admin flag. Guard
// against an admin demoting themselves into a lockout. Returns the new state.
router.post('/users/:id/toggle-admin', async (req, res) => {
  try {
    const targetId = req.params.id;
    if (req.adminUserId && targetId === req.adminUserId) {
      return res.status(400).json({ error: 'cannot_demote_self' });
    }
    const { rows: [u] } = await db.query(
      'UPDATE users SET is_admin = NOT is_admin WHERE id=$1 RETURNING id, is_admin',
      [targetId]
    );
    if (!u) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, is_admin: u.is_admin });
  } catch (e) {
    console.error('[admin:toggle-admin]', e);
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

// PATCH /api/admin/users/:id/clear-legacy-room — set users.room_id = NULL,
// useful when the column points at a deleted room and confuses the state
// fallback. Doesn\'t touch user_groups.
router.patch('/users/:id/clear-legacy-room', async (req, res) => {
  try {
    await db.query('UPDATE users SET room_id=NULL WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
});

// GET /api/admin/integrity — quick health snapshot looking for the usual
// kinds of orphaned data that bite this app.
router.get('/integrity', async (req, res) => {
  try {
    const dangling_room_ids = (await db.query(`
      SELECT u.id, u.email, u.name, u.room_id
      FROM users u
      WHERE u.room_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM rooms r WHERE r.id = u.room_id)
    `)).rows;

    const duplicate_names = (await db.query(`
      SELECT LOWER(name) AS lname, COUNT(*)::int AS n,
             json_agg(json_build_object('id', id, 'email', email, 'name', name) ORDER BY created_at) AS users
      FROM users
      GROUP BY LOWER(name)
      HAVING COUNT(*) > 1
    `)).rows;

    const orphan_user_groups = (await db.query(`
      SELECT ug.user_id, ug.group_id
      FROM user_groups ug
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ug.user_id)
         OR NOT EXISTS (SELECT 1 FROM rooms r WHERE r.id = ug.group_id)
    `)).rows;

    // Same email (case-insensitive) on multiple user rows — the UNIQUE
    // constraint is case-sensitive, so 'Anna@x' and 'anna@x' can coexist.
    // This is the exact pathology behind "password reset doesn't reach the
    // right account" reports.
    const duplicate_emails = (await db.query(`
      SELECT LOWER(email) AS lemail, COUNT(*)::int AS n,
             json_agg(json_build_object(
               'id', id, 'email', email, 'name', name,
               'created_at', created_at, 'room_id', room_id
             ) ORDER BY created_at) AS users
      FROM users
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
    `)).rows;

    res.json({ dangling_room_ids, duplicate_names, orphan_user_groups, duplicate_emails });
  } catch (e) {
    console.error('[admin:integrity]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/admin/groups — full room directory + member count
router.get('/groups', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT r.id, r.name, r.emoji, r.invite_code, r.created_at,
             (SELECT COUNT(*)::int FROM user_groups WHERE group_id = r.id) AS member_count,
             (SELECT COUNT(*)::int FROM bets        WHERE room_id  = r.id) AS bet_count
      FROM rooms r
      ORDER BY r.created_at DESC
    `);
    res.json(rows);
  } catch (e) { console.error('[admin:groups]', e); res.status(500).json({ error: 'server_error' }); }
});

// POST /api/admin/groups/:groupId/add-member { userId } — force-add a user
// to a group bypassing invite codes / size caps. Useful when the morosa
// can\'t join via the normal flow.
router.post('/groups/:groupId/add-member', async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId  = req.body?.userId;
    if (!userId) return res.status(400).json({ error: 'missing_user' });

    const { rows: [u] } = await db.query('SELECT id FROM users WHERE id=$1', [userId]);
    if (!u) return res.status(404).json({ error: 'user_not_found' });
    const { rows: [g] } = await db.query('SELECT id FROM rooms WHERE id=$1', [groupId]);
    if (!g) return res.status(404).json({ error: 'group_not_found' });

    await db.query(
      'INSERT INTO user_groups(group_id, user_id, role, joined_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [groupId, userId, 'member', Date.now()]
    );
    res.json({ ok: true });
  } catch (e) { console.error('[admin:add-member]', e); res.status(500).json({ error: 'server_error' }); }
});

// DELETE /api/admin/groups/:groupId/members/:userId — remove a member.
router.delete('/groups/:groupId/members/:userId', async (req, res) => {
  try {
    await db.query(
      'DELETE FROM user_groups WHERE group_id=$1 AND user_id=$2',
      [req.params.groupId, req.params.userId]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
});

// POST /api/admin/groups/:groupId/regenerate-code — issue a fresh invite code.
router.post('/groups/:groupId/regenerate-code', async (req, res) => {
  try {
    const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const make = () => Array.from({ length: 6 }, () =>
      CHARSET[Math.floor(Math.random() * CHARSET.length)]
    ).join('');
    let code;
    for (let i = 0; i < 10; i++) {
      code = make();
      const { rows } = await db.query('SELECT 1 FROM rooms WHERE invite_code=$1', [code]);
      if (!rows.length) break;
    }
    await db.query('UPDATE rooms SET invite_code=$1 WHERE id=$2', [code, req.params.groupId]);
    res.json({ ok: true, invite_code: code });
  } catch (e) { console.error('[admin:regenerate]', e); res.status(500).json({ error: 'server_error' }); }
});

// POST /api/admin/users/:id/set-password { password } — directly set a
// password, no email needed. Lets you unblock someone whose password reset
// flow is broken (SMTP not configured, link not arriving, etc.).
router.post('/users/:id/set-password', async (req, res) => {
  try {
    const password = req.body?.password;
    const policyErr = validatePassword(password);
    if (policyErr) return res.status(400).json({ error: policyErr });
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await db.transaction(async (client) => {
      await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
      // Invalidate any outstanding reset tokens for this user.
      await client.query(
        'UPDATE password_resets SET used_at=$1 WHERE user_id=$2 AND used_at IS NULL',
        [Date.now(), req.params.id]
      );
    });
    res.json({ ok: true });
  } catch (e) { console.error('[admin:set-password]', e); res.status(500).json({ error: 'server_error' }); }
});

// ── One-shot global reset ──────────────────────────────────────────────
// Single-use "nuke everything" intended for the transition from testing to
// real use. Wipes every row of user-generated data and every non-admin
// account, then sets a flag so the route refuses to run again. After this
// fires once, the corresponding admin tab in the UI also disappears.
const NUKE_FLAG = 'one_shot_nuke_v1';

router.get('/nuke-status', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT 1 FROM _system_flags WHERE id=$1', [NUKE_FLAG]);
    res.json({ available: rows.length === 0 });
  } catch (e) {
    console.error('[admin:nuke-status]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

router.post('/nuke', async (req, res) => {
  try {
    if (req.body?.confirm !== 'NUKE')
      return res.status(400).json({ error: 'confirm_phrase_required' });

    const { rows: flagged } = await db.query('SELECT 1 FROM _system_flags WHERE id=$1', [NUKE_FLAG]);
    if (flagged.length) return res.status(410).json({ error: 'already_used' });

    const counts = await db.transaction(async (client) => {
      const c = {};
      const wipe = async (sql, key) => { c[key] = (await client.query(sql)).rowCount; };
      await wipe('DELETE FROM reactions',           'reactions');
      await wipe('DELETE FROM counter_bets',        'counter_bets');
      await wipe('DELETE FROM bets',                'bets');
      await wipe('DELETE FROM achievements',        'achievements');
      await wipe('DELETE FROM bet_templates',       'bet_templates');
      await client.query('DELETE FROM templates').catch(() => {});
      await wipe('DELETE FROM notification_prefs',  'notification_prefs');
      await wipe('DELETE FROM push_subscriptions',  'push_subscriptions');
      await wipe('DELETE FROM profiles',            'profiles');
      await wipe('DELETE FROM credits',             'credits');
      await wipe('DELETE FROM friend_requests',     'friend_requests');
      await wipe('DELETE FROM friendships',         'friendships');
      await wipe('DELETE FROM password_resets',     'password_resets');
      await wipe('DELETE FROM categories WHERE room_id IS NOT NULL', 'categories_custom');
      await wipe('DELETE FROM user_groups',         'user_groups');
      await client.query('UPDATE users SET room_id=NULL WHERE room_id IS NOT NULL');
      await wipe('DELETE FROM rooms',               'rooms');
      await wipe('DELETE FROM users WHERE is_admin IS NOT TRUE', 'users_non_admin');

      // Re-seed credits at 100 for the admins that remain.
      const { rows: admins } = await client.query('SELECT id FROM users WHERE is_admin=true');
      for (const a of admins) {
        await client.query(
          `INSERT INTO credits("user",amount) VALUES($1,100)
             ON CONFLICT("user") DO UPDATE SET amount=100`,
          [a.id]
        );
      }
      c.admins_kept = admins.length;

      await client.query(
        'INSERT INTO _system_flags(id,set_at) VALUES($1,$2)',
        [NUKE_FLAG, Date.now()]
      );
      return c;
    });

    console.log('[admin:nuke] one-shot reset executed:', counts);
    res.json({ ok: true, wiped: counts });
  } catch (e) {
    console.error('[admin:nuke]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// ── Bets management ───────────────────────────────────────────────
// Lists every bet in the system, newest first, with the creator/opponent
// names + status so the admin can pick which ones to wipe. Used by the
// new "Bets" tab in AdminView.
router.get('/bets', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const { rows } = await db.query(`
      SELECT b.id, b.title, b.status, b.stake, b.potential_win, b.quota,
             b.created_at, b.resolved_at, b.is_secret, b.is_surprise,
             b.creator, b.opponent, b.target_user, b.room_id,
             uc.name AS creator_name,
             uo.name AS opponent_name,
             r.name  AS room_name, r.emoji AS room_emoji
        FROM bets b
        LEFT JOIN users uc ON uc.id = b.creator
        LEFT JOIN users uo ON uo.id = b.opponent
        LEFT JOIN rooms r  ON r.id  = b.room_id
       ORDER BY COALESCE(b.resolved_at, b.created_at) DESC
       LIMIT $1
    `, [limit]);
    res.json({ rows });
  } catch (e) {
    console.error('[admin:bets:list]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Helper: collect the set of users affected by a bet so we can reset
// their credits after deletion. Includes the creator, every opponent
// (resolved or pending), and every counter-bettor.
async function affectedUsersForBet(client, betId) {
  const { rows: [bet] } = await client.query(
    'SELECT creator, opponent, target_user FROM bets WHERE id=$1', [betId]
  );
  if (!bet) return new Set();
  const { rows: cbs } = await client.query(
    'SELECT DISTINCT bettor FROM counter_bets WHERE bet_id=$1', [betId]
  );
  const ids = new Set();
  if (bet.creator)     ids.add(bet.creator);
  if (bet.opponent)    ids.add(bet.opponent);
  if (bet.target_user) ids.add(bet.target_user);
  for (const c of cbs) if (c.bettor) ids.add(c.bettor);
  return ids;
}

async function resetCreditsForUsers(client, userIds) {
  if (!userIds.size) return 0;
  const arr = Array.from(userIds);
  const { rowCount } = await client.query(
    `INSERT INTO credits("user", amount)
       SELECT u.id, 100 FROM users u WHERE u.id = ANY($1)
     ON CONFLICT("user") DO UPDATE SET amount = 100`,
    [arr]
  );
  return rowCount;
}

// DELETE /api/admin/bets/:id — wipe a single bet + cascading child rows
// (counter_bets, reactions, bet_messages) and reset the credits of
// every involved user back to 100. Simpler than per-transaction
// reversal: the season-reset semantics is what the admin actually
// wants when erasing a "wrong" bet.
router.delete('/bets/:id', async (req, res) => {
  try {
    const result = await db.transaction(async (client) => {
      const ids = await affectedUsersForBet(client, req.params.id);
      if (ids.size === 0) throw new Error('not_found');

      const counts = {};
      const wipe = async (sql, key) => {
        counts[key] = (await client.query(sql, [req.params.id])).rowCount;
      };
      // bet_messages table may not exist on legacy deploys — guard it.
      try { await wipe('DELETE FROM bet_messages WHERE bet_id=$1', 'messages'); }
      catch (e) { counts.messages = 0; }
      await wipe('DELETE FROM reactions    WHERE bet_id=$1', 'reactions');
      await wipe('DELETE FROM counter_bets WHERE bet_id=$1', 'counter_bets');
      await wipe('DELETE FROM bets         WHERE id=$1',     'bets');

      counts.credits_reset = await resetCreditsForUsers(client, ids);
      return counts;
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    if (e.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    console.error('[admin:bets:delete]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// DELETE /api/admin/bets — wipe ALL bets in the system. Optional
// ?room=GROUP_ID scopes the wipe to a single group. Credits of every
// involved user are reset to 100 in the same transaction so the
// leaderboard stays consistent.
router.delete('/bets', async (req, res) => {
  try {
    const roomId = req.query.room || null;
    const result = await db.transaction(async (client) => {
      // Collect user IDs touched by the bets we're about to delete.
      const userQuery = roomId
        ? `SELECT DISTINCT u FROM (
             SELECT creator AS u FROM bets WHERE room_id=$1
             UNION SELECT opponent FROM bets WHERE room_id=$1 AND opponent IS NOT NULL
             UNION SELECT target_user FROM bets WHERE room_id=$1 AND target_user IS NOT NULL
             UNION SELECT cb.bettor FROM counter_bets cb JOIN bets b ON b.id=cb.bet_id WHERE b.room_id=$1
           ) t WHERE u IS NOT NULL`
        : `SELECT DISTINCT u FROM (
             SELECT creator AS u FROM bets
             UNION SELECT opponent FROM bets WHERE opponent IS NOT NULL
             UNION SELECT target_user FROM bets WHERE target_user IS NOT NULL
             UNION SELECT bettor FROM counter_bets WHERE bettor IS NOT NULL
           ) t`;
      const { rows: userRows } = roomId
        ? await client.query(userQuery, [roomId])
        : await client.query(userQuery);
      const userIds = new Set(userRows.map(r => r.u).filter(Boolean));

      const params = roomId ? [roomId] : [];
      const whereRoom = roomId ? ' WHERE room_id=$1' : '';
      const whereBetRoom = roomId
        ? ' WHERE bet_id IN (SELECT id FROM bets WHERE room_id=$1)'
        : '';

      const counts = {};
      const wipe = async (sql, args, key) => {
        counts[key] = (await client.query(sql, args)).rowCount;
      };
      try { await wipe(`DELETE FROM bet_messages${whereBetRoom}`, params, 'messages'); }
      catch (e) { counts.messages = 0; }
      await wipe(`DELETE FROM reactions${whereBetRoom}`,    params, 'reactions');
      await wipe(`DELETE FROM counter_bets${whereBetRoom}`, params, 'counter_bets');
      await wipe(`DELETE FROM bets${whereRoom}`,            params, 'bets');

      counts.credits_reset = await resetCreditsForUsers(client, userIds);
      return counts;
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[admin:bets:wipe]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
