import React, { useRef, useEffect, useState } from 'react';
import { Btn, Bdg, Avatar, fmtQ, fmtD, tLeft, isSoon, qNo, COLORS } from './Atoms.jsx';
import { useLang } from '../i18n.js';

const S = {
  card: {background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:16},
  btn: {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 18px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:600,transition:"all .18s",userSelect:"none",whiteSpace:"nowrap"},
  row: {display:"flex",alignItems:"center",gap:10},
};

const getC = (profiles,user)=>COLORS[profiles[user]?.colorKey]||"#5b8af0";
const qToP = q=>Math.round(100/parseFloat(q));

const DEF_IDS=['intimo','serata','casa','cibo','gaming','altro'];

const SWIPE_THRESHOLD = 80;
const VERT_ABORT      = 40;

export default function BetCard({bet,user,profiles,cats,onResolve,onReveal,onCounter,onFlame,onReaction,reactions,onDelete,onEdit,isDesktop,onAccept,onReject}){
  const { t, lang } = useLang();
  const catLabel = c => DEF_IDS.includes(c.id) ? t('cats.'+c.id) : c.label;
  const isOwner=bet.creator===user;
  const isPending=bet.status==='pending';
  const isRejected=bet.status==='rejected';
  const cat=cats.find(c=>c.id===bet.category)||cats[cats.length-1];
  const done=["won","lost","rejected"].includes(bet.status);
  const CANCEL_MS=60*1000;
  const canCancel=isOwner&&!done&&!!onDelete&&(Date.now()-bet.createdAt<CANCEL_MS);
  const minsLeft=Math.ceil((bet.createdAt+CANCEL_MS-Date.now())/60000);
  const tl=tLeft(bet.expiresAt,lang);
  const myCounter=(bet.counterBets||[]).find(cb=>cb.bettor===user);
  const theirCounter=(bet.counterBets||[]).find(cb=>cb.bettor!==user);
  const sideColor=done?(bet.status==="won"?"var(--grn)":"var(--red)"):(bet.isSecret?"var(--gold)":cat.color);
  const betReactions=(reactions||[]).filter(r=>r.bet_id===bet.id);
  const myReaction=betReactions.find(r=>r.bettor===user);
  const EMOJIS=['🔥','😂','👀','💀','⚡'];

  // Swipe-to-resolve
  const cardRef  = useRef(null);
  const swipeRef = useRef(null);
  const [deltaX, setDeltaX] = useState(0);

  useEffect(() => {
    if (isDesktop || !isOwner || done || isPending || !onResolve) return;
    const el = cardRef.current;
    if (!el) return;

    const onStart = e => {
      swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: true };
      setDeltaX(0);
    };
    const onMove = e => {
      if (!swipeRef.current?.active) return;
      const dx = e.touches[0].clientX - swipeRef.current.x;
      const dy = Math.abs(e.touches[0].clientY - swipeRef.current.y);
      if (dy > VERT_ABORT) { swipeRef.current.active = false; setDeltaX(0); return; }
      e.preventDefault();
      setDeltaX(dx);
    };
    const onEnd = () => {
      if (swipeRef.current?.active && Math.abs(deltaX) >= SWIPE_THRESHOLD) onResolve(bet);
      swipeRef.current = null;
      setDeltaX(0);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove',  onMove,  { passive: false });
    el.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
      el.removeEventListener('touchend',   onEnd);
    };
  }, [isDesktop, isOwner, done, onResolve, deltaX, bet]);

  const actions=isOwner&&!done&&!isPending&&(
    <div style={{display:"flex",gap:8,...(isDesktop?{flexDirection:"column",alignItems:"stretch",flexShrink:0,justifyContent:"center"}:{})}}>
      {bet.isSecret
        ?<Btn variant="gold" sm style={isDesktop?{}:{flex:1}} onClick={()=>onReveal(bet)}>{t('bet_card.reveal')}</Btn>
        :<Btn variant="grn" sm style={isDesktop?{}:{flex:1}} onClick={()=>onResolve(bet)}>{t('bet_card.declare')}</Btn>
      }
      <button onClick={()=>onFlame(bet.id)} style={{...S.btn,padding:"7px 10px",background:"transparent",border:"1px solid var(--brd)",color:bet.flamed?"#f97316":"var(--dim)",fontSize:12}}>{bet.flamed?"🔥":"🤍"}</button>
      {canCancel&&onEdit&&(
        <button onClick={()=>onEdit(bet)} style={{...S.btn,padding:"7px 10px",background:"transparent",border:"1px solid var(--gold)44",color:"var(--gold)",fontSize:11}}>✏️ {t('bet_card.edit_btn')}</button>
      )}
      {canCancel&&(
        <button onClick={()=>{if(window.confirm(t('bet_card.cancel_confirm')))onDelete(bet);}} style={{...S.btn,padding:"7px 10px",background:"transparent",border:"1px solid var(--red)44",color:"var(--red)",fontSize:11}}>✕ {t('bet_card.cancel_btn')} ({t('bet_card.cancel_window',{m:minsLeft})})</button>
      )}
    </div>
  );

  return(
    <div ref={cardRef} className="sUp" style={{
      ...S.card, marginBottom:10, position:"relative", overflow:"hidden",
      opacity:done?0.78:1,
      border:`1px solid ${deltaX > 40 ? 'var(--grn)' : deltaX < -40 ? 'var(--red)' : bet.isSecret ? 'var(--gold)44' : 'var(--brd)'}`,
      transform: deltaX !== 0 ? `translateX(${Math.max(-60, Math.min(60, deltaX))}px)` : 'none',
      transition: deltaX === 0 ? 'transform .3s ease, border-color .2s' : 'border-color .1s',
    }}>
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:sideColor,borderRadius:"3px 0 0 3px"}}/>
      <div style={{paddingLeft:12,...(isDesktop?{display:"flex",alignItems:"flex-start",gap:16}:{})}}>
        {/* Main content */}
        <div style={{flex:isDesktop?1:undefined,minWidth:0}}>
          {/* Title row */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
            <div style={{flex:1}}>
              {bet.isSecret&&!done
                ?<div style={{...S.row,gap:6}}><span>🔒</span><span style={{fontWeight:600,fontSize:14,color:"var(--gold)"}}>{t('bet_card.secret_label')}</span></div>
                :<div style={{fontWeight:600,fontSize:14,lineHeight:1.35}}>{bet.title}</div>
              }
              <div style={{fontSize:11,color:"var(--dim)",marginTop:3}}>
                {cat.e} {catLabel(cat)} · {fmtD(bet.createdAt,lang)}
                {!isOwner&&<span style={{color:getC(profiles,bet.creator)}}> · {profiles[bet.creator]?.name}</span>}
              </div>
            </div>
            {/* Quota top-right: mobile only */}
            {!isDesktop&&!bet.isSecret&&<div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"var(--gold)"}}>{fmtQ(bet.quota)}×</div>
              <div style={{fontSize:10,color:"var(--dim)"}}>{qToP(bet.quota)}%</div>
            </div>}
          </div>

          {/* Badges */}
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
            {isDesktop&&!bet.isSecret&&<Bdg bg="var(--gold)22" c="var(--gold)">{fmtQ(bet.quota)}× · {qToP(bet.quota)}%</Bdg>}
            {!bet.isSecret&&<><Bdg bg="var(--mut)44" c="var(--dim)">{t('bet_card.stake')} {bet.stake} ₡</Bdg><Bdg bg="var(--grn)22" c="var(--grn)">{t('bet_card.win')} {bet.potentialWin} ₡</Bdg></>}
            {bet.pegno&&<Bdg bg="var(--gold)22" c="var(--gold)">🎁 {bet.pegno}</Bdg>}
            {tl&&<Bdg bg={isSoon(bet.expiresAt)?"var(--red)22":"var(--mut)33"} c={isSoon(bet.expiresAt)?"var(--red)":"var(--dim)"}>⏱ {tl}</Bdg>}
            {isPending&&<Bdg bg="var(--gold)22" c="var(--gold)">{t('bet_card.pending_label')}</Bdg>}
            {isRejected&&<Bdg bg="var(--red)22" c="var(--red)">❌ {t('bet_card.reject_btn')}</Bdg>}
            {!isPending&&!isRejected&&done&&<Bdg bg={bet.status==="won"?"var(--grn)22":"var(--red)22"} c={bet.status==="won"?"var(--grn)":"var(--red)"}>{bet.status==="won"?`✅ +${bet.potentialWin-bet.stake} ₡`:`❌ −${bet.stake} ₡`}</Bdg>}
          </div>

          {/* Comment */}
          {done&&bet.comment&&(
            <div style={{borderLeft:"3px solid var(--gold)",paddingLeft:10,marginBottom:8,marginTop:2}}>
              <div style={{fontSize:12,color:"var(--dim)",fontStyle:"italic",lineHeight:1.5}}>"{bet.comment}"</div>
            </div>
          )}

          {/* Counter-bet section */}
          {!bet.isSecret&&!done&&bet.isCounterable&&(
            <div style={{borderTop:"1px solid var(--brd)",paddingTop:8,marginBottom:8}}>
              <div style={{fontSize:10,color:"var(--dim)",letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>{t('bet_card.challenge')}</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                <Bdg bg="var(--grn)22" c="var(--grn)">{profiles[bet.creator]?.avatar} {t('bet_card.yes')} @ {fmtQ(bet.quota)}×</Bdg>
                {theirCounter&&<Bdg bg={theirCounter.side==="yes"?"var(--grn)22":"var(--red)22"} c={theirCounter.side==="yes"?"var(--grn)":"var(--red)"}>{profiles[theirCounter.bettor]?.avatar} {theirCounter.side==="yes"?t('bet_card.yes'):t('bet_card.no')} @ {fmtQ(theirCounter.quotaUsed)}×</Bdg>}
              </div>
              {!isOwner&&!myCounter&&<Btn variant="ghost" sm full onClick={()=>onCounter(bet)}>{t('bet_card.counter_cta',{qy:fmtQ(bet.quota),qn:fmtQ(qNo(bet.quota))})}</Btn>}
              {!isOwner&&myCounter&&<div style={{fontSize:12,color:"var(--dim)",fontStyle:"italic"}}>{t('bet_card.my_pos')} {myCounter.side==="yes"?t('bet_card.side_yes'):t('bet_card.side_no')} @ {fmtQ(myCounter.quotaUsed)}× · {myCounter.stake} ₡</div>}
            </div>
          )}

          {/* Reactions */}
          {!bet.isSecret&&onReaction&&(
            <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
              {EMOJIS.map(e=>{
                const count=betReactions.filter(r=>r.emoji===e).length;
                const isMe=myReaction?.emoji===e;
                return(
                  <button key={e} onClick={()=>onReaction(bet.id,e)} style={{display:"inline-flex",alignItems:"center",gap:3,padding:"4px 8px",borderRadius:20,border:`1px solid ${isMe?"var(--gold)":"var(--brd)"}`,background:isMe?"var(--gold)22":"transparent",cursor:"pointer",fontSize:13,color:isMe?"var(--gold)":"var(--dim)",fontFamily:"'Syne',sans-serif",fontWeight:600,transition:"all .15s"}}>
                    {e}{count>0&&<span style={{fontSize:11}}>{count}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Pending acceptance UI */}
          {isPending&&(
            <div style={{borderTop:'1px solid var(--brd)',paddingTop:8,marginTop:4}}>
              {user===bet.opponent?(
                <div>
                  <div style={{fontSize:12,color:'var(--dim)',marginBottom:8}}>{t('bet_card.pending_label')}</div>
                  <div style={{display:'flex',gap:8}}>
                    <Btn variant="grn" sm style={{flex:1}} onClick={()=>onAccept?.(bet.id)}>{t('bet_card.accept_btn')}</Btn>
                    <button onClick={()=>onReject?.(bet.id)} style={{...S.btn,flex:1,padding:'7px 10px',background:'transparent',border:'1px solid var(--red)44',color:'var(--red)',fontSize:12}}>{t('bet_card.reject_btn')}</button>
                  </div>
                </div>
              ):(
                <div style={{fontSize:12,color:'var(--dim)',fontStyle:'italic'}}>
                  {t('bet_card.waiting_acceptance',{name:profiles[bet.opponent]?.name??'...'})}
                </div>
              )}
            </div>
          )}

          {/* Swipe hint: mobile owned active bets */}
          {!isDesktop&&isOwner&&!done&&!isPending&&(
            <div style={{fontSize:9,color:'var(--mut)',textAlign:'center',marginTop:6,letterSpacing:1}}>
              ← {t('bet_card.swipe_resolve')} →
            </div>
          )}

          {/* Actions row: mobile only */}
          {!isDesktop&&actions}
        </div>

        {/* Actions column: desktop right side */}
        {isDesktop&&actions}
      </div>
    </div>
  );
}
