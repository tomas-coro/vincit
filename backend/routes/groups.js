'use strict';
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const db      = require('../db.js');
const { requireOwner, requirePermission, PERMISSIONS } = require('../middleware/auth.js');
const { refreshAchievements } = require('../achievements.js');

const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genCode() {
  return Array.from(crypto.randomBytes(6), b => CHARSET[b % CHARSET.length]).join('');
}

async function uniqueCode() {
  for (let i = 0; i < 10; i++) {
    const c = genCode();
    const { rows } = await db.query('SELECT 1 FROM rooms WHERE invite_code=$1', [c]);
    if (!rows.length) return c;
  }
  throw new Error('code_gen_failed');
}

// GET /api/groups — list groups the user belongs to
router.get('/', async (req, res) => {
  try {
    const fetchGroups = () => db.query(
      `SELECT r.id, r.name, r.emoji, r.invite_code, r.max_size,
              r.acceptance_threshold, r.max_stake, ug.role, ug.permissions,
              (SELECT COUNT(*) FROM user_groups WHERE group_id = r.id) AS member_count
       FROM rooms r
       JOIN user_groups ug ON ug.group_id = r.id AND ug.user_id = $1
       ORDER BY ug.joined_at`,
      [req.userId]
    );

    let { rows } = await fetchGroups();

    // Self-healing: user has room_id in users table but no user_groups entry
    // (registered before user_groups migration). Auto-insert now.
    if (rows.length === 0) {
      const { rows: userRows } = await db.query(
        'SELECT room_id FROM users WHERE id=$1 AND room_id IS NOT NULL',
        [req.userId]
      );
      const roomId = userRows[0]?.room_id;
      if (roomId) {
        const { rows: roomCreator } = await db.query(
          'SELECT id FROM users WHERE room_id=$1 ORDER BY created_at ASC LIMIT 1',
          [roomId]
        );
        const role = roomCreator[0]?.id === req.userId ? 'owner' : 'member';

        try {
          await db.query(
            'INSERT INTO user_groups(group_id,user_id,role,joined_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
            [roomId, req.userId, role, Date.now()]
          );
          const retried = await fetchGroups();
          rows = retried.rows;
        } catch (migErr) {
          console.warn('[groups] Auto-migration failed for user', req.userId, migErr.message);
        }
      }
    }

    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'server_error' }); }
});

// GET /api/groups/:id/members
router.get('/:id/members', async (req, res) => {
  try {
    const { rows: [mem] } = await db.query(
      'SELECT 1 FROM user_groups WHERE group_id=$1 AND user_id=$2',
      [req.params.id, req.userId]
    );
    if (!mem) return res.status(403).json({ error: 'not_member' });
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.avatar, u.avatar_url, u.color_key, ug.role, ug.permissions
       FROM users u JOIN user_groups ug ON ug.user_id = u.id
       WHERE ug.group_id = $1
       ORDER BY CASE ug.role WHEN 'owner' THEN 0 WHEN 'co-admin' THEN 1 ELSE 2 END, ug.joined_at`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'server_error' }); }
});

// POST /api/groups — create a new group
router.post('/', async (req, res) => {
  const { name = 'My Group', emoji = '🎲' } = req.body;
  try {
    const code    = await uniqueCode();
    const groupId = `r_${crypto.randomUUID()}`;
    const now     = Date.now();
    await db.transaction(async client => {
      await client.query(
        'INSERT INTO rooms (id, invite_code, created_at, name, emoji, max_size) VALUES ($1,$2,$3,$4,$5,$6)',
        [groupId, code, now, name.trim() || 'My Group', emoji || '🎲', 10]
      );
      await client.query(
        'INSERT INTO user_groups (group_id, user_id, role, joined_at) VALUES ($1,$2,$3,$4)',
        [groupId, req.userId, 'owner', now]
      );
      await client.query(
        'UPDATE users SET room_id=COALESCE(room_id,$1) WHERE id=$2',
        [groupId, req.userId]
      );
    });
    res.json({ id: groupId, name: name.trim() || 'My Group', emoji: emoji || '🎲', invite_code: code, role: 'owner', member_count: '1' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server_error' }); }
});

// PATCH /api/groups/:id — rename group (owner or co-admin with manage_settings)
router.patch('/:id', async (req, res) => {
  const { name, emoji } = req.body;
  try {
    if (!(await requirePermission(req, res, 'manage_settings', req.params.id))) return;
    await db.query(
      'UPDATE rooms SET name=COALESCE($1,name), emoji=COALESCE($2,emoji) WHERE id=$3',
      [name?.trim() || null, emoji || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server_error' }); }
});

// POST /api/groups/join — join a group by invite code
router.post('/join', async (req, res) => {
  const code = req.body.code?.toUpperCase().trim();
  if (!code) return res.status(400).json({ error: 'missing_code' });
  try {
    const { rows: [room] } = await db.query('SELECT * FROM rooms WHERE invite_code=$1', [code]);
    if (!room) return res.status(404).json({ error: 'invalid_code' });

    const { rows: [existing] } = await db.query(
      'SELECT 1 FROM user_groups WHERE group_id=$1 AND user_id=$2',
      [room.id, req.userId]
    );
    if (existing) return res.status(409).json({ error: 'already_member' });

    const { rows: [{ count }] } = await db.query(
      'SELECT COUNT(*) FROM user_groups WHERE group_id=$1', [room.id]
    );
    if (parseInt(count) >= (room.max_size || 10))
      return res.status(409).json({ error: 'group_full' });

    await db.query(
      'INSERT INTO user_groups (group_id, user_id, role, joined_at) VALUES ($1,$2,$3,$4)',
      [room.id, req.userId, 'member', Date.now()]
    );
    // Milestones: first_join + multi_group for the joiner, recruiter for every owner of this group
    refreshAchievements(req.userId);
    const { rows: owners } = await db.query(
      `SELECT user_id FROM user_groups WHERE group_id=$1 AND role='owner'`, [room.id]
    );
    for (const o of owners) refreshAchievements(o.user_id);
    res.json({ id: room.id, name: room.name, emoji: room.emoji, invite_code: room.invite_code, role: 'member', member_count: String(parseInt(count) + 1) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server_error' }); }
});

// DELETE /api/groups/:id/members/:userId — kick a member (manage_members)
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    if (!(await requirePermission(req, res, 'manage_members', req.params.id))) return;
    if (req.params.userId === req.userId)
      return res.status(400).json({ error: 'Cannot kick yourself' });
    // Co-admins cannot kick the owner
    const { rows: [target] } = await db.query(
      'SELECT role FROM user_groups WHERE group_id=$1 AND user_id=$2',
      [req.params.id, req.params.userId]
    );
    if (target?.role === 'owner') return res.status(403).json({ error: 'Cannot kick owner' });
    await db.query(
      'DELETE FROM user_groups WHERE group_id=$1 AND user_id=$2',
      [req.params.id, req.params.userId]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/groups/:id/regenerate-code — new invite code (manage_members)
router.post('/:id/regenerate-code', async (req, res) => {
  try {
    if (!(await requirePermission(req, res, 'manage_members', req.params.id))) return;
    const newCode = await uniqueCode();
    await db.query('UPDATE rooms SET invite_code=$1 WHERE id=$2', [newCode, req.params.id]);
    res.json({ invite_code: newCode });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/groups/:id/members/:userId/role — owner only: set role to member/co-admin
router.patch('/:id/members/:userId/role', async (req, res) => {
  try {
    if (!(await requireOwner(req, res, req.params.id))) return;
    const { role } = req.body;
    if (!['member', 'co-admin'].includes(role))
      return res.status(400).json({ error: 'Invalid role (member|co-admin)' });
    if (req.params.userId === req.userId)
      return res.status(400).json({ error: 'Owner cannot change own role here' });
    await db.query(
      "UPDATE user_groups SET role=$1 WHERE group_id=$2 AND user_id=$3 AND role!='owner'",
      [role, req.params.id, req.params.userId]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/groups/:id/members/:userId/permissions — owner only: set co-admin flags
router.patch('/:id/members/:userId/permissions', async (req, res) => {
  try {
    if (!(await requireOwner(req, res, req.params.id))) return;
    const incoming = req.body?.permissions ?? {};
    const sanitized = {};
    for (const p of PERMISSIONS) sanitized[p] = incoming[p] === true;
    await db.query(
      "UPDATE user_groups SET permissions=$1 WHERE group_id=$2 AND user_id=$3 AND role='co-admin'",
      [JSON.stringify(sanitized), req.params.id, req.params.userId]
    );
    res.json({ ok: true, permissions: sanitized });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/groups/:id/members/:userId/promote — promote to owner (owner only)
router.patch('/:id/members/:userId/promote', async (req, res) => {
  try {
    if (!(await requireOwner(req, res, req.params.id))) return;
    await db.transaction(async client => {
      await client.query(
        "UPDATE user_groups SET role='owner' WHERE group_id=$1 AND user_id=$2",
        [req.params.id, req.params.userId]
      );
      await client.query(
        "UPDATE user_groups SET role='member' WHERE group_id=$1 AND user_id=$2",
        [req.params.id, req.userId]
      );
    });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/groups/:id/settings — update group settings (manage_settings)
router.patch('/:id/settings', async (req, res) => {
  try {
    if (!(await requirePermission(req, res, 'manage_settings', req.params.id))) return;
    const { acceptance_threshold, max_stake } = req.body;
    await db.query(
      'UPDATE rooms SET acceptance_threshold=COALESCE($1,acceptance_threshold), max_stake=COALESCE($2,max_stake) WHERE id=$3',
      [acceptance_threshold ?? null, max_stake ?? null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/groups/:id/leave — leave a group
router.delete('/:id/leave', async (req, res) => {
  try {
    const { rows: members } = await db.query(
      'SELECT user_id, role FROM user_groups WHERE group_id=$1', [req.params.id]
    );
    const me = members.find(m => m.user_id === req.userId);
    if (!me) return res.status(404).json({ error: 'Not a member' });

    const owners = members.filter(m => m.role === 'owner');
    if (me.role === 'owner' && owners.length === 1 && members.length > 1)
      return res.status(400).json({ error: 'Transfer ownership before leaving' });

    await db.transaction(async client => {
      await client.query(
        'DELETE FROM user_groups WHERE group_id=$1 AND user_id=$2',
        [req.params.id, req.userId]
      );
      await client.query(
        `UPDATE users SET room_id=(
           SELECT group_id FROM user_groups WHERE user_id=$1 ORDER BY joined_at LIMIT 1
         ) WHERE id=$1 AND room_id=$2`,
        [req.userId, req.params.id]
      );
      if (members.length === 1) {
        await client.query(
          'DELETE FROM reactions WHERE bet_id IN (SELECT id FROM bets WHERE room_id=$1)',
          [req.params.id]
        );
        await client.query(
          'DELETE FROM counter_bets WHERE bet_id IN (SELECT id FROM bets WHERE room_id=$1)',
          [req.params.id]
        );
        await client.query('DELETE FROM bets WHERE room_id=$1',         [req.params.id]);
        await client.query('DELETE FROM categories WHERE room_id=$1',   [req.params.id]);
        await client.query('DELETE FROM rooms WHERE id=$1',             [req.params.id]);
      }
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/groups/:id — delete group (owner only)
router.delete('/:id', async (req, res) => {
  try {
    if (!(await requireOwner(req, res, req.params.id))) return;

    await db.transaction(async client => {
      await client.query(
        'DELETE FROM reactions WHERE bet_id IN (SELECT id FROM bets WHERE room_id=$1)',
        [req.params.id]
      );
      await client.query(
        'DELETE FROM counter_bets WHERE bet_id IN (SELECT id FROM bets WHERE room_id=$1)',
        [req.params.id]
      );
      await client.query('DELETE FROM bets WHERE room_id=$1',        [req.params.id]);
      await client.query('DELETE FROM categories WHERE room_id=$1',  [req.params.id]);
      await client.query('DELETE FROM user_groups WHERE group_id=$1', [req.params.id]);
      await client.query('DELETE FROM rooms WHERE id=$1',            [req.params.id]);
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
