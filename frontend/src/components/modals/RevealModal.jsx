import React, { useState } from 'react';
import { Btn, fmtQ, qToP, fmtD } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import useEscClose from '../../hooks/useEscClose.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';

const Bdg = ({c,bg,children}) => (
  <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:999,fontSize:10,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",background:bg,color:c}}>{children}</span>
);

export default function RevealModal({bet,cats,onResolve,onClose}){
  useEscClose(onClose);
  useBodyScrollLock();
  const { t, lang } = useLang();
  const [flipped,setFlipped]=useState(false);
  const [done,setDone]=useState(false);
  const cat=cats.find(c=>c.id===bet.category)||cats[cats.length-1];
  const go=outcome=>{setDone(true);setTimeout(()=>onResolve(bet,outcome),200);};

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,11,35,.92)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:100,padding:32}}>
      <div className="bc-meta" style={{marginBottom:12,color:"var(--gold)"}}>— {t('reveal.title')}</div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:28,fontWeight:600,color:"var(--txt)",marginBottom:6,textAlign:"center"}}>Vault</div>
      <div style={{fontSize:12,color:"var(--dim)",marginBottom:44,letterSpacing:".02em"}}>{t('reveal.created')} {fmtD(bet.createdAt,lang)}</div>

      <div style={{perspective:900,width:300,height:200,marginBottom:36}}>
        <div style={{width:"100%",height:"100%",position:"relative",transformStyle:"preserve-3d",transition:"transform .65s cubic-bezier(.34,1.2,.64,1)",transform:flipped?"rotateY(180deg)":"rotateY(0)"}}>
          {/* Front face — locked */}
          <div onClick={()=>setFlipped(true)} style={{
            position:"absolute",width:"100%",height:"100%",backfaceVisibility:"hidden",
            borderRadius:8,background:"var(--surf)",
            border:"1px solid var(--gold)55",
            boxShadow:"0 24px 60px -20px rgba(196,168,120,.4)",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,cursor:"pointer",
          }}>
            <div style={{fontSize:54,opacity:.85}}>🔒</div>
            <div className="bc-meta" style={{color:"var(--gold)"}}>{t('reveal.tap')}</div>
          </div>
          {/* Back face — revealed bet */}
          <div style={{
            position:"absolute",width:"100%",height:"100%",backfaceVisibility:"hidden",transform:"rotateY(180deg)",
            borderRadius:8,padding:22,background:"var(--surf)",
            border:`1px solid ${cat.color}88`,
            boxShadow:`0 24px 60px -20px ${cat.color}55`,
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,
          }}>
            <div style={{fontSize:28}}>{cat.e}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:18,fontWeight:600,textAlign:"center",lineHeight:1.25,color:"var(--txt)"}}>“{bet.title}”</div>
            <div style={{display:"flex",gap:6,marginTop:4}}>
              <Bdg bg="var(--gold)22" c="var(--gold)">{fmtQ(bet.quota)}×</Bdg>
              <Bdg bg="var(--soft)" c="var(--dim)">{qToP(bet.quota)}%</Bdg>
            </div>
            <div className="bc-meta" style={{fontSize:8}}>{bet.stake}₡ → {bet.potentialWin}₡</div>
          </div>
        </div>
      </div>

      {flipped && !done && (
        <div className="bIn" style={{textAlign:"center",width:"100%",maxWidth:340}}>
          <div className="bc-meta" style={{marginBottom:18}}>{t('reveal.happened')}</div>
          <div style={{display:"flex",gap:10}}>
            <Btn variant="grn" full onClick={()=>go("won")}>{t('reveal.yes_btn')}</Btn>
            <Btn variant="red" full onClick={()=>go("lost")}>{t('reveal.no_btn')}</Btn>
          </div>
        </div>
      )}

      {!flipped && (
        <button onClick={onClose} style={{
          marginTop:8, padding:"8px 24px",
          background:"transparent",border:"none",cursor:"pointer",
          fontFamily:"'Manrope',sans-serif",fontSize:10,fontWeight:600,
          letterSpacing:".3em",textTransform:"uppercase",color:"var(--dim)",
        }}>{t('reveal.cancel')}</button>
      )}
    </div>
  );
}
