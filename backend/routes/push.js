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
  const { user, subscription } = req.body;
  if (!user || !subscription?.endpoint) return res.status(400).json({ error: 'Invalid' });
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

module.exports = { router, sendPushToUser };
