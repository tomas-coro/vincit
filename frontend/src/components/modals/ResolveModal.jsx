import React, { useState } from 'react';
import { Btn, Avatar, fmtQ, qToP, COLORS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import Coin3D, { CoinFaceTesta, CoinFaceCroce } from '../Coin.jsx';
import useEscClose from '../../hooks/useEscClose.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';

// Shared modal shell — dark overlay, centered editorial panel.
const OVERLAY = {position:"fixed",inset:0,background:"rgba(15,11,35,.78)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:24};
const PANEL   = {background:"var(--surf)",border:"1px solid var(--rule)",borderRadius:6,padding:"32px 30px",boxShadow:"0 30px 80px rgba(0,0,0,.55)"};

const Bdg = ({c,bg,children}) => (
  <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"5px 11px",borderRadius:999,fontSize:10,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",background:bg,color:c}}>{children}</span>
);

export function ResolveModal({bet,cats,profiles,onResolve,onClose}){
  useEscClose(onClose);
  useBodyScrollLock();
  const { t } = useLang();
  const [done,setDone]=useState(false);
  const go = o => { setDone(true); setTimeout(()=>onResolve(bet,o),200); };
  const cbs = bet.counterBets || [];

  return(
    <div style={OVERLAY} onClick={onClose}>
      <div className="bIn" style={{...PANEL, width:"100%", maxWidth:420}} onClick={e=>e.stopPropagation()}>
        {/* Meta + title — editorial header */}
        <div className="bc-meta" style={{marginBottom:10}}>— {t('resolve.title')}</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:26,fontWeight:600,lineHeight:1.15,letterSpacing:"-0.01em",marginBottom:22,color:"var(--txt)"}}>
          “{bet.title}”
        </div>

        {/* Numbers row — separated by vertical hairlines */}
        <div style={{display:"flex",marginBottom:cbs.length>0?20:28,borderTop:"1px solid var(--rule)",borderBottom:"1px solid var(--rule)",padding:"16px 0"}}>
          {[
            {l:t('resolve.quota'), v:`${fmtQ(bet.quota)}×`,         c:"var(--gold)"},
            {l:t('resolve.stake'), v:`${bet.stake} ₡`,               c:"var(--txt)"},
            {l:t('resolve.win'),   v:`${bet.potentialWin} ₡`,        c:"var(--grn)"},
          ].map((s,i,arr) => (
            <div key={s.l} style={{flex:1, textAlign:i===0?"left":i===arr.length-1?"right":"center", borderLeft:i===0?"none":"1px solid var(--rule)", paddingLeft:i===0?0:14}}>
              <div className="bc-num" style={{fontSize:24, color:s.c}}>{s.v}</div>
              <div className="bc-meta" style={{marginTop:6, fontSize:8}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Counter positions — pure type, no card frame */}
        {cbs.length>0 && (
          <div style={{marginBottom:24}}>
            <div className="bc-meta" style={{marginBottom:10}}>{t('resolve.positions')}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <Bdg bg="var(--grn)18" c="var(--grn)">{profiles[bet.creator]?.avatar} {t('resolve.yes')} · {bet.stake}₡</Bdg>
              {cbs.map(cb=>(
                <Bdg key={cb.bettor} bg={cb.side==="yes"?"var(--grn)18":"var(--red)18"} c={cb.side==="yes"?"var(--grn)":"var(--red)"}>
                  {profiles[cb.bettor]?.avatar} {cb.side==="yes"?t('resolve.yes'):t('resolve.no')} · {cb.stake}₡
                </Bdg>
              ))}
            </div>
          </div>
        )}

        {/* Decisions — stacked pills, primary states obvious. Overtime
            is no longer offered here: a coin flip in a non-disputed
            resolve doesn't make sense. The "🪙 Decidi col caso" path
            stays in BetCard, but only appears when creator and
            opponent have actually proposed conflicting outcomes (true
            dispute). That's where the coin earns its keep as a tiebreaker. */}
        <Btn variant="grn" full style={{marginBottom:10, opacity: done ? .55 : 1}} disabled={done} onClick={()=>go("won")}>
          {done ? '⏳ In invio…' : t('resolve.yes_btn',{net:bet.potentialWin-bet.stake})}
        </Btn>
        <Btn variant="red" full style={{marginBottom:18, opacity: done ? .55 : 1}} disabled={done} onClick={()=>go("lost")}>
          {done ? '⏳ In invio…' : t('resolve.no_btn',{stake:bet.stake})}
        </Btn>

        <button onClick={onClose} style={{
          width:"100%", padding:"4px 0",
          background:"transparent", border:"none", cursor:"pointer",
          fontFamily:"'Manrope',sans-serif", fontSize:10, fontWeight:600,
          letterSpacing:".3em", textTransform:"uppercase", color:"var(--dim)",
        }}>{t('resolve.cancel')}</button>
      </div>
    </div>
  );
}

// Small helper: a single coin face with its side label above and the
// player it represents underneath. Used in the 'ready' phase so the
// mapping testa→creator / croce→opponent is on display before the toss.
function FaceCard({ side, player, label, faceSize }) {
  const Face = side === 'testa' ? CoinFaceTesta : CoinFaceCroce;
  return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center', minWidth:0, flex:'0 0 auto'}}>
      <div className="bc-meta" style={{
        fontSize:9, letterSpacing:'.32em', color:'var(--gold)',
        marginBottom:8, opacity:.9,
      }}>{label}</div>
      <div style={{width:faceSize, height:faceSize}}>
        <Face size={faceSize}/>
      </div>
      <div style={{
        fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
        fontSize:14, fontWeight:600, color:'var(--txt)', marginTop:10,
        maxWidth: faceSize + 12,
        display:'flex', alignItems:'center', gap:4,
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
      }}>
        <span style={{fontSize:15}}>{player?.avatar || '👤'}</span>
        <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
          {player?.name || '—'}
        </span>
      </div>
    </div>
  );
}

export function OvertimeModal({bet,profiles,onResult,onClose}){
  useEscClose(onClose);
  useBodyScrollLock();
  const { t } = useLang();
  const [phase,setPhase]=useState("ready");      // 'ready' | 'flipping' | 'result'
  const [winner,setWinner]=useState(null);
  const [coinSide,setCoinSide]=useState(null);   // 'testa' (creator) | 'croce' (opponent)
  const [flipKey,setFlipKey]=useState(0);        // bumps every flip so Coin3D remounts and replays the animation
  const FLIP_MS = 2600;                          // matches Coin3D's default 2600ms

  // ─── Coin-to-player mapping ───────────────────────────────────────
  // TESTA (face "777 ₡") → bet creator. They put the bet into play, so
  //                       the "value" side of the coin is theirs.
  // CROCE (face "BC" monogram) → opponent.
  //
  // Opponent resolution:
  //   - targeted/surprise: bet.opponent is the canonical adversary
  //   - everything else (open / vault):  fall back to "first profile in
  //                                       group that isn't the creator"
  const creatorId  = bet.creator;
  const opponentId = bet.opponent
    ?? Object.keys(profiles).find(k => k !== creatorId)
    ?? creatorId;
  const creator  = profiles[creatorId];
  const opponent = profiles[opponentId];

  const flip = () => {
    const creatorWins = Math.random() < 0.5;
    setCoinSide(creatorWins ? 'testa' : 'croce');
    setWinner(creatorWins ? creatorId : opponentId);
    setFlipKey(k => k + 1);
    setPhase("flipping");
    setTimeout(() => setPhase("result"), FLIP_MS + 200);
  };

  const FLIP_COIN_SIZE = 150;
  // Side-by-side faces — smaller, but readable. 92px works on iPhone SE
  // (335-30px modal padding leaves 305px; 92*2 + ~50 gap = 234px → fits).
  const FACE_SIZE = 92;

  return(
    <div style={OVERLAY} onClick={onClose}>
      <div className="bIn" style={{...PANEL,width:"100%",maxWidth:380,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
        <div className="bc-meta" style={{marginBottom:10}}>— {t('overtime.title')}</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:24,fontWeight:600,lineHeight:1.15,marginBottom:6,color:"var(--txt)"}}>
          “{bet.title}”
        </div>
        <div style={{fontSize:12,color:"var(--dim)",marginBottom:24,letterSpacing:".02em"}}>
          {phase === 'ready' ? t('overtime.assign_hint') : t('overtime.desc')}
        </div>

        {/* ─── Phase: ready — both faces with player assignment ─── */}
        {phase === 'ready' && (
          <div style={{
            display:'flex', alignItems:'flex-start', justifyContent:'center',
            gap:14, marginBottom:24, flexWrap:'nowrap',
          }}>
            <FaceCard side="testa" player={creator}  label={t('overtime.head_label')} faceSize={FACE_SIZE}/>
            <div style={{
              fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
              fontSize:18, color:'var(--dim)', opacity:.55,
              alignSelf:'center', paddingTop:14, flex:'0 0 auto',
            }}>vs.</div>
            <FaceCard side="croce" player={opponent} label={t('overtime.tail_label')} faceSize={FACE_SIZE}/>
          </div>
        )}

        {/* ─── Phase: flipping / result — single Coin3D ─── */}
        {phase !== 'ready' && (
          <div style={{
            marginBottom:28, display:'flex', justifyContent:'center',
            filter: phase === 'flipping' ? 'drop-shadow(0 0 18px rgba(196,168,120,.5))' : 'none',
          }}>
            <Coin3D key={flipKey} result={coinSide || 'testa'} size={FLIP_COIN_SIZE}/>
          </div>
        )}

        {phase === 'ready' && (
          <Btn variant="gold" style={{padding:"13px 36px"}} onClick={flip}>
            {t('overtime.flip')}
          </Btn>
        )}
        {phase === 'flipping' && (
          <div className="bc-meta" style={{fontSize:11}}>{t('overtime.flipping')}</div>
        )}

        {phase === 'result' && winner && (
          <div className="bIn">
            {/* The landed-side line — explicitly tells the user which
                face came up before announcing the winner. */}
            <div className="bc-meta" style={{
              fontSize:9, marginBottom:8, color:'var(--gold)',
              letterSpacing:'.32em',
            }}>
              {t('overtime.result_landed', {
                side: coinSide === 'testa' ? t('overtime.head_label') : t('overtime.tail_label'),
              })}
            </div>
            <div style={{
              fontFamily:"'Cormorant Garamond',serif", fontStyle:"italic",
              fontSize:28, fontWeight:600, color:"var(--gold)",
              marginBottom:8, letterSpacing:"-0.01em",
            }}>
              {profiles[winner]?.avatar} {profiles[winner]?.name} {t('overtime.winner')}
            </div>
            <div style={{fontSize:12,color:"var(--dim)",marginBottom:24}}>{t('overtime.fate')}</div>
            <div style={{display:"flex",gap:10}}>
              <Btn variant="grn"   style={{flex:1}} onClick={()=>onResult(bet,winner===bet.creator?"won":"lost")}>{t('overtime.accept')}</Btn>
              <Btn variant="ghost" style={{flex:1}} onClick={onClose}>{t('overtime.close')}</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
