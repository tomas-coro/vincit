import React, { useEffect, useState } from 'react';
import { SecLabel } from './Atoms.jsx';
import { useLang } from '../i18n.js';
import * as api from '../api.js';

const TIER_COLOR = { gold:'var(--gold)', silver:'#c0c4d0', bronze:'#b87333' };
const CAT_ORDER = ['positive', 'challenge', 'mission', 'shadow', 'social'];

const CARD_S = { background:'var(--card)', border:'1px solid var(--brd)', borderRadius:16, padding:16 };

export default function TrophiesSection({ embedded = false, betsTick = 0 }) {
  const { t, lang } = useLang();
  const [data, setData] = useState({ catalog: [], unlocked: [], progress: {} });
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.getAchievements().then(setData).catch(() => {});
  }, [betsTick]);

  const unlockedMap = Object.fromEntries(data.unlocked.map(u => [u.achievement_id, u.unlocked_at]));
  const list = data.catalog.map(a => {
    const p = data.progress[a.id] || { current: 0, target: 1 };
    const unlocked = p.current >= p.target;
    return { ...a, progress: p, unlocked, unlockedAt: unlockedMap[a.id] || null };
  });

  const filtered = filter === 'unlocked' ? list.filter(a => a.unlocked)
                : filter === 'locked'    ? list.filter(a => !a.unlocked)
                : list;

  // Group by category preserving CAT_ORDER
  const byCat = {};
  for (const a of filtered) {
    const c = a.category || 'mission';
    (byCat[c] ||= []).push(a);
  }

  const unlockedCount = list.filter(a => a.unlocked).length;
  const total = list.length;

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
          <span style={{marginLeft:8, color:'var(--gold)', fontWeight:700}}>{unlockedCount}/{total}</span>
        </SecLabel>
        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          {['all','unlocked','locked'].map(f => (
            <button key={f} style={pill(filter === f)} onClick={() => setFilter(f)}>
              {t('trophies.filter_'+f)}
            </button>
          ))}
        </div>
      </div>

      {/* Overall progress bar */}
      <div style={{height:6, background:'var(--mut)22', borderRadius:3, overflow:'hidden', marginBottom:18}}>
        <div style={{
          height:'100%',
          width: total ? `${unlockedCount/total*100}%` : '0%',
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
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:8}}>
              {items.map(a => <TrophyTile key={a.id} a={a} t={t} fmtDate={fmtDate}/>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrophyTile({ a, t, fmtDate }) {
  const tierC = TIER_COLOR[a.tier] || 'var(--mut)';
  const unlocked = a.unlocked;
  const pct = Math.min(100, Math.round((a.progress.current / a.progress.target) * 100));
  return (
    <div style={{
      padding:'10px 10px 12px',
      borderRadius:12,
      background: unlocked ? 'linear-gradient(180deg, var(--surf), var(--card))' : 'var(--card)',
      border: `1px solid ${unlocked ? tierC + '55' : 'var(--brd)'}`,
      opacity: unlocked ? 1 : .82,
      position:'relative', overflow:'hidden',
      transition:'transform .15s, box-shadow .15s',
    }} className={unlocked ? 'card-hover' : ''}>
      {/* tier stripe on left */}
      <div style={{
        position:'absolute', left:0, top:0, bottom:0, width:3,
        background: unlocked ? tierC : 'var(--mut)44',
      }}/>
      <div style={{paddingLeft:8}}>
        <div style={{
          fontSize:32, lineHeight:1, marginBottom:4,
          filter: unlocked ? `drop-shadow(0 0 10px ${tierC}77)` : 'grayscale(1) opacity(.55)',
        }}>
          {a.icon}
        </div>
        <div style={{
          fontSize:12, fontWeight:700, lineHeight:1.25,
          color: unlocked ? 'var(--txt)' : 'var(--dim)',
          marginBottom:2,
        }}>{t('trophies.'+a.id)}</div>
        <div style={{
          fontSize:10, lineHeight:1.3,
          color:'var(--mut)', minHeight:26,
        }}>{t('trophies.'+a.id+'_desc')}</div>

        {/* Progress / status */}
        {unlocked ? (
          <div style={{
            marginTop:6, fontSize:9, color:tierC, letterSpacing:1,
            textTransform:'uppercase', fontWeight:700,
          }}>
            ✓ {a.unlockedAt ? fmtDate(a.unlockedAt) : ''}
          </div>
        ) : (
          <>
            <div style={{height:4, background:'var(--mut)33', borderRadius:2, marginTop:8, overflow:'hidden'}}>
              <div style={{height:'100%', width:`${pct}%`, background:tierC, transition:'width .4s'}}/>
            </div>
            <div style={{fontSize:9, color:'var(--dim)', marginTop:4, letterSpacing:1}}>
              {a.progress.current}/{a.progress.target} · 🔒 {t('trophies.locked')}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
