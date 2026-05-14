import React, { useEffect, useMemo, useState } from 'react';
import { useLang } from '../i18n.js';

// "Editorial poster" splash v2 — concept B. Builds a layered intro:
//   1. Ambient gold glow + 24 sparkle particles drift outward
//   2. A heavier coin drops in, lands with a bounce, fires a confetti
//      burst of 8 secondary discs around it
//   3. The coin dissolves up into the wordmark — italic Cormorant
//      "BetCouple" appears letter-by-letter with a scale-bounce stagger
//   4. A gold rule draws left-to-right under the wordmark, then the
//      italic tagline fades in below
//   5. Fade out and unmount
// Total runtime ≈ 2.4s; tap-to-skip honored throughout. Every color
// derives from theme tokens so DARK / LIGHT / AMBER all stay coherent.

const CSS = `
@keyframes bcSplashBgIn   { from { opacity: 0 } to { opacity: 1 } }
@keyframes bcSplashFade   { to   { opacity: 0 } }
@keyframes bcAmbient      { 0%, 100% { transform: scale(1);   opacity: .55 }
                            50%      { transform: scale(1.15);opacity: .85 } }
@keyframes bcSparkleOut {
  0%   { transform: translate(-50%,-50%) rotate(var(--rot)) translateY(0)   scale(0); opacity: 0 }
  25%  { opacity: 1 }
  100% { transform: translate(-50%,-50%) rotate(var(--rot)) translateY(var(--dist)) scale(.6); opacity: 0 }
}
@keyframes bcCoinDrop {
  0%   { transform: translateY(-46vh) scale(.4) rotate(-8deg) rotateY(0deg);  opacity: 0 }
  55%  { transform: translateY(10px)  scale(1.1) rotate(2deg) rotateY(540deg); opacity: 1 }
  72%  { transform: translateY(-6px)  scale(.96) rotate(-1deg) rotateY(800deg);}
  100% { transform: translateY(0)     scale(1) rotate(0deg) rotateY(1080deg); opacity: 1 }
}
@keyframes bcCoinDissolve {
  0%   { transform: scale(1)   rotateY(0deg);   opacity: 1; filter: brightness(1) }
  40%  { transform: scale(1.5) rotateY(360deg); opacity: 1; filter: brightness(1.8) }
  100% { transform: scale(3.4) rotateY(720deg); opacity: 0; filter: brightness(2.3) }
}
@keyframes bcConfettiBurst {
  0%   { transform: translate(-50%,-50%) rotate(var(--rot)) translateY(0) scale(0); opacity: 0 }
  25%  { opacity: 1 }
  100% { transform: translate(-50%,-50%) rotate(var(--rot)) translateY(var(--dist)) scale(.5) rotate(calc(var(--rot) + 540deg)); opacity: 0 }
}
@keyframes bcLetterIn {
  0%   { transform: translateY(28px) scale(.55) rotate(-6deg); opacity: 0; filter: blur(8px) }
  60%  { transform: translateY(-6px) scale(1.12) rotate(2deg); opacity: 1; filter: blur(0) }
  100% { transform: translateY(0)    scale(1)    rotate(0deg); opacity: 1; filter: blur(0) }
}
@keyframes bcShimmer      { 0%   { background-position: -200% 0 }
                            100% { background-position:  200% 0 } }
@keyframes bcRuleDraw     { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes bcTaglineIn    { 0%   { opacity: 0; letter-spacing: .12em; transform: translateY(6px) }
                            100% { opacity: 1; letter-spacing: 0;     transform: translateY(0) } }
`;

// 24 sparkle particles arranged radially around the center. Each gets
// its own rotation + distance so they fan out asymmetrically rather
// than as a clean circle.
function buildSparkles() {
  const out = [];
  for (let i = 0; i < 24; i++) {
    out.push({
      rot: (i / 24) * 360 + (Math.random() - 0.5) * 12,
      dist: 110 + Math.random() * 90,
      size: 4 + Math.random() * 4,
      delay: Math.random() * 0.4,
      duration: 1.0 + Math.random() * 0.8,
    });
  }
  return out;
}

// 8 confetti discs that explode out of the coin at the dissolve moment.
function buildConfetti() {
  const out = [];
  for (let i = 0; i < 8; i++) {
    out.push({
      rot: (i / 8) * 360 + (Math.random() - 0.5) * 18,
      dist: 90 + Math.random() * 50,
      size: 8 + Math.random() * 6,
      duration: 0.55 + Math.random() * 0.2,
    });
  }
  return out;
}

export default function SplashScreen({ onDone, brand = 'BetCouple' }) {
  const { t } = useLang();
  // 0 = sparkles + coin drop, 1 = dissolve + confetti, 2 = wordmark,
  // 3 = rule + tagline, 4 = fade out
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800);   // coin dissolves into wordmark
    const t2 = setTimeout(() => setPhase(2), 1100);  // wordmark appears
    const t3 = setTimeout(() => setPhase(3), 1700);  // rule + tagline
    const t4 = setTimeout(() => setPhase(4), 2200);  // begin fade
    const t5 = setTimeout(() => onDone?.(), 2500);   // unmount
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout);
  }, [onDone]);

  const skip = () => onDone?.();
  const letters = useMemo(() => brand.split(''), [brand]);
  const sparkles = useMemo(buildSparkles, []);
  const confetti = useMemo(buildConfetti, []);

  return (
    <div
      onClick={skip}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        // Theme-aware backdrop with a deeper radial: a pool of gold
        // glow at the center fading to the bg color.
        background: 'radial-gradient(circle at 50% 48%, color-mix(in srgb, var(--gold) 12%, var(--card)) 0%, var(--bg) 65%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', userSelect: 'none',
        animation: phase >= 4 ? 'bcSplashFade .34s ease forwards' : 'bcSplashBgIn .25s ease both',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        overflow: 'hidden',
      }}
    >
      <style>{CSS}</style>

      {/* Ambient pulse — a soft radial behind everything that breathes. */}
      <div aria-hidden style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 520, height: 520, marginLeft: -260, marginTop: -260,
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--glow) 0%, transparent 65%)',
        animation: 'bcAmbient 3.2s ease-in-out infinite',
        pointerEvents: 'none',
      }}/>

      {/* Sparkle particles — fanned out radially. */}
      <div aria-hidden style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 0, height: 0, pointerEvents: 'none',
      }}>
        {sparkles.map((s, i) => (
          <span key={i} style={{
            position: 'absolute', top: 0, left: 0,
            width: s.size, height: s.size, borderRadius: '50%',
            background: 'var(--gold)',
            boxShadow: '0 0 8px var(--glow)',
            // eslint-disable-next-line no-undef
            ['--rot']: `${s.rot}deg`,
            ['--dist']: `${s.dist}px`,
            animation: `bcSparkleOut ${s.duration}s ease-out ${s.delay}s both`,
            willChange: 'transform, opacity',
          }}/>
        ))}
      </div>

      {/* Stage — fixed footprint so the wordmark doesn't shift when the
          coin leaves. */}
      <div style={{
        position: 'relative',
        width: 260, height: 260,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 22,
      }}>
        {/* Coin — drops in, then dissolves up into the wordmark. */}
        {phase < 2 && (
          <div style={{
            position: 'relative',
            width: 130, height: 130, borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, var(--goldL) 0%, var(--gold) 55%, color-mix(in srgb, var(--gold) 70%, #000) 100%)`,
            boxShadow: '0 18px 44px -10px var(--glow), 0 0 32px var(--glow), inset 0 -10px 18px rgba(0,0,0,.28), inset 0 6px 14px rgba(255,255,255,.28)',
            animation: phase === 0
              ? 'bcCoinDrop .8s cubic-bezier(.32,1.6,.42,1) both'
              : 'bcCoinDissolve .4s ease-in forwards',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 66, fontStyle: 'italic', fontWeight: 700,
            color: 'color-mix(in srgb, var(--bg) 70%, #000)',
            textShadow: '0 1px 0 rgba(255,255,255,.35)',
            letterSpacing: '-0.02em',
            willChange: 'transform, opacity',
            transformStyle: 'preserve-3d',
          }}>
            &amp;
          </div>
        )}

        {/* Confetti burst — 8 secondary discs flung out when the coin
            dissolves. Fires only during the dissolve phase. */}
        {phase === 1 && (
          <div aria-hidden style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 0, height: 0, pointerEvents: 'none',
          }}>
            {confetti.map((c, i) => (
              <span key={i} style={{
                position: 'absolute', top: 0, left: 0,
                width: c.size, height: c.size, borderRadius: '50%',
                background: 'var(--gold)',
                boxShadow: '0 0 10px var(--glow)',
                // eslint-disable-next-line no-undef
                ['--rot']: `${c.rot}deg`,
                ['--dist']: `${c.dist}px`,
                animation: `bcConfettiBurst ${c.duration}s ease-out both`,
              }}/>
            ))}
          </div>
        )}

        {/* Wordmark — letter-by-letter scale-bounce reveal. */}
        {phase >= 2 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: 'italic',
            fontSize: 'clamp(48px, 11vw, 72px)',
            fontWeight: 600, letterSpacing: '-0.025em',
            background: 'linear-gradient(90deg, var(--gold) 0%, var(--goldL) 50%, var(--gold) 100%)',
            backgroundSize: '200% 100%',
            WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'bcShimmer 2.8s linear infinite',
            whiteSpace: 'nowrap',
          }}>
            {letters.map((ch, i) => (
              <span key={i} style={{
                display: 'inline-block',
                animation: `bcLetterIn .55s cubic-bezier(.34,1.6,.4,1) ${i * 55}ms both`,
              }}>{ch === ' ' ? ' ' : ch}</span>
            ))}
          </div>
        )}
      </div>

      {/* Gold rule + tagline — drawn after the wordmark settles. */}
      {phase >= 3 && (
        <>
          <div aria-hidden style={{
            width: 'min(320px, 60vw)', height: 1,
            background: 'linear-gradient(90deg, transparent 0%, var(--gold) 50%, transparent 100%)',
            transformOrigin: 'center',
            animation: 'bcRuleDraw .55s cubic-bezier(.4,1.05,.5,1) both',
            marginBottom: 14,
            opacity: .7,
          }}/>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
            fontSize: 14, color: 'var(--dim)',
            fontWeight: 500, letterSpacing: '.02em', textAlign: 'center',
            animation: 'bcTaglineIn .55s cubic-bezier(.34,1.2,.4,1) .15s both',
            maxWidth: 320, lineHeight: 1.4,
          }}>
            {t('splash.tagline')}
          </div>
        </>
      )}

      {/* Skip hint — bottom edge, dim enough that returning users
          don't read it every single time. */}
      <div style={{
        position: 'absolute', bottom: 22, fontSize: 9,
        color: 'var(--mut)', letterSpacing: '.22em',
        fontFamily: "'Manrope', sans-serif",
        textTransform: 'uppercase', opacity: .5,
      }}>
        {t('splash.tap_skip')}
      </div>
    </div>
  );
}
