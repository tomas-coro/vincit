'use strict';
const express = require('express');
const webpush = require('web-push');
const db      = require('../db.js');
const router  = express.Router();

if (process.env.VAPID_PUBLIC_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:hello@betcouple.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

router.get('/vapid-key', (_, res) => res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null }));

router.post('/subscribe', async (req, res) => {
  const user = req.userId;
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid' });
  await db.query(
    `INSERT INTO push_subscriptions("user",endpoint,subscription) VALUES($1,$2,$3)
     ON CONFLICT(endpoint) DO UPDATE SET "user"=$1, subscription=$3`,
    [user, subscription.endpoint, JSON.stringify(subscription)]
  );
  res.json({ ok: true });
});

router.delete('/subscribe', async (req, res) => {
  if (req.body?.endpoint) await db.query('DELETE FROM push_subscriptions WHERE endpoint=$1', [req.body.endpoint]);
  res.json({ ok: true });
});

router.post('/prefs', async (req, res) => {
  try {
    const user = req.userId;
    const { on_group_bet, on_challenged, on_targeted, on_resolved, on_expiry } = req.body;
    await db.query(`
      INSERT INTO notification_prefs("user", on_group_bet, on_challenged, on_targeted, on_resolved, on_expiry)
      VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT("user") DO UPDATE SET
        on_group_bet=$2, on_challenged=$3, on_targeted=$4, on_resolved=$5, on_expiry=$6
    `, [user,
        on_group_bet  ?? true,
        on_challenged ?? true,
        on_targeted   ?? true,
        on_resolved   ?? true,
        on_expiry     ?? true,
    ]);
    res.json({ ok: true });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/prefs/:user', async (req, res) => {
  try {
    if (req.params.user !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    const { rows } = await db.query('SELECT * FROM notification_prefs WHERE "user"=$1', [req.params.user]);
    const row = rows[0] ?? {};
    res.json({
      on_group_bet:  row.on_group_bet  ?? true,
      on_challenged: row.on_challenged ?? true,
      on_targeted:   row.on_targeted   ?? true,
      on_resolved:   row.on_resolved   ?? true,
      on_expiry:     row.on_expiry     ?? true,
    });
  } catch(e) { res.status(500).json({ error: 'Server error' }); }
});

// Helper used by other routes to check a specific preference (default true)
async function isPrefEnabled(userId, prefName) {
  const { rows } = await db.query(`SELECT ${prefName} FROM notification_prefs WHERE "user"=$1`, [userId]);
  if (!rows.length) return true;
  return rows[0][prefName] !== false;
}

async function sendPushToUser(targetUser, payload) {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  const { rows } = await db.query('SELECT subscription FROM push_subscriptions WHERE "user"=$1', [targetUser]);
  for (const row of rows) {
    const sub = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription;
    try { await webpush.sendNotification(sub, JSON.stringify(payload)); }
    catch(e) {
      if (e.statusCode === 410 || e.statusCode === 404)
        await db.query('DELETE FROM push_subscriptions WHERE endpoint=$1', [sub.endpoint]);
    }
  }
}

module.exports = { router, sendPushToUser, isPrefEnabled };
