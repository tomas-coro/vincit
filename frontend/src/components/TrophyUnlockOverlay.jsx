import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLang } from '../i18n.js';

const CSS = `
@keyframes trophyIn  { 0%   { transform: translate(-50%, 24px) scale(.85); opacity: 0 }
                       55%  { transform: translate(-50%, -4px) scale(1.04); opacity: 1 }
                       100% { transform: translate(-50%, 0)     scale(1);    opacity: 1 } }
@keyframes trophyOut { 0%   { transform: translate(-50%, 0)     scale(1); opacity: 1 }
                       100% { transform: translate(-50%, -16px) scale(.92); opacity: 0 } }
@keyframes trophyGlow { 0%, 100% { box-shadow: 0 0 0 0 var(--glow), 0 12px 36px rgba(0,0,0,.55) }
                        50%      { box-shadow: 0 0 24px 4px rgba(200,151,63,.55), 0 12px 36px rgba(0,0,0,.55) } }
@keyframes trophySpark { 0%   { transform: scale(0) rotate(0deg);  opacity: 0 }
                         40%  { transform: scale(1) rotate(180deg); opacity: 1 }
                         100% { transform: scale(0) rotate(360deg); opacity: 0 } }
@keyframes trophyShimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
.tr-card { animation: trophyIn .55s cubic-bezier(.34,1.56,.64,1) both,
                       trophyGlow 2.2s ease-in-out .6s infinite; }
.tr-card.exit { animation: trophyOut .35s ease-in forwards; }
.tr-spark { position: absolute; pointer-events: none;
            animation: trophySpark 1.8s ease-in-out infinite; }
.tr-shim  { background: linear-gradient(90deg, var(--gold) 0%, #fff 50%, var(--gold) 100%);
            background-size: 200% 100%;
            -webkit-background-clip: text; background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: trophyShimmer 2.5s linear infinite; }
`;

const TIER_BY_LEVEL = { 1: '#b87333', 2: '#c0c4d0', 3: '#c0c4d0', 4: 'var(--gold)', 5: 'var(--gold)' };

// queue = array of { id, icon, level, max_level }
export default function TrophyUnlockOverlay({ queue, onDone }) {
  const { t } = useLang();
  const [current, setCurrent] = useState(null);
  const [exiting, setExiting] = useState(false);

  // Stable ref to the latest onDone so the timers below don't get a stale closure
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  // Effect A — when we set a `current`, schedule fade-out + clear. Re-runs ONLY
  // when current changes (so queue updates can't accidentally clear the timers).
  useEffect(() => {
    if (!current) return;
    setExiting(false);
    const tExit = setTimeout(() => setExiting(true), 2900);
    const tClear = setTimeout(() => {
      setCurrent(null);
      onDoneRef.current?.();
    }, 3300);
    return () => { clearTimeout(tExit); clearTimeout(tClear); };
  }, [current]);

  // Effect B — when the queue grows and we're idle, grab the next item
  useEffect(() => {
    if (current == null && queue.length > 0) {
      setCurrent(queue[0]);
    }
  }, [queue, current]);

  const dismissNow = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setCurrent(null);
      onDoneRef.current?.();
    }, 280);
  }, []);

  if (!current) return null;
  const isMax = current.level >= (current.max_level || 5);
  const tier = TIER_BY_LEVEL[current.level] || '#b87333';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      <style>{CSS}</style>
      <div
        onClick={dismissNow}
        className={`tr-card${exiting ? ' exit' : ''}`}
        style={{
          position: 'absolute', top: 12, left: '50%',
          width: 'min(360px, calc(100vw - 24px))',
          background: 'linear-gradient(135deg, var(--surf), var(--card))',
          border: `1px solid ${tier}88`,
          borderLeft: `4px solid ${tier}`,
          borderRadius: 14,
          padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
          pointerEvents: 'auto', cursor: 'pointer',
        }}
      >
        {/* Sparkles */}
        <span className="tr-spark" style={{ top: -10, right: 14,  fontSize: 14, animationDelay: '0s'   }}>✨</span>
        <span className="tr-spark" style={{ bottom: -8, left: 34, fontSize: 12, animationDelay: '.4s'  }}>✨</span>
        <span className="tr-spark" style={{ top: 8,    left: -8,  fontSize: 10, animationDelay: '.9s'  }}>✨</span>
        <span className="tr-spark" style={{ top: 26,   right: -6, fontSize: 11, animationDelay: '1.3s' }}>✨</span>

        <div style={{
          fontSize: 34, lineHeight: 1, flexShrink: 0,
          filter: `drop-shadow(0 0 12px ${tier}aa)`,
        }}>{current.icon}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 9, letterSpacing: 2, fontWeight: 800, fontFamily: "'Archivo',sans-serif",
            textTransform: 'uppercase', marginBottom: 2,
          }}>
            <span className="tr-shim">🏆 {isMax ? t('trophies.max_reached') : `${t('trophies.unlocked_header')} · Lv ${current.level}`}</span>
          </div>
          <div style={{
            fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600,
            color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            lineHeight: 1.2,
          }}>{t('trophies.' + current.id)}</div>
          <div style={{
            fontSize: 11, color: 'var(--dim)', marginTop: 2, lineHeight: 1.3,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{t('trophies.' + current.id + '_desc')}</div>
          {/* One-shot tip — fires on the first streak-egg unlock to explain
              the 3-tap activation pattern. App.jsx attaches `tip` to the
              queue entry; LS guarantees it shows only once. */}
          {current.tip && (
            <div style={{
              fontSize: 10, color: 'var(--gold)', marginTop: 6, lineHeight: 1.35,
              fontFamily: "'Archivo',sans-serif", fontWeight: 600,
              paddingTop: 6, borderTop: '1px solid var(--rule)',
            }}>{t('trophies.' + current.tip)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
