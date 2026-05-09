import React from 'react';

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

const S = {
  card: {background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:16},
  row: {display:"flex",alignItems:"center",gap:10},
};

export default function DashboardView({user,profiles,credits,bets,cats,onCreate,onResolve,onReveal,onCounter,onFlame,notifSince,isDesktop,reactions,onReaction,onDelete,onEdit,onAccept,onReject}){
  const { t, lang } = useLang();
  const other=Object.keys(profiles).find(k=>k!==user)??null;
  const myWon=bets.filter(b=>b.creator===user&&b.status==="won");
  const myLost=bets.filter(b=>b.creator===user&&b.status==="lost");
  const thWon=bets.filter(b=>b.creator===other&&b.status==="won");
  const myAct=bets.filter(b=>b.creator===user&&!b.isSecret&&['active','expired'].includes(b.status));
  const pendingBets=bets.filter(b=>b.status==='pending'&&(b.creator===user||b.opponent===user));
  const mySec=bets.filter(b=>b.creator===user&&b.isSecret&&b.status==="active");
  const thAct=bets.filter(b=>b.creator===other&&!b.isSecret&&b.status==="active");
  const newPart=bets.filter(b=>b.creator===other&&!b.isSecret&&b.createdAt>(notifSince[user]||0)).length;
  const expiring=bets.filter(b=>b.creator===user&&b.status==="active"&&isSoon(b.expiresAt));
  const expiredBets=bets.filter(b=>b.creator===user&&b.status==="expired");
  const wr=(myWon.length+myLost.length)?Math.round(myWon.length/(myWon.length+myLost.length)*100):0;
  const meC=getC(profiles,user); const otC=other?getC(profiles,other):"#5b8af0";

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
    <div className="card pGold" style={{...S.card,marginBottom:14,background:"linear-gradient(135deg,var(--card),var(--surf))"}}>
      <SecLabel>{t('dashboard.ranking')}</SecLabel>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {[{k:user,p:profiles[user],c:meC,w:myWon.length},...(other?[{k:other,p:profiles[other],c:otC,w:thWon.length}]:[])].map((s,i)=>(
          <div key={s.k} style={{flex:1,textAlign:"center"}}>
            <div style={{width:44,height:44,borderRadius:"50%",background:`${s.c}33`,border:`2px solid ${s.c}66`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto"}}>{s.p?.avatar}</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,marginTop:6}}>{s.p?.name}</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:900,color:i===0?"var(--gold)":s.c,lineHeight:1.1}}>{s.w}</div>
            <div style={{fontSize:10,color:"var(--dim)"}}>{t('dashboard.wins')}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:20,marginTop:12,paddingTop:12,borderTop:"1px solid var(--brd)"}}>
        {[{l:t('dashboard.win_rate'),v:`${wr}%`,c:wr>=50?"var(--grn)":"var(--red)"},{l:t('dashboard.credits'),v:`${Math.round(credits[user])} ₡`,c:"var(--gold)"},{l:t('dashboard.total_bets'),v:myWon.length+myLost.length+myAct.length+mySec.length,c:"var(--txt)"}].map(s=>(
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
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:s>=7?'var(--red)':s>=3?'var(--gold)':'var(--txt)'}}>{s}</div>
                <div style={{fontSize:10,color:'var(--dim)',letterSpacing:1}}>{t('dashboard.streak')}</div>
              </div>
            ))}
          </div>
        ):null;
      })()}
    </div>
  );

  const vaultTeaser=mySec.length>0&&(
    <div style={{...S.card,marginBottom:14,border:"1px solid var(--gold)44",display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:36,height:36,borderRadius:"50%",background:"var(--gold)22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🔒</div>
      <div>
        <div style={{fontWeight:600,fontSize:14,color:"var(--gold)"}}>{t('dashboard.vault_teaser')}</div>
        <div style={{fontSize:12,color:"var(--dim)"}}>{mySec.length===1?t('dashboard.vault_teaser_one',{n:mySec.length}):t('dashboard.vault_teaser_many',{n:mySec.length})}</div>
      </div>
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
      {pendingBets.map(b=><BetCard key={b.id} bet={b} user={user} profiles={profiles} cats={cats} onFlame={onFlame} isDesktop={isDesktop} reactions={reactions} onReaction={onReaction} onDelete={onDelete} onAccept={onAccept} onReject={onReject}/>)}
    </>
  );

  const activeBets=(myAct.length+thAct.length)>0&&(
    <>
      <SecLabel>{t('dashboard.active')}</SecLabel>
      {myAct.map(b=><BetCard key={b.id} bet={b} user={user} profiles={profiles} cats={cats} onResolve={onResolve} onFlame={onFlame} onCounter={onCounter} isDesktop={isDesktop} reactions={reactions} onReaction={onReaction} onDelete={onDelete} onEdit={onEdit}/>)}
      {thAct.map(b=><BetCard key={b.id} bet={b} user={user} profiles={profiles} cats={cats} onFlame={onFlame} onCounter={onCounter} isDesktop={isDesktop} reactions={reactions} onReaction={onReaction} onDelete={onDelete} onEdit={onEdit}/>)}
    </>
  );

  const emptyState=myAct.length+thAct.length+mySec.length===0&&(
    <div style={{textAlign:"center",padding:"52px 20px"}}>
      <div style={{fontSize:52,marginBottom:14}}>🎲</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,marginBottom:8}}>{t('dashboard.no_active')}</div>
      <div style={{fontSize:13,color:"var(--dim)",marginBottom:24}}>{t('dashboard.no_active_sub')}</div>
      <Btn variant="gold" onClick={onCreate} style={{padding:"12px 28px",fontSize:15}}>{t('dashboard.cta')}</Btn>
    </div>
  );

  const recentResolved=bets.filter(b=>b.creator===user&&["won","lost"].includes(b.status)).length>0&&(
    <>
      <SecLabel mt={16}>{t('dashboard.recent')}</SecLabel>
      {bets.filter(b=>b.creator===user&&["won","lost"].includes(b.status)).slice(-3).reverse().map(b=>(
        <BetCard key={b.id} bet={b} user={user} profiles={profiles} cats={cats} onFlame={onFlame} onCounter={onCounter} isDesktop={isDesktop} reactions={reactions} onReaction={onReaction} onDelete={onDelete} onEdit={onEdit}/>
      ))}
    </>
  );

  return(
    <div className="sUp">
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
        <div style={{display:"grid",gridTemplateColumns:"60% 40%",gap:20,alignItems:"start"}}>
          <div>{pendingSection}{activeBets}{emptyState}{recentResolved}</div>
          <div>{scoreCard}{vaultTeaser}{expiredAlert}{expiryAlert}</div>
        </div>
      ):(
        <>{expiredAlert}{expiryAlert}{scoreCard}{vaultTeaser}{pendingSection}{activeBets}{emptyState}{recentResolved}</>
      )}
    </div>
  );
}
