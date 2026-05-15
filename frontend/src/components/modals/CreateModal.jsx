import React, { useState, useEffect, useRef } from 'react';
import { Btn, Inp, Toggle, SecLabel, Q_PRE, qToP, pToQ, fmtQ, clamp, COLORS, DEF_CAT_IDS as DEF_IDS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import { useToast } from '../../Toast.jsx';
import * as api from '../../api.js';
import CreateModalCoachmarks from './CreateModalCoachmarks.jsx';
import useEscClose from '../../hooks/useEscClose.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';

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

// Live preview — same editorial language as BetCard but expressed in
// absolute amounts (stake + win), never as a quota multiplier. The "×N"
// number was confusing users for non-sports bets — gone.
function LivePreview({ title, stake, potWin, cat, catLabel, isSecret, isCnt, pegno, exp, profile, opponentProfile, t }) {
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
            <div className="bc-num" style={{fontSize:24, color:"var(--grn)", lineHeight:1}}>
              {potWin}<span style={{fontSize:'0.55em', opacity:.7, marginLeft:3}}>₡</span>
            </div>
            <div className="bc-meta" style={{fontSize:7, marginTop:4}}>{t('create.win_short')}</div>
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
            <Bdg bg="var(--grn)18" c="var(--grn)">{profile?.avatar} {t('bet_card.yes')} · {potWin}₡</Bdg>
            <Bdg bg="var(--red)18" c="var(--red)">{opponentProfile.avatar} {t('bet_card.no')} · {Math.max(0, potWin - stake)}₡</Bdg>
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

export default function CreateModal({user,profiles,groupMembers,maxC,cats,settings={},onCreate,onClose,onEggUnlock,noviceMode=false}){
  useEscClose(onClose);
  useBodyScrollLock();
  // Coachmark-sequence state. Auto-opens when the modal is launched from
  // the onboarding tour (noviceMode prop). Always re-openable from the
  // "?" button in the header for users who skipped it or forgot.
  const [coachOpen, setCoachOpen] = useState(noviceMode);
  const scrollAreaRef = useRef(null);
  // Swipe-to-dismiss refs — declared before any conditional return (hooks rules).
  const sheetRef    = useRef(null);
  const backdropRef = useRef(null);
  const scrollRef   = useRef(null); // inner scroll area — needed to detect scrollTop
  // Stable ref for onClose so the gesture useEffect doesn't re-register on every render
  const onCloseRef  = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  // Velocity tracking: rolling window of last 5 touch points (y, t) → px/ms
  const velRef = useRef({ points: [], velocity: 0 });
  const { t } = useLang();
  const toast = useToast();
  const isDesktop = useBreakpoint(768);

  // ─── Sheet-wide swipe-to-dismiss (mobile only) ────────────────────────────
  // Registers non-passive touchmove so we can preventDefault during dismiss.
  // Logic: touch starts anywhere on sheet → if at scroll top + dragging down
  // → dismiss mode; otherwise → normal scroll, no interference.
  useEffect(() => {
    if (isDesktop) return;
    const sheet = sheetRef.current;
    if (!sheet) return;

    let startY = null;
    let startScrollTop = 0;
    let mode = null; // 'dismiss' | 'scroll' | null

    const onStart = e => {
      // Don't intercept touches on text inputs / selects
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      startY = e.touches[0].clientY;
      startScrollTop = scrollRef.current?.scrollTop ?? 0;
      mode = null;
      velRef.current = { points: [], velocity: 0 };
    };

    const onMove = e => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;

      // Commit to a mode after the first 6px of movement
      if (mode === null) {
        if (Math.abs(dy) < 6) return;
        mode = (dy > 0 && startScrollTop <= 0) ? 'dismiss' : 'scroll';
        if (mode === 'dismiss') {
          const s = sheetRef.current;
          if (s) { s.style.animation = 'none'; s.style.transition = 'none'; }
          if (backdropRef.current) backdropRef.current.style.transition = 'none';
        }
      }
      if (mode !== 'dismiss') return;

      e.preventDefault(); // block native scroll during dismiss drag

      const clampedDy = Math.max(0, dy);
      const now = performance.now();
      const pts = velRef.current.points;
      pts.push({ y: e.touches[0].clientY, t: now });
      if (pts.length > 5) pts.shift();
      if (pts.length >= 2) {
        const first = pts[0], last = pts[pts.length - 1];
        const dt = last.t - first.t;
        velRef.current.velocity = dt > 0 ? (last.y - first.y) / dt : 0;
      }

      const s = sheetRef.current;
      if (s) s.style.transform = `translateY(${clampedDy}px)`;
      if (backdropRef.current) {
        const op = Math.max(0, 0.78 - (clampedDy / 300) * 0.78);
        backdropRef.current.style.background = `rgba(15,11,35,${op.toFixed(2)})`;
      }
    };

    const onEnd = e => {
      if (startY === null) return;
      const savedMode = mode;
      const savedStartY = startY;
      startY = null; startScrollTop = 0; mode = null;

      if (savedMode !== 'dismiss') return;

      const endY = e.changedTouches[0]?.clientY ?? savedStartY;
      const dy = Math.max(0, endY - savedStartY);
      const vel = velRef.current.velocity;
      velRef.current = { points: [], velocity: 0 };

      const s = sheetRef.current;
      if (!s) return;

      const shouldDismiss = dy > 80 || (vel > 0.4 && dy > 10);
      if (shouldDismiss) {
        const dur = vel > 1.0 ? 160 : vel > 0.5 ? 210 : 260;
        s.style.transition = `transform ${dur}ms ease-in`;
        s.style.transform = 'translateY(110%)';
        if (backdropRef.current) {
          backdropRef.current.style.transition = `background ${dur}ms ease`;
          backdropRef.current.style.background = 'rgba(15,11,35,0)';
        }
        setTimeout(() => onCloseRef.current(), dur);
      } else {
        s.style.transition = 'transform .3s cubic-bezier(.25,.46,.45,.94)';
        s.style.transform = 'translateY(0)';
        if (backdropRef.current) {
          backdropRef.current.style.transition = 'background .3s ease';
          backdropRef.current.style.background = 'rgba(15,11,35,0.78)';
        }
      }
    };

    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove',  onMove,  { passive: false });
    sheet.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove',  onMove);
      sheet.removeEventListener('touchend',   onEnd);
    };
  }, [isDesktop]);
  const catLabel = c => c && (DEF_IDS.includes(c.id) ? t('cats.'+c.id) : c.label);

  // Other members of the group (excluding self). Falls back to "profiles minus self" if not provided yet.
  const others = (groupMembers && groupMembers.length
    ? groupMembers
    : Object.entries(profiles).map(([id,p])=>({id,...p}))
  ).filter(m => m.id !== user);

  const [title,setTitle]=useState("");
  // The user no longer sets a "quota" directly — they set "I bet X" (stake)
  // and "I win Y" (potWin). We compute quota = potWin/stake internally for
  // the API. Default winStr = 1.5× the default stake (probable-ish bet).
  const [stakeStr,setStakeStr]=useState("10");
  const [winStr,setWinStr]=useState("15");
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
    const tplStake = parseFloat(tpl.stake) || 10;
    const tplQuota = parseFloat(tpl.quota) || 1.5;
    setStakeStr(String(tplStake));
    // Backward-compat: templates were stored with a quota field; convert
    // back to a concrete win amount so the user sees it as "se vinco N".
    setWinStr(String(Math.round(tplStake * tplQuota)));
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
      // First-template toast tells the user *where* to find it next time.
      // Subsequent saves get the plain confirmation.
      const isFirst = templates.length === 0;
      if (isFirst) {
        try { localStorage.setItem('bc_templates_tip_dismissed', '1'); } catch {}
        toast.success(`${t('templates.first_saved_title')} — ${t('templates.first_saved_body')}`);
      } else {
        toast.success(t('templates.saved'));
      }
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
  const potWin=Math.max(0,parseFloat(winStr)||0);
  // Quota lives inside the math now — never shown to the user. We need it
  // only for the API + trophies/stats backward compat.
  const quota = stake > 0 ? Math.max(1.05, potWin / stake) : 1.5;
  const needsApproval=needsOpponent && stake>=threshold;
  const selectedCat = cats.find(c=>c.id===cat) || cats[0];

  // Hard cap on participants in an open bet — creator + 7 others = 8 max.
  // Above-cap groups must use subset mode.
  const MAX_PARTICIPANTS = 8;
  const maxOthers = MAX_PARTICIPANTS - 1;

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
    if(potWin<=0){toast.error(t('create.err_win'));return;}
    if(potWin<stake){toast.error(t('create.err_win_min',{stake:Math.round(stake)}));return;}
    if(needsOpponent && !opponentId){toast.error(t('create.opponent_pick'));return;}

    if (isMagicTitle(title)) {
      setSlotInstance(n => n + 1);
      setJackpotPhase('spinning');
      // Pop the trophy banner only on the first 777 ever on this device.
      // v2 LS key: set AFTER queue push fires (avoids "burnt" gates from
      // API failures that previously suppressed the popup forever).
      let popThisJackpot = false;
      try {
        if (!localStorage.getItem('bc_egg_jackpot_popped_v2')) popThisJackpot = true;
      } catch {}
      api.unlockSecretAchievement('egg_jackpot')
        .then(r => {
          if (popThisJackpot) {
            onEggUnlock?.('egg_jackpot');
            try { localStorage.setItem('bc_egg_jackpot_popped_v2', '1'); } catch {}
          }
          if (r?.metaUnlocked) onEggUnlock?.('egg_master');
        })
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
    <button data-coach="save-template"
      onClick={() => { setShowSaveDialog(true); setTplName(""); }}
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
    <div data-coach="type" style={{ marginBottom: 24 }}>
      <label style={S.lbl}>{t('create.type_label')}</label>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'clamp(14px, 4vw, 28px)', borderBottom:'1px solid var(--rule)', paddingBottom:8, marginBottom:14 }}>
        {TYPE_OPTIONS.map(o => {
          const disabled = o.requiresOther && others.length === 0;
          const active = betType === o.key;
          return (
            <button key={o.key} type="button"
              data-coach={`type-${o.key}`}
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

  // ─── Member picker primitives ─────────────────────────────────────
  // Compact avatar-grid + optional search. At 4-6 members the chip-row
  // layout scaled fine, but past 8 it became a wall of pills that
  // dominated the form. New pattern: 44px avatar circles, name shown
  // only via tooltip / aria-label / a "selezionato: …" summary line,
  // plus a search input when the group has 7+ members so picking
  // someone in a busy group is one keystroke + one tap.
  const SEARCH_THRESHOLD = 7;
  const [memberSearch, setMemberSearch] = useState('');
  const matchesSearch = (m) => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return true;
    return (m.name || '').toLowerCase().includes(q);
  };

  // Tile = avatar disc + name caption stacked vertically. Each tile sits
  // in a CSS-grid cell so layout adapts from 4 cols on phone to 8+ on
  // desktop without media queries. The colorKey ring around the avatar
  // disambiguates members who happen to share the same emoji avatar
  // (Atoms.jsx already does this for the standalone <Avatar> atom — we
  // mirror the same ring/halo treatment here for visual consistency).
  const MemberAvatar = ({ m, active, disabled, color = 'var(--gold)', size = 34, onClick }) => {
    const userColor = COLORS[m.colorKey] || '#5b8af0';
    return (
      <button type="button"
        onClick={() => { if (!disabled) onClick(m.id); }}
        disabled={disabled}
        aria-label={m.name}
        title={m.name}
        aria-pressed={active}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '4px 2px', borderRadius: 10,
          background: active ? `${color === 'var(--gold)' ? 'var(--gold)' : 'var(--pur)'}10` : 'transparent',
          border: `1px solid ${active ? color : 'transparent'}`,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? .35 : 1,
          minWidth: 0,
          transition: 'background .15s, border-color .15s',
          WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
        }}>
        <div style={{
          width: size, height: size, borderRadius: '50%',
          background: `${userColor}33`,
          border: `2px solid ${active ? color : `${userColor}88`}`,
          boxShadow: active
            ? `0 0 0 2px ${color === 'var(--gold)' ? 'var(--gold)22' : 'var(--pur)22'}, 0 0 10px ${userColor}55`
            : `0 0 6px ${userColor}33`,
          position: 'relative', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', fontSize: size * 0.46, lineHeight: 1,
          transition: 'box-shadow .2s, border-color .15s',
        }}>
          {m.avatarUrl
            ? <img src={m.avatarUrl} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/>
            : (m.avatar || '😊')}
          {active && (
            <div aria-hidden style={{
              position: 'absolute', top: -2, right: -2,
              width: 14, height: 14, borderRadius: '50%',
              background: color, color: '#1a1530',
              fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--surf)',
            }}>✓</div>
          )}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: active ? color : 'var(--dim)',
          letterSpacing: '.01em', maxWidth: '100%',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          lineHeight: 1.2,
        }}>{m.name}</span>
      </button>
    );
  };

  const MEMBER_GRID_STYLE = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
    gap: 4,
    width: '100%',
  };

  const SearchInput = ({ visible }) => visible && (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', marginBottom: 10,
      border: '1px solid var(--brd)', borderRadius: 999,
      background: 'var(--inp)',
    }}>
      <span aria-hidden style={{ color: 'var(--mut)', fontSize: 13 }}>🔍</span>
      <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
        placeholder={t('create.member_search_ph')}
        aria-label={t('create.member_search_ph')}
        style={{
          flex: 1, border: 'none', outline: 'none', background: 'transparent',
          color: 'var(--txt)', fontFamily: "'Manrope',sans-serif", fontSize: 13,
        }}/>
      {memberSearch && (
        <button onClick={() => setMemberSearch('')} aria-label="Pulisci ricerca"
          style={{ background:'transparent', border:'none', cursor:'pointer',
            color:'var(--mut)', fontSize:14, padding:'0 4px', lineHeight:1 }}>×</button>
      )}
    </div>
  );

  const summaryLine = (label, color = 'var(--gold)') => (
    <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 8, lineHeight: 1.5, minHeight: 18 }}>
      <span style={{ color: 'var(--mut)', letterSpacing: '.2em', textTransform: 'uppercase', fontSize: 9, fontWeight: 700, marginRight: 8 }}>
        →
      </span>
      <span style={{ color }}>{label}</span>
    </div>
  );

  const OpponentBlock = needsOpponent && others.length > 0 && (
    <div data-coach="opponent" style={{ marginBottom: 14 }}>
      <label style={S.lbl}>{t('create.opponent_label')}</label>
      <SearchInput visible={others.length >= SEARCH_THRESHOLD} />
      <div style={MEMBER_GRID_STYLE}>
        {others.filter(matchesSearch).map(m => (
          <MemberAvatar key={m.id} m={m}
            active={opponentId === m.id}
            color="var(--gold)"
            onClick={setOpponentId}/>
        ))}
      </div>
      {summaryLine(
        opponentId
          ? others.find(m => m.id === opponentId)?.name || ''
          : t('create.opponent_pick')
      )}
    </div>
  );

  // Subset selector: only relevant for OPEN bets when the group has 3+ members.
  // The "all" mode is the default (empty set). Toggling individuals switches
  // to "only these" mode. Selecting everyone collapses back to "all" on submit.
  // Groups larger than MAX_PARTICIPANTS-1 force the creator to pick a
  // subset — "tutti" can't include 8+ people. For smaller groups, "tutti"
  // is still valid and the cap is implicit.
  const mustUseSubset = others.length > maxOthers;
  const SubsetBlock = betType === 'open' && others.length >= 2 && (
    <div style={{ marginBottom: 14 }}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10}}>
        <label style={{...S.lbl, marginBottom:0}}>{t('create.subset_label')}</label>
        <span className="bc-meta" style={{fontSize:8}}>
          {allowedSet.size > 0 && t('create.subset_cap', { current: allowedSet.size, max: Math.min(maxOthers, others.length) })}
        </span>
      </div>
      <SearchInput visible={others.length >= SEARCH_THRESHOLD} />
      {!mustUseSubset && (
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => setAllowedSet(new Set())}
            aria-pressed={allowedSet.size === 0}
            style={{
              padding:'8px 14px', borderRadius:24,
              border:`1px solid ${allowedSet.size === 0 ? 'var(--gold)' : 'var(--brd)'}`,
              background: allowedSet.size === 0 ? 'var(--gold)1a' : 'transparent',
              color: allowedSet.size === 0 ? 'var(--gold)' : 'var(--dim)',
              cursor:'pointer', fontFamily:"'Manrope',sans-serif", fontSize:12, fontWeight:700,
              letterSpacing:'.06em',
            }}>{t('create.subset_all')}</button>
        </div>
      )}
      <div style={MEMBER_GRID_STYLE}>
        {others.filter(matchesSearch).map(m => {
          const active = allowedSet.has(m.id);
          const disabledByCap = !active && allowedSet.size >= maxOthers;
          return (
            <MemberAvatar key={m.id} m={m}
              active={active} disabled={disabledByCap}
              color="var(--gold)"
              onClick={toggleAllowed}/>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 8, lineHeight: 1.5 }}>
        {mustUseSubset
          ? t('create.subset_hint_cap', { max: maxOthers })
          : allowedSet.size === 0
            ? t('create.subset_hint_all')
            : t('create.subset_hint_some', { n: allowedSet.size })}
        {allowedSet.size > 0 && (
          <span style={{ display:'block', marginTop:4, color:'var(--gold)' }}>
            {Array.from(allowedSet)
              .map(id => others.find(o => o.id === id)?.name)
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
      </div>
    </div>
  );

  // Target = chi è oggetto della bet (es. "Maria arriverà in ritardo"). Diverso dall'avversario.
  // Visibile per ogni tipo tranne Vault; opponent escluso per chiarezza.
  const targetCandidates = others.filter(m => m.id !== opponentId);
  const TargetBlock = betType !== 'vault' && targetCandidates.length > 0 && (
    <div style={{ marginBottom: 14 }}>
      <label style={S.lbl}>{t('create.target_label')}</label>
      <SearchInput visible={targetCandidates.length >= SEARCH_THRESHOLD} />
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => setTargetId(null)}
          aria-pressed={!targetId}
          style={{
            padding:'8px 14px', borderRadius:24,
            border:`1px solid ${!targetId ? 'var(--pur)' : 'var(--brd)'}`,
            background: !targetId ? 'var(--pur)1a' : 'transparent',
            color: !targetId ? 'var(--pur)' : 'var(--dim)',
            cursor:'pointer', fontFamily:"'Manrope',sans-serif", fontSize:12, fontWeight:700,
            letterSpacing:'.06em',
          }}>—  {t('create.target_none')}</button>
      </div>
      <div style={MEMBER_GRID_STYLE}>
        {targetCandidates.filter(matchesSearch).map(m => (
          <MemberAvatar key={m.id} m={m}
            active={targetId === m.id}
            color="var(--pur)"
            onClick={setTargetId}/>
        ))}
      </div>
      {summaryLine(
        targetId
          ? `🎯 ${targetCandidates.find(m => m.id === targetId)?.name || ''}`
          : t('create.target_none'),
        targetId ? 'var(--pur)' : 'var(--mut)'
      )}
      <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4, lineHeight: 1.4 }}>
        {t('create.target_hint')}
      </div>
    </div>
  );

  // Centerpiece of the form — the bet title becomes a giant italic
  // Cormorant textarea you write directly into. No box, no label above.
  // Auto-grows with content. Quote marks render around in absolute so
  // they don't interfere with the caret.
  const TitleBlock = (
    <div data-coach="title" style={{position:'relative', margin:'4px 0 32px', paddingLeft: isDesktop ? 18 : 14}}>
      <span aria-hidden style={{
        position:'absolute', top:-4, left:-2,
        fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
        fontSize:'clamp(36px, 8vw, 56px)', lineHeight:1,
        color:'var(--gold)', opacity:.55, pointerEvents:'none',
      }}>“</span>
      <textarea
        value={title}
        onChange={e=>setTitle(e.target.value)}
        placeholder={t(
          betType === 'vault'    ? 'create.bet_placeholder_sec' :
          betType === 'targeted' ? 'create.bet_placeholder_targeted' :
          betType === 'surprise' ? 'create.bet_placeholder_surprise' :
                                   'create.bet_placeholder_pub'
        )}
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

  // ─── Win block — "se vinco" with 6 ratio chips ─────────────────────
  // No quota numbers anywhere. The user thinks in absolute amounts:
  // "I bet 10, I win Y". Six preset chips multiply the current stake to
  // give a quick win amount; manual input is always available too.
  const WIN_PRESETS = [
    { label: 'Pari', ratio: 1.0,  color: 'var(--mut)' },
    { label: '+20%', ratio: 1.2,  color: 'var(--grn)' },
    { label: '+50%', ratio: 1.5,  color: 'var(--grn)' },
    { label: '×2',   ratio: 2.0,  color: 'var(--gold)' },
    { label: '×4',   ratio: 4.0,  color: 'var(--gold)' },
    { label: '×8',   ratio: 8.0,  color: 'var(--red)' },
  ];
  const actualRatio = stake > 0 ? potWin / stake : 1;
  const netGain = potWin - stake;
  const WinBlock = (
    <div data-coach="win" style={{marginBottom:24}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:14}}>
        <label style={{...S.lbl, marginBottom:0}}>{t('create.win_label')}</label>
        <span className="bc-meta" style={{fontSize:8}}>
          {netGain >= 0 ? '+' : ''}{netGain}<span style={{fontSize:10, marginLeft:2}}>₡</span>
          <span style={{marginLeft:6, opacity:.6}}>{t('create.net')}</span>
        </span>
      </div>

      {/* Hero win number */}
      <div className="bc-num" style={{
        fontSize:'clamp(42px, 10vw, 72px)', color:'var(--grn)', lineHeight:.9, marginBottom:14,
      }}>
        {potWin || 0}<span style={{fontSize:'0.45em', color:'var(--dim)', marginLeft:3, fontWeight:400}}>₡</span>
      </div>

      {/* Ratio preset chips — tap to set win = stake × ratio */}
      <div style={{
        display:'flex', flexWrap:'wrap',
        gap:'clamp(10px, 3vw, 18px)',
        borderBottom:'1px solid var(--rule)', paddingBottom:10, marginBottom:14,
      }}>
        {WIN_PRESETS.map(p => {
          const isActive = Math.abs(actualRatio - p.ratio) < 0.04 && stake > 0;
          return (
            <button key={p.label} type="button"
              onClick={() => setWinStr(String(Math.max(1, Math.round(stake * p.ratio))))}
              style={{
                padding:'2px 0', background:'transparent', border:'none', cursor:'pointer',
                fontFamily:"'Manrope',sans-serif",
                fontSize:11, fontWeight: isActive ? 700 : 600,
                letterSpacing:'.18em',
                color: isActive ? 'var(--gold)' : 'var(--dim)',
                borderBottom: `2px solid ${isActive ? 'var(--gold)' : 'transparent'}`,
                marginBottom:-11, transition:'all .18s',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}>{p.label}</button>
          );
        })}
      </div>

      {/* Free numeric override */}
      <Inp type="number" min="1" step="1" value={winStr}
        onChange={e=>setWinStr(e.target.value)}
        placeholder={t('create.win_placeholder')}/>
    </div>
  );

  // Stake — same editorial language as Quota: hero numeral, underline-pill
  // presets, summary line as hairline-separated columns (no card box).
  const StakeBlock = (
    <div data-coach="stake" style={{marginBottom:24}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:14}}>
        <label style={{...S.lbl, marginBottom:0}}>{t('create.stake_label')}</label>
        <span className="bc-meta" style={{fontSize:8}}>{t('create.stake_max')} <span style={{fontFamily:"'Playfair Display',serif", fontSize:14, letterSpacing:'-0.02em', color:'var(--gold)', marginLeft:3}}>{Math.round(maxStake)}₡</span></span>
      </div>

      {/* Hero stake number */}
      <div className="bc-num" style={{fontSize:'clamp(42px, 10vw, 72px)', color:'var(--gold)', lineHeight:.9, marginBottom:14}}>
        {stake || 0}<span style={{fontSize:'0.45em', color:'var(--dim)', marginLeft:3, fontWeight:400}}>₡</span>
      </div>

      {/* Preset chips — underline pills */}
      <div style={{display:"flex", flexWrap:'wrap', gap:'clamp(10px, 3vw, 18px)', borderBottom:'1px solid var(--rule)', paddingBottom:10, marginBottom:14}}>
        {[5,10,20,50,75,100].map(s=>{
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
      // Theme-aware backdrop — see DieRollOverlay for the rationale.
      background:'radial-gradient(circle at 50% 45%, var(--pur)33 0%, var(--bg) 75%)',
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
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:30,fontWeight:600,lineHeight:1,color:"var(--txt)"}}>{t('create.title')}</div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:6}}>
              {/* Always-available coachmark trigger — for users who skipped
                  the tutorial or forgot how something works. */}
              <button onClick={() => setCoachOpen(true)} data-coach="help" aria-label={t('coach.help_tooltip')} title={t('coach.help_tooltip')}
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'transparent', border: '1px solid var(--gold)66',
                  cursor: 'pointer', color: 'var(--gold)',
                  fontFamily: "'Manrope',sans-serif", fontSize: 13, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0, lineHeight: 1,
                }}>?</button>
              <button onClick={onClose} aria-label="Chiudi" style={{background:"transparent",border:"none",cursor:"pointer",color:"var(--dim)",fontSize:18,padding:4}}>✕</button>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 360px",flex:1,minHeight:0}}>
            <div ref={scrollAreaRef} style={{padding:"22px 24px",overflowY:"auto"}}>
              {TemplatesBlock}
              {TypeBlock}
              {TitleBlock}
              {OpponentBlock}
              {SubsetBlock}
              {TargetBlock}
              {StakeBlock}
              {WinBlock}
              {CategoryBlock}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {PegnoBlock}
                {ExpiryBlock}
              </div>
            </div>
            <div style={{padding:"22px 24px",borderLeft:"1px solid var(--brd)",background:"linear-gradient(135deg,var(--card),var(--surf))",overflowY:"auto"}}>
              <SecLabel>{t('create.preview')}</SecLabel>
              <LivePreview
                title={title} stake={stake} potWin={potWin}
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
              <span data-coach="submit">
                <Btn variant="gold" onClick={submit} style={{padding:"12px 24px",fontSize:14}}>
                  {isSecret?t('create.submit_secret'):t('create.submit_shared')}
                </Btn>
              </span>
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
      <CreateModalCoachmarks open={coachOpen} onClose={() => setCoachOpen(false)}/>
    </>);
  }

  // ─── Mobile layout (bottom sheet) ────────────────────────────────────────
  return (<>
    {SlotMachine}
    <div ref={backdropRef} style={{position:"fixed",inset:0,background:"rgba(15,11,35,.78)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100}}>
      <div
        ref={sheetRef}
        className="sUp"
        style={{position:'relative',background:"var(--surf)",borderRadius:"12px 12px 0 0",width:"100%",maxWidth:480,maxHeight:"92vh",display:'flex',flexDirection:'column',borderTop:"1px solid var(--rule)",boxShadow:"0 -20px 60px rgba(0,0,0,.4)"}}
      >
        {/* Pill + header — visual handle, gesture handled by sheet-level useEffect */}
        <div style={{flexShrink:0, borderRadius:'12px 12px 0 0', background:'var(--surf)'}}>
          {/* Visual pill */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:28}}>
            <div style={{width:36,height:4,borderRadius:2,background:'var(--mut)',opacity:.5}}/>
          </div>
          {/* Header row: title + buttons */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",padding:"0 26px 20px"}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:28,fontWeight:600,lineHeight:1,color:"var(--txt)"}}>{t('create.title')}</div>
            <div style={{display:'flex', alignItems:'center', gap:6}}>
              <button onClick={() => setCoachOpen(true)} data-coach="help" aria-label={t('coach.help_tooltip')} title={t('coach.help_tooltip')}
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'transparent', border: '1px solid var(--gold)66',
                  cursor: 'pointer', color: 'var(--gold)',
                  fontFamily: "'Manrope',sans-serif", fontSize: 13, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0, lineHeight: 1,
                  WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                }}>?</button>
              <button onClick={onClose} aria-label="Chiudi" style={{background:"transparent",border:"none",cursor:"pointer",color:"var(--dim)",fontSize:18,padding:4}}>✕</button>
            </div>
          </div>
        </div>
        <div ref={scrollRef} style={{flex:1,overflowY:'auto',minHeight:0}}>
        <div style={{padding:"0 26px 40px"}}>

        {TemplatesBlock}
        {TypeBlock}
        {TitleBlock}
        {OpponentBlock}
        {SubsetBlock}
        {TargetBlock}
        {StakeBlock}
        {WinBlock}
        {CategoryBlock}
        {PegnoBlock}
        {ExpiryBlock}

        <span data-coach="submit" style={{display:'block'}}>
          <Btn variant="gold" full onClick={submit}>{isSecret?t('create.submit_secret'):t('create.submit_shared')}</Btn>
        </span>
        <div style={{textAlign:'center'}}>{SaveAsTemplateBtn}</div>

        {showSaveDialog && (
          <SaveTemplateDialog
            name={tplName} setName={setTplName}
            onCancel={() => setShowSaveDialog(false)}
            onSave={saveAsTemplate} t={t}
          />
        )}
        </div>{/* /padding */}
        </div>{/* /scroll area */}
      </div>{/* /sheet */}
    </div>{/* /backdrop */}
    <CreateModalCoachmarks open={coachOpen} onClose={() => setCoachOpen(false)}/>
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
