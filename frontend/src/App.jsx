import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSync } from './useSync.js';
import * as api from './api.js';

import { DARK, LIGHT, rootVars, DEF_CATS, COLORS } from './components/Atoms.jsx';
import { useLang } from './i18n.js';
import WinOverlay from './components/WinOverlay.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import OnboardingTour from './components/OnboardingTour.jsx';
import TrophyUnlockOverlay from './components/TrophyUnlockOverlay.jsx';
import DieFace from './components/DieFace.jsx';
import Coin3D from './components/Coin.jsx';
import { SkeletonDashboard, SkeletonList } from './components/Skeleton.jsx';
import { useToast } from './Toast.jsx';
import AuthView from './components/views/AuthView.jsx';
import ResetPasswordView from './components/views/ResetPasswordView.jsx';
import PairingView from './components/views/PairingView.jsx';
import DashboardView from './components/views/DashboardView.jsx';
import BetsHubView from './components/views/BetsHubView.jsx';
import StatsView from './components/views/StatsView.jsx';
import TrophiesView from './components/views/TrophiesView.jsx';
import FriendsView  from './components/views/FriendsView.jsx';
import AdminView    from './components/views/AdminView.jsx';
import SettingsView from './components/views/SettingsView.jsx';
import CreateModal from './components/modals/CreateModal.jsx';
import CreateGroupModal from './components/modals/CreateGroupModal.jsx';
import GroupInfoModal from './components/modals/GroupInfoModal.jsx';
import RevealModal from './components/modals/RevealModal.jsx';
import { ResolveModal, OvertimeModal } from './components/modals/ResolveModal.jsx';
import CounterModal from './components/modals/CounterModal.jsx';
import PinModal from './components/modals/PinModal.jsx';
import CommentModal from './components/modals/CommentModal.jsx';
import EditModal from './components/modals/EditModal.jsx';
import AcceptModal from './components/modals/AcceptModal.jsx';
import ProfileEditModal from './components/modals/ProfileEditModal.jsx';
import GroupPicker from './components/GroupPicker.jsx';

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
export async function registerPush(user) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const { publicKey } = await fetch('/api/push/vapid-key').then(r => r.json());
    if (!publicKey) return 'no-vapid';
    if (Notification.permission === 'denied') return 'denied';
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return perm; // 'denied' | 'default'
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
.bc *{box-sizing:border-box;margin:0;padding:0}
.bc{font-family:'Manrope',sans-serif;transition:background .25s,color .25s}

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
    radial-gradient(60vmax 40vmax at 12% 18%,  rgba(183,148,244,.10) 0%, transparent 55%),
    radial-gradient(70vmax 50vmax at 88% 82%,  rgba(196,168,120,.07) 0%, transparent 60%),
    radial-gradient(40vmax 30vmax at 50% 95%,  rgba(122,162,255,.05) 0%, transparent 60%);
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

/* Focus ring (keyboard nav) — uses lavender now; gold is reserved for accents. */
.bc button:focus-visible,
.bc input:focus-visible,
.bc textarea:focus-visible,
.bc select:focus-visible{
  outline:2px solid var(--pur);
  outline-offset:2px;
  border-radius:8px;
}

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
const DIE_LS_KEY = 'bc_egg_dice_rolled';

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
      // We always call onEggUnlock so the trophy poll re-runs even if the
      // unlock fired on a previous device (and is therefore already in
      // the DB but not yet in this client's baseline).
      // Always fire the API (idempotent server-side). The popup banner is
      // gated locally so the user sees it the first time they trigger the
      // egg on THIS device — even if the trophy is already in their
      // collection from a previous device/test. The server's
      // alreadyUnlocked field doesn't match the user's mental model of
      // "first time I rolled it".
      let popThisRoll = false;
      try {
        if (!localStorage.getItem('bc_egg_dice_popped')) {
          localStorage.setItem('bc_egg_dice_popped', '1');
          popThisRoll = true;
        }
        localStorage.setItem(DIE_LS_KEY, '1');
      } catch {}
      api.unlockSecretAchievement('egg_dice')
        .then(() => { if (popThisRoll) onEggUnlockRef.current?.('egg_dice'); })
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
      background:'radial-gradient(circle at 50% 45%, rgba(43,34,71,.95) 0%, rgba(15,11,35,.96) 70%)',
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
      {phase === 'settled' && (
        <div className="bIn" style={{textAlign:'center'}}>
          <div className="bc-meta" style={{marginBottom:10, color:'var(--gold)'}}>— Esito</div>
          <div style={{
            fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
            fontSize:'clamp(48px, 12vw, 92px)', fontWeight:600,
            color:'var(--gold)', letterSpacing:'-0.02em', lineHeight: 1,
          }}>{face}</div>
        </div>
      )}
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
    // See DieRollOverlay for the rationale on per-device LS gating.
    let popThisFlip = false;
    try {
      if (!localStorage.getItem('bc_egg_coin_popped')) {
        localStorage.setItem('bc_egg_coin_popped', '1');
        popThisFlip = true;
      }
      localStorage.setItem(COIN_LS_KEY, '1');
    } catch {}
    api.unlockSecretAchievement('egg_coin')
      .then(() => { if (popThisFlip) onEggUnlockRef.current?.('egg_coin'); })
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
      background:'radial-gradient(circle at 50% 45%, rgba(43,34,71,.95) 0%, rgba(15,11,35,.96) 70%)',
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

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const C = isDark ? DARK : LIGHT;
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

  const refresh = useSync(useCallback(data => {
    if (data.profiles)   setProfiles(data.profiles);
    if (data.credits)    setCredits(data.credits);
    if (data.bets)       setBets(data.bets);
    if (data.categories) setCustomCats(data.categories);
    if (data.reactions)  setReactions(data.reactions);
    if (data.settings)   setSettings(data.settings);
  }, []), activeGroupId, token, setSyncError);

  const cats = [...DEF_CATS, ...customCats];

  const [view, setView] = useState('dashboard');
  const [betsTab, setBetsTab] = useState('open'); // 'open' | 'vault' — inside the Bets hub
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
  const [winAnim, setWinAnim]             = useState(null);
  const [commentBetModal, setCommentBetModal] = useState(null);
  const [editingBet, setEditingBet]       = useState(null);
  const [acceptingBet, setAcceptingBet]   = useState(null);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [coinFlipOpen,    setCoinFlipOpen]    = useState(false); // easter egg #2 (coin)
  const [dieRollOpen,     setDieRollOpen]     = useState(false); // easter egg #1 (dice)
  const [eggTick,         setEggTick]         = useState(0);     // bumps after a secret unlock so trophy polling refreshes
  const [pendingFriendCount, setPendingFriendCount] = useState(0);

  useEffect(() => { if (user && groups.length > 0) registerPush(user); }, [user, groups.length]);

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

  // ─── Trophy unlock watcher ─────────────────────────────────────────
  // Detect new unlocked levels by polling /api/achievements whenever the
  // bets list changes (which happens on every SSE refresh) and queue an
  // animated overlay for each freshly-earned level.
  const [trophyQueue, setTrophyQueue] = useState([]);
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
  const onEggFired = useCallback((id) => {
    const meta = EGG_TROPHY_META[id];
    if (!meta) return;
    setTrophyQueue(q => {
      // Dedup — never queue the same egg twice in a row.
      if (q.some(t => t.id === id && t.level === 1)) return q;
      return [...q, { id, icon: meta.icon, level: 1, max_level: 1 }];
    });
    setTrophyBaseline(b => {
      if (!b) return b; // baseline not initialized yet — nothing to keep in sync
      const key = `${id}:1`;
      if (b.has(key)) return b;
      const next = new Set(b);
      next.add(key);
      return next;
    });
    setEggTick(n => n + 1);
  }, []);

  const notifSince = user ? { [user]: getNotifSince(user) } : {};

  const handleCreate = async data => {
    try {
      await api.createBet({ ...data, id: `b${Date.now()}`, createdAt: Date.now() });
      setShowCreate(false);
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
    catch (e) { console.error(e); toast.error(t('app.error_cancel')); }
  };

  const handleResolve = async (bet, outcome) => {
    try {
      const r = await api.resolveBet(bet.id, outcome);
      setRevealBet(null); setResolveBet(null); setOvertimeBet(null);
      if (r?.phase === 'resolved') {
        if (outcome === 'won') setWinAnim(bet.potentialWin);
        setCommentBetModal({ ...bet, status: outcome });
      }
    } catch (e) { console.error(e); }
  };

  // Consensual flow — opponent of a bet confirms (matches outcome) or disputes
  // (mismatching outcome) the proposal without going through ResolveModal.
  const handleConfirmOutcome = async (bet, outcome) => {
    try {
      const r = await api.resolveBet(bet.id, outcome);
      if (r?.phase === 'resolved') {
        // Outcome from the confirmer's POV is "creator won" — they themselves
        // win only if they're the creator. Win anim is keyed to the creator
        // payout, so trigger it only for the creator.
        if (outcome === 'won' && bet.creator === user) setWinAnim(bet.potentialWin);
        setCommentBetModal({ ...bet, status: outcome });
      }
    } catch (e) { console.error(e); }
  };

  // Either party can take back / cancel a pending proposal so a bet doesn't
  // stay locked while waiting for confirmation.
  const handleWithdrawResolve = async (bet) => {
    try { await api.withdrawResolve(bet.id); } catch (e) { console.error(e); }
  };

  // Overtime coin flip uses force=true so it bypasses the consensual gate —
  // both parties already accepted "let fate decide" by clicking through.
  const handleOvertimeResolve = async (bet, outcome) => {
    try {
      await api.resolveBet(bet.id, outcome, { force: true });
      if (outcome === 'won' && bet.creator === user) setWinAnim(bet.potentialWin);
      setOvertimeBet(null);
      setCommentBetModal({ ...bet, status: outcome });
    } catch (e) { console.error(e); }
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
    setCommentBetModal(null);
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
      if (existing && existing.emoji === emoji) {
        await api.removeReaction(betId, user);
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

  // Splash screen (runs in parallel with auth check; stays until both done)
  if (!splashDone) return <SplashScreen onDone={() => setSplashDone(true)} />;

  // Loading screen — auth still resolving after splash
  if (authLoading) return (
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',
      justifyContent:'center',background:'var(--bg)'}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:32,color:'var(--gold)'}}>₡</div>
    </div>
  );

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
          ? <ResetPasswordView token={resetParam} onDone={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete('reset');
              window.history.replaceState({}, '', url.toString());
              // Force re-render by toggling a no-op state — easiest: reload.
              window.location.reload();
            }}/>
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
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
      };

  const NAV = [
    { id: 'dashboard', e: '🏠', l: t('nav.dashboard') },
    { id: 'bets', e: '🎯', l: t('nav.bets') },
    { id: 'stats', e: '📊', l: t('nav.stats') },
    { id: 'friends', e: '👥', l: t('nav.friends') },
    { id: 'trophies', e: '🏆', l: t('nav.trophies') },
    ...(authUser?.is_admin ? [{ id: 'admin', e: '🛠️', l: 'Admin' }] : []),
    { id: 'settings', e: '⚙️', l: t('nav.settings') },
  ];

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
              fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
              fontSize:28, fontWeight:600, letterSpacing:-0.5, marginBottom:22,
              transform: 'rotate(-2deg)', transformOrigin: 'left center',
              display: 'inline-block',
            }}>
              <span className="shim">BetCouple</span>
            </div>
            <div
              onClick={() => setShowProfileEdit(true)}
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
          {/* Broken-grid nav — each item lives at its own indent + font size,
              with a couple of items shifted vertically so the column zig-zags
              instead of stepping down on a perfect ladder. */}
          <div style={{ flex: 1, padding: '12px 0 0', position: 'relative' }}>
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
              return (
                <div key={n.id} data-tour={`nav-${n.id}`} onClick={() => setView(n.id)} className="nav-item" style={{
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
                  transition: 'all .2s ease', userSelect: 'none', position: 'relative',
                }}>
                  <span style={{ fontSize: 17 }}>{n.e}</span>
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
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic', fontSize: 22, fontWeight: 600, letterSpacing: -0.5 }}>
              <span className="shim">BetCouple</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ textAlign:'right', lineHeight:1.1 }}>
                <div style={{ fontSize: 9, color:'var(--dim)', letterSpacing:1.5, textTransform:'uppercase' }}>{t('app.credits')}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{Math.round(credits[user] ?? 0)} <span
                  onClick={() => setCoinFlipOpen(true)}
                  style={{display:'inline-block'}}
                >₡</span></div>
              </div>
              <div
                onClick={() => setShowProfileEdit(true)}
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
          return (<>
            {view === 'dashboard' && <DashboardView user={user} profiles={profiles} groupMembers={groupMembers} credits={credits} bets={bets} cats={cats} onCreate={() => setShowCreate(true)} onResolve={b => setResolveBet(b)} onReveal={b => setRevealBet(b)} onCounter={b => setCounterTarget(b)} onFlame={handleFlame} notifSince={notifSince} isDesktop={isDesktop} reactions={reactions} onReaction={handleReaction} onReactionPhoto={handleReactionPhoto} onDelete={handleDelete} onEdit={b => setEditingBet(b)} onAccept={handleAccept} onReject={handleReject} can={can} onGoToVault={goToVault} onConfirmOutcome={handleConfirmOutcome} onWithdrawResolve={handleWithdrawResolve} onOvertime={b => setOvertimeBet(b)} onEggUnlock={onEggFired} onOpenDie={() => setDieRollOpen(true)} />}
            {view === 'bets'      && <BetsHubView
                tab={betsTab} setTab={setBetsTab}
                user={user} profiles={profiles} bets={bets} cats={cats} isDesktop={isDesktop}
                onResolve={b => setResolveBet(b)} onCounter={b => setCounterTarget(b)} onFlame={handleFlame}
                reactions={reactions} onReaction={handleReaction} onReactionPhoto={handleReactionPhoto}
                onDelete={handleDelete} onEdit={b => setEditingBet(b)} onAccept={handleAccept} onReject={handleReject} can={can}
                onReveal={b => setRevealBet(b)} vaultUnlocked={vaultUnlocked} onPinRequest={() => setShowPin(true)} vaultPin={vaultPin}
                onConfirmOutcome={handleConfirmOutcome} onWithdrawResolve={handleWithdrawResolve} onOvertime={b => setOvertimeBet(b)}
              />}
            {view === 'stats'     && <StatsView user={user} profiles={profiles} groupMembers={groupMembers} credits={credits} bets={bets} cats={cats} isDesktop={isDesktop} />}
            {view === 'trophies'  && <TrophiesView bets={bets} isDesktop={isDesktop} />}
            {view === 'friends'   && <FriendsView groups={groups} user={user} onSwitchToGroup={switchGroup} isDesktop={isDesktop} />}
            {view === 'admin' && authUser?.is_admin && <AdminView isDesktop={isDesktop} />}
            {view === 'settings'  && <SettingsView user={user} profiles={profiles} groupMembers={groupMembers} isDark={isDark} setIsDark={setIsDark} customCats={customCats} credits={credits} bets={bets} onUpdateProfile={handleUpdateProfile} onCreateCategory={handleCreateCategory} onDeleteCategory={handleDeleteCategory} vaultPin={vaultPin} onSetVaultPin={handleSetVaultPin} isDesktop={isDesktop} onReset={handleReset} onTestReset={handleTestReset} onLogout={handleLogout} onOpenProfileEdit={() => setShowProfileEdit(true)} isAdmin={isAdmin} can={can} />}
          </>);
        })()}
      </div>

      {/* Bottom nav: mobile only — broken alignment, every icon at a slightly
          different vertical offset so the row reads like a sawtooth instead
          of a rigid grid. Active item floats highest. */}
      {!isDesktop && (
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480,
          background: C.surf, borderTop: `1px solid ${C.brd}`,
          // 12px bottom padding plus the iOS home-indicator safe area —
          // otherwise the nav row hides behind the home bar on iPhone.
          padding: '10px 4px calc(12px + env(safe-area-inset-bottom))',
          display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end',
          zIndex: 50,
        }}>
          {NAV.map((n, idx) => {
            const isActive = view === n.id;
            // Sawtooth vertical offsets — every other item lifted differently.
            const baseLift = [0, 6, 2, 8, 4, 6, 0];
            const lift = isActive ? -8 : baseLift[idx % baseLift.length];
            return (
              <div key={n.id} data-tour={`nav-${n.id}`} onClick={() => setView(n.id)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '4px 8px', cursor: 'pointer',
                transform: `translateY(${lift}px)`,
                transition: 'transform .25s ease, color .18s',
                color: isActive ? 'var(--gold)' : 'var(--mut)',
                position: 'relative', userSelect: 'none',
              }}>
                <span style={{ fontSize: isActive ? 22 : 18, transition:'font-size .18s' }}>{n.e}</span>
                {n.id === 'friends' && pendingFriendCount > 0 && (
                  <div style={{ position: 'absolute', top: 0, right: 4, width: 6, height: 6, borderRadius: 999, background: 'var(--red)' }}/>
                )}
                {n.id === 'bets' && secretCount > 0 && (
                  <div style={{ position: 'absolute', top: 0, right: 4, width: 6, height: 6, borderRadius: 999, background: 'var(--gold)' }}/>
                )}
                <span style={{
                  fontSize: 8, letterSpacing:'.2em', textTransform:'uppercase', fontWeight: 600,
                  opacity: isActive ? 1 : .7,
                }}>{n.l}</span>
              </div>
            );
          })}
          {/* "+" CTA floats higher than every nav item so it punctures the row */}
          <div data-tour="new-bet" onClick={() => setShowCreate(true)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            cursor: 'pointer', userSelect: 'none',
            transform: 'translateY(-22px)',
          }}>
            <div style={{
              width: 50, height: 50, borderRadius: 999,
              background: 'var(--pur)', color:'#1a1530',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 300,
              boxShadow: '0 14px 30px -8px var(--pur), 0 1px 0 rgba(255,255,255,.18) inset',
              transition: 'transform .18s',
            }}>+</div>
            <span style={{ fontSize: 8, color: 'var(--gold)', letterSpacing:'.2em', textTransform:'uppercase', fontWeight: 600 }}>{t('app.new_bet_label')}</span>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate     && <CreateModal user={user} profiles={profiles} groupMembers={groupMembers} maxC={credits[user]??0} cats={cats} settings={settings} onCreate={handleCreate} onClose={() => setShowCreate(false)} onEggUnlock={onEggFired} />}
      {revealBet      && <RevealModal bet={revealBet} cats={cats} onResolve={handleResolve} onClose={() => setRevealBet(null)} />}
      {resolveBet     && <ResolveModal bet={resolveBet} cats={cats} profiles={profiles} onResolve={handleResolve} onClose={() => setResolveBet(null)} />}
      {counterTarget  && <CounterModal bet={counterTarget} user={user} profiles={profiles} credits={credits} cats={cats} onPlace={handleCounter} onClose={() => setCounterTarget(null)} />}
      {overtimeBet    && <OvertimeModal bet={overtimeBet} profiles={profiles} onResult={handleOvertimeResolve} onClose={() => setOvertimeBet(null)} />}
      {showPin        && <PinModal user={user} profiles={profiles} vaultPin={vaultPin} onSuccess={() => { setVaultUnlocked(true); setShowPin(false); }} onClose={() => setShowPin(false)} />}
      {winAnim        && <WinOverlay amount={winAnim} onDone={() => setWinAnim(null)} />}
      {commentBetModal && <CommentModal bet={commentBetModal} onSave={handleComment} onSkip={() => setCommentBetModal(null)} />}
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
      {/* Easter egg #2: coin flip overlay */}
      <CoinFlipOverlay open={coinFlipOpen} onClose={() => setCoinFlipOpen(false)} onEggUnlock={onEggFired} />

      {/* Easter egg #1: die roll overlay */}
      <DieRollOverlay open={dieRollOpen} onClose={() => setDieRollOpen(false)} onEggUnlock={onEggFired} />

      {/* Trophy unlock animation — small banner top-center, ~3s per unlock */}
      <TrophyUnlockOverlay queue={trophyQueue} onDone={consumeTrophy} />

      {/* Onboarding tour — shown once on first login per device, only after data is ready */}
      {!tourDone && !!profiles[user] && (
        <OnboardingTour
          steps={[
            { selector: '[data-tour="group-picker"]', title: t('onboarding.step1_title'),
              body: t('onboarding.step1_body'), place: 'bottom' },
            { selector: '[data-tour="new-bet"]',     title: t('onboarding.step2_title'),
              body: t('onboarding.step2_body'), place: 'top' },
            { selector: '[data-tour="nav-bets"]',    title: t('onboarding.step3_title'),
              body: t('onboarding.step3_body'), place: isDesktop ? 'bottom' : 'top' },
            { selector: '[data-tour="nav-friends"]', title: t('onboarding.step4_title'),
              body: t('onboarding.step4_body'), place: isDesktop ? 'bottom' : 'top' },
            { selector: '[data-tour="nav-stats"]',   title: t('onboarding.step5_title'),
              body: t('onboarding.step5_body'), place: isDesktop ? 'bottom' : 'top' },
          ]}
          onDone={() => { localStorage.setItem('bc_onboarding_done', '1'); setTourDone(true); }}
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
    </div>
  );
}
