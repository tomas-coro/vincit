import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../../i18n.js';
import { cropImageToSquare } from '../../imageUtils.js';
import useEscClose from '../../hooks/useEscClose.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';

/**
 * Square crop UI with pan + zoom.
 *
 * Coordinate system (chosen for readability):
 *   - The viewport is a fixed-size square of V px (computed from the modal
 *     width so it scales to small phones, but constant once measured).
 *   - The image is rendered with transform-origin: top-left, so
 *     `transform: translate(imgPos.x, imgPos.y) scale(scale)` makes the
 *     image\'s natural pixel (0,0) appear at viewport coord `imgPos`.
 *   - The image-rendered size in CSS pixels is (naturalW*scale, naturalH*scale).
 *   - Cover-fit constraint: imgPos.x must be in [V - naturalW*scale, 0] and
 *     similarly for y, so the image always fills the viewport.
 *
 * Inverse for export:
 *   - At viewport corner (0,0) the image-natural pixel is (-imgPos.x/scale,
 *     -imgPos.y/scale).
 *   - The visible region spans V/scale image pixels in both dimensions.
 */
export default function PhotoCropModal({ img, dataUrl, size = 512, quality = 0.85, onConfirm, onCancel }) {
  useEscClose(onCancel);
  useBodyScrollLock();
  const { t } = useLang();
  const viewportRef = useRef(null);
  const [V, setV] = useState(280);

  // Measure the rendered viewport on mount + on resize. Using a fixed
  // aspect-ratio square means width === height, so we only need one number.
  useEffect(() => {
    const measure = () => {
      if (!viewportRef.current) return;
      const r = viewportRef.current.getBoundingClientRect();
      const px = Math.round(r.width);
      if (px > 0) setV(px);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Cover-fit minimum scale: the smaller of the two axis ratios so the
  // image\'s shorter side fully covers V (the other side overflows and can
  // be panned).
  const minScale = img ? Math.max(V / img.naturalWidth, V / img.naturalHeight) : 1;
  const maxScale = minScale * 4;

  const [scale, setScale]   = useState(minScale);
  const [imgPos, setImgPos] = useState({ x: 0, y: 0 });

  // Recenter whenever V / minScale changes (initial measure, window resize).
  useEffect(() => {
    if (!img) return;
    const w = img.naturalWidth  * minScale;
    const h = img.naturalHeight * minScale;
    setScale(minScale);
    setImgPos({ x: (V - w) / 2, y: (V - h) / 2 });
  }, [img, V, minScale]);

  // Clamp helper so the image always covers the viewport.
  const clamp = useCallback((p, s) => {
    if (!img) return p;
    const w = img.naturalWidth  * s;
    const h = img.naturalHeight * s;
    return {
      x: Math.min(0, Math.max(V - w, p.x)),
      y: Math.min(0, Math.max(V - h, p.y)),
    };
  }, [img, V]);

  // Pointer drag (touch + mouse share the same path through Pointer Events).
  const dragRef = useRef(null);
  const onPointerDown = e => {
    e.preventDefault();
    dragRef.current = { x: e.clientX, y: e.clientY, px: imgPos.x, py: imgPos.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = e => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setImgPos(clamp({ x: dragRef.current.px + dx, y: dragRef.current.py + dy }, scale));
  };
  const onPointerUp = e => {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  // Wheel zoom — keep the viewport center fixed in image-space so zooming
  // feels like \"toward the middle\" rather than slipping sideways.
  const onWheel = e => {
    if (!img) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    applyZoom(scale * factor);
  };

  const applyZoom = nextScaleRaw => {
    const nextScale = Math.max(minScale, Math.min(maxScale, nextScaleRaw));
    if (nextScale === scale) return;
    // Anchor the zoom on the viewport center: the image-pixel under the
    // center stays under the center after scaling.
    const cx = V / 2, cy = V / 2;
    const imgCenterX = (cx - imgPos.x) / scale;     // image-natural pixel under center BEFORE
    const imgCenterY = (cy - imgPos.y) / scale;
    const nextPos = {
      x: cx - imgCenterX * nextScale,
      y: cy - imgCenterY * nextScale,
    };
    setScale(nextScale);
    setImgPos(clamp(nextPos, nextScale));
  };

  const handleSlider = e => applyZoom(parseFloat(e.target.value));

  const handleConfirm = () => {
    if (!img) return;
    // Image-natural region currently visible in the viewport:
    //   - top-left maps to image pixel (-imgPos.x/scale, -imgPos.y/scale)
    //   - region spans V/scale pixels in both dimensions
    const sx = -imgPos.x / scale;
    const sy = -imgPos.y / scale;
    const sw = V / scale;
    const sh = V / scale;
    const out = cropImageToSquare(img, { sx, sy, sw, sh }, size, quality);
    onConfirm?.(out);
  };

  if (!img || !dataUrl) return null;

  return createPortal(
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,11,35,.78)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9200, padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} className="bIn" style={{
        background: 'var(--surf)', border: '1px solid var(--rule)',
        borderRadius: 6, width: '100%', maxWidth: 400,
        boxShadow: '0 30px 80px rgba(0,0,0,.55)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: '24px 26px 16px', borderBottom: '1px solid var(--rule)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        }}>
          <div>
            <div className="bc-meta" style={{ marginBottom: 8 }}>— Ritaglio</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic', fontSize: 24, fontWeight: 600, lineHeight: 1, color: 'var(--txt)' }}>
              {t('crop.title')}
            </div>
          </div>
          <button onClick={onCancel} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--dim)', fontSize: 18, padding: 4,
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
              maxWidth: 320, margin: '0 auto',
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
                left: 0, top: 0,
                width: img.naturalWidth + 'px',
                height: img.naturalHeight + 'px',
                transform: `translate(${imgPos.x}px, ${imgPos.y}px) scale(${scale})`,
                transformOrigin: '0 0',
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
              <span style={{ color: 'var(--gold)' }}>×{(scale / minScale).toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={minScale} max={maxScale} step={(maxScale - minScale) / 100 || 0.001}
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
            fontFamily: "'Manrope',sans-serif", fontSize: 13, fontWeight: 600,
          }}>{t('crop.cancel')}</button>
          <button onClick={handleConfirm} style={{
            padding: '10px 22px', borderRadius: 10,
            background: 'var(--gold)', border: 'none',
            color: '#07060f', cursor: 'pointer',
            fontFamily: "'Manrope',sans-serif", fontSize: 13, fontWeight: 800,
            boxShadow: '0 4px 16px var(--glow)',
          }}>{t('crop.confirm')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
