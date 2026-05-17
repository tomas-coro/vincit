# Vincit — Redesign v2

**Data**: 2026-05-16  
**Branch**: `redesign-v2` (il `main` resta invariato per confronto diretto)  
**Approccio**: Dashboard Revolution — la dashboard diventa il centro dell'esperienza, stabilisce lo standard visivo per il resto dell'app.

---

## 1. Strategia di sviluppo

- Tutto il lavoro avviene su branch `redesign-v2`
- Il `main` rimane intatto: aprendo l'app da due tab del browser si possono confrontare le due versioni in parallelo
- Al termine si fa cherry-pick dei componenti approvati; quelli non convincenti restano sul branch in attesa
- Nessun toggle runtime: la separazione è a livello di git, non di codice

---

## 2. Dashboard — B3 con tab

### Header fisso (sempre visibile, tutti i tab)

```
[ Avatar emoji ]  Nome utente       ₡ XXX
                  🔥 N giorni streak
[ + Crea scommessa — CTA full-width ]
```

- Avatar: `width:36px`, bordo `2px solid rgba(colore_utente, 0.3)`
- Crediti: `font-family: var(--f-num)` (Playfair Display), grande, colore `var(--gold)`
- Streak: `color: var(--orange, #e8903f)`, scompare se streak = 0
- CTA: `background: var(--pur)`, `border-radius: 9px`, full-width, `font-weight: 800`

### Tab strip

Tre tab sotto l'header, bordo inferiore come indicatore attivo:

| Tab | Icona | Badge |
|---|---|---|
| Feed | — | nessuno |
| Attive | 🎯 | contatore bet attive (viola) |
| In attesa | ⚡ | contatore pending (rosso, sparisce se 0) |

Active state: `color: var(--gold)`, `border-bottom: 2px solid var(--gold)`.

### Tab Feed

Cronologia eventi del gruppo in ordine anti-cronologico. Ogni item:

```
[ Avatar 26px ] Testo evento
                [ chip categoria ] [ chip importo/esito ]
                timestamp sfumato
```

Separati da hairline `var(--rule)`. Gli eventi più vecchi di 7 giorni appaiono a opacità 0.4.

**Tipi di evento** (campo `feed_visible = true` nella `events` table):

| Tipo | Descrizione | Chip |
|---|---|---|
| `bet_won` | "Tu hai vinto **titolo**" | Verde `+₡ X` + categoria |
| `bet_lost` | "Tu hai perso **titolo**" | Rosso `−₡ X` + categoria |
| `bet_created` | "**Nome** ha creato **titolo**" | Categoria |
| `bet_accepted` | "**Nome** ha accettato la tua sfida" | Viola |
| `challenge_received` | "**Nome** ti ha sfidato su **titolo**" | Rosso "Da accettare" + importo |
| `trophy_unlocked` | "Trofeo sbloccato: **nome**" | Gold |
| `streak_milestone` | "Streak di N giorni!" | Arancio |
| `bet_resolved_group` | "**Nome** ha risolto **titolo**" | Categoria + esito |

### Tab Attive

Lista delle bet con `status = 'active'` e `isSecret = false`. Ogni card usa il nuovo design BetCard v2 (vedi §3). In fondo, due righe di riepilogo:

```
Totale in gioco    ₡ XXX
Potenziale vincita ₡ XXX   (verde)
```

Separati da hairline, valori in `var(--f-num)`.

### Tab In attesa

Bet con `status = 'pending'` dove `opponent = userId` o `creator = userId`. Card espansa con tre azioni inline nel footer:

```
[ ✓ Accetta ]  [ ↩ Countra ]  [ ✕ Rifiuta ]
```

Footer diviso da hairline, colori: verde / viola / rosso.

- **Accetta**: azione inline, nessun modale — chiama `POST /api/bets/:id/accept` e mostra toast di conferma
- **Countra**: apre `CounterModal` (richiede inserire quota e stake diversi — modale necessario)
- **Rifiuta**: azione inline con toast di conferma

---

## 3. BetCard — v2 (stile giornale)

### Struttura visiva

```
┌─ bordo sinistro 3px (colore categoria) ──────────────────┐
│  [ emoji cat ]  Categoria label                          │
│                                                          │
│  Titolo della scommessa              2.50                │
│  in Cormorant serif                  quota (Playfair)    │
│                                                          │
│  ── hairline ──────────────────────────────────────────  │
│  [ 🦊 🐺 ]  ₡ 20 stake    ⚠ 2gg        → ₡ 50          │
└──────────────────────────────────────────────────────────┘
│  [ ✓ Risolvi ]  │  [ 💬 1 ]  │  [ ⋯ ]                   │
└──────────────────────────────────────────────────────────┘
```

### Specifiche

- **Bordo sinistro**: `3px solid` colore della categoria (invariato rispetto all'attuale)
- **Categoria**: chip piccola in cima, `font-size: 9px`, `padding: 2px 7px`
- **Titolo**: `font-family: var(--f-head)` (Cormorant Garamond), `font-size: 16px`, `font-weight: 600`
- **Quota**: `font-family: var(--f-num)` (Playfair Display), `font-size: 28px`, allineata a destra — senza "@", solo il numero
- **Hairline**: `1px solid var(--rule)` tra corpo e riga meta
- **Riga meta**: avatar sovrapposti 22px + stake + expiry warning + freccia vincita
- **Footer**: `display: flex`, ogni voce `flex: 1`, separati da `1px solid var(--rule)`, `padding: 8px`
- **Bet risolta** (won/lost): quota sostituita da `+₡ X` o `−₡ X` in verde/rosso; footer assente

### Varianti per stato

| Stato | Bordo | Odds/Importo | Footer |
|---|---|---|---|
| active | colore categoria | quota neutra | Risolvi · Commento · Menu |
| pending (da accettare) | rosso | quota | Accetta · Countra · Rifiuta |
| won | verde | `+₡ X` verde | assente |
| lost | rosso | `−₡ X` rosso | assente |
| expired | grigio | quota | Menu |

---

## 4. Bottom navigation — Glass pill

### Stile

```css
background: var(--surf)a6;         /* surf a 65% — si adatta a tutti i temi */
backdrop-filter: blur(24px) saturate(180%);
-webkit-backdrop-filter: blur(24px) saturate(180%);
border-radius: 22px;
border: 1px solid var(--rule);
box-shadow:
  0 8px 32px rgba(0,0,0,.35),
  inset 0 1px 0 rgba(255,255,255,0.06),
  inset 0 -1px 0 rgba(0,0,0,.15);
```

`var(--surf)a6` usa i token del tema attivo: su temi scuri è quasi-trasparente scuro, su CARTA è crema con blur — funziona su tutti e 6 i temi. La pill **non è edge-to-edge**: `margin: 0 14px 18px` — fluttua sopra il contenuto.

### Voci (5)

| Voce | Icona | Note |
|---|---|---|
| Home | 🏠 | Dashboard |
| Bets | 🎯 | BetsHubView — dot rosso se pending > 0 |
| Stats | 📊 | StatsView |
| Trofei | 🏆 | TrophiesView |
| Profilo | 👤 | SettingsView + FriendsView + AdminView |

### Elemento attivo

```css
background: var(--gold)1a;   /* hex 1a = ~10% opacity */
border-radius: 14px;
```

Icona: `filter: drop-shadow(0 0 6px var(--glow))` + `transform: translateY(-1px)`.  
Label: sempre visibile (7px uppercase), `var(--gold)` se attivo, `var(--dim)` se inattivo.

### Pending badge

Dot rosso `8px` con bordo `2px solid` che mima il colore del pill — nessun numero, solo presenza/assenza.

### Swipe tra sezioni

Transizione orizzontale `transform: translateX` con `transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1)`. Gesture swipe laterale sul contenuto principale (non sulla pill) cambia tab. La pill segue con highlight animato.

---

## 5. Activity Feed — Backend

### Modifica alla `events` table

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS feed_visible BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS feed_actor_id INTEGER REFERENCES users(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS feed_target_id INTEGER REFERENCES users(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS feed_amount INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS feed_category TEXT;
```

### Scrittura eventi

Gli eventi `feed_visible = true` vengono scritti nelle route esistenti:
- `bets.js`: resolve → `bet_won` / `bet_lost`, create → `bet_created`, accept → `bet_accepted`
- `achievements.js`: unlock → `trophy_unlocked`

### Endpoint

Nuovo endpoint `GET /api/state` già include tutto — aggiungere `feedEvents` nell'output di `buildState()`:

```js
feedEvents: await db.query(
  `SELECT * FROM events WHERE room_id=$1 AND feed_visible=true
   ORDER BY created_at DESC LIMIT 50`,
  [roomId]
)
```

### Filtraggio privacy

- `bet_won` / `bet_lost`: visibile solo al `feed_actor_id`
- `challenge_received`: visibile solo al `feed_target_id`
- `bet_created` / `bet_resolved_group`: visibile a tutti i membri del gruppo
- `trophy_unlocked` / `streak_milestone`: visibile solo all'utente

---

## 6. Temi — Palette aggiornata

I 6 temi finali. AMBER, SAKURA, PECE invariati. DARK, LIGHT, SELVA sostituiti.

### Nuovi temi

#### Ardesia (sostituisce DARK)
```js
export const ARDESIA = {
  bg:"#131318", surf:"#1e1e24", card:"#28282e", brd:"#38383e",
  rule:"rgba(212,200,184,0.12)", soft:"rgba(212,200,184,0.05)",
  gold:"#c8a870", goldL:"#d8bc88", glow:"rgba(200,168,112,0.20)",
  grn:"#60c898", red:"#dc4646", blu:"#8898c8", pur:"#9890b8",
  txt:"#f0ece4", dim:"#908880", mut:"#38383e", inp:"#111116"
};
```
*Grafite caldo — slate scuro neutro, oro antico spazzolato. Nessuna tinta di colore dominante.*

#### Carta (sostituisce LIGHT)
```js
export const CARTA = {
  bg:"#e8e0cc", surf:"#f0ece0", card:"#f8f4e8", brd:"#ccc4a8",
  rule:"rgba(139,94,42,0.16)", soft:"rgba(139,94,42,0.06)",
  gold:"#8b5e2a", goldL:"#a06e30", glow:"rgba(139,94,42,0.18)",
  grn:"#2a7a4a", red:"#a02828", blu:"#3a5a9a", pur:"#6a4a9a",
  txt:"#2a2010", dim:"#7a6848", mut:"#ccc4a8", inp:"#f0ece0"
};
```
*Vecchio giornale — crema ingiallita, inchiostro sepia caldo. Coerente con l'estetica editoriale.*

#### Casinò (sostituisce SELVA)
```js
export const CASINO = {
  bg:"#0a1810", surf:"#142a1c", card:"#1e3c28", brd:"#2e5438",
  rule:"rgba(232,200,112,0.14)", soft:"rgba(232,200,112,0.05)",
  gold:"#e8c870", goldL:"#f0d888", glow:"rgba(232,200,112,0.24)",
  grn:"#58d888", red:"#e07860", blu:"#6898c8", pur:"#a888c0",
  txt:"#f0ece0", dim:"#688878", mut:"#2e5438", inp:"#081410"
};
```
*Smeraldo lusso — verde feltro da casinò, oro chip ricco, crema avorio. Vibe Montecarlo.*

### Temi invariati

`AMBER`, `SAKURA`, `PECE` — nessuna modifica, palette e token identici.

---

## 7. Componenti da creare / modificare

| File | Tipo | Note |
|---|---|---|
| `frontend/src/components/Atoms.jsx` | modifica | Aggiungere `ARDESIA`, `CARTA`, `CASINO`; rimuovere `DARK`, `LIGHT`, `SELVA` |
| `frontend/src/App.jsx` | modifica | Aggiornare riferimenti temi, aggiungere swipe gesture handler, glass pill nav |
| `frontend/src/components/views/DashboardView.jsx` | riscrittura | Struttura B3: header + tab strip + 3 tab view |
| `frontend/src/components/BetCard.jsx` | riscrittura | Design B3: giornale + footer azioni |
| `backend/db.js` | modifica | `ALTER TABLE events` con 5 nuove colonne feed |
| `backend/routes/bets.js` | modifica | Scrivere eventi `feed_visible=true` su resolve/create/accept |
| `backend/routes/achievements.js` | modifica | Scrivere evento `trophy_unlocked` |
| `backend/routes/state.js` | modifica | Aggiungere `feedEvents` in `buildState()` |
| `frontend/src/i18n.js` | modifica | Stringhe per tipi eventi feed, tab labels |

---

## 8. Fuori scope (da valutare in iterazioni successive)

- Redesign di StatsView e TrophiesView
- Redesign di CreateModal
- Desktop layout (sidebar nav) — invariato in questa iterazione
- Animazioni swipe avanzate (spring physics)
- Feed infinito / paginazione oltre i 50 eventi
