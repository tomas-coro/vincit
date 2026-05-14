import React from 'react';
import { Btn, SecLabel, Avatar, COLORS, getC, fmtQ, fmtD, tLeft, isSoon, DEF_CAT_IDS as DEF_IDS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import BetCard from '../BetCard.jsx';
import EmptyState from '../EmptyState.jsx';

const S = {
  card: {background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:16},
  btn: {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 18px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"'Manrope',sans-serif",fontSize:13,fontWeight:600,transition:"all .18s",userSelect:"none",whiteSpace:"nowrap"},
  bdg: {display:"inline-flex",alignItems:"center",gap:3,padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:600},
};

const Bdg=({c,bg,children})=><span style={{...S.bdg,background:bg,color:c}}>{children}</span>;
const qToP = q=>Math.round(100/parseFloat(q));

export default function VaultView({user,profiles,bets,cats,onReveal,onFlame,unlocked,onPinRequest,vaultPin,isDesktop,onDelete,onEdit,onOpenCreate,hideTitle=false}){
  const { t, lang } = useLang();
  const catLabel = c => DEF_IDS.includes(c.id) ? t('cats.'+c.id) : c.label;
  const active=bets.filter(b=>b.creator===user&&b.isSecret&&b.status==="active");
  const resolved=bets.filter(b=>b.creator===user&&b.isSecret&&["won","lost"].includes(b.status));
  const hasPIN=!!vaultPin;
  const CANCEL_MS=60*1000;

  const [showPinReset, setShowPinReset] = React.useState(false);
  if(hasPIN&&!unlocked){
    return(
      <div className="sUp" style={{textAlign:"center",padding:"80px 20px"}}>
        <div style={{fontSize:52,marginBottom:16}}>🔒</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,marginBottom:8}}>{t('vault_view.locked_title')}</div>
        <div style={{fontSize:13,color:"var(--dim)",marginBottom:28}}>{t('vault_view.locked_sub')}</div>
        <Btn variant="gold" style={{padding:"12px 32px",fontSize:15}} onClick={onPinRequest}>{t('vault_view.unlock_btn')}</Btn>
        {!showPinReset ? (
          <div style={{marginTop:24}}>
            <button onClick={() => setShowPinReset(true)} style={{
              background:'none', border:'none', cursor:'pointer',
              fontSize:12, color:'var(--dim)', textDecoration:'underline',
              fontFamily:"'Manrope',sans-serif",
            }}>{t('vault_view.forgot_pin')}</button>
          </div>
        ) : (
          <div style={{
            marginTop:24, padding:'14px 18px', borderRadius:12,
            background:'var(--mut)18', border:'1px solid var(--brd)',
            maxWidth:300, margin:'24px auto 0', textAlign:'left',
          }}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:6,color:'var(--txt)'}}>{t('vault_view.forgot_pin_title')}</div>
            <div style={{fontSize:12,color:'var(--dim)',lineHeight:1.5,marginBottom:12}}>{t('vault_view.forgot_pin_desc')}</div>
            <Btn variant="ghost" sm style={{color:'var(--red)',borderColor:'var(--red)44'}} onClick={() => { if(typeof onSetVaultPin==='function') onSetVaultPin(null); }}>{t('vault_view.forgot_pin_reset')}</Btn>
          </div>
        )}
      </div>
    );
  }

  const honestyBanner=(
    <div style={{fontSize:11,color:"var(--gold)",padding:"10px 12px",background:"var(--gold)10",borderRadius:10,border:"1px solid var(--gold)30",marginBottom:16,lineHeight:1.5}}>
      {t('vault_view.honesty')}
    </div>
  );

  const emptyState = active.length === 0 && resolved.length === 0 && (
    <EmptyState
      emoji="🔒"
      title={t('empty.vault_title')}
      body={t('empty.vault_body')}
      cta={onOpenCreate ? { label: t('empty.vault_cta'), icon: '+', onClick: onOpenCreate } : null}
      tutorial={{ label: t('empty.how_label'), body: t('empty.vault_tutorial') }}
    />
  );

  const activeCards=active.map(b=>{
        const cat=cats.find(c=>c.id===b.category)||cats[cats.length-1];
        return(
          <div key={b.id} className="sUp" style={{...S.card,marginBottom:10,border:"1px solid var(--gold)44",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:"var(--gold)"}}/>
            <div style={{paddingLeft:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14,lineHeight:1.35}}>{b.title}</div>
                  <div style={{fontSize:11,color:"var(--dim)",marginTop:3}}>{t('vault_view.sealed')} · {fmtD(b.createdAt,lang)}</div>
                  {b.expiresAt&&<div style={{fontSize:11,color:isSoon(b.expiresAt)?"var(--red)":"var(--gold)",marginTop:2}}>⏱ {tLeft(b.expiresAt,lang)}</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:"var(--gold)",fontWeight:700}}>{fmtQ(b.quota)}×</div>
                  <div style={{fontSize:10,color:"var(--dim)"}}>{qToP(b.quota)}%</div>
                </div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
                <Bdg bg="var(--mut)44" c="var(--dim)">{cat.e} {catLabel(cat)}</Bdg>
                <Bdg bg="var(--mut)44" c="var(--dim)">{t('vault_view.stake')} {b.stake} ₡</Bdg>
                <Bdg bg="var(--grn)22" c="var(--grn)">{t('vault_view.win')} {b.potentialWin} ₡</Bdg>
                {b.pegno&&<Bdg bg="var(--gold)22" c="var(--gold)">🎁 {b.pegno}</Bdg>}
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn variant="gold" sm style={{flex:1}} onClick={()=>onReveal(b)}>{t('vault_view.reveal_btn')}</Btn>
                <button onClick={()=>onFlame(b.id)} style={{...S.btn,padding:"7px 10px",background:"transparent",border:"1px solid var(--brd)",color:b.flamed?"#f97316":"var(--dim)",fontSize:12}}>{b.flamed?"🔥":"🤍"}</button>
              </div>
              {Date.now()-b.createdAt<CANCEL_MS&&onDelete&&(
                <button onClick={()=>{if(window.confirm(t('bet_card.cancel_confirm')))onDelete(b);}} style={{...S.btn,marginTop:8,width:"100%",padding:"7px 10px",background:"transparent",border:"1px solid var(--red)44",color:"var(--red)",fontSize:11}}>✕ {t('bet_card.cancel_btn')} ({t('bet_card.cancel_window',{m:Math.ceil((b.createdAt+CANCEL_MS-Date.now())/60000)})})</button>
              )}
            </div>
          </div>
        );
  });

  const resolvedCards=resolved.length>0&&(
    <><SecLabel mt={16}>{t('vault_view.resolved')}</SecLabel>{resolved.map(b=><BetCard key={b.id} bet={b} user={user} profiles={profiles} cats={cats} onFlame={onFlame} onCounter={()=>{}} isDesktop={isDesktop} onDelete={onDelete} onEdit={onEdit}/>)}</>
  );

  return(
    <div className="sUp">
      {!hideTitle && (
        <>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,marginBottom:4}}>{t('vault_view.title')}</div>
          <div style={{fontSize:13,color:"var(--dim)",marginBottom:8}}>{t('vault_view.subtitle')}</div>
        </>
      )}
      {isDesktop?(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>
          <div>{honestyBanner}{emptyState}{activeCards}</div>
          <div>{resolvedCards}</div>
        </div>
      ):(
        <>{honestyBanner}{emptyState}{activeCards}{resolvedCards}</>
      )}
    </div>
  );
}
