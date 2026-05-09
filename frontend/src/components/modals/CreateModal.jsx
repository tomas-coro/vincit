import React, { useState } from 'react';
import { Btn, Inp, Toggle, SecLabel, Q_PRE, CAT_COLS, qToP, pToQ, fmtQ, clamp } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';

const S = {
  lbl: {fontSize:10,color:"var(--dim)",letterSpacing:2,textTransform:"uppercase",display:"block",marginBottom:6},
  inp: {background:"var(--inp)",border:"1px solid var(--brd)",color:"var(--txt)",borderRadius:10,padding:"10px 14px",fontFamily:"'Syne',sans-serif",fontSize:14,outline:"none",width:"100%"},
  btn: {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 18px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:600,transition:"all .18s",userSelect:"none",whiteSpace:"nowrap"},
  card: {background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:16},
};

const qNo = qY=>parseFloat((parseFloat(qY)/(parseFloat(qY)-1)).toFixed(2));

const DEF_IDS=['intimo','serata','casa','cibo','gaming','altro'];

export default function CreateModal({user,profiles,maxC,cats,settings={},onCreate,onClose}){
  const { t } = useLang();
  const catLabel = c => DEF_IDS.includes(c.id) ? t('cats.'+c.id) : c.label;
  const [title,setTitle]=useState("");
  const [quota,setQuota]=useState(1.50);
  const [stakeStr,setStakeStr]=useState("10");
  const [cat,setCat]=useState(cats[0]?.id||"intimo");
  const [isSecret,setIsSecret]=useState(false);
  const [isCnt,setIsCnt]=useState(true);
  const [pegno,setPegno]=useState("");
  const [exp,setExp]=useState("");
  const maxStake=Math.min(maxC, settings.max_stake ?? maxC);
  const threshold=settings.acceptance_threshold ?? Infinity;
  const stake=Math.max(0,parseFloat(stakeStr)||0);
  const prob=qToP(quota); const potWin=Math.round(stake*quota);
  const probC=prob>=70?"var(--grn)":prob>=40?"var(--gold)":"var(--red)";
  const opponent=Object.keys(profiles).find(k=>k!==user)??null;
  const needsApproval=!isSecret&&stake>=threshold&&opponent;

  const submit=()=>{
    if(!title.trim()){alert(t('create.err_title'));return;}
    if(stake<=0||stake>maxStake){alert(t('create.err_stake',{max:Math.round(maxStake)}));return;}
    onCreate({title,quota,stake,potentialWin:potWin,category:cat,isSecret,isCounterable:!isSecret&&isCnt,pegno,expiresAt:exp?new Date(exp).getTime():null,opponent:opponent||undefined});
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100}}>
      <div className="sUp" style={{background:"var(--surf)",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,padding:"24px 20px 36px",maxHeight:"92vh",overflowY:"auto",borderTop:"1px solid var(--brd)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700}}>{t('create.title')}</div>
          <Btn variant="ghost" sm onClick={onClose}>✕</Btn>
        </div>

        {/* Secret toggle */}
        <div onClick={()=>{setIsSecret(!isSecret);if(!isSecret)setIsCnt(false);}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderRadius:14,marginBottom:14,cursor:"pointer",background:isSecret?"var(--gold)14":"var(--card)",border:`1px solid ${isSecret?"var(--gold)":"var(--brd)"}`,transition:"all .2s"}}>
          <div><div style={{fontWeight:600,fontSize:14}}>{isSecret?t('create.secret_on_label'):t('create.secret_off_label')}</div><div style={{fontSize:12,color:"var(--dim)",marginTop:2}}>{isSecret?t('create.secret_on_desc'):t('create.secret_off_desc')}</div></div>
          <Toggle on={isSecret} onToggle={()=>{}}/>
        </div>

        {/* Counter toggle */}
        {!isSecret&&(
          <div onClick={()=>setIsCnt(!isCnt)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderRadius:12,marginBottom:14,cursor:"pointer",background:isCnt?"var(--blu)12":"var(--card)",border:`1px solid ${isCnt?"var(--blu)":"var(--brd)"}`,transition:"all .2s"}}>
            <div><div style={{fontWeight:600,fontSize:13}}>{t('create.counter_title')}</div><div style={{fontSize:11,color:"var(--dim)",marginTop:1}}>{profiles[Object.keys(profiles).find(k=>k!==user)]?.name ?? ''} {t('create.counter_desc')}</div></div>
            <Toggle on={isCnt} onToggle={()=>{}} color="var(--blu)"/>
          </div>
        )}

        {/* Title */}
        <div style={{marginBottom:16}}>
          <label style={S.lbl}>{t('create.bet_label')}</label>
          <Inp value={title} onChange={e=>setTitle(e.target.value)} placeholder={isSecret?t('create.bet_placeholder_sec'):t('create.bet_placeholder_pub')}/>
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
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:probC}}>{prob}%</div>
          </div>
          <input type="range" min="5" max="95" step="1" className="bc" value={clamp(prob,5,95)} onChange={e=>setQuota(pToQ(parseInt(e.target.value)))} style={{marginBottom:4,width:"100%",height:5,borderRadius:3,outline:"none",cursor:"pointer",accentColor:"var(--gold)"}}/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--mut)",marginBottom:12}}><span>{t('create.impossible')}</span><span>{t('create.certain')}</span></div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:12,color:"var(--dim)",flexShrink:0}}>{t('create.direct_quota')}</span>
            <Inp type="number" step=".05" min="1.05" max="50" value={quota} onChange={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)&&v>=1.05&&v<=50)setQuota(parseFloat(v.toFixed(2)));}} style={{width:90}}/>
            {!isSecret&&isCnt&&<span style={{fontSize:11,color:"var(--dim)"}}>{t('create.no_label')} <span style={{color:"var(--red)",fontWeight:700}}>{fmtQ(qNo(quota))}×</span></span>}
          </div>
        </div>

        {/* Stake */}
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <label style={{...S.lbl,marginBottom:0}}>{t('create.stake_label')}</label>
            <span style={{fontSize:11,color:"var(--dim)"}}>{t('create.stake_max')} {Math.round(maxStake)} ₡</span>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            {[5,10,20,50].map(s=>(
              <button key={s} onClick={()=>s<=maxStake&&setStakeStr(String(s))} style={{...S.btn,flex:1,padding:"7px 4px",fontSize:12,background:"transparent",border:`1px solid ${stake===s?"var(--gold)":"var(--brd)"}`,color:stake===s?"var(--gold)":"var(--dim)",opacity:s>maxStake?.4:1}}>{s}</button>
            ))}
          </div>
          <Inp type="number" min="1" max={Math.floor(maxStake)} step="1" value={stakeStr} onChange={e=>setStakeStr(e.target.value)} placeholder={t('create.stake_placeholder')}/>
          {needsApproval&&(
            <div style={{fontSize:12,color:"var(--gold)",marginTop:8,padding:"8px 12px",background:"var(--gold)12",borderRadius:8,border:"1px solid var(--gold)33"}}>
              {t('create.acceptance_required',{name:profiles[opponent]?.name??'...'})}
            </div>
          )}
          <div style={{...S.card,marginTop:10,padding:"10px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:11,color:"var(--dim)"}}>{t('create.risks')}</div><div style={{fontSize:17,fontWeight:700,color:"var(--red)"}}>−{stake} ₡</div></div>
              <div style={{color:"var(--mut)"}}>→</div>
              <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"var(--dim)"}}>{t('create.net')}</div><div style={{fontSize:17,fontWeight:700,color:"var(--grn)"}}>+{potWin-stake} ₡</div></div>
              <div style={{color:"var(--mut)"}}>→</div>
              <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"var(--dim)"}}>{t('create.total')}</div><div style={{fontSize:17,fontWeight:700,color:"var(--gold)"}}>{potWin} ₡</div></div>
            </div>
          </div>
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

        <Btn variant="gold" full onClick={submit}>{isSecret?t('create.submit_secret'):t('create.submit_shared')}</Btn>
      </div>
    </div>
  );
}
