import React from 'react';
import { SecLabel, Avatar, fmtQ, qToP, COLORS, getC } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';

const S = {
  card: {background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:16},
  bdg: {display:"inline-flex",alignItems:"center",gap:3,padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:600},
};

const Bdg=({c,bg,children})=><span style={{...S.bdg,background:bg,color:c}}>{children}</span>;

const DEF_IDS=['intimo','serata','casa','cibo','gaming','altro'];

export default function StatsView({user,profiles,credits,bets,cats,isDesktop}){
  const { t } = useLang();
  const catLabel = c => DEF_IDS.includes(c.id) ? t('cats.'+c.id) : c.label;
  const won=bets.filter(b=>b.creator===user&&b.status==="won");
  const lost=bets.filter(b=>b.creator===user&&b.status==="lost");
  const all=[...won,...lost];
  const wr=all.length?Math.round(won.length/all.length*100):0;
  const net=won.reduce((s,b)=>s+b.potentialWin-b.stake,0)-lost.reduce((s,b)=>s+b.stake,0);
  const best=won.length?won.reduce((a,b)=>b.potentialWin>a.potentialWin?b:a):null;
  let streak=0,cur=0;
  [...bets].filter(b=>b.creator===user&&["won","lost"].includes(b.status)).sort((a,b)=>a.createdAt-b.createdAt).forEach(b=>{cur=b.status==="won"?cur+1:0;if(cur>streak)streak=cur;});
  const flamed=all.filter(b=>b.flamed);
  const catS=cats.map(c=>({...c,w:won.filter(b=>b.category===c.id).length,l:lost.filter(b=>b.category===c.id).length})).filter(c=>c.w+c.l>0);
  const balanceCard=(
    <div className="pGold" style={{...S.card,marginBottom:12,textAlign:"center",background:"linear-gradient(135deg,var(--card),var(--surf))"}}>
      <SecLabel>{t('stats_view.balance')}</SecLabel>
      <div className="shim" style={{fontFamily:"'Playfair Display',serif",fontSize:44,fontWeight:900}}>{Math.round(credits[user] ?? 0)} ₡</div>
      <div style={{fontSize:13,color:net>=0?"var(--grn)":"var(--red)",marginTop:6,fontWeight:600}}>{net>=0?t('stats_view.net_pos',{n:Math.abs(net)}):t('stats_view.net_neg',{n:Math.abs(net)})}</div>
    </div>
  );
  const statsGrid=(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
      {[{e:"✅",l:t('stats_view.won'),v:won.length,c:"var(--grn)"},{e:"❌",l:t('stats_view.lost'),v:lost.length,c:"var(--red)"},{e:"📈",l:t('stats_view.win_rate'),v:`${wr}%`,c:wr>=50?"var(--grn)":"var(--red)"},{e:"🔥",l:t('stats_view.streak'),v:streak,c:"#f97316"}].map(s=>(
        <div key={s.l} style={{...S.card,textAlign:"center"}}>
          <div style={{fontSize:20,marginBottom:4}}>{s.e}</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:s.c}}>{s.v}</div>
          <div style={{fontSize:11,color:"var(--dim)"}}>{s.l}</div>
        </div>
      ))}
    </div>
  );
  const bestCard=best&&(
    <div style={{...S.card,marginBottom:10,border:"1px solid var(--grn)33"}}>
      <SecLabel>{t('stats_view.best')}</SecLabel>
      <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>{best.title}</div>
      <div style={{display:"flex",gap:8}}><Bdg bg="var(--grn)22" c="var(--grn)">+{best.potentialWin-best.stake} ₡</Bdg><Bdg bg="var(--gold)22" c="var(--gold)">{fmtQ(best.quota)}×</Bdg></div>
    </div>
  );
  const catCard=catS.length>0&&(
    <div style={{...S.card,marginBottom:10}}>
      <SecLabel>{t('stats_view.by_cat')}</SecLabel>
      {catS.map(c=>(
        <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <span style={{fontSize:14}}>{c.e}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:12}}>{catLabel(c)}</div>
            <div style={{height:4,borderRadius:2,background:"var(--mut)",marginTop:4,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:2,background:c.color,width:`${(c.w+c.l)?c.w/(c.w+c.l)*100:0}%`,transition:"width .5s"}}/>
            </div>
          </div>
          <div style={{fontSize:11}}><span style={{color:"var(--grn)"}}>{c.w}V</span> <span style={{color:"var(--red)"}}>{c.l}P</span></div>
        </div>
      ))}
    </div>
  );
  const hofCard=flamed.length>0&&(
    <div style={{...S.card,border:"1px solid #f9731644"}}>
      <SecLabel>{t('stats_view.hof')}</SecLabel>
      {flamed.map(b=>(
        <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,paddingBottom:8,borderBottom:"1px solid var(--brd)"}}>
          <div style={{fontSize:13,flex:1,marginRight:8}}>{b.title}</div>
          <Bdg bg={b.status==="won"?"var(--grn)22":"var(--red)22"} c={b.status==="won"?"var(--grn)":"var(--red)"}>{b.status==="won"?"✅":"❌"}</Bdg>
        </div>
      ))}
    </div>
  );
  const emptyMsg=all.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:"var(--dim)",fontSize:13}}>{t('stats_view.no_bets')}</div>;

  return(
    <div className="sUp">
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,marginBottom:20}}>{t('stats_view.title')}</div>
      {isDesktop?(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>
          <div>{balanceCard}{statsGrid}{bestCard}{emptyMsg}</div>
          <div>{catCard}{hofCard}</div>
        </div>
      ):(
        <>{balanceCard}{statsGrid}{bestCard}{catCard}{hofCard}{emptyMsg}</>
      )}
    </div>
  );
}
