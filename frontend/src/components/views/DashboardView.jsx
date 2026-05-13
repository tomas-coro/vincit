import React, { useState } from 'react';

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

export default function DashboardView({user,profiles,groupMembers,credits,bets,cats,onCreate,onResolve,onReveal,onCounter,onFlame,notifSince,isDesktop,reactions,onReaction,onReactionPhoto,onDelete,onEdit,onAccept,onReject,can,onGoToVault,onConfirmOutcome,onWithdrawResolve,onOvertime,onEggUnlock,onOpenDie}){
  const { t, lang } = useLang();
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
  const myAct=bets.filter(b=>b.creator===user&&!b.isSecret&&['active','expired'].includes(b.status));
  const pendingBets=bets.filter(b=>b.status==='pending'&&(b.creator===user||b.opponent===user));
  const mySec=bets.filter(b=>b.creator===user&&b.isSecret&&b.status==="active");
  const thAct=bets.filter(b=>otherIds.includes(b.creator)&&!b.isSecret&&b.status==="active");
  const newPart=bets.filter(b=>otherIds.includes(b.creator)&&!b.isSecret&&b.createdAt>(notifSince[user]||0)).length;
  const expiring=bets.filter(b=>b.creator===user&&b.status==="active"&&isSoon(b.expiresAt));
  const expiredBets=bets.filter(b=>b.creator===user&&b.status==="expired");
  const wr=(myWon.length+myLost.length)?Math.round(myWon.length/(myWon.length+myLost.length)*100):0;

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

  const scoreCard=(
    <div className={`card ${otherIds.length>0 ? 'pGold' : ''}`} style={{...S.card,marginBottom:14,background:"linear-gradient(135deg,var(--card),var(--surf))"}}>
      <SecLabel>{t('dashboard.ranking')}</SecLabel>
      <div style={{display:"flex",alignItems:"flex-start",gap:8,overflowX:"auto",paddingBottom:rankRows.length>3?6:0}}>
        {rankRows.map((s,i)=>(
          <div key={s.id} style={{flex:"1 0 22%", minWidth:78, textAlign:"center"}}>
            {(() => {
              const isLeader = i === 0 && rankRows.length > 1 && s.w > 0;
              return (
                <div className={isLeader ? 'pGold' : ''} style={{
                  position:"relative", width:48, height:48, borderRadius:"50%",
                  background:`${s.c}33`,
                  border: isLeader ? '2px solid var(--gold)' : `2px solid ${s.c}66`,
                  padding: isLeader ? 1 : 0,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:26, margin:"0 auto", overflow:"hidden",
                }}>
                  {s.p?.avatarUrl
                    ? <img src={s.p.avatarUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:'50%'}}/>
                    : (s.p?.avatar ?? '')}
                  {(s.streaks.winStreak >= 3 || s.streaks.lossStreak >= 3) && (
                    <div style={{position:'absolute', bottom:-4, right:-6,
                      background:'var(--surf)', borderRadius:10, padding:'1px 4px',
                      border:'1px solid var(--brd)', display:'flex', alignItems:'center'}}>
                      <StreakInline winStreak={s.streaks.winStreak} lossStreak={s.streaks.lossStreak} size={13}/>
                    </div>
                  )}
                </div>
              );
            })()}
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:13,fontWeight:700,marginTop:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              {s.p?.name}{s.isMe && <span style={{color:"var(--gold)",marginLeft:3}}>·</span>}
            </div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:900,color:i===0?"var(--gold)":s.c,lineHeight:1.1}}>{s.w}</div>
            <div style={{fontSize:10,color:"var(--dim)"}}>{t('dashboard.wins')}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:20,marginTop:12,paddingTop:12,borderTop:"1px solid var(--brd)"}}>
        {[{l:t('dashboard.win_rate'),v:`${wr}%`,c:wr>=50?"var(--grn)":"var(--red)"},{l:t('dashboard.credits'),v:`${Math.round(credits[user] ?? 0)} ₡`,c:"var(--gold)"},{l:t('dashboard.total_bets'),v:myWon.length+myLost.length+myAct.length+mySec.length,c:"var(--txt)"}].map(s=>(
          <div key={s.l} style={{textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:700,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:"var(--dim)"}}>{s.l}</div>
          </div>
        ))}
      </div>
      {(()=>{
        const myStreak=computeStreak(bets,user);
        const thStreak=computeStreak(bets,other);
        return myStreak>0||thStreak>0?(
          <div style={{display:'flex',justifyContent:'space-around',marginTop:10,paddingTop:10,borderTop:'1px solid var(--brd)'}}>
            {[{u:user,s:myStreak},{u:other,s:thStreak}].map(({u,s})=>(
              <div key={u} style={{textAlign:'center'}}>
                <div style={{fontSize:18}}>🔥</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:s>=7?'var(--red)':s>=3?'var(--gold)':'var(--txt)'}}>{s}</div>
                <div style={{fontSize:10,color:'var(--dim)',letterSpacing:1}}>{t('dashboard.streak')}</div>
              </div>
            ))}
          </div>
        ):null;
      })()}
      {!other && (
        <div style={{textAlign:'center',marginTop:14,paddingTop:14,borderTop:'1px solid var(--brd)'}}>
          <div style={{fontSize:12,color:'var(--dim)'}}>{t('dashboard.solo_hint')}</div>
        </div>
      )}
    </div>
  );

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
    <div style={{...S.card,marginBottom:12,background:"var(--red)18",border:"1px solid var(--red)44"}}>
      <div style={{fontWeight:600,fontSize:13,color:"var(--red)",marginBottom:4}}>{t(expiredBets.length===1?'dashboard.expired_one':'dashboard.expired_many',{n:expiredBets.length})}</div>
      {expiredBets.map(b=><div key={b.id} style={{fontSize:12,color:"var(--dim)",marginTop:2}}>· {b.title}</div>)}
    </div>
  );

  const expiryAlert=expiring.length>0&&(
    <div style={{...S.card,marginBottom:12,background:"var(--red)18",border:"1px solid var(--red)44"}}>
      <div style={{fontWeight:600,fontSize:13,color:"var(--red)",marginBottom:4}}>{t('dashboard.expiry',{n:expiring.length})}</div>
      {expiring.map(b=><div key={b.id} style={{fontSize:12,color:"var(--dim)",marginTop:2}}>· {b.title} — {tLeft(b.expiresAt,lang)}</div>)}
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
      {myAct.map(b=><BetCard key={b.id} bet={b} user={user} profiles={profiles} cats={cats} onResolve={onResolve} onFlame={onFlame} onCounter={onCounter} isDesktop={isDesktop} reactions={reactions} onReaction={onReaction} onReactionPhoto={onReactionPhoto} can={can} onDelete={onDelete} onEdit={onEdit} onConfirmOutcome={onConfirmOutcome} onWithdrawResolve={onWithdrawResolve} onOvertime={onOvertime}/>)}
      {thAct.map(b=><BetCard key={b.id} bet={b} user={user} profiles={profiles} cats={cats} onFlame={onFlame} onCounter={onCounter} isDesktop={isDesktop} reactions={reactions} onReaction={onReaction} onReactionPhoto={onReactionPhoto} can={can} onDelete={onDelete} onEdit={onEdit} onConfirmOutcome={onConfirmOutcome} onWithdrawResolve={onWithdrawResolve} onOvertime={onOvertime}/>)}
    </>
  );

  // Off-center empty state — a single gigantic italic banner at the left,
  // dice glyph floating to the upper right with a tilt, CTA pinned to the
  // bottom-right corner (asymmetric, never centered).
  const emptyState = myAct.length+thAct.length+mySec.length===0 && (
    <div style={{
      position:'relative',
      padding: isDesktop ? '40px 0 72px' : '24px 0 56px',
      minHeight: isDesktop ? 320 : 240,
      // Hide any overflow from the floating dice/banner.
      overflow:'hidden',
    }}>
      {/* Dice — small, rotated, floats top-right. Easter egg #1: tapping
          opens the fullscreen roll overlay. The die itself stays still so
          the dashboard reads as clean editorial art, not a busy widget. */}
      <div
        onClick={onOpenDie}
        style={{
          position:'absolute',
          top: isDesktop ? 8 : -6,
          right: isDesktop ? '14%' : '8%',
          opacity: .85,
          transform: 'rotate(-14deg)',
          animation: 'sUp .6s ease both .1s',
          userSelect: 'none',
          // Intentionally no cursor:pointer / hover effect — discoverability
          // is the easter egg's job.
        }}
      >
        <DieFace value={3} size={isDesktop ? 84 : 64}/>
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

  const recentResolved=bets.filter(b=>b.creator===user&&["won","lost"].includes(b.status)).length>0&&(
    <>
      <SecLabel mt={16}>{t('dashboard.recent')}</SecLabel>
      {bets.filter(b=>b.creator===user&&["won","lost"].includes(b.status)).slice(-3).reverse().map(b=>(
        <BetCard key={b.id} bet={b} user={user} profiles={profiles} cats={cats} onFlame={onFlame} onCounter={onCounter} isDesktop={isDesktop} reactions={reactions} onReaction={onReaction} onReactionPhoto={onReactionPhoto} can={can} onDelete={onDelete} onEdit={onEdit}/>
      ))}
    </>
  );

  // Hero greeting strip (welcome + balance + quick KPI)
  const myProfile = profiles[user] || {};
  const myColor = getC(profiles, user);
  const hour = new Date().getHours();
  const greeting = hour < 6 ? '🌙' : hour < 12 ? '☀️' : hour < 18 ? '👋' : '✨';
  const totalMy = myWon.length + myLost.length;
  // Broken-grid hero — name escapes its grid cell, credit balance floats
  // diagonally below to the right with a deliberate stagger, KPI strip below
  // skews each cell vertically so it never reads as a clean grid.
  const hero = (
    <div style={{
      position:'relative',
      padding: isDesktop ? '40px 0 56px' : '24px 0 36px',
      marginBottom: 8,
      // Allow the giant name to bleed left a hair without triggering scroll;
      // the App.jsx wrapper now has overflow-x: hidden to catch slop.
      marginLeft: isDesktop ? -12 : -6,
    }}>
      <div className="bc-meta" style={{
        marginBottom: 16,
        paddingLeft: isDesktop ? 64 : 28,
        opacity: .85,
      }}>
        {greeting} {t('app.welcome_back')}
      </div>
      <div className="bc-hero" style={{
        fontSize: 'clamp(64px, 18vw, 180px)',
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
        // Pull baseline slightly down so the next block (credit) overlaps it.
        marginBottom: isDesktop ? -28 : -16,
      }}>
        {myProfile.name}
      </div>
      {/* Credit balance — drifts right + drops below the name, intentionally
          breaking the horizontal axis. Tracked meta sits beneath, not above,
          so the giant number leads. */}
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'flex-end',
        paddingRight: isDesktop ? 24 : 8,
        marginTop: 0,
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
      {/* Quick stats — staggered vertically: each cell at a different y. */}
      {totalMy > 0 && (() => {
        const cells = [
          {l:t('stats_view.won'),   v:myWon.length,  c:'var(--grn)'},
          {l:t('stats_view.lost'),  v:myLost.length, c:'var(--red)'},
          {l:t('stats_view.win_rate'), v:`${wr}%`,   c: wr>=50 ? 'var(--grn)' : 'var(--red)'},
          {l:t('dashboard.total_bets'), v:totalMy + myAct.length + mySec.length, c:'var(--gold)'},
        ];
        // Stagger offsets — never identical, never centered.
        const yOffsets = isDesktop ? [0, 22, 8, 30] : [0, 14, 4, 18];
        const indents  = isDesktop ? [0, 8, 32, 4]  : [0, 4, 16, 2];
        return (
          <div style={{
            display:'flex', gap:0, marginTop: isDesktop ? 44 : 28,
            paddingTop:18, borderTop:'1px solid var(--rule)',
            alignItems:'flex-start',
          }}>
            {cells.map((s, idx) => (
              <div key={s.l} style={{
                flex:1,
                paddingLeft: idx === 0 ? 0 : indents[idx],
                paddingTop: yOffsets[idx],
                textAlign: idx === 0 ? 'left' : 'left',
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

      {/* Partner notification */}
      {newPart>0&&(
        <div style={{...S.card,marginBottom:12,background:`var(--gold)14`,border:"1px solid var(--gold)44",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>{profiles[other]?.avatar}</span>
          <div>
            <div style={{fontWeight:600,fontSize:13,color:"var(--gold)"}}>{profiles[other]?.name} {newPart===1?t('dashboard.notif_one'):t('dashboard.notif_many',{n:newPart})}</div>
            <div style={{fontSize:11,color:"var(--dim)"}}>{t('dashboard.notif_sub')}</div>
          </div>
        </div>
      )}

      {isDesktop?(
        <div style={{display:"grid",gridTemplateColumns:"minmax(0, 1.6fr) minmax(280px, 1fr)",gap:14,alignItems:"start"}}>
          <div style={{display:'flex', flexDirection:'column', gap:10}}>{pendingSection}{activeBets}{emptyState}{recentResolved}</div>
          <div style={{display:'flex', flexDirection:'column', gap:10, position:'sticky', top:14}}>{scoreCard}{vaultTeaser}{expiredAlert}{expiryAlert}</div>
        </div>
      ):(
        <>{expiredAlert}{expiryAlert}{scoreCard}{vaultTeaser}{pendingSection}{activeBets}{emptyState}{recentResolved}</>
      )}
    </div>
  );
}
