'use strict';
const express = require('express');
const crypto  = require('crypto');
const db      = require('../db.js');
const { sendPushToUser, isPrefEnabled } = require('./push.js');
const { computeProgressFor, listForUser, CATALOG } = require('../achievements.js');

// Helper: friendship rows are stored in canonical (a < b) order. Given two
// user ids return them sorted so we can target the single canonical row.
function canon(a, b) {
  return a < b ? [a, b] : [b, a];
}

// Friend codes — 8-char alphanumeric, ambiguity-free charset (no 0/O/1/I/L)
// so codes typed by hand resolve unambiguously. uniqueFriendCode keeps
// trying until it finds an unused one (collision probability is tiny but
// not zero with millions of users).
const FRIEND_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genFriendCode() {
  return Array.from(crypto.randomBytes(8), b => FRIEND_CHARSET[b % FRIEND_CHARSET.length]).join('');
}
async function uniqueFriendCode() {
  for (let i = 0; i < 10; i++) {
    const c = genFriendCode();
    const { rows } = await db.query('SELECT 1 FROM users WHERE friend_code=$1', [c]);
    if (!rows.length) return c;
  }
  throw new Error('friend_code_gen_failed');
}
async function ensureFriendCode(userId) {
  const { rows } = await db.query('SELECT friend_code FROM users WHERE id=$1', [userId]);
  if (rows[0]?.friend_code) return rows[0].friend_code;
  const code = await uniqueFriendCode();
  await db.query('UPDATE users SET friend_code=$1 WHERE id=$2 AND friend_code IS NULL', [code, userId]);
  // Race-safe re-read in case another request beat us to it
  const { rows: re } = await db.query('SELECT friend_code FROM users WHERE id=$1', [userId]);
  return re[0]?.friend_code;
}

async function listFriends(userId) {
  // Friends = canonical pair where this user is on either side.
  const { rows } = await db.query(
    `
    SELECT
      u.id, u.name, u.avatar, u.avatar_url, u.color_key,
      f.created_at AS friended_at,
      (
        SELECT jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'emoji', r.emoji) ORDER BY r.name)
        FROM rooms r
        WHERE r.id IN (
          SELECT my.group_id
          FROM user_groups my
          JOIN user_groups his ON his.group_id = my.group_id
          WHERE my.user_id = $1 AND his.user_id = u.id
        )
      ) AS shared_groups,
      (
        SELECT GREATEST(COALESCE(MAX(b.resolved_at),0), COALESCE(MAX(b.created_at),0))
        FROM bets b
        WHERE (b.creator = $1 OR b.target_user = $1 OR b.opponent = $1)
          AND (b.creator = u.id OR b.target_user = u.id OR b.opponent = u.id)
      ) AS last_interaction
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.user_id_a = $1 THEN f.user_id_b ELSE f.user_id_a END
    WHERE f.user_id_a = $1 OR f.user_id_b = $1
    ORDER BY u.name
    `,
    [userId]
  );
  return rows;
}

async function listRequests(userId) {
  const { rows: incoming } = await db.query(
    `SELECT u.id, u.name, u.avatar, u.avatar_url, u.color_key, fr.created_at
     FROM friend_requests fr
     JOIN users u ON u.id = fr.from_user_id
     WHERE fr.to_user_id = $1
     ORDER BY fr.created_at DESC`,
    [userId]
  );
  const { rows: outgoing } = await db.query(
    `SELECT u.id, u.name, u.avatar, u.avatar_url, u.color_key, fr.created_at
     FROM friend_requests fr
     JOIN users u ON u.id = fr.to_user_id
     WHERE fr.from_user_id = $1
     ORDER BY fr.created_at DESC`,
    [userId]
  );
  return { incoming, outgoing };
}

async function listDiscover(userId) {
  // People you share a group with, minus existing friends + minus anyone
  // already involved in a pending request (either direction).
  const { rows } = await db.query(
    `
    WITH my_groups AS (
      SELECT group_id FROM user_groups WHERE user_id = $1
    ),
    candidates AS (
      SELECT DISTINCT ug.user_id
      FROM user_groups ug
      JOIN my_groups mg ON mg.group_id = ug.group_id
      WHERE ug.user_id <> $1
    )
    SELECT u.id, u.name, u.avatar, u.avatar_url, u.color_key,
      (
        SELECT jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'emoji', r.emoji) ORDER BY r.name)
        FROM rooms r
        WHERE r.id IN (
          SELECT my.group_id
          FROM user_groups my
          JOIN user_groups his ON his.group_id = my.group_id
          WHERE my.user_id = $1 AND his.user_id = u.id
        )
      ) AS shared_groups
    FROM candidates c
    JOIN users u ON u.id = c.user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM friendships f
      WHERE (f.user_id_a = $1 AND f.user_id_b = u.id)
         OR (f.user_id_b = $1 AND f.user_id_a = u.id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM friend_requests fr
      WHERE (fr.from_user_id = $1 AND fr.to_user_id = u.id)
         OR (fr.from_user_id = u.id AND fr.to_user_id = $1)
    )
    ORDER BY u.name
    `,
    [userId]
  );
  return rows;
}

function makeRouter(broadcastUpdate) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try { res.json(await listFriends(req.userId)); }
    catch (e) { console.error('[friends:list]', e); res.status(500).json({ error: 'server_error' }); }
  });

  router.get('/requests', async (req, res) => {
    try { res.json(await listRequests(req.userId)); }
    catch (e) { console.error('[friends:requests]', e); res.status(500).json({ error: 'server_error' }); }
  });

  // GET /api/friends/code/mine — returns the caller's friend code,
  // generating one lazily if they don't have one yet.
  router.get('/code/mine', async (req, res) => {
    try {
      const code = await ensureFriendCode(req.userId);
      res.json({ code });
    } catch (e) { console.error('[friends:code-mine]', e); res.status(500).json({ error: 'server_error' }); }
  });

  // POST /api/friends/code/regenerate — invalidates the old code and
  // creates a new one. Existing pending requests addressed via the old
  // code stay valid since they target user IDs, not codes.
  router.post('/code/regenerate', async (req, res) => {
    try {
      const code = await uniqueFriendCode();
      await db.query('UPDATE users SET friend_code=$1 WHERE id=$2', [code, req.userId]);
      res.json({ code });
    } catch (e) { console.error('[friends:code-regen]', e); res.status(500).json({ error: 'server_error' }); }
  });

  // POST /api/friends/code/redeem { code } — sends a friend request to
  // the user that owns that code. Same downstream side-effects as
  // /request (auto-accept on reverse-pending, etc).
  router.post('/code/redeem', async (req, res) => {
    try {
      const raw = (req.body?.code || '').trim().toUpperCase();
      if (!raw) return res.status(400).json({ error: 'missing_code' });
      const { rows: targetRows } = await db.query(
        'SELECT id, name FROM users WHERE friend_code=$1', [raw]
      );
      const target = targetRows[0];
      if (!target) return res.status(404).json({ error: 'invalid_code' });
      if (target.id === req.userId) return res.status(400).json({ error: 'self_code' });

      // Reuse the same flow as /request — same checks, same notifications.
      // We can't trivially call the route handler here, so we duplicate the
      // minimal contract: refuse if already friends, auto-accept on reverse
      // pending, otherwise insert a request row.
      const me = req.userId;
      const them = target.id;
      const [a, b] = canon(me, them);
      const { rows: existing } = await db.query(
        'SELECT 1 FROM friendships WHERE user_id_a=$1 AND user_id_b=$2', [a, b]
      );
      if (existing.length) return res.status(409).json({ error: 'already_friends' });

      const { rows: reverse } = await db.query(
        'SELECT 1 FROM friend_requests WHERE from_user_id=$1 AND to_user_id=$2', [them, me]
      );
      if (reverse.length) {
        await db.transaction(async client => {
          await client.query(
            'DELETE FROM friend_requests WHERE from_user_id=$1 AND to_user_id=$2', [them, me]
          );
          await client.query(
            'INSERT INTO friendships(user_id_a, user_id_b, created_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
            [a, b, Date.now()]
          );
        });
        try {
          if (await isPrefEnabled(them, 'on_friend_accept'))
            sendPushToUser(them, { title: '✓ Richiesta accettata', body: 'Avete ora un\'amicizia Vincit', url: '/' });
        } catch {}
        return res.json({ ok: true, autoAccepted: true, friend: target });
      }

      const { rows: pending } = await db.query(
        'SELECT 1 FROM friend_requests WHERE from_user_id=$1 AND to_user_id=$2', [me, them]
      );
      if (pending.length) return res.status(409).json({ error: 'already_pending' });

      await db.query(
        'INSERT INTO friend_requests(from_user_id, to_user_id, created_at) VALUES($1,$2,$3)',
        [me, them, Date.now()]
      );
      try {
        const { rows: meRows } = await db.query('SELECT name FROM users WHERE id=$1', [me]);
        if (await isPrefEnabled(them, 'on_friend_request'))
          sendPushToUser(them, {
            title: '🤝 Nuova richiesta di amicizia',
            body:  `${meRows[0]?.name || 'Qualcuno'} vuole esserti amico`,
            url:   '/',
          });
      } catch {}
      res.json({ ok: true, autoAccepted: false, target });
    } catch (e) {
      console.error('[friends:code-redeem]', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  router.get('/discover', async (req, res) => {
    try { res.json(await listDiscover(req.userId)); }
    catch (e) { console.error('[friends:discover]', e); res.status(500).json({ error: 'server_error' }); }
  });

  // GET /api/friends/known — returns every member of every group the
  // user belongs to (minus self), tagged with `shared_groups` and
  // a friendship/request status flag. Powers the "Conosciuti" tab.
  router.get('/known', async (req, res) => {
    try {
      const me = req.userId;
      const { rows } = await db.query(
        `
        WITH my_groups AS (SELECT group_id FROM user_groups WHERE user_id = $1),
        candidates AS (
          SELECT DISTINCT ug.user_id
            FROM user_groups ug
            JOIN my_groups mg ON mg.group_id = ug.group_id
           WHERE ug.user_id <> $1
        )
        SELECT u.id, u.name, u.avatar, u.avatar_url, u.color_key,
          (
            SELECT jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'emoji', r.emoji) ORDER BY r.name)
              FROM rooms r
             WHERE r.id IN (
               SELECT my.group_id
                 FROM user_groups my
                 JOIN user_groups his ON his.group_id = my.group_id
                WHERE my.user_id = $1 AND his.user_id = u.id
             )
          ) AS shared_groups,
          EXISTS (
            SELECT 1 FROM friendships f
             WHERE (f.user_id_a = $1 AND f.user_id_b = u.id)
                OR (f.user_id_a = u.id AND f.user_id_b = $1)
          ) AS is_friend,
          EXISTS (
            SELECT 1 FROM friend_requests fr
             WHERE (fr.from_user_id = $1 AND fr.to_user_id = u.id)
                OR (fr.from_user_id = u.id AND fr.to_user_id = $1)
          ) AS pending
          FROM candidates c
          JOIN users u ON u.id = c.user_id
        ORDER BY u.name
        `,
        [me]
      );
      res.json({ rows });
    } catch (e) {
      console.error('[friends:known]', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  // POST /api/friends/request { userId } — send a request. If a reverse
  // pending request already exists, auto-accept and form the friendship.
  router.post('/request', async (req, res) => {
    try {
      const me = req.userId;
      const them = req.body?.userId;
      if (!them || them === me) return res.status(400).json({ error: 'invalid_user' });

      const { rows: [u] } = await db.query('SELECT id, name FROM users WHERE id=$1', [them]);
      if (!u) return res.status(404).json({ error: 'user_not_found' });

      const [a, b] = canon(me, them);
      const { rows: existingFriend } = await db.query(
        'SELECT 1 FROM friendships WHERE user_id_a=$1 AND user_id_b=$2', [a, b]
      );
      if (existingFriend.length) return res.status(409).json({ error: 'already_friends' });

      // Reverse pending request — auto-accept.
      const { rows: reverse } = await db.query(
        'SELECT 1 FROM friend_requests WHERE from_user_id=$1 AND to_user_id=$2', [them, me]
      );
      if (reverse.length) {
        await db.transaction(async (client) => {
          await client.query('DELETE FROM friend_requests WHERE (from_user_id=$1 AND to_user_id=$2) OR (from_user_id=$2 AND to_user_id=$1)', [me, them]);
          await client.query('INSERT INTO friendships(user_id_a, user_id_b, created_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [a, b, Date.now()]);
        });
        // Ping the original sender that we accepted.
        try {
          if (await isPrefEnabled(them, 'on_friend_accept')) {
            const { rows: [meRow] } = await db.query('SELECT name FROM users WHERE id=$1', [me]);
            sendPushToUser(them, {
              title: '🤝 Richiesta accettata',
              body:  `${meRow?.name || 'Qualcuno'} ti ha aggiunto agli amici`,
              url:   '/',
            });
          }
        } catch (e) { console.error('[friends:notify-accept]', e); }
        return res.json({ ok: true, friended: true });
      }

      // Forward request.
      const { rows: pending } = await db.query(
        'SELECT 1 FROM friend_requests WHERE from_user_id=$1 AND to_user_id=$2', [me, them]
      );
      if (pending.length) return res.status(409).json({ error: 'already_requested' });

      await db.query(
        'INSERT INTO friend_requests(from_user_id, to_user_id, created_at) VALUES($1,$2,$3)',
        [me, them, Date.now()]
      );

      // Push to recipient.
      try {
        if (await isPrefEnabled(them, 'on_friend_request')) {
          const { rows: [meRow] } = await db.query('SELECT name FROM users WHERE id=$1', [me]);
          sendPushToUser(them, {
            title: '👥 Nuova richiesta di amicizia',
            body:  `${meRow?.name || 'Qualcuno'} ti vuole tra gli amici`,
            url:   '/',
          });
        }
      } catch (e) { console.error('[friends:notify-request]', e); }

      res.json({ ok: true, friended: false });
    } catch (e) { console.error('[friends:request]', e); res.status(500).json({ error: 'server_error' }); }
  });

  // POST /api/friends/respond { userId, accept }
  router.post('/respond', async (req, res) => {
    try {
      const me = req.userId;
      const them = req.body?.userId;
      const accept = !!req.body?.accept;
      if (!them || them === me) return res.status(400).json({ error: 'invalid_user' });

      const { rows: pending } = await db.query(
        'SELECT 1 FROM friend_requests WHERE from_user_id=$1 AND to_user_id=$2', [them, me]
      );
      if (!pending.length) return res.status(404).json({ error: 'no_request' });

      const [a, b] = canon(me, them);

      if (accept) {
        await db.transaction(async (client) => {
          await client.query('DELETE FROM friend_requests WHERE from_user_id=$1 AND to_user_id=$2', [them, me]);
          await client.query('INSERT INTO friendships(user_id_a, user_id_b, created_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [a, b, Date.now()]);
        });
        try {
          if (await isPrefEnabled(them, 'on_friend_accept')) {
            const { rows: [meRow] } = await db.query('SELECT name FROM users WHERE id=$1', [me]);
            sendPushToUser(them, {
              title: '🤝 Richiesta accettata',
              body:  `${meRow?.name || 'Qualcuno'} ti ha aggiunto agli amici`,
              url:   '/',
            });
          }
        } catch (e) { console.error('[friends:notify-accept]', e); }
      } else {
        await db.query('DELETE FROM friend_requests WHERE from_user_id=$1 AND to_user_id=$2', [them, me]);
      }

      res.json({ ok: true, accepted: accept });
    } catch (e) { console.error('[friends:respond]', e); res.status(500).json({ error: 'server_error' }); }
  });

  // POST /api/friends/cancel { userId } — cancel an outgoing request
  router.post('/cancel', async (req, res) => {
    try {
      const me = req.userId;
      const them = req.body?.userId;
      if (!them) return res.status(400).json({ error: 'invalid_user' });
      await db.query(
        'DELETE FROM friend_requests WHERE from_user_id=$1 AND to_user_id=$2',
        [me, them]
      );
      res.json({ ok: true });
    } catch (e) { console.error('[friends:cancel]', e); res.status(500).json({ error: 'server_error' }); }
  });

  // DELETE /api/friends/:userId — remove an accepted friendship
  router.delete('/:userId', async (req, res) => {
    try {
      const me = req.userId;
      const them = req.params.userId;
      if (!them || them === me) return res.status(400).json({ error: 'invalid_user' });
      const [a, b] = canon(me, them);
      await db.query('DELETE FROM friendships WHERE user_id_a=$1 AND user_id_b=$2', [a, b]);
      res.json({ ok: true });
    } catch (e) { console.error('[friends:remove]', e); res.status(500).json({ error: 'server_error' }); }
  });

  // GET /api/friends/leaderboard — list of my friends ranked by trophy
  // points (sum of unlocked levels). Returns enough info to render the
  // FriendsView leaderboard without N round-trips to /profile/:id.
  router.get('/leaderboard', async (req, res) => {
    try {
      const me = req.userId;
      const friends = await listFriends(me);
      if (!friends.length) return res.json({ rows: [] });

      // Single query: per-friend trophy-points + bets-won counts.
      const ids = friends.map(f => f.id);
      const { rows: trophyAgg } = await db.query(
        `SELECT user_id, COALESCE(SUM(level), 0)::int AS points
         FROM achievements
         WHERE user_id = ANY($1)
         GROUP BY user_id`,
        [ids]
      );
      const trophyById = Object.fromEntries(trophyAgg.map(r => [r.user_id, r.points]));

      const { rows: winsAgg } = await db.query(
        `SELECT creator AS uid, COUNT(*)::int AS wins
         FROM bets
         WHERE creator = ANY($1) AND status='won'
         GROUP BY creator`,
        [ids]
      );
      const winsById = Object.fromEntries(winsAgg.map(r => [r.uid, r.wins]));

      // h2h record against me — wins/losses on bets where I'm one side
      // and the friend is the other (creator+opponent, in either order).
      const { rows: h2hRows } = await db.query(
        `SELECT
           CASE WHEN creator = $1 THEN opponent ELSE creator END AS friend_id,
           status,
           creator = $1 AS i_created
         FROM bets
         WHERE status IN ('won','lost')
           AND ((creator = $1 AND opponent = ANY($2))
             OR (opponent = $1 AND creator = ANY($2)))`,
        [me, ids]
      );
      const h2hById = {};
      for (const r of h2hRows) {
        const f = r.friend_id;
        if (!h2hById[f]) h2hById[f] = { iWon: 0, iLost: 0, total: 0 };
        h2hById[f].total++;
        // creator wins == 'won'; we know who the creator is via i_created
        const creatorWon = r.status === 'won';
        const iWon = (r.i_created && creatorWon) || (!r.i_created && !creatorWon);
        if (iWon) h2hById[f].iWon++; else h2hById[f].iLost++;
      }

      const rows = friends.map(f => ({
        id:           f.id,
        name:         f.name,
        avatar:       f.avatar,
        avatar_url:   f.avatar_url,
        color_key:    f.color_key,
        trophyPoints: trophyById[f.id] || 0,
        wins:         winsById[f.id] || 0,
        h2hWon:       h2hById[f.id]?.iWon  || 0,
        h2hLost:      h2hById[f.id]?.iLost || 0,
        h2hTotal:     h2hById[f.id]?.total || 0,
      })).sort((a, b) => b.trophyPoints - a.trophyPoints || b.wins - a.wins);

      res.json({ rows });
    } catch (e) {
      console.error('[friends:leaderboard]', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  // GET /api/friends/:userId/profile — full public profile of a friend:
  // their unlocked achievements, computed progress, vs-me h2h stats, and
  // basic profile fields. Refuses if not actually friends (privacy).
  router.get('/:userId/profile', async (req, res) => {
    try {
      const me = req.userId;
      const them = req.params.userId;
      if (!them || them === me) return res.status(400).json({ error: 'invalid_user' });
      const [a, b] = canon(me, them);
      const { rows: f } = await db.query(
        'SELECT 1 FROM friendships WHERE user_id_a=$1 AND user_id_b=$2',
        [a, b]
      );
      const isFriend = f.length > 0;
      if (!isFriend) {
        // Not friends — allow access only if they share at least one group
        // (default visibility: "anyone in your same group can see your
        // trophies and stats"). Otherwise refuse outright.
        const { rows: shared } = await db.query(
          `SELECT 1
             FROM user_groups my
             JOIN user_groups his ON his.group_id = my.group_id
            WHERE my.user_id = $1 AND his.user_id = $2
            LIMIT 1`,
          [me, them]
        );
        if (!shared.length) return res.status(403).json({ error: 'not_visible' });
      }

      const { rows: userRows } = await db.query(
        `SELECT id, name, avatar, avatar_url, color_key,
                privacy_trophies, privacy_stats, privacy_groups
           FROM users WHERE id=$1`,
        [them]
      );
      const profile = userRows[0];
      if (!profile) return res.status(404).json({ error: 'not_found' });

      // Privacy resolver: takes the section's stored setting and the
      // current viewer's relationship to the target, returns true if
      // the section should be sent. Self always sees everything; the
      // route already gated 'not_visible' upstream so by the time we
      // get here viewer is at minimum a group-mate.
      const canSee = (setting) => {
        if (setting === 'public')  return true;            // shared-group OK
        if (setting === 'friends') return isFriend;
        if (setting === 'private') return false;           // even friends are blocked
        return true;
      };
      const seeTrophies = canSee(profile.privacy_trophies);
      const seeStats    = canSee(profile.privacy_stats);
      const seeGroups   = canSee(profile.privacy_groups);

      const [unlocked, progress] = seeTrophies
        ? await Promise.all([listForUser(them), computeProgressFor(them)])
        : [[], {}];

      // Joint stats vs me
      const { rows: jointRows } = await db.query(
        `SELECT
           creator, opponent, status,
           (creator = $1) AS i_created
         FROM bets
         WHERE status IN ('won','lost')
           AND ((creator = $1 AND opponent = $2)
             OR (creator = $2 AND opponent = $1))`,
        [me, them]
      );
      let iWon = 0, iLost = 0;
      for (const r of jointRows) {
        const creatorWon = r.status === 'won';
        if ((r.i_created && creatorWon) || (!r.i_created && !creatorWon)) iWon++;
        else iLost++;
      }

      // Total stakes ever moved between us (sum of stake on shared bets)
      const { rows: stakeRows } = await db.query(
        `SELECT COALESCE(SUM(stake), 0)::int AS total
         FROM bets
         WHERE (creator = $1 AND opponent = $2) OR (creator = $2 AND opponent = $1)`,
        [me, them]
      );

      // Best bet between us — highest single-win delta on either side
      const { rows: bestRows } = await db.query(
        `SELECT title, stake, potential_win, creator, status
         FROM bets
         WHERE status = 'won'
           AND ((creator = $1 AND opponent = $2) OR (creator = $2 AND opponent = $1))
         ORDER BY (potential_win - stake) DESC
         LIMIT 1`,
        [me, them]
      );
      const trophyPoints = unlocked.reduce((s, u) => s + (u.level || 0), 0);

      // Cross-app totals used by the "scout report" comparison card —
      // wins/losses across every group the friend is in, plus their
      // global credit balance. Skipped entirely when the target's
      // privacy_stats setting blocks the current viewer.
      let friendWins = 0, friendLosses = 0, friendCredits = 100;
      if (seeStats) {
        const { rows: winLossRows } = await db.query(
          `SELECT status, COUNT(*)::int AS n
             FROM bets
            WHERE creator = $1 AND status IN ('won','lost')
            GROUP BY status`,
          [them]
        );
        friendWins   = winLossRows.find(r => r.status === 'won')?.n  || 0;
        friendLosses = winLossRows.find(r => r.status === 'lost')?.n || 0;
        const { rows: credRows } = await db.query(
          'SELECT amount FROM credits WHERE "user"=$1', [them]
        );
        friendCredits = Math.round(credRows[0]?.amount ?? 100);
      }

      // Groups list — privacy_groups gates the "all my groups" view; the
      // shared-only view always slips through because the viewer already
      // sees those rooms in their own list. So if the viewer is a friend
      // AND privacy_groups allows, we return every group; otherwise we
      // narrow to the intersection with the viewer's groups.
      const showAllGroups = isFriend && seeGroups;
      const groupsSql = showAllGroups
        ? `SELECT r.id, r.name, r.emoji
             FROM rooms r
             JOIN user_groups ug ON ug.group_id = r.id
            WHERE ug.user_id = $1
            ORDER BY r.name`
        : `SELECT r.id, r.name, r.emoji
             FROM rooms r
             WHERE r.id IN (
               SELECT my.group_id
                 FROM user_groups my
                 JOIN user_groups his ON his.group_id = my.group_id
                WHERE my.user_id = $2 AND his.user_id = $1
             )
             ORDER BY r.name`;
      const { rows: groupsRows } = await db.query(groupsSql, showAllGroups ? [them] : [them, me]);

      res.json({
        profile,
        catalog: CATALOG,
        unlocked,
        progress,
        trophyPoints,
        isFriend,
        groups: groupsRows,
        // Privacy flags echoed back so the client can render "Profilo
        // riservato" placeholders where a section was withheld.
        visibility: { trophies: seeTrophies, stats: seeStats, groups: seeGroups },
        stats: seeStats ? {
          wins:    friendWins,
          losses:  friendLosses,
          credits: friendCredits,
        } : null,
        vsMe: {
          iWon, iLost,
          total: iWon + iLost,
          totalStake: stakeRows[0]?.total || 0,
          bestBet: bestRows[0] || null,
        },
      });
    } catch (e) {
      console.error('[friends:profile]', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  return router;
}

module.exports = makeRouter;
