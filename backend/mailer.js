'use strict';
const nodemailer = require('nodemailer');

// Reads SMTP config from env vars. If anything is missing we run in
// \"degraded\" mode: send() resolves but logs to console instead of
// dispatching email — useful for dev and as a fallback when the user
// hasn\'t set up SMTP yet (the calling route can surface the token to
// the client so the user can still reset their password manually).
//
//   SMTP_HOST  e.g. smtp.gmail.com / smtp.resend.com / smtp-relay.brevo.com
//   SMTP_PORT  e.g. 587 (STARTTLS) or 465 (TLS)
//   SMTP_USER  account / API username
//   SMTP_PASS  password / app password / API key
//   SMTP_FROM  display From header, e.g. "BetCouple <no-reply@yourdomain.tld>"
function loadConfig() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return {
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587', 10),
    secure: parseInt(SMTP_PORT || '587', 10) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    from: SMTP_FROM || SMTP_USER,
  };
}

let _transport = null;
function getTransport() {
  if (_transport) return _transport;
  const cfg = loadConfig();
  if (!cfg) return null;
  _transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
  });
  return _transport;
}

function isConfigured() {
  return loadConfig() !== null;
}

async function send({ to, subject, text, html }) {
  const cfg = loadConfig();
  if (!cfg) {
    console.warn('[mailer] SMTP not configured — would have sent:', { to, subject });
    return { delivered: false, reason: 'smtp_not_configured' };
  }
  const t = getTransport();
  await t.sendMail({ from: cfg.from, to, subject, text, html });
  return { delivered: true };
}

module.exports = { send, isConfigured };
