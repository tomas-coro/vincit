# Vincit Redesign v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all redesign-v2 changes on a dedicated branch: new theme palette (Ardesia / Carta / Casinò), activity feed backend + frontend, BetCard v2 newspaper style, DashboardView B3 with tabs, and glass pill navigation.

**Architecture:** All changes live on `redesign-v2`; `main` stays intact for parallel comparison. Backend adds an `events` table for the activity feed. Frontend rewrites DashboardView and BetCard visuals while wiring feedEvents through existing SSE state sync.

**Tech Stack:** React 18 + Vite 5 (all inline styles), Express + PostgreSQL (Neon), SSE real-time via `buildState()`, CSS `backdrop-filter` for glass pill.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/components/Atoms.jsx` | Modify | Replace DARK→ARDESIA, LIGHT→CARTA, SELVA→CASINO |
| `frontend/src/App.jsx` | Modify | Update theme imports/switch/validation; add feedEvents state; simplify NAV to 5 items; replace nav with glass pill; add content swipe |
| `backend/db.js` | Modify | CREATE events table with feed columns |
| `backend/routes/bets.js` | Modify | Write bet_created, challenge_received, bet_accepted, bet_won/lost, bet_resolved_group events |
| `backend/routes/state.js` | Modify | Add feedEvents query in buildState() with privacy filter |
| `frontend/src/i18n.js` | Modify | Add feed event strings, dashboard tab labels, nav.profile |
| `frontend/src/components/BetCard.jsx` | Modify | B3 visual restyle: left border, category chip, Cormorant title, Playfair quota, hairline, footer with dividers |
| `frontend/src/components/views/DashboardView.jsx` | Rewrite | B3 structure: fixed header + tab strip (Feed / Attive / In attesa) |

---

## Task 1: Create redesign-v2 branch

**Files:** none (git only)

- [ ] **Step 1: Create and switch to redesign-v2**

```bash
git checkout -b redesign-v2
```

Expected: `Switched to a new branch 'redesign-v2'`

- [ ] **Step 2: Initial commit**

```bash
git commit --allow-empty -m "chore: init redesign-v2 branch"
```

---

## Task 2: Theme palette — Atoms.jsx

**Files:**
- Modify: `frontend/src/components/Atoms.jsx:8-16`

- [ ] **Step 1: Replace the six theme exports**

In `frontend/src/components/Atoms.jsx`, replace lines 4–16 (the comment block + all six `export const` lines from DARK through PECE) with:

```js
export const ARDESIA = {bg:"#131318",surf:"#1e1e24",card:"#28282e",brd:"#38383e",rule:"rgba(212,200,184,0.12)",soft:"rgba(212,200,184,0.05)",gold:"#c8a870",goldL:"#d8bc88",glow:"rgba(200,168,112,0.20)",grn:"#60c898",red:"#dc4646",blu:"#8898c8",pur:"#9890b8",txt:"#f0ece4",dim:"#908880",mut:"#38383e",inp:"#111116"};
export const CARTA   = {bg:"#e8e0cc",surf:"#f0ece0",card:"#f8f4e8",brd:"#ccc4a8",rule:"rgba(139,94,42,0.16)",soft:"rgba(139,94,42,0.06)",gold:"#8b5e2a",goldL:"#a06e30",glow:"rgba(139,94,42,0.18)",grn:"#2a7a4a",red:"#a02828",blu:"#3a5a9a",pur:"#6a4a9a",txt:"#2a2010",dim:"#7a6848",mut:"#ccc4a8",inp:"#f0ece0"};
export const AMBER   = {bg:"#1f1108",surf:"#2c1810",card:"#3a2118",brd:"#5a3424",rule:"rgba(212,160,98,0.18)",soft:"rgba(212,160,98,0.06)",gold:"#e8b86a",goldL:"#f3cb8a",glow:"rgba(232,184,106,0.24)",grn:"#a8c46c",red:"#ff7a52",blu:"#8fb3d8",pur:"#d49c70",txt:"#f5e6cf",dim:"#c0a181",mut:"#6e4a35",inp:"#23130a"};
export const CASINO  = {bg:"#0a1810",surf:"#142a1c",card:"#1e3c28",brd:"#2e5438",rule:"rgba(232,200,112,0.14)",soft:"rgba(232,200,112,0.05)",gold:"#e8c870",goldL:"#f0d888",glow:"rgba(232,200,112,0.24)",grn:"#58d888",red:"#e07860",blu:"#6898c8",pur:"#a888c0",txt:"#f0ece0",dim:"#688878",mut:"#2e5438",inp:"#081410"};
export const SAKURA  = {bg:"#1e1018",surf:"#2d1828",card:"#3d2038",brd:"#5a3050",rule:"rgba(224,160,192,0.16)",soft:"rgba(224,160,192,0.06)",gold:"#e8b0b0",goldL:"#f0c8c8",glow:"rgba(232,176,176,0.24)",grn:"#a0d888",red:"#ff7070",blu:"#90a8e8",pur:"#c078c0",txt:"#f0d8e8",dim:"#c090a8",mut:"#5a3050",inp:"#190e18"};
export const PECE    = {bg:"#0c0c0e",surf:"#141417",card:"#1c1c20",brd:"#2c2c32",rule:"rgba(240,238,232,0.08)",soft:"rgba(240,238,232,0.03)",gold:"#c8b896",goldL:"#ddd0b8",glow:"rgba(200,184,150,0.18)",grn:"#4ec87a",red:"#e05555",blu:"#7a9ae0",pur:"#a898c8",txt:"#f0eee8",dim:"#888882",mut:"#2c2c32",inp:"#0a0a0c"};
```

- [ ] **Step 2: Verify old names are gone**

```bash
grep -n "export const DARK\|export const LIGHT\|export const SELVA" frontend/src/components/Atoms.jsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Atoms.jsx
git commit -m "feat: themes — Ardesia/Carta/Casinò replace Dark/Light/Selva; Amber/Sakura/Pece unchanged"
```

---

## Task 3: Theme wiring — App.jsx

**Files:**
- Modify: `frontend/src/App.jsx` (lines 5, 626, 628, 633–635, ~811, ~813–820, ~1942)

- [ ] **Step 1: Update the import on line 5**

Replace:
```js
import { DARK, LIGHT, AMBER, SELVA, SAKURA, PECE, rootVars, DEF_CATS, COLORS, VincitWordmark } from './components/Atoms.jsx';
```
With:
```js
import { ARDESIA, CARTA, AMBER, CASINO, SAKURA, PECE, rootVars, DEF_CATS, COLORS, VincitWordmark } from './components/Atoms.jsx';
```

- [ ] **Step 2: Update localStorage theme validation (line 626)**

Replace:
```js
      if (['dark','light','amber','selva','sakura','pece'].includes(v)) return v;
```
With:
```js
      if (['ardesia','carta','amber','casino','sakura','pece'].includes(v)) return v;
```

- [ ] **Step 3: Update default theme (line 628)**

Replace:
```js
    return 'dark';
```
With:
```js
    return 'ardesia';
```

- [ ] **Step 4: Update isDark helpers and theme switch expression (lines 633–635)**

Replace:
```js
  const isDark = theme === 'dark';
  const setIsDark = (v) => setTheme(v ? 'dark' : 'light');
  const C = theme === 'light' ? LIGHT : theme === 'amber' ? AMBER : theme === 'selva' ? SELVA : theme === 'sakura' ? SAKURA : theme === 'pece' ? PECE : DARK;
```
With:
```js
  const isDark = theme !== 'carta';
  const setIsDark = (v) => setTheme(v ? 'ardesia' : 'carta');
  const C = theme === 'carta' ? CARTA : theme === 'amber' ? AMBER : theme === 'casino' ? CASINO : theme === 'sakura' ? SAKURA : theme === 'pece' ? PECE : ARDESIA;
```

- [ ] **Step 5: Add feedEvents state (after the settings state, ~line 810)**

After the line:
```js
  const [syncError,  setSyncError]  = useState(null);
```
Add:
```js
  const [feedEvents, setFeedEvents] = useState([]);
```

- [ ] **Step 6: Handle feedEvents in the useSync callback (~lines 812–820)**

Replace:
```js
  const refresh = useSync(useCallback(data => {
    if (data.profiles)   setProfiles(data.profiles);
    if (data.credits)    setCredits(data.credits);
    if (data.bets)       setBets(data.bets);
    if (data.categories) setCustomCats(data.categories);
    if (data.reactions)  setReactions(data.reactions);
    if (data.settings)   setSettings(data.settings);
    stateLoadedRef.current = true;
  }, []), activeGroupId, token, setSyncError);
```
With:
```js
  const refresh = useSync(useCallback(data => {
    if (data.profiles)   setProfiles(data.profiles);
    if (data.credits)    setCredits(data.credits);
    if (data.bets)       setBets(data.bets);
    if (data.categories) setCustomCats(data.categories);
    if (data.reactions)  setReactions(data.reactions);
    if (data.settings)   setSettings(data.settings);
    if (data.feedEvents) setFeedEvents(data.feedEvents);
    stateLoadedRef.current = true;
  }, []), activeGroupId, token, setSyncError);
```

- [ ] **Step 7: Add feedEvents prop to DashboardView render (~line 1942)**

Find the DashboardView JSX line (it starts with `{view === 'dashboard' && <DashboardView user={user}`). Add `feedEvents={feedEvents}` anywhere in that prop list:

```jsx
{view === 'dashboard' && <DashboardView ... feedEvents={feedEvents} ... />}
```

- [ ] **Step 8: Build to confirm no import errors**

```bash
cd frontend && npm run build 2>&1 | tail -8
```

Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: wire Ardesia/Carta/Casinò themes + feedEvents state"
```

---

## Task 4: Backend — events table (db.js)

**Files:**
- Modify: `backend/db.js` (add migration block before `console.log('DB schema ready')`)

- [ ] **Step 1: Add events table migration**

In `backend/db.js`, find the line `console.log('DB schema ready');` (currently ~line 506). Add the following block immediately **before** that line:

```js
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id             TEXT PRIMARY KEY,
      room_id        TEXT REFERENCES rooms(id) ON DELETE CASCADE,
      event_type     TEXT NOT NULL,
      created_at     BIGINT NOT NULL,
      feed_visible   BOOLEAN DEFAULT false,
      feed_actor_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
      feed_target_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      feed_amount    INTEGER,
      feed_category  TEXT,
      feed_label     TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_room_feed
      ON events(room_id, created_at DESC)
      WHERE feed_visible = true;
  `);
```

- [ ] **Step 2: Restart backend and verify table**

```bash
cd backend && node -e "
  require('dotenv').config();
  require('./db.js');
  setTimeout(async () => {
    const db = require('./db.js');
    const r = await db.query(
      \"SELECT column_name FROM information_schema.columns WHERE table_name='events' ORDER BY ordinal_position\"
    );
    console.log(r.rows.map(x => x.column_name));
    process.exit(0);
  }, 3000);
"
```

Expected output includes: `['id','room_id','event_type','created_at','feed_visible','feed_actor_id','feed_target_id','feed_amount','feed_category','feed_label']`

- [ ] **Step 3: Commit**

```bash
git add backend/db.js
git commit -m "feat: create events table with feed columns"
```

---

## Task 5: Backend — feed events in bets.js

**Files:**
- Modify: `backend/routes/bets.js` (three insertion points)

Note: `crypto` is already imported at the top of bets.js.

- [ ] **Step 1: Write bet_created + challenge_received on POST /**

Find the line `broadcastUpdate(roomId);` in the POST `/` handler (~line 94). Add the following block **after** that line and **before** the push notification block (`// Granular notifications:`):

```js
      // Feed events
      if (!isSecret) {
        try {
          await db.query(
            `INSERT INTO events (id, room_id, event_type, created_at, feed_visible, feed_actor_id, feed_category, feed_label)
             VALUES ($1,$2,'bet_created',$3,true,$4,$5,$6)`,
            [`e_${crypto.randomUUID()}`, roomId, createdAt, creator, category, title]
          );
          if (status === 'pending' && opponent && !surprise) {
            await db.query(
              `INSERT INTO events (id, room_id, event_type, created_at, feed_visible, feed_actor_id, feed_target_id, feed_amount, feed_label)
               VALUES ($1,$2,'challenge_received',$3,true,$4,$5,$6,$7)`,
              [`e_${crypto.randomUUID()}`, roomId, createdAt, creator, opponent, stake, title]
            );
          }
        } catch (e) { console.error('[feed] create events failed', e.message); }
      }
```

- [ ] **Step 2: Write bet_accepted on POST /:id/accept**

Find `broadcastUpdate(req.activeRoomId);` in the accept handler (~line 523). Add the following block **after** that line and **before** the push notification try block:

```js
      // Feed event
      try {
        await db.query(
          `INSERT INTO events (id, room_id, event_type, created_at, feed_visible, feed_actor_id, feed_target_id, feed_label)
           VALUES ($1,$2,'bet_accepted',$3,true,$4,$5,$6)`,
          [`e_${crypto.randomUUID()}`, bet.room_id, Date.now(), req.userId, bet.creator, bet.title]
        );
      } catch (e) { console.error('[feed] bet_accepted event failed', e.message); }
```

- [ ] **Step 3: Write bet_won / bet_lost / bet_resolved_group on PATCH /:id/resolve**

Inside the `if (phase === 'resolved')` block, inside the `if (bet)` check, find the line:

```js
              for (const u of checkIds) refreshAchievements(u);
```

Add the following block **immediately after** that line:

```js
              // Feed events
              try {
                const now = Date.now();
                const winner = outcome === 'won' ? bet.creator : bet.opponent;
                const loser  = outcome === 'won' ? bet.opponent : bet.creator;
                const winAmt = bet.opponent_stake != null
                  ? bet.stake + bet.opponent_stake
                  : bet.potential_win;

                // Personal event for the creator (the one who called resolve)
                await db.query(
                  `INSERT INTO events (id, room_id, event_type, created_at, feed_visible, feed_actor_id, feed_amount, feed_category, feed_label)
                   VALUES ($1,$2,$3,$4,true,$5,$6,$7,$8)`,
                  [`e_${crypto.randomUUID()}`, bet.room_id,
                   outcome === 'won' ? 'bet_won' : 'bet_lost',
                   now, bet.creator,
                   outcome === 'won' ? winAmt : bet.stake,
                   bet.category, bet.title]
                );
                // Personal event for the opponent (if any)
                if (loser && loser !== bet.creator) {
                  await db.query(
                    `INSERT INTO events (id, room_id, event_type, created_at, feed_visible, feed_actor_id, feed_amount, feed_category, feed_label)
                     VALUES ($1,$2,$3,$4,true,$5,$6,$7,$8)`,
                    [`e_${crypto.randomUUID()}`, bet.room_id,
                     outcome === 'won' ? 'bet_lost' : 'bet_won',
                     now, loser,
                     outcome === 'won' ? (bet.opponent_stake ?? bet.stake) : winAmt,
                     bet.category, bet.title]
                  );
                }
                // Group-visible event (everyone can see resolution)
                await db.query(
                  `INSERT INTO events (id, room_id, event_type, created_at, feed_visible, feed_actor_id, feed_category, feed_label)
                   VALUES ($1,$2,'bet_resolved_group',$3,true,$4,$5,$6)`,
                  [`e_${crypto.randomUUID()}`, bet.room_id, now, req.userId, bet.category, bet.title]
                );
              } catch (e) { console.error('[feed] resolve events failed', e.message); }
```

- [ ] **Step 4: Smoke test — create and resolve a bet, then check events table**

Start the backend (`node backend/server.js`) and create a bet via the UI. Then:

```bash
cd backend && node -e "
  require('dotenv').config();
  const db = require('./db.js');
  setTimeout(async () => {
    const r = await db.query('SELECT event_type, feed_label, feed_actor_id FROM events ORDER BY created_at DESC LIMIT 5');
    console.log(r.rows);
    process.exit(0);
  }, 2000);
"
```

Expected: rows with `event_type: 'bet_created'` and the bet title in `feed_label`.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/bets.js
git commit -m "feat: write feed events on bet create/accept/resolve"
```

---

## Task 6: feedEvents in buildState() — state.js

**Files:**
- Modify: `backend/routes/state.js:139–140`

- [ ] **Step 1: Add feedEvents query before the return**

In `backend/routes/state.js`, find line 140:

```js
  return { profiles, credits, bets, categories, reactions, settings };
```

Replace it with:

```js
  const { rows: feedRows } = await db.query(
    `SELECT * FROM events
     WHERE room_id=$1 AND feed_visible=true
       AND (
         event_type IN ('bet_created','bet_resolved_group')
         OR (event_type IN ('bet_won','bet_lost') AND feed_actor_id=$2)
         OR (event_type = 'challenge_received'    AND feed_target_id=$2)
         OR (event_type = 'bet_accepted'          AND feed_target_id=$2)
         OR (event_type IN ('trophy_unlocked','streak_milestone') AND feed_actor_id=$2)
       )
     ORDER BY created_at DESC LIMIT 50`,
    [roomId, viewerId]
  );

  return { profiles, credits, bets, categories, reactions, settings, feedEvents: feedRows };
```

- [ ] **Step 2: Verify the endpoint returns feedEvents**

Start the backend, then fetch state with a valid token:

```bash
curl -s -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/state?groupId=<groupId>" \
  | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log('feedEvents length:', j.feedEvents?.length ?? 'MISSING')"
```

Expected: `feedEvents length: 0` (or a positive number if events exist).

- [ ] **Step 3: Commit**

```bash
git add backend/routes/state.js
git commit -m "feat: include feedEvents in buildState() with privacy filter"
```

---

## Task 7: i18n strings

**Files:**
- Modify: `frontend/src/i18n.js`

- [ ] **Step 1: Add feed strings to the Italian `it` object**

In `frontend/src/i18n.js`, find the closing `}` of the `dashboard:` block inside `it:` (around line 64). Add the following sibling block immediately after:

```js
    feed: {
      bet_won:             'Hai vinto {label}',
      bet_lost:            'Hai perso {label}',
      bet_created:         '{actor} ha creato {label}',
      bet_accepted:        '{actor} ha accettato la tua sfida',
      challenge_received:  '{actor} ti ha sfidato su {label}',
      trophy_unlocked:     'Trofeo sbloccato: {label}',
      bet_resolved_group:  '{actor} ha risolto {label}',
      empty:               'Nessun evento ancora',
    },
```

- [ ] **Step 2: Add tab labels inside the existing `dashboard:` block (`it`)**

Find the `dashboard:` block in the `it:` translation. Add inside it (before its closing `}`):

```js
      tab_feed:    'Feed',
      tab_active:  'Attive',
      tab_pending: 'In attesa',
```

- [ ] **Step 3: Add nav.profile to the `nav:` block (`it`)**

Find `nav:` in the `it:` object and add:

```js
      profile: 'Profilo',
```

- [ ] **Step 4: Mirror the same keys to English `en:`**

Find the `dashboard:` and `nav:` blocks inside `en:` and add:

In `en.dashboard`:
```js
      tab_feed:    'Feed',
      tab_active:  'Active',
      tab_pending: 'Pending',
```

In `en.nav`:
```js
      profile: 'Profile',
```

After `en.dashboard`, add:
```js
    feed: {
      bet_won:             'You won {label}',
      bet_lost:            'You lost {label}',
      bet_created:         '{actor} created {label}',
      bet_accepted:        '{actor} accepted your challenge',
      challenge_received:  '{actor} challenged you on {label}',
      trophy_unlocked:     'Trophy unlocked: {label}',
      bet_resolved_group:  '{actor} resolved {label}',
      empty:               'No events yet',
    },
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/i18n.js
git commit -m "feat: i18n — feed event strings, dashboard tab labels, nav.profile"
```

---

## Task 8: BetCard v2 — B3 visual restyle

**Files:**
- Modify: `frontend/src/components/BetCard.jsx`

The goal is to change the *visual structure* while preserving all existing functionality (swipe, counter-bet, subset, comment thread, reactions, camera, etc.).

**Current outer wrapper (lines 189–208):**
The `return` statement starts with a `<div ref={cardRef} className="sUp" style={{...}}>` that has:
- transparent background, borderBottom hairline, borderTop on resolved
- left-side absolute `<div>` for the accent bar

**New B3 outer wrapper:** solid card bg, 3px left border, no top/bottom borders, rounded corners.

- [ ] **Step 1: Replace the outer wrapper style (lines 189–210)**

Replace:
```jsx
  return(
    <div ref={cardRef} className="sUp" style={{
      position:"relative", overflow:"hidden",
      padding:"22px 0 24px 22px", marginBottom:0,
      borderTop: isResolved ? `4px solid ${resolveColor}` : 'none',
      borderBottom:`1px solid ${deltaX > 40 ? 'var(--grn)55' : deltaX < -40 ? 'var(--red)55' : 'var(--rule)'}`,
      background: isResolved
        ? (bet.status==='won'
            ? 'linear-gradient(160deg, var(--grn)20 0%, var(--grn)0a 42%, transparent 72%)'
            : 'linear-gradient(160deg, var(--red)1c 0%, var(--red)09 42%, transparent 72%)')
        : 'transparent',
      boxShadow: isResolved
        ? (bet.status==='won'
            ? 'inset 0 0 0 1px var(--grn)2a, inset 0 52px 44px -22px var(--grn)14'
            : 'inset 0 0 0 1px var(--red)22, inset 0 52px 44px -22px var(--red)0f')
        : 'none',
      opacity: done ? (bet.status==='won' ? 1 : 0.86) : 1,
      transform: deltaX !== 0 ? `translateX(${Math.max(-60, Math.min(60, deltaX))}px)` : 'none',
      transition: deltaX === 0 ? 'transform .3s ease, border-color .2s, opacity .2s' : 'border-color .1s',
    }}>
      {/* Vertical accent rule — gold for vault, category color otherwise. */}
      <div style={{position:"absolute",left:0,top:22,bottom:24,width:2,background:bet.isSecret?'var(--gold)':sideColor}}/>
```

With:
```jsx
  const b3BorderColor = bet.status === 'won' ? 'var(--grn)'
    : bet.status === 'lost' ? 'var(--red)'
    : bet.isSecret ? 'var(--gold)'
    : sideColor;

  return(
    <div ref={cardRef} className="sUp" style={{
      position:"relative", overflow:"hidden",
      marginBottom:10,
      borderLeft:`3px solid ${b3BorderColor}`,
      borderRadius:12,
      background:"var(--card)",
      opacity: done ? (bet.status==='won' ? 1 : 0.86) : 1,
      transform: deltaX !== 0 ? `translateX(${Math.max(-60, Math.min(60, deltaX))}px)` : 'none',
      transition: deltaX === 0 ? 'transform .3s ease, opacity .2s' : 'none',
    }}>
```

- [ ] **Step 2: Remove the ribbon + stamp block (lines 211–253)**

Delete the entire `{isResolved && (<> ... </>)}` block that contains the "Full-width ribbon" and "Diagonal stamp watermark" comments. These elements are replaced by the B3 quota treatment.

- [ ] **Step 3: Add B3 header before the existing content**

Find the line that opens the main content div (currently `<div style={{...(isDesktop?{display:"flex"...}:{})}}>` around line 255). Add the following **before** that div:

```jsx
      {/* B3 header: category chip + title + quota/result */}
      <div style={{padding:'12px 14px 10px'}}>
        {/* Category chip */}
        <div style={{marginBottom:7}}>
          <span style={{
            display:'inline-block',
            background:`${cat.color}1a`, color:cat.color,
            fontSize:9, fontWeight:600,
            padding:'2px 7px', borderRadius:4,
            letterSpacing:'.04em', textTransform:'uppercase',
          }}>
            {cat.e} {catLabel(cat)}
          </span>
          {bet.isSecret && !done && (
            <span style={{
              marginLeft:4, display:'inline-block',
              background:'var(--gold)1a', color:'var(--gold)',
              fontSize:9, fontWeight:600,
              padding:'2px 7px', borderRadius:4,
              letterSpacing:'.04em', textTransform:'uppercase',
            }}>🔒 Vault</span>
          )}
        </div>

        {/* Title + quota/result */}
        <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
          <div style={{flex:1,minWidth:0}}>
            {bet.isSecret && !done
              ? <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontWeight:600,fontSize:16,color:"var(--gold)"}}>Scommessa privata</div>
              : <div style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:600,fontSize:16,lineHeight:1.3,color:"var(--txt)"}}>{bet.title}</div>
            }
          </div>
          {!bet.isSecret && (
            <div style={{flexShrink:0,textAlign:'right',lineHeight:1}}>
              {done ? (
                <div style={{
                  fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,
                  color: bet.status==='won' ? 'var(--grn)' : 'var(--red)',
                  letterSpacing:'-0.02em',
                }}>
                  {bet.status==='won' ? `+₡ ${bet.potentialWin}` : `-₡ ${bet.stake}`}
                </div>
              ) : (
                <div style={{
                  fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,
                  color:'var(--gold)', letterSpacing:'-0.02em',
                }}>
                  {parseFloat(bet.quota).toFixed(2)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hairline */}
        <div style={{height:1,background:'var(--rule)',marginBottom:8}}/>

        {/* Meta row */}
        <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
          <div style={{display:'flex'}}>
            {[bet.creator,bet.opponent].filter(Boolean).slice(0,2).map((uid,i) => (
              <div key={uid} style={{
                width:22,height:22,borderRadius:'50%',
                background:`${getC(profiles,uid)}33`,
                border:'2px solid var(--card)',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:11, marginLeft: i>0 ? -6 : 0, zIndex:2-i, flexShrink:0,
                overflow:'hidden',
              }}>
                {profiles[uid]?.avatarUrl
                  ? <img src={profiles[uid].avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : profiles[uid]?.avatar}
              </div>
            ))}
          </div>
          <span style={{fontSize:10,color:'var(--dim)',fontFamily:"'Playfair Display',serif"}}>₡ {bet.stake}</span>
          {bet.expiresAt && isSoon(bet.expiresAt) && (
            <span style={{fontSize:10,color:'var(--red)',fontWeight:700}}>⚠ {tLeft(bet.expiresAt,lang)}</span>
          )}
          {!done && !bet.isSecret && (
            <span style={{marginLeft:'auto',fontSize:11,color:'var(--grn)',fontFamily:"'Playfair Display',serif",fontWeight:600}}>
              → ₡ {bet.potentialWin}
            </span>
          )}
        </div>
      </div>
      {/* End B3 header */}
```

- [ ] **Step 4: Wrap remaining body content with padding wrapper**

The existing content block (`<div style={{...(isDesktop?...:{})}}>`) currently starts with no card padding. Since we now have the B3 header with `padding:'12px 14px 10px'`, the remaining sections (badges, counter-bet, subset, comment, pending UI, swipe hint, comment thread, actions) need consistent horizontal padding.

Find the line:
```jsx
      <div style={{...(isDesktop?{display:"flex",alignItems:"flex-start",gap:24}:{})}}>
```

Change its style to include padding:
```jsx
      <div style={{...(isDesktop?{display:"flex",alignItems:"flex-start",gap:24}:{}), padding:'0 14px'}}>
```

- [ ] **Step 5: Replace the B3 footer — add inline footer actions**

Find where the `actions` variable is defined (starts around line 113). Note it's a div with edit/cancel/resolve buttons.

After the closing `</div>` of the main content block (the `{isDesktop&&actions}` line, around line 598–599), add a B3 footer **before** the modals section:

```jsx
      {/* B3 inline footer */}
      {!done && !bet.isSecret && (
        <div style={{display:'flex',borderTop:'1px solid var(--rule)'}}>
          {isPending && bet.opponent === user ? (
            <>
              <button onClick={() => onAccept?.(bet.id)} style={{
                flex:1,padding:8,background:'transparent',border:'none',
                cursor:'pointer',fontFamily:"'Manrope',sans-serif",fontSize:11,fontWeight:700,color:'var(--grn)',letterSpacing:'.03em',
              }}>✓ Accetta</button>
              <button onClick={() => onCounter?.(bet)} style={{
                flex:1,padding:8,background:'transparent',border:'none',borderLeft:'1px solid var(--rule)',
                cursor:'pointer',fontFamily:"'Manrope',sans-serif",fontSize:11,fontWeight:700,color:'var(--pur)',letterSpacing:'.03em',
              }}>↩ Countra</button>
              <button onClick={() => onReject?.(bet.id)} style={{
                flex:1,padding:8,background:'transparent',border:'none',borderLeft:'1px solid var(--rule)',
                cursor:'pointer',fontFamily:"'Manrope',sans-serif",fontSize:11,fontWeight:700,color:'var(--red)',letterSpacing:'.03em',
              }}>✕ Rifiuta</button>
            </>
          ) : bet.status === 'active' && (isParty || (typeof can === 'function' && can('moderate_bets'))) ? (
            <>
              <button onClick={() => onResolve?.(bet)} style={{
                flex:1,padding:8,background:'transparent',border:'none',
                cursor:'pointer',fontFamily:"'Manrope',sans-serif",fontSize:11,fontWeight:700,color:'var(--grn)',letterSpacing:'.03em',
              }}>✓ Risolvi</button>
              <div style={{
                flex:1,padding:8,borderLeft:'1px solid var(--rule)',
                fontFamily:"'Manrope',sans-serif",fontSize:11,fontWeight:600,color:'var(--dim)',
                textAlign:'center',
              }}>💬 {bet.messageCount || ''}</div>
              <button style={{
                flex:1,padding:8,background:'transparent',border:'none',borderLeft:'1px solid var(--rule)',
                cursor:'pointer',fontFamily:"'Manrope',sans-serif",fontSize:11,fontWeight:700,color:'var(--dim)',letterSpacing:'.03em',
              }}>⋯</button>
            </>
          ) : null}
        </div>
      )}
```

- [ ] **Step 6: Start dev server and verify visually**

```bash
cd frontend && npm run dev
```

Open browser in mobile viewport. Navigate to a view with bets.

Expected:
- Cards have left-color border, white/card background, rounded corners
- Category chip at top left
- Cormorant title (16px) on the left, large Playfair number on the right
- Hairline separator + meta row with avatars/stake/win arrow
- Inline footer for active/pending bets
- Resolved bets show +₡/−₡ instead of odds, no footer

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/BetCard.jsx
git commit -m "feat: BetCard v2 — B3 newspaper style (category chip, Cormorant title, Playfair quota, hairline, inline footer)"
```

---

## Task 9: DashboardView B3 — full rewrite

**Files:**
- Rewrite: `frontend/src/components/views/DashboardView.jsx`

- [ ] **Step 1: Replace the entire file contents**

Write the following as the complete new content of `frontend/src/components/views/DashboardView.jsx`:

```jsx
import React, { useState } from 'react';
import { COLORS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import BetCard from '../BetCard.jsx';

function computeStreak(bets, user) {
  const days = new Set();
  for (const b of bets) {
    if (b.creator === user) days.add(new Date(b.createdAt).toDateString());
    if (b.status !== 'active' && b.resolvedAt && (b.creator === user || b.winnerId === user))
      days.add(new Date(b.resolvedAt).toDateString());
  }
  if (days.size === 0) return 0;
  const sorted = Array.from(days).map(d => new Date(d)).sort((a, b) => b - a);
  const today     = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (sorted[0].toDateString() !== today && sorted[0].toDateString() !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (Math.round((sorted[i-1] - sorted[i]) / 86400000) === 1) streak++;
    else break;
  }
  return streak;
}

export default function DashboardView({
  user, profiles, credits, bets, cats, feedEvents = [],
  onCreate,
  onResolve, onCounter, onAccept, onReject, onReveal, onEdit, onDelete,
  onFlame, reactions, onReaction, onReactionPhoto,
  onConfirmOutcome, onWithdrawResolve, onOvertime,
  can, isDesktop, pendingResolveIds, onNotifSeen,
  // kept for prop compat, unused in B3:
  groupMembers, notifSince, onGoToVault, onGoToBets,
  onEggUnlock, onOpenDie, onOpenIceEgg, onOpenPhoenixEgg,
}) {
  const { t } = useLang();
  const [tab, setTab] = useState('feed');

  const myProfile = profiles[user] ?? {};
  const myCredits = credits[user] ?? 0;
  const streak    = computeStreak(bets, user);
  const myColor   = COLORS[myProfile.colorKey] || '#5b8af0';

  const activeBets  = bets.filter(b => b.status === 'active' && !b.isSecret);
  const pendingBets = bets.filter(b =>
    b.status === 'pending' && (b.opponent === user || b.creator === user)
  );

  const totalInPlay    = activeBets.reduce((s, b) => s + b.stake, 0);
  const potentialTotal = activeBets.reduce((s, b) => s + b.potentialWin, 0);
  const sevenDaysAgo   = Date.now() - 7 * 86400000;

  const tabStyle = (id) => ({
    flex: 1, padding: '10px 4px',
    background: 'transparent', border: 'none',
    borderBottom: tab === id ? '2px solid var(--gold)' : '2px solid transparent',
    color: tab === id ? 'var(--gold)' : 'var(--dim)',
    fontFamily: "'Manrope', sans-serif", fontSize: 11, fontWeight: 700,
    letterSpacing: '.06em', textTransform: 'uppercase',
    cursor: 'pointer', position: 'relative',
    transition: 'color .15s, border-color .15s',
  });

  const countBadge = (n, color) => n > 0 ? (
    <span style={{
      marginLeft: 4, display: 'inline-block',
      background: color, color: '#fff', borderRadius: 999,
      fontSize: 8, fontWeight: 700, padding: '0 4px',
      minWidth: 14, height: 14, lineHeight: '14px', textAlign: 'center',
    }}>{n}</span>
  ) : null;

  const feedEventContent = (ev) => {
    const actorName = profiles[ev.feed_actor_id]?.name ?? '…';
    switch (ev.event_type) {
      case 'bet_won':            return { text: t('feed.bet_won',            { label: ev.feed_label ?? '' }), chip: `+₡ ${ev.feed_amount ?? ''}`, chipColor: 'var(--grn)' };
      case 'bet_lost':           return { text: t('feed.bet_lost',           { label: ev.feed_label ?? '' }), chip: `-₡ ${ev.feed_amount ?? ''}`, chipColor: 'var(--red)' };
      case 'bet_created':        return { text: t('feed.bet_created',        { actor: actorName, label: ev.feed_label ?? '' }), chip: ev.feed_category ?? '', chipColor: 'var(--pur)' };
      case 'bet_accepted':       return { text: t('feed.bet_accepted',       { actor: actorName }), chip: null, chipColor: null };
      case 'challenge_received': return { text: t('feed.challenge_received', { actor: actorName, label: ev.feed_label ?? '' }), chip: `₡ ${ev.feed_amount ?? ''}`, chipColor: 'var(--red)' };
      case 'trophy_unlocked':    return { text: t('feed.trophy_unlocked',    { label: ev.feed_label ?? '' }), chip: '🏆', chipColor: 'var(--gold)' };
      case 'bet_resolved_group': return { text: t('feed.bet_resolved_group', { actor: actorName, label: ev.feed_label ?? '' }), chip: ev.feed_category ?? '', chipColor: 'var(--dim)' };
      default:                   return { text: ev.event_type, chip: null, chipColor: null };
    }
  };

  const betCardProps = (b) => ({
    bet: b, user, profiles, cats,
    onResolve, onCounter, onFlame,
    reactions, onReaction, onReactionPhoto,
    onDelete, onEdit, onAccept, onReject,
    can, onReveal, onConfirmOutcome,
    onWithdrawResolve, onOvertime,
    pendingResolve: pendingResolveIds?.has(b.id),
  });

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ padding: '16px 0 0' }}>
        {/* User row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `${myColor}22`, border: `2px solid ${myColor}4d`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0, overflow: 'hidden',
          }}>
            {myProfile.avatarUrl
              ? <img src={myProfile.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : myProfile.avatar}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', lineHeight: 1.2 }}>
              {myProfile.name}
            </div>
            {streak > 0 && (
              <div style={{ fontSize: 11, color: '#e8903f', fontWeight: 600, marginTop: 2 }}>
                🔥 {streak} {t('dashboard.streak')}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 22, fontWeight: 700, color: 'var(--gold)', lineHeight: 1,
            }}>
              {myCredits} <span style={{ fontSize: 13, opacity: .7 }}>₡</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button onClick={onCreate} style={{
          width: '100%', padding: '12px 0',
          background: 'var(--pur)', color: '#fff',
          border: 'none', borderRadius: 9,
          fontFamily: "'Manrope', sans-serif",
          fontSize: 14, fontWeight: 800, cursor: 'pointer',
          letterSpacing: '.02em',
        }}>
          {t('dashboard.cta')}
        </button>
      </div>

      {/* ── Tab strip ──────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--rule)', marginTop: 16 }}>
        <button style={tabStyle('feed')} onClick={() => setTab('feed')}>
          {t('dashboard.tab_feed')}
        </button>
        <button style={tabStyle('active')} onClick={() => setTab('active')}>
          {t('dashboard.tab_active')}
          {countBadge(activeBets.length, 'var(--pur)')}
        </button>
        <button style={tabStyle('pending')} onClick={() => setTab('pending')}>
          {t('dashboard.tab_pending')}
          {countBadge(pendingBets.length, 'var(--red)')}
        </button>
      </div>

      {/* ── Tab content ────────────────────────────────────── */}
      <div style={{ paddingTop: 14 }}>

        {/* Feed */}
        {tab === 'feed' && (
          <div>
            {feedEvents.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--dim)', fontSize: 13, padding: '32px 0' }}>
                {t('feed.empty')}
              </div>
            )}
            {feedEvents.map(ev => {
              const { text, chip, chipColor } = feedEventContent(ev);
              const actorP = profiles[ev.feed_actor_id];
              const actorColor = actorP ? (COLORS[actorP.colorKey] || '#5b8af0') : '#5b8af0';
              const isOld = ev.created_at < sevenDaysAgo;
              return (
                <div key={ev.id} style={{
                  display: 'flex', gap: 9, padding: '9px 0',
                  borderBottom: '1px solid var(--rule)',
                  opacity: isOld ? 0.4 : 1,
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: `${actorColor}22`, border: `1px solid ${actorColor}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, overflow: 'hidden',
                  }}>
                    {actorP?.avatarUrl
                      ? <img src={actorP.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : actorP?.avatar}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--txt)', lineHeight: 1.4 }}>{text}</div>
                    {chip && (
                      <div style={{ marginTop: 3 }}>
                        <span style={{
                          display: 'inline-block', padding: '1px 6px', borderRadius: 4,
                          fontSize: 9, fontWeight: 600,
                          background: chipColor ? `${chipColor}1a` : 'var(--soft)',
                          color: chipColor ?? 'var(--dim)',
                        }}>{chip}</span>
                      </div>
                    )}
                    <div style={{ fontSize: 8, color: 'var(--dim)', marginTop: 2 }}>
                      {new Date(ev.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Attive */}
        {tab === 'active' && (
          <div>
            {activeBets.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--dim)', fontSize: 13, padding: '32px 0' }}>
                {t('dashboard.no_active')}
              </div>
            )}
            {activeBets.map(b => <BetCard key={b.id} {...betCardProps(b)} />)}
            {activeBets.length > 0 && (
              <div style={{ borderTop: '1px solid var(--rule)', marginTop: 10, paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: 'var(--dim)' }}>Totale in gioco</span>
                  <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600 }}>₡ {totalInPlay}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--dim)' }}>Potenziale vincita</span>
                  <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, color: 'var(--grn)' }}>₡ {potentialTotal}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* In attesa */}
        {tab === 'pending' && (
          <div>
            {pendingBets.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--dim)', fontSize: 13, padding: '32px 0' }}>
                Nessuna bet in attesa
              </div>
            )}
            {pendingBets.map(b => <BetCard key={b.id} {...betCardProps(b)} />)}
          </div>
        )}

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Start dev server and verify**

```bash
cd frontend && npm run dev
```

Navigate to Dashboard. Verify:
- Header shows avatar (36px circle), name, streak (if > 0), credits in Playfair
- CTA button is full-width purple
- Three tabs render below
- Feed tab shows empty state or events
- Attive tab shows active non-secret bets using the new BetCard
- In attesa tab shows pending bets with Accetta/Countra/Rifiuta footer

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/views/DashboardView.jsx
git commit -m "feat: DashboardView B3 — header + Feed/Attive/In attesa tabs"
```

---

## Task 10: Glass pill nav + content swipe — App.jsx

**Files:**
- Modify: `frontend/src/App.jsx` (lines ~1676–1685 and ~1967–2070)

- [ ] **Step 1: Simplify NAV to 5 items (line ~1676)**

Replace:
```js
  const NAV = [
    { id: 'dashboard', e: '🏠', l: t('nav.dashboard') },
    { id: 'bets', e: '🎯', l: t('nav.bets') },
    { id: 'stats', e: '📊', l: t('nav.stats') },
    { id: 'friends', e: '👥', l: t('nav.friends') },
    { id: 'trophies', e: '🏆', l: t('nav.trophies') },
    ...(authUser?.is_admin ? [{ id: 'admin', e: '🛠️', l: 'Admin' }] : []),
    { id: 'settings', e: '⚙️', l: t('nav.settings') },
  ];
```
With:
```js
  const NAV = [
    { id: 'dashboard', e: '🏠', l: t('nav.dashboard') },
    { id: 'bets',      e: '🎯', l: t('nav.bets') },
    { id: 'stats',     e: '📊', l: t('nav.stats') },
    { id: 'trophies',  e: '🏆', l: t('nav.trophies') },
    { id: 'settings',  e: '👤', l: t('nav.profile') },
  ];
```

- [ ] **Step 2: Add content-area horizontal swipe (after the back-gesture effect, ~line 1592)**

Find the return statement of the back-gesture `useEffect` (ending with `}, [isDesktop]);`). Add the following NEW `useEffect` immediately after:

```js
  // Horizontal swipe on content area: left = next nav item, right = previous.
  // Starts outside the 22px left-edge zone reserved for the back gesture.
  useEffect(() => {
    if (isDesktop) return;
    const EDGE   = 22;
    const THRESH = 90;
    const VERT   = 40;
    const s = { startX: null, startY: null, locked: false };

    const onStart = e => {
      const x = e.touches[0].clientX;
      if (x <= EDGE) return;
      s.startX = x; s.startY = e.touches[0].clientY; s.locked = false;
    };
    const onMove = e => {
      if (s.startX === null) return;
      const dx = e.touches[0].clientX - s.startX;
      const dy = Math.abs(e.touches[0].clientY - s.startY);
      if (dy > VERT) { s.startX = null; return; }
      if (Math.abs(dx) > 10) { s.locked = true; e.preventDefault(); }
    };
    const onEnd = e => {
      if (!s.locked || s.startX === null) return;
      const dx = e.changedTouches[0].clientX - s.startX;
      s.startX = null; s.locked = false;
      if (Math.abs(dx) < THRESH) return;
      const ids = navRef.current.map(n => n.id);
      const cur = ids.indexOf(view);
      if (cur < 0) return;
      const next = dx < 0 ? ids[cur + 1] : ids[cur - 1];
      if (next) setView(next);
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove',  onMove,  { passive: false });
    document.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove',  onMove);
      document.removeEventListener('touchend',   onEnd);
    };
  }, [isDesktop, view]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Replace the mobile nav with the glass pill**

Find the entire `{!isDesktop && (<div ref={setNavBarEl} style={{...}}>...</div>)}` block (starting ~line 1967) and replace it with:

```jsx
      {/* Glass pill nav — mobile only */}
      {!isDesktop && (
        <div ref={setNavBarEl} style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480,
          padding: `0 14px calc(18px + env(safe-area-inset-bottom))`,
          zIndex: 50, pointerEvents: 'none',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            background: `${C.surf}a6`,
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            borderRadius: 22,
            border: '1px solid var(--rule)',
            boxShadow: '0 8px 32px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,.15)',
            padding: '8px 10px',
            pointerEvents: 'all',
          }}>
            {NAV.map((n, idx) => {
              const isActive = view === n.id;
              const isSwipeFocus = navSwipeIdx === idx;
              const pendingDot = n.id === 'bets' && bets.some(b =>
                b.status === 'pending' && (b.opponent === user || b.creator === user)
              );
              return (
                <div key={n.id} data-navswipe={idx}
                  onClick={() => view === n.id
                    ? window.scrollTo({ top: 0, behavior: 'smooth' })
                    : setView(n.id)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 2, padding: '5px 3px',
                    cursor: 'pointer', borderRadius: 14,
                    background: isActive ? `${C.gold}1a` : 'transparent',
                    transition: 'background .18s',
                    position: 'relative', userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                  <span style={{
                    fontSize: 20, lineHeight: 1,
                    filter: isActive || isSwipeFocus
                      ? `drop-shadow(0 0 6px ${C.glow})`
                      : 'none',
                    transform: isActive ? 'translateY(-1px)' : 'none',
                    transition: 'filter .2s, transform .15s',
                  }}>{n.e}</span>
                  {pendingDot && (
                    <div style={{
                      position: 'absolute', top: 2, right: '14%',
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--red)', border: `2px solid ${C.surf}`,
                    }}/>
                  )}
                  <span style={{
                    fontSize: 7, fontWeight: 700, letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    color: isActive ? 'var(--gold)' : 'var(--dim)',
                    opacity: isActive ? 1 : 0.7,
                    transition: 'color .2s, opacity .2s',
                  }}>{n.l}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
```

- [ ] **Step 4: Update bottom padding for the shorter pill (line ~1673)**

Replace:
```js
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
```
With:
```js
        paddingBottom: 'calc(84px + env(safe-area-inset-bottom))',
```

- [ ] **Step 5: Verify glass pill in mobile viewport**

```bash
cd frontend && npm run dev
```

Open Chrome DevTools → mobile device mode. Verify:
- Glass pill floats 18px above the bottom edge, not full-width
- Tapping each item navigates to the correct view
- Active item has gold background highlight and drop-shadow on icon
- Bets item shows red dot badge if pending bets exist
- Horizontal swipe on content area changes views
- Back-gesture (right swipe from left edge) still closes modals

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: glass pill nav (frosted glass, 5 items, swipe) + content-area swipe gesture"
```

---

## Self-Review

### Spec Coverage

| Spec §  | Requirement | Task |
|---|---|---|
| §1 | Branch redesign-v2 | Task 1 ✅ |
| §2 | Dashboard header (avatar + streak + credits + CTA) | Task 9 ✅ |
| §2 | Tab strip Feed / Attive / In attesa | Task 9 ✅ |
| §2 | Feed tab with event items | Task 9 ✅ |
| §2 | Attive tab with BetCards + summary totals | Task 9 ✅ |
| §2 | In attesa tab with Accetta/Countra/Rifiuta | Tasks 8+9 ✅ |
| §3 | BetCard left border (category color) | Task 8 ✅ |
| §3 | Category chip 9px at top | Task 8 ✅ |
| §3 | Cormorant title 16px | Task 8 ✅ |
| §3 | Playfair quota 28px (no "@") | Task 8 ✅ |
| §3 | Hairline separator | Task 8 ✅ |
| §3 | Footer with dividers: Risolvi / 💬 / ⋯ | Task 8 ✅ |
| §3 | Resolved: +₡/−₡ replaces quota | Task 8 ✅ |
| §4 | Glass pill nav | Task 10 ✅ |
| §4 | 5 nav items | Task 10 ✅ |
| §4 | Active state: gold bg + drop-shadow | Task 10 ✅ |
| §4 | Pending dot badge on Bets | Task 10 ✅ |
| §4 | Swipe between sections | Task 10 ✅ |
| §5 | events table | Task 4 ✅ |
| §5 | bet_created / challenge_received events | Task 5 ✅ |
| §5 | bet_accepted event | Task 5 ✅ |
| §5 | bet_won / bet_lost / bet_resolved_group events | Task 5 ✅ |
| §5 | trophy_unlocked event | ⚠ deferred |
| §5 | feedEvents in buildState() | Task 6 ✅ |
| §5 | Privacy filter in feedEvents query | Task 6 ✅ |
| §6 | ARDESIA, CARTA, CASINÒ themes | Tasks 2+3 ✅ |
| §6 | AMBER, SAKURA, PECE unchanged | Task 2 ✅ |
| §7 | i18n feed strings + tab labels | Task 7 ✅ |

**Known gap — trophy_unlocked:** The `/api/achievements` route is mounted without `resolveActiveRoom`, so `req.activeRoomId` is unavailable. Writing the event would require a lookup of the user's group(s) — ambiguous for multi-group users. Deferred to a follow-up task.

### Placeholder scan
No TBD, no TODO, no incomplete code blocks.

### Type consistency
- `feedEvents` flows: `buildState()` returns `feedRows` (raw DB rows) → `data.feedEvents` → React state `feedEvents: Row[]` → DashboardView prop `feedEvents` → iterated with `ev.feed_actor_id`, `ev.feed_label`, `ev.created_at` — all match the events table column names.
- Theme keys: `['ardesia','carta','amber','casino','sakura','pece']` validated in localStorage; switch expression covers all 6; imports match Atoms.jsx exports.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-16-vincit-redesign-v2.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — run tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach?
