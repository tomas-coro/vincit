import React, { useState } from 'react';
import { Btn, Avatar, fmtQ, qToP, COLORS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';

const S = {
  card: {background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:16},
  btn: {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 18px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:600,transition:"all .18s",userSelect:"none",whiteSpace:"nowrap"},
  bdg: {display:"inline-flex",alignItems:"center",gap:3,padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:600},
};

const Bdg=({c,bg,children})=><span style={{...S.bdg,background:bg,color:c}}>{children}</span>;

export function ResolveModal({bet,cats,profiles,onResolve,onOvertime,onClose}){
  const { t } = useLang();
  const [done,setDone]=useState(false);
  const go=o=>{setDone(true);setTimeout(()=>onResolve(bet,o),200);};
  const cbs=bet.counterBets||[];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20}}>
      <div className="bIn" style={{...S.card,width:"100%",maxWidth:380,padding:24}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,marginBottom:6}}>{t('resolve.title')}</div>
        <div style={{fontSize:13,color:"var(--dim)",fontStyle:"italic",marginBottom:16,lineHeight:1.4}}>"{bet.title}"</div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {[{l:t('resolve.quota'),v:`${fmtQ(bet.quota)}×`,c:"var(--gold)"},{l:t('resolve.stake'),v:`${bet.stake} ₡`,c:"var(--txt)"},{l:t('resolve.win'),v:`${bet.potentialWin} ₡`,c:"var(--grn)"}].map(s=>(
            <div key={s.l} style={{...S.card,flex:1,textAlign:"center",padding:"8px 6px",border:"1px solid var(--brd)"}}>
              <div style={{fontSize:14,fontWeight:700,color:s.c}}>{s.v}</div>
              <div style={{fontSize:9,color:"var(--dim)",marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>
        {cbs.length>0&&(
          <div style={{marginBottom:14,padding:"10px 12px",background:"var(--surf)",borderRadius:10,border:"1px solid var(--brd)"}}>
            <div style={{fontSize:10,color:"var(--dim)",marginBottom:6,letterSpacing:1,textTransform:"uppercase"}}>{t('resolve.positions')}</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              <Bdg bg="var(--grn)22" c="var(--grn)">{profiles[bet.creator]?.avatar} {t('resolve.yes')} · {bet.stake} ₡</Bdg>
              {cbs.map(cb=><Bdg key={cb.bettor} bg={cb.side==="yes"?"var(--grn)22":"var(--red)22"} c={cb.side==="yes"?"var(--grn)":"var(--red)"}>{profiles[cb.bettor]?.avatar} {cb.side==="yes"?t('resolve.yes'):t('resolve.no')} · {cb.stake} ₡</Bdg>)}
            </div>
          </div>
        )}
        <Btn variant="grn" full style={{marginBottom:10}} disabled={done} onClick={()=>go("won")}>{t('resolve.yes_btn',{net:bet.potentialWin-bet.stake})}</Btn>
        <Btn variant="red" full style={{marginBottom:10}} disabled={done} onClick={()=>go("lost")}>{t('resolve.no_btn',{stake:bet.stake})}</Btn>
        <button disabled={done} onClick={()=>onOvertime(bet)} style={{...S.btn,width:"100%",padding:"14px 0",fontSize:15,background:"transparent",border:"1px solid #f9731644",color:"#f97316",marginBottom:10}}>{t('resolve.overtime')}</button>
        <Btn variant="ghost" style={{width:"100%",fontSize:13}} onClick={onClose}>{t('resolve.cancel')}</Btn>
      </div>
    </div>
  );
}

export function OvertimeModal({bet,profiles,onResult,onClose}){
  const { t } = useLang();
  const [phase,setPhase]=useState("ready");
  const [winner,setWinner]=useState(null);
  const flip=()=>{
    setPhase("flipping");
    setTimeout(()=>{
      const w=Math.random()<.5?bet.creator:(Object.keys(profiles).find(k=>k!==bet.creator)??bet.creator);
      setWinner(w);setPhase("result");
    },1600);
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20}}>
      <div className="bIn" style={{...S.card,width:"100%",maxWidth:360,padding:24,textAlign:"center"}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,marginBottom:6}}>{t('overtime.title')}</div>
        <div style={{fontSize:13,color:"var(--dim)",fontStyle:"italic",marginBottom:4}}>"{bet.title}"</div>
        <div style={{fontSize:12,color:"var(--dim)",marginBottom:24}}>{t('overtime.desc')}</div>
        <div style={{fontSize:72,marginBottom:24,display:"inline-block"}} className={phase==="flipping"?"spinC":""}>🪙</div>
        {phase==="ready"&&<Btn variant="gold" style={{padding:"13px 36px",fontSize:15}} onClick={flip}>{t('overtime.flip')}</Btn>}
        {phase==="flipping"&&<div style={{fontSize:14,color:"var(--dim)"}}>{t('overtime.flipping')}</div>}
        {phase==="result"&&winner&&(
          <div className="bIn">
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"var(--gold)",marginBottom:8}}>{profiles[winner]?.avatar} {profiles[winner]?.name} {t('overtime.winner')}</div>
            <div style={{fontSize:13,color:"var(--dim)",marginBottom:20}}>{t('overtime.fate')}</div>
            <div style={{display:"flex",gap:10}}>
              <Btn variant="grn" style={{flex:1}} onClick={()=>onResult(bet,winner===bet.creator?"won":"lost")}>{t('overtime.accept')}</Btn>
              <Btn variant="ghost" style={{flex:1}} onClick={onClose}>{t('overtime.close')}</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
