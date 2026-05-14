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

// CROCE — the "tails" / design side. The italic Cormorant ampersand
// matches the face stamped on the splash-screen coin, so the easter
// egg reads as the same currency the brand opens with. Framed by 12
// rim dots like a clock face + a sweeping laurel curve at the bottom.
export function CoinFaceCroce({ size }) {
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

// TESTA — the "heads" / value side. Big "777" in the same Playfair
// Display Black numerals used by the credit balance hero, with a tiny ₡
// suffix to underline the link to the app's currency.
export function CoinFaceTesta({ size }) {
  return (
    <CoinDisk size={size}>
      <svg viewBox="-50 -50 100 100" style={{position:'absolute', inset:0, width:'100%', height:'100%'}} aria-hidden>
        <defs>
          <path id="coinTopArc" d="M -38,2 A 38,38 0 0 1 38,2" fill="none"/>
          <path id="coinBotArc" d="M -34,2 A 34,34 0 0 0 34,2" fill="none"/>
        </defs>
        <text fontSize="6" fontWeight="700" letterSpacing="3" fill="#3d2412"
              fontFamily="Manrope,sans-serif" opacity=".7">
          <textPath href="#coinTopArc" startOffset="50%" textAnchor="middle">★ BETCOUPLE ★</textPath>
        </text>
        <text fontSize="4" fontWeight="600" letterSpacing="2.5" fill="#3d2412"
              fontFamily="Manrope,sans-serif" opacity=".55">
          <textPath href="#coinBotArc" startOffset="50%" textAnchor="middle">FORTUNA · UN CREDITO</textPath>
        </text>
      </svg>
      {/* "777 ₡" — same Playfair Display Black typography as the credit
          balance hero (`bc-num`). Engraved dark color since the coin is
          already gold. */}
      <div style={{
        display:'flex', alignItems:'baseline', gap: size*0.025,
        fontFamily:"'Playfair Display',serif", fontWeight: 900,
        fontFeatureSettings: "'lnum' 1, 'tnum' 1",
        fontSize: size * 0.38, lineHeight: 1, letterSpacing: '-0.05em',
        color: '#3d2412',
        textShadow: '0 1px 0 rgba(255,255,255,.55), 0 -1px 0 rgba(0,0,0,.35)',
        position: 'relative', zIndex: 1,
      }}>
        <span>777</span>
        <span style={{
          fontSize: size * 0.16, fontWeight: 700, opacity: .7,
          marginLeft: size * 0.01,
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
