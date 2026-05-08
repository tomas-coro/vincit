import React, { useState } from 'react';
import { Btn, Inp, Avatar, fmtQ, qNo, qToP, COLORS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';

const S = {
  card: {background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:16},
  btn: {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 18px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:600,transition:"all .18s",userSelect:"none",whiteSpace:"nowrap"},
};

const DEF_IDS=['intimo','serata','casa','cibo','gaming','altro'];

export default function CounterModal({bet,user,profiles,credits,cats,onPlace,onClose}){
  const { t } = useLang();
  const catLabel = c => DEF_IDS.includes(c.id) ? t('cats.'+c.id) : c.label;
  const [side,setSide]=useState(null);
  const [stakeStr,setStakeStr]=useState("10");
  const qY=bet.quota; const qN=qNo(bet.quota);
  const stake=parseFloat(stakeStr)||0;
  const q=side==="yes"?qY:qN;
  const potWin=Math.round(stake*q);
  const maxC=Math.round(credits[user]);
  const cat=cats.find(c=>c.id===bet.category)||cats[cats.length-1];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20}}>
      <div className="bIn" style={{...S.card,width:"100%",maxWidth:380,padding:24}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,marginBottom:6}}>{t('counter.title')}</div>
        <div style={{fontSize:13,color:"var(--dim)",fontStyle:"italic",marginBottom:4,lineHeight:1.4}}>"{bet.title}"</div>
        <div style={{fontSize:11,color:"var(--dim)",marginBottom:20}}>{cat.e} {catLabel(cat)} · {t('counter.by')} {profiles[bet.creator]?.name}</div>
        <div style={{display:"flex",gap:10,marginBottom:20}}>
          {[{s:"yes",l:t('counter.yes_label'),q:qY,c:"var(--grn)"},{s:"no",l:t('counter.no_label'),q:qN,c:"var(--red)"}].map(o=>(
            <div key={o.s} onClick={()=>setSide(o.s)} style={{flex:1,padding:"14px 10px",borderRadius:14,border:`2px solid ${side===o.s?o.c:"var(--brd)"}`,cursor:"pointer",textAlign:"center",background:side===o.s?`${o.c}18`.replace("var(--grn)","#2ecc7f").replace("var(--red)","#e05555"):"var(--surf)",transition:"all .18s"}}>
              <div style={{fontSize:12,fontWeight:600,color:o.c,marginBottom:4}}>{o.l}</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"var(--gold)"}}>{fmtQ(o.q)}×</div>
              <div style={{fontSize:10,color:"var(--dim)"}}>{qToP(o.q)}%</div>
            </div>
          ))}
        </div>
        {side&&(
          <div className="fIn">
            <div style={{fontSize:11,color:"var(--dim)",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>{t('counter.stake_max',{max:maxC})}</div>
            <div style={{display:"flex",gap:6,marginBottom:10}}>
              {[5,10,20,50].map(s=>(
                <button key={s} onClick={()=>s<=maxC&&setStakeStr(String(s))} style={{...S.btn,flex:1,padding:"7px 4px",fontSize:12,background:"transparent",border:`1px solid ${stake===s?"var(--gold)":"var(--brd)"}`,color:stake===s?"var(--gold)":"var(--dim)",opacity:s>maxC?.4:1}}>{s}</button>
              ))}
            </div>
            <Inp type="number" min="1" max={maxC} value={stakeStr} onChange={e=>setStakeStr(e.target.value)} placeholder={t('counter.placeholder')} style={{marginBottom:10}}/>
            <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",background:"var(--surf)",borderRadius:10,marginBottom:16,border:"1px solid var(--brd)"}}>
              <div><div style={{fontSize:11,color:"var(--dim)"}}>{t('counter.risks')}</div><div style={{fontSize:16,fontWeight:700,color:"var(--red)"}}>−{stake} ₡</div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"var(--dim)"}}>{t('counter.pot_win')}</div><div style={{fontSize:16,fontWeight:700,color:"var(--grn)"}}>+{potWin} ₡</div></div>
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:10}}>
          <Btn variant="ghost" style={{flex:1}} onClick={onClose}>{t('counter.cancel')}</Btn>
          <Btn variant="gold" style={{flex:2}} disabled={!side||stake<=0||stake>credits[user]} onClick={()=>onPlace(bet,{bettor:user,side,stake,quotaUsed:q,potentialWin:potWin})}>
            {side==="yes"?t('counter.bet_yes'):side==="no"?t('counter.bet_no'):t('counter.cancel')}
          </Btn>
        </div>
      </div>
    </div>
  );
}
