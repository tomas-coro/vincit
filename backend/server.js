require('dotenv').config();

// Error tracking — must initialize BEFORE any other requires that throw,
// so Sentry's auto-instrumentation can wrap them. No-op if SENTRY_DSN
// isn't set, so local dev / fresh deploys without an account still boot
// cleanly. Add SENTRY_DSN as an env var on Render (or in backend/.env)
// to start capturing.
const Sentry = require('@sentry/node');
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const { authMiddleware, authMiddlewareSSE, resolveActiveRoom } = require('./middleware/auth.js');
const authRouter = require('./routes/auth.js');
const { sendPushToUser, isPrefEnabled } = require('./routes/push.js');
const rateLimit = require('express-rate-limit');
const db = require('./db.js');

const app = express();
const PORT = process.env.PORT || 3001;
// Behind Render's load balancer req.ip would be the proxy's IP, making every
// rate limiter share ONE global bucket (10 logins/15min for ALL users = DoS).
// Trust exactly one hop so express-rate-limit keys on the real client IP.
app.set('trust proxy', 1);

function getCorsOrigin() {
  const isProd = process.env.NODE_ENV === 'production';
  const raw = (process.env.ALLOWED_ORIGIN || '').trim();
  if (!isProd) return raw || '*';
  // In production: never accept the wildcard, build a whitelist
  const list = raw.split(',').map(s => s.trim()).filter(s => s && s !== '*');
  if (process.env.RENDER_EXTERNAL_URL && !list.includes(process.env.RENDER_EXTERNAL_URL)) {
    list.push(process.env.RENDER_EXTERNAL_URL);
  }
  return list.length ? list : true; // true = reflect request origin (same-origin only)
}
app.use(cors({ origin: getCorsOrigin() }));
app.use(express.json({ limit: '8mb' })); // larger to allow base64 image uploads

const betLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

app.use('/api/bets',    betLimiter);
app.use('/api/credits', betLimiter);
app.use('/api/push',    betLimiter);

// Stricter limiter on credential endpoints: brute-force / abuse protection.
// Applied per-path (NOT on all of /api/auth) so frequent calls like
// GET /api/auth/me stay unthrottled.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' },
});
app.use('/api/auth/login',           authLimiter);
app.use('/api/auth/register',        authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password',  authLimiter);
app.use('/api/auth/resend-verification', authLimiter);
app.use('/api/auth/account',             authLimiter);

// Room-scoped SSE clients
const clients = new Map(); // roomId → Set<res>

function broadcastUpdate(roomId) {
  if (roomId) {
    clients.get(roomId)?.forEach(r => r.write('data: update\n\n'));
  } else {
    clients.forEach(set => set.forEach(r => r.write('data: update\n\n')));
  }
}

// SSE stream — token + optional groupId in query params
app.get('/api/state/stream', authMiddlewareSSE, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let groupId = req.query.groupId || req.roomId;
  if (req.query.groupId && req.query.groupId !== req.roomId) {
    // Validate membership for non-default group
    const { rows } = await db.query(
      'SELECT 1 FROM user_groups WHERE group_id=$1 AND user_id=$2',
      [req.query.groupId, req.userId]
    );
    if (!rows.length) { res.end(); return; }
    groupId = req.query.groupId;
  }

  if (!clients.has(groupId)) clients.set(groupId, new Set());
  clients.get(groupId).add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(ping);
    const set = clients.get(groupId);
    if (set) { set.delete(res); if (set.size === 0) clients.delete(groupId); }
  });
});

// Public routes (no auth)
app.use('/api/auth', authRouter);

// Health / config diagnostic — public so it can be checked from the browser
// or curl without a token. Reveals only PRESENCE of secrets, never values.
const { isConfigured: cldConfigured } = require('./cloudinary.js');
const { isConfigured: mailConfigured } = require('./mailer.js');
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    server_time: Date.now(),
    db:         !!process.env.DATABASE_URL,
    cloudinary: {
      cloud_name:  !!process.env.CLOUDINARY_CLOUD_NAME,
      api_key:     !!process.env.CLOUDINARY_API_KEY,
      api_secret:  !!process.env.CLOUDINARY_API_SECRET,
      ready:       cldConfigured(),
    },
    mailer: {
      host: !!process.env.SMTP_HOST,
      user: !!process.env.SMTP_USER,
      pass: !!process.env.SMTP_PASS,
      from: !!process.env.SMTP_FROM,
      base_url: !!process.env.APP_BASE_URL,
      ready: mailConfigured(),
    },
    admin: !!process.env.ADMIN_KEY,
    admin_email: !!process.env.ADMIN_EMAIL,
  });
});

// Protected routes
const stateRouter    = require('./routes/state.js');
const groupsRouter   = require('./routes/groups.js');
const betsRouter     = require('./routes/bets.js')(broadcastUpdate);
// profilesRouter removed — profile updates handled via /api/state
const creditsRouter  = require('./routes/credits.js')(broadcastUpdate);
const catsRouter     = require('./routes/categories.js')(broadcastUpdate);
const reactionsRouter = require('./routes/reactions.js')(broadcastUpdate);
const { router: pushRouter } = require('./routes/push.js');
const achievementsRouter = require('./routes/achievements.js');
const templatesRouter    = require('./routes/templates.js');
const friendsRouter      = require('./routes/friends.js')(broadcastUpdate);

app.use('/api/state',      authMiddleware, stateRouter);
app.use('/api/groups',     authMiddleware, groupsRouter);
app.use('/api/bets',       authMiddleware, resolveActiveRoom, betsRouter);
// app.use('/api/profiles', authMiddleware, profilesRouter); // removed
app.use('/api/credits',    authMiddleware, resolveActiveRoom, creditsRouter);
app.use('/api/categories', authMiddleware, resolveActiveRoom, catsRouter);
app.use('/api/bets',       authMiddleware, resolveActiveRoom, reactionsRouter);
// The VAPID public key is not sensitive and the client fetches it on load,
// before any auth context is guaranteed — expose it publicly so it doesn't 401.
app.get('/api/push/vapid-key', (_, res) => res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null }));
app.use('/api/push',       authMiddleware, pushRouter);
app.use('/api/achievements', authMiddleware, achievementsRouter);
app.use('/api/templates',  authMiddleware, templatesRouter);
app.use('/api/friends',    authMiddleware, friendsRouter);

// Admin diagnostics — gated on a shared secret in process.env.ADMIN_KEY,
// no JWT needed. See routes/admin.js for the route shapes.
app.use('/api/admin',      require('./routes/admin.js'));

// Sentry Express error handler — must be added AFTER all routes so it
// catches errors thrown from any of them. No-op if init() was skipped
// (no DSN), so safe to register unconditionally.
if (process.env.SENTRY_DSN && typeof Sentry.setupExpressErrorHandler === 'function') {
  Sentry.setupExpressErrorHandler(app);
}

// Unknown /api routes: JSON 404, never the SPA's index.html — a typo'd
// fetch should fail loudly, not parse HTML as JSON.
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Vincit running on http://0.0.0.0:${PORT}`);
});

setInterval(async () => {
  try {
    const now = Date.now();
    const result = await db.query(
      "UPDATE bets SET status='expired' WHERE status='active' AND expires_at IS NOT NULL AND expires_at < $1 RETURNING creator, title, room_id",
      [now]
    );
    if (result.rowCount > 0) {
      for (const b of result.rows) {
        broadcastUpdate(b.room_id);
        if (await isPrefEnabled(b.creator, 'on_expiry'))
          sendPushToUser(b.creator, { title:'Vincit ⏱', body:`"${b.title}" è scaduta — dichiara l'esito!`, url:'/' });
      }
    }
    // Pending challenges past their deadline: no credits were ever deducted
    // (that happens at accept). They go to 'rejected', NOT 'expired' — the
    // resolve endpoint accepts 'expired' and would pay out potential_win for
    // a stake that was never actually held.
    const pend = await db.query(
      "UPDATE bets SET status='rejected' WHERE status='pending' AND expires_at IS NOT NULL AND expires_at < $1 RETURNING creator, title, room_id",
      [now]
    );
    if (pend.rowCount > 0) {
      for (const b of pend.rows) {
        broadcastUpdate(b.room_id);
        if (await isPrefEnabled(b.creator, 'on_expiry'))
          sendPushToUser(b.creator, { title:'Vincit ⏱', body:`La sfida "${b.title}" è scaduta senza risposta.`, url:'/' });
      }
    }
    // Purge dei token one-time consumati o scaduti, così le tabelle non
    // crescono per sempre. Gli usati restano 24h per diagnosi.
    const dayAgo = now - 24 * 60 * 60 * 1000;
    await db.query(
      'DELETE FROM password_resets WHERE expires_at < $1 OR (used_at IS NOT NULL AND used_at < $2)',
      [now, dayAgo]
    );
    await db.query(
      'DELETE FROM email_verifications WHERE expires_at < $1 OR (used_at IS NOT NULL AND used_at < $2)',
      [now, dayAgo]
    );
  } catch (err) {
    console.error('Expiry job error:', err);
  }
}, 5 * 60 * 1000);
