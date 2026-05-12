require('dotenv').config();
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
app.use('/api/push',       authMiddleware, pushRouter);
app.use('/api/achievements', authMiddleware, achievementsRouter);
app.use('/api/templates',  authMiddleware, templatesRouter);
app.use('/api/friends',    authMiddleware, friendsRouter);

// Admin diagnostics — gated on a shared secret in process.env.ADMIN_KEY,
// no JWT needed. See routes/admin.js for the route shapes.
app.use('/api/admin',      require('./routes/admin.js'));

app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`BetCouple running on http://0.0.0.0:${PORT}`);
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
          sendPushToUser(b.creator, { title:'BetCouple ⏱', body:`"${b.title}" è scaduta — dichiara l'esito!`, url:'/' });
      }
    }
  } catch (err) {
    console.error('Expiry job error:', err);
  }
}, 5 * 60 * 1000);
