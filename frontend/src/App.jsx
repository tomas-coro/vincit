import React, { useState, useCallback, useEffect } from 'react';
import { useSync } from './useSync.js';
import * as api from './api.js';

import { DARK, LIGHT, rootVars, DEF_CATS, COLORS } from './components/Atoms.jsx';
import { useLang } from './i18n.js';
import WinOverlay from './components/WinOverlay.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import OnboardingTour from './components/OnboardingTour.jsx';
import TrophyUnlockOverlay from './components/TrophyUnlockOverlay.jsx';
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
async function registerPush(user) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const { publicKey } = await fetch('/api/push/vapid-key').then(r => r.json());
    if (!publicKey) return;
    if (Notification.permission === 'denied') return;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:urlB64ToUint8(publicKey) });
    // token already set in localStorage at this point
    const token = localStorage.getItem('bc_token');
    await fetch('/api/push/subscribe', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body:JSON.stringify({user, subscription:sub.toJSON()}) });
  } catch(e) { console.warn('Push registration failed:', e); }
}

const CSS_BASE = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Syne:wght@400;500;600;700;800&display=swap');
@keyframes sUp{from{transform:translateY(18px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes fIn{from{opacity:0}to{opacity:1}}
@keyframes bIn{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.1)}80%{transform:scale(.95)}100%{transform:scale(1);opacity:1}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes pGold{0%,100%{box-shadow:0 0 0 0 var(--glow)}50%{box-shadow:0 0 22px 4px var(--glow)}}
@keyframes spinC{0%{transform:rotateY(0deg)}100%{transform:rotateY(1800deg)}}
@keyframes confA{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(90px) rotate(720deg);opacity:0}}
@keyframes confB{0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:1}100%{transform:translate(var(--ex),var(--ey)) rotate(var(--rot,720deg)) scale(.4);opacity:0}}
.bc *{box-sizing:border-box;margin:0;padding:0}
.bc{font-family:'Syne',sans-serif;transition:background .25s,color .25s}
.sUp{animation:sUp .3s ease both}
.fIn{animation:fIn .25s ease both}
.bIn{animation:bIn .45s cubic-bezier(.34,1.56,.64,1) both}
.pGold{animation:pGold 3s ease-in-out infinite}
.shim{background:linear-gradient(90deg,var(--gold) 0%,var(--goldL) 50%,var(--gold) 100%);background-size:200% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 2.5s linear infinite}
.spinC{animation:spinC 1.4s ease-in-out forwards}

.bc input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:5px;border-radius:3px;background:var(--mut);outline:none;cursor:pointer}
.bc input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:var(--gold);cursor:pointer;box-shadow:0 0 8px var(--glow)}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:var(--mut);border-radius:2px}
.bc{letter-spacing:-0.005em;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;position:relative;isolation:isolate}
.bc::before{
  content:'';
  position:fixed; inset:0; z-index:-1;
  background:
    radial-gradient(60vmax 40vmax at 12% 18%,  rgba(200,151,63,.10) 0%, transparent 55%),
    radial-gradient(70vmax 50vmax at 88% 82%,  rgba(91,138,240,.07) 0%, transparent 60%),
    radial-gradient(40vmax 30vmax at 50% 95%,  rgba(160,126,245,.06) 0%, transparent 60%);
  filter: blur(4px);
  animation: ambientDrift 38s ease-in-out infinite;
  pointer-events:none;
}
@keyframes ambientDrift {
  0%, 100% { transform: translate(0,0) scale(1);   opacity:1; }
  50%      { transform: translate(2%, -1%) scale(1.06); opacity:.85; }
}
.bc h1,.bc h2{letter-spacing:-0.02em}

/* Focus ring (keyboard nav) */
.bc button:focus-visible,
.bc input:focus-visible,
.bc textarea:focus-visible,
.bc select:focus-visible{
  outline:2px solid var(--gold);
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
  .bc .nav-item:hover{background:var(--gold)0d !important;}
  .bc input:hover,.bc textarea:hover,.bc select:hover{border-color:var(--gold)55 !important;}
}
`;

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
        setTrophyQueue(q => [...q, ...fresh]);
      }
      setTrophyBaseline(cur);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [bets.length, user]);

  const consumeTrophy = () => setTrophyQueue(q => q.slice(1));

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
      await api.resolveBet(bet.id, outcome);
      if (outcome === 'won') setWinAnim(bet.potentialWin);
      setRevealBet(null); setResolveBet(null); setOvertimeBet(null);
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
  const rootStyle = isDesktop
    ? { ...rootVars(C), minHeight: '100vh', position: 'relative' }
    : { ...rootVars(C), maxWidth: 480, margin: '0 auto', paddingBottom: 90, position: 'relative' };

  const NAV = [
    { id: 'dashboard', e: '🏠', l: t('nav.dashboard') },
    { id: 'bets', e: '🎯', l: t('nav.bets') },
    { id: 'stats', e: '📊', l: t('nav.stats') },
    { id: 'friends', e: '👥', l: t('nav.friends') },
    { id: 'trophies', e: '🏆', l: t('nav.trophies') },
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

      {/* Sidebar: desktop only */}
      {isDesktop && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: 240, height: '100vh', background: 'var(--surf)', borderRight: '1px solid var(--brd)', display: 'flex', flexDirection: 'column', zIndex: 50, padding: '24px 0' }}>
          <div style={{ padding: '0 20px 16px', borderBottom: '1px solid var(--brd)', marginBottom: 8 }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:900, letterSpacing:-0.5, marginBottom:14 }}>
              <span className="shim">BetCouple</span>
            </div>
            <div
              onClick={() => setShowProfileEdit(true)}
              title={t('profile.edit_title')}
              style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', borderRadius:10, padding:4, margin:-4, transition:'background .15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold)10'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${COLORS[myProfile.colorKey] || '#5b8af0'}33`, border: `2px solid ${COLORS[myProfile.colorKey] || '#5b8af0'}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink:0, overflow:'hidden' }}>
                {myProfile.avatarUrl
                  ? <img src={myProfile.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : myProfile.avatar}
              </div>
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', lineHeight:1.1 }}>{myProfile.name}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginTop:2 }}>{Math.round(credits[user] ?? 0)} ₡</div>
              </div>
            </div>
          </div>
          {groups.length > 0 && (
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--brd)', marginBottom:4 }}>
              {groupPickerEl}
            </div>
          )}
          <div style={{ flex: 1, padding: '4px 12px' }}>
            {NAV.map(n => (
              <div key={n.id} data-tour={`nav-${n.id}`} onClick={() => setView(n.id)} className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: view === n.id ? 'var(--gold)' : 'var(--dim)', background: view === n.id ? 'var(--gold)11' : 'transparent', marginBottom: 4, transition: 'all .18s', userSelect: 'none', position: 'relative' }}>
                <span style={{ fontSize: 18 }}>{n.e}</span>
                {n.l}
                {n.id === 'bets' && secretCount > 0 && (
                  <div title="Vault" style={{ position: 'absolute', right: 10, width: 16, height: 16, borderRadius: '50%', background: 'var(--gold)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#07060f' }}>🔒</div>
                )}
                {n.id === 'friends' && pendingFriendCount > 0 && (
                  <div style={{ position: 'absolute', right: 10, minWidth: 16, height: 16, padding: '0 5px', borderRadius: 8, background: 'var(--gold)', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#07060f' }}>{pendingFriendCount}</div>
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 16px 0' }}>
            <button data-tour="new-bet" onClick={() => setShowCreate(true)} style={{ width: '100%', padding: '11px 0', borderRadius: 12, border: 'none', background: 'var(--gold)', color: '#07060f', fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px var(--glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{t('app.new_bet')}</button>
          </div>
        </div>
      )}

      {/* Header: mobile only */}
      {!isDesktop && (
        <div style={{ position: 'sticky', top: 0, background: C.bg, zIndex: 10, borderBottom: `1px solid ${C.brd}22` }}>
          <div style={{ padding: '14px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap:10 }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize: 16, fontWeight: 900, letterSpacing: -0.5 }}>
              <span className="shim">BetCouple</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ textAlign:'right', lineHeight:1.1 }}>
                <div style={{ fontSize: 9, color:'var(--dim)', letterSpacing:1.5, textTransform:'uppercase' }}>{t('app.credits')}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{Math.round(credits[user] ?? 0)} ₡</div>
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

      {/* Content */}
      <div style={isDesktop ? { marginLeft: 240, maxWidth: 1320, padding: '32px 48px' } : { padding: '14px 20px' }}>
        {(() => {
          const dataReady = !!profiles[user];
          if (!dataReady) {
            if (view === 'dashboard') return <SkeletonDashboard />;
            if (view === 'bets')      return <SkeletonList count={4} withGoldStripe={betsTab==='vault'} />;
            if (view === 'stats' || view === 'trophies') return <SkeletonList count={3} />;
            return null;
          }
          return (<>
            {view === 'dashboard' && <DashboardView user={user} profiles={profiles} groupMembers={groupMembers} credits={credits} bets={bets} cats={cats} onCreate={() => setShowCreate(true)} onResolve={b => setResolveBet(b)} onReveal={b => setRevealBet(b)} onCounter={b => setCounterTarget(b)} onFlame={handleFlame} notifSince={notifSince} isDesktop={isDesktop} reactions={reactions} onReaction={handleReaction} onReactionPhoto={handleReactionPhoto} onDelete={handleDelete} onEdit={b => setEditingBet(b)} onAccept={handleAccept} onReject={handleReject} can={can} onGoToVault={goToVault} />}
            {view === 'bets'      && <BetsHubView
                tab={betsTab} setTab={setBetsTab}
                user={user} profiles={profiles} bets={bets} cats={cats} isDesktop={isDesktop}
                onResolve={b => setResolveBet(b)} onCounter={b => setCounterTarget(b)} onFlame={handleFlame}
                reactions={reactions} onReaction={handleReaction} onReactionPhoto={handleReactionPhoto}
                onDelete={handleDelete} onEdit={b => setEditingBet(b)} onAccept={handleAccept} onReject={handleReject} can={can}
                onReveal={b => setRevealBet(b)} vaultUnlocked={vaultUnlocked} onPinRequest={() => setShowPin(true)} vaultPin={vaultPin}
              />}
            {view === 'stats'     && <StatsView user={user} profiles={profiles} groupMembers={groupMembers} credits={credits} bets={bets} cats={cats} isDesktop={isDesktop} />}
            {view === 'trophies'  && <TrophiesView bets={bets} isDesktop={isDesktop} />}
            {view === 'friends'   && <FriendsView groups={groups} user={user} onSwitchToGroup={switchGroup} isDesktop={isDesktop} />}
            {view === 'settings'  && <SettingsView user={user} profiles={profiles} groupMembers={groupMembers} isDark={isDark} setIsDark={setIsDark} customCats={customCats} credits={credits} bets={bets} onUpdateProfile={handleUpdateProfile} onCreateCategory={handleCreateCategory} onDeleteCategory={handleDeleteCategory} vaultPin={vaultPin} onSetVaultPin={handleSetVaultPin} isDesktop={isDesktop} onReset={handleReset} onTestReset={handleTestReset} onLogout={handleLogout} onOpenProfileEdit={() => setShowProfileEdit(true)} isAdmin={isAdmin} can={can} />}
          </>);
        })()}
      </div>

      {/* Bottom nav: mobile only */}
      {!isDesktop && (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: C.surf, borderTop: `1px solid ${C.brd}`, padding: '8px 2px 10px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 50 }}>
          {NAV.map(n => (
            <div key={n.id} data-tour={`nav-${n.id}`} onClick={() => setView(n.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 10px', cursor: 'pointer', borderRadius: 12, fontSize: 10, color: view === n.id ? 'var(--gold)' : 'var(--mut)', transition: 'all .18s', position: 'relative', userSelect: 'none' }}>
              <span style={{ fontSize: 20 }}>{n.e}</span>
              {n.id === 'friends' && pendingFriendCount > 0 && (
                <div style={{ position: 'absolute', top: 2, right: 6, minWidth: 14, height: 14, padding: '0 4px', borderRadius: 7, background: 'var(--gold)', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#07060f' }}>{pendingFriendCount}</div>
              )}
              {n.id === 'bets' && secretCount > 0 && (
                <div style={{ position: 'absolute', top: 2, right: 6, width: 14, height: 14, borderRadius: '50%', background: 'var(--gold)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#07060f' }}>🔒</div>
              )}
              {n.l}
            </div>
          ))}
          <div data-tour="new-bet" onClick={() => setShowCreate(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', userSelect: 'none' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: `0 4px 16px var(--glow)`, transition: 'all .18s' }}>+</div>
            <span style={{ fontSize: 10, color: 'var(--gold)' }}>{t('app.new_bet_label')}</span>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate     && <CreateModal user={user} profiles={profiles} groupMembers={groupMembers} maxC={credits[user]??0} cats={cats} settings={settings} onCreate={handleCreate} onClose={() => setShowCreate(false)} />}
      {revealBet      && <RevealModal bet={revealBet} cats={cats} onResolve={handleResolve} onClose={() => setRevealBet(null)} />}
      {resolveBet     && <ResolveModal bet={resolveBet} cats={cats} profiles={profiles} onResolve={handleResolve} onOvertime={b => { setResolveBet(null); setOvertimeBet(b); }} onClose={() => setResolveBet(null)} />}
      {counterTarget  && <CounterModal bet={counterTarget} user={user} profiles={profiles} credits={credits} cats={cats} onPlace={handleCounter} onClose={() => setCounterTarget(null)} />}
      {overtimeBet    && <OvertimeModal bet={overtimeBet} profiles={profiles} onResult={handleResolve} onClose={() => setOvertimeBet(null)} />}
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
