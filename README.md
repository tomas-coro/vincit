# Vincit — mappa del codice

Guida per orientarsi nel repo senza dover aprire tutti i file. Una riga per ogni file: a cosa serve, quando aprirlo, cosa non aspettarti di trovarci.

> **Cos'è l'app**: gioco privato di scommesse per gruppi (coppie, amici, famiglia). Quote decimali europee, crediti virtuali (₡, default 100). Multi-gruppo per utente. 4 tipi di bet: 🔒 Vault (privata), 👥 Open, 🎯 Targeted (vs un membro), 🎭 Surprise (vs un membro, nascosta al gruppo).

---

## 1. Struttura ad alto livello

```
betcouple/
├── package.json         # orchestratore: script `dev` / `build` / `start` per i due sotto-progetti
├── start.sh             # avvio rapido (legacy, usato in locale)
│
├── backend/             # API Express + Postgres (Neon) + push + Cloudinary
├── frontend/            # SPA React + Vite + service worker
└── docs/superpowers/    # specs e piani delle iterazioni passate
```

**Comandi**:
- `npm run dev` — backend + frontend in parallelo (concurrently)
- `npm run build` — build di produzione del frontend (Vite)
- `npm run start` — avvia il backend (serve anche `frontend/dist`)
- `npm run install:all` — installa root + backend + frontend

---

## 2. Backend (`backend/`)

API REST + SSE. Niente ORM: query SQL grezze via `pg`. Schema gestito a runtime da `db.js`.

### Entry e infra

| File | A cosa serve |
|---|---|
| `server.js` | Entry Express. CORS whitelist, rate limit (`/bets`, `/credits`, `/push`), mappa SSE `roomId → Set<res>`, mount di tutti i router, cron 5min per scadenza bet, serve `frontend/dist`. |
| `db.js` | Pool `pg` + **bootstrap schema idempotente**. Ogni nuova colonna/tabella si aggiunge qui con `ALTER TABLE … IF NOT EXISTS`. SSL auto per host Neon/Render/AWS/Supabase. |
| `cloudinary.js` | Helper `uploadDataUrl()` e `destroyByPublicId()`. Cartelle: `betcouple/avatars/<userId>`, `betcouple/reactions/<betId>__<bettor>`. |
| `mailer.js` | SMTP via nodemailer (reset password). Lazy: se non configurato, `isConfigured()` → false. |
| `achievements.js` | **CATALOG** (24 trofei, 4 categorie) + `computeProgressFor(userId)` + `refreshAchievements(userId)`. La logica delle condizioni di sblocco vive qui, non nelle route. |
| `passwordPolicy.js` | `validatePassword(pw)` → null o codice errore (`password_too_short`, ecc.). Stesso file lato frontend. |

### Middleware (`backend/middleware/`)

| File | A cosa serve |
|---|---|
| `auth.js` | `authMiddleware` (Bearer JWT), `authMiddlewareSSE` (token in query, per EventSource), `requireOwner`, `requirePermission(req,res,perm)`, costante `PERMISSIONS`, `resolveActiveRoom` (legge `X-Active-Group` header). |

### Route (`backend/routes/`)

Tutte montate sotto `/api/*` da `server.js`. Le route protette ricevono `req.userId` (dal JWT) e spesso `req.roomId` (da `resolveActiveRoom`).

| File | Endpoint chiave | Cosa fa |
|---|---|---|
| `auth.js` | `POST /register`, `POST /login`, `GET /me`, `POST /avatar`, `DELETE /avatar`, reset password | Registrazione + JWT, profilo, upload avatar su Cloudinary. |
| `state.js` | `GET /` (state completo), `GET /stream` (SSE) | **`buildState(roomId, viewerId)`** è il cuore: assembla bets, profili, crediti, head-to-head, filtra Vault/Surprise in base al viewer. |
| `groups.js` | `POST /` create, `POST /:id/join`, `DELETE /:id/members/:uid`, ruoli, permessi JSONB | Multi-gruppo + ruoli (`member` / `co-admin` / `owner`) + 6 permission flag per co-admin. |
| `bets.js` | CRUD bet + accept / counter / resolve / reveal | Notifiche push (granular prefs). Esporta una factory: `require('./routes/bets.js')(broadcastUpdate)`. |
| `credits.js` | Aggiusta crediti, log | Stessa factory pattern. |
| `categories.js` | CRUD categorie custom | Per-gruppo. |
| `reactions.js` | Foto reazione su bet | Cloudinary, una per bettor per bet. |
| `friends.js` | Richieste / accept / decline / blocco | Cross-gruppo. |
| `templates.js` | CRUD template bet | Per riusare bet ricorrenti (manuale, non scheduling). |
| `achievements.js` | `GET /catalog`, `GET /unlocked`, `GET /progress` | Legge da `achievements.js` modulo. |
| `push.js` | Subscribe / unsubscribe / prefs (5 flag) | Espone anche `sendPushToUser(userId, payload)` e `isPrefEnabled(userId, key)`, usati da altre route. |
| `events.js` | Log eventi (audit minimal) | Storico azioni admin. |
| `admin.js` | `/users`, `/groups`, `/integrity`, `/nuke`, set-password, toggle-admin, reset trofei, force-add a gruppo | Gate: `X-Admin-Key` header **oppure** JWT con `users.is_admin=true`. |

> **Pattern factory**: alcuni router (`bets`, `credits`, `categories`, `reactions`, `friends`) esportano una funzione che riceve `broadcastUpdate` → questo permette al router di triggerare SSE quando muta stato.

---

## 3. Frontend (`frontend/`)

React 18 + Vite 5, **niente styling lib**: tutto inline-style + un blocco CSS globale in `App.jsx`. Service worker per push.

### Radice

| File | A cosa serve |
|---|---|
| `index.html` | Entry HTML. Title "Vincit", apple-touch icon, theme-color, manifest link. |
| `vite.config.js` | Config Vite, proxy `/api` → `localhost:3001` in dev. |
| `public/manifest.json` | PWA manifest. Nome app: "Vincit". |
| `public/sw.js` | Service worker: cache shell + ricezione push notifications. |
| `public/icons/` | Icone PWA generate da `scripts/gen-icons.mjs`. |
| `scripts/gen-icons.mjs` | Genera tutte le size di icone da una SVG sorgente. |

### `src/` — top-level

| File | A cosa serve |
|---|---|
| `main.jsx` | Bootstrap React, registra service worker, monta `<App />` dentro `<ErrorBoundary>`. |
| `App.jsx` | **Cuore frontend**. State globale, view router (Auth → Pairing → Dashboard/Bets/Vault/Stats/Trophies/Friends/Admin/Settings), montaggio modali, blocco CSS_BASE globale (palette, font, animazioni, hover/focus). |
| `api.js` | **Tutte le chiamate REST**. Cerca qui prima di toccare la rete. `bc_active_group` è JSON-stringified in LS — non rompere. |
| `useSync.js` | Hook: SSE EventSource + polling fallback, ri-fetcha lo state quando arriva `update`. |
| `i18n.js` | `useLang()` + dizionari IT/EN. **Ogni nuova stringa UI va qui.** |
| `freshReset.js` | Sincronizza il "reset account fresco" admin: confronta `fresh_reset_at` server vs LS ack, pulisce flag onboarding + easter egg. |
| `imageUtils.js` | Resize/compress avatar/reazioni prima dell'upload. |
| `passwordPolicy.js` | Stessa policy del backend, per validazione client. |
| `ErrorBoundary.jsx` | Cattura crash React, mostra schermata di fallback. |
| `Toast.jsx` | `useToast()` + provider. `toast.success(msg)`, `toast.error(msg)`. |

### `src/components/` — componenti riusabili

| File | A cosa serve |
|---|---|
| `Atoms.jsx` | Building block + design tokens. `Btn`, `Bdg`, `Inp`, `Toggle`, `Avatar`, costanti `COLORS`, `DEF_CATS`, `Q_PRE`, palette `DARK`/`LIGHT`/`AMBER`, `rootVars`. **Apri questo prima di reinventare un componente.** |
| `BetCard.jsx` | Card bet (sia in lista che in dettaglio). Pattern bordo sinistro colorato 3px. |
| `Coin.jsx` | Moneta 3D animata (easter egg + UI crediti). |
| `DieFace.jsx` | Faccia dado animata (easter egg lancio dadi). |
| `CommentThread.jsx` | Thread commenti su bet. |
| `GroupPicker.jsx` | Dropdown switcher tra gruppi (header). |
| `OnboardingTour.jsx` | Tour 3-step coachmark al primo login. |
| `Skeleton.jsx` | Placeholder shimmer (Dashboard, lista bet). |
| `Sparkline.jsx` | Grafico SVG inline (storico crediti). |
| `SplashScreen.jsx` | Logo dorato shimmer, prop `brand`. |
| `StreakBadge.jsx` | Badge streak con animazioni (flame `streakHot/Blaze`, ice `streakCold/Doom`). |
| `TrophiesSection.jsx` | Sezione trofei in Stats: griglia tile + filtro categoria. |
| `TrophyUnlockOverlay.jsx` | Overlay celebrativo allo sblocco trofeo. |
| `WinOverlay.jsx` | Overlay vittoria bet (confetti + crediti). |
| `IceEggOverlay.jsx` | Easter egg "raffreddamento" streak. |
| `PhoenixEggOverlay.jsx` | Easter egg "rinascita" dopo perdita streak. |

### `src/components/views/` — schermate principali

Una view per "schermata" mostrata da `App.jsx` in base allo state `view`.

| File | A cosa serve |
|---|---|
| `AuthView.jsx` | Login / registrazione + flow "password dimenticata". |
| `ResetPasswordView.jsx` | Landing del link email reset password. |
| `PairingView.jsx` | Onboarding gruppo: crea o entra via codice invito. |
| `DashboardView.jsx` | Home: bet attive, head-to-head, sparkline crediti, leaderboard gruppo. |
| `BetsHubView.jsx` | Hub navigazione bet (categorie, filtri). |
| `BetsView.jsx` | Lista bet (per categoria/stato). |
| `VaultView.jsx` | Bet private (Vault) dell'utente. |
| `StatsView.jsx` | Statistiche: grafici per categoria, win rate, trofei. |
| `TrophiesView.jsx` | Vista completa trofei con progresso. |
| `FriendsView.jsx` | Amicizie cross-gruppo, richieste in/out. |
| `SettingsView.jsx` | Profilo, push prefs, lingua, tema, gruppi, log out. |
| `AdminView.jsx` | Pannello admin: utenti / gruppi / integrità / reset. Visibile solo se `is_admin`. |

### `src/components/modals/` — modali

Quasi tutti seguono lo stesso pattern: overlay scuro, card centrata, `bIn` animazione, ESC + click-outside per chiudere.

| File | Quando si apre |
|---|---|
| `CreateModal.jsx` | Crea nuova bet (desktop = 2 col con live preview, mobile = full screen). |
| `CreateModalCoachmarks.jsx` | Coachmark sequence dentro CreateModal (concept A, prima volta). |
| `CreateGroupModal.jsx` | Crea nuovo gruppo. |
| `GroupInfoModal.jsx` | Dettagli gruppo + gestione membri / ruoli / permessi. |
| `EditModal.jsx` | Modifica bet esistente (entro grace period). |
| `ResolveModal.jsx` | Dichiara esito bet (esporta anche `OvertimeModal`). |
| `AcceptModal.jsx` | Accetta una bet Open o Targeted. |
| `CounterModal.jsx` | Contro-offerta su bet Targeted. |
| `RevealModal.jsx` | Reveal di una bet Surprise dopo risoluzione. |
| `CommentModal.jsx` | Aggiungi commento a bet. |
| `PinModal.jsx` | PIN per Vault (bet private). |
| `ProfileEditModal.jsx` | Modifica profilo (nome, avatar, colore). |
| `PhotoCropModal.jsx` | Crop avatar dopo selezione file. |
| `CameraModal.jsx` | Scatto foto reazione (mobile). |
| `TrophiesModal.jsx` | Vista trofei in modale (lanciato da Dashboard). |
| `SubsetEditModal.jsx` | Edit di un sottoinsieme di campi (refactor in corso). |

---

## 4. Database

Schema gestito tutto in `backend/db.js`. Tabelle principali (non esaustivo — fonte di verità è il file):

- `users` — id, email, name, avatar, color_key, password_hash, is_admin, room_id (legacy), fresh_reset_at, created_at
- `groups` — id, name, emoji, invite_code, owner_id, created_at
- `user_groups` — junction (user_id, group_id, role, permissions JSONB)
- `bets` — id, room_id, creator, opponent, target_user, title, odds, stake, status, type (vault/open/targeted/surprise), category, expires_at, …
- `credits` — log dei movimenti
- `reactions` — foto reazione (public_id Cloudinary)
- `achievements_unlocked` — (user_id, key, unlocked_at)
- `friendships` + `friend_requests`
- `bet_templates`
- `push_subscriptions` + `push_prefs`
- `events` — audit log

> **Per aggiungere una colonna**: aggiungi un `ALTER TABLE … ADD COLUMN IF NOT EXISTS` in `db.js`. Il bootstrap gira a ogni avvio, è idempotente.

---

## 5. Environment vars

In `backend/.env` (locale) e dashboard Render (produzione):

| Var | Cosa |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon Frankfurt) |
| `JWT_SECRET` | Segreto firma JWT |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web push |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | Upload immagini |
| `SMTP_HOST` / `_USER` / `_PASS` / `_FROM` | Reset password email |
| `APP_BASE_URL` | URL base per link nelle email |
| `ADMIN_KEY` | Bypass admin gate (curl/ops) |
| `NODE_ENV` | `production` su Render |
| `ALLOWED_ORIGIN` | CORS whitelist, comma-separated |
| `PORT` | **Auto-iniettato da Render** — non hardcodare |

---

## 6. Deploy

- **Render Web Service** a `https://vincit.onrender.com` — un solo servizio serve API + frontend buildato (`frontend/dist`)
- **Branch `main`** → push auto → redeploy in 30-60s
- **Neon Postgres** Frankfurt, SSL required
- **Cold start**: Render free dorme dopo 15min, Neon pausa dopo 5min → primo caricamento ~20-30s

---

## 7. Pattern ricorrenti (quando li vedi, sai cosa significano)

- **Bordo sinistro 3px colorato** sulle card → pattern visivo Vincit (BetCard, trophy tile, mini-preview)
- **`var(--gold)22` bg + gold text + gold border** → chip "attiva"
- **Animazioni**: `sUp` slide-up, `bIn` bounce-in modali, `fIn` fade, `spinC` moneta 3D, `shimmer` testo dorato. Tutte in `App.jsx` CSS_BASE
- **Factory router** `require('./routes/x.js')(broadcastUpdate)` → router che triggera SSE
- **`bc_*` chiavi LS** → tutte BetCouple, candidate al wipe in `freshReset.js`
- **`buildState(roomId, viewerId)`** in `routes/state.js` → unica funzione che assembla lo state filtrato

---

## 8. Quick lookup

| Voglio modificare… | Apro |
|---|---|
| Una stringa UI | `frontend/src/i18n.js` |
| Una chiamata API | `frontend/src/api.js` |
| Lo schema DB | `backend/db.js` |
| La logica di un trofeo | `backend/achievements.js` |
| La palette / font / animazione | `frontend/src/App.jsx` (CSS_BASE) + `frontend/src/components/Atoms.jsx` |
| L'aspetto di una bet card | `frontend/src/components/BetCard.jsx` |
| Cosa vede un viewer in un gruppo | `backend/routes/state.js` (`buildState`) |
| Notifiche push | `backend/routes/push.js` + frontend `App.jsx` (registrazione) |
| Pannello admin | `frontend/src/components/views/AdminView.jsx` + `backend/routes/admin.js` |

---

*Mappa generata 2026-05-15. Se aggiungi un nuovo file in `routes/`, `views/` o `modals/`, aggiungi una riga qui sotto la tabella relativa.*
