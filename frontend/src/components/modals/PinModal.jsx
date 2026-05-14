import React, { useState } from 'react';
import { Btn } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import useEscClose from '../../hooks/useEscClose.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';

export default function PinModal({user,profiles,vaultPin,onSuccess,onClose}){
  useEscClose(onClose);
  useBodyScrollLock();
  const { t } = useLang();
  const [pin,setPin]=useState("");
  const [err,setErr]=useState("");
  const check=()=>{
    if(pin===vaultPin){onSuccess();}
    else{setErr(t('pin_modal.err_wrong'));setPin("");}
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,11,35,.78)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:24}} onClick={onClose}>
      <div className="bIn" style={{background:"var(--surf)",border:"1px solid var(--rule)",borderRadius:6,padding:"36px 30px",width:"100%",maxWidth:340,textAlign:"center",boxShadow:"0 30px 80px rgba(0,0,0,.55)"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:48,marginBottom:20,opacity:.85}}>🔒</div>
        <div className="bc-meta" style={{marginBottom:10}}>— Vault</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:26,fontWeight:600,lineHeight:1.15,marginBottom:8,color:"var(--txt)"}}>{t('pin_modal.title')}</div>
        <div style={{fontSize:13,color:"var(--dim)",marginBottom:28,lineHeight:1.5}}>{t('pin_modal.subtitle')}</div>
        {err && <div style={{fontSize:12,color:"var(--red)",marginBottom:14,fontWeight:600,letterSpacing:".02em"}}>{err}</div>}
        <input type="text" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,4))}
          placeholder={t('pin_modal.placeholder')} autoFocus
          style={{
            width:"100%",background:"transparent",border:0,borderBottom:"1px solid var(--brd)",
            color:"var(--txt)",borderRadius:0,padding:"12px 2px",
            fontFamily:"'Playfair Display',serif",
            fontSize:36,letterSpacing:18,textAlign:"center",
            outline:"none",marginBottom:28,transition:"border-color .18s",
          }}/>
        <Btn variant="gold" full style={{marginBottom:12}} onClick={check}>{t('pin_modal.unlock')}</Btn>
        <button onClick={onClose} style={{
          width:"100%", padding:"4px 0",
          background:"transparent",border:"none",cursor:"pointer",
          fontFamily:"'Manrope',sans-serif",fontSize:10,fontWeight:600,
          letterSpacing:".3em",textTransform:"uppercase",color:"var(--dim)",
        }}>{t('pin_modal.cancel')}</button>
      </div>
    </div>
  );
}
