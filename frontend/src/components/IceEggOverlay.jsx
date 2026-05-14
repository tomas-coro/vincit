import React, { useEffect, useMemo, useState } from 'react';

// Ice easter egg — "Blizzard-3" concept. Mirror of the Phoenix overlay
// (which rises from the bottom): here the storm comes from ABOVE,
// snowflakes raining down + frost wall descending from the top edge
// until the screen is fully iced over.
//
// Composition (back → front):
//   1. Dark backdrop that cools to icy blue as the wall descends
//   2. Three stacked frost-gradient bands descending from the top edge
//      at different speeds, layered deep-blue → ice-blue → near-white
//      so the column reads as having depth instead of a flat sheet
//   3. 60 ❄️ emoji raining down with per-flake size / drift / rotation
//   4. Hero snowflake descending from off-screen-top into center
//      with a chunky scale-and-settle on arrival
//   5. Quick skip hint, dismiss-on-tap
// Runtime ~3.2s. Tap-to-skip honored throughout.

const CSS = `
@keyframes bcIceBgIn   { from { opacity: 0 } to { opacity: 1 } }
@keyframes bcIceBgOut  { to   { opacity: 0 } }
@keyframes bcIceWall   {
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(0%);    }
}
@keyframes bcIceFall   {
  0%   { transform: translate3d(0, -10vh, 0) scale(.4) rotate(0deg);   opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translate3d(var(--dx, 0), 120vh, 0) scale(1.15) rotate(var(--rot, 540deg)); opacity: 0; }
}
@keyframes bcIceHeroDescend {
  0%   { transform: translate(-50%, calc(-50vh - 200px)) scale(.4) rotate(0deg);    opacity: 0; filter: drop-shadow(0 0 0 #aef); }
  55%  { transform: translate(-50%, calc(-50% + 30px))  scale(1.25) rotate(540deg); opacity: 1; filter: drop-shadow(0 16px 60px #bef); }
  80%  { transform: translate(-50%, -50%) scale(.95) rotate(1080deg);                opacity: 1; filter: drop-shadow(0 12px 40px #cef); }
  100% { transform: translate(-50%, -50%) scale(1) rotate(1440deg);                  opacity: 1; filter: drop-shadow(0 10px 32px #aef); }
}
@keyframes bcIceHeroShimmer {
  0%, 100% { filter: drop-shadow(0 12px 36px rgba(190,230,255,.85)); transform: translate(-50%,-50%) scale(1) rotate(1440deg); }
  50%      { filter: drop-shadow(0 16px 60px rgba(225,245,255,1));   transform: translate(-50%,-50%) scale(1.06) rotate(1620deg); }
}
@keyframes bcIceHeroExit {
  to { transform: translate(-50%,-50%) scale(2.6) rotate(2160deg); opacity: 0; filter: drop-shadow(0 0 0 #aef); }
}
@keyframes bcIceShiver {
  0%, 100% { transform: translate(0, 0); }
  20%      { transform: translate(2px, -1px); }
  40%      { transform: translate(-2px, 1px); }
  60%      { transform: translate(1px, -2px); }
  80%      { transform: translate(-1px, 2px); }
}
`;

// 60 falling snowflakes — thin vertical streaks like sleet.
function buildFlakeConfigs() {
  const out = [];
  for (let i = 0; i < 60; i++) {
    out.push({
      x: Math.random() * 100,                        // %
      size: 14 + Math.random() * 28,                 // px
      delay: Math.random() * 1.4,                    // s — staggered fall
      duration: 2.0 + Math.random() * 2.0,           // s — snow falls slower than fire rises
      rot: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360),
      dx:  (Math.random() - 0.5) * 14 + 'vw',        // sideways drift
      opacity: 0.7 + Math.random() * 0.3,
    });
  }
  return out;
}

export default function IceEggOverlay({ open, onClose }) {
  const [phase, setPhase] = useState(0); // 0 = falling, 1 = settled, 2 = exiting

  useEffect(() => {
    if (!open) return;
    setPhase(0);
    const t1 = setTimeout(() => setPhase(1), 900);
    const t2 = setTimeout(() => setPhase(2), 2600);
    const t3 = setTimeout(() => onClose?.(), 3200);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [open, onClose]);

  const flakes = useMemo(() => buildFlakeConfigs(), [open]);

  if (!open) return null;
  const fading = phase === 2;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9700,
        background: 'radial-gradient(circle at 50% -10%, rgba(140,200,255,.55) 0%, rgba(20,30,55,.94) 75%)',
        animation: fading
          ? 'bcIceBgOut .55s ease forwards'
          : 'bcIceBgIn .35s ease forwards, bcIceShiver .42s ease-in-out 1',
        cursor: 'pointer', userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <style>{CSS}</style>

      {/* Frost wall — three stacked gradient bands descending from the
          top edge at different speeds. Together they read as a single
          curtain of ice engulfing the upper half then sliding down to
          fill the frame, mirror of the Phoenix fire wall. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0,
        height: '120vh',
        background: 'linear-gradient(180deg, rgba(60,110,180,.95) 0%, rgba(140,200,255,.65) 30%, rgba(220,240,255,.25) 65%, transparent 100%)',
        animation: 'bcIceWall 1.6s cubic-bezier(.25, .9, .3, 1) both',
        pointerEvents: 'none',
        filter: 'blur(2px)',
      }}/>
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0,
        height: '95vh',
        background: 'linear-gradient(180deg, rgba(160,220,255,.85) 0%, rgba(220,240,255,.45) 50%, transparent 100%)',
        animation: 'bcIceWall 1.25s cubic-bezier(.2, .95, .25, 1) .12s both',
        pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0,
        height: '60vh',
        background: 'linear-gradient(180deg, rgba(245,250,255,.85) 0%, rgba(220,240,255,.5) 50%, transparent 100%)',
        animation: 'bcIceWall .95s cubic-bezier(.15, 1, .2, 1) .22s both',
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}/>

      {/* Snowfall — ❄️ emojis raining from above the fold down past the
          bottom edge. `--rot` and `--dx` are per-flake CSS vars so one
          keyframe powers all 60. */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {flakes.map((f, i) => (
          <span key={i} style={{
            position: 'absolute',
            left: `${f.x}%`, top: 0,
            fontSize: f.size,
            lineHeight: 1,
            opacity: f.opacity,
            animation: `bcIceFall ${f.duration}s ease-in ${f.delay}s infinite`,
            // eslint-disable-next-line no-undef
            ['--rot']: `${f.rot}deg`,
            ['--dx']: f.dx,
            willChange: 'transform, opacity',
            filter: 'drop-shadow(0 0 8px rgba(180,220,255,.7))',
          }}>❄️</span>
        ))}
      </div>

      {/* Hero snowflake — descends from above with a punchy scale-overshoot
          landing, then idles with the same shimmer shadow loop as the
          Phoenix's flicker. */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        fontSize: 220, lineHeight: 1,
        animation: fading
          ? 'bcIceHeroExit .55s ease-in forwards'
          : 'bcIceHeroDescend 1.05s cubic-bezier(.18,1.5,.3,1) forwards, bcIceHeroShimmer 1.4s ease-in-out 1.1s infinite',
        pointerEvents: 'none',
      }}>❄️</div>

      {/* Skip hint */}
      <div style={{
        position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        fontSize: 10, letterSpacing: '.25em', textTransform: 'uppercase',
        color: 'rgba(220,240,255,.7)', fontFamily: "'Manrope', sans-serif",
        fontWeight: 600,
      }}>tap per chiudere</div>
    </div>
  );
}
