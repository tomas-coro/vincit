import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SecLabel } from './Atoms.jsx';
import { useLang } from '../i18n.js';
import * as api from '../api.js';

const CAT_ORDER = ['unique', 'positive', 'challenge', 'mission', 'shadow', 'social', 'secret', 'finale'];

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
  // Click-to-open detail panel — populated when the user taps a tile so
  // they can see when L1 unlocked and when MAX was reached.
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.getAchievements().then(setData).catch(() => {});
  }, [betsTick]);

  // Group unlocked rows by achievement → keep max level + its unlock date.
  // ALSO collect every level's row keyed by id so the detail modal can show
  // the L1 date and (separately) the MAX date even when they're different.
  const unlockedByAch = {};
  const allLevelsByAch = {};
  for (const row of data.unlocked) {
    const cur = unlockedByAch[row.achievement_id];
    if (!cur || row.level > cur.level) unlockedByAch[row.achievement_id] = row;
    (allLevelsByAch[row.achievement_id] ||= []).push(row);
  }
  for (const id in allLevelsByAch) {
    allLevelsByAch[id].sort((x, y) => x.level - y.level);
  }

  // Secret achievements are computed via DB unlock (not via computeProgressFor),
  // so we read their level straight off the unlocked rows. max_level
  // comes from the catalog so multi-tier secrets (egg_dice: L1 = first
  // roll, L2 = all 6 faces) display the right "X/Y" badge.
  const list = data.catalog.map(a => {
    const dbRow = unlockedByAch[a.id];
    const computed = data.progress[a.id];
    const secretMax = a.levels?.length || 1;
    const isFromDB = a.secret || a.final;
    const p = isFromDB
      ? { current: dbRow ? dbRow.level : 0, level: dbRow?.level || 0, max_level: secretMax, target_next: null }
      : (computed || { current: 0, level: 0, max_level: a.levels?.length || 5, target_next: a.levels?.[0] || 0 });
    const levelsList = allLevelsByAch[a.id] || [];
    return {
      ...a,
      progress: p,
      unlocked: p.level >= 1,
      // Max-level row's unlock_at — used by the existing inline "🏆 MAX · date" line.
      unlockedAt: dbRow?.unlocked_at || null,
      // L1's unlock_at — when the trophy was FIRST unlocked. Same as
      // unlockedAt for single-level trophies; different for multi-level
      // ones once the player climbs past L1.
      firstUnlockedAt: levelsList[0]?.unlocked_at || null,
      // Every recorded (level, unlocked_at) — passed to the detail modal so
      // it can render an unlock timeline if the player wants the full history.
      levelHistory: levelsList,
    };
  });

  // Secret-trophy visibility:
  //  - Regular secrets are completely hidden until at least one is unlocked.
  //    After the first unlock, the rest become anonymous "???" placeholders.
  //  - `hiddenUntilEarned` items (the meta egg_master) stay invisible even
  //    after other secrets unlock, all the way until they're earned. This
  //    way the player doesn't even know they exist before completion.
  const secretsUnlocked = list.some(a => a.secret && !a.hiddenUntilEarned && a.unlocked);
  const visibleList = list.filter(a => {
    if (a.hiddenUntilEarned) return a.unlocked;
    if (a.final) return secretsUnlocked; // visible only once the first easter egg is found
    if (a.secret) return secretsUnlocked;
    return true;
  });

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

  // For each of the 5 gran_finale levels: how many non-final trophies (with
  // max_level >= n) have already reached level n? Used by FinalTrophyTile.
  const nonFinalList = list.filter(a => !a.final);
  const finaleGoals = [1, 2, 3, 4, 5].map(n => {
    const required = nonFinalList.filter(a => (a.levels?.length || 1) >= n);
    const done = required.filter(a => a.progress.level >= n).length;
    return { n, done, total: required.length, met: done === required.length };
  });

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
          {[
            { id:'all',      n: visibleList.length },
            { id:'unlocked', n: visibleList.filter(a => a.unlocked).length },
            { id:'max',      n: visibleList.filter(a => a.progress.level >= a.progress.max_level).length },
            { id:'locked',   n: visibleList.filter(a => !a.unlocked).length },
          ].map(({ id, n }) => (
            <button key={id} style={pill(filter === id)} onClick={() => setFilter(id)}>
              {t('trophies.filter_'+id)}
              <span style={{ marginLeft:4, opacity:.65, fontWeight:500 }}>({n})</span>
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
                {items.map(a => <SecretTrophyTile key={a.id} a={a} t={t} fmtDate={fmtDate} onOpen={(rect) => setDetail(prev => prev?.a?.id === a.id ? null : { a, rect })}/>)}
              </div>
            </div>
          );
        }

        if (cat === 'finale') {
          return (
            <div key={cat} style={{ marginBottom: 24, marginTop: 6 }}>
              {items.map(a => (
                <FinalTrophyTile
                  key={a.id} a={a} t={t} fmtDate={fmtDate}
                  finaleGoals={finaleGoals}
                  onOpen={rect => setDetail(prev => prev?.a?.id === a.id ? null : { a, rect })}
                />
              ))}
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
              {items.map(a => <TrophyTile key={a.id} a={a} t={t} fmtDate={fmtDate} onOpen={(rect) => setDetail(prev => prev?.a?.id === a.id ? null : { a, rect })}/>)}
            </div>
          </div>
        );
      })}

      {detail && createPortal(
        <>
          <div onClick={() => setDetail(null)} style={{ position:'fixed', inset:0, zIndex:8999 }} aria-hidden/>
          <TrophyDetailPopover
            key={detail.a.id}
            a={detail.a}
            anchorRect={detail.rect}
            t={t}
            fmtDate={fmtDate}
            onClose={() => setDetail(null)}
          />
        </>,
        document.body
      )}
    </div>
  );
}

// Anchored popover shown on tile tap — lives just outside the clicked tile
// and grows into place from the tile's center, so the user reads it as
// "the tile expanding to reveal its history" rather than a generic modal
// taking over the page. No heavy backdrop: only a thin click-catcher to
// dismiss-on-outside. Closes on ESC, scroll, resize, or clicking another
// tile (the popover's mousedown-outside handler fires before the new
// tile's click, so switching trophies feels instant).
function TrophyDetailPopover({ a, anchorRect, t, fmtDate, onClose }) {
  // No useBodyScrollLock — this is a small anchored popover, not a full modal.
  // Body-scroll lock sets touchAction:none which silently blocks tap propagation
  // to trophy tiles, and triggers a spurious scroll event on mount that
  // immediately fires onClose before the user even sees the popover.
  const masked = !!a.secret && !a.unlocked;
  const labelName = masked ? t('trophies.secret_locked')      : t('trophies.'+a.id);
  const { level, max_level } = a.progress;
  const isMax = a.unlocked && level >= max_level;
  const labelDesc = masked ? t('trophies.secret_locked_desc')
    : a.id === 'egg_dice' && level >= 2 ? t('trophies.egg_dice_desc_l2')
    : t('trophies.'+a.id+'_desc');
  const displayIcon = masked ? '?' : a.icon;
  const tierC = tierFor(level);
  const accent = a.unlocked ? tierC : 'var(--mut)';


  const popoverRef = useRef(null);
  const touchStartY = useRef(null);
  const POPOVER_W = 260;
  const MARGIN = 12;
  const GAP = 8;

  // Synchronous position — no useEffect needed, no "invisible then visible" flash.
  // 300px is a safe height estimate; maxHeight + overflowY handle taller content.
  const [pos] = useState(() => {
    const APPROX_H = 300;
    const vw = window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const h  = Math.min(APPROX_H, vh - MARGIN * 2);
    const left = anchorRect
      ? Math.max(MARGIN, Math.min(anchorRect.left, vw - POPOVER_W - MARGIN))
      : Math.max(MARGIN, (vw - POPOVER_W) / 2);
    let top, origin;
    if (anchorRect) {
      const spaceBelow = vh - anchorRect.bottom - GAP;
      const spaceAbove = anchorRect.top - GAP;
      if (spaceBelow >= h || spaceBelow >= spaceAbove) {
        top    = anchorRect.bottom + GAP;
        origin = 'top center';
      } else {
        top    = anchorRect.top - GAP - h;
        origin = 'bottom center';
      }
      top = Math.max(MARGIN, Math.min(top, vh - h - MARGIN));
    } else {
      top    = Math.max(MARGIN, (vh - h) / 2);
      origin = 'center center';
    }
    return { left, top, origin };
  });

  // Swipe-down to dismiss on mobile.
  const handleTouchStart = e => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchMove  = e => {
    if (touchStartY.current === null) return;
    if (e.touches[0].clientY - touchStartY.current > 60) onClose?.();
  };
  const handleTouchEnd   = () => { touchStartY.current = null; };

  useEffect(() => {
    const onKey  = e => { if (e.key === 'Escape') onClose?.(); };
    const onBack = () => onClose?.();
    const onResize = () => onClose?.();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    document.addEventListener('backgesture', onBack);
    let onScroll;
    const tid = setTimeout(() => {
      onScroll = () => onClose?.();
      window.addEventListener('scroll', onScroll, true);
    }, 120);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('backgesture', onBack);
      clearTimeout(tid);
      if (onScroll) window.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  const Row = ({ label, value, kicker }) => (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'baseline',
      padding:'8px 0', borderTop:'1px solid var(--rule)',
    }}>
      <div>
        <div style={{
          fontSize:8.5, letterSpacing:'.22em', textTransform:'uppercase',
          color:'var(--dim)', fontWeight:700, fontFamily:"'Manrope',sans-serif",
        }}>{label}</div>
        {kicker && <div style={{fontSize:10.5, color:'var(--mut)', marginTop:2}}>{kicker}</div>}
      </div>
      <div style={{
        fontSize:12.5, fontWeight:700, color:'var(--txt)',
        fontFamily:"'Manrope',sans-serif", fontVariantNumeric:'tabular-nums',
      }}>{value}</div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes tdpIn { 0%{opacity:0;transform:scale(.78)} 60%{opacity:1;transform:scale(1.03)} 100%{opacity:1;transform:scale(1)} }
      `}</style>
      <div
        ref={popoverRef}
        role="dialog"
        aria-label={labelName}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position:'fixed',
          left: pos.left, top: pos.top,
          width: POPOVER_W, zIndex: 9000,
          maxHeight: `calc(100dvh - ${MARGIN * 2}px)`,
          overflowY: 'auto',
          background:'linear-gradient(160deg, var(--surf) 0%, var(--card) 100%)',
          border:'1px solid var(--rule)',
          borderTop:`3px solid ${accent}`,
          borderRadius:14,
          boxShadow:`0 18px 50px rgba(0,0,0,.55), 0 0 0 1px ${accent}22, 0 0 30px ${accent}1f`,
          padding:'14px 16px 12px',
          transformOrigin: pos.origin,
          animation: 'tdpIn 240ms cubic-bezier(.18,.9,.32,1.18) both',
        }}
      >
        <div style={{display:'flex', alignItems:'flex-start', gap:12}}>
          <div style={{
            fontSize: masked ? 30 : 32, lineHeight:1, flexShrink:0,
            fontFamily: masked ? "'Playfair Display',serif" : undefined,
            fontStyle: masked ? 'italic' : undefined,
            fontWeight: masked ? 900 : undefined,
            color: masked ? 'var(--mut)' : undefined,
            filter: masked ? 'none' : a.unlocked ? `drop-shadow(0 2px 10px ${tierC}77)` : 'grayscale(1) opacity(.55)',
          }}>{displayIcon}</div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{
              fontFamily:"'Manrope',sans-serif", fontSize:8, fontWeight:800,
              letterSpacing:'.28em', textTransform:'uppercase',
              color: accent, marginBottom:2,
            }}>{t('trophies.cat_'+(a.category || 'mission'))}</div>
            <div style={{
              fontFamily: masked ? "'Cormorant Garamond',serif" : "'Manrope',sans-serif",
              fontStyle: masked ? 'italic' : undefined,
              fontSize:15, fontWeight:700, color:'var(--txt)',
              letterSpacing: masked ? '.06em' : '-0.005em',
              lineHeight:1.2,
              overflow:'hidden', textOverflow:'ellipsis',
              display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical',
            }}>{labelName}</div>
          </div>
          <button onClick={onClose} aria-label="Chiudi" style={{
            background:'transparent', border:'1px solid var(--rule)',
            cursor:'pointer', borderRadius:'50%',
            color:'var(--dim)', fontSize:11, width:22, height:22,
            display:'flex', alignItems:'center', justifyContent:'center',
            flexShrink:0, lineHeight:1, padding:0,
          }}>✕</button>
        </div>

        <div style={{
          fontSize:11, color:'var(--dim)', marginTop:8, lineHeight:1.4,
          fontStyle: masked ? 'italic' : undefined,
        }}>{labelDesc}</div>

        <div style={{marginTop:8}}>
          {!a.unlocked ? (
            <div style={{
              marginTop:6, padding:'8px 10px',
              background:'var(--mut)0f', border:'1px dashed var(--brd)',
              borderRadius:8, textAlign:'center',
              fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
              color:'var(--mut)', fontFamily:"'Manrope',sans-serif", fontWeight:700,
            }}>🔒 {t('trophies.detail_locked')}</div>
          ) : max_level <= 1 ? (
            <Row label={t('trophies.detail_unlocked')} value={fmtDate(a.unlockedAt || a.firstUnlockedAt)} />
          ) : (
            Array.from({ length: max_level }, (_, i) => i + 1).map(lv => {
              const entry = (a.levelHistory || []).find(h => h.level === lv);
              const lvColor = tierFor(lv);
              return (
                <div key={lv} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'7px 0', borderTop:'1px solid var(--rule)',
                }}>
                  <div style={{display:'flex', alignItems:'center', gap:7}}>
                    <div style={{
                      width:6, height:6, borderRadius:'50%', flexShrink:0,
                      background: entry ? lvColor : 'var(--brd)',
                    }}/>
                    <span style={{
                      fontSize:11, fontFamily:"'Manrope',sans-serif", fontWeight:700,
                      letterSpacing:'.04em',
                      color: entry ? (lv === level ? lvColor : 'var(--txt)') : 'var(--mut)',
                    }}>
                      Liv. {lv}{lv === max_level ? ' · MAX' : ''}
                    </span>
                  </div>
                  <span style={{
                    fontSize:12, fontWeight:700,
                    color: entry ? 'var(--txt)' : 'var(--mut)',
                    fontFamily:"'Manrope',sans-serif", fontVariantNumeric:'tabular-nums',
                  }}>
                    {entry ? fmtDate(entry.unlocked_at) : '—'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

// Hero variant of TrophyTile reserved for the `secret` category. Bigger
// emoji, more generous padding, and a "still to discover" state that uses
// italic Cormorant to feel inviting rather than locked-down.
function SecretTrophyTile({ a, t, fmtDate, onOpen }) {
  const unlocked = a.unlocked;
  const masked = !unlocked;
  // The completion-meta trophy (egg_master) gets a totally distinct
  // visual treatment so it doesn't blend with the five eggs that fed
  // into it: iridescent gradient, sparkle aura, full-width row, larger
  // crown emoji, bold serif headline.
  const isMeta = a.id === 'egg_master';
  const { level, max_level } = a.progress;
  const showLevel = unlocked && max_level > 1;
  const clickProps = {
    role: 'button',
    tabIndex: 0,
    onClick: (e) => onOpen?.(e.currentTarget.getBoundingClientRect()),
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(e.currentTarget.getBoundingClientRect()); } },
  };

  if (isMeta) {
    return (
      <div {...clickProps} className="card-hover" style={{
        position:'relative', overflow:'hidden',
        padding:'24px 22px',
        borderRadius: 18,
        cursor:'pointer',
        // Iridescent gradient — gold → purple → magenta with the gold
        // shimmer keyframe so the background gently animates.
        background: 'linear-gradient(120deg, var(--gold) 0%, color-mix(in srgb, var(--pur) 80%, var(--gold)) 35%, var(--gold) 65%, color-mix(in srgb, var(--pur) 70%, var(--gold)) 100%)',
        backgroundSize: '300% 100%',
        animation: 'shimmer 6s linear infinite',
        border: '2px solid color-mix(in srgb, var(--gold) 70%, #fff)',
        boxShadow: '0 12px 40px -8px var(--glow), 0 0 0 4px rgba(255,255,255,.06) inset',
        gridColumn: '1 / -1',
        display:'flex', alignItems:'center', gap: 18,
      }}>
        {/* Sparkle decorations */}
        <div aria-hidden style={{
          position:'absolute', top: 8, right: 14, fontSize: 14,
          opacity: .7, animation: 'bcStreakTap 2.4s ease-in-out infinite',
        }}>✨</div>
        <div aria-hidden style={{
          position:'absolute', bottom: 10, left: 18, fontSize: 12,
          opacity: .5,
        }}>✦</div>
        {/* Crown emoji — bigger than the secret tiles around it */}
        <div style={{
          fontSize: 88, lineHeight: 1, flexShrink: 0,
          filter: 'drop-shadow(0 6px 28px rgba(0,0,0,.45))',
        }}>{a.icon}</div>
        <div style={{ flex:1, minWidth: 0 }}>
          <div style={{
            fontSize: 9, letterSpacing: 2.5, color: 'rgba(255,255,255,.85)',
            textTransform: 'uppercase', fontWeight: 800,
            fontFamily: "'Manrope',sans-serif",
          }}>{t('trophies.meta_kicker')}</div>
          <div style={{
            fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
            fontSize: 28, fontWeight: 700, color: '#1a1530',
            lineHeight: 1.05, marginTop: 2, letterSpacing: '-0.01em',
            textShadow: '0 1px 0 rgba(255,255,255,.45)',
          }}>{t('trophies.'+a.id)}</div>
          <div style={{
            fontSize: 12, color: '#1a1530', opacity: .85,
            marginTop: 6, lineHeight: 1.4, fontWeight: 500,
            textShadow: '0 1px 0 rgba(255,255,255,.35)',
          }}>{t('trophies.'+a.id+'_desc')}</div>
          {a.unlockedAt && (
            <div style={{
              marginTop: 10, fontSize: 9, letterSpacing: 1.5, fontWeight: 800,
              color: '#1a1530',
              textShadow: '0 1px 0 rgba(255,255,255,.4)',
              textTransform: 'uppercase',
              fontFamily:"'Manrope',sans-serif",
            }}>👑 {fmtDate(a.unlockedAt)}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div {...clickProps} className={unlocked ? 'card-hover pGold' : ''} style={{
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
      cursor:'pointer',
    }}>
      {/* Multi-level tier badge in the corner for secrets with >1 level
          (currently just egg_dice's 1/6 ↔ 6/6). MAX badge when full. */}
      {showLevel && (
        <div style={{
          position:'absolute', top: 10, right: 10,
          padding:'3px 8px', borderRadius: 999,
          background: level >= max_level ? 'var(--gold)' : 'var(--gold)22',
          color: level >= max_level ? '#1a1530' : 'var(--gold)',
          border: '1px solid var(--gold)55',
          fontSize: 9, fontWeight: 800, letterSpacing: '.08em',
          fontFamily: "'Manrope',sans-serif", textTransform: 'uppercase',
        }}>{level >= max_level ? 'MAX' : `${level}/${max_level}`}</div>
      )}
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
      }}>{masked ? t('trophies.secret_locked_desc')
      : a.id === 'egg_dice' && a.progress.level >= 2 ? t('trophies.egg_dice_desc_l2')
      : t('trophies.'+a.id+'_desc')}</div>
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

function TrophyTile({ a, t, fmtDate, onOpen }) {
  const { current, level, max_level, target_next } = a.progress;
  const unlocked = level >= 1;
  const isMax = level >= max_level;
  const tierC = tierFor(level);
  // Secret-trophy anonymization: when the player has unlocked at least one
  // secret, the remaining secrets show up here but with no name/icon hint.
  const masked = a.secret && !unlocked;
  const labelName = masked ? t('trophies.secret_locked')      : t('trophies.'+a.id);
  const labelDesc = masked ? t('trophies.secret_locked_desc')
    : a.id === 'egg_dice' && level >= 2 ? t('trophies.egg_dice_desc_l2')
    : t('trophies.'+a.id+'_desc');
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
    <div role="button" tabIndex={0}
      onClick={e => onOpen?.(e.currentTarget.getBoundingClientRect())}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(e.currentTarget.getBoundingClientRect()); } }}
      className={`${unlocked ? 'card-hover' : ''}${isMax ? ' pGold' : ''}`}
      style={{
      padding:'10px 12px 12px',
      borderRadius:12,
      background: maxBg,
      border: `${isMax ? 2 : 1}px solid ${borderC}`,
      opacity: unlocked ? 1 : .82,
      position:'relative', overflow:'hidden',
      cursor:'pointer',
    }}>
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
          {/* Badge wrapper — for MAX we drop a soft circular gold halo
              BEHIND the badge so the "MAX 👑" pill sits dead-center in the
              glow, instead of the old corner-bleed radial that clipped the
              text. The wrapper is what positions both. */}
          <div style={{position:'relative', display:'inline-flex', alignItems:'center'}}>
            {isMax && (
              <div aria-hidden style={{
                position:'absolute', top:'50%', left:'50%',
                transform:'translate(-50%, -50%)',
                width:68, height:68, borderRadius:'50%',
                background:'radial-gradient(circle, rgba(232,184,75,.42) 0%, rgba(232,184,75,.18) 35%, transparent 70%)',
                pointerEvents:'none',
              }}/>
            )}
            <div style={{
              position:'relative', // keep above halo
              fontSize:9, fontWeight:800, color: unlocked ? tierC : 'var(--mut)',
              letterSpacing:1, padding:'2px 6px', borderRadius:8,
              border:`1px solid ${unlocked ? tierC + '55' : 'var(--brd)'}`,
              background: unlocked ? `${tierC}11` : 'transparent',
            }}>{max_level === 1 ? (unlocked ? '✓' : '🔒') : (isMax ? 'MAX 👑' : `Lv ${level}/${max_level}`)}</div>
          </div>
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

// The ultimate endgame trophy — always visible, but locks until every other
// trophy reaches the corresponding level. Levels 1–5 unlock progressively
// as all trophies that can reach Lv N have reached Lv N.
function FinalTrophyTile({ a, t, fmtDate, finaleGoals, onOpen }) {
  const { level, max_level } = a.progress;
  const isMax = level >= max_level;
  const locked = level === 0;
  const tierC = tierFor(level);

  // nextGoal = progress data for the next level to unlock
  const nextGoal = !isMax && finaleGoals[level] ? finaleGoals[level] : null;

  const clickProps = {
    role: 'button', tabIndex: 0,
    onClick: e => onOpen?.(e.currentTarget.getBoundingClientRect()),
    onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(e.currentTarget.getBoundingClientRect()); } },
  };

  const bg = isMax
    ? 'linear-gradient(120deg, var(--gold) 0%, color-mix(in srgb, var(--pur) 80%, var(--gold)) 35%, var(--gold) 65%, color-mix(in srgb, var(--pur) 70%, var(--gold)) 100%)'
    : locked
      ? 'linear-gradient(180deg, var(--surf), var(--card))'
      : `linear-gradient(135deg, ${tierC}1a 0%, var(--card) 100%)`;

  const textMain  = isMax ? '#1a1530' : locked ? 'var(--dim)' : 'var(--txt)';
  const textMuted = isMax ? 'rgba(26,21,48,.7)' : 'var(--dim)';

  return (
    <div {...clickProps} className={`card-hover${isMax ? ' pGold' : ''}`} style={{
      position: 'relative', overflow: 'hidden',
      padding: '28px 24px',
      borderRadius: 20,
      background: bg,
      backgroundSize: isMax ? '300% 100%' : undefined,
      animation: isMax ? 'shimmer 6s linear infinite' : undefined,
      border: locked
        ? '1px dashed var(--brd)'
        : isMax
          ? '2px solid color-mix(in srgb, var(--gold) 70%, #fff)'
          : `2px solid ${tierC}88`,
      boxShadow: locked ? 'none' : `0 12px 48px -10px ${tierC}55`,
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 24,
    }}>
      {isMax && <>
        <div aria-hidden style={{ position:'absolute', top:10, right:18, fontSize:16, opacity:.7, animation:'bcStreakTap 2.4s ease-in-out infinite' }}>✨</div>
        <div aria-hidden style={{ position:'absolute', bottom:12, left:24, fontSize:13, opacity:.5 }}>✦</div>
        <div aria-hidden style={{ position:'absolute', top:16, left:'45%', fontSize:10, opacity:.45, animation:'bcStreakTap 3s 1s ease-in-out infinite' }}>✦</div>
      </>}

      {/* Icon */}
      <div style={{
        fontSize: 88, lineHeight: 1, flexShrink: 0,
        filter: locked
          ? 'grayscale(1) opacity(.35)'
          : `drop-shadow(0 8px 32px ${tierC}88)`,
      }}>{a.icon}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: 800,
          fontFamily: "'Manrope',sans-serif",
          color: locked ? 'var(--dim)' : isMax ? 'rgba(26,21,48,.7)' : tierC,
        }}>{t('trophies.cat_finale')}</div>

        <div style={{
          fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
          fontSize: 30, fontWeight: 700, lineHeight: 1.05, marginTop: 4,
          letterSpacing: '-0.01em',
          color: textMain,
          textShadow: isMax ? '0 1px 0 rgba(255,255,255,.4)' : undefined,
        }}>{t('trophies.gran_finale')}</div>

        <div style={{
          fontSize: 12.5, lineHeight: 1.45, marginTop: 6, maxWidth: 380,
          color: locked ? 'var(--mut)' : textMuted,
          textShadow: isMax ? '0 1px 0 rgba(255,255,255,.25)' : undefined,
        }}>{isMax ? t('trophies.gran_finale_maxed') : t('trophies.gran_finale_desc')}</div>

        <div style={{ marginTop: 14 }}>
          {/* Level bar when unlocked */}
          {!locked && (
            <>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: max_level }).map((_, idx) => (
                  <div key={idx} style={{
                    flex: 1, height: 7, borderRadius: 3,
                    background: idx < level
                      ? (isMax ? 'rgba(26,21,48,.55)' : tierC)
                      : (isMax ? 'rgba(26,21,48,.2)' : 'var(--mut)22'),
                    boxShadow: idx < level && !isMax ? `0 0 6px ${tierC}66` : 'none',
                  }} />
                ))}
              </div>
              <div style={{
                marginTop: 6, fontSize: 9, letterSpacing: 1.5, fontWeight: 700,
                fontFamily: "'Manrope',sans-serif", color: isMax ? 'rgba(26,21,48,.6)' : textMuted,
              }}>
                {isMax
                  ? `👑 MAX · ${fmtDate(a.unlockedAt)}`
                  : nextGoal
                    ? t('trophies.gran_finale_progress', { done: nextGoal.done, total: nextGoal.total, n: nextGoal.n })
                    : null}
              </div>
            </>
          )}
          {/* Locked: show progress bar toward L1 */}
          {locked && nextGoal && (
            <>
              <div style={{ height: 5, background: 'var(--mut)22', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${nextGoal.total ? (nextGoal.done / nextGoal.total) * 100 : 0}%`,
                  background: 'var(--gold)', transition: 'width .5s',
                }} />
              </div>
              <div style={{
                marginTop: 5, fontSize: 9, letterSpacing: 1.5, fontWeight: 700,
                fontFamily: "'Manrope',sans-serif", color: 'var(--dim)',
              }}>
                {t('trophies.gran_finale_progress', { done: nextGoal.done, total: nextGoal.total, n: 1 })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Level badge */}
      <div style={{
        flexShrink: 0, alignSelf: 'flex-start',
        padding: '6px 14px', borderRadius: 999,
        background: locked ? 'var(--mut)11' : isMax ? 'rgba(26,21,48,.3)' : `${tierC}22`,
        border: locked ? '1px dashed var(--brd)' : `1px solid ${isMax ? 'rgba(26,21,48,.5)' : tierC + '66'}`,
        fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
        fontFamily: "'Manrope',sans-serif",
        color: locked ? 'var(--mut)' : isMax ? '#1a1530' : tierC,
      }}>
        {locked ? `🔒 ${t('trophies.locked')}` : isMax ? 'MAX 👑' : `Lv ${level}/${max_level}`}
      </div>
    </div>
  );
}
