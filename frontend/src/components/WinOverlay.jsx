import React, { useEffect, useMemo, useRef } from 'react';

// Total time the overlay stays on screen (ms). Tight enough that the
// follow-up CommentModal (gated behind this in App.jsx) doesn't make
// the user wait too long, long enough that the in/out animations
// register as a deliberate celebration rather than a flicker.
const SHOW_MS = 1500;
// Exit animation length — must match the wo_out keyframe duration.
const EXIT_MS = 260;

const PARTICLE_COLORS = ['#e8b84b', '#c8973f', '#2ecc7f', '#a07ef5', '#5b8af0', '#f97316'];

export default function WinOverlay({ amount, onDone }) {
  // Capture the latest onDone in a ref so the timer effect can run once
  // on mount — a fresh-each-render arrow from the parent would otherwise
  // reset the timeout on every parent re-render (SSE refresh tick) and
  // the trophy would linger indefinitely on a busy app.
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current?.(), SHOW_MS);
    return () => clearTimeout(t);
  }, []);

  // Fewer, calmer particles than the old design — 24 instead of 48,
  // smaller, no spinning. They burst once from behind the card and fade.
  const particles = useMemo(() => Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2 + (i % 2 ? 0.18 : 0);
    const dist  = 100 + Math.random() * 110;
    return {
      ex: Math.round(Math.cos(angle) * dist),
      ey: Math.round(Math.sin(angle) * dist),
      size: 4 + (i % 3) * 2,
      delay: (i % 8) * 0.03,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      isDot: i % 3 === 0,
    };
  }), []);

  return (
    <div style={{
      position:'fixed', inset:0,
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:300, pointerEvents:'none',
    }}>
      <style>{`
        @keyframes wo_in   { 0%{transform:scale(.88) translateY(8px);opacity:0} 60%{transform:scale(1.03);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes wo_out  { from{opacity:1;transform:scale(1)} to{opacity:0;transform:scale(.94)} }
        @keyframes wo_part { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(var(--ex),var(--ey)) scale(.35);opacity:0} }
      `}</style>

      <div style={{ position:'relative' }}>
        {particles.map((p, i) => (
          <div key={i} style={{
            position:'absolute', left:'50%', top:'50%',
            width:p.size, height:p.size,
            marginLeft:-p.size/2, marginTop:-p.size/2,
            borderRadius: p.isDot ? '50%' : '1.5px',
            background: p.color,
            '--ex': `${p.ex}px`,
            '--ey': `${p.ey}px`,
            animation: `wo_part ${SHOW_MS}ms ${p.delay}s ease-out both`,
            boxShadow: `0 0 6px ${p.color}88`,
          }}/>
        ))}

        <div style={{
          position:'relative',
          padding:'20px 32px 18px',
          minWidth:200,
          borderRadius:18,
          background:'linear-gradient(160deg, rgba(26,20,38,.96) 0%, rgba(13,10,23,.96) 100%)',
          border:'1px solid rgba(232,184,75,.55)',
          boxShadow:'0 0 0 1px rgba(232,184,75,.18), 0 22px 60px rgba(0,0,0,.6), 0 0 50px rgba(200,151,63,.28)',
          textAlign:'center',
          backdropFilter:'blur(8px)',
          WebkitBackdropFilter:'blur(8px)',
          animation: `wo_in 360ms cubic-bezier(.18,.9,.32,1.18) both, wo_out ${EXIT_MS}ms ${SHOW_MS - EXIT_MS}ms ease-in forwards`,
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden style={{
            display:'block', margin:'0 auto 4px',
            filter:'drop-shadow(0 2px 10px rgba(232,184,75,.6))',
          }}>
            <defs>
              <linearGradient id="woTrophy" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="#f7d97e"/>
                <stop offset="55%" stopColor="#e8b84b"/>
                <stop offset="100%" stopColor="#a8782a"/>
              </linearGradient>
            </defs>
            <path
              d="M7 3h10v2h2.5a1 1 0 0 1 1 1v2a4 4 0 0 1-3.6 3.98A6 6 0 0 1 13 14.9V17h2.5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1H11v-2.1a6 6 0 0 1-3.9-2.92A4 4 0 0 1 3.5 8V6a1 1 0 0 1 1-1H7V3zm0 4H5.5v1a2 2 0 0 0 1.5 1.94V7zm10 0v2.94A2 2 0 0 0 18.5 8V7H17z"
              fill="url(#woTrophy)"
            />
          </svg>

          <div style={{
            fontFamily:"'Manrope',sans-serif",
            fontSize:9, fontWeight:800,
            letterSpacing:'.32em', textTransform:'uppercase',
            color:'#e8b84b', opacity:.78,
            marginBottom:6,
          }}>Vittoria</div>

          <div style={{
            fontFamily:"'Playfair Display',serif",
            fontSize:30, fontWeight:700,
            color:'var(--grn)',
            lineHeight:1, letterSpacing:'-0.01em',
            fontVariantNumeric:'tabular-nums',
          }}>+{amount} ₡</div>
        </div>
      </div>
    </div>
  );
}
