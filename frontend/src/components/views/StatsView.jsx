import React, { useState, useEffect, useRef } from 'react';
import { SecLabel, Avatar, fmtQ, qToP, COLORS, getC, DEF_CAT_IDS as DEF_IDS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import Sparkline from '../Sparkline.jsx';
import StreakBadge, { StreakInline } from '../StreakBadge.jsx';
import * as api from '../../api.js';

// Editorial section pattern — no card box, content separated by hairlines.
const S = {
  card:    {padding:"22px 0", borderBottom:"1px solid var(--rule)"},
  tile:    {padding:"16px 0", textAlign:"center"},
  raised:  {background:"var(--soft)", border:"1px solid var(--rule)", borderRadius:4, padding:16},
  bdg:     {display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:999,fontSize:10,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"},
};

const Bdg=({c,bg,children})=><span style={{...S.bdg,background:bg,color:c}}>{children}</span>;

export default function StatsView({user,profiles,groupMembers,credits,bets,cats,isDesktop}){
  const { t } = useLang();
  const catLabel = c => DEF_IDS.includes(c.id) ? t('cats.'+c.id) : c.label;
  const won=bets.filter(b=>b.creator===user&&b.status==="won");
  const lost=bets.filter(b=>b.creator===user&&b.status==="lost");

  // Per-member group leaderboard
  const memberIds = (groupMembers && groupMembers.length
    ? groupMembers.map(m => m.id)
    : Object.keys(profiles));
  const leaderboard = memberIds.map(id => {
    const p = profiles[id] || (groupMembers && groupMembers.find(m => m.id === id));
    const w = bets.filter(b => b.creator === id && b.status === 'won');
    const l = bets.filter(b => b.creator === id && b.status === 'lost');
    const tot = w.length + l.length;
    const wr = tot ? Math.round(w.length / tot * 100) : 0;
    const netVal = w.reduce((s,b) => s + (b.potentialWin - b.stake), 0) - l.reduce((s,b) => s + b.stake, 0);
    const bestWin = w.reduce((best, b) => (!best || (b.potentialWin - b.stake) > (best.potentialWin - best.stake)) ? b : best, null);
    return {
      id, p, w: w.length, l: l.length, tot, wr,
      net: netVal,
      bal: Math.round(credits[id] ?? 0),
      bestWin,
      isMe: id === user,
    };
  }).filter(r => r.p)
    .sort((a,b) => b.bal - a.bal || b.w - a.w);
  const all=[...won,...lost];
  const wr=all.length?Math.round(won.length/all.length*100):0;
  const net=won.reduce((s,b)=>s+b.potentialWin-b.stake,0)-lost.reduce((s,b)=>s+b.stake,0);
  const best=won.length?won.reduce((a,b)=>b.potentialWin>a.potentialWin?b:a):null;
  let streak=0,cur=0;
  [...bets].filter(b=>b.creator===user&&["won","lost"].includes(b.status)).sort((a,b)=>a.createdAt-b.createdAt).forEach(b=>{cur=b.status==="won"?cur+1:0;if(cur>streak)streak=cur;});
  const flamed=all.filter(b=>b.flamed);
  const catS=cats.map(c=>({...c,w:won.filter(b=>b.category===c.id).length,l:lost.filter(b=>b.category===c.id).length})).filter(c=>c.w+c.l>0);

  // Balance trajectory (approximate: start at 100, walk through resolved bets chronologically)
  const sortedResolved = [...all].sort((a,b) => (a.resolvedAt||a.createdAt) - (b.resolvedAt||b.createdAt));
  const balanceSeries = (() => {
    if (sortedResolved.length === 0) return [];
    let bal = 100;
    const pts = [bal];
    for (const b of sortedResolved) {
      bal += b.status === 'won' ? (b.potentialWin - b.stake) : -b.stake;
      pts.push(bal);
    }
    return pts;
  })();
  const peakBalance = balanceSeries.length ? Math.max(...balanceSeries) : 100;
  const lowBalance  = balanceSeries.length ? Math.min(...balanceSeries) : 100;

  // Compute personal loss streak (best run length)
  const myChronologicalResolved = [...bets]
    .filter(b => b.creator === user && ['won','lost'].includes(b.status))
    .sort((a,b) => (a.resolvedAt||a.createdAt) - (b.resolvedAt||b.createdAt));
  let _bestLoss = 0, _cl = 0, _curWinStr = 0, _curLossStr = 0;
  for (const b of myChronologicalResolved) {
    if (b.status === 'lost') { _cl++; if (_cl > _bestLoss) _bestLoss = _cl; }
    else _cl = 0;
  }
  // Current trailing streaks (from the end backwards)
  for (let i = myChronologicalResolved.length - 1; i >= 0; i--) {
    const s = myChronologicalResolved[i].status;
    if (s === 'won' && _curLossStr === 0) _curWinStr++;
    else if (s === 'lost' && _curWinStr === 0) _curLossStr++;
    else break;
  }

  // Head-to-head member selection
  const [h2hId, setH2hId] = useState(null);
  const others = (groupMembers && groupMembers.length ? groupMembers : [])
    .filter(m => m.id !== user);
  useEffect(() => {
    if (!h2hId && others[0]) setH2hId(others[0].id);
  }, [h2hId, others]);

  // Responsive sparkline width based on container measurement
  const sparkRef = useRef(null);
  const [sparkW, setSparkW] = useState(280);
  useEffect(() => {
    if (!sparkRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width;
      if (w && w > 0) setSparkW(Math.floor(w));
    });
    ro.observe(sparkRef.current);
    return () => ro.disconnect();
  }, []);
  // Editorial balance hero — single giant Playfair number, tracked meta above
  const balanceCard=(
    <div style={{padding:"4px 0 26px", borderBottom:"1px solid var(--rule)", marginBottom:0}}>
      <div className="bc-meta" style={{marginBottom:8}}>{t('stats_view.balance')}</div>
      <div className="bc-num" style={{fontSize: 88, color:"var(--gold)", lineHeight:.95}}>
        {Math.round(credits[user] ?? 0)}<span style={{fontSize:'0.4em', color:'var(--dim)', marginLeft:10, fontWeight:400}}>₡</span>
      </div>
      <div style={{fontSize:13,color:net>=0?"var(--grn)":"var(--red)",marginTop:10,fontWeight:600,letterSpacing:'.02em'}}>
        {net>=0?t('stats_view.net_pos',{n:Math.abs(net)}):t('stats_view.net_neg',{n:Math.abs(net)})}
      </div>
      {balanceSeries.length >= 2 && (
        <div ref={sparkRef} style={{marginTop:22, paddingTop:18, borderTop:"1px solid var(--rule)"}}>
          <Sparkline
            points={balanceSeries}
            width={sparkW}
            height={72}
            color={net >= 0 ? "var(--grn)" : "var(--red)"}
            baseline={100}
          />
          <div style={{display:"flex",justifyContent:"space-between",marginTop:12}}>
            <div className="bc-meta" style={{fontSize:8}}>Start · 100₡</div>
            <div className="bc-meta" style={{fontSize:8, color:'var(--gold)'}}>Peak · {peakBalance}₡</div>
            <div className="bc-meta" style={{fontSize:8, color:'var(--red)'}}>Low · {lowBalance}₡</div>
          </div>
        </div>
      )}
    </div>
  );
  // Stats grid — pure typography, no tiles, separated by vertical hairlines
  const statsGrid=(
    <div style={{display:"flex", marginBottom:0, padding:"22px 0", borderBottom:"1px solid var(--rule)"}}>
      {[
        {l:t('stats_view.won'), v:won.length, c:"var(--grn)"},
        {l:t('stats_view.lost'), v:lost.length, c:"var(--red)"},
        {l:t('stats_view.win_rate'), v:`${wr}%`, c:wr>=50?"var(--grn)":"var(--red)"},
      ].map((s,i) => (
        <div key={s.l} style={{flex:1, textAlign:i===0?'left':'center', borderLeft: i===0?'none':'1px solid var(--rule)', paddingLeft:i===0?0:14}}>
          <div className="bc-num" style={{fontSize:36, color:s.c}}>{s.v}</div>
          <div className="bc-meta" style={{marginTop:8, fontSize:8}}>{s.l}</div>
        </div>
      ))}
      <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'flex-end', borderLeft:'1px solid var(--rule)', paddingLeft:14}}>
        <StreakBadge winStreak={_curWinStr} lossStreak={_curLossStr} label={t('stats_view.streak')}/>
      </div>
    </div>
  );
  const bestCard=best&&(
    <div style={{...S.card,marginBottom:10,border:"1px solid var(--grn)33"}}>
      <SecLabel>{t('stats_view.best')}</SecLabel>
      <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>{best.title}</div>
      <div style={{display:"flex",gap:8}}><Bdg bg="var(--grn)22" c="var(--grn)">+{best.potentialWin-best.stake} ₡</Bdg><Bdg bg="var(--gold)22" c="var(--gold)">{fmtQ(best.quota)}×</Bdg></div>
    </div>
  );
  const catCard=catS.length>0&&(
    <div style={{...S.card,marginBottom:10}}>
      <SecLabel>{t('stats_view.by_cat')}</SecLabel>
      {catS.map(c=>{
        const tot = c.w + c.l;
        const wrPct = tot ? Math.round(c.w/tot*100) : 0;
        return (
          <div key={c.id} style={{marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
              <span style={{fontSize:16}}>{c.e}</span>
              <div style={{flex:1,fontSize:13,fontWeight:600}}>{catLabel(c)}</div>
              <div style={{fontSize:12,fontWeight:700,color:wrPct>=50?"var(--grn)":"var(--red)"}}>{wrPct}%</div>
            </div>
            <div style={{display:"flex",height:8,borderRadius:4,overflow:"hidden",background:"var(--mut)33",border:"1px solid var(--brd)"}}>
              <div style={{flex:c.w,background:`linear-gradient(90deg, ${c.color}, ${c.color}cc)`,transition:"flex .6s",boxShadow:c.w>0?`inset 0 0 8px ${c.color}77`:"none"}}/>
              <div style={{flex:c.l,background:"var(--red)22",transition:"flex .6s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:11,color:"var(--dim)"}}>
              <span><span style={{color:"var(--grn)",fontWeight:700}}>{c.w}</span> vinte</span>
              <span><span style={{color:"var(--red)",fontWeight:700}}>{c.l}</span> perse</span>
              <span>{tot} totali</span>
            </div>
          </div>
        );
      })}
    </div>
  );
  const hofCard=flamed.length>0&&(
    <div style={{...S.card,border:"1px solid #f9731644"}}>
      <SecLabel>{t('stats_view.hof')}</SecLabel>
      {flamed.map(b=>(
        <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,paddingBottom:8,borderBottom:"1px solid var(--brd)"}}>
          <div style={{fontSize:13,flex:1,marginRight:8}}>{b.title}</div>
          <Bdg bg={b.status==="won"?"var(--grn)22":"var(--red)22"} c={b.status==="won"?"var(--grn)":"var(--red)"}>{b.status==="won"?"✅":"❌"}</Bdg>
        </div>
      ))}
    </div>
  );
  const emptyMsg=all.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:"var(--dim)",fontSize:13}}>{t('stats_view.no_bets')}</div>;


  // ─── Head-to-head card ───────────────────────────────────────────────
  const h2hOpponent = others.find(m => m.id === h2hId);
  const h2hBets = bets.filter(b =>
    (b.creator === user && b.opponent === h2hId) ||
    (b.creator === h2hId && b.opponent === user)
  );
  const h2hResolved = h2hBets.filter(b => ['won','lost'].includes(b.status));

  // Helper: did *I* win this bet, given the bet's perspective?
  const iWon = (b) =>
    (b.creator === user && b.status === 'won') ||
    (b.creator === h2hId && b.status === 'lost');
  // Net credits I made on a single h2h bet (signed).
  const netForMe = (b) => {
    if (b.creator === user)   return b.status === 'won' ? (b.potentialWin - b.stake) : -b.stake;
    if (b.creator === h2hId)  return b.status === 'won' ? -b.stake : (b.potentialWin - b.stake);
    return 0;
  };

  const myWinsVsThem = h2hResolved.filter(iWon).length;
  const theirWinsVsMe = h2hResolved.length - myWinsVsThem;
  const h2hNetMe = h2hResolved.reduce((s, b) => s + netForMe(b), 0);

  // Last N resolved h2h bets, newest first — used for the W/L streak chips.
  const h2hChrono = [...h2hResolved].sort(
    (a,b) => (a.resolvedAt || a.createdAt) - (b.resolvedAt || b.createdAt)
  );
  const lastFive = [...h2hChrono].slice(-5);

  // Biggest single win + biggest single loss, in credit terms.
  const h2hBiggestWin = h2hResolved
    .filter(iWon)
    .reduce((best, b) => {
      const n = netForMe(b);
      return (!best || n > netForMe(best)) ? b : best;
    }, null);
  const h2hBiggestLoss = h2hResolved
    .filter(b => !iWon(b))
    .reduce((worst, b) => {
      const n = netForMe(b);
      return (!worst || n < netForMe(worst)) ? b : worst;
    }, null);

  // Current trailing streak vs this opponent (positive = my wins in a row,
  // negative = their wins in a row, 0 = no resolved bets).
  let h2hCurrentStreak = 0;
  for (let i = h2hChrono.length - 1; i >= 0; i--) {
    const won = iWon(h2hChrono[i]);
    if (i === h2hChrono.length - 1) { h2hCurrentStreak = won ? 1 : -1; continue; }
    if ((won && h2hCurrentStreak > 0) || (!won && h2hCurrentStreak < 0)) {
      h2hCurrentStreak += won ? 1 : -1;
    } else break;
  }

  // Dominant category — where most of the resolved h2h bets live.
  const h2hCatCounts = h2hResolved.reduce((m, b) => {
    if (!b.category) return m;
    m[b.category] = (m[b.category] || 0) + 1;
    return m;
  }, {});
  const h2hTopCat = Object.entries(h2hCatCounts).sort((a,b) => b[1]-a[1])[0];
  const h2hTopCatObj = h2hTopCat ? cats.find(c => c.id === h2hTopCat[0]) : null;

  // Compact "VS" header avatars (used both for 2-people and N-people layouts)
  const myProfile = profiles[user];
  const myC = COLORS[myProfile?.colorKey] || '#5b8af0';
  const opC = COLORS[h2hOpponent?.colorKey] || '#a07ef5';
  const showSelector = others.length > 1;
  const winnerSide = myWinsVsThem === theirWinsVsMe ? null : (myWinsVsThem > theirWinsVsMe ? 'me' : 'them');

  const h2hCard = h2hOpponent && (
    <div style={{...S.card, marginBottom:10}}>
      <SecLabel>{t('h2h.title')}</SecLabel>

      {/* Avatars VS header — always shown */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, marginBottom:14}}>
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', flex:1, minWidth:0}}>
          <div style={{width:48, height:48, borderRadius:'50%',
            background:`${myC}33`, border:`2px solid ${winnerSide==='me'?'var(--gold)':myC+'66'}`,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, overflow:'hidden',
            boxShadow: winnerSide==='me' ? '0 0 12px var(--glow)' : 'none',
          }}>
            {myProfile?.avatarUrl
              ? <img src={myProfile.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : (myProfile?.avatar ?? '🙂')}
          </div>
          <div style={{fontSize:11, color:'var(--dim)', marginTop:6, letterSpacing:1, textTransform:'uppercase', fontWeight:700}}>{t('h2h.you')}</div>
        </div>

        <div style={{textAlign:'center', flex:'0 0 auto'}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif", fontSize:30, fontWeight:900, lineHeight:1, color: winnerSide==='me'?'var(--gold)':'var(--txt)'}}>
            {myWinsVsThem}
            <span style={{margin:'0 8px', color:'var(--mut)', fontSize:18, fontWeight:600}}>VS</span>
            <span style={{color: winnerSide==='them'?'var(--gold)':'var(--txt)'}}>{theirWinsVsMe}</span>
          </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', alignItems:'center', flex:1, minWidth:0}}>
          <div style={{width:48, height:48, borderRadius:'50%',
            background:`${opC}33`, border:`2px solid ${winnerSide==='them'?'var(--gold)':opC+'66'}`,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, overflow:'hidden',
            boxShadow: winnerSide==='them' ? '0 0 12px var(--glow)' : 'none',
          }}>
            {h2hOpponent.avatarUrl
              ? <img src={h2hOpponent.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : (h2hOpponent.avatar ?? '🙂')}
          </div>
          <div style={{fontSize:11, color:'var(--dim)', marginTop:6, letterSpacing:1, textTransform:'uppercase', fontWeight:700, maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{h2hOpponent.name}</div>
        </div>
      </div>

      {/* Opponent selector — only if there are >1 other members */}
      {showSelector && (
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
          {others.map(m => {
            const active = m.id === h2hId;
            return (
              <button key={m.id} onClick={() => setH2hId(m.id)}
                style={{
                  display:'inline-flex', alignItems:'center', gap:6,
                  padding:'5px 10px 5px 5px', borderRadius:18,
                  border:`1px solid ${active ? 'var(--gold)' : 'var(--brd)'}`,
                  background: active ? 'var(--gold)1a' : 'transparent',
                  color: active ? 'var(--gold)' : 'var(--dim)',
                  cursor:'pointer', fontFamily:"'Manrope',sans-serif", fontSize:11, fontWeight:600,
                }}>
                {m.avatarUrl
                  ? <img src={m.avatarUrl} alt="" style={{width:20,height:20,borderRadius:'50%',objectFit:'cover'}}/>
                  : <span style={{fontSize:14}}>{m.avatar || '😊'}</span>}
                <span>{m.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {h2hResolved.length === 0 ? (
        <div style={{fontSize:12, color:'var(--dim)', textAlign:'center', padding:'12px 0'}}>{t('h2h.no_data')}</div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, paddingTop:10, borderTop:'1px solid var(--brd)'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:16, fontWeight:700, color: h2hNetMe >= 0 ? 'var(--grn)' : 'var(--red)'}}>
              {h2hNetMe >= 0 ? '+' : ''}{h2hNetMe} ₡
            </div>
            <div style={{fontSize:10, color:'var(--dim)', letterSpacing:1, textTransform:'uppercase', marginTop:2}}>{t('h2h.net_me')}</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:16, fontWeight:700, color:'var(--gold)'}}>{h2hResolved.length}</div>
            <div style={{fontSize:10, color:'var(--dim)', letterSpacing:1, textTransform:'uppercase', marginTop:2}}>{t('h2h.bets')}</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:16, fontWeight:700, color: winnerSide==='me' ? 'var(--grn)' : winnerSide==='them' ? 'var(--red)' : 'var(--dim)'}}>
              {winnerSide==='me' ? '🏆' : winnerSide==='them' ? '💀' : '⚖'}
            </div>
            <div style={{fontSize:10, color:'var(--dim)', letterSpacing:1, textTransform:'uppercase', marginTop:2}}>
              {winnerSide==='me' ? 'LEAD' : winnerSide==='them' ? 'BEHIND' : 'EVEN'}
            </div>
          </div>
        </div>
      )}

      {/* Richer h2h breakdown — last 5 chips, biggest swings, streak, top cat.
          All optional: each row hides itself if there's no data to show. */}
      {h2hResolved.length > 0 && (
        <div style={{marginTop:14, paddingTop:14, borderTop:'1px solid var(--brd)'}}>
          {/* Last 5: most recent on the right, like a heartbeat */}
          {lastFive.length > 0 && (
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:14}}>
              <span style={{fontSize:9, color:'var(--mut)', letterSpacing:'.3em', textTransform:'uppercase', fontWeight:700, flexShrink:0}}>
                {t('h2h.last5')}
              </span>
              <div style={{display:'flex', gap:5, flex:1}}>
                {lastFive.map((b) => {
                  const me = iWon(b);
                  return (
                    <div key={b.id} title={`${b.title} · ${me ? '+' : ''}${netForMe(b)} ₡`}
                      style={{
                        width:20, height:20, borderRadius:6,
                        background: me ? 'var(--grn)22' : 'var(--red)22',
                        border: `1px solid ${me ? 'var(--grn)66' : 'var(--red)66'}`,
                        color: me ? 'var(--grn)' : 'var(--red)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:10, fontWeight:800, letterSpacing:0,
                      }}>{me ? 'V' : 'P'}</div>
                  );
                })}
              </div>
              {Math.abs(h2hCurrentStreak) >= 2 && (
                <span style={{
                  fontSize:10, fontWeight:800, letterSpacing:'.06em',
                  padding:'3px 8px', borderRadius:999,
                  background: h2hCurrentStreak > 0 ? 'var(--grn)22' : 'var(--red)22',
                  color: h2hCurrentStreak > 0 ? 'var(--grn)' : 'var(--red)',
                  border: `1px solid ${h2hCurrentStreak > 0 ? 'var(--grn)66' : 'var(--red)66'}`,
                }}>
                  {h2hCurrentStreak > 0 ? '🔥' : '❄️'} {Math.abs(h2hCurrentStreak)} {t('h2h.streak_short')}
                </span>
              )}
            </div>
          )}

          {/* Biggest win / biggest loss */}
          {(h2hBiggestWin || h2hBiggestLoss) && (
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14}}>
              {h2hBiggestWin && (
                <div style={{padding:'10px 12px', borderLeft:'3px solid var(--grn)', background:'var(--grn)08'}}>
                  <div style={{fontSize:9, color:'var(--grn)', letterSpacing:'.22em', textTransform:'uppercase', fontWeight:700, marginBottom:4}}>
                    {t('h2h.biggest_win')}
                  </div>
                  <div style={{fontSize:14, fontWeight:700, color:'var(--grn)', marginBottom:2}}>
                    +{netForMe(h2hBiggestWin)} ₡
                  </div>
                  <div style={{fontSize:10, color:'var(--dim)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                    "{h2hBiggestWin.title}"
                  </div>
                </div>
              )}
              {h2hBiggestLoss && (
                <div style={{padding:'10px 12px', borderLeft:'3px solid var(--red)', background:'var(--red)08'}}>
                  <div style={{fontSize:9, color:'var(--red)', letterSpacing:'.22em', textTransform:'uppercase', fontWeight:700, marginBottom:4}}>
                    {t('h2h.biggest_loss')}
                  </div>
                  <div style={{fontSize:14, fontWeight:700, color:'var(--red)', marginBottom:2}}>
                    {netForMe(h2hBiggestLoss)} ₡
                  </div>
                  <div style={{fontSize:10, color:'var(--dim)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                    "{h2hBiggestLoss.title}"
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Top category — only if there are at least 2 resolved bets to make
              a "favorite" claim meaningful. */}
          {h2hTopCat && h2hResolved.length >= 2 && h2hTopCatObj && (
            <div style={{display:'flex', alignItems:'center', gap:8, fontSize:11, color:'var(--dim)'}}>
              <span style={{fontSize:9, color:'var(--mut)', letterSpacing:'.3em', textTransform:'uppercase', fontWeight:700}}>
                {t('h2h.top_cat')}
              </span>
              <span style={{
                padding:'3px 10px', borderRadius:999,
                border:`1px solid ${h2hTopCatObj.color || 'var(--brd)'}66`,
                background:`${h2hTopCatObj.color || 'var(--brd)'}14`,
                color: h2hTopCatObj.color || 'var(--txt)',
                fontWeight:700, fontSize:11,
              }}>
                {h2hTopCatObj.e || ''} {catLabel(h2hTopCatObj)} · {h2hTopCat[1]}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Asymmetric leaderboard: 1st rank gets a giant italic Cormorant treatment,
  // subsequent ranks shrink and indent left, breaking any grid feel. Numbers
  // float at varying y-positions on the right margin.
  const leaderboardCard = leaderboard.length > 1 && (
    <div style={{padding:'30px 0 28px', borderBottom:'1px solid var(--rule)', position:'relative'}}>
      <div className="bc-meta" style={{marginBottom:24}}>{t('stats_group.title')}</div>
      {leaderboard.every(r => r.tot === 0) ? (
        <div style={{fontSize:12, color:'var(--dim)', padding:'10px 0'}}>{t('stats_group.no_data')}</div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:0}}>
          {leaderboard.map((r, i) => {
            const c = COLORS[r.p?.colorKey] || '#5b8af0';
            // Per-rank typography & offsets — clamps stay readable on mobile,
            // breathe wider on desktop. Odd indices indent more than even, so
            // the column zig-zags.
            const sizes = [
              { name: 'clamp(38px, 9vw, 72px)', bal: 'clamp(26px, 6vw, 44px)', indent: 0,  myTop: 0,  pad: '14px 0' },
              { name: 'clamp(28px, 6vw, 48px)', bal: 'clamp(22px, 5vw, 34px)', indent: 'clamp(20px, 6vw, 64px)', myTop: -8, pad: '8px 0 10px' },
              { name: 'clamp(22px, 5vw, 36px)', bal: 'clamp(18px, 4vw, 26px)', indent: 'clamp(10px, 3vw, 32px)', myTop: -4, pad: '6px 0 8px' },
              { name: 'clamp(17px, 3.5vw, 22px)', bal: 'clamp(14px, 2.5vw, 18px)', indent: 'clamp(28px, 8vw, 96px)', myTop: 0, pad: '4px 0' },
            ];
            const tier = sizes[Math.min(i, sizes.length - 1)];
            const isPodium = i < 3;
            return (
              <div key={r.id} style={{
                position:'relative',
                display:'flex', alignItems:'baseline', justifyContent:'space-between',
                gap:14, padding: tier.pad,
                marginTop: tier.myTop,
                // Subtle gold tint only when it's me — no full background, no box.
                borderLeft: r.isMe ? '2px solid var(--gold)' : 'none',
                paddingLeft: r.isMe ? `calc(${tier.indent || '0px'} + 14px)` : tier.indent,
                opacity: i >= 4 ? 0.65 : 1,
              }}>
                <div style={{display:'flex', alignItems:'baseline', gap:'clamp(8px, 2vw, 18px)', minWidth:0, flex:1}}>
                  {/* Rank glyph drifts to the gutter — italic Cormorant for podium, tiny Manrope below */}
                  <div style={{
                    fontFamily: isPodium ? "'Cormorant Garamond',serif" : "'Manrope',sans-serif",
                    fontStyle: isPodium ? 'italic' : 'normal',
                    fontSize: isPodium ? 'clamp(20px, 5vw, 32px)' : '10px',
                    fontWeight: isPodium ? 600 : 700,
                    letterSpacing: isPodium ? '-0.02em' : '.2em',
                    color: 'var(--dim)', flexShrink: 0,
                    minWidth: isPodium ? 'auto' : 28,
                    transform: isPodium ? `translateY(${i*2}px)` : 'none',
                  }}>
                    {i === 0 ? 'I' : i === 1 ? 'II' : i === 2 ? 'III' : `0${i+1}`}
                  </div>
                  {/* Name — the loudest type, italic Cormorant */}
                  <div style={{
                    fontFamily:"'Cormorant Garamond',serif",
                    fontStyle:'italic',
                    fontSize: tier.name,
                    fontWeight: i === 0 ? 600 : 500,
                    lineHeight: 0.95,
                    letterSpacing: '-0.02em',
                    color: r.isMe ? 'var(--gold)' : 'var(--txt)',
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  }}>
                    {r.p?.name}
                  </div>
                </div>
                {/* Number — Playfair lining numerals, floats at the right gutter */}
                <div style={{textAlign:'right', flexShrink:0, transform:`translateY(${i % 2 === 0 ? -3 : 6}px)`}}>
                  <div className="bc-num" style={{fontSize: tier.bal, color:'var(--gold)', lineHeight:.9}}>
                    {r.bal}<span style={{fontSize:'0.5em', color:'var(--dim)', marginLeft:3, fontWeight:400}}>₡</span>
                  </div>
                  {r.tot > 0 && (
                    <div className="bc-meta" style={{fontSize:8, marginTop:4, color: r.net >= 0 ? 'var(--grn)' : 'var(--red)'}}>
                      {r.net >= 0 ? '+' : ''}{r.net} · {r.wr}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return(
    <div className="sUp">
      <div style={{marginBottom:32, paddingTop: isDesktop ? 16 : 8}}>
        <div className="bc-meta" style={{marginBottom:10}}>— Analisi</div>
        <div className="bc-hero" style={{fontSize: isDesktop ? 54 : 38}}>{t('stats_view.title')}</div>
      </div>
      {isDesktop?(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,alignItems:"start"}}>
          <div style={{display:'flex', flexDirection:'column', gap:10}}>{balanceCard}{statsGrid}{bestCard}{h2hCard}{emptyMsg}</div>
          <div style={{display:'flex', flexDirection:'column', gap:10}}>{leaderboardCard}{catCard}{hofCard}</div>
        </div>
      ):(
        <>{balanceCard}{statsGrid}{bestCard}{leaderboardCard}{h2hCard}{catCard}{hofCard}{emptyMsg}</>
      )}
    </div>
  );
}
