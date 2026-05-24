# Redesign-v2 Regression Hotfix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four regressions the `redesign-v2` merge shipped to production (duplicated BetCard content, unreachable Friends/Admin views, over-eager content swipe, dead/hardcoded B3 footer) and redeploy.

**Architecture:** Frontend-only edits. BetCard keeps the new B3 header as the canonical place for title/category/primary-number and drops the duplicated legacy bits plus the half-baked B3 footer; navigation to Friends/Admin is restored via rows inside the Profilo (settings) view; the document-level swipe gesture is scoped so it ignores horizontally-scrollable elements and open modals.

**Tech Stack:** React 18 + Vite 5, inline styles, i18n via `useLang()`. No unit-test harness exists in the frontend (verified: no vitest/jest, no test files), so each task verifies with `npm run build` (catches syntax/import errors) plus an explicit code-review checklist; final visual verification happens on production after redeploy.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/components/BetCard.jsx` | Modify | A1+A5: keep B3 header, drop B3 footer, de-duplicate legacy block |
| `frontend/src/App.jsx` | Modify | A4: scope swipe gesture; A2/A3: pass `onNavigate` + `pendingFriendCount` to SettingsView |
| `frontend/src/components/views/SettingsView.jsx` | Modify | A2/A3: add Amici + Admin navigation rows |
| `frontend/src/i18n.js` | Modify | A2/A3: add `settings.nav_section` / `nav_friends` / `nav_admin` (IT + EN) |

---

## Task 1: Create hotfix branch

**Files:** none (git only)

- [ ] **Step 1: Branch off main**

```bash
git checkout main
git checkout -b hotfix-redesign-regressions
```

Expected: `Switched to a new branch 'hotfix-redesign-regressions'`

---

## Task 2: A1 + A5 — De-duplicate BetCard

**Files:**
- Modify: `frontend/src/components/BetCard.jsx`

The redesign added a B3 header (~lines 206–292) and a B3 footer (~lines 640–676) without removing the legacy equivalents. These five edits keep the B3 header, drop the B3 footer, and remove only the legacy pieces the header now covers. Everything else in the legacy block stays.

- [ ] **Step 1: B3 header — show the primary number for active bets only**

In the B3 header "Title + quota/result" block, replace this (the `{!bet.isSecret && (...)}` right column with the `done ?` ternary):

```jsx
          {!bet.isSecret && (
            <div style={{flexShrink:0,textAlign:'right',lineHeight:1}}>
              {done ? (
                <div style={{
                  fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,
                  color: bet.status==='won' ? 'var(--grn)' : 'var(--red)',
                  letterSpacing:'-0.02em',
                }}>
                  {bet.status==='won' ? `+₡ ${bet.potentialWin}` : `-₡ ${bet.stake}`}
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
```

With (drops the `done` branch — the resolved result stays in the legacy result badge, which handles pot-mode correctly):

```jsx
          {!bet.isSecret && !done && (
            <div style={{flexShrink:0,textAlign:'right',lineHeight:1}}>
              <div style={{
                fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,
                color:'var(--gold)', letterSpacing:'-0.02em',
              }}>
                {parseFloat(bet.quota).toFixed(2)}
              </div>
            </div>
          )}
```

- [ ] **Step 2: B3 header — remove the duplicate expiry warning**

In the B3 header "Meta row", remove this block (the legacy `⏱ {tl}` badge below already shows time-left):

```jsx
          {bet.expiresAt && isSoon(bet.expiresAt) && (
            <span style={{fontSize:10,color:'var(--red)',fontWeight:700}}>⚠ {tLeft(bet.expiresAt,lang)}</span>
          )}
```

- [ ] **Step 3: Legacy title row — strip the duplicated title/category/win, keep date + creator + star**

Replace the legacy "Title row" block (opens with `<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:10}}>` and contains the 22px title, the category/date meta, the star button, and the mobile win amount):

```jsx
          {/* Title row */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:10}}>
            <div style={{flex:1,minWidth:0}}>
              {bet.isSecret&&!done
                ?<div style={{...S.row,gap:8}}><span style={{fontSize:18}}>🔒</span><span style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontWeight:600,fontSize:22,color:"var(--gold)"}}>{t('bet_card.secret_label')}</span></div>
                :<div style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:600,fontSize:22,lineHeight:1.18,letterSpacing:'-0.005em'}}>{bet.title}</div>
              }
              <div style={{fontSize:9,color:"var(--dim)",marginTop:8,letterSpacing:'.22em',textTransform:'uppercase',fontWeight:600}}>
                <span style={{color:cat.color}}>{cat.e}</span> {catLabel(cat)} · {fmtD(bet.createdAt,lang)}
                {!isOwner&&<span style={{color:getC(profiles,bet.creator)}}> · {profiles[bet.creator]?.name}</span>}
              </div>
            </div>
            {/* Right column: star bookmark + win amount (mobile non-secret) */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',flexShrink:0,gap:2}}>
              <button onClick={toggleSave} title={isSaved ? 'Rimuovi dai preferiti' : 'Salva bet'} style={{
                background:'transparent', border:'none', cursor:'pointer',
                padding:'2px 4px', fontSize:18, lineHeight:1,
                color: isSaved ? 'var(--gold)' : 'var(--dim)',
                opacity: isSaved ? 1 : 0.4,
                WebkitTapHighlightColor:'transparent', touchAction:'manipulation',
                transition:'color .15s, opacity .15s',
              }}>{isSaved ? '★' : '☆'}</button>
              {!isDesktop&&!bet.isSecret&&<div style={{textAlign:"right",paddingTop:2}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:"var(--grn)",lineHeight:1,letterSpacing:'-0.02em'}}>
                  {bet.potentialWin}<span style={{fontSize:13,opacity:.7,marginLeft:3}}>₡</span>
                </div>
                <div className="bc-meta" style={{fontSize:7,marginTop:3}}>{t('bet_card.win')}</div>
              </div>}
            </div>
          </div>
```

With (title gone → B3 header; category gone → B3 chip; mobile win gone → B3 `→ ₡` arrow; date + creator + star kept):

```jsx
          {/* Title row — title/category/win now live in the B3 header above;
              keep only the date · creator line and the star bookmark. */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:9,color:"var(--dim)",letterSpacing:'.22em',textTransform:'uppercase',fontWeight:600}}>
                {fmtD(bet.createdAt,lang)}
                {!isOwner&&<span style={{color:getC(profiles,bet.creator)}}> · {profiles[bet.creator]?.name}</span>}
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',flexShrink:0,gap:2}}>
              <button onClick={toggleSave} title={isSaved ? 'Rimuovi dai preferiti' : 'Salva bet'} style={{
                background:'transparent', border:'none', cursor:'pointer',
                padding:'2px 4px', fontSize:18, lineHeight:1,
                color: isSaved ? 'var(--gold)' : 'var(--dim)',
                opacity: isSaved ? 1 : 0.4,
                WebkitTapHighlightColor:'transparent', touchAction:'manipulation',
                transition:'color .15s, opacity .15s',
              }}>{isSaved ? '★' : '☆'}</button>
            </div>
          </div>
```

- [ ] **Step 4: Remove the duplicate stake + win badges**

In the badges container, remove this single line (stake `₡` and win `₡` now live in the B3 meta row):

```jsx
            {!bet.isSecret&&<><Bdg bg="var(--mut)44" c="var(--dim)">{t('bet_card.stake')} {bet.stake} ₡</Bdg><Bdg bg="var(--grn)22" c="var(--grn)">{t('bet_card.win')} {bet.potentialWin} ₡</Bdg></>}
```

Leave every other badge in that container untouched (pegno, surprise, targeted, target, timeleft `⏱`, pending, rejected, subset, pot, and the resolved-result badge).

- [ ] **Step 5: Remove the B3 footer entirely (also fixes A5)**

Delete the whole B3 footer block — the comment `{/* B3 inline footer */}` and the `{!done && !bet.isSecret && (...)}` element that renders the Accetta/Countra/Rifiuta or Risolvi/💬/⋯ row. It sits between the closing `</div>` of the main content wrapper and the `{photoCaptureOpen && (` modal block:

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

- [ ] **Step 6: Build**

```bash
cd frontend && npm run build 2>&1 | tail -6
```

Expected: `✓ built in …` with no errors.

- [ ] **Step 7: Review checklist (read the edited return once)**

Confirm: title rendered once (B3 header), category once (B3 chip), stake/win once (B3 meta), date+creator line present, star button present, resolved cards show the result once (legacy result badge, no B3 number), no `⋯`, no hardcoded `✓ Accetta`/`Risolvi` footer strings remain. The legacy pending UI (`{isPending&&...}` accept/reject), `actions` (resolve/edit/cancel), counter section, reactions, consensual strip, and comment thread are all still present.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/BetCard.jsx
git commit -m "fix: BetCard — drop duplicate legacy title/category/stake/win + remove B3 footer (A1/A5)"
```

---

## Task 3: A4 — Scope the content-swipe gesture

**Files:**
- Modify: `frontend/src/App.jsx` (the horizontal-swipe `useEffect`, currently ~lines 1599–1638)

- [ ] **Step 1: Guard onStart against modals and scrollable elements**

In the swipe `useEffect`, replace the `onStart` handler:

```js
    const onStart = e => {
      const x = e.touches[0].clientX;
      if (x <= EDGE) return;
      s.startX = x; s.startY = e.touches[0].clientY; s.locked = false;
    };
```

With:

```js
    const onStart = e => {
      // A modal is open → its close function is parked here. Don't let a
      // horizontal swipe change the view behind the modal.
      if (closeTopModalRef.current) return;
      const x = e.touches[0].clientX;
      if (x <= EDGE) return;
      // Don't hijack swipes that begin inside a horizontally scrollable
      // element (e.g. the BetsView filter-pill row) — let it scroll.
      for (let el = e.target; el && el !== document.body; el = el.parentElement) {
        if (!(el instanceof Element)) break;
        const ov = getComputedStyle(el).overflowX;
        if ((ov === 'auto' || ov === 'scroll') && el.scrollWidth > el.clientWidth) return;
      }
      s.startX = x; s.startY = e.touches[0].clientY; s.locked = false;
    };
```

- [ ] **Step 2: Guard onEnd in case a modal opened mid-gesture**

Replace the first line of the `onEnd` handler:

```js
    const onEnd = e => {
      if (!s.locked || s.startX === null) return;
```

With:

```js
    const onEnd = e => {
      if (!s.locked || s.startX === null) return;
      if (closeTopModalRef.current) { s.startX = null; s.locked = false; return; }
```

- [ ] **Step 3: Build**

```bash
cd frontend && npm run build 2>&1 | tail -6
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "fix: content swipe ignores scrollable rows + open modals (A4)"
```

---

## Task 4: A2 / A3 — Restore Friends + Admin access in Profilo

**Files:**
- Modify: `frontend/src/i18n.js`
- Modify: `frontend/src/components/views/SettingsView.jsx`
- Modify: `frontend/src/App.jsx:2002`

- [ ] **Step 1: Add i18n keys (IT)**

In `frontend/src/i18n.js`, inside the `it:` translation's `settings:` object, add these three keys (place them next to the other `settings.*` entries):

```js
      nav_section: 'Naviga',
      nav_friends: 'Amici',
      nav_admin:   'Admin',
```

- [ ] **Step 2: Add i18n keys (EN)**

In the `en:` translation's `settings:` object, add:

```js
      nav_section: 'Navigate',
      nav_friends: 'Friends',
      nav_admin:   'Admin',
```

- [ ] **Step 3: Add props to the SettingsView signature**

In `frontend/src/components/views/SettingsView.jsx`, change the function signature (line 31). Replace:

```js
export default function SettingsView({user,profiles,groupMembers,isDark,setIsDark,theme,setTheme,customCats,credits,bets,onUpdateProfile,onCreateCategory,onDeleteCategory,vaultPin,onSetVaultPin,isDesktop,onReset,onTestReset,onLogout,onOpenProfileEdit,isAdmin=false,can}){
```

With (adds `onNavigate` and `pendingFriendCount=0`):

```js
export default function SettingsView({user,profiles,groupMembers,isDark,setIsDark,theme,setTheme,customCats,credits,bets,onUpdateProfile,onCreateCategory,onDeleteCategory,vaultPin,onSetVaultPin,isDesktop,onReset,onTestReset,onLogout,onOpenProfileEdit,isAdmin=false,can,onNavigate,pendingFriendCount=0}){
```

- [ ] **Step 4: Insert the navigation rows**

In `frontend/src/components/views/SettingsView.jsx`, find the closing of the first-visit intro block (the `)}` that ends `{!introDismissed && (...)}`) immediately followed by `{/* LANGUAGE */}`. Insert this block between them:

```jsx
      {/* QUICK NAV — Amici / Admin live here because the bottom nav was
          trimmed to 5 items and no longer carries them. */}
      {onNavigate && (
        <>
          <SecLabel>{t('settings.nav_section')}</SecLabel>
          <div
            onClick={() => onNavigate('friends')}
            role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('friends'); } }}
            style={{...S.card, marginBottom:0, display:'flex', alignItems:'center', gap:12, cursor:'pointer', WebkitTapHighlightColor:'transparent'}}>
            <span style={{fontSize:20,flexShrink:0}} aria-hidden>👥</span>
            <span style={{flex:1,fontSize:15,fontWeight:600,color:'var(--txt)'}}>{t('settings.nav_friends')}</span>
            {pendingFriendCount > 0 && (
              <span style={{background:'var(--red)',color:'#fff',borderRadius:999,fontSize:10,fontWeight:700,padding:'1px 7px',minWidth:18,textAlign:'center'}}>{pendingFriendCount}</span>
            )}
            <span style={{color:'var(--dim)',fontSize:16}} aria-hidden>›</span>
          </div>
          {isAdmin && (
            <div
              onClick={() => onNavigate('admin')}
              role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('admin'); } }}
              style={{...S.card, display:'flex', alignItems:'center', gap:12, cursor:'pointer', WebkitTapHighlightColor:'transparent'}}>
              <span style={{fontSize:20,flexShrink:0}} aria-hidden>🛠️</span>
              <span style={{flex:1,fontSize:15,fontWeight:600,color:'var(--txt)'}}>{t('settings.nav_admin')}</span>
              <span style={{color:'var(--dim)',fontSize:16}} aria-hidden>›</span>
            </div>
          )}
        </>
      )}

```

- [ ] **Step 5: Pass the new props from App.jsx**

In `frontend/src/App.jsx:2002`, the SettingsView render currently ends with `... isAdmin={isAdmin} can={can} />}`. Add `onNavigate={setView}` and `pendingFriendCount={pendingFriendCount}` to the prop list:

```jsx
            {view === 'settings'  && <SettingsView user={user} profiles={profiles} groupMembers={groupMembers} isDark={isDark} setIsDark={setIsDark} theme={theme} setTheme={setTheme} customCats={customCats} credits={credits} bets={bets} onUpdateProfile={handleUpdateProfile} onCreateCategory={handleCreateCategory} onDeleteCategory={handleDeleteCategory} vaultPin={vaultPin} onSetVaultPin={handleSetVaultPin} isDesktop={isDesktop} onReset={handleReset} onTestReset={handleTestReset} onLogout={handleLogout} onOpenProfileEdit={() => setShowProfileEdit(true)} isAdmin={isAdmin} can={can} onNavigate={setView} pendingFriendCount={pendingFriendCount} />}
```

- [ ] **Step 6: Build**

```bash
cd frontend && npm run build 2>&1 | tail -6
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/i18n.js frontend/src/components/views/SettingsView.jsx frontend/src/App.jsx
git commit -m "fix: restore Amici/Admin access via Profilo rows (A2/A3)"
```

---

## Task 5: Verify, merge, deploy

**Files:** none (build + git)

- [ ] **Step 1: Full production build**

```bash
cd frontend && npm run build 2>&1 | tail -8
```

Expected: `✓ built in …`, no errors.

- [ ] **Step 2: Merge to main**

```bash
git checkout main
git merge --no-ff hotfix-redesign-regressions -m "Merge hotfix: redesign-v2 regressions (A1-A5)"
```

- [ ] **Step 3: Push (triggers Render redeploy)**

```bash
git push origin main
```

- [ ] **Step 4: Post-deploy visual verification**

After Render finishes redeploying (~30–60s; cold start may add ~20–30s), open the app on a mobile viewport and confirm:
- A bet card shows title / category / stake / win each exactly once; no `⋯` button; resolved cards show the result once.
- Pending bets show Accetta / Rifiuta; active owned bets show the resolve action; counter, reactions, and comment thread still work.
- Profilo shows an "Amici" row (with pending-request badge when applicable) and, for an admin account, an "Admin" row; both open the respective view.
- On the Bets view, the filter-pill row scrolls horizontally without switching views; a horizontal swipe inside an open modal does not change the view behind it.

---

## Self-Review

### Spec coverage

| Spec item | Task |
|---|---|
| A1 — keep B3 header, drop B3 footer, de-dup legacy | Task 2 (Steps 1–5) ✅ |
| A1 — title/category/stake/win shown once | Task 2 Steps 1,3,4 ✅ |
| A1 — keep functional legacy sections | Task 2 Step 7 review ✅ |
| A2 — Friends reachable | Task 4 Steps 4,5 ✅ |
| A3 — Admin reachable (admins only) | Task 4 Step 4 (`isAdmin &&`) ✅ |
| A4 — swipe ignores scrollable rows | Task 3 Step 1 ✅ |
| A4 — swipe suppressed with modal open | Task 3 Steps 1,2 ✅ |
| A5 — dead `⋯` + hardcoded labels removed | Task 2 Step 5 ✅ |
| Delivery — branch → build → merge → push | Tasks 1, 5 ✅ |

### Placeholder scan
No TBD/TODO; every code step contains the full before/after code.

### Type consistency
- `onNavigate` (prop) is wired to `setView` (App.jsx) and called as `onNavigate('friends'|'admin')` — both are valid `view` ids already rendered at App.jsx:2000–2001.
- `pendingFriendCount` exists in App.jsx (state, ~line 903) and is passed through; defaulted to `0` in SettingsView.
- `closeTopModalRef` is in scope of the swipe `useEffect` (same component) and is `null` when no modal is open — correct truthiness gate.
- i18n keys `settings.nav_section` / `nav_friends` / `nav_admin` are added in both `it` and `en` and referenced via `t('settings.nav_*')`.
