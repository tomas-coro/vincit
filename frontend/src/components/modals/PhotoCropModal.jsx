import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../../i18n.js';
import { cropImageToSquare } from '../../imageUtils.js';

/**
 * Square crop UI with pan + zoom. The user picks which part of the image
 * fills the circular avatar. On confirm we render the visible region into
 * a square canvas at the requested output size.
 *
 * Props:
 *   - img        HTMLImageElement (already decoded)
 *   - dataUrl    string (used for the <img> src in the preview)
 *   - size       output square pixel size (default 512)
 *   - quality    JPEG quality (default 0.85)
 *   - onConfirm  (croppedDataUrl) => void
 *   - onCancel   () => void
 */
export default function PhotoCropModal({ img, dataUrl, size = 512, quality = 0.85, onConfirm, onCancel }) {
  const { t } = useLang();
  const viewportRef = useRef(null);
  const [viewport, setViewport] = useState({ w: 280, h: 280 });

  // Measure the actual rendered viewport size once mounted (responsive).
  useEffect(() => {
    if (!viewportRef.current) return;
    const r = viewportRef.current.getBoundingClientRect();
    setViewport({ w: r.width, h: r.height });
  }, []);

  const V = Math.min(viewport.w, viewport.h);

  // minScale: just enough so the image covers the viewport on its smaller side
  const minScale = img ? Math.max(V / img.naturalWidth, V / img.naturalHeight) : 1;
  const maxScale = minScale * 4;

  const [scale, setScale] = useState(minScale);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Re-anchor when viewport size becomes known
  useEffect(() => { setScale(minScale); setOffset({ x: 0, y: 0 }); }, [minScale]);

  const clampOffset = useCallback((x, y, s) => {
    if (!img) return { x, y };
    const halfW = (img.naturalWidth  * s - V) / 2;
    const halfH = (img.naturalHeight * s - V) / 2;
    return {
      x: Math.max(-halfW, Math.min(halfW, x)),
      y: Math.max(-halfH, Math.min(halfH, y)),
    };
  }, [img, V]);

  // Pointer drag
  const dragRef = useRef(null);
  const onPointerDown = e => {
    e.preventDefault();
    dragRef.current = { x: e.clientX, y: e.clientY, oX: offset.x, oY: offset.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = e => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset(clampOffset(dragRef.current.oX + dx, dragRef.current.oY + dy, scale));
  };
  const onPointerUp = e => {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  // Wheel zoom (desktop). Pinch zoom is handled via the slider on touch.
  const onWheel = e => {
    if (!img) return;
    e.preventDefault();
    const next = Math.max(minScale, Math.min(maxScale, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    setScale(next);
    setOffset(o => clampOffset(o.x, o.y, next));
  };

  const handleSlider = e => {
    const v = parseFloat(e.target.value);
    setScale(v);
    setOffset(o => clampOffset(o.x, o.y, v));
  };

  const handleConfirm = () => {
    if (!img) return;
    // Map viewport (0,0)..(V,V) back into image-natural coordinates.
    // Image center sits at (V/2 + offset.x, V/2 + offset.y) in viewport coords.
    // Inverse: imageX at viewport (0,0) = imgW/2 - (V/2 + offset.x)/scale
    const sw = V / scale;
    const sh = V / scale;
    const sx = img.naturalWidth  / 2 - (V / 2 + offset.x) / scale;
    const sy = img.naturalHeight / 2 - (V / 2 + offset.y) / scale;
    const out = cropImageToSquare(img, { sx, sy, sw, sh }, size, quality);
    onConfirm?.(out);
  };

  if (!img || !dataUrl) return null;

  return createPortal(
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9200, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} className="bIn" style={{
        background: 'var(--surf)', border: '1px solid var(--brd)',
        borderRadius: 18, width: '100%', maxWidth: 380,
        boxShadow: '0 24px 64px rgba(0,0,0,.6)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--brd)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700 }}>
            🖼 {t('crop.title')}
          </div>
          <button onClick={onCancel} style={{
            background: 'transparent', border: '1px solid var(--brd)', borderRadius: 10,
            color: 'var(--dim)', padding: '5px 11px', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
          }}>✕</button>
        </div>

        <div style={{ padding: 18 }}>
          <div
            ref={viewportRef}
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              position: 'relative',
              width: '100%', aspectRatio: '1/1',
              borderRadius: '50%',
              overflow: 'hidden',
              background: '#0a0913',
              border: '2px solid var(--gold)55',
              boxShadow: '0 0 0 6px var(--gold)15',
              cursor: dragRef.current ? 'grabbing' : 'grab',
              touchAction: 'none',
              userSelect: 'none',
            }}
          >
            <img
              src={dataUrl}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: '50%', top: '50%',
                width: img.naturalWidth,
                height: img.naturalHeight,
                transform: `translate(-50%,-50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: 'center center',
                pointerEvents: 'none',
              }}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 11, color: 'var(--dim)', marginBottom: 6, letterSpacing: 1,
            }}>
              <span>🔍</span><span style={{ flex: 1 }}>{t('crop.zoom')}</span>
              <span style={{ color: 'var(--gold)' }}>×{(scale / minScale).toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={minScale} max={maxScale} step={(maxScale - minScale) / 100}
              value={scale}
              onChange={handleSlider}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 8, textAlign: 'center', lineHeight: 1.4 }}>
            {t('crop.hint')}
          </div>
        </div>

        <div style={{
          display: 'flex', gap: 8, padding: '12px 18px',
          borderTop: '1px solid var(--brd)', justifyContent: 'flex-end',
        }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', borderRadius: 10,
            background: 'transparent', border: '1px solid var(--brd)',
            color: 'var(--dim)', cursor: 'pointer',
            fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600,
          }}>{t('crop.cancel')}</button>
          <button onClick={handleConfirm} style={{
            padding: '10px 22px', borderRadius: 10,
            background: 'var(--gold)', border: 'none',
            color: '#07060f', cursor: 'pointer',
            fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 800,
            boxShadow: '0 4px 16px var(--glow)',
          }}>{t('crop.confirm')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
