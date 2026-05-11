import { TRANSLATIONS } from '../i18n.js';
import React from 'react';

export const DARK  = {bg:"#07060f",surf:"#0f0d1f",card:"#131128",brd:"#1e1b36",gold:"#c8973f",goldL:"#e8b84b",glow:"rgba(200,151,63,0.18)",grn:"#2ecc7f",red:"#e05555",blu:"#5b8af0",pur:"#a07ef5",txt:"#ede8fd",dim:"#8480a0",mut:"#3d3a58",inp:"#0f0d1f"};
export const LIGHT = {bg:"#f0eeff",surf:"#ffffff",card:"#fafafe",brd:"#dbd6f0",gold:"#9a6820",goldL:"#b8801e",glow:"rgba(154,104,32,0.15)",grn:"#1a8f5c",red:"#c03040",blu:"#2a5fcc",pur:"#6b48cc",txt:"#1a1630",dim:"#5a5478",mut:"#d0cce8",inp:"#f8f6ff"};

export const rootVars = C => ({
  "--bg":C.bg,"--surf":C.surf,"--card":C.card,"--brd":C.brd,
  "--gold":C.gold,"--goldL":C.goldL,"--glow":C.glow,
  "--grn":C.grn,"--red":C.red,"--blu":C.blu,"--pur":C.pur,
  "--txt":C.txt,"--dim":C.dim,"--mut":C.mut,"--inp":C.inp,
  background:C.bg, color:C.txt,
  fontFamily:"'Syne',sans-serif", minHeight:"100vh",
});

export const AVATARS=["🃏","♥️","🎲","🦁","🐺","🔥","⚡","🌙","🎭","🦊","🐉","💎","⭐","🏆","🎯","🍷","🎸","🦋","🐬","🦅","🌺","🐻","🎪","🎠"];
export const COLORS={blue:"#5b8af0",purple:"#a07ef5",green:"#2ecc7f",red:"#e05555",gold:"#c8973f",pink:"#e878a8",teal:"#2ec8c8",orange:"#e8903f"};
export const CAT_COLS=["#e05555","#a07ef5","#5b8af0","#e8903f","#2ecc7f","#e878a8","#f6c90e","#2ec8c8"];
export const DEF_CATS=[
  {id:"intimo",e:"💋",label:"Intimo",color:"#e05555"},
  {id:"serata",e:"🌙",label:"Serata",color:"#a07ef5"},
  {id:"casa",  e:"🏠",label:"Casa",  color:"#5b8af0"},
  {id:"cibo",  e:"🍕",label:"Cibo",  color:"#e8903f"},
  {id:"gaming",e:"🎮",label:"Gaming",color:"#2ecc7f"},
  {id:"altro", e:"🎲",label:"Altro", color:"#8480a0"},
];
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
const S = {
  card: {background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:16},
  bdg: {display:"inline-flex",alignItems:"center",gap:3,padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:600},
  btn: {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 18px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:600,transition:"all .18s",userSelect:"none",whiteSpace:"nowrap"},
  row: {display:"flex",alignItems:"center",gap:10},
  col: {display:"flex",flexDirection:"column",gap:6},
  lbl: {fontSize:10,color:"var(--dim)",letterSpacing:2,textTransform:"uppercase",display:"block",marginBottom:6},
  inp: {background:"var(--inp)",border:"1px solid var(--brd)",color:"var(--txt)",borderRadius:10,padding:"10px 14px",fontFamily:"'Syne',sans-serif",fontSize:14,outline:"none",width:"100%"},
};
export const Bdg=({c,bg,children})=><span style={{...S.bdg,background:bg,color:c}}>{children}</span>;
export const Btn=({variant="ghost",sm,full,onClick,disabled,children,style={}})=>{
  const base={...S.btn,...style};
  if(sm){base.padding="7px 13px";base.fontSize=12;}
  if(full){base.width="100%";base.padding="14px 0";base.fontSize=15;}
  if(disabled){base.opacity=.4;base.pointerEvents="none";}
  const vars={gold:{background:"var(--gold)",color:"#fff"},grn:{background:"var(--grn)",color:"#fff"},red:{background:"var(--red)",color:"#fff"},ghost:{background:"transparent",color:"var(--dim)",border:"1px solid var(--brd)"}};
  return <button style={{...base,...(vars[variant]||vars.ghost)}} onClick={onClick}>{children}</button>;
};
export const Inp=({style={},value,onChange,placeholder,type="text",min,max,step})=>(
  <input type={type} style={{...S.inp,...style}} value={value} onChange={onChange} placeholder={placeholder} min={min} max={max} step={step}/>
);
export const Toggle=({on,onToggle,color="var(--gold)"})=>(
  <div onClick={onToggle} style={{width:44,height:24,borderRadius:12,background:on?color:"var(--mut)",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
    <div style={{position:"absolute",width:18,height:18,background:"#fff",borderRadius:"50%",top:3,left:on?23:3,transition:"left .2s"}}/>
  </div>
);
export const SecLabel=({children,mt=0})=><div style={{fontSize:10,color:"var(--dim)",letterSpacing:2,textTransform:"uppercase",marginBottom:8,marginTop:mt}}>{children}</div>;

export function Avatar({profile,size=36}){
  const c=COLORS[profile?.colorKey]||"#5b8af0";
  const ringStyle={width:size,height:size,borderRadius:"50%",border:`2px solid ${c}66`,boxShadow:`0 0 10px ${c}44`,flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"};
  if (profile?.avatarUrl) {
    return <div style={{...ringStyle, background:`${c}11`}}>
      <img src={profile.avatarUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
    </div>;
  }
  return <div style={{...ringStyle, background:`${c}33`, fontSize:size*.42}}>{profile?.avatar ?? "🃏"}</div>;
}
