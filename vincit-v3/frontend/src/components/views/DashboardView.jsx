import React, { useState } from 'react';

function getISOWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

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

function currentStreaks(bets, userId) {
  const sorted = [...bets]
    .filter(b => b.creator === userId && ['won','lost'].includes(b.status))
    .sort((a,b) => (a.resolvedAt||a.createdAt) - (b.resolvedAt||b.createdAt));
  let w = 0, l = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const s = sorted[i].status;
    if (s === 'won' && l === 0) w++;
    else if (s === 'lost' && w === 0) l++;
    else break;
  }
  return { winStreak: w, lossStreak: l };
}

import { Btn, SecLabel, fmtD, isSoon, tLeft, COLORS, getC } from '../Atoms.jsx';
import { useLang, TRANSLATIONS } from '../../i18n.js';
import BetCard from '../BetCard.jsx';
import { StreakInline } from '../StreakBadge.jsx';
import DieFace from '../DieFace.jsx';
import BetListModal from '../modals/BetListModal.jsx';
import RankingModal from '../modals/RankingModal.jsx';

const S = {
  card: {background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:16},
  row: {display:"flex",alignItems:"center",gap:10},
};

export default function DashboardView({
  user, profiles, groupMembers, credits, bets, cats, feedEvents = [],
  onCreate,
  onResolve, onReveal, onCounter, onFlame, notifSince,
  isDesktop, reactions, onReaction, onReactionPhoto,
  onDelete, onEdit, onAccept, onReject,
  can, onGoToVault, onGoToBets,
  onConfirmOutcome, onWithdrawResolve, onOvertime,
  onEggUnlock, onOpenDie, onOpenIceEgg, onOpenPhoenixEgg,
  pendingResolveIds, onNotifSeen,
}) {
  const { t, lang } = useLang();
  const [tab, setTab]               = useState('feed');
  const [betListData, setBetListData] = useState(null);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [streakTapCount, setStreakTapCount] = useState(0);
  const streakTapTimerRef = React.useRef(null);
  const [streakPulseKey, setStreakPulseKey] = useState(0);

  // ── Derived data ───────────────────────────────────────────────────
  const allMemberIds = (groupMembers && groupMembers.length
    ? groupMembers.map(m => m.id)
    : Object.keys(profiles)
  );
  const otherIds = allMemberIds.filter(k => k !== user);
  const other    = otherIds[0] ?? null;

  const myWon       = bets.filter(b => b.creator === user && b.status === 'won');
  const myLost      = bets.filter(b => b.creator === user && b.status === 'lost');
  const myAct       = bets.filter(b => b.creator === user && !b.isSecret && b.status === 'active');
  const pendingBets = bets.filter(b => b.status === 'pending' && (b.creator === user || b.opponent === user));
  const mySec       = bets.filter(b => b.creator === user && b.isSecret && b.status === 'active');
  const thAct       = bets.filter(b => otherIds.includes(b.creator) && !b.isSecret && b.status === 'active');
  const newPartBets = bets.filter(b => otherIds.includes(b.creator) && !b.isSecret && b.status === 'active' && b.createdAt > (notifSince?.[user] || 0));
  const newPart     = newPartBets.length;
  const expiring    = bets.filter(b => b.creator === user && b.status === 'active' && isSoon(b.expiresAt));
  const expiredBets = bets.filter(b => b.creator === user && b.status === 'expired');
  const wr          = (myWon.length + myLost.length)
    ? Math.round(myWon.length / (myWon.length + myLost.length) * 100) : 0;

  const allActiveBets  = [...myAct, ...thAct];
  const totalInPlay    = allActiveBets.reduce((s, b) => s + (b.stake || 0), 0);
  const potentialTotal = allActiveBets.reduce((s, b) => s + (b.potentialWin || 0), 0);

  // Weekly highlights
  const oneWeekAgo  = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyWon   = bets.filter(b =>
    b.status === 'won' && Number(b.resolvedAt || b.updatedAt || b.createdAt || 0) > oneWeekAgo
  );
  const topWinBet   = weeklyWon.reduce((best, b) => {
    const gain = (b.potentialWin || 0) - (b.stake || 0);
    return (!best || gain > (best.potentialWin || 0) - (best.stake || 0)) ? b : best;
  }, null);
  const craziestBet = weeklyWon.reduce((best, b) =>
    (!best || (b.quota || 1) > (best.quota || 1)) ? b : best
  , null);

  // Ranking
  const rankRows = allMemberIds.map(id => {
    const p = profiles[id] || (groupMembers && groupMembers.find(m => m.id === id));
    const streaks = currentStreaks(bets, id);
    return {
      id, p,
      c: getC(profiles, id),
      w: bets.filter(b => b.creator === id && b.status === 'won').length,
      isMe: id === user,
      streaks,
    };
  }).sort((a, b) => b.w - a.w || (a.isMe ? -1 : 1));

  // Monthly summary
  const now         = new Date();
  const prevMonth   = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const prevYear    = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prevMonthKey = `betcouple_summary_seen_${prevYear}-${String(prevMonth+1).padStart(2,'0')}`;
  const prevMonthBets = bets.filter(b => {
    const d = new Date(b.createdAt);
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear && ['won','lost'].includes(b.status);
  });
  const [summaryDismissed, setSummaryDismissed] = React.useState(false);
  const showSummary   = !summaryDismissed && !localStorage.getItem(prevMonthKey) && prevMonthBets.length > 0;
  const myPrevWins    = prevMonthBets.filter(b => b.creator === user && b.status === 'won');
  const myPrevLoss    = prevMonthBets.filter(b => b.creator === user && b.status === 'lost');
  const otPrevWins    = prevMonthBets.filter(b => b.creator === other && b.status === 'won');
  const bestBet       = myPrevWins.reduce((best, b) => (!best || b.quota > best.quota) ? b : best, null);
  const netProfit     = myPrevWins.reduce((s, b) => s + (b.potentialWin - b.stake), 0)
                       - myPrevLoss.reduce((s, b) => s + b.stake, 0);
  const months        = TRANSLATIONS[lang]?.dashboard?.months ?? TRANSLATIONS.it.dashboard.months;

  // Hero derived
  const myProfile  = profiles[user] || {};
  const myColor    = getC(profiles, user);
  const hour       = new Date().getHours();
  const greeting   = hour < 6 ? '🌙' : hour < 12 ? '☀️' : hour < 18 ? '👋' : '✨';
  const totalMy    = myWon.length + myLost.length;
  const myStreaks  = currentStreaks(bets, user);
  const todayKey   = new Date().toDateString();
  const todayCount = bets.filter(b => new Date(b.createdAt).toDateString() === todayKey).length;
  const latestBet  = [...bets]
    .filter(b => !b.isSecret && b.status === 'active')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  const fireLevel  = Math.max(myStreaks.winStreak, myStreaks.lossStreak);
  const fireKind   = myStreaks.winStreak > myStreaks.lossStreak ? 'win' : 'loss';
  const lastFive   = [...bets]
    .filter(b => b.creator === user && ['won','lost'].includes(b.status))
    .sort((a, b) => (a.resolvedAt || a.createdAt || 0) - (b.resolvedAt || b.createdAt || 0))
    .slice(-5);

  const isWinStreak  = fireKind === 'win';
  const isHotStreak  = isWinStreak && fireLevel >= 5;
  const streakAccent = isWinStreak ? (isHotStreak ? 'var(--red)' : 'var(--gold)') : 'var(--blu)';

  // ── Tab helpers ────────────────────────────────────────────────────
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

  // ── Feed event renderer ────────────────────────────────────────────
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

  // ── Streak 3-tap easter egg ────────────────────────────────────────
  const handleStreakTap = () => {
    if (fireLevel < 3) return;
    setStreakPulseKey(k => k + 1);
    const next = streakTapCount + 1;
    if (streakTapTimerRef.current) clearTimeout(streakTapTimerRef.current);
    if (next >= 3) {
      setStreakTapCount(0);
      if (fireKind === 'loss') onOpenIceEgg?.();
      else                     onOpenPhoenixEgg?.();
      return;
    }
    setStreakTapCount(next);
    streakTapTimerRef.current = setTimeout(() => setStreakTapCount(0), 1800);
  };

  // ── Render helpers ─────────────────────────────────────────────────
  const renderStreakHero = () => {
    if (fireLevel >= 3) {
      return (
        <div
          onClick={handleStreakTap}
          style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', gap: isDesktop ? 14 : 10,
            cursor: 'pointer', userSelect: 'none',
            WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            padding: '6px 10px', borderRadius: 16,
            boxShadow: streakTapCount > 0 ? `0 0 0 2px ${streakAccent}66` : 'none',
            transition: 'box-shadow .2s',
            alignSelf: isDesktop ? 'flex-end' : 'flex-start',
          }}>
          <span key={streakPulseKey} style={{
            fontSize: isDesktop ? 84 : 64, lineHeight: 1, display: 'inline-block',
            animation: streakPulseKey > 0 ? 'bcStreakTap .35s cubic-bezier(.3,1.6,.5,1) both' : 'none',
            filter: `drop-shadow(0 6px 22px ${streakAccent}66)`,
          }}>
            {isWinStreak ? '🔥' : '❄️'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="bc-num" style={{ fontSize: 'clamp(48px, 11vw, 92px)', color: streakAccent, lineHeight: .92 }}>
              {fireLevel}
            </div>
            <div className="bc-meta" style={{ marginTop: 6, fontSize: 8 }}>
              — {isWinStreak ? t('dashboard_extra.streak_wins') : t('dashboard_extra.streak_losses')}
            </div>
          </div>
          {streakTapCount > 0 && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              fontSize: 10, fontWeight: 800, color: streakAccent,
              fontFamily: "'Manrope',sans-serif", letterSpacing: '.1em',
            }}>{streakTapCount}/3</span>
          )}
        </div>
      );
    }
    if (!isDesktop) return null;
    return (
      <div style={{ alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', gap: 6, opacity: 0.55 }}>
        <span aria-hidden style={{ fontSize: 40, lineHeight: 1, filter: 'grayscale(.4)' }}>🔥</span>
        <span style={{
          fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
          fontSize: 16, fontWeight: 500, color: 'var(--dim)', maxWidth: 260, lineHeight: 1.35,
        }}>{t('dashboard_extra.streak_fallback')}</span>
      </div>
    );
  };

  const renderFormTrail = () => {
    if (lastFive.length === 0) return null;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        marginTop: isDesktop ? 28 : 22,
        paddingTop: 16, paddingRight: isDesktop ? 24 : 8,
        borderTop: '1px solid var(--rule)',
      }}>
        <span className="bc-meta" style={{ fontSize: 8, flexShrink: 0 }}>
          — {t('dashboard_extra.trail_label')}
        </span>
        <span style={{ display: 'flex', gap: isDesktop ? 8 : 6, marginLeft: 'auto' }}>
          {lastFive.map((b, i) => {
            const won = b.status === 'won';
            const badgeBg = won ? 'var(--grn)' : 'var(--red)';
            const isLatest = i === lastFive.length - 1;
            const fade = lastFive.length === 1 ? 1 : 0.55 + (i / (lastFive.length - 1)) * 0.45;
            const dim = isDesktop ? 42 : 34;
            return (
              <button key={b.id || i}
                onClick={() => setBetListData({ title: won ? t('comment.won') : t('comment.lost'), accentColor: badgeBg, bets: [b] })}
                style={{
                  width: dim, height: dim, borderRadius: 8,
                  background: badgeBg, border: 'none', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Manrope',sans-serif",
                  fontSize: isDesktop ? 18 : 15, fontWeight: 800,
                  color: '#fff', cursor: 'pointer', opacity: fade,
                  transform: isLatest ? 'scale(1.1)' : 'scale(1)',
                  boxShadow: isLatest
                    ? `0 4px 14px ${badgeBg}88, 0 0 18px ${badgeBg}55`
                    : `0 2px 6px ${badgeBg}22`,
                  transition: 'transform .15s, box-shadow .15s',
                  WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                }}>{t(won ? 'dashboard_extra.trail_won' : 'dashboard_extra.trail_lost')}</button>
            );
          })}
        </span>
      </div>
    );
  };

  const renderSubHero = () => {
    if (todayCount === 0 && !latestBet) return null;
    return (
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: isDesktop ? 28 : 18,
        marginTop: isDesktop ? 22 : 18, paddingRight: isDesktop ? 24 : 8, flexWrap: 'wrap',
      }}>
        {todayCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
            <span className="bc-num" style={{ fontSize: 'clamp(28px, 4vw, 38px)', color: 'var(--txt)', lineHeight: 1 }}>
              {todayCount}
            </span>
            <span className="bc-meta" style={{ fontSize: 8 }}>OGGI · GRUPPO</span>
          </div>
        )}
        {(() => {
          const days = computeStreak(bets, user);
          if (days < 2) return null;
          return (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 'clamp(22px, 3vw, 28px)', lineHeight: 1, flexShrink: 0 }} aria-hidden>📅</span>
              <span className="bc-num" style={{ fontSize: 'clamp(28px, 4vw, 38px)', color: 'var(--gold)', lineHeight: 1 }}>
                {days}
              </span>
              <span className="bc-meta" style={{ fontSize: 8 }}>{t('dashboard_extra.daily_streak_label')}</span>
            </div>
          );
        })()}
        {latestBet && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 9, color: 'var(--gold)', fontWeight: 800, letterSpacing: '.22em', flexShrink: 0, fontFamily: "'Manrope',sans-serif" }}>
              LIVE →
            </span>
            <span style={{
              fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
              fontSize: 'clamp(16px, 2vw, 24px)', color: 'var(--gold)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0, lineHeight: 1.15,
            }}>"{latestBet.title}"</span>
          </div>
        )}
      </div>
    );
  };

  // ── Hero block ─────────────────────────────────────────────────────
  const hero = (
    <div style={{
      position: 'relative',
      padding: isDesktop ? '40px 0 56px' : '24px 0 36px',
      marginBottom: 8,
      marginLeft: isDesktop ? -12 : -6,
    }}>
      <div className="bc-meta" style={{ marginBottom: 14, paddingLeft: isDesktop ? 64 : 28, opacity: .85 }}>
        {greeting} {t('app.welcome_back')}
      </div>
      <div className="bc-hero" style={{
        fontSize: 'clamp(64px, 18vw, 180px)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        marginBottom: isDesktop ? -12 : -6,
      }}>
        {myProfile.name}
      </div>

      <div style={{
        display: 'flex',
        flexDirection: isDesktop ? 'row' : 'column',
        alignItems: isDesktop ? 'flex-end' : 'stretch',
        justifyContent: 'space-between',
        gap: isDesktop ? 32 : 14,
        marginTop: isDesktop ? 32 : 22,
        paddingRight: isDesktop ? 24 : 8,
      }}>
        {renderStreakHero()}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 'auto' }}>
          <div className="bc-num" style={{ fontSize: 'clamp(48px, 11vw, 92px)', color: 'var(--gold)', lineHeight: .92 }}>
            {Math.round(credits[user] ?? 0)}<span style={{ fontSize: '0.45em', color: 'var(--dim)', marginLeft: 6, fontWeight: 400 }}>₡</span>
          </div>
          <div className="bc-meta" style={{ marginTop: 6, fontSize: 8 }}>— {t('app.credits')}</div>
        </div>
      </div>

      {renderFormTrail()}
      {renderSubHero()}

      {totalMy > 0 && (() => {
        const cells = [
          { l: t('stats_view.won'),      v: myWon.length,  c: 'var(--grn)' },
          { l: t('stats_view.lost'),     v: myLost.length, c: 'var(--red)' },
          { l: t('stats_view.win_rate'), v: `${wr}%`,      c: wr >= 50 ? 'var(--grn)' : 'var(--red)' },
          { l: t('dashboard.total_bets'), v: totalMy + myAct.length + mySec.length, c: 'var(--gold)' },
        ];
        const yOffsets = isDesktop ? [0, 22, 8, 30] : [0, 14, 4, 18];
        const anchors  = ['flex-start', 'center', 'flex-end', 'center'];
        const aligns   = ['left', 'center', 'right', 'center'];
        const nudges   = isDesktop ? [0, -6, 0, 10] : [0, -3, 0, 6];
        return (
          <div style={{
            display: 'flex', gap: 0,
            marginTop: isDesktop ? 44 : 28,
            paddingTop: 18, borderTop: '1px solid var(--rule)',
            alignItems: 'flex-start',
          }}>
            {cells.map((s, idx) => (
              <div key={s.l} style={{
                flex: 1, minWidth: 0,
                paddingTop: yOffsets[idx], paddingLeft: 6, paddingRight: 6,
                display: 'flex', flexDirection: 'column',
                alignItems: anchors[idx], textAlign: aligns[idx],
                transform: `translateX(${nudges[idx]}px)`,
                borderLeft: idx === 0 ? 'none' : '1px solid var(--rule)',
              }}>
                <div className="bc-num" style={{ fontSize: 'clamp(22px, 5vw, 34px)', color: s.c, lineHeight: 1 }}>{s.v}</div>
                <div className="bc-meta" style={{ marginTop: 6, fontSize: 8 }}>{s.l}</div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );

  // ── Scorecard (ranking podium) ─────────────────────────────────────
  const scoreCard = (() => {
    const rest = rankRows.slice(3);
    const podiumSlots = [
      { rankIdx: 1, medal: '🥈', platformH: 38, avatarSize: 44, numSize: 24 },
      { rankIdx: 0, medal: '🥇', platformH: 58, avatarSize: 54, numSize: 32 },
      { rankIdx: 2, medal: '🥉', platformH: 26, avatarSize: 40, numSize: 20 },
    ];
    return (
      <div className={`card ${otherIds.length > 0 ? 'pGold' : ''}`}
        style={{ ...S.card, marginBottom: 14, background: 'linear-gradient(135deg,var(--card),var(--surf))' }}>
        <SecLabel>{t('dashboard.ranking')}</SecLabel>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4 }}>
          {podiumSlots.map(({ rankIdx, medal, platformH, avatarSize, numSize }) => {
            const s = rankRows[rankIdx];
            const isFirst = rankIdx === 0;
            if (!s) return (
              <div key={rankIdx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '100%', height: platformH, background: 'var(--soft)', border: '1px dashed var(--brd)', borderBottom: 'none', borderRadius: '6px 6px 0 0', opacity: .2 }} />
              </div>
            );
            const platBg = isFirst
              ? 'linear-gradient(180deg,var(--gold)26 0%,var(--gold)12 100%)'
              : rankIdx === 1
                ? 'linear-gradient(180deg,rgba(180,185,210,.16) 0%,rgba(180,185,210,.07) 100%)'
                : 'linear-gradient(180deg,rgba(160,120,70,.14) 0%,rgba(160,120,70,.06) 100%)';
            const platBorder = isFirst ? 'var(--gold)55' : `${s.c}33`;
            const nameColor  = isFirst ? 'var(--gold)' : 'var(--txt)';
            const numColor   = isFirst ? 'var(--gold)' : s.c;
            return (
              <div key={s.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
                <div style={{ fontSize: isFirst ? 16 : 13, lineHeight: 1, marginBottom: 5 }}>{medal}</div>
                <div style={{
                  width: avatarSize, height: avatarSize, borderRadius: '50%',
                  background: `${s.c}33`, border: `2px solid ${isFirst ? 'var(--gold)' : `${s.c}77`}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: Math.round(avatarSize * .46), overflow: 'hidden', position: 'relative', flexShrink: 0,
                  boxShadow: isFirst ? '0 0 18px var(--gold)44,0 4px 14px rgba(0,0,0,.35)' : '0 2px 8px rgba(0,0,0,.2)',
                  marginBottom: 6,
                }}>
                  {s.p?.avatarUrl
                    ? <img src={s.p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : (s.p?.avatar ?? '👤')}
                  {(s.streaks.winStreak >= 3 || s.streaks.lossStreak >= 3) && (
                    <div style={{ position: 'absolute', bottom: -4, right: -5, background: 'var(--surf)', borderRadius: 10, padding: '1px 3px', border: '1px solid var(--brd)', display: 'flex', alignItems: 'center' }}>
                      <StreakInline winStreak={s.streaks.winStreak} lossStreak={s.streaks.lossStreak} size={10} />
                    </div>
                  )}
                </div>
                <div style={{
                  width: '100%', height: platformH,
                  background: platBg, border: `1px solid ${platBorder}`,
                  borderBottom: 'none', borderRadius: '6px 6px 0 0',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '4px 4px 2px', gap: 1, overflow: 'hidden',
                }}>
                  <div style={{
                    fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
                    fontSize: isFirst ? 13 : 11, fontWeight: 700, color: nameColor,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', lineHeight: 1,
                  }}>
                    {s.p?.name}{s.isMe && <span style={{ color: 'var(--gold)', marginLeft: 2 }}>·</span>}
                  </div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: numSize, lineHeight: 1, color: numColor }}>
                    {s.w}
                  </div>
                  <div style={{ fontSize: 7, color: isFirst ? 'var(--gold)' : 'var(--mut)', letterSpacing: '.18em', lineHeight: 1 }}>
                    {t('dashboard.wins').toUpperCase()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ height: 1, background: 'var(--brd)', marginBottom: rest.length > 0 ? 10 : 14 }} />
        {rest.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
            {rest.map(s => (
              <div key={s.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 8px 3px 5px', borderRadius: 20,
                background: 'var(--soft)', border: '1px solid var(--brd)',
              }}>
                <span style={{ fontSize: 13, lineHeight: 1 }}>{s.p?.avatar ?? '👤'}</span>
                <span style={{ fontFamily: "'Manrope',sans-serif", fontSize: 11, color: 'var(--dim)', fontWeight: 600, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.p?.name?.split(' ')[0] ?? ''}
                </span>
                <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 13, fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.w}</span>
                <span style={{ fontSize: 7, color: 'var(--dim)', letterSpacing: '.1em' }}>V</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, paddingTop: 12, borderTop: '1px solid var(--brd)' }}>
          {[
            { l: t('dashboard.win_rate'), v: `${wr}%`,                            c: wr >= 50 ? 'var(--grn)' : 'var(--red)' },
            { l: t('dashboard.credits'),  v: `${Math.round(credits[user] ?? 0)} ₡`, c: 'var(--gold)' },
            { l: t('dashboard.total_bets'), v: myWon.length + myLost.length + myAct.length + mySec.length, c: 'var(--txt)' },
          ].map(s => (
            <div key={s.l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 10, color: 'var(--dim)' }}>{s.l}</div>
            </div>
          ))}
        </div>
        {!other && (
          <div style={{ textAlign: 'center', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--brd)' }}>
            <div style={{ fontSize: 12, color: 'var(--dim)' }}>{t('dashboard.solo_hint')}</div>
          </div>
        )}
        <button onClick={() => setRankingOpen(true)} style={{
          marginTop: 12, width: '100%', padding: '7px 0',
          background: 'transparent', border: '1px solid var(--gold)33',
          borderRadius: 8, cursor: 'pointer',
          fontFamily: "'Manrope',sans-serif", fontSize: 10, fontWeight: 700,
          letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)',
          WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
        }}>
          Vedi report completo →
        </button>
      </div>
    );
  })();

  // ── Vault teaser ───────────────────────────────────────────────────
  const vaultTeaser = mySec.length > 0 && (
    <div onClick={onGoToVault} style={{
      ...S.card, marginBottom: 14, border: '1px solid var(--gold)44',
      display: 'flex', alignItems: 'center', gap: 10,
      cursor: onGoToVault ? 'pointer' : 'default', transition: 'all .18s',
    }}
      onMouseEnter={e => { if (onGoToVault) { e.currentTarget.style.background = 'var(--gold)10'; e.currentTarget.style.borderColor = 'var(--gold)88'; } }}
      onMouseLeave={e => { if (onGoToVault) { e.currentTarget.style.background = 'var(--card)';   e.currentTarget.style.borderColor = 'var(--gold)44'; } }}
    >
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gold)22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔒</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--gold)' }}>{t('dashboard.vault_teaser')}</div>
        <div style={{ fontSize: 12, color: 'var(--dim)' }}>{mySec.length === 1 ? t('dashboard.vault_teaser_one', { n: mySec.length }) : t('dashboard.vault_teaser_many', { n: mySec.length })}</div>
      </div>
      {onGoToVault && <span style={{ color: 'var(--gold)', fontSize: 14 }}>➤</span>}
    </div>
  );

  // ── Alerts ─────────────────────────────────────────────────────────
  const expiredAlert = expiredBets.length > 0 && (
    <div style={{ ...S.card, marginBottom: 12, background: 'var(--red)14', border: '1px solid var(--red)66', borderLeft: '4px solid var(--red)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>⏱</span>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)', letterSpacing: '.01em' }}>
          {t(expiredBets.length === 1 ? 'dashboard.expired_one' : 'dashboard.expired_many', { n: expiredBets.length })}
        </div>
      </div>
      {expiredBets.map(b => (
        <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderTop: '1px solid var(--red)22' }}>
          <div onClick={() => setBetListData({ title: b.title, accentColor: 'var(--red)', bets: [b] })}
            style={{ fontSize: 12, color: 'var(--txt)', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--red)55', WebkitTapHighlightColor: 'transparent' }}>
            {b.title}
          </div>
          {onResolve && (() => {
            const isPendingResolve = pendingResolveIds?.has(b.id);
            return isPendingResolve
              ? <span style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 999, background: 'var(--mut)22', border: '1px solid var(--mut)44', color: 'var(--mut)', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: "'Manrope',sans-serif", opacity: .55 }}>⏳ In invio…</span>
              : <button onClick={() => onResolve(b)} style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 999, background: 'var(--red)22', border: '1px solid var(--red)55', color: 'var(--red)', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Manrope',sans-serif", WebkitTapHighlightColor: 'transparent' }}>Dichiara</button>;
          })()}
        </div>
      ))}
    </div>
  );

  const expiryAlert = expiring.length > 0 && (
    <div style={{ ...S.card, marginBottom: 12, background: 'var(--gold)0e', border: '1px solid var(--gold)55', borderLeft: '4px solid var(--gold)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>⚡</span>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gold)' }}>{t('dashboard.expiry', { n: expiring.length })}</div>
      </div>
      {expiring.map(b => (
        <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderTop: '1px solid var(--gold)22' }}>
          <div style={{ fontSize: 12, color: 'var(--txt)', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
          <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, flexShrink: 0 }}>{tLeft(b.expiresAt, lang)}</div>
        </div>
      ))}
    </div>
  );

  // ── Weekly highlights ticker ───────────────────────────────────────
  const weeklyTicker = (topWinBet || craziestBet) && (() => {
    const weekNum = getISOWeek(new Date());
    const gain = topWinBet ? (topWinBet.potentialWin || 0) - (topWinBet.stake || 0) : 0;
    const prob = craziestBet ? Math.round(100 / Math.max(1, craziestBet.quota || 1)) : 0;
    const isDifferent = craziestBet && topWinBet && craziestBet.id !== topWinBet.id;
    const highlights = [topWinBet, isDifferent ? craziestBet : null].filter(Boolean);
    return (
      <div onClick={() => setBetListData({ title: `🏅 Sett. ${weekNum} — Best of the week`, accentColor: 'var(--gold)', bets: highlights })}
        style={{ ...S.card, marginBottom: 12, background: 'var(--gold)0a', border: '1px solid var(--gold)33', borderLeft: '3px solid var(--gold)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 8, color: 'var(--gold)', letterSpacing: '.22em', fontWeight: 700, marginBottom: 6, fontFamily: "'Manrope',sans-serif" }}>
              SETT. {weekNum} · BET HIGHLIGHTS
            </div>
            {topWinBet && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: isDifferent ? 4 : 0 }}>
                <span style={{ fontSize: 12 }}>🏆</span>
                <span style={{ fontSize: 10, color: 'var(--grn)', fontWeight: 700, flexShrink: 0, fontFamily: "'Manrope',sans-serif" }}>+{gain} ₡</span>
                <span style={{ fontSize: 12, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontStyle: 'italic', fontFamily: "'Cormorant Garamond',serif" }}>
                  "{topWinBet.title}"
                </span>
              </div>
            )}
            {isDifferent && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12 }}>💀</span>
                <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, flexShrink: 0, fontFamily: "'Manrope',sans-serif" }}>{prob}% win</span>
                <span style={{ fontSize: 12, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontStyle: 'italic', fontFamily: "'Cormorant Garamond',serif" }}>
                  "{craziestBet.title}"
                </span>
              </div>
            )}
          </div>
          <span style={{ fontSize: 13, color: 'var(--gold)', flexShrink: 0, opacity: .8 }}>▸</span>
        </div>
      </div>
    );
  })();

  // ── Recent resolved bets ──────────────────────────────────────────
  const recentResolved = (() => {
    const all = bets.filter(b => b.creator === user && ['won','lost'].includes(b.status));
    if (all.length === 0) return false;
    const newest3 = [...all]
      .sort((a, b) => (b.resolvedAt || b.createdAt || 0) - (a.resolvedAt || a.createdAt || 0))
      .slice(0, 3);
    const hasMore = all.length > 3;
    return (
      <>
        <SecLabel mt={16}>{t('dashboard.recent')}</SecLabel>
        {newest3.map(b => (
          <BetCard key={b.id} {...betCardProps(b)} />
        ))}
        {hasMore && onGoToBets && (
          <button onClick={onGoToBets}
            style={{
              marginTop: 10, padding: '10px 14px', width: '100%',
              background: 'transparent', border: '1px dashed var(--brd)',
              borderRadius: 12, cursor: 'pointer',
              color: 'var(--gold)', fontFamily: "'Manrope',sans-serif",
              fontSize: 11, fontWeight: 700, letterSpacing: '.14em',
              textTransform: 'uppercase',
              WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            }}>
            {t('dashboard.see_all_bets')} →
          </button>
        )}
      </>
    );
  })();

  // ── Tab content: empty state with die ─────────────────────────────
  const emptyBetsState = myAct.length + thAct.length + mySec.length === 0 && (
    <div style={{
      position: 'relative',
      padding: isDesktop ? '48px 0 72px' : '40px 0 56px',
      minHeight: isDesktop ? 320 : 240,
      overflow: 'visible',
    }}>
      <div onClick={onOpenDie} style={{
        position: 'absolute',
        top: isDesktop ? 12 : 6,
        right: isDesktop ? '14%' : '6%',
        opacity: .85,
        transform: 'rotate(-14deg)',
        animation: 'sUp .6s ease both .1s',
        userSelect: 'none', touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}>
        <DieFace value={3} size={isDesktop ? 84 : 60} />
      </div>
      <div style={{
        fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic', fontWeight: 600,
        fontSize: 'clamp(56px, 16vw, 168px)', lineHeight: 0.9,
        letterSpacing: '-0.03em', color: 'var(--txt)',
        marginLeft: isDesktop ? -10 : -4, marginBottom: 18,
      }}>
        <div>{t('dashboard.no_active').split(' ')[0] || t('dashboard.no_active')}</div>
        {t('dashboard.no_active').split(' ').slice(1).join(' ') && (
          <div style={{ paddingLeft: isDesktop ? '22%' : '14%', color: 'var(--gold)', marginTop: isDesktop ? -10 : -4 }}>
            {t('dashboard.no_active').split(' ').slice(1).join(' ')}
          </div>
        )}
      </div>
      <div className="bc-meta" style={{ fontSize: 9, maxWidth: 340, lineHeight: 1.7, color: 'var(--dim)', marginBottom: isDesktop ? 32 : 24, textTransform: 'none', letterSpacing: '.02em', fontWeight: 500, fontStyle: 'normal' }}>
        {t('dashboard.no_active_sub')}
      </div>
      <div style={{ textAlign: 'right', paddingRight: isDesktop ? 12 : 0, marginTop: 'auto' }}>
        <Btn variant="gold" onClick={onCreate} style={{ padding: isDesktop ? '14px 36px' : '13px 28px', fontSize: isDesktop ? 13 : 12 }}>
          {t('dashboard.cta')}
        </Btn>
      </div>
    </div>
  );

  // ── Tabs section ───────────────────────────────────────────────────
  const sevenDaysAgo = Date.now() - 7 * 86400000;

  const tabsSection = (
    <div style={{ marginTop: 8 }}>
      {/* "+ Nuova Bet" CTA */}
      <button onClick={onCreate} style={{
        width: '100%', padding: '12px 0', marginBottom: 16,
        background: 'var(--pur)', color: '#fff',
        border: 'none', borderRadius: 9,
        fontFamily: "'Manrope', sans-serif",
        fontSize: 14, fontWeight: 800, cursor: 'pointer', letterSpacing: '.02em',
      }}>
        {t('dashboard.cta')}
      </button>

      {/* Tab strip */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--rule)' }}>
        <button style={tabStyle('feed')} onClick={() => setTab('feed')}>
          {t('dashboard.tab_feed')}
        </button>
        <button style={tabStyle('active')} onClick={() => setTab('active')}>
          {t('dashboard.tab_active')}
          {countBadge(allActiveBets.length, 'var(--pur)')}
        </button>
        <button style={tabStyle('pending')} onClick={() => setTab('pending')}>
          {t('dashboard.tab_pending')}
          {countBadge(pendingBets.length, 'var(--red)')}
        </button>
      </div>

      {/* Tab content */}
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
                <div key={ev.id} style={{ display: 'flex', gap: 9, padding: '9px 0', borderBottom: '1px solid var(--rule)', opacity: isOld ? 0.4 : 1 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: `${actorColor}22`, border: `1px solid ${actorColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, overflow: 'hidden' }}>
                    {actorP?.avatarUrl
                      ? <img src={actorP.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : actorP?.avatar}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--txt)', lineHeight: 1.4 }}>{text}</div>
                    {chip && (
                      <div style={{ marginTop: 3 }}>
                        <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600, background: chipColor ? `${chipColor}1a` : 'var(--soft)', color: chipColor ?? 'var(--dim)' }}>{chip}</span>
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
            {emptyBetsState}
            {myAct.map(b => <BetCard key={b.id} {...betCardProps(b)} />)}
            {thAct.map(b => <BetCard key={b.id} {...betCardProps(b)} />)}
            {allActiveBets.length > 0 && (
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
            {recentResolved}
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

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="sUp">
      {hero}

      {/* Monthly summary */}
      {showSummary && (
        <div style={{ ...S.card, marginBottom: 12, background: 'var(--gold)11', border: '1px solid var(--gold)44', position: 'relative' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)', marginBottom: 6 }}>📊 {months[prevMonth]} {prevYear}</div>
          <div style={{ fontSize: 13, color: 'var(--txt)', marginBottom: 4 }}>{profiles[user]?.name} {myPrevWins.length}V / {profiles[other]?.name} {otPrevWins.length}V</div>
          {bestBet && <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 2 }}>{t('dashboard.best_bet')} <span style={{ color: 'var(--gold)' }}>{bestBet.title} @ {parseFloat(bestBet.quota).toFixed(2)}×</span></div>}
          <div style={{ fontSize: 12, color: netProfit >= 0 ? 'var(--grn)' : 'var(--red)' }}>{t('dashboard.net_profit', { name: profiles[user]?.name })} {netProfit >= 0 ? '+' : ''}{netProfit} ₡</div>
          <button onClick={() => { localStorage.setItem(prevMonthKey, '1'); setSummaryDismissed(true); }} style={{ position: 'absolute', top: 10, right: 10, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--dim)' }}>✕</button>
        </div>
      )}

      {/* Partner notification */}
      {newPart > 0 && (() => {
        const creators = [...new Set(newPartBets.map(b => b.creator))];
        const singleCreator = creators.length === 1 ? creators[0] : null;
        const displayName   = singleCreator ? profiles[singleCreator]?.name : `${newPart} ${t('dashboard.notif_many', { n: newPart })}`;
        const displayAvatar = singleCreator ? profiles[singleCreator]?.avatar : '🎯';
        return (
          <div
            onClick={() => { setBetListData({ title: `${singleCreator ? profiles[singleCreator]?.name : 'Nuove bet'} — ${newPart === 1 ? t('dashboard.notif_one') : t('dashboard.notif_many', { n: newPart })}`, accentColor: 'var(--gold)', bets: newPartBets }); onNotifSeen?.(); }}
            style={{ ...S.card, marginBottom: 12, background: 'var(--gold)14', border: '1px solid var(--gold)44', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', position: 'relative', WebkitTapHighlightColor: 'transparent' }}
          >
            <span style={{ fontSize: 22 }}>{displayAvatar}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gold)' }}>{displayName} {newPart === 1 ? t('dashboard.notif_one') : ''}</div>
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>{t('dashboard.notif_sub')} · <span style={{ color: 'var(--gold)', fontWeight: 600 }}>Vedi →</span></div>
            </div>
            <button onClick={e => { e.stopPropagation(); onNotifSeen?.(); }} aria-label="Chiudi" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--dim)', fontSize: 16, padding: '4px 6px', flexShrink: 0, lineHeight: 1 }}>✕</button>
          </div>
        );
      })()}

      {isDesktop ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)', gap: 14, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tabsSection}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'sticky', top: 14 }}>
            {scoreCard}{vaultTeaser}{weeklyTicker}{expiredAlert}{expiryAlert}
          </div>
        </div>
      ) : (
        <>
          {weeklyTicker}{expiredAlert}{expiryAlert}
          {scoreCard}{vaultTeaser}
          {tabsSection}
        </>
      )}

      <BetListModal
        open={!!betListData}
        title={betListData?.title}
        accentColor={betListData?.accentColor || 'var(--gold)'}
        bets={betListData?.bets || []}
        profiles={profiles}
        userId={user}
        onClose={() => setBetListData(null)}
      />
      <RankingModal
        open={rankingOpen}
        onClose={() => setRankingOpen(false)}
        rankRows={rankRows}
        bets={bets}
        profiles={profiles}
        credits={credits}
        user={user}
      />
    </div>
  );
}
