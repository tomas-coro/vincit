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
import PairingView from './components/views/PairingView.jsx';
import DashboardView from './components/views/DashboardView.jsx';
import BetsView from './components/views/BetsView.jsx';
import VaultView from './components/views/VaultView.jsx';
import StatsView from './components/views/StatsView.jsx';
import TrophiesView from './components/views/TrophiesView.jsx';
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
.bc{letter-spacing:-0.005em;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
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

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const C = isDark ? DARK : LIGHT;
  const isDesktop = useBreakpoint(768);
  const { t } = useLang();
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
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
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

  useEffect(() => { if (user && groups.length > 0) registerPush(user); }, [user, groups.length]);

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

  const handleAccept = async id => {
    try { await api.acceptBet(id); refresh(); toast.success(t('app.ok_accepted')); }
    catch(e) { console.error(e); toast.error(t('app.error_accept')); }
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

  // Auth gate
  if (!token || !authUser) return (
    <div className="bc" style={rootVars(C)}>
      <style>{CSS_BASE}</style>
      <AuthView onAuth={handleAuth} />
    </div>
  );

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
    { id: 'vault', e: '🔒', l: t('nav.vault') },
    { id: 'stats', e: '📊', l: t('nav.stats') },
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

  const groupSwitcher = groups.length > 0 && (
    <div style={{ display:'flex', gap:6, overflowX:'auto', padding:'8px 0', scrollbarWidth:'none' }}>
      {groups.map(g => (
        <div key={g.id} style={{
          display:'flex', alignItems:'center', flexShrink:0,
          borderRadius:20, overflow:'hidden',
          border:`1px solid ${activeGroupId===g.id?'var(--gold)':'var(--brd)'}`,
          background: activeGroupId===g.id ? 'var(--gold)22' : 'transparent',
          transition:'all .18s',
        }}>
          <button onClick={() => switchGroup(g.id)} style={{
            padding:'5px 10px 5px 12px', border:'none', background:'transparent',
            color: activeGroupId===g.id?'var(--gold)':'var(--dim)',
            fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:600, cursor:'pointer',
            whiteSpace:'nowrap',
          }}>
            {g.emoji} {g.name}
            {parseInt(g.member_count) > 1 && <span style={{ marginLeft:5, opacity:.5, fontSize:10 }}>{g.member_count}</span>}
          </button>
          {activeGroupId === g.id && (
            <button onClick={() => setShowGroupInfo(true)} style={{
              padding:'5px 10px 5px 4px', border:'none', background:'transparent',
              color:'var(--gold)', fontSize:12, cursor:'pointer', opacity:.65,
            }}>👥</button>
          )}
        </div>
      ))}
      <button onClick={() => setShowGroupModal(true)}
        style={{ display:'inline-flex', alignItems:'center', padding:'5px 10px', borderRadius:20, border:'1px solid var(--brd)', background:'transparent', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:600, color:'var(--dim)', whiteSpace:'nowrap', flexShrink:0, transition:'all .18s' }}>
        {t('app.new_group')}
      </button>
    </div>
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
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${COLORS[myProfile.colorKey] || '#5b8af0'}33`, border: `2px solid ${COLORS[myProfile.colorKey] || '#5b8af0'}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink:0, overflow:'hidden' }}>
                {myProfile.avatarUrl
                  ? <img src={myProfile.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : myProfile.avatar}
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase' }}>{t('app.welcome_back')}</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{myProfile.name}</div>
              </div>
            </div>
            <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase' }}>{t('app.credits')}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gold)' }}>{Math.round(credits[user] ?? 0)} ₡</div>
          </div>
          {groups.length > 0 && (
            <div style={{ padding:'8px 12px', borderBottom:'1px solid var(--brd)', marginBottom:4 }}>
              {groupSwitcher}
            </div>
          )}
          <div style={{ flex: 1, padding: '4px 12px' }}>
            {NAV.map(n => (
              <div key={n.id} data-tour={`nav-${n.id}`} onClick={() => setView(n.id)} className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: view === n.id ? 'var(--gold)' : 'var(--dim)', background: view === n.id ? 'var(--gold)11' : 'transparent', marginBottom: 4, transition: 'all .18s', userSelect: 'none', position: 'relative' }}>
                <span style={{ fontSize: 18 }}>{n.e}</span>
                {n.l}
                {n.id === 'vault' && secretCount > 0 && (
                  <div style={{ position: 'absolute', right: 10, width: 16, height: 16, borderRadius: '50%', background: 'var(--gold)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{secretCount}</div>
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
          <div style={{ padding: '18px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${COLORS[myProfile.colorKey] || '#5b8af0'}33`, border: `2px solid ${COLORS[myProfile.colorKey] || '#5b8af0'}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 * 0.42, flexShrink: 0, overflow:'hidden' }}>
                {myProfile.avatarUrl
                  ? <img src={myProfile.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : myProfile.avatar}
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase' }}>{t('app.welcome_back')}</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700 }}>{myProfile.name}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--dim)' }}>{t('app.credits')}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gold)' }}>{Math.round(credits[user] ?? 0)} ₡</div>
              </div>
            </div>
          </div>
          {groups.length > 1 && (
            <div style={{ padding:'0 20px 6px' }}>{groupSwitcher}</div>
          )}
        </div>
      )}

      {/* Content */}
      <div style={isDesktop ? { marginLeft: 240, maxWidth: 1080, padding: '40px 56px' } : { padding: '14px 20px' }}>
        {(() => {
          const dataReady = !!profiles[user];
          if (!dataReady) {
            if (view === 'dashboard') return <SkeletonDashboard />;
            if (view === 'bets' || view === 'vault') return <SkeletonList count={4} withGoldStripe={view==='vault'} />;
            if (view === 'stats' || view === 'trophies') return <SkeletonList count={3} />;
            return null;
          }
          return (<>
            {view === 'dashboard' && <DashboardView user={user} profiles={profiles} groupMembers={groupMembers} credits={credits} bets={bets} cats={cats} onCreate={() => setShowCreate(true)} onResolve={b => setResolveBet(b)} onReveal={b => setRevealBet(b)} onCounter={b => setCounterTarget(b)} onFlame={handleFlame} notifSince={notifSince} isDesktop={isDesktop} reactions={reactions} onReaction={handleReaction} onReactionPhoto={handleReactionPhoto} onDelete={handleDelete} onEdit={b => setEditingBet(b)} onAccept={handleAccept} onReject={handleReject} can={can} />}
            {view === 'bets'      && <BetsView user={user} profiles={profiles} bets={bets} cats={cats} onResolve={b => setResolveBet(b)} onCounter={b => setCounterTarget(b)} onFlame={handleFlame} isDesktop={isDesktop} reactions={reactions} onReaction={handleReaction} onReactionPhoto={handleReactionPhoto} onDelete={handleDelete} onEdit={b => setEditingBet(b)} onAccept={handleAccept} onReject={handleReject} can={can} />}
            {view === 'vault'     && <VaultView user={user} profiles={profiles} bets={bets} cats={cats} onReveal={b => setRevealBet(b)} onFlame={handleFlame} unlocked={vaultUnlocked} onPinRequest={() => setShowPin(true)} vaultPin={vaultPin} isDesktop={isDesktop} onDelete={handleDelete} onEdit={b => setEditingBet(b)} />}
            {view === 'stats'     && <StatsView user={user} profiles={profiles} groupMembers={groupMembers} credits={credits} bets={bets} cats={cats} isDesktop={isDesktop} />}
            {view === 'trophies'  && <TrophiesView bets={bets} isDesktop={isDesktop} />}
            {view === 'settings'  && <SettingsView user={user} profiles={profiles} isDark={isDark} setIsDark={setIsDark} customCats={customCats} credits={credits} bets={bets} onUpdateProfile={handleUpdateProfile} onCreateCategory={handleCreateCategory} onDeleteCategory={handleDeleteCategory} vaultPin={vaultPin} onSetVaultPin={handleSetVaultPin} isDesktop={isDesktop} onReset={handleReset} onTestReset={handleTestReset} onLogout={handleLogout} onProfileUpdate={u => setAuthUser(prev => ({...prev,...u}))} isAdmin={isAdmin} can={can} />}
          </>);
        })()}
      </div>

      {/* Bottom nav: mobile only */}
      {!isDesktop && (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: C.surf, borderTop: `1px solid ${C.brd}`, padding: '8px 2px 10px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 50 }}>
          {NAV.map(n => (
            <div key={n.id} data-tour={`nav-${n.id}`} onClick={() => setView(n.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 10px', cursor: 'pointer', borderRadius: 12, fontSize: 10, color: view === n.id ? 'var(--gold)' : 'var(--mut)', transition: 'all .18s', position: 'relative', userSelect: 'none' }}>
              <span style={{ fontSize: 20 }}>{n.e}</span>
              {n.id === 'vault' && secretCount > 0 && (
                <div style={{ position: 'absolute', top: 2, right: 6, width: 14, height: 14, borderRadius: '50%', background: 'var(--gold)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{secretCount}</div>
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
      {showGroupModal && <CreateGroupModal onCreated={handleGroupCreated} onClose={() => setShowGroupModal(false)} />}
      {/* Trophy unlock animation — small banner top-center, ~3s per unlock */}
      <TrophyUnlockOverlay queue={trophyQueue} onDone={consumeTrophy} />

      {/* Onboarding tour — shown once on first login per device, only after data is ready */}
      {!tourDone && !!profiles[user] && (
        <OnboardingTour
          steps={[
            { selector: '[data-tour="new-bet"]', title: t('onboarding.step1_title'),
              body: t('onboarding.step1_body'), place: isDesktop ? 'top' : 'top' },
            { selector: '[data-tour="nav-vault"]', title: t('onboarding.step2_title'),
              body: t('onboarding.step2_body'), place: isDesktop ? 'bottom' : 'top' },
            { selector: '[data-tour="nav-stats"]', title: t('onboarding.step3_title'),
              body: t('onboarding.step3_body'), place: isDesktop ? 'bottom' : 'top' },
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
