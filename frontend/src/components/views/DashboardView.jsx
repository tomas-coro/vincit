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
import { Btn, SecLabel, fmtD, isSoon, tLeft, COLORS, getC } from '../Atoms.jsx';
import { useLang, TRANSLATIONS } from '../../i18n.js';
import BetCard from '../BetCard.jsx';
import { StreakInline } from '../StreakBadge.jsx';
import DieFace from '../DieFace.jsx';
import BetListModal from '../modals/BetListModal.jsx';
import RankingModal from '../modals/RankingModal.jsx';

// Returns trailing consecutive {winStreak, lossStreak} for a given user, based on their bets.
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

const S = {
  card: {background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:16},
  row: {display:"flex",alignItems:"center",gap:10},
};

// Easter egg #1: the static die in the empty state. Clicking it opens a
// fullscreen tumble overlay (handled in App.jsx via `onOpenDie`). The die
// here intentionally stays still — the animation lives in the overlay so
// the dashboard stays visually clean.

export default function DashboardView({user,profiles,groupMembers,credits,bets,cats,onCreate,onResolve,onReveal,onCounter,onFlame,notifSince,isDesktop,reactions,onReaction,onReactionPhoto,onDelete,onEdit,onAccept,onReject,can,onGoToVault,onGoToBets,onConfirmOutcome,onWithdrawResolve,onOvertime,onEggUnlock,onOpenDie,onOpenIceEgg,onOpenPhoenixEgg,pendingResolveIds,onNotifSeen}){
  const { t, lang } = useLang();
  // Bet-detail modal payload. Set when the user taps a single V/P badge
  // in the form trail — opens BetListModal scoped to just that one bet
  // so they can see "which bet was this".
  const [betListData, setBetListData] = useState(null);
  const [rankingOpen, setRankingOpen] = useState(false);
  // 3-tap activation state for the streak-emoji easter eggs (ice / phoenix).
  // Each tap pulses the emoji + resets a 1.8s timeout; the 3rd tap inside
  // that window opens the matching overlay. Counter resets after firing.
  const [streakTapCount, setStreakTapCount] = useState(0);
  const streakTapTimerRef = React.useRef(null);
  const [streakPulseKey, setStreakPulseKey] = useState(0);
  // Multi-member ranking: include every profile in the group, sorted by wins desc
  const allMemberIds = (groupMembers && groupMembers.length
    ? groupMembers.map(m => m.id)
    : Object.keys(profiles)
  );
  const otherIds = allMemberIds.filter(k => k !== user);
  // Backward-compat "other" pointer: primary partner if any (used for partner-notification banner)
  const other = otherIds[0] ?? null;
  const myWon=bets.filter(b=>b.creator===user&&b.status==="won");
  const myLost=bets.filter(b=>b.creator===user&&b.status==="lost");
  const myAct=bets.filter(b=>b.creator===user&&!b.isSecret&&b.status==='active');
  const pendingBets=bets.filter(b=>b.status==='pending'&&(b.creator===user||b.opponent===user));
  const mySec=bets.filter(b=>b.creator===user&&b.isSecret&&b.status==="active");
  const thAct=bets.filter(b=>otherIds.includes(b.creator)&&!b.isSecret&&b.status==="active");
  const newPartBets=bets.filter(b=>otherIds.includes(b.creator)&&!b.isSecret&&b.status==='active'&&b.createdAt>(notifSince[user]||0));
  const newPart=newPartBets.length;
  const expiring=bets.filter(b=>b.creator===user&&b.status==="active"&&isSoon(b.expiresAt));
  const expiredBets=bets.filter(b=>b.creator===user&&b.status==="expired");
  const wr=(myWon.length+myLost.length)?Math.round(myWon.length/(myWon.length+myLost.length)*100):0;

  // Weekly highlights — won bets in the last 7 days (group-wide)
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyWon = bets.filter(b =>
    b.status === 'won' &&
    Number(b.resolvedAt || b.updatedAt || b.createdAt || 0) > oneWeekAgo
  );
  // Top win: highest net gain (potentialWin − stake)
  const topWinBet = weeklyWon.reduce((best, b) => {
    const gain = (b.potentialWin || 0) - (b.stake || 0);
    return (!best || gain > (best.potentialWin || 0) - (best.stake || 0)) ? b : best;
  }, null);
  // Craziest odds: won bet with highest quota (lowest implied probability)
  const craziestBet = weeklyWon.reduce((best, b) => {
    return (!best || (b.quota || 1) > (best.quota || 1)) ? b : best;
  }, null);

  // Build ranking rows for all members
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
  }).sort((a,b) => b.w - a.w || (a.isMe ? -1 : 1));

  // Monthly summary
  const now=new Date();
  const prevMonth=now.getMonth()===0?11:now.getMonth()-1;
  const prevYear=now.getMonth()===0?now.getFullYear()-1:now.getFullYear();
  const prevMonthKey=`betcouple_summary_seen_${prevYear}-${String(prevMonth+1).padStart(2,'0')}`;
  const prevMonthBets=bets.filter(b=>{const d=new Date(b.createdAt);return d.getMonth()===prevMonth&&d.getFullYear()===prevYear&&['won','lost'].includes(b.status);});
  const [summaryDismissed,setSummaryDismissed]=React.useState(false);
  const showSummary=!summaryDismissed&&!localStorage.getItem(prevMonthKey)&&prevMonthBets.length>0;
  const myPrevWins=prevMonthBets.filter(b=>b.creator===user&&b.status==='won');
  const myPrevLoss=prevMonthBets.filter(b=>b.creator===user&&b.status==='lost');
  const otPrevWins=prevMonthBets.filter(b=>b.creator===other&&b.status==='won');
  const bestBet=myPrevWins.reduce((best,b)=>(!best||b.quota>best.quota)?b:best,null);
  const netProfit=myPrevWins.reduce((s,b)=>s+(b.potentialWin-b.stake),0)-myPrevLoss.reduce((s,b)=>s+b.stake,0);
  const months=TRANSLATIONS[lang]?.dashboard?.months??TRANSLATIONS.it.dashboard.months;

  const scoreCard = (() => {
    const rest = rankRows.slice(3);
    // Podium: left=2nd(idx1), center=1st(idx0), right=3rd(idx2)
    const podiumSlots = [
      { rankIdx:1, medal:'🥈', platformH:38, avatarSize:44, numSize:24 },
      { rankIdx:0, medal:'🥇', platformH:58, avatarSize:54, numSize:32 },
      { rankIdx:2, medal:'🥉', platformH:26, avatarSize:40, numSize:20 },
    ];
    return (
      <div className={`card ${otherIds.length>0?'pGold':''}`}
        style={{...S.card,marginBottom:14,background:'linear-gradient(135deg,var(--card),var(--surf))'}}>
        <SecLabel>{t('dashboard.ranking')}</SecLabel>

        {/* ── Podium ── */}
        <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:4}}>
          {podiumSlots.map(({rankIdx,medal,platformH,avatarSize,numSize})=>{
            const s = rankRows[rankIdx];
            const isFirst = rankIdx===0;
            // Empty slot (group < 3 people)
            if(!s) return (
              <div key={rankIdx} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center'}}>
                <div style={{width:'100%',height:platformH,background:'var(--soft)',border:'1px dashed var(--brd)',borderBottom:'none',borderRadius:'6px 6px 0 0',opacity:.2}}/>
              </div>
            );
            const platBg = isFirst
              ? 'linear-gradient(180deg,var(--gold)26 0%,var(--gold)12 100%)'
              : rankIdx===1
                ? 'linear-gradient(180deg,rgba(180,185,210,.16) 0%,rgba(180,185,210,.07) 100%)'
                : 'linear-gradient(180deg,rgba(160,120,70,.14) 0%,rgba(160,120,70,.06) 100%)';
            const platBorder = isFirst ? 'var(--gold)55' : `${s.c}33`;
            const nameColor  = isFirst ? 'var(--gold)' : 'var(--txt)';
            const numColor   = isFirst ? 'var(--gold)' : s.c;
            return (
              <div key={s.id} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',minWidth:0}}>
                {/* Medal */}
                <div style={{fontSize:isFirst?16:13,lineHeight:1,marginBottom:5}}>{medal}</div>
                {/* Avatar */}
                <div style={{
                  width:avatarSize,height:avatarSize,borderRadius:'50%',
                  background:`${s.c}33`,
                  border:`2px solid ${isFirst?'var(--gold)':`${s.c}77`}`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:Math.round(avatarSize*.46),overflow:'hidden',position:'relative',flexShrink:0,
                  boxShadow:isFirst?'0 0 18px var(--gold)44,0 4px 14px rgba(0,0,0,.35)':'0 2px 8px rgba(0,0,0,.2)',
                  marginBottom:6,
                }}>
                  {s.p?.avatarUrl
                    ?<img src={s.p.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}/>
                    :(s.p?.avatar??'👤')}
                  {(s.streaks.winStreak>=3||s.streaks.lossStreak>=3)&&(
                    <div style={{position:'absolute',bottom:-4,right:-5,background:'var(--surf)',borderRadius:10,padding:'1px 3px',border:'1px solid var(--brd)',display:'flex',alignItems:'center'}}>
                      <StreakInline winStreak={s.streaks.winStreak} lossStreak={s.streaks.lossStreak} size={10}/>
                    </div>
                  )}
                </div>
                {/* Platform step */}
                <div style={{
                  width:'100%',height:platformH,
                  background:platBg,
                  border:`1px solid ${platBorder}`,
                  borderBottom:'none',
                  borderRadius:'6px 6px 0 0',
                  display:'flex',flexDirection:'column',
                  alignItems:'center',justifyContent:'center',
                  padding:'4px 4px 2px',gap:1,overflow:'hidden',
                }}>
                  <div style={{
                    fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',
                    fontSize:isFirst?13:11,fontWeight:700,color:nameColor,
                    whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'100%',lineHeight:1,
                  }}>
                    {s.p?.name}{s.isMe&&<span style={{color:'var(--gold)',marginLeft:2}}>·</span>}
                  </div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontWeight:900,fontSize:numSize,lineHeight:1,color:numColor}}>
                    {s.w}
                  </div>
                  <div style={{fontSize:7,color:isFirst?'var(--gold)':'var(--mut)',letterSpacing:'.18em',lineHeight:1}}>
                    {t('dashboard.wins').toUpperCase()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Floor */}
        <div style={{height:1,background:'var(--brd)',marginBottom:rest.length>0?10:14}}/>

        {/* 4th+ chip row */}
        {rest.length>0&&(
          <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:14}}>
            {rest.map(s=>(
              <div key={s.id} style={{
                display:'inline-flex',alignItems:'center',gap:5,
                padding:'3px 8px 3px 5px',borderRadius:20,
                background:'var(--soft)',border:'1px solid var(--brd)',
              }}>
                <span style={{fontSize:13,lineHeight:1}}>{s.p?.avatar??'👤'}</span>
                <span style={{fontFamily:"'Manrope',sans-serif",fontSize:11,color:'var(--dim)',fontWeight:600,maxWidth:60,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {s.p?.name?.split(' ')[0]??''}
                </span>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:900,color:s.c,lineHeight:1}}>{s.w}</span>
                <span style={{fontSize:7,color:'var(--dim)',letterSpacing:'.1em'}}>V</span>
              </div>
            ))}
          </div>
        )}

        {/* My stats strip */}
        <div style={{display:'flex',justifyContent:'center',gap:20,paddingTop:12,borderTop:'1px solid var(--brd)'}}>
          {[
            {l:t('dashboard.win_rate'),v:`${wr}%`,c:wr>=50?'var(--grn)':'var(--red)'},
            {l:t('dashboard.credits'),v:`${Math.round(credits[user]??0)} ₡`,c:'var(--gold)'},
            {l:t('dashboard.total_bets'),v:myWon.length+myLost.length+myAct.length+mySec.length,c:'var(--txt)'},
          ].map(s=>(
            <div key={s.l} style={{textAlign:'center'}}>
              <div style={{fontSize:16,fontWeight:700,color:s.c}}>{s.v}</div>
              <div style={{fontSize:10,color:'var(--dim)'}}>{s.l}</div>
            </div>
          ))}
        </div>

        {!other&&(
          <div style={{textAlign:'center',marginTop:14,paddingTop:14,borderTop:'1px solid var(--brd)'}}>
            <div style={{fontSize:12,color:'var(--dim)'}}>{t('dashboard.solo_hint')}</div>
          </div>
        )}

        {/* Report CTA */}
        <button
          onClick={() => setRankingOpen(true)}
          style={{
            marginTop:12, width:'100%', padding:'7px 0',
            background:'transparent', border:'1px solid var(--gold)33',
            borderRadius:8, cursor:'pointer',
            fontFamily:"'Manrope',sans-serif", fontSize:10, fontWeight:700,
            letterSpacing:'.2em', textTransform:'uppercase', color:'var(--gold)',
            WebkitTapHighlightColor:'transparent', touchAction:'manipulation',
          }}
        >
          Vedi report completo →
        </button>
      </div>
    );
  })();

  const vaultTeaser=mySec.length>0&&(
    <div
      onClick={onGoToVault}
      style={{
        ...S.card, marginBottom:14, border:"1px solid var(--gold)44",
        display:"flex", alignItems:"center", gap:10,
        cursor: onGoToVault ? 'pointer' : 'default',
        transition: 'all .18s',
      }}
      onMouseEnter={e => { if (onGoToVault) { e.currentTarget.style.background = 'var(--gold)10'; e.currentTarget.style.borderColor = 'var(--gold)88'; } }}
      onMouseLeave={e => { if (onGoToVault) { e.currentTarget.style.background = 'var(--card)';   e.currentTarget.style.borderColor = 'var(--gold)44'; } }}
    >
      <div style={{width:36,height:36,borderRadius:"50%",background:"var(--gold)22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🔒</div>
      <div style={{flex:1}}>
        <div style={{fontWeight:600,fontSize:14,color:"var(--gold)"}}>{t('dashboard.vault_teaser')}</div>
        <div style={{fontSize:12,color:"var(--dim)"}}>{mySec.length===1?t('dashboard.vault_teaser_one',{n:mySec.length}):t('dashboard.vault_teaser_many',{n:mySec.length})}</div>
      </div>
      {onGoToVault && <span style={{color:'var(--gold)',fontSize:14}}>➤</span>}
    </div>
  );

  const expiredAlert=expiredBets.length>0&&(
    <div style={{
      ...S.card, marginBottom:12,
      background:"var(--red)14",
      border:"1px solid var(--red)66",
      borderLeft:"4px solid var(--red)",
      borderRadius:10, padding:'12px 14px',
    }}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
        <span style={{fontSize:16}}>⏱</span>
        <div style={{fontWeight:700,fontSize:13,color:"var(--red)",letterSpacing:'.01em'}}>
          {t(expiredBets.length===1?'dashboard.expired_one':'dashboard.expired_many',{n:expiredBets.length})}
        </div>
      </div>
      {expiredBets.map(b=>(
        <div key={b.id} style={{
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
          padding:'6px 0', borderTop:'1px solid var(--red)22',
        }}>
          <div
            onClick={() => setBetListData({ title: b.title, accentColor:'var(--red)', bets:[b] })}
            style={{
              fontSize:12, color:"var(--txt)", fontWeight:500,
              flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              cursor:'pointer', textDecoration:'underline', textDecorationColor:'var(--red)55',
              WebkitTapHighlightColor:'transparent',
            }}
          >
            {b.title}
          </div>
          {onResolve && (() => {
            const isPendingResolve = pendingResolveIds?.has(b.id);
            return isPendingResolve
              ? <span style={{
                  flexShrink:0, padding:'4px 10px', borderRadius:999,
                  background:'var(--mut)22', border:'1px solid var(--mut)44',
                  color:'var(--mut)', fontSize:10, fontWeight:700,
                  letterSpacing:'.06em', textTransform:'uppercase',
                  fontFamily:"'Manrope',sans-serif", opacity:.55,
                }}>⏳ In invio…</span>
              : <button onClick={()=>onResolve(b)} style={{
                  flexShrink:0, padding:'4px 10px', borderRadius:999,
                  background:'var(--red)22', border:'1px solid var(--red)55',
                  color:'var(--red)', fontSize:10, fontWeight:700,
                  letterSpacing:'.06em', textTransform:'uppercase',
                  cursor:'pointer', fontFamily:"'Manrope',sans-serif",
                  WebkitTapHighlightColor:'transparent',
                }}>Dichiara</button>;
          })()}
        </div>
      ))}
    </div>
  );

  const expiryAlert=expiring.length>0&&(
    <div style={{
      ...S.card, marginBottom:12,
      background:"var(--gold)0e",
      border:"1px solid var(--gold)55",
      borderLeft:"4px solid var(--gold)",
      borderRadius:10, padding:'12px 14px',
    }}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
        <span style={{fontSize:16}}>⚡</span>
        <div style={{fontWeight:700,fontSize:13,color:"var(--gold)"}}>{t('dashboard.expiry',{n:expiring.length})}</div>
      </div>
      {expiring.map(b=>(
        <div key={b.id} style={{
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
          padding:'5px 0', borderTop:'1px solid var(--gold)22',
        }}>
          <div style={{fontSize:12,color:"var(--txt)",fontWeight:500,flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.title}</div>
          <div style={{fontSize:11,color:"var(--gold)",fontWeight:700,flexShrink:0}}>{tLeft(b.expiresAt,lang)}</div>
        </div>
      ))}
    </div>
  );

  const pendingSection=pendingBets.length>0&&(
    <>
      <SecLabel>{t('dashboard.pending')}</SecLabel>
      {pendingBets.map(b=><BetCard key={b.id} bet={b} user={user} profiles={profiles} cats={cats} onFlame={onFlame} isDesktop={isDesktop} reactions={reactions} onReaction={onReaction} onReactionPhoto={onReactionPhoto} can={can} onDelete={onDelete} onAccept={onAccept} onReject={onReject}/>)}
    </>
  );

  const activeBets=(myAct.length+thAct.length)>0&&(
    <>
      <SecLabel>{t('dashboard.active')}</SecLabel>
      {myAct.map(b=><BetCard key={b.id} bet={b} user={user} profiles={profiles} cats={cats} onResolve={onResolve} onFlame={onFlame} onCounter={onCounter} isDesktop={isDesktop} reactions={reactions} onReaction={onReaction} onReactionPhoto={onReactionPhoto} can={can} onDelete={onDelete} onEdit={onEdit} onConfirmOutcome={onConfirmOutcome} onWithdrawResolve={onWithdrawResolve} onOvertime={onOvertime} pendingResolve={pendingResolveIds?.has(b.id)}/>)}
      {thAct.map(b=><BetCard key={b.id} bet={b} user={user} profiles={profiles} cats={cats} onFlame={onFlame} onCounter={onCounter} isDesktop={isDesktop} reactions={reactions} onReaction={onReaction} onReactionPhoto={onReactionPhoto} can={can} onDelete={onDelete} onEdit={onEdit} onConfirmOutcome={onConfirmOutcome} onWithdrawResolve={onWithdrawResolve} onOvertime={onOvertime} pendingResolve={pendingResolveIds?.has(b.id)}/>)}
    </>
  );

  // Off-center empty state — a single gigantic italic banner at the left,
  // dice glyph floating to the upper right with a tilt, CTA pinned to the
  // bottom-right corner (asymmetric, never centered).
  const emptyState = myAct.length+thAct.length+mySec.length===0 && (
    <div style={{
      position:'relative',
      // Extra top padding gives the rotated dice corner room to breathe
      // — the previous overflow:hidden + top:-6 combo clipped the dice on
      // mobile (rotated 14deg means the corner sticks out further than
      // the bounding box).
      padding: isDesktop ? '48px 0 72px' : '40px 0 56px',
      minHeight: isDesktop ? 320 : 240,
      overflow:'visible',
    }}>
      {/* Dice — small, rotated, floats top-right. Easter egg #1: tapping
          opens the fullscreen roll overlay. The die itself stays still so
          the dashboard reads as clean editorial art, not a busy widget. */}
      <div
        onClick={onOpenDie}
        style={{
          position:'absolute',
          // Positive top + rotate(-14deg) keeps the whole die visible. We
          // also reserved padding-top on the parent so the dice has room
          // above the headline.
          top: isDesktop ? 12 : 6,
          right: isDesktop ? '14%' : '6%',
          opacity: .85,
          transform: 'rotate(-14deg)',
          animation: 'sUp .6s ease both .1s',
          userSelect: 'none',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <DieFace value={3} size={isDesktop ? 84 : 60}/>
      </div>

      {/* Gigantic banner — italic Cormorant, italic, breaks into two lines
          intentionally with the second line indented for a magazine pull-quote
          feel. */}
      <div style={{
        fontFamily:"'Cormorant Garamond',serif",
        fontStyle:'italic',
        fontWeight: 600,
        fontSize: 'clamp(56px, 16vw, 168px)',
        lineHeight: 0.9,
        letterSpacing:'-0.03em',
        color:'var(--txt)',
        marginLeft: isDesktop ? -10 : -4,
        marginBottom: 18,
      }}>
        <div>{t('dashboard.no_active').split(' ')[0] || t('dashboard.no_active')}</div>
        {t('dashboard.no_active').split(' ').slice(1).join(' ') && (
          <div style={{
            paddingLeft: isDesktop ? '22%' : '14%',
            color:'var(--gold)',
            marginTop: isDesktop ? -10 : -4,
          }}>{t('dashboard.no_active').split(' ').slice(1).join(' ')}</div>
        )}
      </div>

      {/* Subtitle — tiny tracked meta, far-left aligned */}
      <div className="bc-meta" style={{
        fontSize: 9,
        maxWidth: 340, lineHeight: 1.7,
        color:'var(--dim)',
        marginBottom: isDesktop ? 32 : 24,
        textTransform:'none', letterSpacing:'.02em', fontWeight:500,
        fontStyle:'normal',
      }}>{t('dashboard.no_active_sub')}</div>

      {/* CTA pinned bottom-right, never centered */}
      <div style={{
        textAlign: 'right',
        paddingRight: isDesktop ? 12 : 0,
        marginTop: 'auto',
      }}>
        <Btn variant="gold" onClick={onCreate}
          style={{padding: isDesktop ? '14px 36px' : '13px 28px', fontSize: isDesktop ? 13 : 12}}>
          {t('dashboard.cta')}
        </Btn>
      </div>
    </div>
  );

  const recentResolved = (() => {
    const all = bets.filter(b => b.creator === user && ['won','lost'].includes(b.status));
    if (all.length === 0) return false;
    // Always show the 3 newest. Sort by resolvedAt (fallback createdAt) so
    // newest sits on top — `.slice(-3).reverse()` only works if the source
    // is already chronological, which `bets` isn't guaranteed to be.
    const newest3 = [...all]
      .sort((a, b) => (b.resolvedAt || b.createdAt || 0) - (a.resolvedAt || a.createdAt || 0))
      .slice(0, 3);
    const hasMore = all.length > 3;
    return (
      <>
        <SecLabel mt={16}>{t('dashboard.recent')}</SecLabel>
        {newest3.map(b => (
          <BetCard key={b.id} bet={b} user={user} profiles={profiles} cats={cats} onFlame={onFlame} onCounter={onCounter} isDesktop={isDesktop} reactions={reactions} onReaction={onReaction} onReactionPhoto={onReactionPhoto} can={can} onDelete={onDelete} onEdit={onEdit}/>
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

  // Weekly ticker — compact two-row banner, shown only when ≥1 won bet this week
  const weeklyTicker = (topWinBet || craziestBet) && (() => {
    const weekNum = getISOWeek(new Date());
    const gain = topWinBet ? (topWinBet.potentialWin || 0) - (topWinBet.stake || 0) : 0;
    const prob = craziestBet ? Math.round(100 / Math.max(1, craziestBet.quota || 1)) : 0;
    const isDifferent = craziestBet && topWinBet && craziestBet.id !== topWinBet.id;
    const highlights = [topWinBet, isDifferent ? craziestBet : null].filter(Boolean);
    return (
      <div
        onClick={() => setBetListData({
          title: `🏅 Sett. ${weekNum} — Best of the week`,
          accentColor: 'var(--gold)',
          bets: highlights,
        })}
        style={{
          ...S.card, marginBottom: 12,
          background: 'var(--gold)0a', border: '1px solid var(--gold)33',
          borderLeft: '3px solid var(--gold)', borderRadius: 10, padding: '10px 12px',
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
        }}
      >
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

  // Hero greeting strip (welcome + balance + quick KPI)
  const myProfile = profiles[user] || {};
  const myColor = getC(profiles, user);
  const hour = new Date().getHours();
  const greeting = hour < 6 ? '🌙' : hour < 12 ? '☀️' : hour < 18 ? '👋' : '✨';
  const totalMy = myWon.length + myLost.length;

  // Desktop top-right "status spine" — fills the editorial empty space
  // beside the giant italic name. Three quick reads: streak, today's
  // group activity, latest visible bet title. All derived locally from
  // existing data — no extra API call.
  const myStreaks = currentStreaks(bets, user);
  const todayKey  = new Date().toDateString();
  const todayCount = bets.filter(b => new Date(b.createdAt).toDateString() === todayKey).length;
  const latestBet = [...bets]
    .filter(b => !b.isSecret && b.status === 'active')
    .sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  const fireLevel = Math.max(myStreaks.winStreak, myStreaks.lossStreak);
  const fireKind  = myStreaks.winStreak > myStreaks.lossStreak ? 'win' : 'loss';

  // Last 5 resolved bets (won/lost) for the W/L "form guide" trail under the
  // streak pill. Oldest-left, newest-right — same convention as football form.
  // We keep the full bet object (not just status) so each badge can open
  // a one-bet detail modal on tap.
  const lastFive = [...bets]
    .filter(b => b.creator === user && ['won','lost'].includes(b.status))
    .sort((a,b) => (a.resolvedAt || a.createdAt || 0) - (b.resolvedAt || b.createdAt || 0))
    .slice(-5);

  // 3-tap handler — triggers the matching egg overlay on the third tap within
  // 1.8s. Gated on a real ≥3 streak: easter eggs are a celebration of being
  // genuinely on fire (or genuinely cold), not a freebie after one result.
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

  // Streak hero block — the Duolingo move: 🔥/❄️ giant emoji + huge number,
  // sitting alongside the credit balance as a peer hero block, not a pill.
  // Tap-triple still opens the matching easter-egg overlay.
  const isWinStreak = fireKind === 'win';
  const isHotStreak = isWinStreak && fireLevel >= 5;
  const streakAccent = isWinStreak ? (isHotStreak ? 'var(--red)' : 'var(--gold)') : 'var(--blu)';

  const renderStreakHero = () => {
    // Streak hero proper — earned when the user is on a real 3+ run.
    if (fireLevel >= 3) {
      return (
        <div
          onClick={handleStreakTap}
          style={{
            position:'relative',
            display:'flex', alignItems:'center', gap: isDesktop ? 14 : 10,
            cursor:'pointer', userSelect:'none',
            WebkitTapHighlightColor:'transparent', touchAction:'manipulation',
            padding: '6px 10px', borderRadius: 16,
            boxShadow: streakTapCount > 0 ? `0 0 0 2px ${streakAccent}66` : 'none',
            transition:'box-shadow .2s',
            alignSelf: isDesktop ? 'flex-end' : 'flex-start',
          }}>
          <span key={streakPulseKey} style={{
            fontSize: isDesktop ? 84 : 64, lineHeight: 1,
            display:'inline-block',
            animation: streakPulseKey > 0 ? 'bcStreakTap .35s cubic-bezier(.3,1.6,.5,1) both' : 'none',
            filter: `drop-shadow(0 6px 22px ${streakAccent}66)`,
          }}>
            {isWinStreak ? '🔥' : '❄️'}
          </span>
          <div style={{display:'flex', flexDirection:'column'}}>
            <div className="bc-num" style={{
              fontSize: 'clamp(48px, 11vw, 92px)',
              color: streakAccent, lineHeight: .92,
            }}>{fireLevel}</div>
            <div className="bc-meta" style={{marginTop:6, fontSize:8}}>
              — {isWinStreak ? t('dashboard_extra.streak_wins') : t('dashboard_extra.streak_losses')}
            </div>
          </div>
          {streakTapCount > 0 && (
            <span style={{
              position:'absolute', top: 4, right: 4,
              fontSize: 10, fontWeight: 800, color: streakAccent,
              fontFamily:"'Manrope',sans-serif", letterSpacing:'.1em',
            }}>{streakTapCount}/3</span>
          )}
        </div>
      );
    }

    // Below threshold: on mobile leave the area empty (stack collapses
    // cleanly). On desktop, where credits float to the right and the
    // left half of the hero row looks barren, drop in a subdued
    // "Inizia una serie..." line so the composition stays balanced.
    if (!isDesktop) return null;
    return (
      <div style={{
        alignSelf: 'flex-end',
        display: 'flex', flexDirection: 'column', gap: 6,
        opacity: 0.55,
      }}>
        <span aria-hidden style={{
          fontSize: 40, lineHeight: 1,
          filter: 'grayscale(.4)',
        }}>🔥</span>
        <span style={{
          fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
          fontSize: 16, fontWeight: 500, color: 'var(--dim)',
          maxWidth: 260, lineHeight: 1.35,
        }}>{t('dashboard_extra.streak_fallback')}</span>
      </div>
    );
  };

  // Form trail W/L — full-width strip with big badges, sits ABOVE the rule
  // that separates the hero from the KPI cells. Mirrors the FotMob/FIFA
  // form-guide layout (oldest left → newest right with glow halo).
  const renderFormTrail = () => {
    if (lastFive.length === 0) return null;
    return (
      <div style={{
        display:'flex', alignItems:'center', gap: 14,
        marginTop: isDesktop ? 28 : 22,
        paddingTop: 16, paddingRight: isDesktop ? 24 : 8,
        borderTop: '1px solid var(--rule)',
      }}>
        <span className="bc-meta" style={{fontSize: 8, flexShrink: 0}}>
          — {t('dashboard_extra.trail_label')}
        </span>
        <span style={{display:'flex', gap: isDesktop ? 8 : 6, marginLeft: 'auto'}}>
          {lastFive.map((b, i) => {
            const won = b.status === 'won';
            const badgeBg = won ? 'var(--grn)' : 'var(--red)';
            const isLatest = i === lastFive.length - 1;
            const fade = lastFive.length === 1 ? 1
              : 0.55 + (i / (lastFive.length - 1)) * 0.45;
            const dim = isDesktop ? 42 : 34;
            return (
              <button key={b.id || i}
                onClick={() => setBetListData({
                  title: won ? t('comment.won') : t('comment.lost'),
                  accentColor: badgeBg,
                  bets: [b],
                })}
                aria-label={`${won ? 'Vittoria' : 'Sconfitta'}: ${b.title}`}
                style={{
                  width: dim, height: dim, borderRadius: 8,
                  background: badgeBg, border: 'none', padding: 0,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:"'Manrope',sans-serif",
                  fontSize: isDesktop ? 18 : 15, fontWeight: 800,
                  color:'#fff', cursor: 'pointer',
                  opacity: fade,
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

  // Sub-hero row — OGGI count + LIVE bet title. One step down in scale from
  // the STREAK + BALANCE hero, but still big enough to read as part of the
  // hero composition. Sits below the form trail.
  const renderSubHero = () => {
    if (todayCount === 0 && !latestBet) return null;
    return (
      <div style={{
        display:'flex', alignItems:'baseline',
        gap: isDesktop ? 28 : 18,
        marginTop: isDesktop ? 22 : 18,
        paddingRight: isDesktop ? 24 : 8,
        flexWrap:'wrap',
      }}>
        {todayCount > 0 && (
          <div style={{display:'flex', alignItems:'baseline', gap: 8, flexShrink: 0}}>
            <span className="bc-num" style={{
              fontSize: 'clamp(28px, 4vw, 38px)',
              color:'var(--txt)', lineHeight: 1,
            }}>{todayCount}</span>
            <span className="bc-meta" style={{fontSize: 8}}>OGGI · GRUPPO</span>
          </div>
        )}
        {/* Daily-activity streak — sits next to OGGI on the sub-hero row.
            Only surfaces at ≥2 consecutive days so it feels earned. */}
        {(() => {
          const days = computeStreak(bets, user);
          if (days < 2) return null;
          return (
            <div style={{display:'flex', alignItems:'baseline', gap: 8, flexShrink: 0}}
              title={t('dashboard_extra.daily_streak_tooltip', { n: days })}>
              <span style={{ fontSize: 'clamp(22px, 3vw, 28px)', lineHeight: 1, flexShrink: 0 }} aria-hidden>📅</span>
              <span className="bc-num" style={{
                fontSize: 'clamp(28px, 4vw, 38px)',
                color:'var(--gold)', lineHeight: 1,
              }}>{days}</span>
              <span className="bc-meta" style={{fontSize: 8}}>{t('dashboard_extra.daily_streak_label')}</span>
            </div>
          );
        })()}
        {latestBet && (
          <div style={{
            display:'flex', alignItems:'baseline', gap: 10,
            flex: 1, minWidth: 0,
          }}>
            <span style={{
              fontSize: 9, color:'var(--gold)', fontWeight: 800,
              letterSpacing: '.22em', flexShrink: 0,
              fontFamily:"'Manrope',sans-serif",
            }}>LIVE →</span>
            <span style={{
              fontFamily:"'Cormorant Garamond',serif",
              fontStyle: 'italic',
              fontSize: 'clamp(16px, 2vw, 24px)',
              color:'var(--gold)',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
              flex: 1, minWidth: 0, lineHeight: 1.15,
            }}>"{latestBet.title}"</span>
          </div>
        )}
      </div>
    );
  };
  // Duolingo-hero composition: greeting → giant NAME → hero row with
  // STREAK + BALANCE side by side (stacked on mobile) → full-width form
  // trail → sub-hero row (OGGI + LIVE) → existing KPI strip. The streak
  // is no longer a side-pill; it's a peer of the credit balance.
  const hero = (
    <div style={{
      position:'relative',
      padding: isDesktop ? '40px 0 56px' : '24px 0 36px',
      marginBottom: 8,
      marginLeft: isDesktop ? -12 : -6,
    }}>
      <div className="bc-meta" style={{
        marginBottom: 14,
        paddingLeft: isDesktop ? 64 : 28,
        opacity: .85,
      }}>
        {greeting} {t('app.welcome_back')}
      </div>
      <div className="bc-hero" style={{
        fontSize: 'clamp(64px, 18vw, 180px)',
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
        // Slight overlap with the hero row below — keeps the broken-grid
        // editorial feel that was here before.
        marginBottom: isDesktop ? -12 : -6,
      }}>
        {myProfile.name}
      </div>

      {/* Hero row — STREAK (left/top) + BALANCE (right/bottom). Desktop:
          horizontal, baseline aligned. Mobile: stacked. If there's no
          streak yet the row collapses to just the balance, still right-
          aligned (no layout shift). */}
      <div style={{
        display:'flex',
        flexDirection: isDesktop ? 'row' : 'column',
        alignItems: isDesktop ? 'flex-end' : 'stretch',
        justifyContent: 'space-between',
        gap: isDesktop ? 32 : 14,
        marginTop: isDesktop ? 32 : 22,
        paddingRight: isDesktop ? 24 : 8,
      }}>
        {renderStreakHero()}
        <div style={{
          display:'flex', flexDirection:'column', alignItems:'flex-end',
          marginLeft: 'auto',
        }}>
          <div className="bc-num" style={{
            fontSize: 'clamp(48px, 11vw, 92px)',
            color:'var(--gold)',
            lineHeight: .92,
          }}>
            {Math.round(credits[user] ?? 0)}<span style={{fontSize:'0.45em', color:'var(--dim)', marginLeft:6, fontWeight:400}}>₡</span>
          </div>
          <div className="bc-meta" style={{marginTop:6, fontSize:8}}>
            — {t('app.credits')}
          </div>
        </div>
      </div>

      {/* Form trail — full-width W/L strip */}
      {renderFormTrail()}

      {/* Sub-hero — OGGI + LIVE */}
      {renderSubHero()}
      {/* Quick stats — staggered vertically AND horizontally inside each
          cell: every cell sits in a different spot (anchor + nudge) so the
          row reads as a deliberately broken grid instead of a flush-left
          rack. */}
      {totalMy > 0 && (() => {
        const cells = [
          {l:t('stats_view.won'),   v:myWon.length,  c:'var(--grn)'},
          {l:t('stats_view.lost'),  v:myLost.length, c:'var(--red)'},
          {l:t('stats_view.win_rate'), v:`${wr}%`,   c: wr>=50 ? 'var(--grn)' : 'var(--red)'},
          {l:t('dashboard.total_bets'), v:totalMy + myAct.length + mySec.length, c:'var(--gold)'},
        ];
        // Vertical stagger — keeps the "movement" the user liked.
        const yOffsets = isDesktop ? [0, 22, 8, 30] : [0, 14, 4, 18];
        // Per-cell horizontal anchor: each one sits in a different spot
        // inside its column instead of being flush-left. Order chosen so the
        // row scans as: anchor-left → center-tilt → right-perch → center-drop.
        const anchors  = ['flex-start', 'center', 'flex-end', 'center'];
        const aligns   = ['left',       'center', 'right',    'center'];
        // Small horizontal nudges so "center" cells don't feel mathematically
        // perfect — keep the asymmetric editorial feel.
        const nudges   = isDesktop ? [0, -6, 0, 10] : [0, -3, 0, 6];
        return (
          <div style={{
            display:'flex', gap:0, marginTop: isDesktop ? 44 : 28,
            paddingTop:18, borderTop:'1px solid var(--rule)',
            alignItems:'flex-start',
          }}>
            {cells.map((s, idx) => (
              <div key={s.l} style={{
                flex:1, minWidth:0,
                paddingTop: yOffsets[idx],
                paddingLeft: 6, paddingRight: 6,
                display:'flex', flexDirection:'column',
                alignItems: anchors[idx],
                textAlign: aligns[idx],
                transform: `translateX(${nudges[idx]}px)`,
                borderLeft: idx === 0 ? 'none' : '1px solid var(--rule)',
              }}>
                <div className="bc-num" style={{fontSize: 'clamp(22px, 5vw, 34px)', color:s.c, lineHeight:1}}>{s.v}</div>
                <div className="bc-meta" style={{marginTop:6, fontSize:8}}>{s.l}</div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );

  return(
    <div className="sUp">
      {hero}
      {/* Monthly summary banner */}
      {showSummary&&(
        <div style={{...S.card,marginBottom:12,background:"var(--gold)11",border:"1px solid var(--gold)44",position:"relative"}}>
          <div style={{fontWeight:700,fontSize:14,color:"var(--gold)",marginBottom:6}}>📊 {months[prevMonth]} {prevYear}</div>
          <div style={{fontSize:13,color:"var(--txt)",marginBottom:4}}>{profiles[user]?.name} {myPrevWins.length}V / {profiles[other]?.name} {otPrevWins.length}V</div>
          {bestBet&&<div style={{fontSize:12,color:"var(--dim)",marginBottom:2}}>{t('dashboard.best_bet')} <span style={{color:"var(--gold)"}}>{bestBet.title} @ {parseFloat(bestBet.quota).toFixed(2)}×</span></div>}
          <div style={{fontSize:12,color:netProfit>=0?"var(--grn)":"var(--red)"}}>{t('dashboard.net_profit',{name:profiles[user]?.name})} {netProfit>=0?'+':''}{netProfit} ₡</div>
          <button onClick={()=>{localStorage.setItem(prevMonthKey,'1');setSummaryDismissed(true);}} style={{position:"absolute",top:10,right:10,background:"transparent",border:"none",cursor:"pointer",fontSize:16,color:"var(--dim)"}}>✕</button>
        </div>
      )}

      {/* Partner notification — click to see those bets, ✕ to dismiss */}
      {newPart>0&&(()=>{
        const creators=[...new Set(newPartBets.map(b=>b.creator))];
        const singleCreator=creators.length===1?creators[0]:null;
        const displayName=singleCreator?profiles[singleCreator]?.name:`${newPart} ${t('dashboard.notif_many',{n:newPart})}`;
        const displayAvatar=singleCreator?profiles[singleCreator]?.avatar:'🎯';
        return(
        <div
          onClick={() => { setBetListData({ title: `${singleCreator?profiles[singleCreator]?.name:'Nuove bet'} — ${newPart===1?t('dashboard.notif_one'):t('dashboard.notif_many',{n:newPart})}`, accentColor:'var(--gold)', bets:newPartBets }); onNotifSeen?.(); }}
          style={{...S.card,marginBottom:12,background:`var(--gold)14`,border:"1px solid var(--gold)44",display:"flex",alignItems:"center",gap:10,cursor:"pointer",position:"relative",WebkitTapHighlightColor:"transparent"}}
        >
          <span style={{fontSize:22}}>{displayAvatar}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:600,fontSize:13,color:"var(--gold)"}}>{displayName} {newPart===1?t('dashboard.notif_one'):''}</div>
            <div style={{fontSize:11,color:"var(--dim)"}}>{t('dashboard.notif_sub')} · <span style={{color:'var(--gold)',fontWeight:600}}>Vedi →</span></div>
          </div>
          <button
            onClick={e=>{ e.stopPropagation(); onNotifSeen?.(); }}
            aria-label="Chiudi"
            style={{background:"transparent",border:"none",cursor:"pointer",color:"var(--dim)",fontSize:16,padding:"4px 6px",flexShrink:0,lineHeight:1}}
          >✕</button>
        </div>
        );
      })()}

      {isDesktop?(
        <div style={{display:"grid",gridTemplateColumns:"minmax(0, 1.6fr) minmax(280px, 1fr)",gap:14,alignItems:"start"}}>
          <div style={{display:'flex', flexDirection:'column', gap:10}}>{pendingSection}{activeBets}{emptyState}{recentResolved}</div>
          <div style={{display:'flex', flexDirection:'column', gap:10, position:'sticky', top:14}}>{scoreCard}{vaultTeaser}{weeklyTicker}{expiredAlert}{expiryAlert}</div>
        </div>
      ):(
        <>{weeklyTicker}{expiredAlert}{expiryAlert}{scoreCard}{vaultTeaser}{pendingSection}{activeBets}{emptyState}{recentResolved}</>
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
