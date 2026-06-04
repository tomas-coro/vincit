'use strict';
const jwt    = require('jsonwebtoken');
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required');
const SECRET = process.env.JWT_SECRET;
const db     = require('../db.js');

function verify(token) {
  const p = jwt.verify(token, SECRET);
  return { userId: p.userId, roomId: p.roomId ?? null, userName: p.name };
}

async function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.slice(7);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    Object.assign(req, verify(token));
    // Lockout account eliminati: il JWT può sopravvivere alla cancellazione
    // (TTL 30g), quindi il gate va fatto sul DB, non solo sulla firma.
    const { rows } = await db.query('SELECT deleted_at FROM users WHERE id=$1', [req.userId]);
    if (!rows[0] || rows[0].deleted_at) return res.status(401).json({ error: 'Unauthorized' });
    next();
  } catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}

// SSE variant: EventSource cannot send custom headers — reads token from ?token= query param
function authMiddlewareSSE(req, res, next) {
  try {
    const token = req.headers.authorization?.slice(7) || req.query.token;
    if (!token) return res.status(401).end();
    Object.assign(req, verify(token));
    next();
  } catch { res.status(401).end(); }
}

// Verify caller is owner of groupId (defaults to req.activeRoomId/req.roomId)
async function requireOwner(req, res, groupId) {
  const gid = groupId ?? req.activeRoomId ?? req.roomId;
  const { rows } = await db.query(
    "SELECT 1 FROM user_groups WHERE group_id=$1 AND user_id=$2 AND role='owner'",
    [gid, req.userId]
  );
  if (!rows.length) { res.status(403).json({ error: 'Owner only' }); return false; }
  return true;
}

const PERMISSIONS = [
  'manage_credits',    // adjust other members' credits
  'manage_members',    // kick / promote / regenerate invite code
  'moderate_bets',     // edit or cancel other members' bets
  'manage_categories', // create / delete custom categories
  'reset_season',      // wipe bets + reset credits
  'manage_settings',   // rename group / change threshold / emoji
];

// Allow if caller is owner OR co-admin with the requested permission flag.
async function requirePermission(req, res, perm, groupId) {
  const gid = groupId ?? req.activeRoomId ?? req.roomId;
  const { rows } = await db.query(
    'SELECT role, permissions FROM user_groups WHERE group_id=$1 AND user_id=$2',
    [gid, req.userId]
  );
  if (!rows.length) { res.status(403).json({ error: 'Not a member' }); return false; }
  const { role, permissions } = rows[0];
  if (role === 'owner') return true;
  if (role === 'co-admin' && permissions && permissions[perm] === true) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

// Resolves the active group from ?groupId= query param and validates membership.
// Sets req.activeRoomId. Falls back to req.roomId if no ?groupId= provided.
async function resolveActiveRoom(req, res, next) {
  const groupId = req.query.groupId || req.roomId;
  if (!groupId) return res.status(400).json({ error: 'groupId required' });
  try {
    const { rows } = await db.query(
      'SELECT 1 FROM user_groups WHERE group_id=$1 AND user_id=$2',
      [groupId, req.userId]
    );
    if (!rows.length) return res.status(403).json({ error: 'Not a member of that group' });
    req.activeRoomId = groupId;
    next();
  } catch (e) {
    console.error('[resolveActiveRoom]', e);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { authMiddleware, authMiddlewareSSE, requireOwner, requirePermission, resolveActiveRoom, PERMISSIONS };
