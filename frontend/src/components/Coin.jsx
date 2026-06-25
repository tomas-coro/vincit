import React from 'react';

// Shared coin design used in three places:
//   1. CoinFlipOverlay (easter egg — ₡ symbol click)
//   2. OvertimeModal (decides bet winner by chance)
//   3. (potential) trophy-unlock animation
//
// The CSS keyframes `coinFlip3dTesta` and `coinFlip3dCroce` are defined
// globally in App.jsx's CSS_BASE and are available app-wide — that's why
// Coin3D below can just reference them by name.

// Shared "blank" coin disk: gold radial gradient, embossed rim, twin
// inner rings. Both testa and croce reuse this so the disk feels
// consistent regardless of which side is showing.
export function CoinDisk({ size, children }) {
  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 28%, #fbeaa6 0%, #e2c172 30%, #b4892f 70%, #6f4f1a 100%)',
      border: `${Math.max(3, size * 0.025)}px solid #e2c886`,
      boxShadow:
        'inset 0 -10px 22px rgba(60,30,5,.42), ' +
        'inset 0 8px 16px rgba(255,255,255,.45), ' +
        '0 20px 42px rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{position:'absolute', inset: size*0.05, borderRadius:'50%',
        border:'1.5px solid rgba(50,25,8,.4)'}}/>
      <div style={{position:'absolute', inset: size*0.12, borderRadius:'50%',
        border:'1px solid rgba(50,25,8,.22)'}}/>
      {children}
    </div>
  );
}

// TESTA — the "heads" / official face. The italic Cormorant ampersand
// matches the coin stamped on the splash screen, so the brand-defining
// face is what shows up as "testa" on a coin flip. Framed by 12 rim
// dots like a clock face + a sweeping laurel curve at the bottom.
export function CoinFaceTesta({ size }) {
  return (
    <CoinDisk size={size}>
      <svg viewBox="-50 -50 100 100" style={{position:'absolute', inset:0, width:'100%', height:'100%'}} aria-hidden>
        {Array.from({length:12}).map((_,i) => {
          const ang = (i * 30) * Math.PI / 180;
          const r = 41;
          const x = Math.sin(ang) * r;
          const y = -Math.cos(ang) * r;
          return <circle key={i} cx={x} cy={y} r="1.3" fill="#3d2412" opacity=".55"/>;
        })}
        <path d="M -32,18 Q 0,42 32,18" stroke="#3d2412" strokeWidth="1" opacity=".4" fill="none"/>
        {[-26,-18,-10,10,18,26].map(x => (
          <ellipse key={x} cx={x} cy={28} rx="2" ry="3.5"
            transform={`rotate(${x*1.5} ${x} 28)`} fill="#3d2412" opacity=".5"/>
        ))}
      </svg>
      <div style={{
        fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic', fontWeight:700,
        fontSize: size * 0.5, lineHeight: 1, letterSpacing: '-0.02em',
        color:'#3d2412',
        textShadow: '0 1px 0 rgba(255,255,255,.55), 0 -1px 0 rgba(0,0,0,.35)',
        position:'relative', zIndex: 1,
        transform: `translateY(${-size * 0.04}px)`,
      }}>&amp;</div>
    </CoinDisk>
  );
}

// CROCE — the "tails" / value side. Redesigned: gone the cluttered
// "★ BETCOUPLE ★ / FORTUNA · UN CREDITO" double-arc text. The 777 now
// breathes inside a cleaner field: three stars on top, three on bottom,
// the numerals enlarged in italic Playfair, and the ₡ glyph promoted
// to a single dramatic line below them — reads as "777 = credito" at
// a glance instead of competing with two arcs of microscopic text.
export function CoinFaceCroce({ size }) {
  return (
    <CoinDisk size={size}>
      <svg viewBox="-50 -50 100 100" style={{position:'absolute', inset:0, width:'100%', height:'100%'}} aria-hidden>
        {/* Top crown of three ornaments */}
        {[-20, 0, 20].map(x => (
          <text key={`top-${x}`} x={x} y={-32} fontSize="9" textAnchor="middle"
            fill="#3d2412" opacity=".55" fontFamily="serif">✦</text>
        ))}
        {/* Bottom laurel sweep */}
        <path d="M -34,18 Q 0,40 34,18" stroke="#3d2412" strokeWidth="1.2" opacity=".4" fill="none"/>
        {[-22,-12,12,22].map(x => (
          <ellipse key={`leaf-${x}`} cx={x} cy={26} rx="2.2" ry="4"
            transform={`rotate(${x*2} ${x} 26)`} fill="#3d2412" opacity=".45"/>
        ))}
      </svg>

      {/* 777 — Playfair, big and breathing. Same family as the
          credit-balance hero so the numeral feels "of the app".
          Roman (non-italic) numerals + tabular figures so the glyphs
          sit on a symmetric box and visually center inside the disk;
          the previous italic + negative letter-spacing leaned the
          mass off-axis and made the digits read as left-shifted. */}
      <div style={{
        position:'relative', zIndex: 1,
        display:'flex', flexDirection:'column', alignItems:'center', gap: size * 0.01,
        transform: `translateY(${-size * 0.02}px)`,
        width:'100%',
      }}>
        <span style={{
          display:'block', width:'100%', textAlign:'center',
          fontFamily:"'Bodoni Moda',serif", fontWeight: 900,
          fontFeatureSettings: "'lnum' 1, 'tnum' 1",
          fontSize: size * 0.46, lineHeight: 1, letterSpacing: '0.01em',
          color: '#3d2412',
          textShadow: '0 1px 0 rgba(255,255,255,.55), 0 -1px 0 rgba(0,0,0,.35)',
        }}>777</span>
        <span style={{
          display:'block', width:'100%', textAlign:'center',
          fontFamily:"'Bodoni Moda',serif", fontWeight: 700,
          fontSize: size * 0.16, lineHeight: 1,
          color: '#3d2412', opacity: .75,
          textShadow: '0 1px 0 rgba(255,255,255,.45)',
          letterSpacing: '.04em',
        }}>₡</span>
      </div>
    </CoinDisk>
  );
}

// 3D coin: two stacked faces, one on each side of an invisible card. The
// parent rotates on X-axis with the global keyframes from App.jsx — during
// the flip the user actually sees TESTA → edge → CROCE → edge → TESTA
// alternate. Final rotation lands the chosen face forward.
export default function Coin3D({ result, size, durationMs = 2600 }) {
  const animName = result === 'croce' ? 'coinFlip3dCroce' : 'coinFlip3dTesta';
  return (
    <div style={{ width: size, height: size, perspective: 1200 }}>
      <div style={{
        position:'relative', width:'100%', height:'100%',
        transformStyle:'preserve-3d',
        animation: `${animName} ${durationMs}ms cubic-bezier(.34,1.05,.55,1) forwards`,
      }}>
        <div style={{
          position:'absolute', inset:0,
          backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
        }}>
          <CoinFaceTesta size={size}/>
        </div>
        <div style={{
          position:'absolute', inset:0,
          backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
          transform:'rotateX(180deg)',
        }}>
          <CoinFaceCroce size={size}/>
        </div>
      </div>
    </div>
  );
}
