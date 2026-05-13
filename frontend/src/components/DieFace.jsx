import React from 'react';

// Pip positions for each face — using a 3x3 grid with named cells:
//   tl tm tr
//   ml mc mr
//   bl bm br
export const PIP_LAYOUTS = {
  1: { mc: true },
  2: { tr: true, bl: true },
  3: { tr: true, mc: true, bl: true },
  4: { tl: true, tr: true, bl: true, br: true },
  5: { tl: true, tr: true, mc: true, bl: true, br: true },
  6: { tl: true, ml: true, bl: true, tr: true, mr: true, br: true },
};
export const PIP_CELLS = ['tl','tm','tr','ml','mc','mr','bl','bm','br'];

// Shared ivory-and-ink die face. Used both as the small static graphic on
// the empty-state dashboard and as the tumbling face inside the roll
// overlay popup.
export default function DieFace({ value, size }) {
  const layout = PIP_LAYOUTS[value] || {};
  const pipSize = size * 0.16;
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size * 0.16,
      background: 'linear-gradient(135deg, #faf5e5 0%, #ede8d8 60%, #d8cdb0 100%)',
      boxShadow:
        'inset 0 -5px 14px rgba(60,40,15,.22),' +
        'inset 0 5px 10px rgba(255,255,255,.55),' +
        '0 12px 26px rgba(0,0,0,.4)',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gridTemplateRows: '1fr 1fr 1fr',
      padding: size * 0.14,
      gap: 0,
      position: 'relative',
    }}>
      {PIP_CELLS.map(cell => (
        <div key={cell} style={{display:'flex', alignItems:'center', justifyContent:'center'}}>
          {layout[cell] && (
            <div style={{
              width: pipSize, height: pipSize, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #4a2a10 0%, #2a1638 60%, #1a0f28 100%)',
              boxShadow: 'inset 0 2px 3px rgba(0,0,0,.45), inset 0 -1px 2px rgba(255,255,255,.15), 0 1px 1px rgba(255,255,255,.3)',
            }}/>
          )}
        </div>
      ))}
    </div>
  );
}
