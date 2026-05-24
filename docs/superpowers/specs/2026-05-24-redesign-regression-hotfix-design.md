# Redesign-v2 Regression Hotfix — Design

**Date:** 2026-05-24
**Status:** approved (design decisions confirmed with user)

## Problem

The `redesign-v2` branch was merged into `main` and deployed to production. The merge introduced regressions that are **live in production now**. Workstream "A" from the audit fixes them. The other audit workstreams (C privacy, B credits, D reliability, E polish) are explicitly **out of scope** for this hotfix and remain tracked for later.

## Scope — the five A-items

### A1 — BetCard renders everything twice
`frontend/src/components/BetCard.jsx`. The redesign added a new "B3" header (~lines 206–292) and a B3 footer (~lines 640–676) **additively**, without removing the equivalent legacy elements. Result: every card shows title, category, stake, win, and accept/reject/resolve actions twice.

**Decision: keep the B3 header, drop the B3 footer, de-duplicate the legacy block.**

- **B3 header is canonical** for: category chip, title (Cormorant), and the primary number (quota when active, `+₡`/`−₡` result when done), avatars, stake, potential-win arrow.
- **Remove the B3 footer entirely** (the `{!done && !bet.isSecret && (<div ...flex...borderTop...>)}` block, ~640–676). This block has hardcoded Italian labels and a dead `⋯` button — removing it also resolves **A5**. The legacy block already provides accept/reject (pending UI), resolve/edit/cancel (`actions`), and counter — all fully translated and battle-tested.
- **De-duplicate the legacy content block** by removing only the parts the B3 header now covers:
  - The duplicate title rendering and the category/date meta line in the legacy title row. **Keep** the star/bookmark button.
  - The mobile win-amount number (duplicated by the B3 `→ ₡` arrow).
  - The stake badge and win badge (`{t('bet_card.stake')}…` / `{t('bet_card.win')}…`).
  - The resolved-result number shown in the B3 header makes the simple case redundant; keep the richer legacy resolved-result badge **only** where it adds detail the header lacks (pot breakdown). Avoid showing the same `+₡/−₡` twice on resolved cards.
  - Remove the B3 header's "soon" expiry warning OR the legacy timeleft badge so expiry time is shown once.
- **Keep** (functional, not covered by B3): pegno / surprise / targeted / target / pending / rejected / subset / pot badges, invited-members stack, resolution comment, counter-bet YES/NO UI, reactions (emoji + photo), consensual-resolve strip, pending-acceptance UI, swipe hint, comment thread, actions (resolve/edit/cancel).

**Acceptance:** on a normal active bet, title/category/stake/win each appear exactly once; accept/reject (pending) and resolve (active) each appear once via the legacy UI; resolved cards show the result once; all interactions (counter, dispute, reactions, comment thread, subset edit) still work.

### A2 / A3 — FriendsView and AdminView unreachable
`frontend/src/App.jsx`. The glass-pill nav was reduced to 5 items (dashboard / bets / stats / trophies / settings). Nothing calls `setView('friends')` or `setView('admin')`, so both views (still rendered at App.jsx ~2000–2001) are dead from the UI — admins included.

**Decision: add entry points inside the Profilo (settings) view.**

- In `frontend/src/components/views/SettingsView.jsx`, add an **"Amici"** row that navigates to the friends view, showing the pending-friend-request count badge.
- Add an **"Admin"** row, rendered only when the current user `is_admin`, that navigates to the admin view.
- Wire the needed props from `App.jsx` into SettingsView: a navigation callback (e.g. `onNavigate(view)` / reuse `setView`), `pendingFriendCount`, and `isAdmin`.
- Both target views must offer a way back (tapping any nav item already works; add a back affordance only if the view lacks its own header).
- Add i18n keys for the new row labels in `frontend/src/i18n.js` (IT + EN).

**Acceptance:** from Profilo, a user can open Amici (with the pending badge) and return; an admin sees and can open Admin; a non-admin does not see the Admin row.

### A4 — Content swipe hijacks horizontal scroll and fires behind modals
`frontend/src/App.jsx` ~1597–1638. The document-level horizontal swipe handler calls `preventDefault()` on any horizontal touch >10px, which (a) blocks the horizontally-scrollable filter-pill row in BetsView and (b) can change the view while a modal is open.

**Decision: scope the gesture down.**

- In `onStart`, ignore the gesture if the touch target is inside a horizontally scrollable element (walk ancestors checking `overflow-x: auto|scroll` with `scrollWidth > clientWidth`), in addition to the existing 22px left-edge bail.
- Suppress the gesture entirely while a modal is open (reuse whatever open-modal signal the existing back-gesture effect uses; if none is directly accessible, gate on the same condition).

**Acceptance:** the BetsView filter pills scroll horizontally on mobile without switching views; a horizontal swipe inside an open modal does not change the underlying view; left/right swipe on a normal content area still navigates.

### A5 — Dead `⋯` button + hardcoded footer labels
Resolved by removing the B3 footer in **A1**. No separate work.

## Out of scope
Workstreams C (Vault/Surprise privacy leaks), B (credit integrity), D (reliability), E (polish, incl. `trophy_unlocked`, broader i18n gaps, PWA offline, focus-listener no-op) remain in the audit inventory for a later pass.

## Delivery
1. Work on a `hotfix-redesign-regressions` branch off `main`.
2. `cd frontend && npm run build` must pass.
3. Manual/visual verification of each acceptance criterion (mobile viewport).
4. Merge to `main` and push → Render auto-redeploy.
5. Optionally run `backend/scripts/smoke.js` against production if test credentials are available.

## Risks
- A1 is delicate surgery in a large JSX return; the main risk is removing a functional branch by mistake. Mitigation: remove only the enumerated duplicate pieces, keep everything else, verify visually before merge.
- A2/A3 navigating to friends/admin without a nav highlight may feel slightly orphaned; acceptable for a hotfix, revisit if it confuses.
