import { TRANSLATIONS } from '../i18n.js';
import React from 'react';

// Palette "Lavanda & Ottone" — viola lavanda dominante, ottone spazzolato come accento.
// In light mode bg = farina d'avena (beige sporco), niente bianco puro.
// Amber è una terza variante "cantina/whisky" — burgundy/cuoio scuro dominante, oro spazzolato come accento.
// `rule` = ultra-soft hairline color (replaces the gray-ish borders), `soft` = barely-visible tint for grouping.
export const DARK  = {bg:"#1a1530",surf:"#221c40",card:"#2b2247",brd:"#3a3260",rule:"rgba(183,148,244,0.16)",soft:"rgba(183,148,244,0.05)",gold:"#c4a878",goldL:"#d6bf94",glow:"rgba(196,168,120,0.18)",grn:"#3dd494",red:"#e26666",blu:"#7aa2ff",pur:"#b794f4",txt:"#ebe5ff",dim:"#9089b8",mut:"#403868",inp:"#1d1838"};
export const LIGHT = {bg:"#ede8d8",surf:"#f5f0e0",card:"#faf5e5",brd:"#c4bca0",rule:"rgba(91,63,196,0.18)",soft:"rgba(91,63,196,0.05)",gold:"#7a5e30",goldL:"#946f33",glow:"rgba(122,94,48,0.16)",grn:"#1f9560",red:"#b73a4a",blu:"#3556bb",pur:"#5b3fc4",txt:"#2a2545",dim:"#5f5878",mut:"#bcb39a",inp:"#f0eadc"};
export const AMBER = {bg:"#1f1108",surf:"#2c1810",card:"#3a2118",brd:"#5a3424",rule:"rgba(212,160,98,0.18)",soft:"rgba(212,160,98,0.06)",gold:"#e8b86a",goldL:"#f3cb8a",glow:"rgba(232,184,106,0.24)",grn:"#a8c46c",red:"#ff7a52",blu:"#8fb3d8",pur:"#d49c70",txt:"#f5e6cf",dim:"#c0a181",mut:"#6e4a35",inp:"#23130a"};
// "Selva" — deep forest night: botanical green bg, copper-gold accent, sage highlights.
export const SELVA = {bg:"#0d1b10",surf:"#152416",card:"#1d2f1e",brd:"#2e4a30",rule:"rgba(122,184,122,0.14)",soft:"rgba(122,184,122,0.05)",gold:"#c8a040",goldL:"#dab858",glow:"rgba(200,160,64,0.22)",grn:"#5dcc7a",red:"#e05555",blu:"#6aa0e0",pur:"#8ab888",txt:"#d4efcc",dim:"#8ab490",mut:"#2e4a30",inp:"#101e12"};
// "Sakura" — dark plum/mauve: rose surfaces, champagne accent, lilac highlights.
export const SAKURA= {bg:"#1e1018",surf:"#2d1828",card:"#3d2038",brd:"#5a3050",rule:"rgba(224,160,192,0.16)",soft:"rgba(224,160,192,0.06)",gold:"#e8b0b0",goldL:"#f0c8c8",glow:"rgba(232,176,176,0.24)",grn:"#a0d888",red:"#ff7070",blu:"#90a8e8",pur:"#c078c0",txt:"#f0d8e8",dim:"#c090a8",mut:"#5a3050",inp:"#190e18"};

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
