'use strict';
const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const db      = require('../db.js');
const { uploadDataUrl, destroyByPublicId, isConfigured: cldReady } = require('../cloudinary.js');
const { send: sendMail, isConfigured: mailReady } = require('../mailer.js');
const { validatePassword } = require('../passwordPolicy.js');

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

// POST /api/auth/register — creates the user only. No auto-group: the user picks
// one (create or join via invite code) from the PairingView right after.
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, avatar, color_key } = req.body;
    if (!email?.includes('@') || !name?.trim())
      return res.status(400).json({ error: 'invalid_fields' });
    const policyErr = validatePassword(password);
    if (policyErr) return res.status(400).json({ error: policyErr });

    const exists = await db.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

    const userId = `u_${crypto.randomUUID()}`;
    const hash   = await bcrypt.hash(password, ROUNDS);
    const now    = Date.now();

    await db.transaction(async (client) => {
      await client.query(
        'INSERT INTO users(id,email,name,avatar,color_key,password_hash,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [userId, email.toLowerCase(), name.trim(), avatar||'😊', color_key||'blue', hash, now]
      );
      await client.query(
        'INSERT INTO credits("user",amount) VALUES($1,100) ON CONFLICT("user") DO NOTHING',
        [userId]
      );
    });

    const token = makeToken(userId, name.trim(), null);
    res.json({ token, user: { id:userId, name:name.trim(), avatar:avatar||'😊', avatar_url:null, color_key:color_key||'blue', room_id:null, invite_code:null, paired:false } });
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
    res.json({ token, user: { id:u.id, name:u.name, avatar:u.avatar, avatar_url:u.avatar_url, color_key:u.color_key, room_id:u.room_id, invite_code:inviteCode, paired, is_admin: u.is_admin === true } });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/auth/forgot-password — generates a single-use token, emails the
// reset link. We deliberately return the same response whether the email
// exists or not, to avoid leaking account presence.
router.post('/forgot-password', async (req, res) => {
  try {
    const email = (req.body?.email || '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return res.status(400).json({ error: 'invalid_email' });

    const { rows } = await db.query('SELECT id, name FROM users WHERE email=$1', [email]);
    const user = rows[0];

    // Silent OK if the email isn't registered (no enumeration).
    if (!user) return res.json({ ok: true });

    const token  = crypto.randomBytes(32).toString('base64url');
    const now    = Date.now();
    const expiry = now + 60 * 60 * 1000; // 1h

    await db.query(
      'INSERT INTO password_resets(token, user_id, created_at, expires_at) VALUES($1,$2,$3,$4)',
      [token, user.id, now, expiry]
    );

    const base = (process.env.APP_BASE_URL || req.headers.origin || '').replace(/\/+$/, '');
    const link = `${base}/?reset=${token}`;

    if (mailReady()) {
      try {
        await sendMail({
          to: email,
          subject: 'BetCouple · Reset password',
          text: `Ciao ${user.name},\n\nHai chiesto di reimpostare la password.\nApri questo link entro 1 ora:\n${link}\n\nSe non sei stato tu, ignora questa email.\n— BetCouple`,
          html: `<p>Ciao <b>${user.name}</b>,</p>
                 <p>Hai chiesto di reimpostare la password. Tocca il bottone qui sotto entro 1 ora:</p>
                 <p><a href="${link}" style="display:inline-block;padding:12px 22px;background:#c8973f;color:#07060f;border-radius:10px;text-decoration:none;font-weight:700;font-family:sans-serif">Reimposta password</a></p>
                 <p style="font-size:12px;color:#777">Se il bottone non funziona, copia questo indirizzo nel browser:<br><code>${link}</code></p>
                 <p style="font-size:12px;color:#777">Se non sei stato tu, ignora questa email.</p>`,
        });
        return res.json({ ok: true });
      } catch (mailErr) {
        console.error('[forgot-password] mail send failed', mailErr);
        // Fall through to fallback below.
      }
    }
    // Fallback: SMTP not configured (or send failed). Return the link to the
    // caller so the admin can hand it over manually. This is logged loudly so
    // it shows up in Render logs without surfacing tokens to other users.
    console.warn(`[forgot-password] FALLBACK LINK for ${email}: ${link}`);
    return res.json({ ok: true, fallback_link: link });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/auth/reset-password — consume a token, set the new password.
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (typeof token !== 'string' || token.length < 16)
      return res.status(400).json({ error: 'invalid_token' });
    const policyErr = validatePassword(password);
    if (policyErr) return res.status(400).json({ error: policyErr });

    const { rows } = await db.query(
      'SELECT user_id, expires_at, used_at FROM password_resets WHERE token=$1',
      [token]
    );
    const tok = rows[0];
    if (!tok)                       return res.status(404).json({ error: 'invalid_token' });
    if (tok.used_at)                return res.status(410).json({ error: 'token_used' });
    if (Date.now() > Number(tok.expires_at))
                                    return res.status(410).json({ error: 'token_expired' });

    const hash = await bcrypt.hash(password, ROUNDS);
    await db.transaction(async (client) => {
      await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, tok.user_id]);
      await client.query('UPDATE password_resets SET used_at=$1 WHERE token=$2', [Date.now(), token]);
      // Invalidate any other outstanding reset tokens for the same user.
      await client.query(
        'UPDATE password_resets SET used_at=$1 WHERE user_id=$2 AND used_at IS NULL',
        [Date.now(), tok.user_id]
      );
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
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
    res.json({ id:u.id, name:u.name, avatar:u.avatar, avatar_url:u.avatar_url, color_key:u.color_key, room_id:u.room_id, invite_code:inviteCode, paired, is_admin: u.is_admin === true });
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
    // Accept JPEG/PNG/WebP from canvas + HEIC/HEIF raw uploads from iPhone
    // (Cloudinary will transcode HEIC during the avatar upload).
    if (typeof dataUrl !== 'string' || !/^data:image\/(jpeg|jpg|png|webp|heic|heif);base64,/i.test(dataUrl))
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
