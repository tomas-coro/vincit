import React, { useRef, useEffect, useState } from 'react';
import { Btn, Bdg, Avatar, fmtQ, fmtD, tLeft, isSoon, qNo, COLORS, DEF_CAT_IDS as DEF_IDS } from './Atoms.jsx';
import { useLang } from '../i18n.js';
import CameraModal from './modals/CameraModal.jsx';
import SubsetEditModal from './modals/SubsetEditModal.jsx';
import CommentThread from './CommentThread.jsx';

const S = {
  card: {background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:16},
  btn: {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 18px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"'Manrope',sans-serif",fontSize:13,fontWeight:600,transition:"all .18s",userSelect:"none",whiteSpace:"nowrap"},
  row: {display:"flex",alignItems:"center",gap:10},
};

const getC = (profiles,user)=>COLORS[profiles[user]?.colorKey]||"#5b8af0";
const qToP = q=>Math.round(100/parseFloat(q));

const SWIPE_THRESHOLD = 80;
const VERT_ABORT      = 40;

export default function BetCard({bet,user,profiles,cats,onResolve,onReveal,onCounter,onFlame,onReaction,onReactionPhoto,reactions,onDelete,onEdit,isDesktop,onAccept,onReject,can,onConfirmOutcome,onWithdrawResolve,onOvertime}){
  const { t, lang } = useLang();
  const canModerate = typeof can === 'function' && can('moderate_bets');
  const [photoCaptureOpen, setPhotoCaptureOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [editSubsetOpen, setEditSubsetOpen] = useState(false);

  const handlePhotoCapture = async dataUrl => {
    if (!onReactionPhoto) return;
    setPhotoBusy(true);
    try { await onReactionPhoto(bet.id, dataUrl); }
    catch (err) { console.error(err); }
    finally { setPhotoBusy(false); }
  };
  const catLabel = c => DEF_IDS.includes(c.id) ? t('cats.'+c.id) : c.label;
  const isOwner=bet.creator===user;
  const isOpponent=bet.opponent===user;
  const isParty=isOwner||isOpponent;
  const hasOpponent=bet.opponent&&bet.opponent!==bet.creator;
  const isPending=bet.status==='pending';
  const isDisputed=bet.status==='disputed';
  const hasProposal=!!bet.pendingOutcome&&['active','disputed'].includes(bet.status);
  const iProposed=hasProposal&&bet.pendingOutcomeBy===user;
  const isRejected=bet.status==='rejected';
  const cat=cats.find(c=>c.id===bet.category)||cats[cats.length-1];
  const done=["won","lost","rejected"].includes(bet.status);
  const CANCEL_MS=60*1000;
  const createdAtMs = Number(bet.createdAt) || 0;

  // Live ticker — rerender once per second while we're inside the cancel window
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    if (!isOwner || done) return;
    const expireAt = createdAtMs + CANCEL_MS;
    if (Date.now() >= expireAt) return; // already past the window, nothing to tick
    const id = setInterval(() => {
      const t = Date.now();
      setNowTs(t);
      if (t >= expireAt) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [isOwner, done, createdAtMs]);

  // Owner cancel/edit rules:
  //   - Pending (waiting for opponent): always allowed — no one else
  //     has committed credits yet, so changes/cancel are safe.
  //   - Active (already accepted): 60s window. Past that, moderator only.
  //   Moderators (co-admin with moderate_bets, group owner) can always.
  const msLeft       = Math.max(0, createdAtMs + CANCEL_MS - nowTs);
  const withinWindow = msLeft > 0;
  const ownerCanMutate = isOwner && (isPending || withinWindow);
  const canCancel    = !done && !!onDelete && (ownerCanMutate || canModerate);
  const canEditBet   = !done && !!onEdit   && (ownerCanMutate || canModerate);
  const secsLeft     = Math.ceil(msLeft / 1000);
  const mm           = Math.floor(secsLeft / 60);
  const ss           = secsLeft % 60;
  const timerStr     = `${mm}:${ss.toString().padStart(2, '0')}`;
  const isUrgent     = secsLeft <= 10;
  const tl=tLeft(bet.expiresAt,lang);
  const myCounter=(bet.counterBets||[]).find(cb=>cb.bettor===user);
  const theirCounter=(bet.counterBets||[]).find(cb=>cb.bettor!==user);
  const sideColor=done?(bet.status==="won"?"var(--grn)":"var(--red)"):(bet.isSecret?"var(--gold)":cat.color);
  const betReactions=(reactions||[]).filter(r=>r.bet_id===bet.id);
  const emojiReactions=betReactions.filter(r=>r.emoji && !r.image_url);
  const photoReactions=betReactions.filter(r=>r.image_url);
  const myReaction=betReactions.find(r=>r.bettor===user);
  const EMOJIS=['🔥','😂','👀','💀','⚡'];

  // Swipe-to-resolve
  const cardRef  = useRef(null);
  const swipeRef = useRef(null);
  const deltaRef = useRef(0);
  const [deltaX, setDeltaX] = useState(0);
  const setDelta = (v) => { deltaRef.current = v; setDeltaX(v); };

  useEffect(() => {
    if (isDesktop || !isOwner || done || isPending || hasProposal || isDisputed || !onResolve) return;
    const el = cardRef.current;
    if (!el) return;

    const onStart = e => {
      if (!e.touches || !e.touches[0]) return;
      swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: true };
      setDelta(0);
    };
    const onMove = e => {
      if (!swipeRef.current?.active || !e.touches || !e.touches[0]) return;
      const dx = e.touches[0].clientX - swipeRef.current.x;
      const dy = Math.abs(e.touches[0].clientY - swipeRef.current.y);
      if (dy > VERT_ABORT) { swipeRef.current.active = false; setDelta(0); return; }
      e.preventDefault();
      setDelta(dx);
    };
    const onEnd = () => {
      if (swipeRef.current?.active && Math.abs(deltaRef.current) >= SWIPE_THRESHOLD) onResolve(bet);
      swipeRef.current = null;
      setDelta(0);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove',  onMove,  { passive: false });
    el.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
      el.removeEventListener('touchend',   onEnd);
    };
  }, [isDesktop, isOwner, done, isPending, hasProposal, isDisputed, onResolve, bet]);

  // Owner-side action row. Includes resolve/reveal (active bets only)
  // plus edit + cancel (allowed on pending too, per ownerCanMutate above).
  const actions=isOwner&&!done&&(
    <div style={{display:"flex",gap:8,...(isDesktop?{flexDirection:"column",alignItems:"stretch",flexShrink:0,justifyContent:"center"}:{})}}>
      {!isPending && (bet.isSecret
        ?<Btn variant="gold" sm style={isDesktop?{}:{flex:1}} onClick={()=>onReveal(bet)}>{t('bet_card.reveal')}</Btn>
        :(!hasProposal&&!isDisputed)
          ?<Btn variant="grn" sm style={isDesktop?{}:{flex:1}} onClick={()=>onResolve(bet)}>{hasOpponent?t('bet_card.propose_resolve'):t('bet_card.declare')}</Btn>
          :null
      )}
      <button onClick={()=>onFlame(bet.id)} style={{...S.btn,padding:"7px 10px",background:"transparent",border:"1px solid var(--brd)",color:bet.flamed?"#f97316":"var(--dim)",fontSize:12}}>{bet.flamed?"🔥":"🤍"}</button>
      {canEditBet&&(
        <button onClick={()=>onEdit(bet)} style={{...S.btn,padding:"7px 10px",background:"transparent",border:"1px solid var(--gold)44",color:"var(--gold)",fontSize:11}}>✏️ {t('bet_card.edit_btn')}{!isOwner && canModerate ? ' 🛡' : ''}</button>
      )}
      {canCancel&&(
        <button onClick={()=>{if(window.confirm(t('bet_card.cancel_confirm')))onDelete(bet);}} style={{
          ...S.btn,padding:"7px 10px",background:"transparent",
          border:`1px solid ${isUrgent && isOwner && withinWindow && !isPending ? 'var(--red)' : 'var(--red)44'}`,
          color: isUrgent && isOwner && withinWindow && !isPending ? 'var(--red)' : 'var(--red)',
          fontSize:11,
          fontVariantNumeric: 'tabular-nums',
        }}>
          ✕ {t('bet_card.cancel_btn')}
          {isOwner && withinWindow && !isPending && (
            <span style={{
              marginLeft:5,
              fontWeight:700,
              color: isUrgent ? 'var(--red)' : 'var(--dim)',
              opacity: isUrgent ? 1 : .85,
            }}>{timerStr}</span>
          )}
          {!isOwner && canModerate && ' 🛡'}
        </button>
      )}
    </div>
  );

  return(
    <div ref={cardRef} className="sUp" style={{
      position:"relative", overflow:"hidden",
      padding:"22px 0 24px 22px", marginBottom:0,
      borderBottom:`1px solid ${deltaX > 40 ? 'var(--grn)55' : deltaX < -40 ? 'var(--red)55' : 'var(--rule)'}`,
      opacity:done?0.55:1,
      transform: deltaX !== 0 ? `translateX(${Math.max(-60, Math.min(60, deltaX))}px)` : 'none',
      transition: deltaX === 0 ? 'transform .3s ease, border-color .2s, opacity .2s' : 'border-color .1s',
    }}>
      {/* Vertical accent rule — gold for vault, category color otherwise. */}
      <div style={{position:"absolute",left:0,top:22,bottom:24,width:2,background:bet.isSecret?'var(--gold)':sideColor}}/>
      <div style={{...(isDesktop?{display:"flex",alignItems:"flex-start",gap:24}:{})}}>
        {/* Main content */}
        <div style={{flex:isDesktop?1:undefined,minWidth:0}}>
          {/* Title row */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:10}}>
            <div style={{flex:1,minWidth:0}}>
              {bet.isSecret&&!done
                ?<div style={{...S.row,gap:8}}><span style={{fontSize:18}}>🔒</span><span style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontWeight:600,fontSize:22,color:"var(--gold)"}}>{t('bet_card.secret_label')}</span></div>
                :<div style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:600,fontSize:22,lineHeight:1.18,letterSpacing:'-0.005em'}}>{bet.title}</div>
              }
              <div style={{fontSize:9,color:"var(--dim)",marginTop:8,letterSpacing:'.22em',textTransform:'uppercase',fontWeight:600}}>
                <span style={{color:cat.color}}>{cat.e}</span> {catLabel(cat)} · {fmtD(bet.createdAt,lang)}
                {!isOwner&&<span style={{color:getC(profiles,bet.creator)}}> · {profiles[bet.creator]?.name}</span>}
              </div>
            </div>
            {/* Win amount top-right: mobile only — green, no quota label.
                Quota is now hidden everywhere; the visible primary number
                is "what you cash in" instead of an abstract multiplier. */}
            {!isDesktop&&!bet.isSecret&&<div style={{textAlign:"right",flexShrink:0,paddingTop:2}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:"var(--grn)",lineHeight:1,letterSpacing:'-0.02em'}}>
                {bet.potentialWin}<span style={{fontSize:13,opacity:.7,marginLeft:3}}>₡</span>
              </div>
              <div className="bc-meta" style={{fontSize:7,marginTop:3}}>{t('bet_card.win')}</div>
            </div>}
          </div>

          {/* Badges — stake on the left, win on the right. No more
              quota multiplier badge (users don't think in 1.5×). */}
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
            {!bet.isSecret&&<><Bdg bg="var(--mut)44" c="var(--dim)">{t('bet_card.stake')} {bet.stake} ₡</Bdg><Bdg bg="var(--grn)22" c="var(--grn)">{t('bet_card.win')} {bet.potentialWin} ₡</Bdg></>}
            {bet.pegno&&<Bdg bg="var(--gold)22" c="var(--gold)">🎁 {bet.pegno}</Bdg>}
            {bet.isSurprise && (isOwner || user === bet.opponent) && !done && <Bdg bg="var(--pur)22" c="var(--pur)">{t('bet_card.surprise_label')}</Bdg>}
            {bet.opponent && !bet.isSecret && !bet.isCounterable && profiles[bet.opponent] && (
              <Bdg bg="var(--grn)22" c="var(--grn)">{t('bet_card.targeted_vs', { name: profiles[bet.opponent].name })}</Bdg>
            )}
            {bet.targetUser && profiles[bet.targetUser] && (
              <Bdg bg="var(--pur)22" c="var(--pur)">{t('bet_card.target_on', { name: profiles[bet.targetUser].name })}</Bdg>
            )}
            {tl&&<Bdg bg={isSoon(bet.expiresAt)?"var(--red)22":"var(--mut)33"} c={isSoon(bet.expiresAt)?"var(--red)":"var(--dim)"}>⏱ {tl}</Bdg>}
            {isPending&&<Bdg bg="var(--gold)22" c="var(--gold)">{t('bet_card.pending_label')}</Bdg>}
            {isRejected&&<Bdg bg="var(--red)22" c="var(--red)">❌ {t('bet_card.reject_btn')}</Bdg>}
            {/* Subset (👥N): only an OPEN bet restricted to a subset of the group */}
            {Array.isArray(bet.allowedMembers) && bet.allowedMembers.length > 0 && (
              <Bdg bg="var(--blu)22" c="var(--blu)" title={t('bet_card.subset_tip')}>
                👥 {bet.allowedMembers.length} {t('bet_card.subset_label')}
              </Bdg>
            )}
            {/* Pot mode: targeted bet where opponent picked a stake. */}
            {bet.opponentStake != null && (
              <Bdg bg="var(--gold)22" c="var(--gold)" title={t('bet_card.pot_tip')}>
                💰 {t('bet_card.pot_label', { n: bet.stake + bet.opponentStake })}
              </Bdg>
            )}
            {!isPending&&!isRejected&&done&&(
              bet.opponentStake != null
                ? (() => {
                    const pot = bet.stake + bet.opponentStake;
                    const won = bet.status === 'won';
                    const isCreator = bet.creator === user;
                    const winnerIsMe = (won && isCreator) || (!won && bet.opponent === user);
                    const myStake = isCreator ? bet.stake : bet.opponentStake;
                    const theirStake = isCreator ? bet.opponentStake : bet.stake;
                    return winnerIsMe
                      ? <Bdg bg="var(--grn)22" c="var(--grn)">✅ +{theirStake} ₡ <span style={{opacity:.7,fontSize:10}}>· pot {pot} ₡</span></Bdg>
                      : <Bdg bg="var(--red)22" c="var(--red)">❌ −{myStake} ₡ <span style={{opacity:.7,fontSize:10}}>· pot {pot} ₡</span></Bdg>;
                  })()
                : <Bdg bg={bet.status==="won"?"var(--grn)22":"var(--red)22"} c={bet.status==="won"?"var(--grn)":"var(--red)"}>{bet.status==="won"?`✅ +${bet.potentialWin-bet.stake} ₡`:`❌ −${bet.stake} ₡`}</Bdg>
            )}
          </div>

          {/* Invited members stack (subset bets only, while active) */}
          {Array.isArray(bet.allowedMembers) && bet.allowedMembers.length > 0 && !done && (() => {
            const ids = bet.allowedMembers;
            const counterers = new Set((bet.counterBets || []).map(cb => cb.bettor));
            // Always include the creator at the front of the stack for context.
            const stackIds = [bet.creator, ...ids.filter(id => id !== bet.creator)].slice(0, 6);
            const canEditSubset = isOwner || canModerate;
            return (
              <div
                onClick={canEditSubset ? () => setEditSubsetOpen(true) : undefined}
                title={canEditSubset ? t('bet_card.manage_subset') : undefined}
                style={{
                display:'flex', alignItems:'center', gap:8, marginBottom:10,
                padding:'6px 10px', borderRadius:10,
                background:'var(--blu)0d', border:'1px solid var(--blu)33',
                cursor: canEditSubset ? 'pointer' : 'default',
              }}>
                <div style={{ display:'flex', alignItems:'center' }}>
                  {stackIds.map((id, i) => {
                    const p = profiles[id];
                    if (!p) return null;
                    const color = COLORS[p.colorKey] || '#5b8af0';
                    const acted = id === bet.creator || counterers.has(id);
                    return (
                      <div key={id} title={p.name + (acted ? ' ✓' : '')}
                        style={{
                          marginLeft: i === 0 ? 0 : -8,
                          width: 26, height: 26, borderRadius: '50%',
                          background: `${color}33`,
                          border: `2px solid ${acted ? 'var(--gold)' : 'var(--surf)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, overflow: 'hidden', flexShrink: 0,
                          zIndex: 10 - i,
                          boxShadow: acted ? '0 0 0 1px var(--gold)55' : 'none',
                        }}>
                        {p.avatarUrl
                          ? <img src={p.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                          : (p.avatar || '?')}
                      </div>
                    );
                  })}
                  {ids.length > 5 && (
                    <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--mut)' }}>+{ids.length - 5}</span>
                  )}
                </div>
                <div style={{ flex: 1, fontSize: 10, color: 'var(--blu)', letterSpacing: 0.5 }}>
                  {counterers.size > 0
                    ? t('bet_card.subset_progress', { done: counterers.size, total: ids.length })
                    : t('bet_card.subset_pending', { n: ids.length })}
                </div>
                {canEditSubset && (
                  <span style={{ fontSize: 12, color: 'var(--blu)', opacity: .7 }}>✏️</span>
                )}
              </div>
            );
          })()}

          {/* Comment */}
          {done&&bet.comment&&(
            <div style={{borderLeft:"3px solid var(--gold)",paddingLeft:10,marginBottom:8,marginTop:2}}>
              <div style={{fontSize:12,color:"var(--dim)",fontStyle:"italic",lineHeight:1.5}}>"{bet.comment}"</div>
            </div>
          )}

          {/* Counter-bet section. Positions are shown as absolute payouts
              ("YES · 25 ₡") instead of quota multipliers. */}
          {!bet.isSecret&&!done&&bet.isCounterable&&(
            <div style={{borderTop:"1px solid var(--brd)",paddingTop:8,marginBottom:8}}>
              <div style={{fontSize:10,color:"var(--dim)",letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>{t('bet_card.challenge')}</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                <Bdg bg="var(--grn)22" c="var(--grn)">{profiles[bet.creator]?.avatar} {t('bet_card.yes')} · {bet.potentialWin} ₡</Bdg>
                {theirCounter&&<Bdg bg={theirCounter.side==="yes"?"var(--grn)22":"var(--red)22"} c={theirCounter.side==="yes"?"var(--grn)":"var(--red)"}>{profiles[theirCounter.bettor]?.avatar} {theirCounter.side==="yes"?t('bet_card.yes'):t('bet_card.no')} · {Math.round((theirCounter.stake||0)*(parseFloat(theirCounter.quotaUsed)||1))} ₡</Bdg>}
              </div>
              {!isOwner&&!myCounter&&<Btn variant="ghost" sm full onClick={()=>onCounter(bet)}>{t('bet_card.counter_cta_simple')}</Btn>}
              {!isOwner&&myCounter&&<div style={{fontSize:12,color:"var(--dim)",fontStyle:"italic"}}>{t('bet_card.my_pos')} {myCounter.side==="yes"?t('bet_card.side_yes'):t('bet_card.side_no')} · {myCounter.stake} ₡</div>}
            </div>
          )}

          {/* Reactions */}
          {!bet.isSecret&&onReaction&&(
            <div style={{marginTop:8}}>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                {EMOJIS.map(e=>{
                  const count=emojiReactions.filter(r=>r.emoji===e).length;
                  const isMe=myReaction?.emoji===e;
                  return(
                    <button key={e} onClick={()=>onReaction(bet.id,e)} style={{display:"inline-flex",alignItems:"center",gap:3,padding:"4px 8px",borderRadius:20,border:`1px solid ${isMe?"var(--gold)":"var(--brd)"}`,background:isMe?"var(--gold)22":"transparent",cursor:"pointer",fontSize:13,color:isMe?"var(--gold)":"var(--dim)",fontFamily:"'Manrope',sans-serif",fontWeight:600,transition:"all .15s"}}>
                      {e}{count>0&&<span style={{fontSize:11}}>{count}</span>}
                    </button>
                  );
                })}
                {onReactionPhoto && (
                  <button onClick={()=>setPhotoCaptureOpen(true)} disabled={photoBusy}
                    title="Reagisci con una foto"
                    style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px 5px 9px",borderRadius:20,
                      border:'2px solid var(--gold)',
                      background: myReaction?.image_url
                        ? 'linear-gradient(90deg, var(--gold)33, var(--gold)22)'
                        : 'linear-gradient(90deg, var(--gold)18, var(--gold)10)',
                      cursor:'pointer', fontSize:11, color:'var(--gold)',
                      fontFamily:"'Manrope',sans-serif", fontWeight:800, letterSpacing:1,
                      boxShadow:'0 0 10px var(--glow), inset 0 1px 0 rgba(255,255,255,.06)',
                      transition:'all .15s', opacity: photoBusy ? .5 : 1,
                      flexShrink:0}}>
                    <span style={{fontSize:14, lineHeight:1, filter:'drop-shadow(0 0 4px var(--glow))'}}>📸</span>
                    <span style={{textTransform:'uppercase'}}>Foto</span>
                  </button>
                )}
              </div>
              {photoReactions.length>0 && (
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                  {photoReactions.map(r=>{
                    const author = profiles[r.bettor];
                    const c = COLORS[author?.colorKey] || "#5b8af0";
                    return (
                      <div key={r.bettor} onClick={()=>setLightbox(r)}
                        style={{position:"relative",cursor:"pointer",borderRadius:10,overflow:"hidden",
                          border:`2px solid ${c}66`,width:56,height:56,flexShrink:0,
                          boxShadow:`0 0 8px ${c}33`,transition:"transform .15s"}}
                        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.08)'}
                        onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                        <img src={r.image_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                        <div style={{position:"absolute",bottom:-1,left:-1,right:-1,padding:"1px 4px",
                          background:"linear-gradient(180deg, transparent, rgba(0,0,0,.85))",
                          fontSize:9,color:"#fff",fontWeight:600,textAlign:"center"}}>
                          {author?.avatar || ''} {author?.name?.slice(0,8) || ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Consensual-resolve strip: pending proposal or active dispute. */}
          {(hasProposal||isDisputed)&&isParty&&(
            <div style={{borderTop:'1px solid var(--brd)',paddingTop:10,marginTop:6}}>
              {isDisputed?(
                <>
                  <div style={{fontSize:12,fontWeight:700,color:'var(--red)',marginBottom:4}}>{t('bet_card.disputed_label')}</div>
                  <div style={{fontSize:11,color:'var(--mut)',marginBottom:10,lineHeight:1.5}}>{t('bet_card.disputed_help')}</div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    <Btn variant="gold" sm style={{flex:1,minWidth:140}} onClick={()=>onOvertime?.(bet)}>{t('bet_card.disputed_overtime')}</Btn>
                    {isOwner&&<Btn variant="ghost" sm style={{flex:1,minWidth:140}} onClick={()=>onResolve?.(bet)}>{t('bet_card.disputed_repropose')}</Btn>}
                  </div>
                </>
              ):iProposed?(
                <>
                  <div style={{fontSize:12,color:'var(--dim)',marginBottom:8}}>
                    {t('bet_card.proposed_waiting',{
                      label: bet.pendingOutcome==='won'?t('bet_card.yes_short'):t('bet_card.no_short'),
                      name:  profiles[isOwner?bet.opponent:bet.creator]?.name ?? '...'
                    })}
                  </div>
                  <button onClick={()=>onWithdrawResolve?.(bet)}
                    style={{...S.btn,padding:'7px 12px',background:'transparent',border:'1px solid var(--brd)',color:'var(--dim)',fontSize:12}}>
                    {t('bet_card.proposed_withdraw')}
                  </button>
                </>
              ):(
                <>
                  <div style={{fontSize:12,color:'var(--dim)',marginBottom:10,lineHeight:1.4}}>
                    {t('bet_card.proposed_other',{
                      name:  profiles[bet.pendingOutcomeBy]?.name ?? '...',
                      label: bet.pendingOutcome==='won'?t('bet_card.yes_short'):t('bet_card.no_short')
                    })}
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <Btn variant="grn" sm style={{flex:1}} onClick={()=>onConfirmOutcome?.(bet,bet.pendingOutcome)}>
                      {t('bet_card.proposed_confirm',{label: bet.pendingOutcome==='won'?t('bet_card.yes_short'):t('bet_card.no_short')})}
                    </Btn>
                    <button onClick={()=>onConfirmOutcome?.(bet,bet.pendingOutcome==='won'?'lost':'won')}
                      style={{...S.btn,flex:1,padding:'7px 10px',background:'transparent',border:'1px solid var(--red)44',color:'var(--red)',fontSize:12}}>
                      {t('bet_card.proposed_reject')}
                    </button>
                  </div>
                </>
              )}
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

          {/* Swipe hint: mobile owned active bets, only when no proposal pending */}
          {!isDesktop&&isOwner&&!done&&!isPending&&!hasProposal&&!isDisputed&&(
            <div style={{fontSize:9,color:'var(--mut)',textAlign:'center',marginTop:6,letterSpacing:1}}>
              ← {t('bet_card.swipe_resolve')} →
            </div>
          )}

          {/* Comment thread — Twitter-style replies. Anyone in the room
              can read/post; hidden on vault bets (private). */}
          {!bet.isSecret && user && (
            <CommentThread
              betId={bet.id}
              user={user}
              profiles={profiles}
              initialCount={bet.messageCount ?? 0}
            />
          )}

          {/* Actions row: mobile only */}
          {!isDesktop&&actions}
        </div>

        {/* Actions column: desktop right side */}
        {isDesktop&&actions}
      </div>

      {photoCaptureOpen && (
        <CameraModal
          onCapture={handlePhotoCapture}
          onClose={() => setPhotoCaptureOpen(false)}
        />
      )}

      {editSubsetOpen && (
        <SubsetEditModal
          bet={bet}
          groupMembers={Object.entries(profiles).map(([id,p]) => ({
            id, name:p.name, avatar:p.avatar,
            avatar_url:p.avatarUrl, color_key:p.colorKey || p.color,
          }))}
          onSaved={() => { /* SSE refresh will arrive shortly */ }}
          onClose={() => setEditSubsetOpen(false)}
        />
      )}

      {lightbox && (
        <div onClick={()=>setLightbox(null)} style={{
          position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:300,
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
          padding:20,cursor:"pointer",
        }}>
          <img src={lightbox.image_url} alt="" style={{maxWidth:"90vw",maxHeight:"80vh",borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,.7)"}}/>
          <div style={{marginTop:14,color:"#ede8fd",fontFamily:"'Manrope',sans-serif",fontSize:14,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>{profiles[lightbox.bettor]?.avatar}</span>
            <span style={{fontWeight:600}}>{profiles[lightbox.bettor]?.name}</span>
          </div>
          <div style={{position:"absolute",top:20,right:24,color:"#8480a0",fontSize:11,letterSpacing:2,fontFamily:"'Manrope',sans-serif"}}>{t('bet_card.tap_close')}</div>
        </div>
      )}
    </div>
  );
}
