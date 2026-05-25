import { TRANSLATIONS } from '../i18n.js';
import React from 'react';

export const ARDESIA = {bg:"#131318",surf:"#1e1e24",card:"#28282e",brd:"#38383e",rule:"rgba(212,200,184,0.12)",soft:"rgba(212,200,184,0.05)",gold:"#c8a870",goldL:"#d8bc88",glow:"rgba(200,168,112,0.20)",grn:"#60c898",red:"#dc4646",blu:"#8898c8",pur:"#9890b8",txt:"#f0ece4",dim:"#908880",mut:"#38383e",inp:"#111116"};
export const CARTA   = {bg:"#e8e0cc",surf:"#f0ece0",card:"#f8f4e8",brd:"#ccc4a8",rule:"rgba(139,94,42,0.16)",soft:"rgba(139,94,42,0.06)",gold:"#8b5e2a",goldL:"#a06e30",glow:"rgba(139,94,42,0.18)",grn:"#2a7a4a",red:"#a02828",blu:"#3a5a9a",pur:"#6a4a9a",txt:"#2a2010",dim:"#7a6848",mut:"#ccc4a8",inp:"#f0ece0"};
export const AMBER   = {bg:"#1f1108",surf:"#2c1810",card:"#3a2118",brd:"#5a3424",rule:"rgba(212,160,98,0.18)",soft:"rgba(212,160,98,0.06)",gold:"#e8b86a",goldL:"#f3cb8a",glow:"rgba(232,184,106,0.24)",grn:"#a8c46c",red:"#ff7a52",blu:"#8fb3d8",pur:"#d49c70",txt:"#f5e6cf",dim:"#c0a181",mut:"#6e4a35",inp:"#23130a"};
export const CASINO  = {bg:"#0a1810",surf:"#142a1c",card:"#1e3c28",brd:"#2e5438",rule:"rgba(232,200,112,0.14)",soft:"rgba(232,200,112,0.05)",gold:"#e8c870",goldL:"#f0d888",glow:"rgba(232,200,112,0.24)",grn:"#58d888",red:"#e07860",blu:"#6898c8",pur:"#a888c0",txt:"#f0ece0",dim:"#688878",mut:"#2e5438",inp:"#081410"};
export const SAKURA  = {bg:"#1e1018",surf:"#2d1828",card:"#3d2038",brd:"#5a3050",rule:"rgba(224,160,192,0.16)",soft:"rgba(224,160,192,0.06)",gold:"#e8b0b0",goldL:"#f0c8c8",glow:"rgba(232,176,176,0.24)",grn:"#a0d888",red:"#ff7070",blu:"#90a8e8",pur:"#c078c0",txt:"#f0d8e8",dim:"#c090a8",mut:"#5a3050",inp:"#190e18"};
export const PECE    = {bg:"#0c0c0e",surf:"#141417",card:"#1c1c20",brd:"#2c2c32",rule:"rgba(240,238,232,0.08)",soft:"rgba(240,238,232,0.03)",gold:"#c8b896",goldL:"#ddd0b8",glow:"rgba(200,184,150,0.18)",grn:"#4ec87a",red:"#e05555",blu:"#7a9ae0",pur:"#a898c8",txt:"#f0eee8",dim:"#888882",mut:"#2c2c32",inp:"#0a0a0c"};

export const rootVars = C => ({
  "--bg":C.bg,"--surf":C.surf,"--card":C.card,"--brd":C.brd,
  "--rule":C.rule,"--soft":C.soft,
  "--gold":C.gold,"--goldL":C.goldL,"--glow":C.glow,
  "--grn":C.grn,"--red":C.red,"--blu":C.blu,"--pur":C.pur,
  "--txt":C.txt,"--dim":C.dim,"--mut":C.mut,"--inp":C.inp,
  // Font roles. Numbers stay Playfair (editorial weight on the credit
  // counters & quotas), headings move to Cormorant Garamond, UI body is
  // Manrope so the dashboard reads as a clean modern app rather than a
  // shiny casino skin.
  "--f-num":  "'Playfair Display', serif",
  "--f-head": "'Cormorant Garamond', serif",
  "--f-ui":   "'Manrope', sans-serif",
  background:C.bg, color:C.txt,
  fontFamily:"'Manrope',sans-serif", minHeight:"100vh",
});

// Avatar emojis grouped by category. Order matters: items appear in this exact order in the picker.
export const AVATAR_CATEGORIES = [
  { id: 'game',     icon: '🃏', items: ['🃏','🎲','🎯','🎰','♥️','♠️','♦️','♣️','🎱','🪅'] },
  { id: 'animals',  icon: '🦊', items: ['🦊','🦁','🐺','🐉','🐻','🐯','🦌','🦄','🐰','🐼','🐶','🐱','🦅','🦉','🐬','🐢','🐸','🦋','🐝','🦂'] },
  { id: 'elements', icon: '🔥', items: ['🔥','⚡','🌙','☀️','⭐','🌟','❄️','🌊','🌈','💧','💥','☄️'] },
  { id: 'objects',  icon: '💎', items: ['💎','🏆','👑','🎁','🔮','⚜️','⚓','⚔️','🛡','🗝','💍','💀'] },
  { id: 'arts',     icon: '🎭', items: ['🎭','🎪','🎠','🎨','🎸','🎺','🎤','🎻','🥁','🎷','🎬','🎼'] },
  { id: 'nature',   icon: '🌺', items: ['🌺','🌹','🌸','🌻','🌷','🌵','🌴','🍀','🪴','🌲','🌳','🌾'] },
  { id: 'food',     icon: '🍷', items: ['🍷','🍻','🍕','🍔','🍩','🍰','🍣','🌮','☕','🍦','🍓','🍑'] },
];

// Flat list — kept for backward compatibility (AuthView and any other place
// that just wants the full list)
export const AVATARS = AVATAR_CATEGORIES.flatMap(c => c.items);
export const COLORS={blue:"#5b8af0",purple:"#a07ef5",green:"#2ecc7f",red:"#e05555",gold:"#c8973f",pink:"#e878a8",teal:"#2ec8c8",orange:"#e8903f"};
export const CAT_COLS=["#e05555","#a07ef5","#5b8af0","#e8903f","#2ecc7f","#e878a8","#f6c90e","#2ec8c8"];
// Default category set for friend-group betting. Tuned to lean goliardic /
// jokey (the use case is bets between friends, not couple intimacy).
// Legacy IDs from the early couple-only days (intimo / serata / casa) are
// kept in DEF_CAT_IDS so old bets still render their label.
// Default stock categories — kept minimal (4 items) since stock cats
// can't be deleted or edited; everything else the user creates fresh
// per group. The original 8 IDs survive in DEF_CAT_IDS so legacy bets
// created with scherzi/gaming/cibo/eventi still render their label.
export const DEF_CATS=[
  {id:"sport",   e:"⚽", label:"Sport",   color:"#5b8af0"},
  {id:"media",   e:"🎬", label:"Media",   color:"#a07ef5"},
  {id:"vita",    e:"📅", label:"Vita",    color:"#2ec8c8"},
  {id:"altro",   e:"🎯", label:"Altro",   color:"#8480a0"},
];
// All category IDs that have a translation under cats.* in i18n.js. Used to
// decide whether to read the label from the dictionary or from the cat object.
// Includes both the current stock cats AND retired stock cats (scherzi,
// gaming, cibo, eventi) + legacy ones (intimo/serata/casa) so historical
// bets keep showing their original label.
export const DEF_CAT_IDS=['sport','media','vita','altro','scherzi','gaming','cibo','eventi','intimo','serata','casa'];
export const Q_PRE = [
  {key:'q110',q:1.10},{key:'q130',q:1.30},{key:'q150',q:1.50},
  {key:'q200',q:2.00},{key:'q350',q:3.50},{key:'q600',q:6.00},
];

export const qToP  = q=>Math.round(100/parseFloat(q));
export const pToQ  = p=>parseFloat((100/Math.max(1,Math.min(99,p))).toFixed(2));
export const fmtQ  = q=>parseFloat(q).toFixed(2);
export const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
export const fmtD = (ts, lang='it') =>
  new Date(ts).toLocaleDateString(TRANSLATIONS[lang]?.date?.locale ?? 'it-IT', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
export const qNo   = qY=>parseFloat((parseFloat(qY)/(parseFloat(qY)-1)).toFixed(2));
export const tLeft = (ts, lang='it') => {
  if(!ts) return null;
  const d = ts - Date.now();
  const dt = TRANSLATIONS[lang]?.date ?? TRANSLATIONS.it.date;
  if(d<=0) return dt.expired;
  const h=Math.floor(d/3600000), m=Math.floor((d%3600000)/60000);
  return h>=48?`${Math.floor(h/24)}${dt.days}`:h>0?`${h}${dt.hours}${m}${dt.minutes}`:`${m}${dt.minutes}`;
};
export const isSoon= ts=>ts&&ts>Date.now()&&(ts-Date.now())<86400000;
export const getC  = (profiles,user)=>COLORS[profiles[user]?.colorKey]||"#5b8af0";

// ─── UI ATOMS ────────────────────────────────────────────────────────────────
// Editorial-first treatment: containers no longer rely on bordered boxes for
// structure — they breathe via whitespace + 1px hairlines. The "card" style
// is preserved for the handful of components that genuinely benefit from a
// raised surface (modals, the pending-acceptance strip), but every new
// component should prefer S.section + S.hairline + generous padding.
const S = {
  // Used only inside modals + truly raised surfaces. Plain views drop it.
  card: {background:"var(--card)",border:`1px solid var(--brd)`,borderRadius:14,padding:18},
  // Editorial section pattern — no box, just rhythm.
  section: {padding:"28px 0"},
  // 1px hairline rule. Used as section divider in place of card borders.
  hairline: {height:1, background:"var(--rule)", border:0, margin:0},
  // Pill badge, kept compact + tracked.
  bdg: {display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:999,fontSize:10,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"},
  // Default button = pill, hard radius, no border. Variants own their color.
  btn: {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,padding:"11px 22px",borderRadius:999,border:"none",cursor:"pointer",fontFamily:"'Manrope',sans-serif",fontSize:13,fontWeight:600,letterSpacing:".02em",transition:"transform .18s ease, filter .18s ease, box-shadow .18s ease",userSelect:"none",whiteSpace:"nowrap"},
  row: {display:"flex",alignItems:"center",gap:10},
  col: {display:"flex",flexDirection:"column",gap:6},
  // Tiny tracked meta-label. Pair with whitespace, not with boxes.
  lbl: {fontSize:9,color:"var(--dim)",letterSpacing:".3em",textTransform:"uppercase",fontWeight:600,display:"block",marginBottom:10},
  // Inputs lose the box. Underline only, lavender on focus.
  inp: {background:"transparent",border:0,borderBottom:"1px solid var(--brd)",borderRadius:0,color:"var(--txt)",padding:"10px 2px",fontFamily:"'Manrope',sans-serif",fontSize:15,outline:"none",width:"100%",transition:"border-color .18s ease"},
};
export const Bdg=({c,bg,children})=><span style={{...S.bdg,background:bg,color:c}}>{children}</span>;
export const Btn=({variant="ghost",sm,full,onClick,disabled,children,style={}})=>{
  const base={...S.btn,...style};
  if(sm){base.padding="8px 16px";base.fontSize=12;}
  if(full){base.width="100%";base.padding="15px 0";base.fontSize=14;}
  if(disabled){base.opacity=.4;base.pointerEvents="none";}
  // Primary CTA = solid lavender pill with a soft colored shadow that
  // belongs to the brand (not a generic black drop-shadow). "gold" remains
  // the variant name for compatibility but visually it's now lavender —
  // gold is reserved for typographic accents and rules.
  const vars = {
    gold:  {background:"var(--pur)",  color:"#1a1530", boxShadow:"0 10px 28px -10px var(--pur), 0 1px 0 rgba(255,255,255,.12) inset"},
    pur:   {background:"var(--pur)",  color:"#1a1530", boxShadow:"0 10px 28px -10px var(--pur), 0 1px 0 rgba(255,255,255,.12) inset"},
    grn:   {background:"var(--grn)",  color:"#0a1f15", boxShadow:"0 10px 28px -12px var(--grn)"},
    red:   {background:"var(--red)",  color:"#fff",    boxShadow:"0 10px 28px -12px var(--red)"},
    accent:{background:"transparent", color:"var(--gold)", border:"1px solid var(--gold)44"},
    ghost: {background:"transparent", color:"var(--txt)"},
  };
  return <button style={{...base,...(vars[variant]||vars.ghost)}} onClick={onClick}>{children}</button>;
};
export const Inp=({style={},value,onChange,placeholder,type="text",min,max,step})=>(
  <input type={type} style={{...S.inp,...style}} value={value} onChange={onChange} placeholder={placeholder} min={min} max={max} step={step}/>
);
export const Toggle=({on,onToggle,color="var(--pur)"})=>(
  <div onClick={onToggle} style={{width:44,height:24,borderRadius:999,background:on?color:"var(--mut)",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
    <div style={{position:"absolute",width:18,height:18,background:"#fff",borderRadius:"50%",top:3,left:on?23:3,transition:"left .2s"}}/>
  </div>
);
export const SecLabel=({children,mt=0})=><div style={{fontSize:9,color:"var(--dim)",letterSpacing:".3em",textTransform:"uppercase",fontWeight:600,marginBottom:14,marginTop:mt}}>{children}</div>;
// Thin hairline rule. Pass `mt`/`mb` to push it around the page rhythm.
export const Rule = ({mt=0,mb=0,color}) => <hr style={{...S.hairline, marginTop:mt, marginBottom:mb, ...(color?{background:color}:{})}}/>;

export function Avatar({profile,size=36}){
  const c=COLORS[profile?.colorKey]||"#5b8af0";
  const ringStyle={width:size,height:size,borderRadius:"50%",border:`2px solid ${c}66`,boxShadow:`0 0 10px ${c}44`,flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"};
  // alt text uses the profile's display name so screen readers identify
  // the person; falls back to "Avatar" if name is missing. The emoji
  // branch is decorative (a name is rendered next to it in the UI) so
  // it's marked aria-hidden.
  const altName = profile?.name || 'Avatar';
  if (profile?.avatarUrl) {
    return <div style={{...ringStyle, background:`${c}11`}}>
      <img src={profile.avatarUrl} alt={altName} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
    </div>;
  }
  return <div aria-hidden style={{...ringStyle, background:`${c}33`, fontSize:size*.42}}>{profile?.avatar ?? "🃏"}</div>;
}

// V icon + "incit" wordmark. Adapts to all themes via CSS vars.
export function VincitWordmark({ size = 28 }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'baseline', lineHeight:1 }}>
      <span style={{
        fontFamily:"'Cinzel', serif",
        fontWeight: 700,
        fontSize: size,
        color: 'var(--gold)',
        lineHeight: 1,
      }}>V</span>
      <span className="shim" style={{
        fontFamily:"'Cormorant Garamond', serif",
        fontStyle: 'italic',
        fontWeight: 500,
        fontSize: Math.round(size * 0.64),
        letterSpacing: '0.5px',
        marginLeft: -Math.round(size * 0.107),
        lineHeight: 1,
      }}>incit</span>
    </span>
  );
}
