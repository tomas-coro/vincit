# Fase 3 — Completezza prodotto (design)

Data: 2026-06-04 · Stato: approvato dall'utente (sezioni A/B/C)
Contesto: roadmap pubblicazione Vincit, dopo Fase 1 (sicurezza, `a860f64`)
e Fase 2 (ops, `1a042e8`). Base: `frontend/` + `backend/` root, deploy da
`main` su Render `vincit-xq87`.

Decisioni utente: verifica email **soft** · cancellazione account =
**anonimizzazione** · pagina privacy **minimale** (contatto
amministrazione@74srl.it).

## A1 — Verifica email (soft)

- **DB**: colonna `users.email_verified_at BIGINT` (NULL = non verificato).
  Migrazione idempotente in `db.js`; backfill utenti esistenti:
  `email_verified_at = created_at` (grandfathered, niente banner per loro).
  Nuova tabella `email_verifications` speculare a `password_resets`
  (db.js:258-265): `token TEXT PK, user_id TEXT FK users(id) ON DELETE
  CASCADE, created_at BIGINT, expires_at BIGINT, used_at BIGINT`.
  Scadenza token: 48h.
- **Register** (`auth.js` POST /register): dopo l'INSERT crea token e invia
  mail best-effort (try/catch: se SMTP giù la registrazione riesce comunque,
  si potrà ri-inviare). Template HTML inline come la mail reset
  (auth.js:118-127).
- **GET /api/auth/verify-email?token=**: valida token (non scaduto, non
  usato), setta `email_verified_at`, marca `used_at`. Risponde con mini-HTML
  ("Email verificata ✓ — torna all'app", link a `/`). Token invalido →
  mini-HTML di errore con invito a ri-inviare dal profilo. Rotta pubblica.
- **POST /api/auth/resend-verification**: autenticata, sotto `authLimiter`;
  invalida i token precedenti dell'utente e ne emette uno nuovo. No-op (200)
  se già verificato.
- **Esposizione stato**: `email_verified: boolean` nel payload utente di
  `/api/auth/me` e del login.
- **Frontend**: banner dismissibile (per sessione, stato React) sotto
  l'header quando `email_verified === false`: copy i18n + bottone
  "Invia di nuovo" → resend. Nessun blocco funzionale.
- *Alternativa scartata*: token stateless JWT — meno codice ma non revocabile
  né tracciabile; la tabella imita `password_resets` già rodata.

## A2 — Cancellazione account (anonimizzazione)

- **Endpoint** `DELETE /api/auth/account`, autenticato, body
  `{ password }` ricontrollata con bcrypt (403 se errata).
- **Transazione**:
  - `users`: `name='Utente eliminato'`, `email='deleted_<id>@anon.local'`
    (colonna UNIQUE), `password_hash` = hash di random bytes,
    `avatar=NULL, avatar_url=NULL, vault_pin=NULL, friend_code=NULL,
    is_admin=false`, nuova colonna `deleted_at BIGINT` = now.
  - DELETE: `push_subscriptions`, `notification_prefs`, `password_resets`,
    `email_verifications`, `friendships`, `friend_requests` (dove FK CASCADE
    non basta perché la riga users NON viene cancellata).
- **Cosa resta**: bets, counter_bets, credits, achievements, events,
  membership `user_groups`. Lo storico del partner e le classifiche restano
  coerenti; `profiles[id]` risolve sempre (mostra "Utente eliminato").
- **Lockout**: login → 401 se `deleted_at IS NOT NULL`; `/api/auth/me` →
  401 idem (il token vivo muore al primo refresh). Client: dopo 200 fa
  logout locale.
- **UI**: SettingsView DANGER ZONE (SettingsView.jsx:844-897) → bottone
  rosso "Elimina account" → modale: avviso esplicito su cosa resta
  anonimizzato, input password, conferma. Copy i18n IT/EN.

## A3 — Cleanup token

Nel cron esistente di `server.js` (ogni 5 min): `DELETE FROM
password_resets WHERE expires_at < now OR (used_at IS NOT NULL AND used_at
< now - 24h)`; identico per `email_verifications`.

## B1 — Surprise sempre auto-attiva

`bets.js:59`: la seconda clausola di `isPending` non esclude le surprise →
surprise con stake ≥ `acceptance_threshold` diventa `pending`; se
scade/rifiutata il target la vede (sorpresa svelata). Fix:

```js
const isPending = isTargetedAccept || (!isSecret && opponent && !surprise && stake >= threshold);
```

Sicuro: senza accept `opponent_stake` resta NULL → payout classico dalla
banca (bets.js:277-282), l'opponent non rischia mai crediti propri.

## B2 — Retry su deadlock 40P01

In `db.js`, `transaction(fn)`: se il commit/query fallisce con
`err.code === '40P01'`, ROLLBACK e un solo retry (max 2 tentativi totali,
backoff ~50ms + jitter). Trasparente per tutte le rotte; al secondo
fallimento l'errore propaga come oggi (500 sporadico).

## C1 — Offline (service worker)

Oggi `frontend/public/sw.js` gestisce solo push: offline = pagina bianca.

- `install`: precache di `/` (la shell index.html) in cache `vincit-shell-v1`.
- `activate`: pulizia cache di versioni precedenti + `clients.claim()`.
- `fetch`: SOLO richieste di navigazione (`request.mode === 'navigate'`):
  network-first, su failure risponde con la shell in cache. Niente caching
  di `/api/*` né degli asset (gli asset hashati Vite arrivano dalla HTTP
  cache; un precache completo è rimandato).
- **Banner offline** in App: listener `online`/`offline` su window, barra
  i18n "Sei offline — i dati potrebbero non essere aggiornati".
- *Alternativa scartata*: vite-plugin-pwa/Workbox — più completo ma
  dipendenza pesante, rimandabile a dopo la pubblicazione.

## C2 — Pagina privacy

- Componente `PrivacyView` (lazy), vista `'privacy'` nello state routing di
  App.jsx (App.jsx:826, 2031-2048). Raggiungibile da non loggati: link nel
  footer di AuthView; da loggati: voce in SettingsView.
- Contenuto (IT, statico): quali dati (email, nickname, avatar, scommesse e
  relativo storico), dove (Render, Neon Postgres, Cloudinary per gli
  avatar), niente analytics/tracker di terze parti, notifiche push opt-in,
  diritto di cancellazione → rimando alla funzione "Elimina account",
  contatto: amministrazione@74srl.it. Bottone "indietro".

## C3 — Meta OG

In `frontend/index.html`: `meta name="description"`, `og:title`,
`og:description`, `og:type=website`, `og:url`
(https://vincit-xq87.onrender.com), `og:image` = icona esistente
`/icons/apple-touch-icon.png`, `twitter:card=summary`. Nessun asset nuovo.

## Error handling & test

- Mail di verifica: sempre best-effort, mai bloccante; resend protetto da
  authLimiter.
- Delete account: transazione unica; password errata → 403; doppia
  chiamata → seconda 401 (token ormai morto) o no-op.
- Verifica manuale: `node --check` sui file toccati, `npm run build`
  frontend, smoke su register→verify→resend, delete su account di test
  (`tsmbsl@gmail.com`), bet surprise sopra soglia → resta active.
- Test automatici: rimandati a Fase 5 (supertest).

## Fuori scope

Workbox/precache asset completo, verifica email blocking, export dati
GDPR (portabilità), pagina termini di servizio, og:image dedicata 1200×630.
