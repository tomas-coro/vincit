import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../../i18n.js';

// Concept-A coachmark sequence for the CreateModal. Ten steps walk the user
// through making their first bet: intro card → title → four type sub-steps
// (vault/open/targeted/surprise) → stake → win → submit → help (points at
// the "?" button so the user knows the tutorial is always re-openable).
// Each non-intro step measures a target element inside the modal via
// [data-coach="..."], dims everything else with a box-shadow "cutout",
// floats an italic Cormorant bubble next to it with an animated gold arrow
// pointing in. Auto-scrolls the target into view if it's out of bounds.

const STEPS = [
  // First step is a centered intro card with no target.
  { target: null,            place: 'center' },
  { target: 'title',         place: 'bottom' },
  // Four sub-steps, each spotlighting only the chip for that specific
  // bet type so the eye is drawn to the *name*, not the whole selector.
  { target: 'type-vault',    place: 'bottom' },
  { target: 'type-open',     place: 'bottom' },
  { target: 'type-targeted', place: 'bottom' },
  { target: 'type-surprise', place: 'bottom' },
  { target: 'stake',         place: 'bottom' },
  { target: 'win',           place: 'bottom' },
  { target: 'submit',        place: 'top'    },
  // Templates intro — points at the "Save as template" button so the
  // user knows recurring bets can be one-tap reloads next time.
  { target: 'save-template', place: 'top'    },
  // Final step points at the always-available "?" trigger in the header.
  { target: 'help',          place: 'bottom' },
];

const CSS = `
@keyframes bcCoachFadeIn  { from { opacity: 0 } to { opacity: 1 } }
@keyframes bcCoachFadeOut { to   { opacity: 0 } }
@keyframes bcCoachBubble  {
  0%   { opacity: 0; transform: translateY(var(--bubble-shift, 8px)) scale(.96) }
  100% { opacity: 1; transform: translateY(0) scale(1) }
}
@keyframes bcCoachArrow   {
  0%,100% { transform: translate(var(--arrow-tx, 0), var(--arrow-ty, 0)) }
  50%     { transform: translate(var(--arrow-tx, 0), calc(var(--arrow-ty, 0px) + var(--arrow-bounce, 6px))) }
}
@keyframes bcCoachCutoutIn { from { opacity: 0 } to { opacity: 1 } }
`;

const PAD = 10;          // spotlight padding around the target
const BUBBLE_W = 320;    // bubble fixed width (clamped to viewport on small)
const BUBBLE_GAP = 22;   // gap between spotlight edge and bubble

export default function CreateModalCoachmarks({ open, onClose }) {
  const { t } = useLang();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const [exiting, setExiting] = useState(false);
  const measureTickRef = useRef(0);

  // Reset to first step every time it opens. We use a key on the bubble
  // below to re-trigger the enter animation per step.
  useEffect(() => {
    if (open) { setStep(0); setExiting(false); }
  }, [open]);

  // Track-target loop: re-measure the spotlight rect on step change, on
  // window resize, on any scroll (capture-phase catches nested scroll
  // containers without a ref), and on the target's own size changes via
  // ResizeObserver. The previous 250ms setInterval was the main source
  // of mobile stutter — it forced a getBoundingClientRect + setState
  // four times a second even when nothing changed.
  useLayoutEffect(() => {
    if (!open) { setRect(null); return; }
    const s = STEPS[step];
    if (!s.target) { setRect(null); return; }

    let cancelled = false;
    let didScroll = false;
    let raf = 0;

    const measure = () => {
      if (cancelled) return;
      // Coalesce bursts (scroll/resize fire many events) into one rAF.
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (cancelled) return;
        const el = document.querySelector(`[data-coach="${s.target}"]`);
        if (!el) { setRect(null); return; }
        const r = el.getBoundingClientRect();
        // Scroll into view if visibly clipped — once per step, so we
        // don't fight the user if they scrolled away on purpose.
        if (!didScroll && (r.top < 80 || r.bottom > window.innerHeight - 220)) {
          didScroll = true;
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          setTimeout(measure, 420);
          return;
        }
        setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
      });
    };

    measure();

    const targetEl = document.querySelector(`[data-coach="${s.target}"]`);
    let ro = null;
    if (targetEl && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(targetEl);
    }
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { capture: true, passive: true });

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, { capture: true });
    };
  }, [open, step]);

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const s = STEPS[step];
  const stepKey = [
    'intro', 'title',
    'type_vault', 'type_open', 'type_targeted', 'type_surprise',
    'stake', 'win', 'submit', 'templates', 'help',
  ][step];

  const goNext = () => {
    if (isLast) { close(); return; }
    setStep(i => Math.min(STEPS.length - 1, i + 1));
  };
  const goPrev = () => setStep(i => Math.max(0, i - 1));
  const close = () => {
    setExiting(true);
    setTimeout(() => onClose?.(), 260);
  };

  // Bubble placement — based on the target rect and `place` hint. Falls
  // back to centered if there's no target (intro step).
  const vw = typeof window !== 'undefined' ? window.innerWidth  : 360;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 640;
  const bubbleW = Math.min(BUBBLE_W, vw - 32);

  let bubbleStyle, arrowStyle, arrowChar;
  if (!rect) {
    // Centered intro card
    bubbleStyle = {
      left: vw / 2 - bubbleW / 2,
      top: vh * 0.32,
      width: bubbleW,
    };
    arrowStyle = { display: 'none' };
    arrowChar = '';
  } else {
    const cx = Math.max(16, Math.min(vw - bubbleW - 16, rect.x + rect.w / 2 - bubbleW / 2));
    if (s.place === 'top') {
      // Bubble above the target, arrow points down
      const bubbleH = 180; // approximate
      const top = Math.max(16, rect.y - bubbleH - BUBBLE_GAP);
      bubbleStyle = { left: cx, top, width: bubbleW };
      arrowStyle = {
        left: rect.x + rect.w / 2 - 12,
        top: top + bubbleH + 6,
        '--arrow-tx': '0px', '--arrow-ty': '0px', '--arrow-bounce': '6px',
      };
      arrowChar = '▼';
    } else {
      // Default: bubble below, arrow points up
      const top = Math.min(vh - 220, rect.y + rect.h + BUBBLE_GAP);
      bubbleStyle = { left: cx, top, width: bubbleW };
      arrowStyle = {
        left: rect.x + rect.w / 2 - 12,
        top: top - 26,
        '--arrow-tx': '0px', '--arrow-ty': '0px', '--arrow-bounce': '-6px',
      };
      arrowChar = '▲';
    }
  }

  const overlay = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9800,
      animation: exiting ? 'bcCoachFadeOut .22s ease forwards' : 'bcCoachFadeIn .25s ease both',
      pointerEvents: 'auto',
    }}>
      <style>{CSS}</style>

      {/* Backdrop + spotlight cutout. When `rect` is null (intro step) we
          just dim the entire screen; otherwise the spotlight is rendered
          as a div whose huge box-shadow paints everything *outside* it
          dark, creating the cutout effect with zero SVG/canvas.
          The cutout SNAPS between steps instead of transitioning its
          geometry — animating left/top/width/height while repainting a
          9999px box-shadow is brutally expensive on mobile. A brief
          opacity fade-in (via `key={step}`) keeps step transitions from
          feeling abrupt without paying the perf cost. */}
      {rect ? (
        <div key={step} style={{
          position: 'fixed',
          left: rect.x - PAD, top: rect.y - PAD,
          width: rect.w + PAD * 2, height: rect.h + PAD * 2,
          borderRadius: 12,
          boxShadow: '0 0 0 9999px rgba(10,8,22,.78), 0 0 0 2px var(--gold), 0 0 22px var(--glow)',
          pointerEvents: 'none',
          willChange: 'opacity',
          animation: 'bcCoachCutoutIn .18s ease both',
        }}/>
      ) : (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10,8,22,.78)',
          pointerEvents: 'auto',
        }} onClick={close}/>
      )}

      {/* Arrow — gold caret bouncing between bubble and spotlight */}
      <div style={{
        position: 'fixed', fontSize: 24, lineHeight: 1,
        color: 'var(--gold)', pointerEvents: 'none',
        textShadow: '0 0 12px var(--glow)',
        animation: 'bcCoachArrow 1.2s ease-in-out infinite',
        ...arrowStyle,
      }}>{arrowChar}</div>

      {/* Bubble */}
      <div key={stepKey} style={{
        position: 'fixed',
        background: 'linear-gradient(180deg, var(--surf), var(--card))',
        border: '1px solid var(--gold)55',
        borderRadius: 14,
        padding: '18px 20px 16px',
        boxShadow: '0 18px 50px rgba(0,0,0,.55), 0 0 0 1px var(--gold)22',
        fontFamily: "'Manrope', sans-serif",
        animation: 'bcCoachBubble .35s cubic-bezier(.34,1.56,.64,1) both',
        ...bubbleStyle,
      }}>
        {/* Kicker — step counter + tracked label */}
        <div style={{
          fontSize: 9, color: 'var(--gold)',
          letterSpacing: '.28em', textTransform: 'uppercase', fontWeight: 800,
          marginBottom: 8,
        }}>
          {String(step + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')} · {t(`coach.${stepKey}_kicker`)}
        </div>

        {/* Title — italic Cormorant */}
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: 'italic',
          fontSize: 22, fontWeight: 600,
          color: 'var(--txt)', lineHeight: 1.15,
          marginBottom: 8,
          letterSpacing: '-0.01em',
        }}>{t(`coach.${stepKey}_title`)}</div>

        {/* Body — `pre-line` so i18n strings can include explicit \n
            paragraph breaks (e.g. intro). */}
        <div style={{
          fontSize: 13, color: 'var(--dim)',
          lineHeight: 1.5, marginBottom: 16,
          whiteSpace: 'pre-line',
        }}>{t(`coach.${stepKey}_body`)}</div>

        {/* Nav row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10,
        }}>
          <button onClick={close} style={{
            padding: '6px 0', background: 'transparent', border: 'none',
            color: 'var(--mut)', cursor: 'pointer',
            fontFamily: "'Manrope',sans-serif", fontSize: 10, fontWeight: 700,
            letterSpacing: '.18em', textTransform: 'uppercase',
            WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
          }}>{t('coach.skip')}</button>

          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button onClick={goPrev} style={{
                padding: '8px 14px', borderRadius: 999,
                background: 'transparent', border: '1px solid var(--brd)',
                color: 'var(--dim)', cursor: 'pointer',
                fontFamily: "'Manrope',sans-serif", fontSize: 11, fontWeight: 700,
                letterSpacing: '.1em', textTransform: 'uppercase',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}>← {t('coach.prev')}</button>
            )}
            <button onClick={goNext} style={{
              padding: '8px 16px', borderRadius: 999, border: 'none',
              background: 'var(--gold)', color: '#1a1530',
              cursor: 'pointer',
              fontFamily: "'Manrope',sans-serif", fontSize: 12, fontWeight: 800,
              letterSpacing: '.08em', textTransform: 'uppercase',
              WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            }}>{isLast ? t('coach.done') : t('coach.next') + ' →'}</button>
          </div>
        </div>

        {/* Progress dots */}
        <div style={{
          display: 'flex', gap: 6, justifyContent: 'center',
          marginTop: 14, paddingTop: 12,
          borderTop: '1px solid var(--rule)',
        }}>
          {STEPS.map((_, i) => (
            <span key={i} style={{
              width: i === step ? 18 : 6, height: 6, borderRadius: 3,
              background: i === step ? 'var(--gold)' : 'var(--brd)',
              transition: 'width .25s, background .25s',
            }}/>
          ))}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay;
}
