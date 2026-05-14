import React, { useEffect, useMemo, useState } from 'react';

// Fire easter egg — "Inferno-3" concept. Replaces the earlier emoji-rain
// version. The fire is meant to FEEL like it's rising out from underneath
// the user's feet and engulfing the screen, not raining down from above.
//
// Composition (back → front):
//   1. Dark backdrop that warms up as the wall rises
//   2. Three stacked fire-gradient bands rising from the bottom edge at
//      different speeds, layered red→orange→yellow so the column reads
//      as having depth instead of a flat sheet
//   3. 50+ 🔥 emoji shooting upward from below the fold, each with its
//      own random horizontal jitter, scale, duration and rotation
//   4. Hero flame ascending from off-screen-bottom into the middle,
//      with a chunky scale-and-settle on arrival
//   5. Quick skip hint, dismiss-on-tap
// Runtime ~3.2s. Tap-to-skip honored throughout.

const CSS = `
@keyframes bcFireBgIn   { from { opacity: 0 } to { opacity: 1 } }
@keyframes bcFireBgOut  { to   { opacity: 0 } }
@keyframes bcFireWall   {
  0%   { transform: translateY(100%); }
  100% { transform: translateY(0%);   }
}
@keyframes bcFireRise   {
  0%   { transform: translate3d(0, 10vh, 0) scale(.4) rotate(0deg);    opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translate3d(var(--dx, 0), -120vh, 0) scale(1.15) rotate(var(--rot, 180deg)); opacity: 0; }
}
@keyframes bcFireHeroAscend {
  0%   { transform: translate(-50%, calc(50vh + 200px)) scale(.4) rotate(0deg);   opacity: 0; filter: drop-shadow(0 0 0 #f60); }
  55%  { transform: translate(-50%, calc(-50% - 30px)) scale(1.25) rotate(-10deg); opacity: 1; filter: drop-shadow(0 -16px 60px #f80); }
  80%  { transform: translate(-50%, -50%) scale(.95) rotate(2deg);                 opacity: 1; filter: drop-shadow(0 -12px 40px #fa0); }
  100% { transform: translate(-50%, -50%) scale(1) rotate(0deg);                   opacity: 1; filter: drop-shadow(0 -10px 32px #f80); }
}
@keyframes bcFireHeroFlick {
  0%, 100% { filter: drop-shadow(0 -12px 36px rgba(255,140,40,.85)); transform: translate(-50%,-50%) scale(1) }
  50%      { filter: drop-shadow(0 -16px 60px rgba(255,210,80,1));   transform: translate(-50%,-50%) scale(1.06) }
}
@keyframes bcFireHeroExit {
  to { transform: translate(-50%,-50%) scale(2.6) rotate(-22deg); opacity: 0; filter: drop-shadow(0 0 0 #f00); }
}
@keyframes bcFireShake {
  0%, 100% { transform: translate(0, 0); }
  20%      { transform: translate(-2px, 1px); }
  40%      { transform: translate(2px, -1px); }
  60%      { transform: translate(-1px, 2px); }
  80%      { transform: translate(1px, -2px); }
}
`;

// 60 rising fire emojis. More than the old version because each one is
// thinner (vertical streak) instead of a fat falling rain drop.
function buildEmberConfigs() {
  const out = [];
  for (let i = 0; i < 60; i++) {
    out.push({
      x: Math.random() * 100,                       // %
      size: 14 + Math.random() * 30,                // px
      delay: Math.random() * 1.3,                   // s — staggered ignition
      duration: 1.6 + Math.random() * 1.8,          // s
      rot: (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 240),
      dx:  (Math.random() - 0.5) * 18 + 'vw',       // slight horizontal drift on the way up
      opacity: 0.7 + Math.random() * 0.3,
    });
  }
  return out;
}

export default function PhoenixEggOverlay({ open, onClose }) {
  const [phase, setPhase] = useState(0); // 0 = rising, 1 = settled, 2 = exiting

  useEffect(() => {
    if (!open) return;
    setPhase(0);
    const t1 = setTimeout(() => setPhase(1), 900);
    const t2 = setTimeout(() => setPhase(2), 2600);
    const t3 = setTimeout(() => onClose?.(), 3200);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [open, onClose]);

  const embers = useMemo(() => buildEmberConfigs(), [open]);

  if (!open) return null;
  const fading = phase === 2;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9700,
        background: 'radial-gradient(circle at 50% 110%, rgba(255,120,40,.55) 0%, rgba(40,12,5,.94) 75%)',
        animation: fading
          ? 'bcFireBgOut .55s ease forwards'
          : 'bcFireBgIn .35s ease forwards, bcFireShake .42s ease-in-out 1',
        cursor: 'pointer', userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <style>{CSS}</style>

      {/* Fire wall — three stacked gradient bands rising from the bottom
          edge at different speeds. Together they read as a single column
          of fire engulfing the lower half then climbing to fill the
          frame, instead of a flat overlay sliding up. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: '120vh',
        background: 'linear-gradient(0deg, rgba(140,30,10,.95) 0%, rgba(220,80,20,.65) 30%, rgba(255,160,60,.25) 65%, transparent 100%)',
        animation: 'bcFireWall 1.6s cubic-bezier(.25, .9, .3, 1) both',
        pointerEvents: 'none',
        filter: 'blur(2px)',
      }}/>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: '95vh',
        background: 'linear-gradient(0deg, rgba(255,90,20,.85) 0%, rgba(255,160,60,.45) 50%, transparent 100%)',
        animation: 'bcFireWall 1.25s cubic-bezier(.2, .95, .25, 1) .12s both',
        pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: '60vh',
        background: 'linear-gradient(0deg, rgba(255,220,120,.85) 0%, rgba(255,160,60,.5) 50%, transparent 100%)',
        animation: 'bcFireWall .95s cubic-bezier(.15, 1, .2, 1) .22s both',
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}/>

      {/* Rising 🔥 column — each ember climbs from below the fold up
          past the top edge, like sparks off a campfire scaled to the
          whole viewport. `--rot` and `--dx` are per-emoji CSS vars so
          one keyframe powers all 60. */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {embers.map((e, i) => (
          <span key={i} style={{
            position: 'absolute',
            left: `${e.x}%`, bottom: 0,
            fontSize: e.size,
            lineHeight: 1,
            opacity: e.opacity,
            animation: `bcFireRise ${e.duration}s ease-out ${e.delay}s infinite`,
            // eslint-disable-next-line no-undef
            ['--rot']: `${e.rot}deg`,
            ['--dx']: e.dx,
            willChange: 'transform, opacity',
            filter: 'drop-shadow(0 0 8px rgba(255,150,40,.7))',
          }}>🔥</span>
        ))}
      </div>

      {/* Hero flame — rises from below the bottom of the screen into the
          middle with a punchy scale-overshoot, then idles with the same
          flicker shadow loop as the previous version. */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        fontSize: 220, lineHeight: 1,
        animation: fading
          ? 'bcFireHeroExit .55s ease-in forwards'
          : 'bcFireHeroAscend 1.05s cubic-bezier(.18,1.5,.3,1) forwards, bcFireHeroFlick 1.4s ease-in-out 1.1s infinite',
        pointerEvents: 'none',
      }}>🔥</div>

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
