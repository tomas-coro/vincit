import React, { useState } from 'react';
import { Btn, Inp, SecLabel, Q_PRE, qToP, pToQ, fmtQ, clamp, DEF_CAT_IDS as DEF_IDS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import { useToast } from '../../Toast.jsx';
import useEscClose from '../../hooks/useEscClose.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';

const S = {
  lbl: {fontSize:9,color:"var(--dim)",letterSpacing:".3em",textTransform:"uppercase",fontWeight:600,display:"block",marginBottom:10},
  inp: {background:"transparent",border:0,borderBottom:"1px solid var(--brd)",color:"var(--txt)",borderRadius:0,padding:"8px 2px",fontFamily:"'Manrope',sans-serif",fontSize:15,outline:"none",width:"100%"},
  btn: {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"8px 14px",borderRadius:999,border:"none",cursor:"pointer",fontFamily:"'Manrope',sans-serif",fontSize:11,fontWeight:600,letterSpacing:".06em",transition:"all .18s",userSelect:"none",whiteSpace:"nowrap"},
  // "card" kept as a softly-tinted callout for the read-only stake line.
  card: {background:"var(--soft)",border:"1px solid var(--rule)",borderRadius:4,padding:14},
};

const qNo = qY => parseFloat((parseFloat(qY)/(parseFloat(qY)-1)).toFixed(2));

export default function EditModal({bet, user, cats, onSave, onClose}){
  useEscClose(onClose);
  useBodyScrollLock();
  const { t } = useLang();
  const toast = useToast();
  const catLabel = c => DEF_IDS.includes(c.id) ? t('cats.'+c.id) : c.label;
  const [title, setTitle]   = useState(bet.title);
  const [quota, setQuota]   = useState(parseFloat(bet.quota));
  const [cat,   setCat]     = useState(bet.category);
  const [pegno, setPegno]   = useState(bet.pegno || "");
  const [exp,   setExp]     = useState(
    bet.expiresAt ? new Date(bet.expiresAt).toISOString().slice(0,16) : ""
  );

  const prob   = qToP(quota);
  const potWin = Math.round(bet.stake * quota);
  const probC  = prob >= 70 ? "var(--grn)" : prob >= 40 ? "var(--gold)" : "var(--red)";

  const submit = () => {
    if (!title.trim()) { toast.error(t('create.err_title')); return; }
    onSave(bet.id, {
      creator: user, title, quota, category: cat, pegno,
      expiresAt: exp ? new Date(exp).getTime() : null,
    });
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,11,35,.78)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100}}>
      <div className="sUp" style={{background:"var(--surf)",borderRadius:"12px 12px 0 0",width:"100%",maxWidth:480,padding:"30px 28px 36px",maxHeight:"92vh",overflowY:"auto",borderTop:"1px solid var(--rule)",boxShadow:"0 -20px 60px rgba(0,0,0,.4)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:28}}>
          <div>
            <div className="bc-meta" style={{marginBottom:8}}>— {t('edit_modal.title').replace(' ✏️','')}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:28,fontWeight:600,lineHeight:1,color:"var(--txt)"}}>Edit</div>
          </div>
          <button onClick={onClose} style={{
            background:"transparent",border:"none",cursor:"pointer",
            color:"var(--dim)",fontSize:18,padding:4,
          }}>✕</button>
        </div>

        {/* Title */}
        <div style={{marginBottom:16}}>
          <label style={S.lbl}>{t('create.bet_label')}</label>
          <Inp value={title} onChange={e=>setTitle(e.target.value)} placeholder={t('create.bet_placeholder_pub')}/>
        </div>

        {/* Quota */}
        <div style={{marginBottom:16}}>
          <label style={S.lbl}>{t('create.quota_label')}</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
            {Q_PRE.map(p=>(
              <button key={p.q} onClick={()=>setQuota(p.q)} style={{...S.btn,padding:"6px 10px",fontSize:11,background:"transparent",border:`1px solid ${Math.abs(quota-p.q)<.06?"var(--gold)":"var(--brd)"}`,color:Math.abs(quota-p.q)<.06?"var(--gold)":"var(--dim)"}}>{t('qpre.'+p.key)}</button>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:12,color:"var(--dim)"}}>{t('create.prob_label')}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,color:probC}}>{prob}%</div>
          </div>
          <input type="range" min="5" max="95" step="1" className="bc" value={clamp(prob,5,95)} onChange={e=>setQuota(pToQ(parseInt(e.target.value)))} style={{marginBottom:4,width:"100%",height:5,borderRadius:3,outline:"none",cursor:"pointer",accentColor:"var(--gold)"}}/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--mut)",marginBottom:12}}><span>{t('create.impossible')}</span><span>{t('create.certain')}</span></div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:12,color:"var(--dim)",flexShrink:0}}>{t('create.direct_quota')}</span>
            <Inp type="number" step=".05" min="1.05" max="50" value={quota} onChange={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)&&v>=1.05&&v<=50)setQuota(parseFloat(v.toFixed(2)));}} style={{width:90}}/>
          </div>
        </div>

        {/* Stake info (read-only) */}
        <div style={{...S.card,marginBottom:16,padding:"10px 14px"}}>
          <div style={{fontSize:12,color:"var(--dim)"}}>{t('edit_modal.stake_note',{stake:bet.stake})} <span style={{fontSize:16,fontWeight:700,color:"var(--grn)"}}>{potWin} ₡</span></div>
        </div>

        {/* Category */}
        <div style={{marginBottom:16}}>
          <label style={S.lbl}>{t('create.category_label')}</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {cats.map(c=>(
              <button key={c.id} onClick={()=>setCat(c.id)} style={{...S.btn,padding:"7px 12px",fontSize:12,background:"transparent",border:`1px solid ${cat===c.id?c.color:"var(--brd)"}`,color:cat===c.id?c.color:"var(--dim)"}}>{c.e} {catLabel(c)}</button>
            ))}
          </div>
        </div>

        {/* Pegno */}
        <div style={{marginBottom:14}}>
          <label style={S.lbl}>{t('create.forfeit_label')}</label>
          <Inp value={pegno} onChange={e=>setPegno(e.target.value)} placeholder={t('create.forfeit_placeholder')}/>
        </div>

        {/* Expiry */}
        <div style={{marginBottom:24}}>
          <label style={S.lbl}>{t('create.expires_label')}</label>
          <input type="datetime-local" value={exp} onChange={e=>setExp(e.target.value)} style={{...S.inp,colorScheme:"dark"}}/>
        </div>

        <Btn variant="gold" full onClick={submit}>{t('edit_modal.submit')}</Btn>
      </div>
    </div>
  );
}
