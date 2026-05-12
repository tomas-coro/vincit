import React, { useEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n.js';
import { useToast } from '../../Toast.jsx';
import { fileToSquareDataUrl } from '../../imageUtils.js';

// Returns a dataURL via onCapture(dataUrl) from either the live camera or a file.
// Falls back to file picker on devices without getUserMedia / when permission denied.
export default function PhotoCaptureModal({ onCapture, onClose, side = 'square', size = 1080, quality = 0.85 }) {
  const { t } = useLang();
  const toast = useToast();
  const videoRef = useRef(null);
  const fileRef  = useRef(null);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [supported, setSupported] = useState(true);
  const [starting, setStarting] = useState(true);
  const [busy, setBusy] = useState(false);

  // Boot camera on mount
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setSupported(false); setStarting(false);
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setSupported(false);
      } finally { setStarting(false); }
    }
    boot();
    return () => { cancelled = true; };
  }, [facingMode]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
  }, [stream]);

  const flipCamera = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStream(null);
    setStarting(true);
    setFacingMode(f => f === 'environment' ? 'user' : 'environment');
  };

  const shoot = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setBusy(true);
    try {
      // Center-crop to a square
      const side = Math.min(v.videoWidth, v.videoHeight);
      const sx = (v.videoWidth - side) / 2;
      const sy = (v.videoHeight - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(v, sx, sy, side, side, 0, 0, size, size);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      stream?.getTracks().forEach(t => t.stop());
      setStream(null);
      onCapture?.(dataUrl);
      onClose?.();
    } catch (e) { console.error(e); toast.error(t('app.error_create')); setBusy(false); }
  };

  const pickFile = async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const dataUrl = await fileToSquareDataUrl(f, size, quality);
      stream?.getTracks().forEach(t => t.stop());
      setStream(null);
      onCapture?.(dataUrl);
      onClose?.();
    } catch (e) { console.error(e); toast.error(t('app.error_create')); setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.92)', zIndex:140,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    }}>
      <div onClick={e => e.stopPropagation()} className="bIn" style={{
        width:'100%', maxWidth:520,
        background:'var(--surf)', border:'1px solid var(--brd)', borderRadius:18,
        boxShadow:'0 24px 64px rgba(0,0,0,.6)',
        display:'flex', flexDirection:'column', maxHeight:'calc(100dvh - 32px)',
        minHeight: 0,
      }}>
        {/* Header */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'14px 18px', borderBottom:'1px solid var(--brd)', flexShrink:0}}>
          <div style={{fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700}}>
            📸 {t('photo.title')}
          </div>
          <button onClick={onClose} style={{
            background:'transparent', border:'1px solid var(--brd)', borderRadius:10,
            color:'var(--dim)', padding:'5px 11px', cursor:'pointer',
            fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:600,
          }}>✕</button>
        </div>

        {/* Body: live preview takes flexible height; action bar is sticky at the bottom */}
        <div style={{padding:'14px 16px 8px', flex:'1 1 auto', minHeight:0, display:'flex', justifyContent:'center'}}>
          <div style={{
            position:'relative',
            width:'100%',
            maxHeight:'100%',
            aspectRatio:'1/1',
            borderRadius:14, overflow:'hidden',
            background:'#0a0913', border:'1px solid var(--brd)',
            // Cap the square at a sensible size even on tall screens
            maxWidth: 'min(100%, calc(100dvh - 220px))',
          }}>
            {supported ? (
              <video ref={videoRef} autoPlay playsInline muted style={{
                width:'100%', height:'100%', objectFit:'cover',
                transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              }}/>
            ) : (
              <div style={{
                position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
                flexDirection:'column', gap:8, color:'var(--dim)', textAlign:'center', padding:24,
              }}>
                <div style={{fontSize:36}}>🎥</div>
                <div style={{fontSize:13}}>{t('photo.no_camera')}</div>
              </div>
            )}
            {starting && supported && (
              <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
                color:'var(--dim)', fontSize:12, letterSpacing:2}}>
                {t('photo.starting')}
              </div>
            )}
          </div>

          <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} style={{display:'none'}}/>
        </div>

        {/* Sticky action bar — always reachable even on short viewports */}
        <div style={{
          padding:'10px 14px 14px', borderTop:'1px solid var(--brd)',
          background:'var(--surf)', flexShrink:0,
          display:'flex', flexDirection:'column', gap:8,
        }}>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            {/* Flip camera (only when stream is alive) — always rendered so the
                layout doesn't shift after permission is granted */}
            {supported && (
              <button onClick={flipCamera} disabled={!stream} title={t('photo.flip')} style={{
                width:48, height:48, borderRadius:'50%', flexShrink:0,
                background:'var(--card)', border:'1px solid var(--brd)',
                color:'var(--dim)', cursor: stream ? 'pointer' : 'not-allowed',
                fontSize:20, opacity: stream ? 1 : .4,
              }}>🔄</button>
            )}

            {/* Shutter — big primary action when camera is live */}
            <button onClick={shoot} disabled={!stream || busy}
              style={{
                flex:1, height:56, borderRadius:14, border:'none',
                background: stream ? 'var(--gold)' : 'var(--mut)44',
                color: stream ? '#07060f' : 'var(--dim)',
                fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:800,
                cursor: stream && !busy ? 'pointer' : 'not-allowed',
                boxShadow: stream ? '0 4px 16px var(--glow)' : 'none',
                letterSpacing:1,
              }}>
              📷 {t('photo.shoot')}
            </button>

            {/* Gallery / file picker (always available) */}
            <button onClick={() => fileRef.current?.click()} disabled={busy} title={t('photo.gallery')} style={{
              width:48, height:48, borderRadius:'50%', flexShrink:0,
              background:'var(--card)', border:'1px solid var(--brd)',
              color:'var(--dim)', cursor:'pointer', fontSize:20,
            }}>🖼</button>
          </div>

          <div style={{fontSize:10, color:'var(--mut)', textAlign:'center', letterSpacing:1}}>
            {supported ? t('photo.hint') : t('photo.hint_file')}
          </div>
        </div>
      </div>
    </div>
  );
}
