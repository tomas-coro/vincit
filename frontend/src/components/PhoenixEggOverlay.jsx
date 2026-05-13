import React, { useEffect, useRef, useState } from 'react';

// Fire easter egg — visual twin of IceEggOverlay (concept D5 "flame
// cascade"). Triple-tap the 🔥 in the win-streak pill triggers it. Three
// elements compose the scene:
//  1. A giant 🔥 at the center that pulses + grows like the snowflake does.
//  2. ~80 flame particles falling from above on a canvas (drawn as
//     gradient teardrops so they actually look like fire, not snowballs).
//  3. A warm tint sliding in from each edge of the screen — mirror of
//     the frost overlays, but in amber/red so the screen "catches fire".
// Total runtime ~3s; tap-to-skip honored. Trophy: egg_phoenix → "Inferno".

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
@keyframes bcFireGlowTop    { from { transform: translateY(-100%) } to { transform: translateY(0) } }
@keyframes bcFireGlowBottom { from { transform: translateY( 100%) } to { transform: translateY(0) } }
@keyframes bcFireGlowLeft   { from { transform: translateX(-100%) } to { transform: translateX(0) } }
@keyframes bcFireGlowRight  { from { transform: translateX( 100%) } to { transform: translateX(0) } }
`;

export default function PhoenixEggOverlay({ open, onClose }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const [phase, setPhase] = useState(0); // 0 = entering, 1 = settled, 2 = exiting

  // Phase scheduler — mirror of ice
  useEffect(() => {
    if (!open) return;
    setPhase(0);
    const t1 = setTimeout(() => setPhase(1), 700);
    const t2 = setTimeout(() => setPhase(2), 2400);
    const t3 = setTimeout(() => onClose?.(), 3000);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [open, onClose]);

  // Canvas flame-shower — flames fall from top, scale + flicker as they go.
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width  = window.innerWidth  + 'px';
      canvas.style.height = window.innerHeight + 'px';
    };
    resize();
    window.addEventListener('resize', resize);

    // Spawn 80 falling flames with varied speed/size/wobble. We start them
    // staggered above the visible viewport so the screen fills gradually.
    const flames = [];
    for (let i = 0; i < 80; i++) {
      flames.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height * 1.2,
        // Flames "fall" but flicker — base downward velocity + wobble.
        vy: (1.0 + Math.random() * 1.6) * dpr,
        vx: (Math.random() - 0.5) * 0.6 * dpr,
        size: (10 + Math.random() * 18) * dpr,
        hue: 12 + Math.random() * 32,   // 12..44 — red → orange → gold
        wob: Math.random() * Math.PI * 2,
        wobSpeed: 0.04 + Math.random() * 0.05,
        // Alpha varies so some flames are wisps, some are solid.
        a: 0.6 + Math.random() * 0.35,
      });
    }

    const ctx = canvas.getContext('2d');

    // Draw a single flame as a vertical gradient teardrop — wider/cooler
    // at the bottom, narrow/hot at the tip. Saves us from emoji which
    // looks pixelated when scaled small on hi-dpi.
    const drawFlame = (f) => {
      const w = f.size * 0.6;
      const h = f.size * 1.4;
      const grad = ctx.createLinearGradient(0, -h * 0.6, 0, h * 0.4);
      grad.addColorStop(0,   `hsla(${f.hue + 30}, 100%, 80%, ${f.a})`); // white-hot tip
      grad.addColorStop(0.4, `hsla(${f.hue + 10}, 100%, 60%, ${f.a})`); // orange body
      grad.addColorStop(1,   `hsla(${f.hue}, 100%, 45%, 0)`);            // fades base
      ctx.fillStyle = grad;
      ctx.beginPath();
      // Teardrop shape — bezier from tip down to wider base then back.
      ctx.moveTo(0, -h * 0.6);
      ctx.bezierCurveTo( w * 0.9, -h * 0.2,  w, h * 0.2,  0, h * 0.4);
      ctx.bezierCurveTo(-w,        h * 0.2, -w * 0.9, -h * 0.2,  0, -h * 0.6);
      ctx.fill();
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter'; // additive — flames glow over each other
      for (const f of flames) {
        f.y += f.vy;
        f.wob += f.wobSpeed;
        f.x += f.vx + Math.sin(f.wob) * 0.6 * dpr;
        if (f.y - f.size > canvas.height) {
          f.y = -f.size * 2;
          f.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.translate(f.x, f.y);
        // Tilt slightly with the wobble so flames feel windswept.
        ctx.rotate(Math.sin(f.wob) * 0.18);
        drawFlame(f);
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [open]);

  if (!open) return null;
  const fading = phase === 2;

  // Warm tint — same shape as the ice frost but amber/red.
  const tintVertical   = 'linear-gradient(180deg, rgba(255,120,40,.45) 0%, rgba(220,70,20,.18) 60%, rgba(180,60,15,0) 100%)';
  const tintHorizontalL = 'linear-gradient(90deg, rgba(255,140,50,.4) 0%, rgba(220,70,20,0) 100%)';
  const tintHorizontalR = 'linear-gradient(270deg, rgba(255,140,50,.4) 0%, rgba(220,70,20,0) 100%)';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9700,
        // Deep ember background with a hot core
        background: 'radial-gradient(circle at 50% 65%, rgba(180,60,15,.55) 0%, rgba(30,10,5,.92) 80%)',
        animation: fading
          ? 'bcFireBgOut .6s ease forwards'
          : 'bcFireBgIn .35s ease forwards',
        cursor: 'pointer', userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <style>{CSS}</style>

      {/* Falling flames canvas */}
      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
      }}/>

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
