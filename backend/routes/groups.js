'use strict';
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const db      = require('../db.js');

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
    const { rows } = await db.query(
      `SELECT r.id, r.name, r.emoji, r.invite_code, r.max_size, ug.role,
              (SELECT COUNT(*) FROM user_groups WHERE group_id = r.id) AS member_count
       FROM rooms r
       JOIN user_groups ug ON ug.group_id = r.id
       WHERE ug.user_id = $1
       ORDER BY ug.joined_at`,
      [req.userId]
    );
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
      `SELECT u.id, u.name, u.avatar, u.color_key, ug.role
       FROM users u JOIN user_groups ug ON ug.user_id = u.id
       WHERE ug.group_id = $1`,
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
    });
    res.json({ id: groupId, name: name.trim() || 'My Group', emoji: emoji || '🎲', invite_code: code, role: 'owner', member_count: '1' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server_error' }); }
});

// PATCH /api/groups/:id — rename group (owner only)
router.patch('/:id', async (req, res) => {
  const { name, emoji } = req.body;
  try {
    const { rows: [mem] } = await db.query(
      'SELECT role FROM user_groups WHERE group_id=$1 AND user_id=$2',
      [req.params.id, req.userId]
    );
    if (!mem) return res.status(403).json({ error: 'not_member' });
    if (mem.role !== 'owner') return res.status(403).json({ error: 'not_owner' });
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
    res.json({ id: room.id, name: room.name, emoji: room.emoji, invite_code: room.invite_code, role: 'member', member_count: String(parseInt(count) + 1) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server_error' }); }
});

module.exports = router;
