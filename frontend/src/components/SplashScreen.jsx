import React, { useEffect, useState } from 'react';

const CSS = `
@keyframes handLeftIn  { 0% { transform: translateX(-60vw) rotate(-20deg) scale(.5); opacity:0 }
                         60%{ opacity:1 }
                         100%{ transform: translateX(-22px) rotate(0deg) scale(1); opacity:1 } }
@keyframes handRightIn { 0% { transform: translateX( 60vw) rotate( 20deg) scale(.5); opacity:0 }
                         60%{ opacity:1 }
                         100%{ transform: translateX( 22px) rotate(0deg) scale(1); opacity:1 } }
@keyframes shakePulse  { 0%, 100% { transform: scale(1); filter:none }
                         50%      { transform: scale(1.18); filter: drop-shadow(0 0 28px rgba(200,151,63,.85)) } }
@keyframes handsExit   { to       { transform: translateY(40px) scale(.7); opacity:0 } }
@keyframes coinArc     { 0%   { transform: translate(0,0) scale(.2) rotateY(0deg);    opacity:0 }
                         20%  { transform: translate(0,-20px) scale(1) rotateY(360deg); opacity:1 }
                         55%  { transform: translate(0,-160px) scale(1.05) rotateY(1260deg); opacity:1 }
                         85%  { transform: translate(0,-90px) scale(1) rotateY(1980deg);  opacity:1 }
                         100% { transform: translate(0,-50px) scale(.85) rotateY(2160deg); opacity:0 } }
@keyframes coinGlow    { 0%, 100% { filter: drop-shadow(0 0 6px rgba(200,151,63,.5)) }
                         50%      { filter: drop-shadow(0 0 22px rgba(232,184,75,1)) } }
@keyframes logoLetter  { 0%   { transform: translateY(28px) scale(.6); opacity:0; filter: blur(6px) }
                         100% { transform: translateY(0) scale(1); opacity:1; filter: blur(0) } }
@keyframes sublineIn   { 0% { opacity:0; letter-spacing:.5em } 100% { opacity:.7; letter-spacing:.35em } }
@keyframes splashFade  { to { opacity:0 } }
@keyframes shimmerGold { 0% { background-position:-200% 0 } 100% { background-position:200% 0 } }
@keyframes ringPulse   { 0% { transform: scale(0); opacity:.7 } 100% { transform: scale(3); opacity:0 } }
`;

export default function SplashScreen({ onDone, brand = 'BetCouple' }) {
  // phases: 0 entering, 1 shake, 2 coin flying, 3 logo, 4 exit
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 750);    // hands met
    const t2 = setTimeout(() => setPhase(2), 1050);   // coin launches
    const t3 = setTimeout(() => setPhase(3), 1700);   // logo letters
    const t4 = setTimeout(() => setPhase(4), 2700);   // begin fade
    const t5 = setTimeout(() => onDone?.(), 3300);    // remove
    return () => [t1,t2,t3,t4,t5].forEach(clearTimeout);
  }, [onDone]);

  const skip = () => onDone?.();

  const letters = brand.split('');

  return (
    <div
      onClick={skip}
      style={{
        position:'fixed', inset:0, zIndex:9999,
        background:'radial-gradient(circle at 50% 45%, #14112a 0%, #07060f 70%)',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        cursor:'pointer', userSelect:'none',
        animation: phase >= 4 ? 'splashFade .6s ease forwards' : 'none',
      }}
    >
      <style>{CSS}</style>

      {/* gold halo on shake */}
      {phase >= 1 && phase < 3 && (
        <div style={{
          position:'absolute', top:'42%', left:'50%',
          transform:'translate(-50%,-50%)',
          width:160, height:160, borderRadius:'50%',
          background:'radial-gradient(circle, rgba(200,151,63,.45) 0%, rgba(200,151,63,0) 70%)',
          animation:'ringPulse 1.2s ease-out forwards',
          pointerEvents:'none',
        }}/>
      )}

      {/* hands + coin scene */}
      <div style={{
        position:'relative', width:240, height:160,
        display:'flex', alignItems:'center', justifyContent:'center',
        marginBottom:36,
      }}>
        <span style={{
          position:'absolute', fontSize:78, lineHeight:1,
          animation: phase < 3
            ? `handLeftIn .75s cubic-bezier(.34,1.5,.64,1) both${phase === 1 ? ', shakePulse .35s ease-out .75s both' : ''}`
            : 'handsExit .45s ease-in forwards',
        }}>🫱</span>
        <span style={{
          position:'absolute', fontSize:78, lineHeight:1,
          animation: phase < 3
            ? `handRightIn .75s cubic-bezier(.34,1.5,.64,1) both${phase === 1 ? ', shakePulse .35s ease-out .75s both' : ''}`
            : 'handsExit .45s ease-in forwards',
        }}>🫲</span>
        {phase >= 2 && (
          <span style={{
            position:'absolute', fontSize:56, lineHeight:1,
            animation: 'coinArc 1.5s cubic-bezier(.34,1,.64,1) forwards, coinGlow 1.5s ease-in-out forwards',
          }}>🪙</span>
        )}
      </div>

      {/* logo */}
      <div style={{
        fontFamily:"'Playfair Display', serif",
        fontSize:46, fontWeight:900, letterSpacing:-0.5,
        display:'flex', gap:0,
        background:'linear-gradient(90deg,#c8973f 0%,#e8b84b 50%,#c8973f 100%)',
        backgroundSize:'200% 100%',
        WebkitBackgroundClip:'text', backgroundClip:'text',
        WebkitTextFillColor:'transparent',
        animation: phase >= 3 ? 'shimmerGold 2.5s linear infinite' : 'none',
      }}>
        {letters.map((ch, i) => (
          <span key={i} style={{
            display:'inline-block',
            opacity: phase >= 3 ? undefined : 0,
            animation: phase >= 3
              ? `logoLetter .55s cubic-bezier(.34,1.56,.64,1) ${i * 55}ms both`
              : 'none',
          }}>{ch === ' ' ? ' ' : ch}</span>
        ))}
      </div>

      {/* tagline */}
      {phase >= 3 && (
        <div style={{
          marginTop:14, fontSize:11, color:'#8480a0',
          letterSpacing:'.35em', textTransform:'uppercase',
          fontFamily:"'Syne', sans-serif", fontWeight:600,
          animation:'sublineIn .9s ease-out .4s both',
        }}>
          Scommetti con chi vuoi
        </div>
      )}

      {/* skip hint */}
      <div style={{
        position:'absolute', bottom:24, fontSize:10,
        color:'#3d3a58', letterSpacing:2,
        fontFamily:"'Syne', sans-serif",
      }}>
        TAP TO SKIP
      </div>
    </div>
  );
}
