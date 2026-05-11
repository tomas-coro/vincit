'use strict';
const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const db      = require('../db.js');
const { uploadDataUrl, destroyByPublicId, isConfigured: cldReady } = require('../cloudinary.js');

const router  = express.Router();
const SECRET  = process.env.JWT_SECRET || 'dev-secret';
const ROUNDS  = 10;
const AVATAR_FOLDER = 'betcouple/avatars';
// 31^6 ≈ 887M combinations; no ambiguous chars (0,O,1,I,L)
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function makeToken(userId, name, roomId) {
  return jwt.sign({ userId, name, roomId: roomId ?? null }, SECRET, { expiresIn: '30d' });
}

function makeInviteCode() {
  return Array.from(crypto.randomBytes(6), b => CHARSET[b % CHARSET.length]).join('');
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, avatar, color_key } = req.body;
    if (!email?.includes('@') || !password || password.length < 8 || !name?.trim())
      return res.status(400).json({ error: 'Invalid fields. Password min 8 chars.' });

    const exists = await db.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

    const userId     = `u_${crypto.randomUUID()}`;
    const roomId     = `r_${crypto.randomUUID()}`;
    const inviteCode = makeInviteCode();
    const hash       = await bcrypt.hash(password, ROUNDS);
    const now        = Date.now();

    await db.transaction(async (client) => {
      await client.query(
        "INSERT INTO rooms(id, invite_code, created_at, name, emoji, max_size) VALUES($1,$2,$3,'My Group','🎲',10)",
        [roomId, inviteCode, now]
      );
      await client.query(
        'INSERT INTO users(id,email,name,avatar,color_key,password_hash,room_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [userId, email.toLowerCase(), name.trim(), avatar||'😊', color_key||'blue', hash, roomId, now]
      );
      await client.query(
        'INSERT INTO credits("user",amount) VALUES($1,100) ON CONFLICT("user") DO NOTHING',
        [userId]
      );
      await client.query(
        'INSERT INTO user_groups(group_id,user_id,role,joined_at) VALUES($1,$2,$3,$4)',
        [roomId, userId, 'owner', now]
      );
    });

    const token = makeToken(userId, name.trim(), roomId);
    res.json({ token, user: { id:userId, name:name.trim(), avatar:avatar||'😊', avatar_url:null, color_key:color_key||'blue', room_id:roomId, invite_code:inviteCode, paired:false } });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await db.query('SELECT * FROM users WHERE email=$1', [email?.toLowerCase()]);
    const u = rows[0];
    // Same error for wrong email or wrong password — prevents account enumeration
    if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
      return res.status(401).json({ error: 'Invalid email or password' });

    let inviteCode = null;
    let paired     = false;
    if (u.room_id) {
      const [roomRes, partnerRes] = await Promise.all([
        db.query('SELECT invite_code, paired_at FROM rooms WHERE id=$1', [u.room_id]),
        db.query('SELECT id FROM users WHERE room_id=$1 AND id!=$2', [u.room_id, u.id]),
      ]);
      inviteCode = roomRes.rows[0]?.paired_at ? null : roomRes.rows[0]?.invite_code;
      paired     = partnerRes.rows.length > 0;
    }

    const token = makeToken(u.id, u.name, u.room_id);
    res.json({ token, user: { id:u.id, name:u.name, avatar:u.avatar, avatar_url:u.avatar_url, color_key:u.color_key, room_id:u.room_id, invite_code:inviteCode, paired } });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/auth/join — enter partner's invite code
router.post('/join', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const { userId, roomId: myRoomId } = jwt.verify(authHeader.slice(7), SECRET);

    const code = req.body.code?.toUpperCase().trim();
    if (!code) return res.status(400).json({ error: 'Invite code required' });

    const { rows: rooms } = await db.query('SELECT * FROM rooms WHERE invite_code=$1', [code]);
    const target = rooms[0];
    if (!target)                       return res.status(404).json({ error: 'Invalid invite code' });
    if (target.id === myRoomId)        return res.status(400).json({ error: 'own_room' });
    if (target.paired_at)              return res.status(409).json({ error: 'already_paired' });

    const { rows: partners } = await db.query('SELECT id FROM users WHERE room_id=$1', [target.id]);
    if (!partners.length)              return res.status(404).json({ error: 'Invalid invite code' });
    if (partners[0].id === userId)     return res.status(400).json({ error: 'own_room' });

    await db.transaction(async (client) => {
      await client.query('UPDATE users SET room_id=$1 WHERE id=$2', [target.id, userId]);
      await client.query('UPDATE rooms SET paired_at=$1 WHERE id=$2', [Date.now(), target.id]);
      if (myRoomId) await client.query('DELETE FROM rooms WHERE id=$1 AND paired_at IS NULL', [myRoomId]);
      await client.query('INSERT INTO credits("user",amount) VALUES($1,100) ON CONFLICT("user") DO NOTHING', [userId]);
    });

    const { rows: [updated] } = await db.query('SELECT * FROM users WHERE id=$1', [userId]);
    const token = makeToken(userId, updated.name, target.id);
    res.json({ token, user: { id:userId, name:updated.name, avatar:updated.avatar, color_key:updated.color_key, room_id:target.id, invite_code:null, paired:true } });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me — validate token + return fresh user data
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const { userId } = jwt.verify(authHeader.slice(7), SECRET);
    const { rows } = await db.query('SELECT * FROM users WHERE id=$1', [userId]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    const u = rows[0];
    let inviteCode = null, paired = false;
    if (u.room_id) {
      const [roomRes, partnerRes] = await Promise.all([
        db.query('SELECT invite_code, paired_at FROM rooms WHERE id=$1', [u.room_id]),
        db.query('SELECT id FROM users WHERE room_id=$1 AND id!=$2', [u.room_id, u.id]),
      ]);
      inviteCode = roomRes.rows[0]?.paired_at ? null : roomRes.rows[0]?.invite_code;
      paired     = partnerRes.rows.length > 0;
    }
    res.json({ id:u.id, name:u.name, avatar:u.avatar, avatar_url:u.avatar_url, color_key:u.color_key, room_id:u.room_id, invite_code:inviteCode, paired });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/auth/avatar — upload custom avatar image (base64 data URL)
router.post('/avatar', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const { userId } = jwt.verify(authHeader.slice(7), SECRET);
    if (!cldReady()) return res.status(503).json({ error: 'image_upload_unavailable' });

    const { dataUrl } = req.body;
    if (typeof dataUrl !== 'string' || !/^data:image\/(jpeg|png|webp|jpg);base64,/i.test(dataUrl))
      return res.status(400).json({ error: 'invalid_image' });

    // base64 size cap (after stripping prefix): ~5MB
    const approxBytes = Math.floor(dataUrl.length * 0.75);
    if (approxBytes > 5 * 1024 * 1024) return res.status(413).json({ error: 'image_too_large' });

    const result = await uploadDataUrl(dataUrl, {
      folder:    AVATAR_FOLDER,
      publicId:  userId,
      transformation: [
        { width: 512, height: 512, crop: 'fill', gravity: 'face' },
        { quality: 'auto:good', fetch_format: 'auto' },
      ],
    });

    await db.query('UPDATE users SET avatar_url=$1 WHERE id=$2', [result.secure_url, userId]);
    res.json({ avatar_url: result.secure_url });
  } catch(e) {
    console.error('avatar upload failed', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/auth/avatar — remove custom avatar, fall back to emoji
router.delete('/avatar', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const { userId } = jwt.verify(authHeader.slice(7), SECRET);
    await destroyByPublicId(AVATAR_FOLDER, userId);
    await db.query('UPDATE users SET avatar_url=NULL WHERE id=$1', [userId]);
    res.json({ ok: true });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/auth/profile
router.patch('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const { userId } = jwt.verify(authHeader.slice(7), SECRET);
    const { name, avatar, color_key } = req.body;
    await db.query(
      'UPDATE users SET name=COALESCE($1,name), avatar=COALESCE($2,avatar), color_key=COALESCE($3,color_key) WHERE id=$4',
      [name?.trim()||null, avatar||null, color_key||null, userId]
    );
    res.json({ ok: true });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
