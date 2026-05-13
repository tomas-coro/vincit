import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../i18n.js';

// Editorial fullscreen onboarding — five hero pages in the same broken-grid
// Lavanda+Ottone language as the rest of the app. Each page is a poster:
// italic Cormorant headline, Manrope body, big emoji/composition, with
// "Salta" always visible top-right. The "Crea bet" step exposes an
// `onOpenCreate` callback so the user can pop the real CreateModal as a
// hands-on demo and come back to the tour where they left off.

const CSS = `
@keyframes bcOnbBgIn  { from { opacity: 0 } to { opacity: 1 } }
@keyframes bcOnbBgOut { to   { opacity: 0 } }
@keyframes bcOnbPageIn {
  0%   { transform: translateY(28px) scale(.96); opacity: 0; filter: blur(8px) }
  100% { transform: translateY(0)    scale(1);   opacity: 1; filter: blur(0) }
}
@keyframes bcOnbHeroEmoji {
  0%, 100% { transform: translateY(0) rotate(0deg) }
  50%      { transform: translateY(-8px) rotate(2deg) }
}
@keyframes bcOnbShimmer {
  0%   { background-position: -200% 0 }
  100% { background-position:  200% 0 }
}
`;

// Static page definitions — kept in module scope so the component reads as
// declarative content + chrome. Each page maps to an i18n group. The
// "what is a bet" explanation lives INSIDE the CreateModal now (as inline
// hints), not as a separate tour card.
const PAGES = [
  { id: 'welcome', kicker: 'page_kicker_welcome', emoji: '🃏',  cta: 'next' },
  { id: 'groups',  kicker: 'page_kicker_groups',  emoji: '👥',  cta: 'next' },
  { id: 'create',  kicker: 'page_kicker_create',  emoji: '🎯',  cta: 'demo' }, // opens CreateModal as a hands-on demo
  { id: 'play',    kicker: 'page_kicker_play',    emoji: '⚡',  cta: 'next' },
  { id: 'ready',   kicker: 'page_kicker_ready',   emoji: '✨',  cta: 'done' },
];

// `step` and `onStepChange` make the tour controlled by the parent so its
// position survives a side-trip into the CreateModal demo (the parent
// briefly hides the tour, then resumes it at the next page when the modal
// closes). They're optional: omit both for uncontrolled / standalone use.
export default function OnboardingTour({ step, onStepChange, onDone, onOpenCreate }) {
  const { t } = useLang();
  const [internalIdx, setInternalIdx] = useState(0);
  const idx = typeof step === 'number' ? step : internalIdx;
  const setIdx = (next) => {
    const value = typeof next === 'function' ? next(idx) : next;
    if (onStepChange) onStepChange(value);
    else setInternalIdx(value);
  };
  const [exiting, setExiting] = useState(false);

  // ESC anywhere = skip the whole tour
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') skip(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const total = PAGES.length;
  const page = PAGES[idx];
  const isLast = idx === total - 1;

  const skip = () => {
    setExiting(true);
    setTimeout(() => onDone?.(), 280);
  };
  const next = () => {
    if (isLast) { skip(); return; }
    setIdx(i => Math.min(total - 1, i + 1));
  };
  const prev = () => setIdx(i => Math.max(0, i - 1));

  // "Demo" CTA on the create page: fire the App-level callback so the
  // parent can pause the tour, open the CreateModal, and resume on close.
  // We do NOT call onDone here — that used to permanently end the tour
  // before the parent's pause-and-resume logic ever ran.
  const triggerDemo = () => {
    setExiting(true);
    setTimeout(() => {
      onOpenCreate?.();
    }, 280);
  };

  // Body text comes from i18n: tour.{pageId}_title / tour.{pageId}_body /
  // tour.{pageId}_hint (optional)
  const title = t(`tour.${page.id}_title`);
  const body  = t(`tour.${page.id}_body`);
  const hint  = t(`tour.${page.id}_hint`);

  const overlay = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9300,
        background: 'radial-gradient(circle at 50% 35%, var(--card) 0%, var(--bg) 75%)',
        animation: exiting ? 'bcOnbBgOut .28s ease forwards' : 'bcOnbBgIn .3s ease both',
        display: 'flex', flexDirection: 'column',
        fontFamily: "'Manrope', sans-serif",
        overflow: 'hidden',
      }}
    >
      <style>{CSS}</style>

      {/* Top chrome: step counter (left) + Skip (right) */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 24px',
        zIndex: 2,
      }}>
        <div style={{
          fontSize: 10, color: 'var(--dim)',
          letterSpacing: '.3em', textTransform: 'uppercase', fontWeight: 700,
        }}>
          {String(idx + 1).padStart(2, '0')} / {String(total).padStart(2, '0')} · {t(`tour.${page.kicker}`)}
        </div>
        <button onClick={skip} style={{
          padding: '8px 16px', borderRadius: 999,
          background: 'transparent', border: '1px solid var(--brd)',
          color: 'var(--dim)', cursor: 'pointer',
          fontFamily: "'Manrope',sans-serif", fontSize: 11, fontWeight: 700,
          letterSpacing: '.12em', textTransform: 'uppercase',
          WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
        }}>{t('tour.skip')}</button>
      </div>

      {/* Page body — re-mounts on every idx change for the enter animation */}
      <div key={idx} style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '72px 24px 120px',
        animation: 'bcOnbPageIn .45s cubic-bezier(.34,1.56,.64,1) both',
      }}>
        {/* Hero emoji */}
        <div style={{
          fontSize: 'clamp(96px, 22vw, 180px)',
          lineHeight: 1, marginBottom: 24,
          animation: 'bcOnbHeroEmoji 3s ease-in-out infinite',
          filter: 'drop-shadow(0 12px 36px var(--glow))',
        }}>{page.emoji}</div>

        {/* Italic Cormorant headline — broken-grid hero size */}
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: 'italic',
          fontSize: 'clamp(36px, 7vw, 72px)',
          fontWeight: 600,
          lineHeight: 1.02,
          letterSpacing: '-0.02em',
          color: 'var(--txt)',
          textAlign: 'center',
          maxWidth: 720,
          marginBottom: 18,
        }}>{title}</div>

        {/* Body copy — Manrope, generous line-height, dim */}
        <div style={{
          fontSize: 'clamp(14px, 2vw, 17px)',
          color: 'var(--dim)',
          lineHeight: 1.6,
          textAlign: 'center',
          maxWidth: 540,
          fontWeight: 500,
        }}>{body}</div>

        {/* Optional hint — small gold pill below the body when defined */}
        {hint && hint !== `tour.${page.id}_hint` && (
          <div style={{
            marginTop: 18, padding: '8px 14px', borderRadius: 999,
            background: 'var(--gold)18', border: '1px solid var(--gold)44',
            color: 'var(--gold)', fontSize: 11, fontWeight: 700,
            letterSpacing: '.06em', maxWidth: 520, textAlign: 'center',
          }}>{hint}</div>
        )}
      </div>

      {/* Bottom chrome: progress dots + nav buttons */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '20px 24px calc(20px + env(safe-area-inset-bottom))',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
        zIndex: 2,
      }}>
        {/* Dots — clickable for direct jumps */}
        <div style={{ display: 'flex', gap: 8 }}>
          {PAGES.map((p, i) => (
            <button key={p.id} onClick={() => setIdx(i)}
              aria-label={`Step ${i + 1}`}
              style={{
                width: i === idx ? 22 : 8, height: 8,
                borderRadius: 4, padding: 0, border: 'none',
                background: i === idx ? 'var(--gold)' : 'var(--brd)',
                cursor: 'pointer',
                transition: 'width .25s, background .25s',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}/>
          ))}
        </div>

        {/* Nav row */}
        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 480, justifyContent: 'center' }}>
          {idx > 0 && (
            <button onClick={prev} style={{
              padding: '12px 22px', borderRadius: 999,
              background: 'transparent', border: '1px solid var(--brd)',
              color: 'var(--dim)', cursor: 'pointer',
              fontFamily: "'Manrope',sans-serif", fontSize: 12, fontWeight: 700,
              letterSpacing: '.08em', textTransform: 'uppercase',
              WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            }}>← {t('tour.prev')}</button>
          )}
          {page.cta === 'demo' ? (
            <>
              <button onClick={triggerDemo} style={{
                padding: '12px 26px', borderRadius: 999, border: 'none',
                background: 'linear-gradient(90deg, var(--gold) 0%, var(--goldL) 50%, var(--gold) 100%)',
                backgroundSize: '200% 100%',
                animation: 'bcOnbShimmer 3s linear infinite',
                color: '#1a1530',
                cursor: 'pointer', flex: idx > 0 ? 'unset' : 1,
                fontFamily: "'Manrope',sans-serif", fontSize: 13, fontWeight: 800,
                letterSpacing: '.08em', textTransform: 'uppercase',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}>{t('tour.demo_open')}</button>
              <button onClick={next} style={{
                padding: '12px 22px', borderRadius: 999,
                background: 'transparent', border: '1px solid var(--brd)',
                color: 'var(--dim)', cursor: 'pointer',
                fontFamily: "'Manrope',sans-serif", fontSize: 12, fontWeight: 700,
                letterSpacing: '.08em', textTransform: 'uppercase',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}>{t('tour.next')} →</button>
            </>
          ) : (
            <button onClick={next} style={{
              padding: '12px 26px', borderRadius: 999, border: 'none',
              background: 'linear-gradient(90deg, var(--gold) 0%, var(--goldL) 50%, var(--gold) 100%)',
              backgroundSize: '200% 100%',
              animation: 'bcOnbShimmer 3s linear infinite',
              color: '#1a1530',
              cursor: 'pointer', flex: idx > 0 ? 'unset' : 1,
              fontFamily: "'Manrope',sans-serif", fontSize: 13, fontWeight: 800,
              letterSpacing: '.08em', textTransform: 'uppercase',
              WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            }}>{isLast ? `${t('tour.start_app')} →` : `${t('tour.next')} →`}</button>
          )}
        </div>
      </div>
    </div>
  );

  // Portal so the overlay escapes any parent transform context (the `sUp`
  // animation on view roots creates a containing block that would otherwise
  // pin position:fixed to the scrolled page).
  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay;
}
