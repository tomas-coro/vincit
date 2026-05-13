import React, { useEffect, useMemo, useState } from 'react';

// Fire easter egg — concept "Fire-2" (🔥 emoji rain): the visual twin of
// IceEggOverlay's snowfall but with DOM emoji instead of canvas. Triple-tap
// the 🔥 in the win-streak pill triggers it. Three elements:
//  1. A giant 🔥 at the center that pulses + grows like the snowflake does.
//  2. 40 falling 🔥 emoji at random x positions, random sizes, with each
//     one driven by the same CSS keyframe but with its own duration / delay
//     / rotation drift via inline style. DOM emoji are crisp on retina,
//     work cross-platform, and outperform 80 canvas particles on low-end
//     phones (no per-frame fillRect math).
//  3. Warm tint gradients sliding in from each edge — mirror of the ice
//     frost so the two overlays read as a matched pair.
// Total runtime ~3s; tap-to-skip honored.

const CSS = `
@keyframes bcFireBgIn   { from { opacity: 0 } to { opacity: 1 } }
@keyframes bcFireBgOut  { to   { opacity: 0 } }
@keyframes bcFireHeroIn {
  0%   { transform: translate(-50%,-50%) scale(.2) rotate(0deg);    opacity: 0; filter: drop-shadow(0 0 0 #f80); }
  35%  { transform: translate(-50%,-50%) scale(1.15) rotate(-12deg); opacity: 1; filter: drop-shadow(0 -10px 40px #f60); }
  100% { transform: translate(-50%,-50%) scale(1) rotate(0deg);     opacity: 1; filter: drop-shadow(0 -8px 26px #f90); }
}
@keyframes bcFireHeroFlick {
  0%, 100% { filter: drop-shadow(0 -10px 30px rgba(255,140,40,.85)); transform: translate(-50%,-50%) scale(1) }
  50%      { filter: drop-shadow(0 -14px 55px rgba(255,200,80,1));   transform: translate(-50%,-50%) scale(1.05) }
}
@keyframes bcFireHeroExit {
  to { transform: translate(-50%,-50%) scale(2.4) rotate(-18deg); opacity: 0; filter: drop-shadow(0 0 0 #f00); }
}
@keyframes bcFireRain {
  0%   { transform: translateY(-22vh) rotate(0deg); opacity: 0 }
  12%  { opacity: 1 }
  88%  { opacity: 1 }
  100% { transform: translateY(118vh) rotate(var(--rot, 220deg)); opacity: 0 }
}
@keyframes bcFireGlowTop    { from { transform: translateY(-100%) } to { transform: translateY(0) } }
@keyframes bcFireGlowBottom { from { transform: translateY( 100%) } to { transform: translateY(0) } }
@keyframes bcFireGlowLeft   { from { transform: translateX(-100%) } to { transform: translateX(0) } }
@keyframes bcFireGlowRight  { from { transform: translateX( 100%) } to { transform: translateX(0) } }
`;

// Pre-built array of 40 falling-emoji configs. Useful to compute ONCE per
// overlay open (via useMemo) so React doesn't roll new random numbers on
// every render mid-animation, which would visibly snap the emojis around.
function buildEmberConfigs() {
  const out = [];
  for (let i = 0; i < 40; i++) {
    out.push({
      x: Math.random() * 100,                 // %
      size: 16 + Math.random() * 22,          // px
      delay: Math.random() * 1.0,             // s — staggered entrance
      duration: 1.8 + Math.random() * 1.4,    // s
      rot: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 240), // deg
      opacity: 0.7 + Math.random() * 0.3,
    });
  }
  return out;
}

export default function PhoenixEggOverlay({ open, onClose }) {
  const [phase, setPhase] = useState(0); // 0 = entering, 1 = settled, 2 = exiting

  // Phase scheduler — same timing as IceEggOverlay so the two eggs feel like a pair
  useEffect(() => {
    if (!open) return;
    setPhase(0);
    const t1 = setTimeout(() => setPhase(1), 700);
    const t2 = setTimeout(() => setPhase(2), 2400);
    const t3 = setTimeout(() => onClose?.(), 3000);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [open, onClose]);

  // Build the random-emoji configs ONCE per open cycle. The `open` flag is
  // a fine dep here: every time the overlay opens we get a fresh shower,
  // but the configs stay stable for the lifetime of that opening.
  const embers = useMemo(() => buildEmberConfigs(), [open]);

  if (!open) return null;
  const fading = phase === 2;

  // Warm tint — same shape as the ice frost but amber/red.
  const tintVertical    = 'linear-gradient(180deg, rgba(255,120,40,.45) 0%, rgba(220,70,20,.18) 60%, rgba(180,60,15,0) 100%)';
  const tintHorizontalL = 'linear-gradient(90deg, rgba(255,140,50,.4) 0%, rgba(220,70,20,0) 100%)';
  const tintHorizontalR = 'linear-gradient(270deg, rgba(255,140,50,.4) 0%, rgba(220,70,20,0) 100%)';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9700,
        background: 'radial-gradient(circle at 50% 65%, rgba(180,60,15,.55) 0%, rgba(30,10,5,.92) 80%)',
        animation: fading
          ? 'bcFireBgOut .6s ease forwards'
          : 'bcFireBgIn .35s ease forwards',
        cursor: 'pointer', userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <style>{CSS}</style>

      {/* Falling 🔥 emoji rain — DOM elements, each driven by the shared
          bcFireRain keyframe but with per-emoji duration/delay/rotation
          baked into inline style. `pointerEvents: none` on the wrapper so
          taps fall through to the overlay's onClose. */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
      }}>
        {embers.map((e, i) => (
          <span key={i} style={{
            position: 'absolute',
            left: `${e.x}%`, top: 0,
            fontSize: e.size,
            lineHeight: 1,
            opacity: e.opacity,
            animation: `bcFireRain ${e.duration}s linear ${e.delay}s infinite`,
            // CSS custom property — typed any to satisfy React's style
            // signature; the keyframe consumes it via var(--rot).
            ['--rot']: `${e.rot}deg`,
            willChange: 'transform, opacity',
            filter: 'drop-shadow(0 0 6px rgba(255,140,40,.55))',
          }}>🔥</span>
        ))}
      </div>

      {/* Edge tints — sliding in from each side, mirroring the ice frost */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '38%',
        background: tintVertical,
        animation: 'bcFireGlowTop .9s cubic-bezier(.4,1.2,.5,1) both',
        pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '32%',
        background: tintVertical,
        transform: 'scaleY(-1)',
        animation: 'bcFireGlowBottom .9s cubic-bezier(.4,1.2,.5,1) .1s both',
        pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, width: '22%',
        background: tintHorizontalL,
        animation: 'bcFireGlowLeft 1.1s cubic-bezier(.4,1.2,.5,1) .15s both',
        pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', top: 0, bottom: 0, right: 0, width: '22%',
        background: tintHorizontalR,
        animation: 'bcFireGlowRight 1.1s cubic-bezier(.4,1.2,.5,1) .15s both',
        pointerEvents: 'none',
      }}/>

      {/* The hero flame — center stage, twin of the giant ❄️ */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        fontSize: 200, lineHeight: 1,
        animation: fading
          ? 'bcFireHeroExit .6s ease-in forwards'
          : 'bcFireHeroIn 1s cubic-bezier(.2,1.4,.3,1) forwards, bcFireHeroFlick 1.5s ease-in-out 1s infinite',
        pointerEvents: 'none',
      }}>
        🔥
      </div>

      {/* Skip hint */}
      <div style={{
        position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        fontSize: 10, letterSpacing: '.25em', textTransform: 'uppercase',
        color: 'rgba(255,210,160,.7)', fontFamily: "'Manrope', sans-serif",
        fontWeight: 600,
      }}>tap per chiudere</div>
    </div>
  );
}
