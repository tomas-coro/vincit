import React from 'react';
import { Btn, Bdg, Avatar, fmtQ, fmtD, tLeft, isSoon, qNo, COLORS } from './Atoms.jsx';

const S = {
  card: {background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:16},
  btn: {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 18px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:600,transition:"all .18s",userSelect:"none",whiteSpace:"nowrap"},
  row: {display:"flex",alignItems:"center",gap:10},
};

const getC = (profiles,user)=>COLORS[profiles[user].colorKey]||"#5b8af0";
const qToP = q=>Math.round(100/parseFloat(q));

export default function BetCard({bet,user,profiles,cats,onResolve,onReveal,onCounter,onFlame,onReaction,reactions,isDesktop}){
  const other=user==="tomas"?"giulia":"tomas";
  const isOwner=bet.creator===user;
  const cat=cats.find(c=>c.id===bet.category)||cats[cats.length-1];
  const done=["won","lost"].includes(bet.status);
  const tl=tLeft(bet.expiresAt);
  const myCounter=(bet.counterBets||[]).find(cb=>cb.bettor===user);
  const theirCounter=(bet.counterBets||[]).find(cb=>cb.bettor!==user);
  const sideColor=done?(bet.status==="won"?"var(--grn)":"var(--red)"):(bet.isSecret?"var(--gold)":cat.color);
  const betReactions=(reactions||[]).filter(r=>r.bet_id===bet.id);
  const myReaction=betReactions.find(r=>r.bettor===user);
  const EMOJIS=['🔥','😂','👀','💀','⚡'];

  const actions=isOwner&&!done&&(
    <div style={{display:"flex",gap:8,...(isDesktop?{flexDirection:"column",alignItems:"stretch",flexShrink:0,justifyContent:"center"}:{})}}>
      {bet.isSecret
        ?<Btn variant="gold" sm style={isDesktop?{}:{flex:1}} onClick={()=>onReveal(bet)}>🔓 Rivela</Btn>
        :<Btn variant="grn" sm style={isDesktop?{}:{flex:1}} onClick={()=>onResolve(bet)}>Dichiara esito</Btn>
      }
      <button onClick={()=>onFlame(bet.id)} style={{...S.btn,padding:"7px 10px",background:"transparent",border:"1px solid var(--brd)",color:bet.flamed?"#f97316":"var(--dim)",fontSize:12}}>{bet.flamed?"🔥":"🤍"}</button>
    </div>
  );

  return(
    <div className="sUp" style={{...S.card,marginBottom:10,position:"relative",overflow:"hidden",opacity:done?0.78:1,border:`1px solid ${bet.isSecret?"var(--gold)44":"var(--brd)"}`}}>
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:sideColor,borderRadius:"3px 0 0 3px"}}/>
      <div style={{paddingLeft:12,...(isDesktop?{display:"flex",alignItems:"flex-start",gap:16}:{})}}>
        {/* Main content */}
        <div style={{flex:isDesktop?1:undefined,minWidth:0}}>
          {/* Title row */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
            <div style={{flex:1}}>
              {bet.isSecret&&!done
                ?<div style={{...S.row,gap:6}}><span>🔒</span><span style={{fontWeight:600,fontSize:14,color:"var(--gold)"}}>Bet Segreta</span></div>
                :<div style={{fontWeight:600,fontSize:14,lineHeight:1.35}}>{bet.title}</div>
              }
              <div style={{fontSize:11,color:"var(--dim)",marginTop:3}}>
                {cat.e} {cat.label} · {fmtD(bet.createdAt)}
                {!isOwner&&<span style={{color:getC(profiles,bet.creator)}}> · {profiles[bet.creator].name}</span>}
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
            {!bet.isSecret&&<><Bdg bg="var(--mut)44" c="var(--dim)">Stake {bet.stake} ₡</Bdg><Bdg bg="var(--grn)22" c="var(--grn)">Win {bet.potentialWin} ₡</Bdg></>}
            {bet.pegno&&<Bdg bg="var(--gold)22" c="var(--gold)">🎁 {bet.pegno}</Bdg>}
            {tl&&<Bdg bg={isSoon(bet.expiresAt)?"var(--red)22":"var(--mut)33"} c={isSoon(bet.expiresAt)?"var(--red)":"var(--dim)"}>⏱ {tl}</Bdg>}
            {done&&<Bdg bg={bet.status==="won"?"var(--grn)22":"var(--red)22"} c={bet.status==="won"?"var(--grn)":"var(--red)"}>{bet.status==="won"?`✅ +${bet.potentialWin-bet.stake} ₡`:`❌ −${bet.stake} ₡`}</Bdg>}
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
              <div style={{fontSize:10,color:"var(--dim)",letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>Sfida diretta</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                <Bdg bg="var(--grn)22" c="var(--grn)">{profiles[bet.creator].avatar} SÌ @ {fmtQ(bet.quota)}×</Bdg>
                {theirCounter&&<Bdg bg={theirCounter.side==="yes"?"var(--grn)22":"var(--red)22"} c={theirCounter.side==="yes"?"var(--grn)":"var(--red)"}>{profiles[theirCounter.bettor].avatar} {theirCounter.side==="yes"?"SÌ":"NO"} @ {fmtQ(theirCounter.quotaUsed)}×</Bdg>}
              </div>
              {!isOwner&&!myCounter&&<Btn variant="ghost" sm full onClick={()=>onCounter(bet)}>⚡ Scommetti SÌ {fmtQ(bet.quota)}× o NO {fmtQ(qNo(bet.quota))}×</Btn>}
              {!isOwner&&myCounter&&<div style={{fontSize:12,color:"var(--dim)",fontStyle:"italic"}}>La tua posizione: {myCounter.side==="yes"?"✅ SÌ":"❌ NO"} @ {fmtQ(myCounter.quotaUsed)}× · {myCounter.stake} ₡</div>}
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

          {/* Actions row: mobile only */}
          {!isDesktop&&actions}
        </div>

        {/* Actions column: desktop right side */}
        {isDesktop&&actions}
      </div>
    </div>
  );
}
