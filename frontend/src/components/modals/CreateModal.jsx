import React, { useState, useEffect, useRef } from 'react';
import { Btn, Inp, Toggle, SecLabel, Q_PRE, qToP, pToQ, fmtQ, clamp, DEF_CAT_IDS as DEF_IDS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import { useToast } from '../../Toast.jsx';
import * as api from '../../api.js';

// Editorial re-skin: labels become tracked uppercase micro-meta, inputs lose
// their box for underline-only, "btn" chips become tracked-pill outlines,
// card pattern is a soft tinted callout for the payout summary.
const S = {
  lbl: {fontSize:9,color:"var(--dim)",letterSpacing:".3em",textTransform:"uppercase",fontWeight:600,display:"block",marginBottom:10},
  inp: {background:"transparent",border:0,borderBottom:"1px solid var(--brd)",color:"var(--txt)",borderRadius:0,padding:"8px 2px",fontFamily:"'Manrope',sans-serif",fontSize:15,outline:"none",width:"100%"},
  btn: {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"8px 14px",borderRadius:999,border:"none",cursor:"pointer",fontFamily:"'Manrope',sans-serif",fontSize:11,fontWeight:600,letterSpacing:".08em",transition:"all .18s",userSelect:"none",whiteSpace:"nowrap"},
  card: {background:"var(--soft)",border:"1px solid var(--rule)",borderRadius:4,padding:14},
  bdg: {display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:999,fontSize:10,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"},
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

// Live preview — same editorial language as BetCard: thin colored rule on
// the left, italic Cormorant title (quoted), Playfair numerals for quota,
// tracked uppercase meta. No card box, just the rule + content.
function LivePreview({ title, quota, stake, potWin, cat, catLabel, isSecret, isCnt, pegno, exp, profile, opponentProfile, t }) {
  const sideColor = isSecret ? "var(--gold)" : (cat?.color ?? "var(--blu)");
  const tlValue = exp ? new Date(exp).getTime() : null;
  const titleDisplay = title.trim()
    ? `“${title}”`
    : `“${t('create.bet_label')}…”`;
  return (
    <div style={{position:"relative", padding:"18px 0 18px 22px", borderBottom:"1px solid var(--rule)"}}>
      <div style={{position:"absolute", left:0, top:18, bottom:20, width:2, background:sideColor}}/>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:14, marginBottom:10}}>
        <div style={{flex:1, minWidth:0}}>
          {isSecret ? (
            <div style={{display:"flex", alignItems:"center", gap:8}}>
              <span style={{fontSize:16}}>🔒</span>
              <span style={{fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic', fontSize:20, fontWeight:600, color:"var(--gold)"}}>{t('bet_card.secret_label')}</span>
            </div>
          ) : (
            <div style={{
              fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
              fontSize:20, fontWeight:600, lineHeight:1.18, letterSpacing:'-0.005em',
              color: title.trim() ? 'var(--txt)' : 'var(--mut)',
              wordBreak:"break-word",
            }}>{titleDisplay}</div>
          )}
          <div className="bc-meta" style={{fontSize:8, marginTop:8}}>
            <span style={{color:cat?.color}}>{cat?.e}</span> {catLabel(cat)} · ora
          </div>
        </div>
        {!isSecret && (
          <div style={{textAlign:"right", flexShrink:0, paddingTop:2}}>
            <div className="bc-num" style={{fontSize:24, color:"var(--gold)", lineHeight:1}}>
              {fmtQ(quota)}<span style={{fontSize:'0.55em', opacity:.7}}>×</span>
            </div>
            <div className="bc-meta" style={{fontSize:7, marginTop:4}}>{qToP(quota)}%</div>
          </div>
        )}
      </div>
      <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
        {!isSecret && <>
          <Bdg bg="var(--soft)" c="var(--dim)">{t('bet_card.stake')} {stake}₡</Bdg>
          <Bdg bg="var(--grn)18" c="var(--grn)">{t('bet_card.win')} {potWin}₡</Bdg>
        </>}
        {pegno && <Bdg bg="var(--gold)22" c="var(--gold)">🎁 {pegno}</Bdg>}
        {tlValue && <Bdg bg="var(--soft)" c="var(--dim)">⏱ {new Date(tlValue).toLocaleDateString()}</Bdg>}
      </div>
      {!isSecret && isCnt && opponentProfile && (
        <div style={{borderTop:"1px solid var(--rule)", paddingTop:10, marginTop:10}}>
          <div className="bc-meta" style={{fontSize:8, marginBottom:8}}>{t('bet_card.challenge')}</div>
          <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
            <Bdg bg="var(--grn)18" c="var(--grn)">{profile?.avatar} {t('bet_card.yes')} @ {fmtQ(quota)}×</Bdg>
            <Bdg bg="var(--red)18" c="var(--red)">{opponentProfile.avatar} {t('bet_card.no')} @ {fmtQ(qNo(quota))}×</Bdg>
          </div>
        </div>
      )}
    </div>
  );
}

// Summary — editorial table: hairline rows, Playfair numerals, no card.
function Summary({ stake, potWin, maxC, t }) {
  const net = potWin - stake;
  const balance = Math.round(maxC ?? 0);
  const balanceWin = balance + net;
  const balanceLose = balance - stake;
  const row = (label, value, color, opts={}) => (
    <div style={{
      display:"flex", justifyContent:"space-between", alignItems:"baseline",
      padding:"10px 0",
      borderTop: opts.first ? 'none' : opts.dashed ? '1px dashed var(--gold)44' : '1px solid var(--rule)',
    }}>
      <div className="bc-meta" style={{fontSize:8}}>{label}</div>
      <div className="bc-num" style={{fontSize:18, color}}>{value}<span style={{fontSize:'0.55em',opacity:.6,marginLeft:3}}>₡</span></div>
    </div>
  );
  return (
    <div style={{padding:"4px 0"}}>
      {row(t('create.risks'),         `−${stake}`,   "var(--red)",  {first:true})}
      {row(t('create.net'),           `+${net}`,     "var(--grn)")}
      {row(t('create.total'),         `${potWin}`,   "var(--gold)")}
      {row(t('create.balance_win'),   `${balanceWin}`,  "var(--grn)", {dashed:true})}
      {row(t('create.balance_lose'),  `${balanceLose}`, "var(--red)")}
    </div>
  );
}

// One slot column. Renders the symbol stack inside a fixed-height window
// and uses a `transform` transition to settle on the final "7" centered
// in the window. The parent supplies a `key` that changes every spin so
// this component remounts → initial translateY(0) → next-frame transition
// to the final translate. This guarantees the same animation plays even
// for a second jackpot in the same modal session.
function SlotReel({ symbols, cellW, itemH, fontPx, reelLen, durationMs }) {
  const [y, setY] = useState(0);
  const finalY = -(reelLen - 1) * itemH;
  useEffect(() => {
    // Two RAFs: the first lets React commit translateY(0); the second
    // flips the transform to the final value so the browser interpolates.
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => setY(finalY));
      // store so cleanup can cancel
      cancelHolder.r2 = r2;
    });
    const cancelHolder = { r1, r2: 0 };
    return () => {
      cancelAnimationFrame(cancelHolder.r1);
      if (cancelHolder.r2) cancelAnimationFrame(cancelHolder.r2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      width: cellW, height: itemH,
      overflow: 'hidden', position: 'relative',
      background: 'rgba(0,0,0,.35)', borderRadius: 4,
      border: '1px solid var(--gold)55',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column',
        transform: `translateY(${y}px)`,
        // Strong ease-out so the reel feels like it crash-decelerates.
        transition: `transform ${durationMs}ms cubic-bezier(.07,.78,.32,1)`,
      }}>
        {symbols.map((s, j) => (
          <div key={j} style={{
            height: itemH, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Playfair Display',serif", fontWeight: 900,
            fontSize: fontPx, lineHeight: 1,
            color: 'var(--gold)',
            filter: 'drop-shadow(0 0 6px rgba(196,168,120,.6))',
          }}>{s}</div>
        ))}
      </div>
    </div>
  );
}

export default function CreateModal({user,profiles,groupMembers,maxC,cats,settings={},onCreate,onClose,onEggUnlock}){
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

  // Easter egg #3: JACKPOT titles trigger a slot-machine overlay BEFORE the
  // bet is actually submitted. The flow is now a three-phase one so the
  // close isn't an abrupt cut:
  //   1. 'spinning' — reels spin staggered (≈3.1s)
  //   2. 'celebrating' — "JACKPOT!" pulses (≈0.9s)
  //   3. 'fading' — overlay fades out smoothly (≈0.7s), then submit fires
  // Tap anywhere skips ahead to 'fading'.
  const [jackpotPhase, setJackpotPhase] = useState(null); // null | 'spinning' | 'celebrating' | 'fading'
  const jackpotTimersRef = useRef([]);
  // Bumps every time the jackpot fires — used as a React `key` on each
  // reel so they remount with translateY(0) and re-trigger their
  // transition to the final position. Without this, a second jackpot in
  // the same modal session would render reels already at the final 7.
  const [slotInstance, setSlotInstance] = useState(0);
  const isMagicTitle = (s) => {
    const v = s.trim().toLowerCase();
    return v === '777' || v === 'jackpot' || v === '💎💎💎';
  };

  const clearJackpotTimers = () => {
    jackpotTimersRef.current.forEach(clearTimeout);
    jackpotTimersRef.current = [];
  };

  const doActualSubmit = () => {
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

  // Start the smooth exit: fade overlay, then submit when fade ends.
  const startJackpotFade = () => {
    clearJackpotTimers();
    setJackpotPhase('fading');
    jackpotTimersRef.current.push(setTimeout(() => {
      setJackpotPhase(null);
      doActualSubmit();
    }, 700));
  };

  const submit=()=>{
    if(!title.trim()){toast.error(t('create.err_title'));return;}
    if(stake<=0||stake>maxStake){toast.error(t('create.err_stake',{max:Math.round(maxStake)}));return;}
    if(needsOpponent && !opponentId){toast.error(t('create.opponent_pick'));return;}

    if (isMagicTitle(title)) {
      setSlotInstance(n => n + 1);
      setJackpotPhase('spinning');
      // Server returns { ok, alreadyUnlocked }. Only fire the popup on a
      // genuine first-time unlock — repeat 777 titles still trigger the
      // slot animation but don't re-pop the trophy banner.
      api.unlockSecretAchievement('egg_jackpot')
        .then(r => { if (!r?.alreadyUnlocked) onEggUnlock?.('egg_jackpot'); })
        .catch(e => console.error('[egg_jackpot] unlock failed', e));
      // Phase transition timers — kept in a ref so user-skip can clear them.
      jackpotTimersRef.current.push(setTimeout(() => setJackpotPhase('celebrating'), 3700));
      jackpotTimersRef.current.push(setTimeout(startJackpotFade, 4600));
      return;
    }
    doActualSubmit();
  };

  // Cleanup on unmount.
  useEffect(() => () => clearJackpotTimers(), []);

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
              cursor:'pointer', fontFamily:"'Manrope',sans-serif", fontSize:12, fontWeight:600,
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
        fontFamily:"'Manrope',sans-serif", fontSize:11, fontWeight:600,
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

  // Type selector — editorial: tracked uppercase tabs in a row, active state
  // = bold + colored underline. The description sits as italic Cormorant
  // pull-quote below the row, updating live with selection.
  const TypeBlock = (
    <div style={{ marginBottom: 24 }}>
      <label style={S.lbl}>{t('create.type_label')}</label>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'clamp(14px, 4vw, 28px)', borderBottom:'1px solid var(--rule)', paddingBottom:8, marginBottom:14 }}>
        {TYPE_OPTIONS.map(o => {
          const disabled = o.requiresOther && others.length === 0;
          const active = betType === o.key;
          return (
            <button key={o.key} type="button"
              onClick={() => { if (!disabled) setBetType(o.key); }}
              disabled={disabled}
              style={{
                padding:'4px 0', cursor: disabled ? 'not-allowed' : 'pointer',
                background:'transparent', border:'none',
                fontFamily:"'Manrope',sans-serif",
                fontSize:11, fontWeight: active ? 700 : 600,
                letterSpacing:'.22em', textTransform:'uppercase',
                color: active ? o.color : 'var(--dim)',
                borderBottom: `2px solid ${active ? o.color : 'transparent'}`,
                marginBottom:-9,
                opacity: disabled ? .35 : 1,
                transition:'all .18s',
              }}>
              {t('create.type_'+o.key)}
            </button>
          );
        })}
      </div>
      {(() => {
        const o = TYPE_OPTIONS.find(x => x.key === betType);
        if (!o) return null;
        return (
          <div style={{
            fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
            fontSize:14, fontWeight:500, lineHeight:1.5, color:'var(--dim)',
            paddingLeft: 14, borderLeft:`2px solid ${o.color}`,
          }}>
            {t('create.type_'+o.key+'_desc')}
          </div>
        );
      })()}
      {others.length === 0 && (
        <div className="bc-meta" style={{ marginTop: 14, fontSize: 9, color: 'var(--mut)', textTransform:'none', letterSpacing:'.02em', fontStyle:'italic' }}>
          {t('create.no_others_hint')}
        </div>
      )}
    </div>
  );

  const OpponentBlock = needsOpponent && others.length > 0 && (
    <div style={{ marginBottom: 24 }}>
      <label style={S.lbl}>{t('create.opponent_label')}</label>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {others.map(m => {
          const active = opponentId === m.id;
          return (
            <button key={m.id} type="button" onClick={() => setOpponentId(m.id)}
              style={{
                display:'inline-flex', alignItems:'center', gap:10,
                padding:'6px 16px 6px 6px', borderRadius:999,
                border:`1px solid ${active ? 'var(--gold)' : 'var(--rule)'}`,
                background: active ? 'var(--soft)' : 'transparent',
                color: active ? 'var(--gold)' : 'var(--txt)',
                cursor:'pointer', fontFamily:"'Manrope',sans-serif", fontSize:13, fontWeight: active ? 600 : 500,
                letterSpacing:'.01em',
                transition:'all .15s',
              }}>
              {m.avatarUrl
                ? <img src={m.avatarUrl} alt="" style={{width:26,height:26,borderRadius:'50%',objectFit:'cover'}}/>
                : <span style={{fontSize:18,lineHeight:1}}>{m.avatar || '😊'}</span>}
              <span style={{fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic', fontSize:15}}>{m.name}</span>
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
            cursor:'pointer', fontFamily:"'Manrope',sans-serif", fontSize:13, fontWeight:600,
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
                cursor:'pointer', fontFamily:"'Manrope',sans-serif", fontSize:13, fontWeight:600,
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
            cursor:'pointer', fontFamily:"'Manrope',sans-serif", fontSize:13, fontWeight:600,
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
                cursor:'pointer', fontFamily:"'Manrope',sans-serif", fontSize:13, fontWeight:600,
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

  // Centerpiece of the form — the bet title becomes a giant italic
  // Cormorant textarea you write directly into. No box, no label above.
  // Auto-grows with content. Quote marks render around in absolute so
  // they don't interfere with the caret.
  const TitleBlock = (
    <div style={{position:'relative', margin:'4px 0 32px', paddingLeft: isDesktop ? 18 : 14}}>
      <span aria-hidden style={{
        position:'absolute', top:-4, left:-2,
        fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
        fontSize:'clamp(36px, 8vw, 56px)', lineHeight:1,
        color:'var(--gold)', opacity:.55, pointerEvents:'none',
      }}>“</span>
      <textarea
        value={title}
        onChange={e=>setTitle(e.target.value)}
        placeholder={isSecret?t('create.bet_placeholder_sec'):t('create.bet_placeholder_pub')}
        rows={2}
        style={{
          width:'100%', resize:'none', overflow:'hidden',
          background:'transparent', border:0, outline:'none',
          fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
          fontSize:'clamp(24px, 5.5vw, 38px)', lineHeight:1.18,
          fontWeight:600, letterSpacing:'-0.01em',
          color:'var(--txt)',
          padding:'0 0 8px',
          borderBottom:'1px solid var(--rule)',
        }}
        onInput={e=>{
          e.target.style.height='auto';
          e.target.style.height = e.target.scrollHeight + 'px';
        }}
      />
    </div>
  );

  // Probability becomes the hero — giant Playfair number drives the visual
  // weight. Preset chips become small underline pills, slider stays as
  // accent. Direct-quota input lives in a tiny side label.
  const QuotaBlock = (
    <div style={{marginBottom:24}}>
      <label style={S.lbl}>{t('create.quota_label')}</label>

      {/* Giant probability + payoff multiplier */}
      <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:18, marginBottom:14}}>
        <div className="bc-num" style={{fontSize:'clamp(42px, 10vw, 72px)', color:probC, lineHeight:.9}}>
          {prob}<span style={{fontSize:'0.45em', color:'var(--dim)', marginLeft:3, fontWeight:400}}>%</span>
        </div>
        <div style={{textAlign:'right', flexShrink:0, transform:'translateY(-4px)'}}>
          <div className="bc-meta" style={{fontSize:8, marginBottom:4}}>Quota</div>
          <div className="bc-num" style={{fontSize:'clamp(22px, 5vw, 32px)', color:'var(--gold)'}}>
            {fmtQ(quota)}<span style={{fontSize:'0.55em', opacity:.6}}>×</span>
          </div>
        </div>
      </div>

      {/* Slider, hairline rule treatment */}
      <input type="range" min="5" max="95" step="1" className="bc" value={clamp(prob,5,95)}
        onChange={e=>setQuota(pToQ(parseInt(e.target.value)))}
        style={{marginBottom:6, width:"100%", height:4, borderRadius:999, outline:"none", cursor:"pointer", accentColor:"var(--pur)"}}/>
      <div className="bc-meta" style={{display:"flex", justifyContent:"space-between", fontSize:8, marginBottom:16, textTransform:'none', letterSpacing:'.18em'}}>
        <span>{t('create.impossible')}</span><span>{t('create.certain')}</span>
      </div>

      {/* Presets — sit on a hairline, marked active by underline */}
      <div style={{display:"flex", flexWrap:"wrap", gap:'clamp(10px, 3vw, 18px)', borderBottom:'1px solid var(--rule)', paddingBottom:10, marginBottom:14}}>
        {Q_PRE.map(p=>{
          const active = Math.abs(quota-p.q)<.06;
          return (
            <button key={p.q} type="button" onClick={()=>setQuota(p.q)} style={{
              padding:'2px 0', background:'transparent', border:'none', cursor:'pointer',
              fontFamily:"'Manrope',sans-serif", fontSize:10, fontWeight: active ? 700 : 600,
              letterSpacing:'.2em', textTransform:'uppercase',
              color: active ? 'var(--gold)' : 'var(--dim)',
              borderBottom: `2px solid ${active ? 'var(--gold)' : 'transparent'}`,
              marginBottom:-11, transition:'all .18s',
            }}>{t('qpre.'+p.key)}</button>
          );
        })}
      </div>

      {/* Direct numeric tweak — tiny inline */}
      <div style={{display:"flex", alignItems:"center", gap:14}}>
        <span className="bc-meta" style={{fontSize:8}}>{t('create.direct_quota')}</span>
        <Inp type="number" step=".05" min="1.05" max="50" value={quota}
          onChange={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)&&v>=1.05&&v<=50)setQuota(parseFloat(v.toFixed(2)));}}
          style={{width:96, fontFamily:"'Playfair Display',serif", fontSize:18, padding:'4px 2px'}}/>
        {!isSecret&&isCnt&&(
          <span className="bc-meta" style={{fontSize:8}}>
            {t('create.no_label')} <span style={{color:"var(--red)", fontWeight:700, fontFamily:"'Playfair Display',serif", fontSize:14, letterSpacing:'-0.02em', marginLeft:4}}>{fmtQ(qNo(quota))}×</span>
          </span>
        )}
      </div>
    </div>
  );

  // Stake — same editorial language as Quota: hero numeral, underline-pill
  // presets, summary line as hairline-separated columns (no card box).
  const StakeBlock = (
    <div style={{marginBottom:24}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:14}}>
        <label style={{...S.lbl, marginBottom:0}}>{t('create.stake_label')}</label>
        <span className="bc-meta" style={{fontSize:8}}>{t('create.stake_max')} <span style={{fontFamily:"'Playfair Display',serif", fontSize:14, letterSpacing:'-0.02em', color:'var(--gold)', marginLeft:3}}>{Math.round(maxStake)}₡</span></span>
      </div>

      {/* Hero stake number */}
      <div className="bc-num" style={{fontSize:'clamp(42px, 10vw, 72px)', color:'var(--gold)', lineHeight:.9, marginBottom:14}}>
        {stake || 0}<span style={{fontSize:'0.45em', color:'var(--dim)', marginLeft:3, fontWeight:400}}>₡</span>
      </div>

      {/* Preset chips — underline pills */}
      <div style={{display:"flex", gap:'clamp(14px, 4vw, 24px)', borderBottom:'1px solid var(--rule)', paddingBottom:10, marginBottom:14}}>
        {[5,10,20,50].map(s=>{
          const active = stake===s;
          const disabled = s > maxStake;
          return (
            <button key={s} type="button" onClick={()=>!disabled&&setStakeStr(String(s))}
              disabled={disabled}
              style={{
                padding:'2px 0', background:'transparent', border:'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontFamily:"'Manrope',sans-serif", fontSize:11, fontWeight: active ? 700 : 600,
                letterSpacing:'.2em',
                color: active ? 'var(--gold)' : 'var(--dim)',
                borderBottom: `2px solid ${active ? 'var(--gold)' : 'transparent'}`,
                marginBottom:-11,
                opacity: disabled ? .35 : 1, transition:'all .18s',
              }}>{s}</button>
          );
        })}
      </div>

      {/* Free numeric — underline input */}
      <Inp type="number" min="1" max={Math.floor(maxStake)} step="1" value={stakeStr}
        onChange={e=>setStakeStr(e.target.value)} placeholder={t('create.stake_placeholder')}/>

      {!isDesktop && (
        <>
          {needsApproval && (
            <div style={{
              fontSize:11, color:"var(--gold)", marginTop:16, padding:"10px 14px",
              background:"var(--gold)12", borderRadius:4, border:"1px solid var(--gold)33",
              letterSpacing:'.02em', fontStyle:'italic', fontFamily:"'Cormorant Garamond',serif",
            }}>
              {t('create.acceptance_required',{name:profiles[opponent]?.name??'...'})}
            </div>
          )}
          {/* Summary — three Playfair columns separated by vertical hairlines */}
          <div style={{
            display:"flex", marginTop:18, padding:"14px 0",
            borderTop:"1px solid var(--rule)", borderBottom:"1px solid var(--rule)",
          }}>
            {[
              {l:t('create.risks'), v:`−${stake}`, c:'var(--red)'},
              {l:t('create.net'),   v:`+${potWin-stake}`, c:'var(--grn)'},
              {l:t('create.total'), v:`${potWin}`, c:'var(--gold)'},
            ].map((s,i,arr)=>(
              <div key={s.l} style={{
                flex:1, textAlign: i===0?'left':i===arr.length-1?'right':'center',
                borderLeft: i===0?'none':'1px solid var(--rule)',
                paddingLeft: i===0?0:10,
              }}>
                <div className="bc-num" style={{fontSize:22, color:s.c}}>{s.v}<span style={{fontSize:'0.5em',opacity:.6,marginLeft:3}}>₡</span></div>
                <div className="bc-meta" style={{marginTop:6, fontSize:8}}>{s.l}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const CategoryBlock = (
    <div style={{marginBottom:24}}>
      <label style={S.lbl}>{t('create.category_label')}</label>
      <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
        {cats.map(c=>{
          const active = cat===c.id;
          return (
            <button key={c.id} type="button" onClick={()=>setCat(c.id)} style={{
              padding:'7px 14px', borderRadius:999, cursor:'pointer',
              border:`1px solid ${active ? c.color : 'var(--rule)'}`,
              background: active ? `${c.color}14` : 'transparent',
              color: active ? c.color : 'var(--dim)',
              fontFamily:"'Manrope',sans-serif", fontSize:11, fontWeight: active ? 700 : 600,
              letterSpacing:'.08em', textTransform:'uppercase',
              transition:'all .15s',
            }}>
              <span style={{marginRight:6, fontSize:14}}>{c.e}</span>{catLabel(c)}
            </button>
          );
        })}
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

  // Easter egg #3 — slot machine overlay. Three phases:
  // 'spinning'    → reels translate downward, columns stop staggered.
  // 'celebrating' → reels frozen with the 7s centered, JACKPOT text pulses in.
  // 'fading'      → whole overlay fades out smoothly before submit fires.
  // Tap anywhere at any time jumps straight to the fade.
  //
  // The reel geometry is intentionally pixel-fixed (not clamp/vw) so the
  // final translateY lands the "7" exactly centered in the visible
  // window. The reel is a vertical stack of `SLOT_REEL_LEN` cells, each
  // `SLOT_ITEM_H` tall; the last cell is "7", and after a transition to
  // translateY(-(SLOT_REEL_LEN-1) * SLOT_ITEM_H) only that "7" cell sits
  // inside the visible window.
  const SLOT_ITEM_H   = isDesktop ? 130 : 96;
  const SLOT_CELL_W   = isDesktop ? 100 : 74;
  const SLOT_FONT_PX  = isDesktop ? 78 : 60;
  const SLOT_REEL_LEN = 18; // 17 random fillers + one final '7'
  const SLOT_FILLERS  = ['🍒','🍋','💎','🔔','⭐','🍀','🎰','🍇'];
  // Per-reel filler stack — deterministic so React keys are stable across
  // renders inside a single jackpot instance.
  const buildReel = (seed) => {
    const out = [];
    for (let i = 0; i < SLOT_REEL_LEN - 1; i++) {
      out.push(SLOT_FILLERS[(seed * 17 + i * 11) % SLOT_FILLERS.length]);
    }
    out.push('7');
    return out;
  };

  const SlotMachine = jackpotPhase && (
    <div onClick={startJackpotFade} style={{
      position:'fixed', inset:0, zIndex:9600,
      background:'radial-gradient(circle at 50% 45%, rgba(43,34,71,.96) 0%, rgba(15,11,35,.98) 70%)',
      backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:24, cursor:'pointer',
      opacity: jackpotPhase === 'fading' ? 0 : 1,
      transform: jackpotPhase === 'fading' ? 'scale(.92)' : 'scale(1)',
      transition: 'opacity .65s ease, transform .65s ease',
    }}>
      <div className="bc-meta" style={{marginBottom:22, color:'var(--gold)'}}>— Jackpot</div>
      <div style={{
        display:'flex', gap: isDesktop ? 18 : 10,
        padding: isDesktop ? '28px 38px' : '20px 22px',
        border:'2px solid var(--gold)', borderRadius:6,
        background:'rgba(15,11,35,.6)',
        boxShadow: jackpotPhase === 'celebrating'
          ? '0 0 90px rgba(196,168,120,.7), inset 0 0 30px rgba(196,168,120,.25)'
          : '0 0 50px rgba(196,168,120,.45), inset 0 0 20px rgba(196,168,120,.15)',
        transition: 'box-shadow .5s ease',
      }}>
        {[0, 1, 2].map(i => (
          <SlotReel
            key={`${slotInstance}-${i}`}
            symbols={buildReel(slotInstance * 31 + i + 1)}
            cellW={SLOT_CELL_W}
            itemH={SLOT_ITEM_H}
            fontPx={SLOT_FONT_PX}
            reelLen={SLOT_REEL_LEN}
            durationMs={2400 + i * 600}
          />
        ))}
      </div>
      {/* JACKPOT title — only visible from 'celebrating' phase onward */}
      <div style={{
        marginTop:36,
        fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
        fontSize:'clamp(36px, 8vw, 72px)', fontWeight:600,
        color:'var(--gold)', letterSpacing:'-0.02em',
        textShadow:'0 0 30px rgba(196,168,120,.5)',
        opacity: jackpotPhase === 'spinning' ? 0 : 1,
        transform: jackpotPhase === 'spinning' ? 'scale(.6) translateY(20px)' : 'scale(1) translateY(0)',
        transition: 'opacity .55s cubic-bezier(.34,1.56,.64,1), transform .55s cubic-bezier(.34,1.56,.64,1)',
      }}>JACKPOT!</div>
      <div className="bc-meta" style={{
        marginTop: 36, color:'var(--mut)', fontSize:8,
        animation: 'fIn .4s ease both 1.2s',
        opacity: jackpotPhase === 'fading' ? 0 : 1,
        transition: 'opacity .3s ease',
      }}>tocca per saltare</div>
    </div>
  );

  // ─── Desktop layout ───────────────────────────────────────────────────
  if (isDesktop) {
    return (<>
      {SlotMachine}
      <div style={{position:"fixed",inset:0,background:"rgba(15,11,35,.78)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:24}}>
        <div className="bIn" style={{
          background:"var(--surf)", borderRadius:6, width:"100%", maxWidth:980,
          maxHeight:"92vh", display:"flex", flexDirection:"column",
          border:"1px solid var(--rule)", boxShadow:"0 30px 80px rgba(0,0,0,.55)",
        }}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",padding:"26px 32px 20px",borderBottom:"1px solid var(--rule)",flexShrink:0}}>
            <div>
              <div className="bc-meta" style={{marginBottom:8}}>— Nuovo bet</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:30,fontWeight:600,lineHeight:1,color:"var(--txt)"}}>{t('create.title')}</div>
            </div>
            <button onClick={onClose} style={{background:"transparent",border:"none",cursor:"pointer",color:"var(--dim)",fontSize:18,padding:4}}>✕</button>
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
    </>);
  }

  // ─── Mobile layout (bottom sheet, unchanged behavior) ─────────────────
  return (<>
    {SlotMachine}
    <div style={{position:"fixed",inset:0,background:"rgba(15,11,35,.78)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100}}>
      <div className="sUp" style={{background:"var(--surf)",borderRadius:"12px 12px 0 0",width:"100%",maxWidth:480,padding:"30px 26px 40px",maxHeight:"92vh",overflowY:"auto",borderTop:"1px solid var(--rule)",boxShadow:"0 -20px 60px rgba(0,0,0,.4)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:28}}>
          <div>
            <div className="bc-meta" style={{marginBottom:8}}>— Nuovo bet</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:28,fontWeight:600,lineHeight:1,color:"var(--txt)"}}>{t('create.title')}</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",cursor:"pointer",color:"var(--dim)",fontSize:18,padding:4}}>✕</button>
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
  </>);
}

function SaveTemplateDialog({ name, setName, onCancel, onSave, t }) {
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.7)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:120, padding:20}}>
      <div className="bIn" style={{
        background:'var(--surf)', border:'1px solid var(--gold)44', borderRadius:14,
        padding:20, width:'100%', maxWidth:360,
      }}>
        <div style={{fontFamily:"'Cormorant Garamond', serif", fontSize:22, fontWeight:600, marginBottom:10}}>
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
