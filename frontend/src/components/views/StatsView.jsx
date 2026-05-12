import React, { useState, useEffect, useRef } from 'react';
import { SecLabel, Avatar, fmtQ, qToP, COLORS, getC } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import Sparkline from '../Sparkline.jsx';
import StreakBadge, { StreakInline } from '../StreakBadge.jsx';
import * as api from '../../api.js';

const S = {
  card: {background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:16},
  bdg: {display:"inline-flex",alignItems:"center",gap:3,padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:600},
};

const Bdg=({c,bg,children})=><span style={{...S.bdg,background:bg,color:c}}>{children}</span>;

const DEF_IDS=['intimo','serata','casa','cibo','gaming','altro'];

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
  const balanceCard=(
    <div className="pGold" style={{...S.card,marginBottom:12,textAlign:"center",background:"linear-gradient(135deg,var(--card),var(--surf))"}}>
      <SecLabel>{t('stats_view.balance')}</SecLabel>
      <div className="shim" style={{fontFamily:"'Playfair Display',serif",fontSize:44,fontWeight:900}}>{Math.round(credits[user] ?? 0)} ₡</div>
      <div style={{fontSize:13,color:net>=0?"var(--grn)":"var(--red)",marginTop:6,fontWeight:600}}>{net>=0?t('stats_view.net_pos',{n:Math.abs(net)}):t('stats_view.net_neg',{n:Math.abs(net)})}</div>
      {balanceSeries.length >= 2 && (
        <div ref={sparkRef} style={{marginTop:14, paddingTop:12, borderTop:"1px solid var(--brd)"}}>
          <Sparkline
            points={balanceSeries}
            width={sparkW}
            height={64}
            color={net >= 0 ? "var(--grn)" : "var(--red)"}
            baseline={100}
          />
          <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:10,color:"var(--dim)",letterSpacing:1}}>
            <div><span style={{color:"var(--mut)"}}>Start</span> · 100 ₡</div>
            <div><span style={{color:"var(--gold)"}}>Peak</span> · {peakBalance} ₡</div>
            <div><span style={{color:"var(--red)"}}>Low</span> · {lowBalance} ₡</div>
          </div>
        </div>
      )}
    </div>
  );
  const statsGrid=(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
      {[
        {e:"✅",l:t('stats_view.won'),v:won.length,c:"var(--grn)"},
        {e:"❌",l:t('stats_view.lost'),v:lost.length,c:"var(--red)"},
        {e:"📈",l:t('stats_view.win_rate'),v:`${wr}%`,c:wr>=50?"var(--grn)":"var(--red)"},
      ].map(s=>(
        <div key={s.l} style={{...S.card,textAlign:"center"}}>
          <div style={{fontSize:20,marginBottom:4}}>{s.e}</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:s.c}}>{s.v}</div>
          <div style={{fontSize:11,color:"var(--dim)"}}>{s.l}</div>
        </div>
      ))}
      <div style={{...S.card, display:'flex', alignItems:'center', justifyContent:'center', padding:'10px 4px'}}>
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
  const myWinsVsThem = h2hResolved.filter(b =>
    (b.creator === user && b.status === 'won') ||
    (b.creator === h2hId && b.status === 'lost')
  ).length;
  const theirWinsVsMe = h2hResolved.filter(b =>
    (b.creator === h2hId && b.status === 'won') ||
    (b.creator === user && b.status === 'lost')
  ).length;
  const h2hNetMe = h2hResolved.reduce((s, b) => {
    if (b.creator === user) return s + (b.status === 'won' ? (b.potentialWin - b.stake) : -b.stake);
    if (b.creator === h2hId) return s + (b.status === 'won' ? -b.stake : (b.potentialWin - b.stake));
    return s;
  }, 0);

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
          <div style={{fontFamily:"'Playfair Display',serif", fontSize:30, fontWeight:900, lineHeight:1, color: winnerSide==='me'?'var(--gold)':'var(--txt)'}}>
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
                  cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:600,
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
    </div>
  );

  const leaderboardCard = leaderboard.length > 1 && (
    <div style={{...S.card, marginBottom:10}}>
      <SecLabel>{t('stats_group.title')}</SecLabel>
      {leaderboard.every(r => r.tot === 0) ? (
        <div style={{fontSize:12, color:'var(--dim)', textAlign:'center', padding:'10px 0'}}>{t('stats_group.no_data')}</div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {leaderboard.map((r, i) => {
            const c = COLORS[r.p?.colorKey] || '#5b8af0';
            return (
              <div key={r.id} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'8px 10px', borderRadius:10,
                background: r.isMe ? 'var(--gold)0f' : 'transparent',
                border: r.isMe ? '1px solid var(--gold)44' : '1px solid var(--brd)',
              }}>
                <div style={{fontSize:14, fontWeight:700, color:'var(--dim)', width:18, textAlign:'center'}}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                </div>
                <div style={{width:34, height:34, borderRadius:'50%',
                  background:`${c}33`, border:`2px solid ${c}66`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:18, overflow:'hidden', flexShrink:0}}>
                  {r.p?.avatarUrl
                    ? <img src={r.p.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : (r.p?.avatar ?? '')}
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                    {r.p?.name}
                  </div>
                  <div style={{fontSize:11, color:'var(--dim)', marginTop:1}}>
                    <span style={{color:'var(--grn)'}}>{r.w}{t('stats_group.wins')}</span>
                    {' · '}<span style={{color:'var(--red)'}}>{r.l}{t('stats_group.losses')}</span>
                    {r.tot > 0 && <> · {t('stats_group.win_rate')} <span style={{color: r.wr>=50?'var(--grn)':'var(--red)', fontWeight:700}}>{r.wr}%</span></>}
                  </div>
                </div>
                <div style={{textAlign:'right', flexShrink:0}}>
                  <div style={{fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:700, color:'var(--gold)'}}>{r.bal} ₡</div>
                  <div style={{fontSize:10, color: r.net >= 0 ? 'var(--grn)' : 'var(--red)', fontWeight:600}}>
                    {r.net >= 0 ? '+' : ''}{r.net} {t('stats_group.net')}
                  </div>
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
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,marginBottom:20}}>{t('stats_view.title')}</div>
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
