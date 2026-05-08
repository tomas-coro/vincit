import React, { useEffect } from 'react';

const COLS = ['#c8973f','#e8b84b','#2ecc7f','#5b8af0','#a07ef5','#f97316','#e05555','#2ec8c8'];

export default function WinOverlay({ amount, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  const particles = Array.from({length: 48}, (_, i) => {
    const angle = (i / 48) * Math.PI * 2;
    const dist  = 80 + Math.random() * 170;
    const ex    = Math.round(Math.cos(angle) * dist);
    const ey    = Math.round(Math.sin(angle) * dist);
    const shape = i % 3 === 0 ? '50%' : i % 3 === 1 ? '0' : '2px';
    const size  = 6 + (i % 4) * 3;
    const delay = (i % 12) * 0.06;
    const rot   = 360 + Math.floor(Math.random() * 720);
    return { ex, ey, shape, size, delay, rot, color: COLS[i % 8] };
  });

  return (
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,pointerEvents:'none'}} className="fIn">
      <style>{`@keyframes confB{0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:1}100%{transform:translate(var(--ex),var(--ey)) rotate(var(--rot,720deg)) scale(.4);opacity:0}}`}</style>
      <div style={{position:'relative',textAlign:'center'}}>
        {particles.map((p, i) => (
          <div key={i} style={{
            position:'absolute', left:'50%', top:'50%',
            width: p.size, height: p.size,
            marginLeft: -p.size/2, marginTop: -p.size/2,
            borderRadius: p.shape,
            background: p.color,
            '--ex': `${p.ex}px`,
            '--ey': `${p.ey}px`,
            '--rot': `${p.rot}deg`,
            animation: `confB 3000ms ${p.delay}s ease-out both`,
          }}/>
        ))}
        <div className="bIn" style={{fontFamily:"'Playfair Display',serif",fontSize:72,filter:'drop-shadow(0 0 24px var(--glow))'}}>🏆</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:'var(--grn)',marginTop:6}}>+{amount} ₡</div>
      </div>
    </div>
  );
}
