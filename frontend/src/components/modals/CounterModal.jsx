import React, { useState } from 'react';
import { Btn, Inp, Avatar, fmtQ, qNo, qToP, COLORS, DEF_CAT_IDS as DEF_IDS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import useEscClose from '../../hooks/useEscClose.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';

export default function CounterModal({bet,user,profiles,credits,cats,onPlace,onClose}){
  useEscClose(onClose);
  useBodyScrollLock();
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
    <div style={{position:"fixed",inset:0,background:"rgba(15,11,35,.78)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:24}} onClick={onClose}>
      <div className="bIn" style={{background:"var(--surf)",border:"1px solid var(--rule)",borderRadius:6,padding:"32px 30px",width:"100%",maxWidth:420,boxShadow:"0 30px 80px rgba(0,0,0,.55)"}} onClick={e=>e.stopPropagation()}>
        <div className="bc-meta" style={{marginBottom:10}}>— {t('counter.title')}</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:24,fontWeight:600,lineHeight:1.18,marginBottom:6,color:"var(--txt)"}}>
          “{bet.title}”
        </div>
        <div className="bc-meta" style={{fontSize:8,marginBottom:24}}>{cat.e} {catLabel(cat)} · {t('counter.by')} {profiles[bet.creator]?.name}</div>

        {/* Side selector — sharp tiles, generous spacing */}
        <div style={{display:"flex",gap:10,marginBottom:24}}>
          {[
            {s:"yes",l:t('counter.yes_label'),q:qY,c:"var(--grn)"},
            {s:"no", l:t('counter.no_label'), q:qN,c:"var(--red)"},
          ].map(o => (
            <div key={o.s} onClick={()=>setSide(o.s)} style={{
              flex:1, padding:"18px 12px",
              borderRadius:4,
              border:`1px solid ${side===o.s ? o.c : 'var(--rule)'}`,
              cursor:"pointer", textAlign:"center",
              background: side===o.s ? `${o.c.startsWith('var')?'rgba(46,204,127,.08)':o.c+'14'}` : 'transparent',
              transition:"all .18s",
            }}>
              <div className="bc-meta" style={{color:o.c, marginBottom:8}}>{o.l}</div>
              <div className="bc-num" style={{fontSize:30, color:"var(--gold)"}}>{fmtQ(o.q)}<span style={{fontSize:14,opacity:.6}}>×</span></div>
              <div className="bc-meta" style={{fontSize:7, marginTop:4}}>{qToP(o.q)}%</div>
            </div>
          ))}
        </div>

        {side && (
          <div className="fIn" style={{marginBottom:20}}>
            <div className="bc-meta" style={{marginBottom:10}}>{t('counter.stake_max',{max:maxC})}</div>
            <div style={{display:"flex",gap:6,marginBottom:14}}>
              {[5,10,20,50].map(s => (
                <button key={s} onClick={()=>s<=maxC&&setStakeStr(String(s))} style={{
                  flex:1, padding:"9px 4px", borderRadius:999, cursor:"pointer",
                  fontFamily:"'Manrope',sans-serif", fontSize:11, fontWeight:600, letterSpacing:".06em",
                  background:"transparent",
                  border:`1px solid ${stake===s?'var(--gold)':'var(--rule)'}`,
                  color: stake===s?'var(--gold)':'var(--dim)',
                  opacity: s>maxC ? .35 : 1, transition:"all .18s",
                }}>{s}</button>
              ))}
            </div>
            <Inp type="number" min="1" max={maxC} value={stakeStr} onChange={e=>setStakeStr(e.target.value)} placeholder={t('counter.placeholder')} style={{marginBottom:18}}/>
            <div style={{display:"flex",justifyContent:"space-between",padding:"14px 0",borderTop:"1px solid var(--rule)",borderBottom:"1px solid var(--rule)"}}>
              <div>
                <div className="bc-meta" style={{fontSize:8,marginBottom:4}}>{t('counter.risks')}</div>
                <div className="bc-num" style={{fontSize:22,color:"var(--red)"}}>−{stake}<span style={{fontSize:11,opacity:.6,marginLeft:4}}>₡</span></div>
              </div>
              <div style={{textAlign:"right"}}>
                <div className="bc-meta" style={{fontSize:8,marginBottom:4}}>{t('counter.pot_win')}</div>
                <div className="bc-num" style={{fontSize:22,color:"var(--grn)"}}>+{potWin}<span style={{fontSize:11,opacity:.6,marginLeft:4}}>₡</span></div>
              </div>
            </div>
          </div>
        )}

        <div style={{display:"flex",gap:10,marginTop:side?0:8}}>
          <Btn variant="ghost" full onClick={onClose}>{t('counter.cancel')}</Btn>
          <Btn variant="gold" full disabled={!side||stake<=0||stake>credits[user]} onClick={()=>onPlace(bet,{bettor:user,side,stake,quotaUsed:q,potentialWin:potWin})}>
            {side==="yes"?t('counter.bet_yes'):side==="no"?t('counter.bet_no'):t('counter.cancel')}
          </Btn>
        </div>
      </div>
    </div>
  );
}
