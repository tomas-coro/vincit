import React, { useState, useEffect } from 'react';
import { Btn, Inp, Toggle, SecLabel, Q_PRE, qToP, pToQ, fmtQ, clamp, DEF_CAT_IDS as DEF_IDS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import { useToast } from '../../Toast.jsx';
import * as api from '../../api.js';

const S = {
  lbl: {fontSize:10,color:"var(--dim)",letterSpacing:2,textTransform:"uppercase",display:"block",marginBottom:6},
  inp: {background:"var(--inp)",border:"1px solid var(--brd)",color:"var(--txt)",borderRadius:10,padding:"10px 14px",fontFamily:"'Syne',sans-serif",fontSize:14,outline:"none",width:"100%"},
  btn: {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 18px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:600,transition:"all .18s",userSelect:"none",whiteSpace:"nowrap"},
  card: {background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:16},
  bdg: {display:"inline-flex",alignItems:"center",gap:3,padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:600},
};

const qNo = qY=>parseFloat((parseFloat(qY)/(parseFloat(qY)-1)).toFixed(2));

const Bdg = ({c,bg,children}) => <span style={{...S.bdg,background:bg,color:c}}>{children}</span>;

function useBreakpoint(minWidth = 768) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(`(min-width: ${minWidth}px)`).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const handler = e => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [minWidth]);
  return matches;
}

function LivePreview({ title, quota, stake, potWin, cat, catLabel, isSecret, isCnt, pegno, exp, profile, opponentProfile, t }) {
  const sideColor = isSecret ? "var(--gold)" : (cat?.color ?? "var(--blu)");
  const tlValue = exp ? new Date(exp).getTime() : null;
  const titleDisplay = title.trim()
    ? title
    : <span style={{color:"var(--mut)",fontStyle:"italic"}}>{t('create.bet_label')}…</span>;
  return (
    <div style={{...S.card, position:"relative", overflow:"hidden", border:`1px solid ${isSecret?"var(--gold)44":"var(--brd)"}`}}>
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:sideColor,borderRadius:"3px 0 0 3px"}}/>
      <div style={{paddingLeft:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
          <div style={{flex:1,minWidth:0}}>
            {isSecret ? (
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span>🔒</span>
                <span style={{fontWeight:600,fontSize:14,color:"var(--gold)"}}>{t('bet_card.secret_label')}</span>
              </div>
            ) : (
              <div style={{fontWeight:600,fontSize:14,lineHeight:1.35,wordBreak:"break-word"}}>{titleDisplay}</div>
            )}
            <div style={{fontSize:11,color:"var(--dim)",marginTop:3}}>
              {cat?.e} {catLabel(cat)} · ora
            </div>
          </div>
          {!isSecret && (
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"var(--gold)"}}>{fmtQ(quota)}×</div>
              <div style={{fontSize:10,color:"var(--dim)"}}>{qToP(quota)}%</div>
            </div>
          )}
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
          {!isSecret && <>
            <Bdg bg="var(--mut)44" c="var(--dim)">{t('bet_card.stake')} {stake} ₡</Bdg>
            <Bdg bg="var(--grn)22" c="var(--grn)">{t('bet_card.win')} {potWin} ₡</Bdg>
          </>}
          {pegno && <Bdg bg="var(--gold)22" c="var(--gold)">🎁 {pegno}</Bdg>}
          {tlValue && <Bdg bg="var(--mut)33" c="var(--dim)">⏱ {new Date(tlValue).toLocaleDateString()}</Bdg>}
        </div>
        {!isSecret && isCnt && opponentProfile && (
          <div style={{borderTop:"1px solid var(--brd)",paddingTop:8,marginTop:4}}>
            <div style={{fontSize:10,color:"var(--dim)",letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>{t('bet_card.challenge')}</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              <Bdg bg="var(--grn)22" c="var(--grn)">{profile?.avatar} {t('bet_card.yes')} @ {fmtQ(quota)}×</Bdg>
              <Bdg bg="var(--red)22" c="var(--red)">{opponentProfile.avatar} {t('bet_card.no')} @ {fmtQ(qNo(quota))}×</Bdg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Summary({ stake, potWin, maxC, t }) {
  const net = potWin - stake;
  const balance = Math.round(maxC ?? 0);
  const balanceWin = balance + net;
  const balanceLose = balance - stake;
  const row = (label, value, color) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0"}}>
      <div style={{fontSize:12,color:"var(--dim)"}}>{label}</div>
      <div style={{fontSize:14,fontWeight:700,color}}>{value}</div>
    </div>
  );
  return (
    <div style={{...S.card, padding:"4px 16px"}}>
      {row(t('create.risks'), `−${stake} ₡`, "var(--red)")}
      <div style={{borderTop:"1px solid var(--brd)"}}/>
      {row(t('create.net'), `+${net} ₡`, "var(--grn)")}
      <div style={{borderTop:"1px solid var(--brd)"}}/>
      {row(t('create.total'), `${potWin} ₡`, "var(--gold)")}
      <div style={{borderTop:"1px dashed var(--gold)33",marginTop:4}}/>
      {row(t('create.balance_win'), `${balanceWin} ₡`, "var(--grn)")}
      {row(t('create.balance_lose'), `${balanceLose} ₡`, "var(--red)")}
    </div>
  );
}

export default function CreateModal({user,profiles,groupMembers,maxC,cats,settings={},onCreate,onClose}){
  const { t } = useLang();
  const toast = useToast();
  const isDesktop = useBreakpoint(768);
  const catLabel = c => c && (DEF_IDS.includes(c.id) ? t('cats.'+c.id) : c.label);

  // Other members of the group (excluding self). Falls back to "profiles minus self" if not provided yet.
  const others = (groupMembers && groupMembers.length
    ? groupMembers
    : Object.entries(profiles).map(([id,p])=>({id,...p}))
  ).filter(m => m.id !== user);

  const [title,setTitle]=useState("");
  const [quota,setQuota]=useState(1.50);
  const [stakeStr,setStakeStr]=useState("10");
  const [cat,setCat]=useState(cats[0]?.id||"scherzi");
  // betType: 'vault' | 'open' | 'targeted' | 'surprise'
  const [betType,setBetType]=useState('open');
  const [opponentId,setOpponentId]=useState(others[0]?.id ?? null);
  const [targetId,setTargetId]=useState(null);
  // Subset of group invited to an OPEN bet. Empty = whole group (default).
  const [allowedSet, setAllowedSet] = useState(() => new Set());
  const toggleAllowed = id => setAllowedSet(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const [pegno,setPegno]=useState("");
  const [exp,setExp]=useState("");
  const [templates, setTemplates] = useState([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [tplName, setTplName] = useState("");

  useEffect(() => {
    api.listTemplates().then(setTemplates).catch(() => {});
  }, []);

  const applyTemplate = (tpl) => {
    setTitle(tpl.title || "");
    setQuota(parseFloat(tpl.quota) || 1.5);
    setStakeStr(String(tpl.stake ?? 10));
    if (tpl.category) setCat(tpl.category);
    if (tpl.bet_type && ['vault','open','targeted','surprise'].includes(tpl.bet_type)) setBetType(tpl.bet_type);
    setPegno(tpl.pegno || "");
  };

  const saveAsTemplate = async () => {
    if (!title.trim() || !stake) {
      toast.error(t('templates.no_title_hint'));
      return;
    }
    if (!tplName.trim()) { toast.error(t('templates.name_label')); return; }
    try {
      const created = await api.createTemplate({
        name: tplName.trim(),
        title: title.trim(),
        quota, stake,
        category: cat,
        bet_type: betType,
        pegno: pegno || null,
      });
      setTemplates([created, ...templates]);
      setShowSaveDialog(false);
      setTplName("");
      toast.success(t('templates.saved'));
    } catch (e) { toast.error(t('app.error_create')); }
  };

  // Auto-select first available opponent when switching to targeted/surprise
  useEffect(() => {
    if ((betType === 'targeted' || betType === 'surprise') && !opponentId && others[0]) {
      setOpponentId(others[0].id);
    }
  }, [betType, opponentId, others]);

  const isSecret   = betType === 'vault';
  const isSurprise = betType === 'surprise';
  const needsOpponent = betType === 'targeted' || betType === 'surprise';
  const opponent   = needsOpponent ? opponentId : null;
  const isCnt      = betType === 'open';

  const maxStake=Math.min(maxC, settings.max_stake ?? maxC);
  const threshold=settings.acceptance_threshold ?? Infinity;
  const stake=Math.max(0,parseFloat(stakeStr)||0);
  const prob=qToP(quota); const potWin=Math.round(stake*quota);
  const probC=prob>=70?"var(--grn)":prob>=40?"var(--gold)":"var(--red)";
  const needsApproval=needsOpponent && stake>=threshold;
  const selectedCat = cats.find(c=>c.id===cat) || cats[0];

  const submit=()=>{
    if(!title.trim()){toast.error(t('create.err_title'));return;}
    if(stake<=0||stake>maxStake){toast.error(t('create.err_stake',{max:Math.round(maxStake)}));return;}
    if(needsOpponent && !opponentId){toast.error(t('create.opponent_pick'));return;}
    // Subset only makes sense for OPEN bets, and only if the user actually
    // picked specific members (non-empty AND not the whole group).
    let allowedMembers;
    if (betType === 'open' && allowedSet.size > 0 && allowedSet.size < others.length) {
      allowedMembers = Array.from(allowedSet);
    }
    onCreate({
      title, quota, stake, potentialWin:potWin, category:cat,
      isSecret, isSurprise,
      isCounterable: betType === 'open',
      pegno,
      expiresAt: exp ? new Date(exp).getTime() : null,
      opponent: opponent || undefined,
      targetUser: betType !== 'vault' && targetId ? targetId : undefined,
      allowedMembers,
    });
  };

  // ─── Form blocks (shared mobile/desktop) ──────────────────────────────
  const TemplatesBlock = templates.length > 0 && (
    <div style={{ marginBottom: 14 }}>
      <label style={S.lbl}>{t('templates.title_picker')}</label>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {templates.map(tpl => (
          <button key={tpl.id} onClick={() => applyTemplate(tpl)}
            title={`${tpl.title} · ${fmtQ(tpl.quota)}× · ${tpl.stake} ₡`}
            style={{
              display:'inline-flex', alignItems:'center', gap:6,
              padding:'6px 12px', borderRadius:20,
              border:'1px solid var(--gold)44',
              background:'var(--gold)0d', color:'var(--gold)',
              cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:600,
            }}>
            <span style={{fontSize:13}}>💾</span>
            <span>{tpl.name}</span>
            <span style={{fontSize:10,color:'var(--dim)'}}>· {fmtQ(tpl.quota)}× · {tpl.stake}₡</span>
          </button>
        ))}
      </div>
    </div>
  );

  const SaveAsTemplateBtn = (
    <button onClick={() => { setShowSaveDialog(true); setTplName(""); }}
      style={{
        display:'inline-flex', alignItems:'center', gap:6,
        padding:'6px 12px', borderRadius:20,
        border:'1px solid var(--brd)', background:'transparent',
        color:'var(--dim)', cursor:'pointer',
        fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:600,
        marginTop:10,
      }}>
      {t('templates.save_as_btn')}
    </button>
  );

  const TYPE_OPTIONS = [
    { key:'vault',     color:'var(--gold)', requiresOther:false },
    { key:'open',      color:'var(--blu)',  requiresOther:false },
    { key:'targeted',  color:'var(--grn)',  requiresOther:true  },
    { key:'surprise',  color:'var(--pur)',  requiresOther:true  },
  ];

  const TypeBlock = (
    <div style={{ marginBottom: 14 }}>
      <label style={S.lbl}>{t('create.type_label')}</label>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
        {TYPE_OPTIONS.map(o => {
          const disabled = o.requiresOther && others.length === 0;
          const active = betType === o.key;
          return (
            <div key={o.key}
              onClick={() => { if (!disabled) setBetType(o.key); }}
              style={{
                padding: '10px 12px', borderRadius: 12,
                cursor: disabled ? 'not-allowed' : 'pointer',
                background: active ? `${o.color}1a` : 'var(--card)',
                border: `1px solid ${active ? o.color : 'var(--brd)'}`,
                opacity: disabled ? .4 : 1,
                transition: 'all .18s',
              }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: active ? o.color : 'var(--txt)' }}>
                {t('create.type_'+o.key)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2, lineHeight: 1.3 }}>
                {t('create.type_'+o.key+'_desc')}
              </div>
            </div>
          );
        })}
      </div>
      {others.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 6, fontStyle: 'italic' }}>
          {t('create.no_others_hint')}
        </div>
      )}
    </div>
  );

  const OpponentBlock = needsOpponent && others.length > 0 && (
    <div style={{ marginBottom: 14 }}>
      <label style={S.lbl}>{t('create.opponent_label')}</label>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {others.map(m => {
          const active = opponentId === m.id;
          return (
            <button key={m.id} onClick={() => setOpponentId(m.id)}
              style={{
                display:'inline-flex', alignItems:'center', gap:8,
                padding:'8px 14px 8px 8px', borderRadius:24,
                border:`1px solid ${active ? 'var(--gold)' : 'var(--brd)'}`,
                background: active ? 'var(--gold)1a' : 'transparent',
                color: active ? 'var(--gold)' : 'var(--dim)',
                cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:600,
                transition:'all .15s',
              }}>
              {m.avatarUrl
                ? <img src={m.avatarUrl} alt="" style={{width:24,height:24,borderRadius:'50%',objectFit:'cover'}}/>
                : <span style={{fontSize:18,lineHeight:1}}>{m.avatar || '😊'}</span>}
              <span>{m.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // Subset selector: only relevant for OPEN bets when the group has 3+ members.
  // The "all" mode is the default (empty set). Toggling individuals switches
  // to "only these" mode. Selecting everyone collapses back to "all" on submit.
  const SubsetBlock = betType === 'open' && others.length >= 2 && (
    <div style={{ marginBottom: 14 }}>
      <label style={S.lbl}>{t('create.subset_label')}</label>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
        <button onClick={() => setAllowedSet(new Set())}
          style={{
            padding:'8px 14px', borderRadius:24,
            border:`1px solid ${allowedSet.size === 0 ? 'var(--gold)' : 'var(--brd)'}`,
            background: allowedSet.size === 0 ? 'var(--gold)1a' : 'transparent',
            color: allowedSet.size === 0 ? 'var(--gold)' : 'var(--dim)',
            cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:600,
          }}>{t('create.subset_all')}</button>
        {others.map(m => {
          const active = allowedSet.has(m.id);
          return (
            <button key={m.id} onClick={() => toggleAllowed(m.id)}
              style={{
                display:'inline-flex', alignItems:'center', gap:8,
                padding:'8px 14px 8px 8px', borderRadius:24,
                border:`1px solid ${active ? 'var(--gold)' : 'var(--brd)'}`,
                background: active ? 'var(--gold)1a' : 'transparent',
                color: active ? 'var(--gold)' : 'var(--dim)',
                cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:600,
              }}>
              {m.avatarUrl
                ? <img src={m.avatarUrl} alt="" style={{width:24,height:24,borderRadius:'50%',objectFit:'cover'}}/>
                : <span style={{fontSize:18,lineHeight:1}}>{m.avatar || '😊'}</span>}
              <span>{m.name}</span>
              {active && <span style={{ fontSize: 11, color:'var(--gold)' }}>✓</span>}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--mut)' }}>
        {allowedSet.size === 0
          ? t('create.subset_hint_all')
          : t('create.subset_hint_some', { n: allowedSet.size })}
      </div>
    </div>
  );

  // Target = chi è oggetto della bet (es. "Maria arriverà in ritardo"). Diverso dall'avversario.
  // Visibile per ogni tipo tranne Vault; opponent escluso per chiarezza.
  const targetCandidates = others.filter(m => m.id !== opponentId);
  const TargetBlock = betType !== 'vault' && targetCandidates.length > 0 && (
    <div style={{ marginBottom: 14 }}>
      <label style={S.lbl}>{t('create.target_label')}</label>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        <button onClick={() => setTargetId(null)}
          style={{
            padding:'8px 14px', borderRadius:24,
            border:`1px solid ${!targetId ? 'var(--gold)' : 'var(--brd)'}`,
            background: !targetId ? 'var(--gold)1a' : 'transparent',
            color: !targetId ? 'var(--gold)' : 'var(--dim)',
            cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:600,
          }}>—  {t('create.target_none')}</button>
        {targetCandidates.map(m => {
          const active = targetId === m.id;
          return (
            <button key={m.id} onClick={() => setTargetId(m.id)}
              style={{
                display:'inline-flex', alignItems:'center', gap:8,
                padding:'8px 14px 8px 8px', borderRadius:24,
                border:`1px solid ${active ? 'var(--pur)' : 'var(--brd)'}`,
                background: active ? 'var(--pur)1a' : 'transparent',
                color: active ? 'var(--pur)' : 'var(--dim)',
                cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:600,
              }}>
              {m.avatarUrl
                ? <img src={m.avatarUrl} alt="" style={{width:24,height:24,borderRadius:'50%',objectFit:'cover'}}/>
                : <span style={{fontSize:18,lineHeight:1}}>{m.avatar || '😊'}</span>}
              <span>🎯 {m.name}</span>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 6, lineHeight: 1.4 }}>
        {t('create.target_hint')}
      </div>
    </div>
  );

  const TitleBlock = (
    <div style={{marginBottom:16}}>
      <label style={S.lbl}>{t('create.bet_label')}</label>
      <Inp value={title} onChange={e=>setTitle(e.target.value)} placeholder={isSecret?t('create.bet_placeholder_sec'):t('create.bet_placeholder_pub')}/>
    </div>
  );

  const QuotaBlock = (
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
  );

  const StakeBlock = (
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
      {!isDesktop && (
        <>
          {needsApproval && (
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
        </>
      )}
    </div>
  );

  const CategoryBlock = (
    <div style={{marginBottom:16}}>
      <label style={S.lbl}>{t('create.category_label')}</label>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {cats.map(c=>(
          <button key={c.id} onClick={()=>setCat(c.id)} style={{...S.btn,padding:"7px 12px",fontSize:12,background:"transparent",border:`1px solid ${cat===c.id?c.color:"var(--brd)"}`,color:cat===c.id?c.color:"var(--dim)"}}>{c.e} {catLabel(c)}</button>
        ))}
      </div>
    </div>
  );

  const PegnoBlock = (
    <div style={{marginBottom: isDesktop ? 0 : 14}}>
      <label style={S.lbl}>{t('create.forfeit_label')}</label>
      <Inp value={pegno} onChange={e=>setPegno(e.target.value)} placeholder={t('create.forfeit_placeholder')}/>
    </div>
  );

  const ExpiryBlock = (
    <div style={{marginBottom: isDesktop ? 0 : 24}}>
      <label style={S.lbl}>{t('create.expires_label')}</label>
      <input type="datetime-local" value={exp} onChange={e=>setExp(e.target.value)} style={{...S.inp,colorScheme:"dark"}}/>
    </div>
  );

  // ─── Desktop layout ───────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.78)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20}}>
        <div className="bIn" style={{
          background:"var(--surf)", borderRadius:18, width:"100%", maxWidth:980,
          maxHeight:"92vh", display:"flex", flexDirection:"column",
          border:"1px solid var(--brd)", boxShadow:"0 24px 64px rgba(0,0,0,.5)",
        }}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 24px",borderBottom:"1px solid var(--brd)",flexShrink:0}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700}}>{t('create.title')}</div>
            <Btn variant="ghost" sm onClick={onClose}>✕</Btn>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 360px",flex:1,minHeight:0}}>
            <div style={{padding:"22px 24px",overflowY:"auto"}}>
              {TemplatesBlock}
              {TypeBlock}
              {OpponentBlock}
              {SubsetBlock}
              {TargetBlock}
              {TitleBlock}
              {QuotaBlock}
              {StakeBlock}
              {CategoryBlock}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {PegnoBlock}
                {ExpiryBlock}
              </div>
            </div>
            <div style={{padding:"22px 24px",borderLeft:"1px solid var(--brd)",background:"linear-gradient(135deg,var(--card),var(--surf))",overflowY:"auto"}}>
              <SecLabel>{t('create.preview')}</SecLabel>
              <LivePreview
                title={title} quota={quota} stake={stake} potWin={potWin}
                cat={selectedCat} catLabel={catLabel}
                isSecret={isSecret} isCnt={isCnt}
                pegno={pegno} exp={exp}
                profile={profiles[user]}
                opponentProfile={opponent ? profiles[opponent] : null}
                t={t}
              />
              <div style={{height:14}}/>
              <SecLabel>{t('create.summary')}</SecLabel>
              <Summary stake={stake} potWin={potWin} maxC={maxC} t={t} />
              {needsApproval && (
                <div style={{fontSize:12,color:"var(--gold)",marginTop:12,padding:"10px 12px",background:"var(--gold)14",borderRadius:10,border:"1px solid var(--gold)44"}}>
                  ⚠ {t('create.acceptance_required',{name:profiles[opponent]?.name??'...'})}
                </div>
              )}
              {!needsApproval && opponent && !isSecret && stake > 0 && threshold !== Infinity && (
                <div style={{fontSize:12,color:"var(--grn)",marginTop:12,padding:"10px 12px",background:"var(--grn)11",borderRadius:10,border:"1px solid var(--grn)33"}}>
                  {t('create.below_threshold', { threshold })}
                </div>
              )}
            </div>
          </div>

          <div style={{display:"flex",gap:10,justifyContent:"space-between",alignItems:"center",padding:"14px 24px",borderTop:"1px solid var(--brd)",flexShrink:0}}>
            {SaveAsTemplateBtn}
            <div style={{display:'flex',gap:10}}>
              <Btn variant="ghost" onClick={onClose}>{t('reveal.cancel')}</Btn>
              <Btn variant="gold" onClick={submit} style={{padding:"12px 24px",fontSize:14}}>
                {isSecret?t('create.submit_secret'):t('create.submit_shared')}
              </Btn>
            </div>
          </div>

          {showSaveDialog && (
            <SaveTemplateDialog
              name={tplName} setName={setTplName}
              onCancel={() => setShowSaveDialog(false)}
              onSave={saveAsTemplate} t={t}
            />
          )}
        </div>
      </div>
    );
  }

  // ─── Mobile layout (bottom sheet, unchanged behavior) ─────────────────
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100}}>
      <div className="sUp" style={{background:"var(--surf)",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,padding:"24px 20px 36px",maxHeight:"92vh",overflowY:"auto",borderTop:"1px solid var(--brd)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700}}>{t('create.title')}</div>
          <Btn variant="ghost" sm onClick={onClose}>✕</Btn>
        </div>

        {TemplatesBlock}
        {TypeBlock}
        {OpponentBlock}
        {SubsetBlock}
        {TargetBlock}
        {TitleBlock}
        {QuotaBlock}
        {StakeBlock}
        {CategoryBlock}
        {PegnoBlock}
        {ExpiryBlock}

        <Btn variant="gold" full onClick={submit}>{isSecret?t('create.submit_secret'):t('create.submit_shared')}</Btn>
        <div style={{textAlign:'center'}}>{SaveAsTemplateBtn}</div>

        {showSaveDialog && (
          <SaveTemplateDialog
            name={tplName} setName={setTplName}
            onCancel={() => setShowSaveDialog(false)}
            onSave={saveAsTemplate} t={t}
          />
        )}
      </div>
    </div>
  );
}

function SaveTemplateDialog({ name, setName, onCancel, onSave, t }) {
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.7)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:120, padding:20}}>
      <div className="bIn" style={{
        background:'var(--surf)', border:'1px solid var(--gold)44', borderRadius:14,
        padding:20, width:'100%', maxWidth:360,
      }}>
        <div style={{fontFamily:"'Playfair Display', serif", fontSize:18, fontWeight:700, marginBottom:10}}>
          💾 {t('templates.save_as_btn').replace('💾 ', '')}
        </div>
        <label style={{fontSize:10,color:'var(--dim)',letterSpacing:2,textTransform:'uppercase'}}>
          {t('templates.name_label')}
        </label>
        <Inp value={name} onChange={e => setName(e.target.value.slice(0, 60))}
          placeholder={t('templates.name_ph')} style={{marginTop:6, marginBottom:14}}/>
        <div style={{display:'flex', gap:8}}>
          <Btn variant="ghost" style={{flex:1}} onClick={onCancel}>{t('reveal.cancel')}</Btn>
          <Btn variant="gold" style={{flex:1}} onClick={onSave}>{t('settings.pin_save')}</Btn>
        </div>
      </div>
    </div>
  );
}
