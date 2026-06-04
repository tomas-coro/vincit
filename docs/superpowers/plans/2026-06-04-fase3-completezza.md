# Fase 3 — Completezza prodotto · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verifica email soft, cancellazione account GDPR (anonimizzazione), cleanup token, fix surprise-bet, retry deadlock, offline SW, pagina privacy, meta OG.

**Architecture:** Backend Express (`backend/`) + frontend React/Vite (`frontend/`), Postgres Neon, schema auto-migrato all'avvio in `db.js` (pattern `IF NOT EXISTS` idempotente). Auth via JWT Bearer; le rotte auth fanno verify inline (vedi `auth.js`). i18n a oggetti annidati in `frontend/src/i18n.js` (chiavi `sezione.chiave`, IT + EN).

**Tech Stack:** Node/Express, pg, bcrypt, jsonwebtoken, nodemailer; React 18, Vite.

**Spec:** `docs/superpowers/specs/2026-06-04-fase3-completezza-design.md`

**Nota test:** il progetto non ha infrastruttura di test (supertest arriva in Fase 5, da spec). Ogni task verifica con `node --check` / `npm run build` + verifica manuale. Comandi dalla root del repo, PowerShell.

---

### Task 1: Migrazioni DB — email_verified_at, deleted_at, email_verifications

**Files:**
- Modify: `backend/db.js` (dopo il blocco `password_resets`, ~riga 266)

- [ ] **Step 1: Aggiungi le migrazioni**

In `backend/db.js`, subito DOPO il blocco che chiude `password_resets` (dopo la riga `CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);` e il backtick di chiusura, ~riga 266), inserisci:

```js
  // ── Email verification (soft) + soft-delete ─────────────────────────
  // email_verified_at: NULL = non verificata. Il backfill è ONE-TIME e
  // gated sull'esistenza della colonna: gli account esistenti vengono
  // considerati verificati (grandfathered), i nuovi partono NULL. Se il
  // backfill girasse a ogni boot, ogni deploy "verificherebbe" anche i
  // nuovi account non verificati.
  const { rows: evCol } = await pool.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_name='users' AND column_name='email_verified_at'`
  );
  if (!evCol.length) {
    await pool.query('ALTER TABLE users ADD COLUMN email_verified_at BIGINT');
    await pool.query('UPDATE users SET email_verified_at = created_at');
  }
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at BIGINT');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      token       TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  BIGINT NOT NULL,
      expires_at  BIGINT NOT NULL,
      used_at     BIGINT
    );
    CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);
  `);
```

- [ ] **Step 2: Verifica sintassi**

Run: `node --check backend\db.js`
Expected: nessun output (exit 0)

- [ ] **Step 3: Commit**

```powershell
git add backend/db.js; git commit -m "feat(db): email_verified_at + deleted_at + tabella email_verifications"
```

---

### Task 2: Endpoint verifica email (send, verify, resend)

**Files:**
- Modify: `backend/routes/auth.js` (helper dopo `makeInviteCode`, hook nel register, 2 rotte nuove dopo `/reset-password`)
- Modify: `backend/server.js:73` (rate limit sul resend)

- [ ] **Step 1: Aggiungi helper token + invio mail**

In `backend/routes/auth.js`, dopo la funzione `makeInviteCode()` (~riga 25), aggiungi:

```js
const VERIFY_TTL = 48 * 60 * 60 * 1000; // 48h

async function createVerificationToken(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  // Un solo token vivo per utente: invalida i precedenti, poi emetti.
  await db.query(
    'UPDATE email_verifications SET used_at=$1 WHERE user_id=$2 AND used_at IS NULL',
    [now, userId]
  );
  await db.query(
    'INSERT INTO email_verifications(token, user_id, created_at, expires_at) VALUES($1,$2,$3,$4)',
    [token, userId, now, now + VERIFY_TTL]
  );
  return token;
}

async function sendVerificationEmail({ id, name, email }, reqOrigin) {
  const token = await createVerificationToken(id);
  const base = (process.env.APP_BASE_URL || reqOrigin || '').replace(/\/+$/, '');
  const link = `${base}/api/auth/verify-email?token=${token}`;
  await sendMail({
    to: email,
    subject: 'Vincit · Verifica la tua email',
    text: `Ciao ${name},\n\nConferma la tua email aprendo questo link entro 48 ore:\n${link}\n\nSe non ti sei registrato su Vincit, ignora questa email.\n— Vincit`,
    html: `<p>Ciao <b>${name}</b>,</p>
           <p>Conferma la tua email toccando il bottone qui sotto entro 48 ore:</p>
           <p><a href="${link}" style="display:inline-block;padding:12px 22px;background:#c8973f;color:#07060f;border-radius:10px;text-decoration:none;font-weight:700;font-family:sans-serif">Verifica email</a></p>
           <p style="font-size:12px;color:#777">Se il bottone non funziona, copia questo indirizzo nel browser:<br><code>${link}</code></p>
           <p style="font-size:12px;color:#777">Se non ti sei registrato su Vincit, ignora questa email.</p>`,
  });
}
```

- [ ] **Step 2: Hook nel register (best-effort, mai bloccante)**

In `POST /register`, dopo `await db.transaction(...)` (~riga 53) e PRIMA di `const token = makeToken(...)`, aggiungi:

```js
    if (mailReady()) {
      // Fire-and-forget: la registrazione non deve fallire né rallentare
      // se l'SMTP è giù — l'utente potrà ri-inviare dal banner in-app.
      sendVerificationEmail({ id: userId, name: name.trim(), email: email.toLowerCase() }, req.headers.origin)
        .catch(err => console.error('[register] verification mail failed', err));
    }
```

Nella riga della risposta del register (riga 56), aggiungi `email_verified:false` al payload user:

```js
    res.json({ token, user: { id:userId, name:name.trim(), avatar:avatar||'😊', avatar_url:null, color_key:color_key||'blue', room_id:null, invite_code:null, paired:false, email_verified:false } });
```

- [ ] **Step 3: Rotta GET /verify-email (pubblica, risponde mini-HTML)**

Dopo la chiusura di `POST /reset-password` (~riga 181), aggiungi:

```js
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
    await sendVerificationEmail(u, req.headers.origin);
    res.json({ ok: true });
  } catch (e) {
    console.error('[resend-verification]', e);
    res.status(500).json({ error: 'server_error' });
  }
});
```

- [ ] **Step 4: Rate limit sul resend**

In `backend/server.js`, dopo la riga `app.use('/api/auth/reset-password',  authLimiter);` (riga 73), aggiungi:

```js
app.use('/api/auth/resend-verification', authLimiter);
```

- [ ] **Step 5: Verifica sintassi**

Run: `node --check backend\routes\auth.js; node --check backend\server.js`
Expected: nessun output

- [ ] **Step 6: Commit**

```powershell
git add backend/routes/auth.js backend/server.js; git commit -m "feat(auth): verifica email soft - invio al register, verify-email, resend"
```

---

### Task 3: email_verified nel payload + lockout account eliminati

**Files:**
- Modify: `backend/routes/auth.js` (login ~riga 64-87, /me ~riga 220-249)

- [ ] **Step 1: Login — blocca eliminati, esponi email_verified**

In `POST /login`, la riga 70-71 attuale è:

```js
    if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
      return res.status(401).json({ error: 'Invalid email or password' });
```

sostituiscila con (stesso messaggio per account eliminato → niente enumeration):

```js
    if (!u || u.deleted_at || !(await bcrypt.compare(password || '', u.password_hash)))
      return res.status(401).json({ error: 'Invalid email or password' });
```

Nella risposta del login (riga 85) aggiungi `email_verified` dopo `fresh_reset_at`:

```js
    res.json({ token, user: { id:u.id, name:u.name, avatar:u.avatar, avatar_url:u.avatar_url, color_key:u.color_key, room_id:u.room_id, invite_code:inviteCode, paired, is_admin: u.is_admin === true, fresh_reset_at: u.fresh_reset_at == null ? null : Number(u.fresh_reset_at), email_verified: u.email_verified_at != null } });
```

- [ ] **Step 2: /me — blocca eliminati, esponi email_verified**

In `GET /me`, la riga 226 attuale è:

```js
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
```

sostituiscila con:

```js
    if (!rows[0] || rows[0].deleted_at) return res.status(401).json({ error: 'Unauthorized' });
```

(il client su errore di getMe fa già logout locale: App.jsx:700-704 — il token vivo muore al primo refresh.)

Nel `res.json({...})` di /me (righe 237-247) aggiungi dopo `fresh_reset_at`:

```js
      email_verified: u.email_verified_at != null,
```

- [ ] **Step 3: Verifica sintassi**

Run: `node --check backend\routes\auth.js`
Expected: nessun output

- [ ] **Step 4: Commit**

```powershell
git add backend/routes/auth.js; git commit -m "feat(auth): email_verified nel payload utente, lockout account eliminati"
```

---

### Task 4: DELETE /api/auth/account (anonimizzazione)

**Files:**
- Modify: `backend/routes/auth.js` (nuova rotta in fondo, prima di `module.exports`)

- [ ] **Step 1: Aggiungi la rotta**

Prima di `module.exports = router;` aggiungi:

```js
// DELETE /api/auth/account — cancellazione GDPR per anonimizzazione.
// I dati PERSONALI (email, nome, password, avatar, amicizie, push,
// token) spariscono; bets/crediti/achievements e la membership nei
// gruppi restano sotto "Utente eliminato" così lo storico del partner
// e le classifiche non si rompono. La riga users NON viene cancellata
// (le FK ON DELETE CASCADE quindi NON scattano: i DELETE servono).
router.delete('/account', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const { userId } = jwt.verify(authHeader.slice(7), SECRET);
    const { password } = req.body || {};

    const { rows } = await db.query('SELECT * FROM users WHERE id=$1', [userId]);
    const u = rows[0];
    if (!u || u.deleted_at) return res.status(401).json({ error: 'Unauthorized' });
    if (!(await bcrypt.compare(password || '', u.password_hash)))
      return res.status(403).json({ error: 'wrong_password' });

    // Best-effort: elimina l'avatar custom da Cloudinary prima di
    // anonimizzare (fuori transazione: se fallisce, pazienza).
    if (u.avatar_url) {
      try { await destroyByPublicId(AVATAR_FOLDER, userId); } catch (e) { console.warn('[delete-account] avatar cleanup failed', e.message); }
    }

    const now = Date.now();
    // Password impossibile da indovinare e mai comunicata a nessuno.
    const ghostHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), ROUNDS);

    await db.transaction(async (client) => {
      await client.query(
        `UPDATE users SET
           name='Utente eliminato',
           email=$1,
           password_hash=$2,
           avatar='👻', avatar_url=NULL, vault_pin=NULL,
           friend_code=NULL, is_admin=false,
           deleted_at=$3
         WHERE id=$4`,
        [`deleted_${userId}@anon.local`, ghostHash, now, userId]
      );
      // Tabella profiles legacy: anonimizza anche lì se la riga esiste.
      await client.query(
        `UPDATE profiles SET name='Utente eliminato', avatar='👻' WHERE "user"=$1`,
        [userId]
      );
      await client.query('DELETE FROM push_subscriptions WHERE "user"=$1', [userId]);
      await client.query('DELETE FROM notification_prefs WHERE "user"=$1', [userId]);
      await client.query('DELETE FROM password_resets WHERE user_id=$1', [userId]);
      await client.query('DELETE FROM email_verifications WHERE user_id=$1', [userId]);
      await client.query('DELETE FROM friendships WHERE user_id_a=$1 OR user_id_b=$1', [userId]);
      await client.query('DELETE FROM friend_requests WHERE from_user_id=$1 OR to_user_id=$1', [userId]);
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('[delete-account]', e);
    res.status(500).json({ error: 'server_error' });
  }
});
```

Nota vs spec: la spec diceva `avatar=NULL`, ma la colonna ha DEFAULT `'😊'` e il frontend si aspetta un'emoji — `'👻'` evita render rotti. Deviazione consapevole.

- [ ] **Step 2: Verifica sintassi**

Run: `node --check backend\routes\auth.js`
Expected: nessun output

- [ ] **Step 3: Commit**

```powershell
git add backend/routes/auth.js; git commit -m "feat(auth): DELETE /account - cancellazione GDPR per anonimizzazione"
```

---

### Task 5: Cleanup token nel cron

**Files:**
- Modify: `backend/server.js` (dentro il `setInterval` esistente, dopo il blocco `pend`, ~riga 221)

- [ ] **Step 1: Aggiungi il purge**

In `backend/server.js`, dentro il `setInterval(async () => {...}, 5*60*1000)`, DOPO la chiusura dell'`if (pend.rowCount > 0) {...}` e PRIMA del `} catch (err) {`, aggiungi:

```js
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
```

- [ ] **Step 2: Verifica sintassi**

Run: `node --check backend\server.js`
Expected: nessun output

- [ ] **Step 3: Commit**

```powershell
git add backend/server.js; git commit -m "feat(cron): purge token reset/verifica scaduti o consumati"
```

---

### Task 6: Surprise sempre auto-attiva

**Files:**
- Modify: `backend/routes/bets.js:55-60`

- [ ] **Step 1: Semplifica isPending**

La logica attuale (righe 55-60):

```js
      // Pot mode: any TARGETED non-surprise bet must wait for the opponent to
      // accept (and pick their stake). Surprise stays auto-active (otherwise
      // the surprise would be spoiled). Open / vault never go pending.
      const isTargetedAccept = !isSecret && !!opponent && !surprise;
      const isPending = isTargetedAccept || (!isSecret && opponent && stake >= threshold);
      const status = isPending ? 'pending' : 'active';
```

La seconda clausola era ridondante per le mirate (già pending via `isTargetedAccept` a qualsiasi stake) e catturava per sbaglio le SURPRISE con stake ≥ soglia, mandandole `pending` → se scadute/rifiutate il target le vedeva (sorpresa svelata). Sostituisci con:

```js
      // Pot mode: any TARGETED non-surprise bet must wait for the opponent to
      // accept (and pick their stake). Surprise stays auto-active (otherwise
      // the surprise would be spoiled) — safe at any stake: without an accept
      // there is no opponent_stake, so the payout comes from the bank and the
      // opponent never risks own credits. Open / vault never go pending.
      const isPending = !isSecret && !!opponent && !surprise;
      const status = isPending ? 'pending' : 'active';
```

ATTENZIONE: `isTargetedAccept` non è usato altrove nel file (verifica con grep prima di rimuoverlo: `grep -n isTargetedAccept backend/routes/bets.js` → deve comparire solo qui).

- [ ] **Step 2: Verifica sintassi + grep**

Run: `node --check backend\routes\bets.js`
Expected: nessun output

- [ ] **Step 3: Commit**

```powershell
git add backend/routes/bets.js; git commit -m "fix(bets): surprise sempre auto-attiva, mai pending (sorpresa svelata)"
```

---

### Task 7: Retry su deadlock 40P01

**Files:**
- Modify: `backend/db.js:534-546` (funzione `transaction`)

- [ ] **Step 1: Sostituisci transaction**

La funzione attuale:

```js
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

diventa:

```js
// Un solo retry su deadlock Postgres (40P01): i lock incrociati sui
// crediti tra endpoint diversi possono — molto raramente — andare in
// deadlock; Postgres uccide una vittima, che è sicura da ri-eseguire
// (tutto il lavoro era dentro la transazione abortita).
async function transaction(fn) {
  for (let attempt = 1; ; attempt++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await fn(client);
      await client.query('COMMIT');
      return;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      if (e.code === '40P01' && attempt < 2) {
        // Backoff breve con jitter, poi riprova con un client fresco
        // (il finally rilascia questo).
        await new Promise(r => setTimeout(r, 50 + Math.floor(Math.random() * 100)));
        continue;
      }
      throw e;
    } finally {
      client.release();
    }
  }
}
```

- [ ] **Step 2: Verifica sintassi**

Run: `node --check backend\db.js`
Expected: nessun output

- [ ] **Step 3: Commit**

```powershell
git add backend/db.js; git commit -m "fix(db): retry singolo su deadlock 40P01 in transaction()"
```

---

### Task 8: Offline — shell cache nel SW + banner

**Files:**
- Modify: `frontend/public/sw.js`
- Modify: `frontend/src/App.jsx` (stato + banner vicino a `syncError`, ~riga 1799)
- Modify: `frontend/src/i18n.js` (chiave `app.offline_banner`, IT + EN)

- [ ] **Step 1: Estendi sw.js**

In `frontend/public/sw.js`, PRIMA dei listener push esistenti, aggiungi:

```js
// ── Offline shell ────────────────────────────────────────────────────
// Network-first SOLO sulle navigazioni: se la rete manca, servi la shell
// (index.html) dalla cache. Niente cache per /api/* né per gli asset
// hashati di Vite (HTTP cache). Bump della versione = invalidazione.
const SHELL_CACHE = 'vincit-shell-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.add('/')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        // Tieni fresca la copia della shell (solo pathname "/", così una
        // navigazione tipo /qualcosa non inquina la chiave).
        if (r.ok && new URL(e.request.url).pathname === '/') {
          const copy = r.clone();
          caches.open(SHELL_CACHE).then(c => c.put('/', copy)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match('/'))
  );
});
```

- [ ] **Step 2: Stato offline in App.jsx**

Nel componente principale di App.jsx, vicino agli altri `useState` di auth (~riga 663), aggiungi:

```js
  // Banner offline: navigator.onLine + eventi online/offline.
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  useEffect(() => {
    const goOn  = () => setIsOffline(false);
    const goOff = () => setIsOffline(true);
    window.addEventListener('online', goOn);
    window.addEventListener('offline', goOff);
    return () => { window.removeEventListener('online', goOn); window.removeEventListener('offline', goOff); };
  }, []);
```

- [ ] **Step 3: Banner nel render**

Nel return principale, SUBITO PRIMA del blocco `{syncError && (` (~riga 1799), aggiungi:

```jsx
      {isOffline && (
        <div style={{position:'fixed',top:8,left:'50%',transform:'translateX(-50%)',zIndex:1001,
          background:'var(--surf)',border:'1px solid var(--rule)',borderRadius:12,
          padding:'8px 14px',fontSize:12,color:'var(--dim)',whiteSpace:'nowrap',
          boxShadow:'0 8px 24px rgba(0,0,0,.35)'}}>
          {t('app.offline_banner')}
        </div>
      )}
```

(`t` è già disponibile nel componente via `useLang`.)

- [ ] **Step 4: Chiavi i18n**

In `frontend/src/i18n.js`, nell'oggetto `app:` della sezione `it:` (riga 12), aggiungi dentro le graffe:

```js
offline_banner:'📡 Sei offline — i dati potrebbero non essere aggiornati',
```

e l'equivalente nell'oggetto `app:` della sezione `en:`:

```js
offline_banner:'📡 You are offline — data may be out of date',
```

- [ ] **Step 5: Build di verifica**

Run: `npm run build --prefix frontend`
Expected: build OK senza errori

- [ ] **Step 6: Commit**

```powershell
git add frontend/public/sw.js frontend/src/App.jsx frontend/src/i18n.js; git commit -m "feat(pwa): shell offline nel service worker + banner offline"
```

---

### Task 9: Banner "verifica la tua email" + API resend

**Files:**
- Modify: `frontend/src/api.js` (dopo `resetPassword`, riga 44)
- Modify: `frontend/src/App.jsx` (stato + banner sotto quello offline)
- Modify: `frontend/src/i18n.js` (chiavi `app.verify_email_*`, IT + EN)

- [ ] **Step 1: API client**

In `frontend/src/api.js` dopo la riga 44 (`resetPassword`), aggiungi:

```js
export const resendVerification = () => req('POST', '/auth/resend-verification');
export const deleteAccount      = (password) => req('DELETE', '/auth/account', { password });
```

(`deleteAccount` serve al Task 10, lo aggiungiamo qui per non toccare il file due volte.)

- [ ] **Step 2: Stato dismiss in App.jsx**

Vicino allo stato `isOffline` (Task 8 Step 2), aggiungi:

```js
  // Banner verifica email: dismissibile per sessione (niente persistenza).
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
```

- [ ] **Step 3: Banner nel render**

SUBITO DOPO il blocco `{isOffline && (...)}` del Task 8, aggiungi:

```jsx
      {authUser && authUser.email_verified === false && !verifyBannerDismissed && (
        <div style={{position:'fixed',top: isOffline ? 52 : 8,left:'50%',transform:'translateX(-50%)',zIndex:999,
          display:'flex',alignItems:'center',gap:10,maxWidth:'calc(100% - 24px)',
          background:'var(--surf)',border:'1px solid var(--rule)',borderRadius:12,
          padding:'8px 12px',fontSize:12,color:'var(--dim)',boxShadow:'0 8px 24px rgba(0,0,0,.35)'}}>
          <span>{t('app.verify_email_banner')}</span>
          <button onClick={async () => {
            try { await api.resendVerification(); toast.success(t('app.verify_email_sent')); }
            catch { toast.error(t('app.verify_email_error')); }
          }} style={{background:'transparent',border:'1px solid var(--gold)66',color:'var(--gold)',
            borderRadius:8,padding:'4px 10px',fontSize:12,cursor:'pointer',whiteSpace:'nowrap'}}>
            {t('app.verify_email_resend')}
          </button>
          <button onClick={() => setVerifyBannerDismissed(true)} aria-label="Chiudi"
            style={{background:'transparent',border:'none',color:'var(--dim)',fontSize:14,cursor:'pointer',padding:2}}>✕</button>
        </div>
      )}
```

NOTA esecutore: verifica il nome della variabile toast nel componente App (`const toast = useToast()` o simile — cerca `useToast()` in App.jsx) e adegua. `api` è importato come `* as api` (App.jsx:3).

- [ ] **Step 4: Chiavi i18n**

In `app:` di `it:`:

```js
verify_email_banner:'Verifica la tua email per proteggere l\'account',
verify_email_resend:'Invia di nuovo',
verify_email_sent:'Email di verifica inviata ✓',
verify_email_error:'Invio non riuscito. Riprova più tardi.',
```

In `app:` di `en:`:

```js
verify_email_banner:'Verify your email to protect your account',
verify_email_resend:'Resend',
verify_email_sent:'Verification email sent ✓',
verify_email_error:'Sending failed. Try again later.',
```

- [ ] **Step 5: Build di verifica**

Run: `npm run build --prefix frontend`
Expected: build OK

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/api.js frontend/src/App.jsx frontend/src/i18n.js; git commit -m "feat(fe): banner verifica email con resend + api deleteAccount"
```

---

### Task 10: UI "Elimina account" in SettingsView

**Files:**
- Modify: `frontend/src/components/views/SettingsView.jsx` (DANGER ZONE, dopo il blocco `{canReset && (...)}`, ~riga 896)
- Modify: `frontend/src/i18n.js` (chiavi `settings.delete_account_*`, IT + EN)

- [ ] **Step 1: Stato locale**

Negli `useState` in cima al componente SettingsView (vicino a `showResetConfirm` / `showTestResetConfirm` — cercali con grep), aggiungi:

```js
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePw, setDeletePw]                   = useState('');
  const [deleteBusy, setDeleteBusy]               = useState(false);
```

NOTA esecutore: verifica che SettingsView importi `* as api` da `../../api.js` (se importa singole funzioni, aggiungi `deleteAccount` all'import) e che `toast` e `onLogout` siano disponibili (sono già usati nel file).

- [ ] **Step 2: Blocco UI**

Dentro il div DANGER ZONE, DOPO la chiusura `)}`  del blocco `{canReset && (<>...</>)}` (~riga 896) e PRIMA del `</div>` che chiude la danger zone (riga 897), aggiungi (visibile a TUTTI gli utenti, non solo admin):

```jsx
        {/* Account deletion — for everyone, not gated on canReset */}
        {showDeleteAccount ? (
          <div style={{...S.raised,border:'1px solid var(--red)',background:'var(--red)0d',marginTop:10}}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--red)',marginBottom:8}}>{t('settings.delete_account_confirm_title')}</div>
            <div style={{fontSize:12,color:'var(--dim)',marginBottom:12}}>{t('settings.delete_account_confirm_desc')}</div>
            <input type="password" value={deletePw} onChange={e=>setDeletePw(e.target.value)}
              placeholder={t('settings.delete_account_pw_placeholder')} autoComplete="current-password"
              style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'1px solid var(--brd)',
                background:'var(--bg)',color:'var(--txt)',fontSize:13,marginBottom:12}} />
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{setShowDeleteAccount(false);setDeletePw('');}}
                style={{...S.btn,flex:1,background:'transparent',border:'1px solid var(--brd)',color:'var(--dim)'}}>
                {t('settings.reset_cancel')}
              </button>
              <button disabled={deleteBusy || !deletePw} onClick={async ()=>{
                setDeleteBusy(true);
                try {
                  await api.deleteAccount(deletePw);
                  onLogout();
                } catch (e) {
                  toast.error(e?.status === 403 ? t('settings.delete_account_wrong_pw') : t('settings.delete_account_error'));
                  setDeleteBusy(false);
                }
              }} style={{...S.btn,flex:1,background:'var(--red)',border:'none',color:'#fff',fontWeight:700,
                opacity:(deleteBusy||!deletePw)?0.6:1}}>
                {t('settings.delete_account_confirm_btn')}
              </button>
            </div>
          </div>
        ) : (
          <div style={{...S.raised,border:'1px solid var(--red)33',marginTop:10}}>
            <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{t('settings.delete_account_title')}</div>
            <div style={{fontSize:12,color:'var(--dim)',marginBottom:14}}>{t('settings.delete_account_desc')}</div>
            <button onClick={()=>setShowDeleteAccount(true)}
              style={{...S.btn,width:'100%',background:'transparent',border:'1px solid var(--red)66',color:'var(--red)',fontSize:13}}>
              🗑 {t('settings.delete_account_btn')}
            </button>
          </div>
        )}
```

ATTENZIONE: la danger zone oggi mostra solo `settings.admin_only` quando `!canReset` — il nuovo blocco va FUORI da entrambi i rami `{!canReset && ...}` / `{canReset && ...}`, sempre visibile.

- [ ] **Step 3: Chiavi i18n**

In `settings:` di `it:` (cerca `danger_zone` per trovare la sezione):

```js
delete_account_title:'Elimina account',
delete_account_desc:'Cancella per sempre i tuoi dati personali. Le scommesse restano nel gruppo in forma anonima ("Utente eliminato").',
delete_account_btn:'Elimina il mio account',
delete_account_confirm_title:'Eliminare l\'account?',
delete_account_confirm_desc:'Azione irreversibile. Email, password, avatar e amicizie vengono cancellati subito; le tue scommesse restano visibili al gruppo come "Utente eliminato". Inserisci la password per confermare.',
delete_account_pw_placeholder:'La tua password',
delete_account_confirm_btn:'Elimina definitivamente',
delete_account_wrong_pw:'Password errata',
delete_account_error:'Errore durante l\'eliminazione. Riprova.',
```

In `settings:` di `en:`:

```js
delete_account_title:'Delete account',
delete_account_desc:'Permanently erase your personal data. Bets stay in the group anonymised ("Deleted user").',
delete_account_btn:'Delete my account',
delete_account_confirm_title:'Delete your account?',
delete_account_confirm_desc:'This cannot be undone. Email, password, avatar and friendships are erased immediately; your bets remain visible to the group as "Deleted user". Enter your password to confirm.',
delete_account_pw_placeholder:'Your password',
delete_account_confirm_btn:'Delete forever',
delete_account_wrong_pw:'Wrong password',
delete_account_error:'Something went wrong. Try again.',
```

- [ ] **Step 4: Build di verifica**

Run: `npm run build --prefix frontend`
Expected: build OK

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/components/views/SettingsView.jsx frontend/src/i18n.js; git commit -m "feat(fe): elimina account dalla danger zone (tutti gli utenti)"
```

---

### Task 11: PrivacyView + link (loggati e non)

**Files:**
- Create: `frontend/src/components/views/PrivacyView.jsx`
- Modify: `frontend/src/App.jsx` (lazy import, render in 2 punti, prop ad AuthView)
- Modify: `frontend/src/components/views/AuthView.jsx` (link footer)
- Modify: `frontend/src/components/views/SettingsView.jsx` (riga di navigazione)

- [ ] **Step 1: Crea PrivacyView.jsx**

```jsx
import React from 'react';

// Informativa privacy minimale e onesta. Testo statico in italiano
// (pubblico italiano; il resto dell'app è bilingue ma un'informativa
// tradotta a metà è peggio di una sola, chiara).
const SEC = { marginBottom: 22 };
const H2  = { fontSize: 15, fontWeight: 700, color: 'var(--txt)', margin: '0 0 6px' };
const P   = { fontSize: 13, lineHeight: 1.6, color: 'var(--dim)', margin: 0 };

export default function PrivacyView({ onBack }) {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 18px 60px' }}>
      <button onClick={onBack} aria-label="Indietro"
        style={{ background: 'transparent', border: '1px solid var(--brd)', color: 'var(--dim)',
          borderRadius: 10, padding: '8px 14px', fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
        ← Indietro
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--txt)', margin: '0 0 4px' }}>Privacy</h1>
      <p style={{ ...P, marginBottom: 26 }}>Ultimo aggiornamento: giugno 2026</p>

      <div style={SEC}>
        <h2 style={H2}>Cosa raccogliamo</h2>
        <p style={P}>Email, nickname, avatar (emoji o foto che carichi tu) e le scommesse
        che crei con il tuo gruppo: titolo, importi in crediti virtuali, esiti, reazioni e
        commenti. Niente dati di pagamento: i crediti di Vincit non sono denaro reale.</p>
      </div>

      <div style={SEC}>
        <h2 style={H2}>Dove stanno i dati</h2>
        <p style={P}>L'app gira su Render, il database è PostgreSQL su Neon e le foto
        avatar sono su Cloudinary. La connessione è sempre cifrata (HTTPS).</p>
      </div>

      <div style={SEC}>
        <h2 style={H2}>Cosa NON facciamo</h2>
        <p style={P}>Nessun tracker, nessuna analytics di terze parti, nessuna pubblicità,
        nessuna vendita o condivisione di dati. Le notifiche push sono opt-in e puoi
        disattivarle quando vuoi dalle impostazioni.</p>
      </div>

      <div style={SEC}>
        <h2 style={H2}>Chi vede cosa</h2>
        <p style={P}>Le tue scommesse sono visibili solo ai membri del gruppo in cui le
        crei (quelle Vault solo a te). Le impostazioni di visibilità di trofei, statistiche
        e gruppi sono regolabili dal tuo profilo.</p>
      </div>

      <div style={SEC}>
        <h2 style={H2}>Cancellare i dati</h2>
        <p style={P}>Dal tuo profilo → Elimina account: email, password, avatar e amicizie
        vengono cancellati subito e per sempre. Le scommesse condivise restano nel gruppo
        in forma anonima ("Utente eliminato"), perché lo storico appartiene anche a chi ci
        ha giocato con te.</p>
      </div>

      <div style={SEC}>
        <h2 style={H2}>Contatti</h2>
        <p style={P}>Per qualsiasi richiesta sui tuoi dati: <a href="mailto:amministrazione@74srl.it"
          style={{ color: 'var(--gold)' }}>amministrazione@74srl.it</a></p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lazy import in App.jsx**

Dopo la riga 25 (`const ResetPasswordView = ...`):

```js
const PrivacyView = lazy(() => import('./components/views/PrivacyView.jsx'));
```

- [ ] **Step 3: Render per utenti loggati**

Nel blocco Suspense delle viste (~riga 2048, dopo la riga di SettingsView), aggiungi:

```jsx
            {view === 'privacy'   && <PrivacyView onBack={() => setView('settings')} />}
```

- [ ] **Step 4: Render nel gate di auth (non loggati)**

Vicino agli stati auth (~riga 663), aggiungi:

```js
  const [showPrivacyGate, setShowPrivacyGate] = useState(false);
```

Il return del gate (righe 1709-1723) attualmente termina con:

```jsx
          : <AuthView onAuth={handleAuth} />}
```

sostituisci quella riga con:

```jsx
          : showPrivacyGate
            ? <Suspense fallback={null}><PrivacyView onBack={() => setShowPrivacyGate(false)} /></Suspense>
            : <AuthView onAuth={handleAuth} onShowPrivacy={() => setShowPrivacyGate(true)} />}
```

- [ ] **Step 5: Link footer in AuthView**

In `frontend/src/components/views/AuthView.jsx`: aggiungi la prop `onShowPrivacy` alla firma del componente (es. `export default function AuthView({ onAuth, onShowPrivacy })` — adatta alla firma reale). In fondo al layout, dopo l'ultimo elemento del form/footer esistente (il file è ~261 righe — individua il div di chiusura del contenitore principale), aggiungi:

```jsx
      <button onClick={onShowPrivacy}
        style={{ background: 'transparent', border: 'none', color: 'var(--dim)',
          fontSize: 11, cursor: 'pointer', textDecoration: 'underline',
          display: 'block', margin: '18px auto 0' }}>
        Privacy
      </button>
```

- [ ] **Step 6: Riga di navigazione in SettingsView**

SettingsView riceve già `onNavigate` (App.jsx:2048 passa `onNavigate={setView}`). Sotto la danger zone o vicino alle altre righe di navigazione (Amici/Admin — cerca `onNavigate(` nel file per il pattern esistente), aggiungi una voce coerente con lo stile delle righe vicine:

```jsx
      <div onClick={() => onNavigate('privacy')}
        style={{ ...S.card, cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginTop: 10 }}>
        <span style={{ fontSize: 13 }}>🔒 Privacy</span>
        <span style={{ color: 'var(--dim)' }}>›</span>
      </div>
```

NOTA esecutore: imita ESATTAMENTE il markup delle righe di navigazione esistenti (Amici/Admin) se differisce da questo.

- [ ] **Step 7: Build di verifica**

Run: `npm run build --prefix frontend`
Expected: build OK, chunk nuovo per PrivacyView

- [ ] **Step 8: Commit**

```powershell
git add frontend/src/components/views/PrivacyView.jsx frontend/src/App.jsx frontend/src/components/views/AuthView.jsx frontend/src/components/views/SettingsView.jsx; git commit -m "feat(fe): pagina privacy raggiungibile da loggati e non"
```

---

### Task 12: Meta OG in index.html

**Files:**
- Modify: `frontend/index.html` (dopo riga 16, `apple-mobile-web-app-title`)

- [ ] **Step 1: Aggiungi i meta**

Dopo `<meta name="apple-mobile-web-app-title" content="Vincit">` aggiungi:

```html
    <meta name="description" content="Vincit — il gioco privato di scommesse per coppie e gruppi di amici. Crediti virtuali, quote, trofei." />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Vincit" />
    <meta property="og:description" content="Il gioco privato di scommesse per coppie e gruppi di amici." />
    <meta property="og:url" content="https://vincit-xq87.onrender.com/" />
    <meta property="og:image" content="https://vincit-xq87.onrender.com/icons/apple-touch-icon.png" />
    <meta name="twitter:card" content="summary" />
```

- [ ] **Step 2: Build di verifica**

Run: `npm run build --prefix frontend`
Expected: build OK

- [ ] **Step 3: Commit**

```powershell
git add frontend/index.html; git commit -m "feat(meta): description + Open Graph + twitter card"
```

---

### Task 13: Verifica finale end-to-end

**Files:** nessuno (solo verifica)

- [ ] **Step 1: Sintassi backend completa**

Run: `node --check backend\server.js; node --check backend\db.js; node --check backend\routes\auth.js; node --check backend\routes\bets.js`
Expected: nessun output

- [ ] **Step 2: Build frontend pulita**

Run: `npm run build --prefix frontend`
Expected: build OK

- [ ] **Step 3: Diff review**

Run: `git log --oneline -15` e `git diff main@{upstream} --stat` (se già pushato il resto)
Expected: ~12 commit nuovi coerenti col piano, nessun file inatteso

- [ ] **Step 4: Smoke test post-deploy (dopo push, su prod)**

- `curl https://vincit-xq87.onrender.com/api/health` → `ok:true`
- Registrare un account di prova → arriva la mail di verifica → il link mostra "Email verificata ✓"
- Banner "verifica email" visibile prima del click, sparito dopo (re-login)
- Creare una bet Sorpresa con stake ≥ 20 → status `active` (non pending)
- Elimina account sull'account di prova → logout, login rifiutato, bets visibili come "Utente eliminato"
- DevTools offline → ricarica → la shell appare, banner "Sei offline"

---

## Rischi noti

- **SW**: la shell in cache riferisce asset Vite hashati. Dopo un deploy, l'offline può restare rotto finché il SW non si aggiorna (navigazione online) — accettato, è il caso limite di un fallback minimale.
- **Retry 40P01**: `fn` deve essere ri-eseguibile — vero per tutte le transazioni attuali (solo query dentro la TX).
- **isTargetedAccept rimosso** (Task 6): confermare con grep che non sia usato altrove.
