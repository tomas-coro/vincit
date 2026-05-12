import React, { useEffect, useState, useLayoutEffect } from 'react';
import { useLang } from '../i18n.js';

// Spotlights an element on the page and shows a short caption.
// steps: [{ selector, title, body, place: 'bottom'|'top' }]
export default function OnboardingTour({ steps, onDone }) {
  const { t } = useLang();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);

  // Recompute the spotlight rect when step changes or window resizes.
  useLayoutEffect(() => {
    function measure() {
      const sel = steps[i]?.selector;
      if (!sel) { setRect(null); return; }
      const el = document.querySelector(sel);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
      // Bring the target into view if hidden
      if (r.top < 80 || r.bottom > window.innerHeight - 80) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
    measure();
    window.addEventListener('resize', measure);
    const id = setInterval(measure, 200); // tracks layout shifts (e.g. when SSE updates)
    return () => { window.removeEventListener('resize', measure); clearInterval(id); };
  }, [i, steps]);

  // ESC to skip
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onDone?.(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onDone]);

  if (!steps?.length) return null;
  const step = steps[i];
  const last = i === steps.length - 1;

  // Caption placement: prefer below the spotlight; fall back to above if no room
  const pad = 8;
  let cx = 16, cy = 80, cw = Math.min(360, window.innerWidth - 32);
  if (rect) {
    cw = Math.min(360, window.innerWidth - 32);
    cx = Math.min(Math.max(8, rect.x + rect.w / 2 - cw / 2), window.innerWidth - cw - 8);
    const wantBelow = step.place !== 'top';
    const below = rect.y + rect.h + 14;
    const above = rect.y - 14 - 140; // approximate caption height
    cy = wantBelow && below + 140 < window.innerHeight - 16 ? below : Math.max(16, above);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8000, pointerEvents: 'auto' }}>
      <style>{`
        @keyframes spotlightPulse { 0%,100% { box-shadow: 0 0 0 4px rgba(200,151,63,.55), 0 0 0 9999px rgba(0,0,0,.72) }
                                    50%      { box-shadow: 0 0 0 6px rgba(232,184,75,.85), 0 0 0 9999px rgba(0,0,0,.72) } }
        @keyframes tourPop { from { opacity:0; transform: translateY(8px) } to { opacity:1; transform: translateY(0) } }
      `}</style>

      {/* Full dim if we couldn't locate the target */}
      {!rect && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.72)' }}/>}

      {/* Spotlight cutout */}
      {rect && (
        <div style={{
          position: 'absolute',
          left: rect.x - pad, top: rect.y - pad,
          width: rect.w + pad * 2, height: rect.h + pad * 2,
          borderRadius: 14,
          animation: 'spotlightPulse 1.6s ease-in-out infinite',
          pointerEvents: 'none',
        }}/>
      )}

      {/* Skip top-right */}
      <button onClick={() => onDone?.()} style={{
        position: 'absolute', top: 16, right: 16,
        padding: '6px 12px', borderRadius: 16,
        background: 'rgba(0,0,0,.5)', border: '1px solid rgba(255,255,255,.18)',
        color: 'rgba(255,255,255,.85)', fontSize: 11, fontWeight: 600,
        letterSpacing: 1, cursor: 'pointer', fontFamily: "'Syne',sans-serif",
      }}>
        {t('onboarding.skip')}
      </button>

      {/* Caption bubble */}
      <div style={{
        position: 'absolute', left: cx, top: cy, width: cw,
        background: 'var(--surf)', border: '1px solid var(--gold)55',
        borderRadius: 14, padding: '14px 16px',
        boxShadow: '0 16px 48px rgba(0,0,0,.55)',
        animation: 'tourPop .25s ease-out both',
      }}>
        <div style={{
          fontSize: 10, color: 'var(--gold)',
          letterSpacing: 2, textTransform: 'uppercase',
          fontFamily: "'Syne',sans-serif", marginBottom: 4, fontWeight: 700,
        }}>
          {i + 1} / {steps.length} · {step.kicker || t('onboarding.kicker')}
        </div>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 18, fontWeight: 700, color: 'var(--txt)', marginBottom: 6,
        }}>{step.title}</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
          {step.body}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          {!last && (
            <button onClick={() => setI(i + 1)} style={{
              padding: '8px 18px', borderRadius: 10, border: 'none',
              background: 'var(--gold)', color: '#07060f',
              fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>{t('onboarding.next')} →</button>
          )}
          {last && (
            <button onClick={() => onDone?.()} style={{
              padding: '8px 18px', borderRadius: 10, border: 'none',
              background: 'var(--gold)', color: '#07060f',
              fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>{t('onboarding.done')} ✓</button>
          )}
        </div>
      </div>
    </div>
  );
}
