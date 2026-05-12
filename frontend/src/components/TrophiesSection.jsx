import React, { useEffect, useState } from 'react';
import { SecLabel } from './Atoms.jsx';
import { useLang } from '../i18n.js';
import * as api from '../api.js';

const CAT_ORDER = ['positive', 'challenge', 'mission', 'shadow', 'social'];

// Tier color by current level reached (0 = locked)
function tierFor(level) {
  if (level >= 5) return 'var(--gold)';
  if (level === 4) return 'var(--gold)';
  if (level >= 2) return '#c0c4d0'; // silver
  if (level === 1) return '#b87333'; // bronze
  return 'var(--mut)';
}

const CARD_S = { background:'var(--card)', border:'1px solid var(--brd)', borderRadius:16, padding:16 };

export default function TrophiesSection({ embedded = false, betsTick = 0 }) {
  const { t, lang } = useLang();
  const [data, setData] = useState({ catalog: [], unlocked: [], progress: {} });
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.getAchievements().then(setData).catch(() => {});
  }, [betsTick]);

  // Group unlocked rows by achievement → keep max level + its unlock date
  const unlockedByAch = {};
  for (const row of data.unlocked) {
    const cur = unlockedByAch[row.achievement_id];
    if (!cur || row.level > cur.level) unlockedByAch[row.achievement_id] = row;
  }

  const list = data.catalog.map(a => {
    const p = data.progress[a.id] || { current: 0, level: 0, max_level: a.levels?.length || 5, target_next: a.levels?.[0] || 0 };
    return {
      ...a,
      progress: p,
      unlocked: p.level >= 1,
      unlockedAt: unlockedByAch[a.id]?.unlocked_at || null,
    };
  });

  const filtered = filter === 'unlocked' ? list.filter(a => a.unlocked)
                : filter === 'locked'    ? list.filter(a => !a.unlocked)
                : filter === 'max'       ? list.filter(a => a.progress.level >= a.progress.max_level)
                : list;

  const byCat = {};
  for (const a of filtered) {
    const c = a.category || 'mission';
    (byCat[c] ||= []).push(a);
  }

  // Total earned levels vs total possible levels
  const earnedLevels = list.reduce((s, a) => s + a.progress.level, 0);
  const totalLevels  = list.reduce((s, a) => s + (a.levels?.length || 5), 0);
  const maxedCount   = list.filter(a => a.progress.level >= a.progress.max_level).length;

  const fmtDate = ts => {
    if (!ts) return '';
    try { return new Date(Number(ts)).toLocaleDateString(lang === 'en' ? 'en-US' : 'it-IT', { day:'2-digit', month:'short', year:'numeric' }); }
    catch { return ''; }
  };

  const pill = active => ({
    padding:'5px 12px', borderRadius:20, flexShrink:0, cursor:'pointer', whiteSpace:'nowrap',
    fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:600,
    border:`1px solid ${active ? 'var(--gold)' : 'var(--brd)'}`,
    background: active ? 'var(--gold)22' : 'transparent',
    color: active ? 'var(--gold)' : 'var(--dim)',
  });

  return (
    <div style={embedded ? CARD_S : {}}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:10, flexWrap:'wrap'}}>
        <SecLabel>
          {t('trophies.title')}
          <span style={{marginLeft:8, color:'var(--gold)', fontWeight:700}}>{earnedLevels}/{totalLevels}</span>
          {maxedCount > 0 && (
            <span style={{marginLeft:6, fontSize:10, color:'var(--gold)', letterSpacing:1}}>· {maxedCount} MAX 👑</span>
          )}
        </SecLabel>
        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          {['all','unlocked','max','locked'].map(f => (
            <button key={f} style={pill(filter === f)} onClick={() => setFilter(f)}>
              {t('trophies.filter_'+f)}
            </button>
          ))}
        </div>
      </div>

      {/* Overall progress bar (level-weighted) */}
      <div style={{height:6, background:'var(--mut)22', borderRadius:3, overflow:'hidden', marginBottom:18}}>
        <div style={{
          height:'100%',
          width: totalLevels ? `${earnedLevels/totalLevels*100}%` : '0%',
          background:'linear-gradient(90deg, var(--gold), var(--goldL))',
          boxShadow:'0 0 8px var(--glow)',
          transition:'width .5s',
        }}/>
      </div>

      {CAT_ORDER.map(cat => {
        const items = byCat[cat];
        if (!items?.length) return null;
        return (
          <div key={cat} style={{marginBottom:18}}>
            <div style={{
              fontSize:10, letterSpacing:2, color:'var(--dim)',
              textTransform:'uppercase', marginBottom:8, fontWeight:700,
            }}>{t('trophies.cat_'+cat)}</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:8}}>
              {items.map(a => <TrophyTile key={a.id} a={a} t={t} fmtDate={fmtDate}/>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrophyTile({ a, t, fmtDate }) {
  const { current, level, max_level, target_next } = a.progress;
  const unlocked = level >= 1;
  const isMax = level >= max_level;
  const tierC = tierFor(level);

  // Build progress text & fill ratio for the current-level segment
  const prevTarget = level > 0 ? a.levels[level - 1] : 0;
  const nextTarget = target_next ?? a.levels[max_level - 1];
  const ratio = isMax ? 1 :
    Math.max(0, Math.min(1, (current - prevTarget) / Math.max(1, nextTarget - prevTarget)));

  return (
    <div style={{
      padding:'10px 12px 12px',
      borderRadius:12,
      background: unlocked ? 'linear-gradient(180deg, var(--surf), var(--card))' : 'var(--card)',
      border: `1px solid ${unlocked ? tierC + '55' : 'var(--brd)'}`,
      opacity: unlocked ? 1 : .82,
      position:'relative', overflow:'hidden',
    }} className={unlocked ? 'card-hover' : ''}>
      {/* tier stripe on left */}
      <div style={{
        position:'absolute', left:0, top:0, bottom:0, width:3,
        background: unlocked ? tierC : 'var(--mut)44',
      }}/>
      <div style={{paddingLeft:8}}>
        {/* Header row: icon + level badge */}
        <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:4}}>
          <div style={{
            fontSize:30, lineHeight:1,
            filter: unlocked ? `drop-shadow(0 0 10px ${tierC}77)` : 'grayscale(1) opacity(.55)',
          }}>{a.icon}</div>
          <div style={{
            fontSize:9, fontWeight:800, color: unlocked ? tierC : 'var(--mut)',
            letterSpacing:1, padding:'2px 6px', borderRadius:8,
            border:`1px solid ${unlocked ? tierC + '55' : 'var(--brd)'}`,
            background: unlocked ? `${tierC}11` : 'transparent',
          }}>{isMax ? 'MAX 👑' : `Lv ${level}`}</div>
        </div>

        {/* Name + desc */}
        <div style={{
          fontSize:13, fontWeight:700, lineHeight:1.2,
          color: unlocked ? 'var(--txt)' : 'var(--dim)',
          marginTop:2,
        }}>{t('trophies.'+a.id)}</div>
        <div style={{
          fontSize:10, lineHeight:1.35, color:'var(--mut)',
          minHeight:26, marginTop:2,
        }}>{t('trophies.'+a.id+'_desc')}</div>

        {/* 5-segment level ladder */}
        <div style={{display:'flex', gap:3, marginTop:8}}>
          {Array.from({length: max_level}).map((_, idx) => {
            const lvl = idx + 1;
            const filled = lvl <= level;
            const isCurrent = !isMax && lvl === level + 1;
            return (
              <div key={lvl} style={{
                flex:1, height:6, borderRadius:2,
                background: filled ? tierC : 'var(--mut)22',
                position:'relative', overflow:'hidden',
                boxShadow: filled ? `0 0 4px ${tierC}55` : 'none',
              }}>
                {/* partial fill on the next-to-unlock segment */}
                {isCurrent && (
                  <div style={{
                    position:'absolute', left:0, top:0, bottom:0,
                    width: `${ratio * 100}%`,
                    background: tierC, opacity:.6,
                    transition:'width .3s',
                  }}/>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress text */}
        <div style={{
          fontSize:9, marginTop:5,
          color: isMax ? tierC : 'var(--dim)',
          letterSpacing:1, fontWeight: isMax ? 700 : 500,
        }}>
          {isMax
            ? `🏆 ${t('trophies.max_reached')} · ${fmtDate(a.unlockedAt)}`
            : <>
                {current}/{nextTarget} →
                <span style={{color: tierC, marginLeft:4}}>Lv {level + 1}</span>
              </>}
        </div>
      </div>
    </div>
  );
}
