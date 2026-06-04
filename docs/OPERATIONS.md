# Vincit — Guida operativa

Aggiornata: giugno 2026.

## Servizi Render (stato attuale)

| Servizio | URL | Stato | Note |
|---|---|---|---|
| **vincit-xq87** | https://vincit-xq87.onrender.com | **PRODUZIONE** | DB Neon proprio. Deploya da `main` (dal 30/05/2026) |
| betcouple | betcouple.onrender.com | duplicato stale | DB separato, NON è produzione. Da sospendere |
| vincit | — | sospeso | — |

⚠️ Debito tecnico residuo: servizio `betcouple` da sospendere (DB con soli
dati throwaway, verificato 30/05).

## Deploy

La produzione (`vincit-xq87`) deploya automaticamente dal branch **`main`**:

```sh
git push origin main
```

Build su Render (vedi `render.yaml`):
- build: `cd frontend && npm install --include=dev --include=optional && npm run build && cd .. && npm install --prefix backend`
- start: `node backend/server.js` (serve sia `/api` sia il frontend buildato)

## Variabili d'ambiente

Riferimento completo in `backend/.env.example` e `render.yaml`. Le critiche:

- `JWT_SECRET` — **obbligatoria**, il server non parte senza (niente fallback).
- `DATABASE_URL` — Postgres Neon.
- `ADMIN_EMAIL` — **funzionale**: all'avvio promuove a admin quell'utente.
  Senza, nessun admin esiste in produzione.
- `SMTP_*` + `APP_BASE_URL` — senza SMTP il reset password non invia mail
  (e non c'è più fallback_link nella risposta: il flusso è morto senza SMTP).

## Verifica post-deploy

```sh
# Health check — mostra la PRESENZA delle env var, mai i valori
curl https://vincit-xq87.onrender.com/api/health

# Smoke test end-to-end (login + giro base)
node backend/scripts/smoke.js https://vincit-xq87.onrender.com <email> <password>
```

`/api/health` deve riportare `db: true`, `cloudinary.ready: true`,
`mailer.ready: true` (se SMTP configurato).

## Backup database (Neon)

Neon conserva point-in-time restore secondo il piano attivo (Free: 24h).
Per un backup manuale offline:

```sh
pg_dump "$DATABASE_URL" --no-owner --format=custom --file=vincit-$(date +%Y%m%d).dump
# Ripristino:
pg_restore --no-owner --dbname="$DATABASE_URL_NUOVO" vincit-YYYYMMDD.dump
```

Consigliato: dump manuale prima di ogni migrazione schema o consolidamento
servizi. Lo schema è creato/migrato automaticamente all'avvio da
`backend/db.js` (idempotente, `IF NOT EXISTS`).

## Job periodici (in-process)

`backend/server.js` esegue ogni 5 minuti:
- scommesse `active` scadute → `expired` (il creatore dichiara l'esito);
- sfide `pending` scadute → `rejected` (mai `expired`: i crediti non sono
  mai stati trattenuti, e `/resolve` pagherebbe una vincita mai coperta).

Nessun cron esterno richiesto.
