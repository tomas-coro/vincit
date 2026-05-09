'use strict';
const jwt    = require('jsonwebtoken');
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required');
const SECRET = process.env.JWT_SECRET;
const db     = require('../db.js');

function verify(token) {
  const p = jwt.verify(token, SECRET);
  return { userId: p.userId, roomId: p.roomId ?? null, userName: p.name };
}

function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.slice(7);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    Object.assign(req, verify(token));
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

// Verify caller is owner of groupId (defaults to req.roomId)
async function requireOwner(req, res, groupId) {
  const gid = groupId ?? req.roomId;
  const { rows } = await db.query(
    "SELECT 1 FROM user_groups WHERE group_id=$1 AND user_id=$2 AND role='owner'",
    [gid, req.userId]
  );
  if (!rows.length) { res.status(403).json({ error: 'Owner only' }); return false; }
  return true;
}

module.exports = { authMiddleware, authMiddlewareSSE, requireOwner };
