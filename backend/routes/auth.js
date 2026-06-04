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
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required');
const SECRET  = process.env.JWT_SECRET;
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

const VERIFY_TTL = 48 * 60 * 60 * 1000; // 48h

// Fix 3 — helper per l'escape HTML: previene XSS nei nomi interpolati nelle mail.
const escHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// Fix 1 — UPDATE + INSERT in un'unica transazione: evita la race condition
// in cui due richieste concorrenti emettono entrambe un token valido.
async function createVerificationToken(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await db.transaction(async (client) => {
    // Un solo token vivo per utente: invalida i precedenti, poi emetti.
    await client.query(
      'UPDATE email_verifications SET used_at=$1 WHERE user_id=$2 AND used_at IS NULL',
      [now, userId]
    );
    await client.query(
      'INSERT INTO email_verifications(token, user_id, created_at, expires_at) VALUES($1,$2,$3,$4)',
      [token, userId, now, now + VERIFY_TTL]
    );
  });
  return token;
}

async function sendVerificationEmail({ id, name, email }) {
  // Fix 2 — mai derivare il base URL da header del client: un Origin forgiato
  // finirebbe nel link della mail (furto del token di verifica).
  const base = (process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('APP_BASE_URL/RENDER_EXTERNAL_URL non configurati: mail di verifica non inviata');

  // Fix 4 — validazione strict dell'indirizzo prima dell'invio per prevenire
  // header/multi-recipient injection (riusa lo stesso pattern di /forgot-password).
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('indirizzo email non valido: mail di verifica non inviata');

  const token = await createVerificationToken(id);
  const link = `${base}/api/auth/verify-email?token=${token}`;
  await sendMail({
    to: email,
    subject: 'Vincit · Verifica la tua email',
    text: `Ciao ${name},\n\nConferma la tua email aprendo questo link entro 48 ore:\n${link}\n\nSe non ti sei registrato su Vincit, ignora questa email.\n— Vincit`,
    html: `<p>Ciao <b>${escHtml(name)}</b>,</p>
           <p>Conferma la tua email toccando il bottone qui sotto entro 48 ore:</p>
           <p><a href="${link}" style="display:inline-block;padding:12px 22px;background:#c8973f;color:#07060f;border-radius:10px;text-decoration:none;font-weight:700;font-family:sans-serif">Verifica email</a></p>
           <p style="font-size:12px;color:#777">Se il bottone non funziona, copia questo indirizzo nel browser:<br><code>${link}</code></p>
           <p style="font-size:12px;color:#777">Se non ti sei registrato su Vincit, ignora questa email.</p>`,
  });
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

    const exists = await db.query('SELECT id FROM users WHERE LOWER(email)=$1', [email.toLowerCase()]);
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

    if (mailReady()) {
      // Fire-and-forget: la registrazione non deve fallire né rallentare
      // se l'SMTP è giù — l'utente potrà ri-inviare dal banner in-app.
      sendVerificationEmail({ id: userId, name: name.trim(), email: email.toLowerCase() })
        .catch(err => console.error('[register] verification mail failed', err));
    }

    const token = makeToken(userId, name.trim(), null);
    res.json({ token, user: { id:userId, name:name.trim(), avatar:avatar||'😊', avatar_url:null, color_key:color_key||'blue', room_id:null, invite_code:null, paired:false, email_verified:false } });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await db.query('SELECT * FROM users WHERE LOWER(email)=$1', [email?.toLowerCase()]);
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
    res.json({ token, user: { id:u.id, name:u.name, avatar:u.avatar, avatar_url:u.avatar_url, color_key:u.color_key, room_id:u.room_id, invite_code:inviteCode, paired, is_admin: u.is_admin === true, fresh_reset_at: u.fresh_reset_at == null ? null : Number(u.fresh_reset_at) } });
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

    const { rows } = await db.query('SELECT id, name FROM users WHERE LOWER(email)=$1', [email]);
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
          subject: 'Vincit · Reset password',
          text: `Ciao ${user.name},\n\nHai chiesto di reimpostare la password.\nApri questo link entro 1 ora:\n${link}\n\nSe non sei stato tu, ignora questa email.\n— Vincit`,
          html: `<p>Ciao <b>${escHtml(user.name)}</b>,</p>
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
    // Fallback: SMTP not configured (or send failed). NEVER return the link
    // to the caller — anyone knowing a victim's email could hijack the
    // account. Log it loudly instead, so the admin can hand it over manually
    // from the Render logs. The response stays uniform with the success path.
    console.warn(`[forgot-password] FALLBACK LINK for ${email}: ${link}`);
    return res.json({ ok: true });
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

// GET /api/auth/verify-email?token= — consuma il token e marca l'email
// verificata. Risponde con una mini-pagina HTML (il link arriva via mail,
// quindi si apre nel browser, non nella SPA).
function verifyResultPage(ok, title, message) {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vincit · ${title}</title></head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#07060f;font-family:sans-serif">
<div style="text-align:center;padding:32px;max-width:420px">
<div style="font-size:48px;margin-bottom:16px">${ok ? '✅' : '⚠️'}</div>
<h1 style="color:#e8e4f0;font-size:22px;margin:0 0 10px">${title}</h1>
<p style="color:#9a93ad;font-size:14px;line-height:1.5;margin:0 0 24px">${message}</p>
<a href="/" style="display:inline-block;padding:12px 22px;background:#c8973f;color:#07060f;border-radius:10px;text-decoration:none;font-weight:700">Torna a Vincit</a>
</div></body></html>`;
}

router.get('/verify-email', async (req, res) => {
  try {
    const token = String(req.query.token || '');
    if (token.length < 16)
      return res.status(400).send(verifyResultPage(false, 'Link non valido', 'Il link è incompleto. Richiedine uno nuovo dal banner nel tuo profilo Vincit.'));
    const { rows } = await db.query(
      'SELECT user_id, expires_at, used_at FROM email_verifications WHERE token=$1',
      [token]
    );
    const tok = rows[0];
    if (!tok || tok.used_at || Date.now() > Number(tok.expires_at))
      return res.status(410).send(verifyResultPage(false, 'Link scaduto', 'Questo link è scaduto o già usato. Richiedine uno nuovo dal banner nel tuo profilo Vincit.'));
    const now = Date.now();
    await db.transaction(async (client) => {
      await client.query('UPDATE users SET email_verified_at=$1 WHERE id=$2 AND email_verified_at IS NULL', [now, tok.user_id]);
      await client.query('UPDATE email_verifications SET used_at=$1 WHERE token=$2', [now, token]);
    });
    res.send(verifyResultPage(true, 'Email verificata', 'Il tuo account è confermato. Puoi tornare all\'app.'));
  } catch (e) {
    console.error('[verify-email]', e);
    res.status(500).send(verifyResultPage(false, 'Errore', 'Qualcosa è andato storto. Riprova più tardi.'));
  }
});

// POST /api/auth/resend-verification — autenticata; no-op se già verificata.
router.post('/resend-verification', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const { userId } = jwt.verify(authHeader.slice(7), SECRET);
    const { rows } = await db.query(
      'SELECT id, name, email, email_verified_at, deleted_at FROM users WHERE id=$1',
      [userId]
    );
    const u = rows[0];
    if (!u || u.deleted_at) return res.status(401).json({ error: 'Unauthorized' });
    if (u.email_verified_at) return res.json({ ok: true, already_verified: true });
    if (!mailReady()) return res.status(503).json({ error: 'mail_unavailable' });
    await sendVerificationEmail(u);
    res.json({ ok: true });
  } catch (e) {
    // Fix 5 — JWT malformato o scaduto → 401, non 500.
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') return res.status(401).json({ error: 'Unauthorized' });
    console.error('[resend-verification]', e);
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
    res.json({
      id:u.id, name:u.name, avatar:u.avatar, avatar_url:u.avatar_url, color_key:u.color_key,
      room_id:u.room_id, invite_code:inviteCode, paired,
      is_admin: u.is_admin === true,
      fresh_reset_at: u.fresh_reset_at == null ? null : Number(u.fresh_reset_at),
      privacy: {
        trophies: u.privacy_trophies || 'public',
        stats:    u.privacy_stats    || 'public',
        groups:   u.privacy_groups   || 'public',
      },
    });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// GET/POST /api/auth/privacy — read or update the caller's privacy
// settings. Both endpoints return the current settings so the client
// can sync without an extra round-trip.
const PRIVACY_VALUES = new Set(['public', 'friends', 'private']);
router.get('/privacy', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const { userId } = jwt.verify(authHeader.slice(7), SECRET);
    const { rows } = await db.query(
      'SELECT privacy_trophies, privacy_stats, privacy_groups FROM users WHERE id=$1',
      [userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({
      trophies: rows[0].privacy_trophies || 'public',
      stats:    rows[0].privacy_stats    || 'public',
      groups:   rows[0].privacy_groups   || 'public',
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/privacy', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const { userId } = jwt.verify(authHeader.slice(7), SECRET);
    const incoming = req.body || {};
    // Validate any provided fields; reject unknown values to avoid
    // accidentally widening visibility because of a typo.
    const updates = {};
    for (const key of ['trophies', 'stats', 'groups']) {
      const v = incoming[key];
      if (v == null) continue;
      if (!PRIVACY_VALUES.has(v)) return res.status(400).json({ error: 'invalid_value' });
      updates[key] = v;
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'no_fields' });
    await db.query(
      `UPDATE users SET
         privacy_trophies = COALESCE($1, privacy_trophies),
         privacy_stats    = COALESCE($2, privacy_stats),
         privacy_groups   = COALESCE($3, privacy_groups)
       WHERE id=$4`,
      [updates.trophies ?? null, updates.stats ?? null, updates.groups ?? null, userId]
    );
    const { rows } = await db.query(
      'SELECT privacy_trophies, privacy_stats, privacy_groups FROM users WHERE id=$1',
      [userId]
    );
    res.json({
      trophies: rows[0]?.privacy_trophies || 'public',
      stats:    rows[0]?.privacy_stats    || 'public',
      groups:   rows[0]?.privacy_groups   || 'public',
    });
  } catch (e) { console.error('[privacy:set]', e); res.status(500).json({ error: 'Server error' }); }
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
