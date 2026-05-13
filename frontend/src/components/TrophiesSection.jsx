import React, { useEffect, useState } from 'react';
import { SecLabel } from './Atoms.jsx';
import { useLang } from '../i18n.js';
import * as api from '../api.js';

const CAT_ORDER = ['unique', 'positive', 'challenge', 'mission', 'shadow', 'social', 'secret'];

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

  // Secret achievements are computed via DB unlock (not via computeProgressFor),
  // so we read their level straight off the unlocked rows.
  const list = data.catalog.map(a => {
    const dbRow = unlockedByAch[a.id];
    const computed = data.progress[a.id];
    const p = a.secret
      ? { current: dbRow ? 1 : 0, level: dbRow?.level || 0, max_level: 1, target_next: 1 }
      : (computed || { current: 0, level: 0, max_level: a.levels?.length || 5, target_next: a.levels?.[0] || 0 });
    return {
      ...a,
      progress: p,
      unlocked: p.level >= 1,
      unlockedAt: dbRow?.unlocked_at || null,
    };
  });

  // Secret-trophy visibility: completely hidden until the user unlocks at
  // least one of them. After the first unlock, the remaining secrets appear
  // as anonymous "???" placeholders so the player knows there's more.
  const secretsUnlocked = list.some(a => a.secret && a.unlocked);
  const visibleList = list.filter(a => !a.secret || secretsUnlocked);

  const filtered = filter === 'unlocked' ? visibleList.filter(a => a.unlocked)
                : filter === 'locked'    ? visibleList.filter(a => !a.unlocked)
                : filter === 'max'       ? visibleList.filter(a => a.progress.level >= a.progress.max_level)
                : visibleList;

  const byCat = {};
  for (const a of filtered) {
    const c = a.category || 'mission';
    (byCat[c] ||= []).push(a);
  }

  // Total earned levels vs total possible levels
  const earnedLevels = list.reduce((s, a) => s + a.progress.level, 0);
  const totalLevels  = list.reduce((s, a) => s + (a.levels?.length || 5), 0);
  const maxedCount   = list.filter(a => a.progress.level >= a.progress.max_level).length;
  const totalTrophies = list.length;

  const fmtDate = ts => {
    if (!ts) return '';
    try { return new Date(Number(ts)).toLocaleDateString(lang === 'en' ? 'en-US' : 'it-IT', { day:'2-digit', month:'short', year:'numeric' }); }
    catch { return ''; }
  };

  const pill = active => ({
    padding:'5px 12px', borderRadius:20, flexShrink:0, cursor:'pointer', whiteSpace:'nowrap',
    fontFamily:"'Manrope',sans-serif", fontSize:11, fontWeight:600,
    border:`1px solid ${active ? 'var(--gold)' : 'var(--brd)'}`,
    background: active ? 'var(--gold)22' : 'transparent',
    color: active ? 'var(--gold)' : 'var(--dim)',
  });

  return (
    <div style={embedded ? CARD_S : {}}>
      {/* Headline: two big counters side by side */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14}}>
        <div style={{
          background:'linear-gradient(135deg, var(--gold)1a, var(--card))',
          border:'1px solid var(--gold)44', borderRadius:12,
          padding:'10px 14px',
        }}>
          <div style={{fontSize:10, color:'var(--dim)', letterSpacing:2, textTransform:'uppercase', fontWeight:700}}>
            {t('trophies.counter_trophies')}
          </div>
          <div style={{display:'flex', alignItems:'baseline', gap:4, marginTop:4}}>
            <div style={{fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:900, color:'var(--gold)', lineHeight:1}}>
              {maxedCount}
            </div>
            <div style={{fontSize:14, color:'var(--dim)'}}>/{totalTrophies}</div>
          </div>
        </div>
        <div style={{
          background:'linear-gradient(135deg, var(--gold)0d, var(--card))',
          border:'1px solid var(--brd)', borderRadius:12,
          padding:'10px 14px',
        }}>
          <div style={{fontSize:10, color:'var(--dim)', letterSpacing:2, textTransform:'uppercase', fontWeight:700}}>
            {t('trophies.counter_levels')}
          </div>
          <div style={{display:'flex', alignItems:'baseline', gap:4, marginTop:4}}>
            <div style={{fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:900, color:'var(--txt)', lineHeight:1}}>
              {earnedLevels}
            </div>
            <div style={{fontSize:14, color:'var(--dim)'}}>/{totalLevels}</div>
          </div>
        </div>
      </div>

      {/* Title + filters row */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:10, flexWrap:'wrap'}}>
        <SecLabel>
          {t('trophies.title')}
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

        // Secret category gets the hero treatment — bigger tiles, a poster
        // header with the "scoperti / totali" counter, and tiles that lean
        // into the mystery (gold glow + italic Cormorant for the ones still
        // to discover). Mirrors the Duolingo-hero direction used in the
        // dashboard streak block.
        if (cat === 'secret') {
          const unlocked = items.filter(a => a.unlocked).length;
          const totalSec = items.length;
          return (
            <div key={cat} style={{marginBottom: 24, marginTop: 6}}>
              <div style={{
                display:'flex', alignItems:'flex-end', gap: 16,
                marginBottom: 14,
                padding: '14px 16px 12px',
                background: 'linear-gradient(135deg, var(--gold)14 0%, var(--card) 100%)',
                border: '1px solid var(--gold)33',
                borderLeft: '4px solid var(--gold)',
                borderRadius: 12,
              }}>
                <span style={{fontSize: 44, lineHeight: 1, filter: 'drop-shadow(0 4px 18px var(--glow))'}}>✨</span>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{
                    fontSize: 9, letterSpacing: 2, color: 'var(--gold)',
                    textTransform: 'uppercase', fontWeight: 800,
                    fontFamily: "'Manrope',sans-serif",
                  }}>{t('trophies.cat_secret')}</div>
                  <div style={{
                    fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
                    fontSize: 22, fontWeight: 600, color: 'var(--txt)',
                    lineHeight: 1.05, marginTop: 2, letterSpacing:'-0.01em',
                  }}>{unlocked === 0
                      ? t('trophies.secret_hero_empty')
                      : unlocked === totalSec
                        ? t('trophies.secret_hero_all')
                        : t('trophies.secret_hero_some', { n: unlocked, total: totalSec })}</div>
                </div>
                <div style={{textAlign: 'right', flexShrink: 0}}>
                  <div className="bc-num" style={{
                    fontSize: 'clamp(28px, 4vw, 44px)',
                    color: unlocked > 0 ? 'var(--gold)' : 'var(--mut)',
                    lineHeight: .9,
                  }}>{unlocked}<span style={{fontSize:'0.5em', color:'var(--dim)', marginLeft: 2, fontWeight: 400}}>/{totalSec}</span></div>
                  <div className="bc-meta" style={{fontSize: 7, marginTop: 4}}>SCOPERTI</div>
                </div>
              </div>
              <div style={{
                display:'grid',
                gridTemplateColumns:'repeat(auto-fill, minmax(min(220px, 100%), 1fr))',
                gap: 10,
              }}>
                {items.map(a => <SecretTrophyTile key={a.id} a={a} t={t} fmtDate={fmtDate}/>)}
              </div>
            </div>
          );
        }

        return (
          <div key={cat} style={{marginBottom:18}}>
            <div style={{
              fontSize:10, letterSpacing:2, color:'var(--dim)',
              textTransform:'uppercase', marginBottom:8, fontWeight:700,
            }}>{t('trophies.cat_'+cat)}</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(160px, 100%), 1fr))', gap:8}}>
              {items.map(a => <TrophyTile key={a.id} a={a} t={t} fmtDate={fmtDate}/>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Hero variant of TrophyTile reserved for the `secret` category. Bigger
// emoji, more generous padding, and a "still to discover" state that uses
// italic Cormorant to feel inviting rather than locked-down.
function SecretTrophyTile({ a, t, fmtDate }) {
  const unlocked = a.unlocked;
  const masked = !unlocked;
  return (
    <div className={unlocked ? 'card-hover pGold' : ''} style={{
      position:'relative', overflow:'hidden',
      padding:'18px 16px 16px',
      borderRadius: 14,
      background: unlocked
        ? 'linear-gradient(135deg, rgba(200,151,63,.22) 0%, rgba(232,184,75,.10) 50%, rgba(200,151,63,.18) 100%)'
        : 'linear-gradient(180deg, var(--surf), var(--card))',
      border: unlocked
        ? '1.5px solid var(--gold)'
        : '1px dashed var(--brd)',
      boxShadow: unlocked ? '0 6px 24px -10px var(--glow)' : 'none',
      minHeight: 150,
    }}>
      {/* Big emoji centerpiece — masked shows italic "?" in Playfair so it
          reads as a piece of editorial typography, not a placeholder. */}
      <div style={{
        fontSize: masked ? 52 : 56, lineHeight: 1,
        textAlign:'center', marginBottom: 10,
        fontFamily: masked ? "'Playfair Display',serif" : undefined,
        fontStyle: masked ? 'italic' : undefined,
        fontWeight: masked ? 900 : undefined,
        color: masked ? 'var(--mut)' : undefined,
        filter: masked
          ? 'drop-shadow(0 2px 12px var(--brd))'
          : 'drop-shadow(0 4px 16px var(--gold)88)',
      }}>{masked ? '?' : a.icon}</div>
      <div style={{
        fontFamily: masked ? "'Cormorant Garamond',serif" : "'Manrope',sans-serif",
        fontStyle: masked ? 'italic' : 'normal',
        fontSize: 16, fontWeight: masked ? 600 : 700,
        color: unlocked ? 'var(--gold)' : 'var(--dim)',
        textAlign:'center',
        letterSpacing: masked ? '.02em' : '-0.01em',
        lineHeight: 1.15,
      }}>{masked ? t('trophies.secret_locked') : t('trophies.'+a.id)}</div>
      <div style={{
        fontSize: 10, color:'var(--mut)', textAlign:'center',
        marginTop: 4, lineHeight: 1.4,
        fontStyle: masked ? 'italic' : 'normal',
      }}>{masked ? t('trophies.secret_locked_desc') : t('trophies.'+a.id+'_desc')}</div>
      {unlocked && a.unlockedAt && (
        <div style={{
          marginTop: 10, paddingTop: 8,
          borderTop: '1px solid var(--gold)33',
          textAlign:'center',
          fontSize: 8, letterSpacing: 1.5, fontWeight: 700,
          color: 'var(--gold)',
          fontFamily:"'Manrope',sans-serif",
          textTransform: 'uppercase',
        }}>✓ {fmtDate(a.unlockedAt)}</div>
      )}
    </div>
  );
}

function TrophyTile({ a, t, fmtDate }) {
  const { current, level, max_level, target_next } = a.progress;
  const unlocked = level >= 1;
  const isMax = level >= max_level;
  const tierC = tierFor(level);
  // Secret-trophy anonymization: when the player has unlocked at least one
  // secret, the remaining secrets show up here but with no name/icon hint.
  const masked = a.secret && !unlocked;
  const labelName = masked ? t('trophies.secret_locked')      : t('trophies.'+a.id);
  const labelDesc = masked ? t('trophies.secret_locked_desc') : t('trophies.'+a.id+'_desc');
  const displayIcon = masked ? '?' : a.icon;

  // Build progress text & fill ratio for the current-level segment
  const prevTarget = level > 0 ? a.levels[level - 1] : 0;
  const nextTarget = target_next ?? a.levels[max_level - 1];
  const ratio = isMax ? 1 :
    Math.max(0, Math.min(1, (current - prevTarget) / Math.max(1, nextTarget - prevTarget)));

  // Special "completed trophy" styling for max-level entries
  const maxBg = isMax
    ? 'linear-gradient(135deg, rgba(200,151,63,.22) 0%, rgba(232,184,75,.10) 50%, rgba(200,151,63,.18) 100%)'
    : (unlocked ? 'linear-gradient(180deg, var(--surf), var(--card))' : 'var(--card)');
  const borderC = isMax ? 'var(--gold)' : (unlocked ? tierC + '55' : 'var(--brd)');

  return (
    <div className={`${unlocked ? 'card-hover' : ''}${isMax ? ' pGold' : ''}`} style={{
      padding:'10px 12px 12px',
      borderRadius:12,
      background: maxBg,
      border: `${isMax ? 2 : 1}px solid ${borderC}`,
      opacity: unlocked ? 1 : .82,
      position:'relative', overflow:'hidden',
    }}>
      {/* MAX glint accent in the corner */}
      {isMax && (
        <div style={{
          position:'absolute', top:-12, right:-12, width:50, height:50,
          background:'radial-gradient(circle at 0% 100%, rgba(232,184,75,.45) 0%, transparent 60%)',
          pointerEvents:'none',
        }}/>
      )}
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
            fontFamily: masked ? "'Playfair Display',serif" : undefined,
            fontWeight: masked ? 900 : undefined,
            color: masked ? 'var(--mut)' : undefined,
            filter: masked ? 'none' : unlocked ? `drop-shadow(0 0 10px ${tierC}77)` : 'grayscale(1) opacity(.55)',
          }}>{displayIcon}</div>
          <div style={{
            fontSize:9, fontWeight:800, color: unlocked ? tierC : 'var(--mut)',
            letterSpacing:1, padding:'2px 6px', borderRadius:8,
            border:`1px solid ${unlocked ? tierC + '55' : 'var(--brd)'}`,
            background: unlocked ? `${tierC}11` : 'transparent',
          }}>{max_level === 1 ? (unlocked ? '✓' : '🔒') : (isMax ? 'MAX 👑' : `Lv ${level}`)}</div>
        </div>

        {/* Name + desc */}
        <div style={{
          fontSize:13, fontWeight:700, lineHeight:1.2,
          color: unlocked ? 'var(--txt)' : 'var(--dim)',
          marginTop:2,
          fontFamily: masked ? "'Playfair Display',serif" : undefined,
          letterSpacing: masked ? '.15em' : undefined,
        }}>{labelName}</div>
        <div style={{
          fontSize:10, lineHeight:1.35, color:'var(--mut)',
          minHeight:26, marginTop:2,
          fontStyle: masked ? 'italic' : undefined,
        }}>{labelDesc}</div>

        {/* Variants: 1-level "milestone" vs N-level "ladder" */}
        {max_level === 1 ? (
          <div style={{
            marginTop:8,
            padding:'5px 8px',
            borderRadius:6,
            textAlign:'center',
            background: unlocked ? `${tierC}1f` : 'var(--mut)0f',
            border: `1px dashed ${unlocked ? tierC + '55' : 'var(--brd)'}`,
            fontSize:9, letterSpacing:2, fontWeight:700,
            color: unlocked ? tierC : 'var(--mut)',
          }}>
            {unlocked ? `✓ ${t('trophies.unlocked_header').toUpperCase()}` : `🔒 ${t('trophies.locked').toUpperCase()}`}
            {unlocked && a.unlockedAt && (
              <div style={{fontSize:8, color:'var(--mut)', marginTop:2, letterSpacing:1}}>
                {fmtDate(a.unlockedAt)}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* N-segment level ladder */}
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
          </>
        )}
      </div>
    </div>
  );
}
