import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { useSync } from './useSync.js';
import * as api from './api.js';

import { ARDESIA, CARTA, AMBER, CASINO, SAKURA, PECE, rootVars, DEF_CATS, COLORS, VincitWordmark } from './components/Atoms.jsx';
import { useLang } from './i18n.js';
import SplashScreen from './components/SplashScreen.jsx';
import { SkeletonDashboard, SkeletonList } from './components/Skeleton.jsx';
import { useToast } from './Toast.jsx';
// Eager: shown immediately or required during auth gate / first paint.
import AuthView from './components/views/AuthView.jsx';
import PairingView from './components/views/PairingView.jsx';
import DashboardView from './components/views/DashboardView.jsx';
import GroupPicker from './components/GroupPicker.jsx';
import { applyFreshResetIfNeeded } from './freshReset.js';

// Lazy: views the user navigates to after first paint. Each becomes its
// own Vite chunk that downloads only on first visit.
const BetsHubView   = lazy(() => import('./components/views/BetsHubView.jsx'));
const StatsView     = lazy(() => import('./components/views/StatsView.jsx'));
const TrophiesView  = lazy(() => import('./components/views/TrophiesView.jsx'));
const FriendsView   = lazy(() => import('./components/views/FriendsView.jsx'));
const AdminView     = lazy(() => import('./components/views/AdminView.jsx'));
const SettingsView  = lazy(() => import('./components/views/SettingsView.jsx'));
const ResetPasswordView = lazy(() => import('./components/views/ResetPasswordView.jsx'));

// Lazy: modals — they're conditionally rendered ({showCreate && <Modal/>})
// so the chunk is only fetched the first time the user opens that modal.
const CreateModal       = lazy(() => import('./components/modals/CreateModal.jsx'));
const CreateGroupModal  = lazy(() => import('./components/modals/CreateGroupModal.jsx'));
const GroupInfoModal    = lazy(() => import('./components/modals/GroupInfoModal.jsx'));
const RevealModal       = lazy(() => import('./components/modals/RevealModal.jsx'));
// ResolveModal exports two components — split the named exports into
// individual lazy chunks via the .then(m => ({ default })) trick.
const ResolveModal      = lazy(() => import('./components/modals/ResolveModal.jsx').then(m => ({ default: m.ResolveModal })));
const OvertimeModal     = lazy(() => import('./components/modals/ResolveModal.jsx').then(m => ({ default: m.OvertimeModal })));
const CounterModal      = lazy(() => import('./components/modals/CounterModal.jsx'));
const PinModal          = lazy(() => import('./components/modals/PinModal.jsx'));
const CommentModal      = lazy(() => import('./components/modals/CommentModal.jsx'));
const EditModal         = lazy(() => import('./components/modals/EditModal.jsx'));
const AcceptModal       = lazy(() => import('./components/modals/AcceptModal.jsx'));
const ProfileEditModal  = lazy(() => import('./components/modals/ProfileEditModal.jsx'));
const ProfileAvatarMenu = lazy(() => import('./components/ProfileAvatarMenu.jsx'));

// Lazy: overlays + tour — rare/optional UI surfaces.
const WinOverlay         = lazy(() => import('./components/WinOverlay.jsx'));
const IceEggOverlay      = lazy(() => import('./components/IceEggOverlay.jsx'));
const PhoenixEggOverlay  = lazy(() => import('./components/PhoenixEggOverlay.jsx'));
const OnboardingTour     = lazy(() => import('./components/OnboardingTour.jsx'));
const TrophyUnlockOverlay= lazy(() => import('./components/TrophyUnlockOverlay.jsx'));
const NotifInbox         = lazy(() => import('./components/modals/NotifInbox.jsx'));
const DieFace            = lazy(() => import('./components/DieFace.jsx'));
const Coin3D             = lazy(() => import('./components/Coin.jsx'));

function urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64+pad).replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

// Push registration. Returns one of:
//   'granted'      → subscription created & sent to server
//   'denied'       → user/browser blocked notifications (cannot re-prompt)
//   'unsupported'  → browser has no PushManager / service worker
//   'no-vapid'     → server has no VAPID key configured
//   'error'        → unknown failure
//
// Exported so SettingsView can call it from a Re-enable button (the
// initial silent attempt at login often fails because some users blank-
// dismiss the OS prompt without realizing it was the notifications one).
// `prompt: true` asks the OS for permission if it's still 'default'.
// `prompt: false` only re-subscribes silently when permission is already
// granted — used at login so we don't burn the request on a user who has
// no idea what the notification is for yet.
export async function registerPush(user, { prompt = true } = {}) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const { publicKey } = await fetch('/api/push/vapid-key').then(r => r.json());
    if (!publicKey) return 'no-vapid';
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission !== 'granted') {
      if (!prompt) return 'default';
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return perm; // 'denied' | 'default'
    }
    const sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:urlB64ToUint8(publicKey) });
    const token = localStorage.getItem('bc_token');
    await fetch('/api/push/subscribe', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body:JSON.stringify({user, subscription:sub.toJSON()}) });
    return 'granted';
  } catch(e) {
    console.warn('Push registration failed:', e);
    return 'error';
  }
}

const CSS_BASE = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,700&family=Playfair+Display:wght@700;900&display=swap');
@keyframes sUp{from{transform:translateY(18px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes fIn{from{opacity:0}to{opacity:1}}
@keyframes bIn{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.1)}80%{transform:scale(.95)}100%{transform:scale(1);opacity:1}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes pGold{0%,100%{box-shadow:0 0 0 0 var(--glow)}50%{box-shadow:0 0 22px 4px var(--glow)}}
@keyframes spinC{0%{transform:rotateY(0deg)}100%{transform:rotateY(1800deg)}}
@keyframes confA{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(90px) rotate(720deg);opacity:0}}
@keyframes confB{0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:1}100%{transform:translate(var(--ex),var(--ey)) rotate(var(--rot,720deg)) scale(.4);opacity:0}}
@keyframes bcStreakTap{0%{transform:scale(1)}40%{transform:scale(1.35) rotate(-8deg)}100%{transform:scale(1) rotate(0deg)}}
.bc *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
.bc{font-family:'Manrope',sans-serif;transition:background .25s,color .25s}
/* Kill every default focus/click outline app-wide — user reported the lavender
   focus ring and the mobile tap-highlight both reading as a "blue box" they
   never want to see. Anything that needs explicit keyboard focus styling
   should opt-in locally. */
.bc *:focus, .bc *:focus-visible, .bc *:focus-within{outline:none !important;box-shadow:none}
.bc button, .bc input, .bc textarea, .bc select, .bc a{-webkit-tap-highlight-color:transparent;}

/* ─── Editorial type scale ────────────────────────────────────────── */
/* Hero italic display (60–96px depending on viewport).               */
.bc-hero{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:600;letter-spacing:-0.03em;line-height:.92;color:var(--txt)}
/* Section heading: large italic serif.                                */
.bc-head{font-family:'Cormorant Garamond',serif;font-weight:600;letter-spacing:-0.01em;line-height:1.05}
/* Lining numerals, editorial weight — credit balances, quotas, ₡.    */
.bc-num{font-family:'Playfair Display',serif;font-feature-settings:'lnum' 1, 'tnum' 1;letter-spacing:-0.02em;line-height:1}
/* Tiny tracked uppercase meta — labels, dates, captions.              */
.bc-meta{font-family:'Manrope',sans-serif;font-size:9px;font-weight:600;letter-spacing:.3em;text-transform:uppercase;color:var(--dim)}
/* 1px hairline rule — replaces card borders as a divider.             */
.bc-rule{height:1px;background:var(--rule);border:0;margin:0}
.sUp{animation:sUp .3s ease both}
.fIn{animation:fIn .25s ease both}
.bIn{animation:bIn .45s cubic-bezier(.34,1.56,.64,1) both}
.pGold{animation:pGold 3s ease-in-out infinite}
.shim{background:linear-gradient(90deg,var(--gold) 0%,var(--goldL) 50%,var(--gold) 100%);background-size:200% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 2.5s linear infinite}
.spinC{animation:spinC 1.4s ease-in-out forwards}

.bc input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:5px;border-radius:3px;background:var(--mut);outline:none;cursor:pointer}
.bc input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:var(--pur);cursor:pointer;box-shadow:0 0 8px var(--glow)}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:var(--mut);border-radius:2px}
.bc{letter-spacing:-0.005em;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;position:relative;isolation:isolate}
.bc::before{
  content:'';
  position:fixed; inset:0; z-index:-1;
  background:
    radial-gradient(60vmax 40vmax at 12% 18%,  color-mix(in srgb, var(--pur)  14%, transparent) 0%, transparent 55%),
    radial-gradient(70vmax 50vmax at 88% 82%,  color-mix(in srgb, var(--gold) 10%, transparent) 0%, transparent 60%),
    radial-gradient(40vmax 30vmax at 50% 95%,  color-mix(in srgb, var(--blu)   8%, transparent) 0%, transparent 60%);
  filter: blur(4px);
  animation: ambientDrift 38s ease-in-out infinite;
  pointer-events:none;
}
@keyframes ambientDrift {
  0%, 100% { transform: translate(0,0) scale(1);   opacity:1; }
  50%      { transform: translate(2%, -1%) scale(1.06); opacity:.85; }
}
/* Easter-egg die roll — tumble on multiple axes so it feels like a real
   bouncing die. Translation hops, rotateZ + rotateX scrambles the apparent
   face; the JS face cycling underneath sells the dice randomness. */
@keyframes dieTumble {
  0%   { transform: translateY(0)    rotate(0deg)   rotateX(0deg)   scale(1);    }
  20%  { transform: translateY(-40px) rotate(110deg)  rotateX(180deg) scale(1.15); }
  45%  { transform: translateY(-60px) rotate(260deg)  rotateX(540deg) scale(1.05); }
  70%  { transform: translateY(-30px) rotate(420deg)  rotateX(900deg) scale(.95);  }
  90%  { transform: translateY(-8px)  rotate(560deg)  rotateX(1140deg) scale(1.05);}
  100% { transform: translateY(0)    rotate(540deg)  rotateX(1080deg) scale(1);   }
}
/* Easter-egg coin flip — 3D version. Two stacked faces (testa / croce)
   inside a preserve-3d container; this keyframe set rotates the container
   on the X-axis with a vertical hop so the player sees both faces alternate
   during the spin. The landing rotation determines which face is up:
   1800deg (5 half-flips ending at 0 mod 360) lands TESTA up,
   1980deg (5.5 half-flips ending at 180 mod 360) lands CROCE up. */
@keyframes coinFlip3dTesta {
  0%   { transform: translateY(0)     rotateX(0deg); }
  15%  { transform: translateY(-80px) rotateX(540deg); }
  50%  { transform: translateY(-130px) rotateX(1080deg); }
  85%  { transform: translateY(-40px) rotateX(1620deg); }
  100% { transform: translateY(0)     rotateX(1800deg); }
}
@keyframes coinFlip3dCroce {
  0%   { transform: translateY(0)     rotateX(0deg); }
  15%  { transform: translateY(-80px) rotateX(540deg); }
  50%  { transform: translateY(-130px) rotateX(1080deg); }
  85%  { transform: translateY(-40px) rotateX(1620deg); }
  100% { transform: translateY(0)     rotateX(1980deg); }
}
/* Easter-egg slot machine — reels spinning fast then easing to a stop. */
@keyframes slotReel {
  0%   { transform: translateY(0); }
  100% { transform: translateY(-720px); }
}
.bc h1,.bc h2{letter-spacing:-0.02em}

/* Focus ring removed globally per user request — every click was producing a
   lavender outline that read as a stray "blue box". The Kill-outline rule
   above handles all states. Inputs/textareas still get a subtle border colour
   change on hover (see media query below). */

/* Hover lift on interactive surfaces — desktop pointer only */
@media (hover:hover) and (pointer:fine){
  .bc button:not(:disabled){transition:filter .15s ease, transform .15s ease, box-shadow .15s ease;}
  .bc button:not(:disabled):hover{filter:brightness(1.12); transform:translateY(-1px);}
  .bc button:not(:disabled):active{filter:brightness(.95); transform:translateY(0);}
  .bc .card-hover{transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease;}
  .bc .card-hover:hover{transform:translateY(-2px); box-shadow:0 10px 28px rgba(0,0,0,.32);}
  .bc .nav-item:hover{background:var(--pur)14 !important;}
  .bc input:hover,.bc textarea:hover,.bc select:hover{border-color:var(--pur)66 !important;}
}
`;

// Easter egg #2: fullscreen coin flip. Triggered from the ₡ symbol next to
// the credit balance (mobile header + desktop sidebar). First flip ever
// unlocks the secret trophy `egg_coin`; subsequent flips are pure fun.
const COIN_LS_KEY = 'bc_egg_coin_flipped';

// Coin design now lives in components/Coin.jsx and is shared with the
// OvertimeModal so the same coin appears wherever a flip happens.

// Easter egg #1: fullscreen die roll overlay. Triggered by tapping the
// small static die in the dashboard empty state. The face cycles rapidly
// while the die tumbles, then lands on a random value. First roll ever
// unlocks the secret trophy `egg_dice` (idempotent server-side, so
// rolling repeatedly is safe).
// Now stores a JSON array of distinct face numbers seen — used to
// award level 2 once all 6 faces have been rolled. Legacy values of
// '1' (the old "rolled at least once" marker) are honored as
// "level 1 done".
const DIE_LS_KEY = 'bc_egg_dice_rolled';
const DIE_FACES_KEY = 'bc_egg_dice_faces';
const DIE_L2_FIRED  = 'bc_egg_dice_l2_fired';

function DieRollOverlay({ open, onClose, onEggUnlock }) {
  const [face, setFace] = React.useState(1);
  const [phase, setPhase] = React.useState('rolling'); // 'rolling' | 'settled'
  const cycleRef = React.useRef(null);
  const onCloseRef = React.useRef(onClose);
  const onEggUnlockRef = React.useRef(onEggUnlock);
  React.useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  React.useEffect(() => { onEggUnlockRef.current = onEggUnlock; }, [onEggUnlock]);

  React.useEffect(() => {
    if (!open) return;
    setPhase('rolling');
    const finalValue = 1 + Math.floor(Math.random() * 6);
    cycleRef.current = setInterval(() => {
      setFace(1 + Math.floor(Math.random() * 6));
    }, 75);
    const tStop = setTimeout(() => {
      if (cycleRef.current) { clearInterval(cycleRef.current); cycleRef.current = null; }
      setFace(finalValue);
      setPhase('settled');
      // Idempotent unlock — server returns alreadyUnlocked:true on repeats.
      // The popup banner is gated locally so the user sees it the first
      // time per device — even if the trophy is already in their
      // collection from earlier testing. Earlier versions used
      // `bc_egg_dice_popped` but set it BEFORE the API/queue push, so any
      // failure burnt the popup permanently. v2 sets it only AFTER the
      // synthetic queue push actually runs.
      let popThisRoll = false;
      let l2JustEarned = false;
      try {
        if (!localStorage.getItem('bc_egg_dice_popped_v2')) popThisRoll = true;
        localStorage.setItem(DIE_LS_KEY, '1');
        // Track distinct faces seen across all rolls ever on this device.
        // When the set hits 6 AND we haven't already fired the L2 trophy,
        // flag for the second unlock below.
        let seen = [];
        try { seen = JSON.parse(localStorage.getItem(DIE_FACES_KEY) || '[]'); }
        catch { seen = []; }
        if (!Array.isArray(seen)) seen = [];
        if (!seen.includes(finalValue)) seen.push(finalValue);
        localStorage.setItem(DIE_FACES_KEY, JSON.stringify(seen));
        if (seen.length >= 6 && !localStorage.getItem(DIE_L2_FIRED)) {
          l2JustEarned = true;
        }
      } catch {}
      api.unlockSecretAchievement('egg_dice', 1)
        .then(r => {
          if (popThisRoll) {
            onEggUnlockRef.current?.('egg_dice');
            try { localStorage.setItem('bc_egg_dice_popped_v2', '1'); } catch {}
          }
          if (r?.metaUnlocked) onEggUnlockRef.current?.('egg_master');
          // Level-2: rolled all 6 distinct faces. Fired AFTER L1 settles
          // so the trophy banners don't stack on the same animation.
          if (l2JustEarned) {
            api.unlockSecretAchievement('egg_dice', 2)
              .then(r2 => {
                if (!r2?.alreadyUnlocked) onEggUnlockRef.current?.('egg_dice', 2);
                // Always set the local flag — even if alreadyUnlocked — so
                // we don't re-call the API on every subsequent roll.
                try { localStorage.setItem(DIE_L2_FIRED, '1'); } catch {}
                if (r2?.metaUnlocked) onEggUnlockRef.current?.('egg_master');
              })
              .catch(e => console.error('[egg_dice L2] unlock failed', e));
          }
        })
        .catch(e => console.error('[egg_dice] unlock failed', e));
    }, 1300);
    const tClose = setTimeout(() => onCloseRef.current?.(), 4500);
    return () => {
      if (cycleRef.current) { clearInterval(cycleRef.current); cycleRef.current = null; }
      clearTimeout(tStop);
      clearTimeout(tClose);
    };
  }, [open]);

  if (!open) return null;
  const cssSize = window.innerWidth < 480 ? 180 : 240;

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:9500,
      // Theme-aware backdrop — purple glow on top of the active theme's
      // bg, so light/amber don't get a hardcoded dark blue overlay.
      background:'radial-gradient(circle at 50% 45%, var(--pur)33 0%, var(--bg) 75%)',
      backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:24, cursor:'pointer',
      animation: 'fIn .35s ease',
    }}>
      <div style={{
        marginBottom: 36,
        animation: phase === 'rolling' ? 'dieTumble 1.3s cubic-bezier(.34,1.05,.55,1)' : 'none',
        transformOrigin: 'center',
        filter: phase === 'rolling'
          ? 'drop-shadow(0 0 24px rgba(196,168,120,.65))'
          : 'drop-shadow(0 0 14px rgba(196,168,120,.4))',
      }}>
        <DieFace value={face} size={cssSize}/>
      </div>
      {phase === 'settled' && (() => {
        let seen = [];
        try { seen = JSON.parse(localStorage.getItem(DIE_FACES_KEY) || '[]'); } catch {}
        if (!Array.isArray(seen)) seen = [];
        const faceCount = Math.min(seen.length, 6);
        const hasAll = faceCount >= 6;
        return (
          <div className="bIn" style={{textAlign:'center'}}>
            <div className="bc-meta" style={{marginBottom:10, color:'var(--gold)'}}>— Esito</div>
            <div style={{
              fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
              fontSize:'clamp(48px, 12vw, 92px)', fontWeight:600,
              color:'var(--gold)', letterSpacing:'-0.02em', lineHeight: 1,
            }}>{face}</div>
            <div style={{
              marginTop:16, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}>
              {[1,2,3,4,5,6].map(f => (
                <span key={f} style={{
                  fontSize:18, opacity: seen.includes(f) ? 1 : 0.2,
                  filter: seen.includes(f) ? 'drop-shadow(0 0 6px var(--gold)88)' : 'none',
                  transition:'opacity .3s, filter .3s',
                }}>{['⚀','⚁','⚂','⚃','⚄','⚅'][f-1]}</span>
              ))}
            </div>
            <div style={{
              marginTop:8, fontFamily:"'Manrope',sans-serif",
              fontSize:9, letterSpacing:'.22em', textTransform:'uppercase',
              color: hasAll ? 'var(--gold)' : 'var(--dim)',
            }}>
              {hasAll ? '✦ Tutte le facce trovate' : `${faceCount} / 6 facce`}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function CoinFlipOverlay({ open, onClose, onEggUnlock }) {
  const [phase, setPhase] = React.useState('flipping'); // 'flipping' | 'settled'
  const [side, setSide]   = React.useState(null);       // 'testa' | 'croce'
  // Keep callbacks in refs so they don't retrigger the effect (and re-roll RNG).
  const onCloseRef = React.useRef(onClose);
  const onEggUnlockRef = React.useRef(onEggUnlock);
  React.useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  React.useEffect(() => { onEggUnlockRef.current = onEggUnlock; }, [onEggUnlock]);

  React.useEffect(() => {
    if (!open) return;
    setPhase('flipping');
    const result = Math.random() < 0.5 ? 'testa' : 'croce';
    setSide(result);
    // Flip lasts 2.6s, settle phase fires when it ends.
    const t1 = setTimeout(() => setPhase('settled'), 2600);
    // Always call the unlock endpoint — server is idempotent. The old LS
    // gate caused the trophy to never unlock if the LS key was set but
    // the trophy was never actually recorded server-side (DB reset,
    // network hiccup, etc).
    // See DieRollOverlay for the rationale on per-device LS gating —
    // v2 keys set LS only AFTER the queue push fires.
    let popThisFlip = false;
    try {
      if (!localStorage.getItem('bc_egg_coin_popped_v2')) popThisFlip = true;
      localStorage.setItem(COIN_LS_KEY, '1');
    } catch {}
    api.unlockSecretAchievement('egg_coin')
      .then(r => {
        if (popThisFlip) {
          onEggUnlockRef.current?.('egg_coin');
          try { localStorage.setItem('bc_egg_coin_popped_v2', '1'); } catch {}
        }
        if (r?.metaUnlocked) onEggUnlockRef.current?.('egg_master');
      })
      .catch(e => console.error('[egg_coin] unlock failed', e));
    const t2 = setTimeout(() => onCloseRef.current?.(), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  // Pixel size used for sub-element scaling.
  const cssSize = window.innerWidth < 480 ? 200 : 260;

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:9500,
      // Theme-aware backdrop — purple glow on top of the active theme's
      // bg, so light/amber don't get a hardcoded dark blue overlay.
      background:'radial-gradient(circle at 50% 45%, var(--pur)33 0%, var(--bg) 75%)',
      backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:24, cursor:'pointer',
      animation: 'fIn .35s ease',
    }}>
      <div style={{ marginBottom:36 }}>
        <Coin3D result={side || 'testa'} size={cssSize}/>
      </div>
      {phase === 'settled' && side && (
        <div className="bIn" style={{textAlign:'center'}}>
          <div className="bc-meta" style={{marginBottom:10, color:'var(--gold)'}}>— Esito</div>
          <div style={{
            fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
            fontSize:'clamp(48px, 12vw, 92px)', fontWeight:600,
            color:'var(--gold)', letterSpacing:'-0.02em', textTransform:'uppercase',
          }}>{side}</div>
        </div>
      )}
    </div>
  );
}

// Static metadata used by onEggFired to build the synthetic trophy queue
// entry. Kept at module scope so the useCallback closure is truly stable.
const EGG_TROPHY_META = {
  egg_dice:    { icon: '🎲' },
  egg_coin:    { icon: '🪙' },
  egg_jackpot: { icon: '🎰' },
  egg_ice:     { icon: '❄️' },
  egg_phoenix: { icon: '🔥' },
  egg_master:  { icon: '👑' },
};

const lsGet  = (k, fallback) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; } };
const lsSet  = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const lsDel  = k => { try { localStorage.removeItem(k); } catch {} };

const getVaultPin   = u => lsGet(`bc_pin_${u}`, null);
const setVaultPin   = (u, pin) => pin ? lsSet(`bc_pin_${u}`, pin) : lsDel(`bc_pin_${u}`);
const getNotifSince = u => lsGet(`bc_notifsince_${u}`, 0);
const setNotifSince = (u, ts) => lsSet(`bc_notifsince_${u}`, ts);
const getLastSeen   = u => lsGet(`bc_lastseen_${u}`, 0);
const setLastSeen   = (u, ts) => lsSet(`bc_lastseen_${u}`, ts);

function useBreakpoint(minWidth) {
  const [matches, setMatches] = useState(
    () => window.matchMedia(`(min-width: ${minWidth}px)`).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const handler = e => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [minWidth]);
  return matches;
}

// One-shot URL-driven dev-tools toggle.
// Visit  ?devtools=1  to make the hidden 🧪 Test Reset card reappear,
// ?devtools=0  to hide it again. The flag persists in localStorage so
// the URL param only needs to be hit once.
(function syncDevToolsFromURL() {
  try {
    const url = new URL(window.location.href);
    const v = url.searchParams.get('devtools');
    if (v === '1') localStorage.setItem('bc_dev_tools', '1');
    else if (v === '0') localStorage.removeItem('bc_dev_tools');
    if (v !== null) {
      url.searchParams.delete('devtools');
      window.history.replaceState({}, '', url.toString());
    }
  } catch {}
})();

// Loading overlay shown while the initial /api/me call is in flight. On
// the free Render+Neon tier the server can be cold-paused, so we escalate
// the message at 3s and again at 15s to set expectations honestly
// instead of leaving the user staring at a lonely ₡ for 30s.
function ColdStartLoader({ t }) {
  const [level, setLevel] = React.useState(0); // 0 = silent, 1 = waking, 2 = patience
  React.useEffect(() => {
    const t1 = setTimeout(() => setLevel(1), 3000);
    const t2 = setTimeout(() => setLevel(2), 15000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div style={{
      position:'fixed', inset:0, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', background:'var(--bg)',
      padding:'40px 28px', textAlign:'center', gap:20,
    }}>
      <div style={{
        fontFamily:"'Playfair Display',serif", fontSize:48, color:'var(--gold)',
        animation: 'pGold 2.5s ease-in-out infinite',
      }}>₡</div>
      {level >= 1 && (
        <div style={{
          fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
          fontSize:22, fontWeight:600, color:'var(--txt)', maxWidth:420,
          animation:'fIn .35s ease both',
        }}>
          {t('cold_start.waking')}
        </div>
      )}
      {level >= 2 && (
        <div style={{
          fontSize:13, color:'var(--dim)', lineHeight:1.6, maxWidth:380,
          animation:'fIn .35s ease both',
        }}>
          {t('cold_start.patience')}
        </div>
      )}
    </div>
  );
}

// PWA install banner. Captures the deferred `beforeinstallprompt` event so
// we can show a tasteful in-app prompt later rather than the browser's
// silent install icon. Hides itself for 7 days after dismissal and forever
// after a successful install. Listed visible only post-login so users have
// seen *something* worth installing before we ask.
function PwaInstallBanner({ t, visible }) {
  const [deferred, setDeferred] = React.useState(null);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      // Respect a recent dismissal: 7 days = 7*24*60*60*1000 ms.
      try {
        const ts = Number(localStorage.getItem('bc_pwa_dismissed_at') || 0);
        if (ts && Date.now() - ts < 7 * 24 * 60 * 60 * 1000) return;
        if (localStorage.getItem('bc_pwa_installed') === '1') return;
      } catch {}
      setDeferred(e);
    };
    const onInstalled = () => {
      try { localStorage.setItem('bc_pwa_installed', '1'); } catch {}
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred || dismissed || !visible) return null;

  const accept = async () => {
    try {
      deferred.prompt();
      await deferred.userChoice;
    } catch {}
    setDeferred(null);
  };
  const later = () => {
    try { localStorage.setItem('bc_pwa_dismissed_at', String(Date.now())); } catch {}
    setDismissed(true);
  };

  return (
    <div style={{
      position:'fixed', left:'50%', transform:'translateX(-50%)',
      bottom: 'calc(96px + env(safe-area-inset-bottom))', // sits above mobile nav
      width:'calc(100% - 24px)', maxWidth:420, zIndex:80,
      background:'var(--surf)', border:'1px solid var(--gold)55',
      borderRadius:14, padding:'14px 16px',
      boxShadow:'0 18px 50px rgba(0,0,0,.45), 0 0 0 1px var(--gold)18',
      animation:'sUp .3s ease both',
    }}>
      <div style={{
        fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
        fontSize:18, fontWeight:600, color:'var(--txt)', marginBottom:4,
      }}>{t('pwa.install_title')}</div>
      <div style={{fontSize:12, color:'var(--dim)', lineHeight:1.5, marginBottom:12}}>
        {t('pwa.install_body')}
      </div>
      <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
        <button onClick={later} style={{
          padding:'8px 14px', borderRadius:999, background:'transparent',
          border:'1px solid var(--brd)', color:'var(--dim)',
          fontFamily:"'Manrope',sans-serif", fontSize:11, fontWeight:700,
          letterSpacing:'.08em', textTransform:'uppercase', cursor:'pointer',
        }}>{t('pwa.install_later')}</button>
        <button onClick={accept} style={{
          padding:'8px 16px', borderRadius:999, border:'none',
          background:'var(--gold)', color:'#1a1530',
          fontFamily:"'Manrope',sans-serif", fontSize:11, fontWeight:800,
          letterSpacing:'.08em', textTransform:'uppercase', cursor:'pointer',
        }}>{t('pwa.install_cta')}</button>
      </div>
    </div>
  );
}

export default function App() {
  // Theme: persisted to localStorage so it survives page refresh / app
  // restart. Values: 'dark' (default), 'light', 'amber'. The legacy isDark
  // boolean is derived from theme for backward compat with existing props.
  const [theme, setTheme] = useState(() => {
    try {
      const v = localStorage.getItem('bc_theme');
      if (['ardesia','carta','amber','casino','sakura','pece'].includes(v)) return v;
    } catch {}
    return 'ardesia';
  });
  useEffect(() => {
    try { localStorage.setItem('bc_theme', theme); } catch {}
  }, [theme]);
  const isDark = theme !== 'carta';
  const setIsDark = (v) => setTheme(v ? 'ardesia' : 'carta');
  const C = theme === 'carta' ? CARTA : theme === 'amber' ? AMBER : theme === 'casino' ? CASINO : theme === 'sakura' ? SAKURA : theme === 'pece' ? PECE : ARDESIA;
  const isDesktop = useBreakpoint(768);
  const { t } = useLang();

  // Mirror the theme CSS variables onto :root so portaled modals
  // (which live outside the <div className="bc">) still pick them up.
  useEffect(() => {
    const root = document.documentElement;
    const vars = rootVars(C);
    for (const [key, val] of Object.entries(vars)) {
      if (key.startsWith('--')) root.style.setProperty(key, val);
    }
    document.body.style.background = C.bg;
    document.body.style.color = C.txt;
  }, [C]);
  const toast = useToast();
  const [splashDone, setSplashDone] = useState(false);
  const [tourDone, setTourDone] = useState(() => !!localStorage.getItem('bc_onboarding_done'));
  // Tour position is lifted up here so a side-trip to the CreateModal (the
  // "Aprilo ora" CTA on page 4) doesn't reset the user's progress. The
  // parent advances the step + sets `tourPaused` while the modal is open,
  // then un-pauses on close — the tour reappears at the next page.
  const [tourStep, setTourStep] = useState(0);
  const [tourPaused, setTourPaused] = useState(false);

  // Auth state
  const [token,       setToken]       = useState(() => localStorage.getItem('bc_token'));
  const [authUser,    setAuthUser]    = useState(null);
  const [authLoading, setAuthLoading] = useState(!!localStorage.getItem('bc_token'));

  // Groups state
  const [groups,        setGroups]        = useState([]);
  const [groupsLoaded,  setGroupsLoaded]  = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(() => lsGet('bc_active_group', null));
  const [groupMembers,  setGroupMembers]  = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showGroupInfo,  setShowGroupInfo]  = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      const gs = await api.getMyGroups();
      setGroups(gs);
      if (gs.length > 0) {
        setActiveGroupId(prev => {
          const valid = gs.find(g => g.id === prev);
          const id = valid ? prev : gs[0].id;
          lsSet('bc_active_group', id);
          return id;
        });
      }
    } catch {} finally { setGroupsLoaded(true); }
  }, []);

  useEffect(() => {
    if (!token) { setAuthLoading(false); return; }
    api.getMe()
      .then(async u => {
        // If the admin bumped this user's fresh_reset_at since last visit,
        // wipe the LS flags so the onboarding tour + secret-trophy easter
        // eggs replay on this device.
        applyFreshResetIfNeeded(u);
        setAuthUser(u);
        await loadGroups();
        setAuthLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('bc_token');
        setToken(null);
        setAuthLoading(false);
      });
  }, []); // runs once on mount

  const handleAuth = ({ token: t, user: u }) => {
    localStorage.setItem('bc_token', t);
    setToken(t);
    applyFreshResetIfNeeded(u);
    setAuthUser(u);
    setGroupsLoaded(false);
    loadGroups();
  };

  const handleLogout = () => {
    localStorage.removeItem('bc_token');
    lsDel('bc_active_group');
    setToken(null);
    setAuthUser(null);
    setGroups([]);
    setGroupsLoaded(false);
    setActiveGroupId(null);
  };

  const handleGroupCreated = group => {
    setGroups(prev => {
      const exists = prev.find(g => g.id === group.id);
      return exists ? prev : [...prev, group];
    });
    setActiveGroupId(group.id);
    lsSet('bc_active_group', group.id);
    setShowGroupModal(false);
  };

  const switchGroup = id => {
    setActiveGroupId(id);
    lsSet('bc_active_group', id);
  };

  // Share-link auto-join: handle `?join=CODE` on first load. We hold the
  // pending code in state across the auth gate, then fire one attempt as
  // soon as the user is logged in and groups are loaded. Cleaned up from
  // the URL either way so a refresh doesn't keep re-trying.
  const [pendingJoinCode, setPendingJoinCode] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const code = new URL(window.location.href).searchParams.get('join');
      return code ? code.toUpperCase().trim() : null;
    } catch { return null; }
  });
  const clearJoinFromUrl = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('join');
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };
  useEffect(() => {
    if (!pendingJoinCode || !authUser || !groupsLoaded) return;
    // Already member of a group with this code? Just switch.
    const existing = groups.find(g => g.invite_code === pendingJoinCode);
    if (existing) {
      switchGroup(existing.id);
      setPendingJoinCode(null);
      clearJoinFromUrl();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const group = await api.joinGroup(pendingJoinCode);
        if (cancelled) return;
        handleGroupCreated(group);
        toast.success(`✓ Sei nel gruppo ${group.emoji || ''} ${group.name}`.trim());
      } catch (e) {
        const code = e?.data?.error;
        const msg =
          code === 'already_member' ? t('group.err_already_member')
          : code === 'group_full'    ? t('group.err_full')
          : code === 'invite_expired' ? t('group.err_invite_expired')
          : t('group.err_invalid_code');
        toast.error(msg);
      } finally {
        if (!cancelled) {
          setPendingJoinCode(null);
          clearJoinFromUrl();
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJoinCode, authUser, groupsLoaded]);

  useEffect(() => {
    if (!activeGroupId || !token) return;
    api.getGroupMembers(activeGroupId).then(setGroupMembers).catch(() => {});
  }, [activeGroupId, token]);

  // user is the UUID string (same type as before, just UUID instead of "tomas")
  const user = authUser?.id ?? null;

  // Server state
  const [profiles,   setProfiles]   = useState({});
  const [credits,    setCredits]    = useState({});
  const [bets,       setBets]       = useState([]);
  const [customCats, setCustomCats] = useState([]);
  const [reactions,  setReactions]  = useState([]);
  const [settings,   setSettings]   = useState({ acceptance_threshold: 20, max_stake: 100 });
  const [syncError,  setSyncError]  = useState(null);
  const [feedEvents, setFeedEvents] = useState([]);

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

  const cats = [...DEF_CATS, ...customCats];

  const [view, setView] = useState('dashboard');
  const [betsTab, setBetsTab] = useState('open'); // 'open' | 'vault' — inside the Bets hub
  // Bumping `betsViewKey` remounts BetsView with a fresh `initialStatus`
  // — used when the dashboard "Vedi tutte" CTA needs to land on the
  // "All" status filter regardless of whatever filter the user left
  // BetsView on. Bottom-nav navigation does NOT bump this, so the user's
  // own filter state is preserved during normal browsing.
  const [betsViewKey, setBetsViewKey]           = useState(0);
  const [betsInitialStatus, setBetsInitialStatus] = useState(undefined);
  const goToAllBets = () => {
    setBetsTab('open');
    setBetsInitialStatus('all');
    setBetsViewKey(k => k + 1);
    setView('bets');
    // Snap to the top of the new view. Done in rAF so the scroll fires
    // after React commits the route swap (otherwise we scroll the old
    // dashboard before the bets view has even mounted).
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    }
  };
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  // Convenience: dashboard teaser CTA → jump straight into the Vault tab
  const goToVault = () => { setBetsTab('vault'); setView('bets'); };
  const [pinVersion, setPinVersion] = useState(0);
  const vaultPin = user ? getVaultPin(user) : null;

  const [showCreate, setShowCreate]       = useState(false);
  const [revealBet, setRevealBet]         = useState(null);
  const [resolveBet, setResolveBet]       = useState(null);
  const [counterTarget, setCounterTarget] = useState(null);
  const [overtimeBet, setOvertimeBet]     = useState(null);
  const [showPin, setShowPin]             = useState(false);
  // Win celebrations + comment prompts are QUEUED (arrays) so that
  // resolving multiple bets in quick succession doesn't overwrite the
  // earlier popups — each one renders sequentially as the previous
  // closes. The user's "I only see the last one" complaint comes from
  // the old single-state model.
  const [winAnimQueue, setWinAnimQueue]   = useState([]);
  const [commentBetQueue, setCommentBetQueue] = useState([]);
  // Bets currently inside the "undo" toast window after declare/confirm
  // — we hide the declare button on these BetCards so the user can't
  // hit "Dichiara esito" twice while the previous result is still
  // pending commit. Cleared on undo or when the toast times out and
  // performResolve runs.
  const [pendingResolveIds, setPendingResolveIds] = useState(() => new Set());
  const winAnim = winAnimQueue[0] ?? null;
  const commentBetModal = commentBetQueue[0] ?? null;
  // Bets whose resolution we've already celebrated for this user, so
  // an incoming SSE doesn't replay the WinOverlay on every reconnect.
  // Populated on first state load with every already-resolved bet, so
  // historical wins don't pop on first sign-in.
  const seenResolutionsRef = useRef(null);
  // Flips true the first time the SSE/refresh callback delivers state
  // for the current group. We gate the seenResolutionsRef init on this
  // so the baseline isn't set during the one-render window where `bets`
  // is still its `useState([])` default — otherwise the baseline would
  // capture zero bets, and every already-resolved bet in the real
  // response would be celebrated as a fresh win on page load.
  const stateLoadedRef = useRef(false);
  // Kept fresh by the closeTopModal effect below; read by the back-gesture
  // handler without needing to re-register the touch listeners on every
  // modal state change.
  const closeTopModalRef = useRef(null);
  const [editingBet, setEditingBet]       = useState(null);
  const [acceptingBet, setAcceptingBet]   = useState(null);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  // Avatar popover — tap on the user avatar (desktop + mobile) opens a small
  // menu with "Modifica profilo" and "Esci" (two-step confirm). Replaces the
  // old direct-tap-to-edit shortcut so logout doesn't require a Settings trip.
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [coinFlipOpen,    setCoinFlipOpen]    = useState(false); // easter egg #2 (coin)
  const [dieRollOpen,     setDieRollOpen]     = useState(false); // easter egg #1 (dice)
  const [iceEggOpen,      setIceEggOpen]      = useState(false); // easter egg #4 (❄️ streak)
  const [phoenixEggOpen,  setPhoenixEggOpen]  = useState(false); // easter egg #5 (🔥 streak)
  const [inboxOpen,       setInboxOpen]       = useState(false);
  const [eggTick,         setEggTick]         = useState(0);     // bumps after a secret unlock so trophy polling refreshes
  const [pendingFriendCount, setPendingFriendCount] = useState(0);

  // Keeps closeTopModalRef pointing at the close function for the
  // topmost open modal so the back-gesture handler can call it without
  // stale-closure problems.
  useEffect(() => {
    const handler = (
      (phoenixEggOpen  && (() => setPhoenixEggOpen(false)))  ||
      (iceEggOpen      && (() => setIceEggOpen(false)))      ||
      (coinFlipOpen    && (() => setCoinFlipOpen(false)))    ||
      (dieRollOpen     && (() => setDieRollOpen(false)))     ||
      (inboxOpen       && (() => setInboxOpen(false)))       ||
      (commentBetModal && (() => setCommentBetQueue([])))    ||
      (showCreate      && (() => setShowCreate(false)))      ||
      (acceptingBet    && (() => setAcceptingBet(null)))     ||
      (editingBet      && (() => setEditingBet(null)))       ||
      (revealBet       && (() => setRevealBet(null)))        ||
      (resolveBet      && (() => setResolveBet(null)))       ||
      (overtimeBet     && (() => setOvertimeBet(null)))      ||
      (counterTarget   && (() => setCounterTarget(null)))    ||
      (showGroupInfo   && (() => setShowGroupInfo(false)))   ||
      (showGroupModal  && (() => setShowGroupModal(false)))  ||
      (showProfileEdit && (() => setShowProfileEdit(false))) ||
      (profileMenuOpen && (() => setProfileMenuOpen(false))) ||
      null
    );
    closeTopModalRef.current = handler;
  }, [
    phoenixEggOpen, iceEggOpen, coinFlipOpen, dieRollOpen, inboxOpen,
    commentBetModal, showCreate, acceptingBet, editingBet,
    revealBet, resolveBet, overtimeBet, counterTarget,
    showGroupInfo, showGroupModal, showProfileEdit, profileMenuOpen,
  ]);

  // Silent push re-subscribe on login: only refreshes the subscription when
  // permission is *already* granted. The actual prompt is deferred to
  // the first moment the user is *involved* in a bet (created one OR
  // received/been-targeted-by one). The earlier "only on create" rule
  // missed members who only get invited.
  useEffect(() => {
    if (user && groups.length > 0) registerPush(user, { prompt: false });
  }, [user, groups.length]);

  // When the user switches groups, drop the celebration baseline + any
  // queued overlays. Otherwise the new group's already-resolved bets
  // (none of which were in the previous baseline) would fire WinOverlay
  // back-to-back as the list arrives — leaving the 🏆 cup on screen for
  // a few seconds per bet while the user is just trying to browse.
  useEffect(() => {
    seenResolutionsRef.current = null;
    stateLoadedRef.current = false;
    setWinAnimQueue([]);
    setCommentBetQueue([]);
  }, [activeGroupId]);

  // Resolution-diff celebration: counter-bettors (and other participants
  // who didn't trigger the resolve themselves) used to find out their
  // bet had resolved only via the regular bet card refresh — no
  // WinOverlay, no comment prompt, often no push (if their device
  // hadn't subscribed yet). We watch the bets array for any bet that
  // transitions from "not yet resolved on this client" to resolved
  // with the user on the winning side, and fire the celebration.
  useEffect(() => {
    if (!user || !Array.isArray(bets)) return;
    const seen = seenResolutionsRef.current;
    if (seen == null) {
      // Wait for the first real state payload — initializing with the
      // empty `useState([])` default would mark zero bets as seen, then
      // every resolved bet in the next SSE/refresh would celebrate.
      if (!stateLoadedRef.current) return;
      // First state load — record every already-resolved bet without
      // celebrating, so historical wins don't replay on sign-in.
      const init = new Set();
      for (const b of bets) {
        if (b.status === 'won' || b.status === 'lost') init.add(b.id);
      }
      seenResolutionsRef.current = init;
      return;
    }
    for (const b of bets) {
      if (b.status !== 'won' && b.status !== 'lost') continue;
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      // Did *I* win this bet?
      let iWon = false;
      let payout = 0;
      if (b.creator === user) {
        iWon = b.status === 'won';
        payout = b.potentialWin || 0;
      } else if (Array.isArray(b.counterBets)) {
        const mine = b.counterBets.find(c => c?.bettor === user);
        if (mine?.side) {
          const userYes = mine.side === 'yes';
          const creatorWon = b.status === 'won';
          iWon = userYes === creatorWon;
          if (iWon) {
            const q = parseFloat(mine.quotaUsed) || 1;
            payout = Math.round((mine.stake || 0) * q);
          }
        }
      }
      if (iWon && payout > 0) {
        setWinAnimQueue(q => [...q, payout]);
        // Enqueue the comment prompt immediately — the render gate
        // `commentBetModal && winAnimQueue.length === 0` in the JSX
        // holds it back until every trophy has played and popped, so
        // we don't need an artificial setTimeout here.
        setCommentBetQueue(q => [...q, { ...b, status: 'won' }]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bets, user]);

  // Active-involvement prompt: once we can confirm the user is part of
  // any bet (creator / opponent / target / counter-bettor / member of
  // an open bet's allowed list), fire the OS permission prompt. Only
  // once, gated by the same LS flag as handleCreate so the two paths
  // can't double-prompt.
  useEffect(() => {
    if (!user || !Array.isArray(bets) || bets.length === 0) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    try {
      if (localStorage.getItem('bc_push_first_ask_done')) return;
    } catch { return; }
    const involved = bets.some(b =>
      b.creator === user ||
      b.opponent === user ||
      b.targetUser === user ||
      (Array.isArray(b.allowedMembers) && b.allowedMembers.includes(user)) ||
      (Array.isArray(b.counterBets) && b.counterBets.some(c => c?.bettor === user))
    );
    if (!involved) return;
    try { localStorage.setItem('bc_push_first_ask_done', '1'); } catch {}
    registerPush(user, { prompt: true }).catch(() => {});
  }, [user, bets]);

  // Poll incoming friend-request count for the nav badge. Cheap (single
  // small JSON), refreshes when the user lands on the Friends view too.
  useEffect(() => {
    if (!token || !user) return;
    let cancelled = false;
    const refreshFriendBadge = async () => {
      try {
        const r = await api.getFriendRequests();
        if (!cancelled) setPendingFriendCount((r?.incoming || []).length);
      } catch {}
    };
    refreshFriendBadge();
    const id = setInterval(refreshFriendBadge, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [token, user, view]);

  // In-app toast when the friend-request count jumps up — fires even if
  // the user denied OS-level push permission. Skips the initial load
  // (otherwise you'd get a toast every refresh for pre-existing requests).
  const prevFriendCountRef = useRef(0);
  const friendCountReadyRef = useRef(false);
  useEffect(() => {
    if (!friendCountReadyRef.current) {
      friendCountReadyRef.current = true;
      prevFriendCountRef.current = pendingFriendCount;
      return;
    }
    if (pendingFriendCount > prevFriendCountRef.current) {
      const delta = pendingFriendCount - prevFriendCountRef.current;
      toast.info(delta === 1
        ? '👋 Nuova richiesta di amicizia'
        : `👋 ${delta} nuove richieste di amicizia`);
    }
    prevFriendCountRef.current = pendingFriendCount;
  }, [pendingFriendCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── In-app notification inbox ────────────────────────────────────
  const [inboxItems, setInboxItems] = useState([]);
  const inboxUserRef = useRef(user);
  useEffect(() => { inboxUserRef.current = user; }, [user]);
  useEffect(() => {
    if (!user) return;
    try {
      const stored = JSON.parse(localStorage.getItem(`bc_inbox_${user}`) || '[]');
      setInboxItems(Array.isArray(stored) ? stored : []);
    } catch { setInboxItems([]); }
  }, [user]);

  // Stable ref-based adder so callers with [] deps (onEggFired) can still write notifs.
  const addInboxNotifRef = useRef(null);
  const addInboxNotif = (notif) => {
    const u = inboxUserRef.current;
    if (!u) return;
    const key = `bc_inbox_${u}`;
    let prev = [];
    try { prev = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
    if (!Array.isArray(prev)) prev = [];
    // Dedup: same betId+type within 5 min
    if (notif.betId && prev.some(p => p.betId === notif.betId && p.type === notif.type && Date.now() - p.at < 300000)) return;
    const item = { ...notif, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, at: Date.now(), read: false };
    const next = [item, ...prev].slice(0, 50);
    localStorage.setItem(key, JSON.stringify(next));
    setInboxItems(next);
  };
  addInboxNotifRef.current = addInboxNotif;

  // Watch bets state for new partner bets and result changes
  const prevBetsRef2 = useRef(null);
  const betsInboxReadyRef = useRef(false);
  useEffect(() => {
    if (!user || !bets || !profiles) return;
    if (!betsInboxReadyRef.current) {
      betsInboxReadyRef.current = true;
      prevBetsRef2.current = [...bets];
      return;
    }
    const prev = prevBetsRef2.current || [];
    for (const b of bets) {
      const prevB = prev.find(p => p.id === b.id);
      if (!prevB && b.creator !== user && !b.isSecret && ['active','pending'].includes(b.status)) {
        addInboxNotifRef.current?.({
          type: 'new_bet', icon: '🎯',
          title: `${profiles[b.creator]?.name || 'Qualcuno'} ha fatto una bet`,
          body: `"${b.title.slice(0,45)}" · ${b.stake} ₡`,
          betId: b.id,
        });
      }
      if (prevB && prevB.status === 'active' && b.status === 'won' && (b.creator === user || b.opponent === user)) {
        addInboxNotifRef.current?.({
          type: 'won', icon: '✦',
          title: 'Bet vinta!',
          body: `"${b.title.slice(0,40)}" · +${(b.potentialWin||0) - (b.stake||0)} ₡`,
          betId: b.id,
        });
      }
      if (prevB && prevB.status === 'active' && b.status === 'lost' && (b.creator === user || b.opponent === user)) {
        addInboxNotifRef.current?.({
          type: 'lost', icon: '✗',
          title: 'Bet persa',
          body: `"${b.title.slice(0,40)}" · −${b.stake} ₡`,
          betId: b.id,
        });
      }
    }
    prevBetsRef2.current = [...bets];
  }, [bets, user, profiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const markInboxRead = useCallback(() => {
    if (!user) return;
    const next = inboxItems.map(x => ({ ...x, read: true }));
    localStorage.setItem(`bc_inbox_${user}`, JSON.stringify(next));
    setInboxItems(next);
  }, [user, inboxItems]);

  const clearInbox = useCallback(() => {
    if (!user) return;
    localStorage.setItem(`bc_inbox_${user}`, '[]');
    setInboxItems([]);
  }, [user]);

  const inboxUnread = inboxItems.filter(x => !x.read).length;

  // ─── Trophy unlock watcher ─────────────────────────────────────────
  // Detect new unlocked levels by polling /api/achievements whenever the
  // bets list changes (which happens on every SSE refresh) and queue an
  // animated overlay for each freshly-earned level.
  const [trophyQueue, setTrophyQueue] = useState([]);
  const [navHover, setNavHover] = useState(-1); // desktop nav dock-zoom hover index
  const [navSwipeIdx, setNavSwipeIdx] = useState(-1); // mobile swipe-nav: index under finger
  const [navBarEl, setNavBarEl] = useState(null);    // callback-ref so effect re-runs on mount
  const navSwipeStateRef = useRef({ startX: null, swipeMode: false, idx: -1 });
  const navRef = useRef([]); // kept fresh each render so the touch handler can navigate
  const [trophyBaseline, setTrophyBaseline] = useState(null); // Set<"id:level"> | null
  useEffect(() => {
    if (!user || !profiles[user]) return;
    let cancelled = false;
    api.getAchievements().then(({ unlocked, catalog }) => {
      if (cancelled) return;
      const cur = new Set(unlocked.map(u => `${u.achievement_id}:${u.level}`));
      if (trophyBaseline === null) {
        // First load after login — treat existing unlocks as already seen.
        setTrophyBaseline(cur);
        return;
      }
      const fresh = [];
      for (const key of cur) {
        if (!trophyBaseline.has(key)) {
          const [id, levelStr] = key.split(':');
          const a = catalog.find(c => c.id === id);
          if (a) fresh.push({
            id, icon: a.icon,
            level: parseInt(levelStr, 10),
            max_level: a.levels?.length ?? 5,
          });
        }
      }
      if (fresh.length) {
        // Sort by level asc so successive levels of same trophy appear in order
        fresh.sort((a,b) => a.level - b.level);
        // Dedup against anything already in the queue (e.g., a synthetic
        // trophy push from onEggFired that pre-populated this same id).
        setTrophyQueue(q => {
          const newOnes = fresh.filter(f =>
            !q.some(qt => qt.id === f.id && qt.level === f.level)
          );
          return newOnes.length ? [...q, ...newOnes] : q;
        });
      }
      setTrophyBaseline(cur);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [bets.length, user, eggTick]);

  const consumeTrophy = () => setTrophyQueue(q => q.slice(1));

  // Easter egg "fired" channel — every time an egg overlay finishes its
  // animation it calls onEggFired(id). This DIRECTLY pushes a synthetic
  // trophy entry to the queue so the user sees the unlock popup even if
  // the trophy was already unlocked server-side (in which case the
  // baseline-diff path would silently skip it). We also pre-seed baseline
  // and bump eggTick so the legacy poll path stays consistent.
  const onEggFired = useCallback((id, level = 1) => {
    const meta = EGG_TROPHY_META[id];
    if (!meta) return;
    let attachTip = false;
    if (id === 'egg_ice' || id === 'egg_phoenix') {
      try {
        if (!localStorage.getItem('bc_egg_streak_tip_shown')) {
          attachTip = true;
          localStorage.setItem('bc_egg_streak_tip_shown', '1');
        }
      } catch {}
    }
    setTrophyQueue(q => {
      if (q.some(t => t.id === id && t.level === level)) return q;
      return [...q, { id, icon: meta.icon, level, max_level: level, tip: attachTip ? 'egg_first_tip' : null }];
    });
    setTrophyBaseline(b => {
      if (!b) return b;
      const key = `${id}:${level}`;
      if (b.has(key)) return b;
      const next = new Set(b);
      next.add(key);
      return next;
    });
    setEggTick(n => n + 1);
    addInboxNotifRef.current?.({ type: 'trophy', icon: meta.icon, title: 'Trofeo sbloccato!', body: id });
  }, []);

  // notifVersion is bumped whenever the user marks the partner-notification
  // as seen. It causes a re-render so notifSince re-reads the fresh timestamp.
  const [notifVersion, setNotifVersion] = useState(0);
  const notifSince = user ? { [user]: getNotifSince(user) } : {};
  const handleNotifSeen = () => {
    if (user) { setNotifSince(user, Date.now()); setNotifVersion(v => v + 1); }
  };
  // Initialize notifSince on first login to prevent ghost notifications
  // from pre-existing bets appearing as "new" on a fresh device/session.
  useEffect(() => {
    if (user && !getNotifSince(user)) {
      setNotifSince(user, Date.now());
      setNotifVersion(v => v + 1);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async data => {
    try {
      await api.createBet({ ...data, id: `b${Date.now()}`, createdAt: Date.now() });
      setShowCreate(false);
      // First-bet trigger: now that the user has created their first bet,
      // the value of push notifications (someone accepted / resolved your
      // bet) is concrete. Ask once, then never again — denial / dismissal
      // is respected and the user can re-enable from Settings.
      if (typeof window !== 'undefined') {
        try {
          if (!localStorage.getItem('bc_push_first_ask_done')
              && 'Notification' in window
              && Notification.permission === 'default') {
            localStorage.setItem('bc_push_first_ask_done', '1');
            registerPush(user, { prompt: true }).catch(() => {});
          }
        } catch {}
      }
      // Same resume-from-paused-tour path as the onClose wrapper, so creating
      // a real bet during the tutorial demo still lands the user back on the
      // next tour page instead of dropping them out cold.
      if (tourPaused && !tourDone) setTourPaused(false);
      refresh();
      toast.success(t('app.ok_created'));
    } catch (e) { console.error(e); toast.error(t('app.error_create')); }
  };

  const handleEdit = async (id, data) => {
    try { await api.editBet(id, data); setEditingBet(null); refresh(); toast.success(t('app.ok_edited')); }
    catch(e) { console.error(e); toast.error(t('app.error_edit')); }
  };

  const handleDelete = async bet => {
    try { await api.cancelBet(bet.id); refresh(); toast.info(t('app.ok_cancelled')); }
    catch (e) {
      console.error(e);
      toast.error(e.data?.error === 'expired_no_cancel' ? t('app.error_expired_cancel') : t('app.error_cancel'));
    }
  };

  // Resolve actions both deferred 5s through a toast-with-undo. Real
  // production users mis-tap "won/lost" all the time; once the API has
  // fired the bet is settled and credits moved, so the 5-second buffer
  // is the difference between "oops" and "drama". The OS-prompt-style
  // toast carries the pending state — modals close immediately for
  // snappy UX, and the win/comment animations fire only after the
  // timeout commits the resolution.
  // Helper: enqueue a win celebration + comment prompt for the user's
  // POV on a freshly-resolved bet. Marking it as already-seen here
  // prevents the SSE-diff effect from re-firing for the same bet a
  // few hundred ms later when the new state lands.
  const enqueueCelebration = (bet, outcome, asConfirmer) => {
    const iWin = outcome === 'won' && (asConfirmer ? bet.creator === user : true);
    if (iWin) setWinAnimQueue(q => [...q, bet.potentialWin]);
    setCommentBetQueue(q => [...q, { ...bet, status: outcome }]);
    if (seenResolutionsRef.current) seenResolutionsRef.current.add(bet.id);
  };

  // Consensual = bet has a named opponent AND the user is the creator
  // (i.e. their resolve will be marked "proposed" server-side until the
  // opponent confirms). Everything else (Vault, Open, Surprise, or the
  // opponent confirming back) resolves immediately and is safe to
  // celebrate optimistically.
  const isConsensual = (bet, asConfirmer) =>
    !asConfirmer && !!bet.opponent && bet.creator === user;

  const performResolve = (bet, outcome, asConfirmer = false) => {
    if (isConsensual(bet, asConfirmer)) {
      // Wait for the API to confirm 'resolved' vs 'proposed' — only
      // celebrate if the server actually settled the bet.
      api.resolveBet(bet.id, outcome)
        .then(r => {
          if (r?.phase === 'resolved') enqueueCelebration(bet, outcome, asConfirmer);
        })
        .catch(e => console.error(e));
      return;
    }
    // Optimistic path: fire celebration immediately, run the API in
    // the background. Removes the post-undo network delay the user was
    // seeing on Render free tier. If the API errors, the SSE refresh
    // will reconcile the local state.
    enqueueCelebration(bet, outcome, asConfirmer);
    api.resolveBet(bet.id, outcome).catch(e => console.error(e));
  };

  const clearPendingResolve = (id) => {
    setPendingResolveIds(prev => {
      if (!prev.has(id)) return prev;
      const n = new Set(prev); n.delete(id); return n;
    });
  };

  const deferResolve = (bet, outcome, asConfirmer) => {
    setRevealBet(null); setResolveBet(null); setOvertimeBet(null);
    // Lock the declare button on this bet's card for the duration of
    // the undo toast — otherwise the user can re-tap "Dichiara esito"
    // before the result commits and end up declaring twice.
    setPendingResolveIds(prev => {
      const n = new Set(prev); n.add(bet.id); return n;
    });
    const messageKey = outcome === 'won' ? 'app.resolve_pending_won' : 'app.resolve_pending_lost';
    toast.action({
      message: t(messageKey, { title: bet.title || '' }),
      variant: outcome === 'won' ? 'success' : 'info',
      duration: 5000,
      actionLabel: t('app.undo'),
      onAction: () => {
        toast.info(t('app.resolve_undone'));
        clearPendingResolve(bet.id);
      },
      onTimeout: () => {
        clearPendingResolve(bet.id);
        performResolve(bet, outcome, asConfirmer);
      },
    });
  };

  const handleResolve         = (bet, outcome) => deferResolve(bet, outcome, false);
  // Consensual flow — opponent of a bet confirms (matches outcome) or
  // disputes (mismatching outcome) the proposal without ResolveModal.
  const handleConfirmOutcome  = (bet, outcome) => deferResolve(bet, outcome, true);

  // Either party can take back / cancel a pending proposal so a bet doesn't
  // stay locked while waiting for confirmation.
  const handleWithdrawResolve = async (bet) => {
    try { await api.withdrawResolve(bet.id); } catch (e) { console.error(e); }
  };

  // Overtime coin flip uses force=true so it bypasses the consensual gate —
  // both parties already accepted "let fate decide" by clicking through.
  const handleOvertimeResolve = (bet, outcome) => {
    setOvertimeBet(null);
    if (outcome === 'won' && bet.creator === user) {
      setWinAnimQueue(q => [...q, bet.potentialWin]);
    }
    setCommentBetQueue(q => [...q, { ...bet, status: outcome }]);
    if (seenResolutionsRef.current) seenResolutionsRef.current.add(bet.id);
    api.resolveBet(bet.id, outcome, { force: true }).catch(e => console.error(e));
  };

  const handleCounter = async (bet, cb) => {
    try {
      await api.counterBet(bet.id, { ...cb, id: `cb${Date.now()}` });
      setCounterTarget(null);
    } catch (e) { console.error(e); }
  };

  const handleFlame = async id => {
    try { await api.flameBet(id); } catch (e) { console.error(e); }
  };

  const handleComment = async (betId, comment) => {
    try { await api.commentBet(betId, comment); } catch (e) { console.error(e); }
    setCommentBetQueue(q => q.slice(1));
  };

  // Targeted bets now open the AcceptModal so the opponent can choose their
  // stake (pot-mode). The actual API call happens inside the modal\'s onAccept.
  const handleAccept = id => {
    const bet = bets.find(b => b.id === id);
    if (!bet) return;
    if (bet.opponent !== user) return; // safety
    setAcceptingBet(bet);
  };
  const submitAccept = async (id, body) => {
    try { await api.acceptBet(id, body); refresh(); toast.success(t('app.ok_accepted')); }
    catch(e) {
      console.error(e);
      const msg = e?.message === 'insufficient_credits'
        ? t('accept.err_insufficient')
        : t('app.error_accept');
      toast.error(msg);
    }
  };

  const handleReject = async id => {
    if (!window.confirm(t('app.reject_confirm'))) return;
    try { await api.rejectBet(id); refresh(); toast.info(t('app.ok_rejected')); }
    catch(e) { console.error(e); toast.error(t('app.error_reject')); }
  };

  const handleReaction = async (betId, emoji) => {
    try {
      const existing = reactions.find(r => r.bet_id === betId && r.bettor === user);
      // Toggle-off uses the new column-scoped DELETE so a user with a photo
      // doesn't lose it just because they un-set their emoji.
      if (existing && existing.emoji === emoji) {
        await api.removeReactionEmoji(betId);
      } else {
        await api.addReaction(betId, emoji);
      }
    } catch (e) { console.error(e); }
  };

  const handleReactionPhoto = async (betId, dataUrl) => {
    try { await api.addReactionPhoto(betId, dataUrl); }
    catch (e) { console.error(e); }
  };

  const handleUpdateProfile = async (userId, data) => {
    try { await api.updateProfile(data); } catch (e) { console.error(e); }
  };

  // Live-merge a saved profile back into authUser AND profiles[user] so the
  // avatar/name/color change shows everywhere immediately (no wait for SSE).
  const handleLiveProfileUpdate = u => {
    setAuthUser(prev => ({ ...prev, ...u }));
    setProfiles(prev => ({
      ...prev,
      [user]: {
        ...(prev[user] || {}),
        name:      u.name      ?? prev[user]?.name,
        avatar:    u.avatar    ?? prev[user]?.avatar,
        avatarUrl: u.avatarUrl !== undefined ? u.avatarUrl : prev[user]?.avatarUrl,
        color:     u.colorKey  ?? prev[user]?.color,
        colorKey:  u.colorKey  ?? prev[user]?.colorKey,
      },
    }));
  };

  const handleReset = async () => {
    try { await api.resetAll(); refresh(); toast.success(t('app.ok_reset')); }
    catch(e) { console.error(e); toast.error(t('app.error_reset')); }
  };

  const handleTestReset = async () => {
    try { await api.resetAllTest(); refresh(); toast.success(t('app.ok_reset')); }
    catch(e) { console.error(e); toast.error(t('app.error_reset')); }
  };

  const handleCreateCategory = async cat => {
    try { await api.createCategory(cat); } catch (e) { console.error(e); }
  };

  const handleDeleteCategory = async id => {
    try { await api.deleteCategory(id); } catch (e) { console.error(e); }
  };

  const handleSetVaultPin = pin => {
    setVaultPin(user, pin);
    setPinVersion(v => v + 1);
  };

  // Mobile nav swipe — must be before any early returns so hook count is stable.
  // navBarEl is a callback-ref state: re-runs this effect the moment the nav mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isDesktop || !navBarEl) return;
    const el = navBarEl;
    const s = navSwipeStateRef.current;
    const getIdx = touch => {
      const found = document.elementFromPoint(touch.clientX, touch.clientY);
      const item = found?.closest('[data-navswipe]');
      return item ? parseInt(item.dataset.navswipe, 10) : -1;
    };
    const onStart = e => {
      s.startX = e.touches[0]?.clientX ?? null;
      s.swipeMode = false;
      s.idx = -1;
    };
    const onMove = e => {
      if (s.startX === null || !e.touches[0]) return;
      if (Math.abs(e.touches[0].clientX - s.startX) > 10) s.swipeMode = true;
      if (!s.swipeMode) return;
      e.preventDefault();
      const idx = getIdx(e.touches[0]);
      if (idx >= 0 && idx !== s.idx) { s.idx = idx; setNavSwipeIdx(idx); }
    };
    const onEnd = () => {
      if (s.swipeMode && s.idx >= 0) setView(navRef.current[s.idx]?.id ?? null);
      s.startX = null; s.swipeMode = false; s.idx = -1;
      setNavSwipeIdx(-1);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove',  onMove,  { passive: false });
    el.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
      el.removeEventListener('touchend',   onEnd);
    };
  }, [isDesktop, navBarEl]);

  // Back gesture: swipe right from the left edge of the screen to close the
  // topmost open modal — mirrors the native iOS/Android back swipe.
  // Registered on document (not the nav bar) so it fires regardless of what
  // is on screen. Non-passive touchmove lets us preventDefault once we have
  // committed to a horizontal direction, preventing scroll during the swipe.
  // closeTopModalRef is kept fresh by the effect above; reading it here avoids
  // re-registering these listeners on every modal state change.
  // On sub-component popovers (e.g. TrophyDetailPopover) the 'backgesture'
  // CustomEvent lets them close themselves without prop-drilling.
  useEffect(() => {
    if (isDesktop) return;
    const EDGE   = 22;   // px from left edge required to start the gesture
    const THRESH = 80;   // px rightward travel needed to trigger close
    const VERT   = 40;   // px vertical drift that cancels the gesture
    const s = { startX: null, startY: null, locked: false };

    const onStart = e => {
      const x = e.touches[0].clientX;
      if (x > EDGE) return;
      s.startX = x;
      s.startY = e.touches[0].clientY;
      s.locked = false;
    };
    const onMove = e => {
      if (s.startX === null) return;
      const dx = e.touches[0].clientX - s.startX;
      const dy = Math.abs(e.touches[0].clientY - s.startY);
      if (dy > VERT) { s.startX = null; return; }
      if (dx > 8)    { s.locked = true; e.preventDefault(); }
    };
    const onEnd = e => {
      if (!s.locked) return;
      const dx = e.changedTouches[0].clientX - s.startX;
      s.startX = null; s.locked = false;
      if (dx < THRESH) return;
      document.dispatchEvent(new CustomEvent('backgesture'));
      closeTopModalRef.current?.();
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove',  onMove,  { passive: false });
    document.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove',  onMove);
      document.removeEventListener('touchend',   onEnd);
    };
  }, [isDesktop]);

  // Horizontal swipe on content area: left = next nav item, right = previous.
  // Starts outside the 22px left-edge zone reserved for the back gesture.
  useEffect(() => {
    if (isDesktop) return;
    const EDGE   = 22;
    const THRESH = 90;
    const VERT   = 40;
    const s = { startX: null, startY: null, locked: false };

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
    const onMove = e => {
      if (s.startX === null) return;
      if (closeTopModalRef.current) { s.startX = null; s.locked = false; return; }
      const dx = e.touches[0].clientX - s.startX;
      const dy = Math.abs(e.touches[0].clientY - s.startY);
      if (dy > VERT) { s.startX = null; return; }
      if (Math.abs(dx) > 10) { s.locked = true; e.preventDefault(); }
    };
    const onEnd = e => {
      if (!s.locked || s.startX === null) return;
      if (closeTopModalRef.current) { s.startX = null; s.locked = false; return; }
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

  // Android / PWA system back gesture: intercepts the browser's popstate event
  // (fired by the Android back swipe / back button) so it closes the topmost
  // open modal rather than navigating away from the app.
  // Strategy: push a "guard" history entry on mount. Each time the user presses
  // back and a modal is open, we close the modal and immediately re-push the
  // guard so the next back press is also captured. If no modal is open we let
  // the navigation proceed naturally (app closes / returns to launcher).
  useEffect(() => {
    if (isDesktop) return;
    history.pushState({ backGuard: true }, '');
    const onPop = () => {
      if (closeTopModalRef.current) {
        closeTopModalRef.current();
        history.pushState({ backGuard: true }, '');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isDesktop]);

  // Splash screen (runs in parallel with auth check; stays until both done)
  if (!splashDone) return <SplashScreen onDone={() => setSplashDone(true)} />;

  // Loading screen — auth still resolving after splash. Cold starts on the
  // free Render+Neon tier can take ~30s, so we escalate the message at 3s
  // ("waking the server") and again at 15s ("can take up to 30s") rather
  // than leaving the user staring at a lonely ₡.
  if (authLoading) return <ColdStartLoader t={t} />;

  // Auth gate.  Hijack the screen for ?reset=TOKEN so an emailed link works
  // even before the user is logged in.
  if (!token || !authUser) {
    const resetParam = (() => {
      try { return new URL(window.location.href).searchParams.get('reset'); }
      catch { return null; }
    })();
    return (
      <div className="bc" style={rootVars(C)}>
        <style>{CSS_BASE}</style>
        {resetParam
          ? <Suspense fallback={<SkeletonList count={2} />}>
              <ResetPasswordView token={resetParam} onDone={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('reset');
                window.history.replaceState({}, '', url.toString());
                // Force re-render by toggling a no-op state — easiest: reload.
                window.location.reload();
              }}/>
            </Suspense>
          : <AuthView onAuth={handleAuth} />}
      </div>
    );
  }

  // Loading groups (between login and getMyGroups response)
  if (!groupsLoaded) return (
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',
      justifyContent:'center',background:'var(--bg)'}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:32,color:'var(--gold)'}}>₡</div>
    </div>
  );

  // Group gate — show only if loading is finished and there are still no groups
  if (groups.length === 0) return (
    <div className="bc" style={rootVars(C)}>
      <style>{CSS_BASE}</style>
      <PairingView user={authUser} onGroupCreated={g => { handleGroupCreated(g); loadGroups(); }} />
    </div>
  );

  const secretCount = bets.filter(b => b.creator === user && b.isSecret && b.status === 'active').length;
  // On mobile we reserve room at the bottom for the fixed nav bar PLUS
  // the iOS home-indicator safe area, so the last bet card is never
  // clipped behind the nav on iPhone.
  const rootStyle = isDesktop
    ? { ...rootVars(C), minHeight: '100vh', position: 'relative' }
    : {
        ...rootVars(C), maxWidth: 480, margin: '0 auto', position: 'relative',
        paddingBottom: 'calc(84px + env(safe-area-inset-bottom))',
      };

  const NAV = [
    { id: 'dashboard', e: '🏠', l: t('nav.dashboard') },
    { id: 'bets',      e: '🎯', l: t('nav.bets') },
    { id: 'stats',     e: '📊', l: t('nav.stats') },
    { id: 'trophies',  e: '🏆', l: t('nav.trophies') },
    { id: 'settings',  e: '👤', l: t('nav.profile') },
  ];
  navRef.current = NAV; // sync ref every render so onEnd can navigate by index

  const myProfile = profiles[user] ?? { name: authUser.name, avatar: authUser.avatar, avatarUrl: authUser.avatar_url, colorKey: authUser.color_key };
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const myRole  = activeGroup?.role ?? 'member';
  const isAdmin = myRole === 'owner';
  const myPermissions = activeGroup?.permissions || {};
  // Owner has everything; co-admin has the flagged ones; member has nothing admin
  const can = perm => isAdmin || (myRole === 'co-admin' && myPermissions[perm] === true);

  const groupPickerEl = groups.length > 0 && (
    <GroupPicker
      groups={groups}
      activeGroupId={activeGroupId}
      onSwitch={switchGroup}
      onCreate={() => setShowGroupModal(true)}
      onOpenGroupInfo={() => setShowGroupInfo(true)}
      compact={!isDesktop}
    />
  );

  return (
    <div className="bc" style={rootStyle}>
      <style>{CSS_BASE}</style>

      {syncError && (
        <div style={{position:'fixed',top:8,left:'50%',transform:'translateX(-50%)',zIndex:1000,
          background:'var(--red)',color:'#fff',padding:'8px 14px',borderRadius:8,fontSize:12,
          boxShadow:'0 4px 12px rgba(0,0,0,.3)',cursor:'pointer'}}
          onClick={() => { setSyncError(null); refresh(); }}>
          ⚠ {t('app.sync_error')}
        </div>
      )}

      {/* Sidebar: desktop only — broken column. No hard right wall (the
          border becomes a soft fading gradient), brand tilts slightly off
          axis, profile chip is indented from the brand instead of sharing
          its left edge. */}
      {isDesktop && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: 240, height: '100vh',
          background: 'linear-gradient(90deg, var(--surf) 0%, var(--surf) 70%, transparent 100%)',
          borderRight: 'none',
          display: 'flex', flexDirection: 'column', zIndex: 50, padding: '32px 0 20px',
        }}>
          <div style={{ padding: '0 20px 22px', borderBottom: '1px solid var(--rule)', marginBottom: 8 }}>
            <div style={{
              marginBottom:22,
              transform: 'rotate(-2deg)', transformOrigin: 'left center',
              display: 'inline-block',
            }}>
              <VincitWordmark size={28} />
            </div>
            <div
              onClick={() => setProfileMenuOpen(true)}
              title={t('profile.edit_title')}
              style={{
                display:'flex', alignItems:'center', gap:12, cursor:'pointer',
                borderRadius:999, padding:'4px 8px 4px 4px',
                marginLeft: 14, /* indent — break left-edge axis */
                transition:'background .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--soft)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${COLORS[myProfile.colorKey] || '#5b8af0'}33`, border: `1px solid ${COLORS[myProfile.colorKey] || '#5b8af0'}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink:0, overflow:'hidden' }}>
                {myProfile.avatarUrl
                  ? <img src={myProfile.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : myProfile.avatar}
              </div>
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic', fontSize: 18, fontWeight: 600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', lineHeight:1.05 }}>{myProfile.name}</div>
                <div className="bc-num" style={{ fontSize: 14, color: 'var(--gold)', marginTop:2 }}>{Math.round(credits[user] ?? 0)}<span
                  onClick={e => { e.stopPropagation(); setCoinFlipOpen(true); }}
                  style={{fontSize:'0.7em', opacity:.6, marginLeft:3}}
                >₡</span></div>
              </div>
            </div>
          </div>
          {groups.length > 0 && (
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--brd)', marginBottom:4 }}>
              {groupPickerEl}
            </div>
          )}
          <div style={{ padding:'8px 20px 4px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <button onClick={() => { setInboxOpen(true); markInboxRead(); }}
              style={{ position:'relative', background:'transparent', border:'none', cursor:'pointer',
                display:'flex', alignItems:'center', gap:7, padding:'6px 0', fontSize:13,
                fontFamily:"'Manrope',sans-serif", color:'var(--dim)', fontWeight:600,
                letterSpacing:'.06em', WebkitTapHighlightColor:'transparent' }}>
              <span style={{ fontSize:17, lineHeight:1 }}>🔔</span>
              Notifiche
              {inboxUnread > 0 && (
                <span style={{ minWidth:18, height:18, padding:'0 5px', borderRadius:9,
                  background:'var(--red)', color:'#fff',
                  fontSize:10, fontWeight:800, fontFamily:"'Manrope',sans-serif",
                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                }}>{inboxUnread > 9 ? '9+' : inboxUnread}</span>
              )}
            </button>
          </div>
          {/* Broken-grid nav — each item lives at its own indent + font size,
              with a couple of items shifted vertically so the column zig-zags
              instead of stepping down on a perfect ladder.
              On hover, items dock-zoom: hovered grows biggest, neighbors
              slightly less, distant ones stay put. Mac-style magnification. */}
          <div
            style={{ flex: 1, padding: '12px 0 0', position: 'relative' }}
            onMouseLeave={() => setNavHover(-1)}
          >
            {NAV.map((n, idx) => {
              // Per-item offsets keep the menu intentionally uneven.
              const offsets = [
                { px: 14, sz: 14, mt: 0 },   // 0
                { px: 28, sz: 13, mt: 2 },   // 1
                { px: 10, sz: 13, mt: 4 },   // 2
                { px: 34, sz: 14, mt: 2 },   // 3
                { px: 18, sz: 13, mt: 4 },   // 4
                { px: 30, sz: 13, mt: 2 },   // 5
                { px: 14, sz: 13, mt: 4 },   // 6
              ];
              const o = offsets[idx] || offsets[offsets.length - 1];
              const isActive = view === n.id;
              // Dock zoom: hovered = 1.22, neighbor = 1.10, two-away = 1.03
              const dist = navHover < 0 ? 99 : Math.abs(idx - navHover);
              const zoom = navHover < 0
                ? 1
                : dist === 0 ? 1.22
                : dist === 1 ? 1.10
                : dist === 2 ? 1.03
                : 1;
              return (
                <div key={n.id} data-tour={`nav-${n.id}`} onClick={() => view === n.id ? window.scrollTo({ top: 0, behavior: 'smooth' }) : setView(n.id)}
                  onMouseEnter={() => setNavHover(idx)}
                  className="nav-item" style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 14px 8px ' + o.px + 'px',
                  marginTop: o.mt,
                  cursor: 'pointer',
                  fontFamily:"'Cormorant Garamond',serif",
                  fontSize: isActive ? o.sz + 4 : o.sz,
                  fontStyle: 'italic',
                  fontWeight: isActive ? 600 : 500,
                  letterSpacing: '-0.01em',
                  color: isActive ? 'var(--gold)' : 'var(--dim)',
                  background: 'transparent',
                  borderLeft: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'left center',
                  transition: 'transform .25s cubic-bezier(.34,1.56,.64,1), color .2s, font-size .2s',
                  userSelect: 'none', position: 'relative',
                  willChange: 'transform',
                }}>
                  <span style={{ fontSize: 17, transition: 'font-size .2s' }}>{n.e}</span>
                  {n.l}
                  {n.id === 'bets' && secretCount > 0 && (
                    <div title="Vault" style={{ position: 'absolute', right: 14, width: 6, height: 6, borderRadius: 999, background: 'var(--gold)' }}/>
                  )}
                  {n.id === 'friends' && pendingFriendCount > 0 && (
                    <div style={{ position: 'absolute', right: 14, width: 6, height: 6, borderRadius: 999, background: 'var(--red)' }}/>
                  )}
                </div>
              );
            })}
          </div>
          {/* "Nuovo Bet" CTA — pinned bottom but indented to the right so it
              doesn't sit on the same axis as the brand. */}
          <div style={{ padding: '18px 14px 4px 40px' }}>
            <button data-tour="new-bet" onClick={() => setShowCreate(true)} style={{
              width: '100%', padding: '13px 0', borderRadius: 999, border: 'none',
              background: 'var(--pur)', color: '#1a1530',
              fontFamily: "'Manrope',sans-serif", fontSize: 12, fontWeight: 700,
              letterSpacing: '.18em', textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: '0 14px 36px -12px var(--pur), 0 1px 0 rgba(255,255,255,.15) inset',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>{t('app.new_bet')}</button>
          </div>
        </div>
      )}

      {/* Header: mobile only */}
      {!isDesktop && (
        <div style={{
          position: 'sticky', top: 0, background: C.bg, zIndex: 10,
          borderBottom: `1px solid ${C.brd}22`,
          // Push the brand below the iPhone notch when present.
          paddingTop: 'env(safe-area-inset-top)',
        }}>
          <div style={{ padding: '14px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap:10 }}>
            <div>
              <VincitWordmark size={22} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ textAlign:'right', lineHeight:1.1 }}>
                <div style={{ fontSize: 9, color:'var(--dim)', letterSpacing:1.5, textTransform:'uppercase' }}>{t('app.credits')}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{Math.round(credits[user] ?? 0)} <span
                  onClick={() => setCoinFlipOpen(true)}
                  style={{display:'inline-block'}}
                >₡</span></div>
              </div>
              <button onClick={() => { setInboxOpen(true); markInboxRead(); }}
                style={{ position:'relative', background:'transparent', border:'none', cursor:'pointer',
                  padding:'6px 4px', fontSize:20, lineHeight:1, flexShrink:0,
                  WebkitTapHighlightColor:'transparent' }}>
                🔔
                {inboxUnread > 0 && (
                  <span style={{ position:'absolute', top:0, right:-2,
                    minWidth:16, height:16, padding:'0 3px', borderRadius:8,
                    background:'var(--red)', color:'#fff',
                    fontSize:10, fontWeight:700, fontFamily:"'Manrope',sans-serif",
                    display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1,
                  }}>{inboxUnread > 9 ? '9+' : inboxUnread}</span>
                )}
              </button>
              <div
                onClick={() => setProfileMenuOpen(true)}
                title={t('profile.edit_title')}
                style={{ width: 36, height: 36, borderRadius: '50%', background: `${COLORS[myProfile.colorKey] || '#5b8af0'}33`, border: `2px solid ${COLORS[myProfile.colorKey] || '#5b8af0'}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, overflow:'hidden', cursor:'pointer', transition:'transform .15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {myProfile.avatarUrl
                  ? <img src={myProfile.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : myProfile.avatar}
              </div>
            </div>
          </div>
          {groups.length > 0 && (
            <div style={{ padding:'0 16px 10px' }}>{groupPickerEl}</div>
          )}
        </div>
      )}

      {/* Content — overflow:hidden catches any deliberate bleed from the
          broken-grid layouts inside views (giant italic headlines, dice with
          rotate offsets, leaderboard numbers floating off-baseline). */}
      <div style={isDesktop
        ? { marginLeft: 240, maxWidth: 1320, padding: '32px 64px 32px 56px', overflowX: 'hidden' }
        : { padding: '14px 20px', overflowX: 'hidden' }}>
        {(() => {
          const dataReady = !!profiles[user];
          if (!dataReady) {
            if (view === 'dashboard') return <SkeletonDashboard />;
            if (view === 'bets')      return <SkeletonList count={4} withGoldStripe={betsTab==='vault'} />;
            if (view === 'stats' || view === 'trophies') return <SkeletonList count={3} />;
            return null;
          }
          // Single Suspense boundary around every view. Dashboard is
          // eager so the fallback only shows the first time the user
          // navigates to one of the lazy views; subsequent visits hit
          // the cached chunk and render immediately.
          const ViewFallback =
            view === 'bets'                              ? <SkeletonList count={4} withGoldStripe={betsTab==='vault'} />
            : (view === 'stats' || view === 'trophies') ? <SkeletonList count={3} />
            :                                              <SkeletonList count={3} />;
          return (<Suspense fallback={ViewFallback}><>
            {view === 'dashboard' && <DashboardView user={user} profiles={profiles} groupMembers={groupMembers} credits={credits} bets={bets} cats={cats} onCreate={() => setShowCreate(true)} onResolve={b => setResolveBet(b)} onReveal={b => setRevealBet(b)} onCounter={b => setCounterTarget(b)} onFlame={handleFlame} notifSince={notifSince} isDesktop={isDesktop} reactions={reactions} onReaction={handleReaction} onReactionPhoto={handleReactionPhoto} onDelete={handleDelete} onEdit={b => setEditingBet(b)} onAccept={handleAccept} onReject={handleReject} can={can} onGoToVault={goToVault} onGoToBets={goToAllBets} onConfirmOutcome={handleConfirmOutcome} onWithdrawResolve={handleWithdrawResolve} onOvertime={b => setOvertimeBet(b)} onEggUnlock={onEggFired} onOpenDie={() => setDieRollOpen(true)} onOpenIceEgg={() => setIceEggOpen(true)} onOpenPhoenixEgg={() => setPhoenixEggOpen(true)} pendingResolveIds={pendingResolveIds} onNotifSeen={handleNotifSeen} feedEvents={feedEvents} />}
            {view === 'bets'      && <BetsHubView
                tab={betsTab} setTab={setBetsTab}
                user={user} profiles={profiles} bets={bets} cats={cats} isDesktop={isDesktop}
                betsViewKey={betsViewKey} initialStatus={betsInitialStatus}
                onResolve={b => setResolveBet(b)} onCounter={b => setCounterTarget(b)} onFlame={handleFlame}
                reactions={reactions} onReaction={handleReaction} onReactionPhoto={handleReactionPhoto}
                onDelete={handleDelete} onEdit={b => setEditingBet(b)} onAccept={handleAccept} onReject={handleReject} can={can}
                onReveal={b => setRevealBet(b)} vaultUnlocked={vaultUnlocked} onPinRequest={() => setShowPin(true)} vaultPin={vaultPin} onSetVaultPin={handleSetVaultPin}
                onConfirmOutcome={handleConfirmOutcome} onWithdrawResolve={handleWithdrawResolve} onOvertime={b => setOvertimeBet(b)}
                onOpenCreate={() => setShowCreate(true)}
                pendingResolveIds={pendingResolveIds}
              />}
            {view === 'stats'     && <StatsView user={user} profiles={profiles} groupMembers={groupMembers} credits={credits} bets={bets} cats={cats} isDesktop={isDesktop} onOpenCreate={() => setShowCreate(true)} />}
            {view === 'trophies'  && <TrophiesView bets={bets} isDesktop={isDesktop} />}
            {view === 'friends'   && <FriendsView groups={groups} user={user} myBets={bets} myCredits={credits[user] ?? 0} onSwitchToGroup={switchGroup} isDesktop={isDesktop} />}
            {view === 'admin' && authUser?.is_admin && <AdminView isDesktop={isDesktop} meId={authUser?.id} />}
            {view === 'settings'  && <SettingsView user={user} profiles={profiles} groupMembers={groupMembers} isDark={isDark} setIsDark={setIsDark} theme={theme} setTheme={setTheme} customCats={customCats} credits={credits} bets={bets} onUpdateProfile={handleUpdateProfile} onCreateCategory={handleCreateCategory} onDeleteCategory={handleDeleteCategory} vaultPin={vaultPin} onSetVaultPin={handleSetVaultPin} isDesktop={isDesktop} onReset={handleReset} onTestReset={handleTestReset} onLogout={handleLogout} onOpenProfileEdit={() => setShowProfileEdit(true)} isAdmin={isAdmin} can={can} onNavigate={setView} pendingFriendCount={pendingFriendCount} canAccessAdmin={!!authUser?.is_admin} />}
          </></Suspense>);
        })()}
      </div>

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

      {/* PWA install banner — only after login + a group exists (user has
          context) AND no modal/tour is in the way. */}
      <PwaInstallBanner t={t}
        visible={!!(user && groups.length > 0 && !showCreate && !showGroupModal && (tourDone || tourPaused))} />

      {/* Modals + overlays — wrapped in a Suspense so the lazy chunks
          can load on demand. fallback=null because a hidden modal
          should stay hidden during its first fetch (no flash of UI). */}
      <Suspense fallback={null}>
      {showCreate     && <CreateModal user={user} profiles={profiles} groupMembers={groupMembers} maxC={credits[user]??0} cats={cats} settings={settings} onCreate={handleCreate} onClose={() => {
        setShowCreate(false);
        // If the tour was paused so the user could try the modal as a demo,
        // resume it: come back at the page the parent pre-advanced to before
        // opening the modal (handled in the OnboardingTour onOpenCreate
        // callback below). Skips if the user finished the tour normally.
        if (tourPaused && !tourDone) setTourPaused(false);
      }} onEggUnlock={onEggFired}
        // noviceMode auto-opens the coachmark sequence inside CreateModal.
        // True when the modal was launched from the onboarding tour demo CTA,
        // so first-timers get the walkthrough without having to click "?".
        noviceMode={tourPaused && !tourDone}
      />}
      {revealBet      && <RevealModal bet={revealBet} cats={cats} onResolve={handleResolve} onClose={() => setRevealBet(null)} />}
      {resolveBet     && <ResolveModal bet={resolveBet} cats={cats} profiles={profiles} onResolve={handleResolve} onClose={() => setResolveBet(null)} />}
      {counterTarget  && <CounterModal bet={counterTarget} user={user} profiles={profiles} credits={credits} cats={cats} onPlace={handleCounter} onClose={() => setCounterTarget(null)} />}
      {overtimeBet    && <OvertimeModal bet={overtimeBet} profiles={profiles} onResult={handleOvertimeResolve} onClose={() => setOvertimeBet(null)} />}
      {showPin        && <PinModal user={user} profiles={profiles} vaultPin={vaultPin} onSuccess={() => { setVaultUnlocked(true); setShowPin(false); }} onClose={() => setShowPin(false)} />}
      {winAnim        && <WinOverlay amount={winAnim} onDone={() => setWinAnimQueue(q => q.slice(1))} />}
      {commentBetModal && winAnimQueue.length === 0 && <CommentModal bet={commentBetModal} onSave={handleComment} onSkip={() => setCommentBetQueue(q => q.slice(1))} />}
      {editingBet && <EditModal bet={editingBet} cats={cats} user={user} onSave={handleEdit} onClose={() => setEditingBet(null)}/>}
      {acceptingBet && (
        <AcceptModal
          bet={acceptingBet}
          profiles={profiles}
          myCredits={credits[user] ?? 0}
          onAccept={submitAccept}
          onClose={() => setAcceptingBet(null)}
        />
      )}
      {showGroupModal && <CreateGroupModal onCreated={handleGroupCreated} onClose={() => setShowGroupModal(false)} />}
      {showProfileEdit && (
        <ProfileEditModal
          profile={myProfile}
          onSaved={handleLiveProfileUpdate}
          onClose={() => setShowProfileEdit(false)}
        />
      )}
      {profileMenuOpen && (
        <ProfileAvatarMenu
          profile={myProfile}
          t={t}
          onEdit={() => { setProfileMenuOpen(false); setShowProfileEdit(true); }}
          onLogout={() => { setProfileMenuOpen(false); handleLogout(); }}
          onClose={() => setProfileMenuOpen(false)}
        />
      )}
      {/* Easter egg #2: coin flip overlay */}
      <CoinFlipOverlay open={coinFlipOpen} onClose={() => setCoinFlipOpen(false)} onEggUnlock={onEggFired} />

      {/* Easter egg #1: die roll overlay */}
      <DieRollOverlay open={dieRollOpen} onClose={() => setDieRollOpen(false)} onEggUnlock={onEggFired} />

      {/* Easter egg #4: ❄️ ice — 3 taps on the loss-streak emoji.
          Unlike egg_dice/egg_coin which gate the popup to first-trigger-per-
          device (those eggs are largely incidental, you don't usually re-roll
          a die to chase the popup), the streak eggs are explicitly opt-in —
          the user fires them deliberately with a 3-tap combo — so we always
          re-fire the trophy popup on each trigger. The trophy queue already
          dedups same-id entries so spam-tapping won't stack popups. */}
      {/* Egg trophy popup fires ONLY on the first unlock. After that the
          user can still re-watch the animation (the overlay always plays
          on triple-tap), but they don't get spammed with the same
          "🏆 Trofeo sbloccato" banner + push every time. The unlock
          endpoint returns alreadyUnlocked: true on subsequent calls so
          we can branch on it client-side. */}
      <IceEggOverlay open={iceEggOpen} onClose={() => {
        setIceEggOpen(false);
        api.unlockSecretAchievement('egg_ice')
          .then(r => {
            if (!r?.alreadyUnlocked) onEggFired('egg_ice');
            // metaUnlocked = the meta egg_master fired *now* on the
            // server because this was the fifth and final egg.
            if (r?.metaUnlocked) onEggFired('egg_master');
          })
          .catch(e => console.error('[egg_ice] unlock failed', e));
      }} />

      <PhoenixEggOverlay open={phoenixEggOpen} onClose={() => {
        setPhoenixEggOpen(false);
        api.unlockSecretAchievement('egg_phoenix')
          .then(r => {
            if (!r?.alreadyUnlocked) onEggFired('egg_phoenix');
            if (r?.metaUnlocked) onEggFired('egg_master');
          })
          .catch(e => console.error('[egg_phoenix] unlock failed', e));
      }} />

      {/* In-app notification inbox */}
      <NotifInbox
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        items={inboxItems}
        onMarkAllRead={markInboxRead}
        onClearAll={clearInbox}
        onGoToBet={() => { setView('bets'); setInboxOpen(false); }}
      />

      {/* Trophy unlock animation — small banner top-center, ~3s per unlock */}
      <TrophyUnlockOverlay queue={trophyQueue} onDone={consumeTrophy} />

      {/* Onboarding — editorial fullscreen tour. Step is controlled here
          so opening the CreateModal demo (page 4 "Aprilo ora") doesn't lose
          progress: we pre-advance to the next page, hide the tour while
          the modal is open, then unhide on modal close. */}
      {!tourDone && !!profiles[user] && !tourPaused && (
        <OnboardingTour
          step={tourStep}
          onStepChange={setTourStep}
          onDone={() => { localStorage.setItem('bc_onboarding_done', '1'); setTourDone(true); }}
          onOpenCreate={() => {
            // Move to the next page BEFORE pausing so the resume lands there.
            setTourStep(s => s + 1);
            setTourPaused(true);
            setShowCreate(true);
          }}
        />
      )}

      {showGroupInfo && (
        <GroupInfoModal
          group={groups.find(g => g.id === activeGroupId)}
          userId={user}
          isAdmin={isAdmin}
          can={can}
          onClose={() => setShowGroupInfo(false)}
          onRenamed={async updated => {
            setGroups(prev => prev.map(g => g.id === updated.id ? { ...g, ...updated } : g));
            setShowGroupInfo(false);
            api.getGroupMembers(updated.id).then(setGroupMembers).catch(() => {});
          }}
          onLeft={async () => {
            setShowGroupInfo(false);
            const updated = await api.getMyGroups().catch(() => []);
            setGroups(updated);
            const first = updated[0]?.id ?? null;
            setActiveGroupId(first);
            if (first) lsSet('bc_active_group', first);
            else lsDel('bc_active_group');
          }}
          onDeleted={async () => {
            setShowGroupInfo(false);
            const updated = await api.getMyGroups().catch(() => []);
            setGroups(updated);
            const first = updated[0]?.id ?? null;
            setActiveGroupId(first);
            if (first) lsSet('bc_active_group', first);
            else lsDel('bc_active_group');
          }}
        />
      )}
      </Suspense>
    </div>
  );
}
