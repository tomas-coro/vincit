import React, { useState, useCallback, useEffect } from 'react';
import { useSync } from './useSync.js';
import * as api from './api.js';

import { DARK, LIGHT, rootVars, DEF_CATS, COLORS } from './components/Atoms.jsx';
import WinOverlay from './components/WinOverlay.jsx';
import WelcomeScreen from './components/views/WelcomeScreen.jsx';
import DashboardView from './components/views/DashboardView.jsx';
import BetsView from './components/views/BetsView.jsx';
import VaultView from './components/views/VaultView.jsx';
import StatsView from './components/views/StatsView.jsx';
import SettingsView from './components/views/SettingsView.jsx';
import CreateModal from './components/modals/CreateModal.jsx';
import RevealModal from './components/modals/RevealModal.jsx';
import { ResolveModal, OvertimeModal } from './components/modals/ResolveModal.jsx';
import CounterModal from './components/modals/CounterModal.jsx';
import PinModal from './components/modals/PinModal.jsx';
import PinLoginModal from './components/modals/PinLoginModal.jsx';
import CommentModal from './components/modals/CommentModal.jsx';

const CSS_BASE = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Syne:wght@400;500;600;700&display=swap');
@keyframes sUp{from{transform:translateY(18px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes fIn{from{opacity:0}to{opacity:1}}
@keyframes bIn{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.1)}80%{transform:scale(.95)}100%{transform:scale(1);opacity:1}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes pGold{0%,100%{box-shadow:0 0 0 0 var(--glow)}50%{box-shadow:0 0 22px 4px var(--glow)}}
@keyframes spinC{0%{transform:rotateY(0deg)}100%{transform:rotateY(1800deg)}}
@keyframes confA{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(90px) rotate(720deg);opacity:0}}
.bc *{box-sizing:border-box;margin:0;padding:0}
.bc{font-family:'Syne',sans-serif;transition:background .25s,color .25s}
.sUp{animation:sUp .3s ease both}
.fIn{animation:fIn .25s ease both}
.bIn{animation:bIn .45s cubic-bezier(.34,1.56,.64,1) both}
.pGold{animation:pGold 3s ease-in-out infinite}
.shim{background:linear-gradient(90deg,var(--gold) 0%,var(--goldL) 50%,var(--gold) 100%);background-size:200% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 2.5s linear infinite}
.spinC{animation:spinC 1.4s ease-in-out forwards}
.confp{position:absolute;border-radius:2px;animation:confA 1.2s ease-out forwards}
.bc input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:5px;border-radius:3px;background:var(--mut);outline:none;cursor:pointer}
.bc input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:var(--gold);cursor:pointer;box-shadow:0 0 8px var(--glow)}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:var(--mut);border-radius:2px}
`;

// localStorage helpers — vault PIN and notification timestamps stay client-only
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

  // Server state: profiles, credits, bets, categories (custom only)
  const [profiles, setProfiles] = useState({
    tomas: { name: 'Tomas', avatar: '🃏', colorKey: 'blue' },
    giulia: { name: 'Giulia', avatar: '♥️', colorKey: 'purple' },
  });
  const [credits, setCredits]     = useState({ tomas: 100, giulia: 100 });
  const [bets, setBets]           = useState([]);
  const [customCats, setCustomCats] = useState([]);
  const [pinProtected, setPinProtected] = useState({ tomas: false, giulia: false });
  const [reactions, setReactions] = useState([]);

  // useSync merges server response fields into the right state slices
  const refresh = useSync(useCallback(data => {
    if (data.profiles)   setProfiles(data.profiles);
    if (data.credits)    setCredits(data.credits);
    if (data.bets)       setBets(data.bets);
    if (data.categories) setCustomCats(data.categories);
    if (data.pinProtected) setPinProtected(data.pinProtected);
    if (data.reactions)    setReactions(data.reactions);
  }, []));

  // categories: server returns { id, e, label, color } — DEF_CATS have same shape
  const cats = [...DEF_CATS, ...customCats];

  // User selection persisted in localStorage
  const [user, setUser] = useState(() => lsGet('bc_user', null));
  const [view, setView] = useState('dashboard');
  const [vaultUnlocked, setVaultUnlocked] = useState(false);

  // Re-render trigger for vault PIN changes (localStorage doesn't trigger re-renders)
  const [pinVersion, setPinVersion] = useState(0);
  const vaultPin = user ? getVaultPin(user) : null;

  const [showCreate, setShowCreate]     = useState(false);
  const [revealBet, setRevealBet]       = useState(null);
  const [resolveBet, setResolveBet]     = useState(null);
  const [counterTarget, setCounterTarget] = useState(null);
  const [overtimeBet, setOvertimeBet]   = useState(null);
  const [showPin, setShowPin]           = useState(false);
  const [winAnim, setWinAnim]           = useState(null);
  const [pendingPinUser, setPendingPinUser] = useState(null);
  const [commentBetModal, setCommentBetModal] = useState(null);

  const login = u => {
    const prev = getLastSeen(u);
    setNotifSince(u, prev);
    setLastSeen(u, Date.now());
    lsSet('bc_user', u);
    setUser(u);
    setView('dashboard');
    setVaultUnlocked(false);
  };

  const notifSince = user
    ? { [user]: getNotifSince(user), [user === 'tomas' ? 'giulia' : 'tomas']: getNotifSince(user === 'tomas' ? 'giulia' : 'tomas') }
    : { tomas: 0, giulia: 0 };

  const handleCreate = async data => {
    try {
      await api.createBet({ ...data, id: `b${Date.now()}`, creator: user, createdAt: Date.now() });
      setShowCreate(false);
    } catch (e) { console.error(e); }
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

  const handleReaction = async (betId, emoji) => {
    try {
      const existing = reactions.find(r => r.bet_id === betId && r.bettor === user);
      if (existing && existing.emoji === emoji) {
        await api.removeReaction(betId, user);
      } else {
        await api.addReaction(betId, user, emoji);
      }
    } catch (e) { console.error(e); }
  };

  const handleUpdateProfile = async (userId, data) => {
    try { await api.updateProfile(userId, data); } catch (e) { console.error(e); }
  };

  const handleResetCredits = async amounts => {
    try { await api.resetCredits(amounts); } catch (e) { console.error(e); }
  };

  const handleCreateCategory = async cat => {
    try { await api.createCategory(cat); } catch (e) { console.error(e); }
  };

  const handleDeleteCategory = async id => {
    try { await api.deleteCategory(id); } catch (e) { console.error(e); }
  };

  // Vault PIN stays in localStorage only — never sent to server
  const handleSetVaultPin = pin => {
    setVaultPin(user, pin);
    setPinVersion(v => v + 1); // trigger re-render so vaultPin reflects new value
  };

  const secretCount = bets.filter(b => b.creator === user && b.isSecret && b.status === 'active').length;
  const rootStyle = isDesktop
    ? { ...rootVars(C), minHeight: '100vh', position: 'relative' }
    : { ...rootVars(C), maxWidth: 480, margin: '0 auto', paddingBottom: 90, position: 'relative' };

  if (!user || !profiles[user]) {
    return (
      <div className="bc" style={rootVars(C)}>
        <style>{CSS_BASE}</style>
        <WelcomeScreen
          profiles={profiles}
          pinProtected={pinProtected}
          onSelect={k => {
            if (pinProtected[k]) {
              setPendingPinUser(k);
            } else {
              login(k);
            }
          }}
        />
        {pendingPinUser && (
          <PinLoginModal
            user={pendingPinUser}
            profile={profiles[pendingPinUser]}
            onSuccess={() => { login(pendingPinUser); setPendingPinUser(null); }}
            onClose={() => setPendingPinUser(null)}
          />
        )}
      </div>
    );
  }

  const NAV = [
    { id: 'dashboard', e: '🏠', l: 'Home' },
    { id: 'bets', e: '🎯', l: 'Bets' },
    { id: 'vault', e: '🔒', l: 'Vault' },
    { id: 'stats', e: '📊', l: 'Stats' },
    { id: 'settings', e: '⚙️', l: 'Config' },
  ];

  return (
    <div className="bc" style={rootStyle}>
      <style>{CSS_BASE}</style>

      {/* Sidebar: desktop only */}
      {isDesktop && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: 220, height: '100vh', background: 'var(--surf)', borderRight: '1px solid var(--brd)', display: 'flex', flexDirection: 'column', zIndex: 50, padding: '24px 0' }}>
          <div style={{ padding: '0 20px 16px', borderBottom: '1px solid var(--brd)', marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${COLORS[profiles[user].colorKey] || '#5b8af0'}33`, border: `2px solid ${COLORS[profiles[user].colorKey] || '#5b8af0'}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 10 }}>{profiles[user].avatar}</div>
            <div style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase' }}>Bentornato</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{profiles[user].name}</div>
            <div style={{ fontSize: 10, color: 'var(--dim)' }}>Crediti</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gold)', marginBottom: 10 }}>{Math.round(credits[user])} ₡</div>
            <button style={{ width: '100%', padding: '6px 0', borderRadius: 8, border: '1px solid var(--brd)', cursor: 'pointer', fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 600, background: 'transparent', color: 'var(--dim)' }} onClick={() => { lsDel('bc_user'); setUser(null); setVaultUnlocked(false); }}>Switch</button>
          </div>
          <div style={{ flex: 1, padding: '4px 12px' }}>
            {NAV.map(n => (
              <div key={n.id} onClick={() => setView(n.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: view === n.id ? 'var(--gold)' : 'var(--dim)', background: view === n.id ? 'var(--gold)11' : 'transparent', marginBottom: 4, transition: 'all .18s', userSelect: 'none', position: 'relative' }}>
                <span style={{ fontSize: 18 }}>{n.e}</span>
                {n.l}
                {n.id === 'vault' && secretCount > 0 && (
                  <div style={{ position: 'absolute', right: 10, width: 16, height: 16, borderRadius: '50%', background: 'var(--gold)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{secretCount}</div>
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 16px 0' }}>
            <button onClick={() => setShowCreate(true)} style={{ width: '100%', padding: '11px 0', borderRadius: 12, border: 'none', background: 'var(--gold)', color: '#07060f', fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px var(--glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>+ Nuova Bet</button>
          </div>
        </div>
      )}

      {/* Header: mobile only */}
      {!isDesktop && (
        <div style={{ padding: '18px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: C.bg, zIndex: 10, borderBottom: `1px solid ${C.brd}22` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${COLORS[profiles[user].colorKey] || '#5b8af0'}33`, border: `2px solid ${COLORS[profiles[user].colorKey] || '#5b8af0'}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 * 0.42, flexShrink: 0 }}>{profiles[user].avatar}</div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase' }}>Bentornato</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700 }}>{profiles[user].name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--dim)' }}>Crediti</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gold)' }}>{Math.round(credits[user])} ₡</div>
            </div>
            <button style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 13px', borderRadius: 10, border: '1px solid var(--brd)', cursor: 'pointer', fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 600, background: 'transparent', color: 'var(--dim)' }} onClick={() => { lsDel('bc_user'); setUser(null); setVaultUnlocked(false); }}>Switch</button>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={isDesktop ? { marginLeft: 220, maxWidth: 900, padding: '32px 40px' } : { padding: '14px 20px' }}>
        {view === 'dashboard' && <DashboardView user={user} profiles={profiles} credits={credits} bets={bets} cats={cats} onCreate={() => setShowCreate(true)} onResolve={b => setResolveBet(b)} onReveal={b => setRevealBet(b)} onCounter={b => setCounterTarget(b)} onFlame={handleFlame} notifSince={notifSince} isDesktop={isDesktop} reactions={reactions} onReaction={handleReaction} />}
        {view === 'bets'      && <BetsView user={user} profiles={profiles} bets={bets} cats={cats} onResolve={b => setResolveBet(b)} onCounter={b => setCounterTarget(b)} onFlame={handleFlame} isDesktop={isDesktop} reactions={reactions} onReaction={handleReaction} />}
        {view === 'vault'     && <VaultView user={user} profiles={profiles} bets={bets} cats={cats} onReveal={b => setRevealBet(b)} onFlame={handleFlame} unlocked={vaultUnlocked} onPinRequest={() => setShowPin(true)} vaultPin={vaultPin} isDesktop={isDesktop} />}
        {view === 'stats'     && <StatsView user={user} profiles={profiles} credits={credits} bets={bets} cats={cats} isDesktop={isDesktop} />}
        {view === 'settings'  && <SettingsView user={user} profiles={profiles} isDark={isDark} setIsDark={setIsDark} customCats={customCats} credits={credits} onUpdateProfile={handleUpdateProfile} onResetCredits={handleResetCredits} onCreateCategory={handleCreateCategory} onDeleteCategory={handleDeleteCategory} vaultPin={vaultPin} onSetVaultPin={handleSetVaultPin} pinProtected={pinProtected} isDesktop={isDesktop} />}
      </div>

      {/* Bottom nav: mobile only */}
      {!isDesktop && (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: C.surf, borderTop: `1px solid ${C.brd}`, padding: '8px 2px 10px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 50 }}>
          {NAV.map(n => (
            <div key={n.id} onClick={() => setView(n.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 10px', cursor: 'pointer', borderRadius: 12, fontSize: 10, color: view === n.id ? 'var(--gold)' : 'var(--mut)', transition: 'all .18s', position: 'relative', userSelect: 'none' }}>
              <span style={{ fontSize: 20 }}>{n.e}</span>
              {n.id === 'vault' && secretCount > 0 && (
                <div style={{ position: 'absolute', top: 2, right: 6, width: 14, height: 14, borderRadius: '50%', background: 'var(--gold)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{secretCount}</div>
              )}
              {n.l}
            </div>
          ))}
          <div onClick={() => setShowCreate(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', userSelect: 'none' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: `0 4px 16px var(--glow)`, transition: 'all .18s' }}>+</div>
            <span style={{ fontSize: 10, color: 'var(--gold)' }}>Nuova</span>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate     && <CreateModal user={user} profiles={profiles} maxC={credits[user]} cats={cats} onCreate={handleCreate} onClose={() => setShowCreate(false)} />}
      {revealBet      && <RevealModal bet={revealBet} cats={cats} onResolve={handleResolve} onClose={() => setRevealBet(null)} />}
      {resolveBet     && <ResolveModal bet={resolveBet} cats={cats} profiles={profiles} onResolve={handleResolve} onOvertime={b => { setResolveBet(null); setOvertimeBet(b); }} onClose={() => setResolveBet(null)} />}
      {counterTarget  && <CounterModal bet={counterTarget} user={user} profiles={profiles} credits={credits} cats={cats} onPlace={handleCounter} onClose={() => setCounterTarget(null)} />}
      {overtimeBet    && <OvertimeModal bet={overtimeBet} profiles={profiles} onResult={handleResolve} onClose={() => setOvertimeBet(null)} />}
      {showPin        && <PinModal user={user} profiles={profiles} vaultPin={vaultPin} onSuccess={() => { setVaultUnlocked(true); setShowPin(false); }} onClose={() => setShowPin(false)} />}
      {winAnim        && <WinOverlay amount={winAnim} onDone={() => setWinAnim(null)} />}
      {commentBetModal && <CommentModal bet={commentBetModal} onSave={handleComment} onSkip={() => setCommentBetModal(null)} />}
    </div>
  );
}
