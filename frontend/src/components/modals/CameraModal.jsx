import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../../i18n.js';
import { useToast } from '../../Toast.jsx';
import { fileToSquareDataUrl } from '../../imageUtils.js';
import useEscClose from '../../hooks/useEscClose.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';

// ─── Platform detection ──────────────────────────────────────────────
// Used to surface platform-specific permission hints when the OS-level
// camera permission is denied. iOS Safari does NOT re-prompt after the
// first deny: the user has to walk into Settings > Safari > Fotocamera.
const isIOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

// ─── Inline SVG icons ────────────────────────────────────────────────
// Stroke-based, currentColor, 1.8 line-width — coherent with the rest of
// the editorial UI (no emoji, no icon-library dep).
const IconFlip = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 14.6-7.1L21 8"/>
    <path d="M21 4v4h-4"/>
    <path d="M21 12a9 9 0 0 1-14.6 7.1L3 16"/>
    <path d="M3 20v-4h4"/>
  </svg>
);

const IconGallery = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2"/>
    <circle cx="8.5" cy="10" r="1.4"/>
    <path d="m21 16-5-5L5 19"/>
  </svg>
);

const IconClose = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M6 6l12 12M18 6 6 18"/>
  </svg>
);

const IconCameraOff = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 2 22 22"/>
    <path d="M9.5 4h5l1.5 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-.6 1.4"/>
    <path d="M18 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1"/>
    <path d="M9.4 9.4a3 3 0 0 0 4.2 4.2"/>
  </svg>
);

const IconCamera = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4h-5l-1.5 2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.5z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

// ─── Component-local CSS (keyframes + :active fill) ──────────────────
const CSS = `
@keyframes camRingPulse {
  0%, 100% { box-shadow: 0 0 0 2px var(--gold), 0 0 22px rgba(196,168,120,.35), inset 0 0 0 1px rgba(255,255,255,.06); }
  50%      { box-shadow: 0 0 0 2px var(--gold), 0 0 38px rgba(232,184,75,.65), inset 0 0 0 1px rgba(255,255,255,.06); }
}
@keyframes camFadeIn { from { opacity: 0 } to { opacity: 1 } }
.cam-overlay { animation: camFadeIn .35s ease both; }
.cam-ring    { animation: camRingPulse 2.4s ease-in-out infinite; }
.cam-shutter-fill {
  position: absolute; inset: 6px; border-radius: 50%;
  background: radial-gradient(circle at 38% 32%, #e8b84b 0%, #c8973f 55%, #8a661f 100%);
  transform: scale(0); transform-origin: center;
  transition: transform .18s cubic-bezier(.34,1.05,.55,1);
  pointer-events: none;
}
.cam-shutter:active .cam-shutter-fill,
.cam-shutter.is-busy .cam-shutter-fill { transform: scale(1); }
.cam-orbit-btn {
  transition: transform .15s ease, border-color .18s ease, color .18s ease, opacity .18s ease;
}
.cam-orbit-btn:not(:disabled):active { transform: scale(.92); }
@media (hover: hover) and (pointer: fine) {
  .cam-orbit-btn:not(:disabled):hover { border-color: var(--gold); color: var(--gold); opacity: 1; }
  .cam-close:hover { color: var(--gold) !important; opacity: 1 !important; }
}
`;

// Robust camera modal:
//  - opens → request permission, start stream with facingMode preference
//  - close or unmount → MUST stop all video tracks (no zombie LEDs)
//  - flip toggles 'user' ↔ 'environment' with single-camera fallback
//  - capture grabs a square center-crop, returns base64 JPEG via onCapture
//  - error states get a custom panel (NOT the browser default)
export default function CameraModal({ onCapture, onClose, size = 1080, quality = 0.85 }) {
  useEscClose(onClose);
  useBodyScrollLock();
  const { t } = useLang();
  const toast = useToast();
  const videoRef  = useRef(null);
  const fileRef   = useRef(null);
  const streamRef = useRef(null);

  const [facingMode, setFacingMode] = useState('environment');
  const [hasMultipleCams, setHasMultipleCams] = useState(false);
  // Phases:
  //   'gate'      — initial. Permission rationale shown; nothing accessed.
  //                 User must tap Consenti to advance.
  //   'starting'  — getUserMedia in flight (post-Consenti tap).
  //   'live'      — stream attached, lens shows the video.
  //   'capturing' — shutter pressed, canvas grab in progress.
  //   'error'     — getUserMedia rejected (denied / no cam / in use).
  //
  // The rationale gate is shown the FIRST time the user opens the modal
  // on this device. After they tap Consenti and the camera starts
  // successfully, we set bc_cam_consent in localStorage; subsequent opens
  // skip straight to 'starting' so heavy users aren't nagged on every tap.
  const CONSENT_LS_KEY = 'bc_cam_consent';
  const [phase, setPhase] = useState(() => {
    try { return localStorage.getItem(CONSENT_LS_KEY) ? 'starting' : 'gate'; }
    catch { return 'gate'; }
  });
  const [error, setError] = useState(null);       // { msg, hint? }

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const buildErr = useCallback((e) => {
    const name = e?.name || '';
    if (name === 'NotAllowedError') {
      return {
        msg: t('photo.err_denied'),
        hint: isIOS ? t('photo.err_denied_ios') : t('photo.err_denied_android'),
      };
    }
    if (name === 'NotFoundError')    return { msg: t('photo.err_no_camera') };
    if (name === 'NotReadableError') return { msg: t('photo.err_in_use') };
    return { msg: e?.message || t('photo.err_unsupported') };
  }, [t]);

  const startCamera = useCallback(async (mode = facingMode) => {
    setError(null);
    setPhase('starting');
    stopStream();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError({ msg: t('photo.err_unsupported') });
      setPhase('error');
      return;
    }

    // Proactive permission check: on Android (Chrome) the browser
    // remembers a previous "deny" and won't re-prompt — getUserMedia just
    // throws NotAllowedError silently with no UI. Detecting this up front
    // lets us show the error state immediately with platform-specific
    // recovery instructions instead of waiting on a never-coming prompt.
    try {
      if (navigator.permissions?.query) {
        const perm = await navigator.permissions.query({ name: 'camera' });
        if (perm.state === 'denied') {
          setError({
            msg: t('photo.err_denied'),
            hint: isIOS ? t('photo.err_denied_ios') : t('photo.err_denied_android'),
          });
          setPhase('error');
          return;
        }
      }
    } catch { /* permissions API not supported — fall through to getUserMedia */ }

    let stream;
    try {
      // Prefer the requested facing direction.
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode } }, audio: false,
        });
      } catch (e1) {
        // Some single-cam devices reject 'environment'. Retry permissive.
        if (e1?.name === 'OverconstrainedError' || e1?.name === 'NotFoundError') {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw e1;
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // iOS sometimes needs an explicit play() after srcObject assignment.
        try { await videoRef.current.play(); } catch { /* will play on user gesture */ }
      }

      // Detect whether the device has >1 camera. We rely on enumerateDevices
      // AFTER permission is granted (otherwise labels are blank on some
      // browsers and the count is sometimes 0).
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultipleCams(devices.filter(d => d.kind === 'videoinput').length > 1);
      } catch { /* not fatal */ }

      // Sync facingMode state to whatever actually started (may differ on
      // single-cam fallback).
      const track = stream.getVideoTracks()[0];
      const actual = track?.getSettings?.().facingMode;
      if (actual === 'user' || actual === 'environment') setFacingMode(actual);

      // Remember that the user has consented once on this device, so the
      // next open of the modal skips the rationale gate and goes straight
      // to the camera. Revokes (NotAllowedError) still fall through to
      // the error panel which handles recovery.
      try { localStorage.setItem(CONSENT_LS_KEY, '1'); } catch {}

      setPhase('live');
    } catch (e) {
      console.error('[Camera]', e);
      setError(buildErr(e));
      setPhase('error');
    }
  }, [facingMode, stopStream, t, buildErr]);

  // ─── Lifecycle ─────────────────────────────────────────────────────
  // First-time users land on the 'gate' phase and must tap Consenti.
  // Returning users (consent flag in localStorage) bypass the gate — we
  // initialized phase to 'starting' above, and this effect kicks off the
  // actual getUserMedia call. Browsers that already remember the grant
  // do not require a user gesture for getUserMedia after first success,
  // so the auto-start path works without a prompt.
  useEffect(() => {
    if (phase === 'starting') {
      startCamera('environment');
    }
    return () => stopStream(); // unmount cleanup — turns the LED off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock the body scroll while the modal is open so the user can't
  // accidentally scroll the dashboard underneath and lose track of where
  // they are. Also prevents iOS rubber-banding through the overlay.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Android hardware back button → close cleanly
  useEffect(() => {
    const onPop = () => onClose?.();
    window.history.pushState({ cam: true }, '');
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flipCamera = () => {
    if (phase !== 'live') return;
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    startCamera(next);
  };

  const shoot = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || phase !== 'live') return;
    setPhase('capturing');
    try {
      const side = Math.min(v.videoWidth, v.videoHeight);
      const sx = (v.videoWidth  - side) / 2;
      const sy = (v.videoHeight - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      // Mirror the output when capturing from the front camera so the user
      // sees what they previewed (otherwise selfie text comes out reversed).
      if (facingMode === 'user') {
        ctx.translate(size, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(v, sx, sy, side, side, 0, 0, size, size);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      stopStream();
      onCapture?.(dataUrl);
      onClose?.();
    } catch (e) {
      console.error(e);
      toast.error(t('app.error_create'));
      setPhase('live');
    }
  };

  const pickFile = async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setPhase('capturing');
    try {
      const dataUrl = await fileToSquareDataUrl(f, size, quality);
      stopStream();
      onCapture?.(dataUrl);
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error(t('app.error_create'));
      setPhase(streamRef.current ? 'live' : 'error');
    }
  };

  // ─── Styles ────────────────────────────────────────────────────────
  // Lens size: min(60vw, 45vh, 280px). Conservative — guarantees the
  // lens fits both axes regardless of phone size, orientation, or
  // whether dvh is supported. On iPhone SE (375×667) lens = 225px.
  const LENS = 'min(60vw, 45vh, 280px)';
  const isLive  = phase === 'live';
  const isError = phase === 'error';

  const orbitBtn = (disabled) => ({
    width: 50, height: 50, borderRadius: '50%',
    background: 'rgba(255,255,255,.04)',
    border: '1px solid var(--brd)',
    color: disabled ? 'var(--mut)' : 'var(--dim)',
    opacity: disabled ? .35 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  });

  // Status pill text — always visible in the header so the user can SEE
  // what's happening even if a stage/dock region somehow fails to render.
  const statusText =
      phase === 'gate'      ? `· ${t('photo.gate_status')}`
    : phase === 'starting'  ? t('photo.starting')
    : phase === 'live'      ? (facingMode === 'user' ? '· FRONT' : '· REAR')
    : phase === 'capturing' ? '· ...'
    : '· ERR';

  // ─── Portal — escape the transformed ancestor ───────────────────
  // CameraModal is rendered inside BetCard, which lives inside the
  // dashboard's .sUp animation wrapper. .sUp applies `transform` →
  // that wrapper becomes a "containing block" for any descendant with
  // position:fixed, and the modal gets trapped inline inside the bet
  // card instead of covering the whole viewport. Rendering through a
  // portal into document.body bypasses the entire ancestor chain so
  // position:fixed + inset:0 fills the actual viewport.
  return createPortal((
    <div
      onClick={onClose}
      className="cam-overlay"
      style={{
        // position:fixed + inset:0 fills the visual viewport WITHOUT
        // relying on 100dvh — that was the Android collapse bug. We add
        // an explicit minHeight:100vh as a final safety net for very old
        // engines that mis-handle inset shorthand.
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        width: '100%', minHeight: '100vh',
        zIndex: 9700,
        // Solid background — radial-gradient with rgba on some Android
        // Chrome builds was rendering with broken alpha so the page
        // behind leaked through. Solid color is bulletproof.
        background: 'rgba(8, 6, 18, 0.96)',
        backdropFilter: 'blur(14px) saturate(120%)',
        WebkitBackdropFilter: 'blur(14px) saturate(120%)',
        // Flex column survives browsers where 1fr in grid collapses on
        // an indeterminate-height parent. Each row has explicit
        // flex-grow/shrink so the layout can't accidentally collapse.
        display: 'flex', flexDirection: 'column',
        paddingTop:    'env(safe-area-inset-top)',
        paddingRight:  'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft:   'env(safe-area-inset-left)',
        overflow: 'hidden',
      }}
    >
      <style>{CSS}</style>

      {/* ─── Header: status pill (left) + close X (right) ───────── */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flexShrink: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', minHeight: 56,
        }}
      >
        <div className="bc-meta" style={{
          fontSize: 9, letterSpacing: '.32em',
          color: isError ? 'var(--red)' : 'var(--gold)', opacity: .9,
          paddingLeft: 4,
        }}>{statusText}</div>
        <button
          onClick={onClose}
          className="cam-close"
          aria-label="Close"
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(255,255,255,.06)', border: '1px solid var(--brd)',
            color: 'var(--dim)', opacity: .9,
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            transition: 'color .18s ease, opacity .18s ease, border-color .18s ease',
          }}
        >
          <IconClose size={20}/>
        </button>
      </div>

      {/* ─── Stage: gate / lens / error panel — grows to fill ──── */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: '1 1 auto', minHeight: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '4px 16px',
        }}
      >
        {phase === 'gate' ? (
          // ─── Permission rationale ──────────────────────────────
          <div className="bIn" style={{
            maxWidth: 340, textAlign: 'center', color: 'var(--txt)',
          }}>
            <div style={{ color: 'var(--gold)', marginBottom: 14, display: 'inline-flex' }}>
              <IconCamera size={56}/>
            </div>
            <div className="bc-meta" style={{ marginBottom: 8, color: 'var(--gold)' }}>
              — {t('photo.gate_status')}
            </div>
            <div style={{
              fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
              fontSize: 'clamp(22px, 5.5vw, 28px)', fontWeight: 600,
              lineHeight: 1.2, letterSpacing: '-0.01em',
              marginBottom: 12, color: 'var(--txt)',
            }}>
              {t('photo.gate_title')}
            </div>
            <div style={{
              fontFamily: "'Manrope',sans-serif", fontSize: 13, lineHeight: 1.5,
              color: 'var(--dim)', marginBottom: 24,
            }}>
              {t('photo.gate_body')}
            </div>
            <button onClick={() => startCamera('environment')} style={{
              padding: '13px 28px', borderRadius: 999,
              background: 'var(--gold)', border: 'none',
              color: '#1a1530', cursor: 'pointer',
              fontFamily: "'Manrope',sans-serif", fontSize: 12, fontWeight: 800,
              letterSpacing: '.22em', textTransform: 'uppercase',
              boxShadow: '0 10px 28px rgba(196,168,120,.35)',
              marginBottom: 18,
              WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            }}>
              {t('photo.gate_consent')}
            </button>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                fontFamily: "'Manrope',sans-serif", fontSize: 12,
                color: 'var(--dim)', cursor: 'pointer',
                letterSpacing: '.02em', userSelect: 'none',
                padding: '6px 12px',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}
            >
              {t('photo.gate_gallery_link')}
            </div>
          </div>
        ) : isError ? (
          <div className="bIn" style={{
            maxWidth: 340, textAlign: 'center', color: 'var(--txt)',
          }}>
            <div style={{ color: 'var(--gold)', marginBottom: 14, display: 'inline-flex' }}>
              <IconCameraOff size={52}/>
            </div>
            <div className="bc-meta" style={{ marginBottom: 8, color: 'var(--gold)' }}>
              — {t('photo.permission_title')}
            </div>
            <div style={{
              fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
              fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 600,
              lineHeight: 1.2, letterSpacing: '-0.01em',
              marginBottom: 12, color: 'var(--txt)',
            }}>
              {error?.msg}
            </div>
            {error?.hint && (
              <div style={{
                fontFamily: "'Manrope',sans-serif", fontSize: 12.5, lineHeight: 1.5,
                color: 'var(--dim)', marginBottom: 4,
              }}>
                {error.hint}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            position: 'relative',
            width: LENS, height: LENS,
            borderRadius: '50%', overflow: 'hidden',
            background: '#0a0913',
          }} className="cam-ring">
            <video
              ref={videoRef}
              autoPlay playsInline muted
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover',
                display: isLive ? 'block' : 'none',
                transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              }}
            />
            {!isLive && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--dim)',
              }}>
                <div className="bc-meta" style={{
                  fontSize: 10, letterSpacing: '.3em',
                  // Higher contrast than before so the placeholder is
                  // actually readable while waiting on permission.
                  color: 'var(--gold)', opacity: .9,
                }}>{t('photo.starting')}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Dock: hidden during 'gate' (rationale has its own CTA) ─ */}
      {phase !== 'gate' && (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 'clamp(28px, 9vw, 56px)',
          padding: '14px 16px 22px',
        }}
      >
        {/* Flip — disabled when not live or only one cam */}
        <button
          onClick={flipCamera}
          disabled={!isLive || !hasMultipleCams}
          aria-label={t('photo.flip')}
          className="cam-orbit-btn"
          style={orbitBtn(!isLive || !hasMultipleCams)}
        >
          <IconFlip size={20}/>
        </button>

        {/* Shutter — in error state becomes a Retry button (same gold
            ring, refresh glyph) so the dock keeps the same shape and
            the user has one obvious primary action everywhere. */}
        {isError ? (
          <button
            onClick={() => startCamera(facingMode)}
            aria-label={t('photo.retry')}
            style={{
              position: 'relative',
              width: 82, height: 82, borderRadius: '50%',
              background: 'rgba(196,168,120,.08)',
              border: '3px solid var(--gold)',
              cursor: 'pointer',
              boxShadow: '0 0 24px rgba(196,168,120,.45), inset 0 0 0 4px rgba(15,11,35,.85)',
              flexShrink: 0,
              color: 'var(--gold)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <IconFlip size={26}/>
          </button>
        ) : (
          <button
            onClick={shoot}
            disabled={!isLive}
            aria-label={t('photo.shoot')}
            className={`cam-shutter${phase === 'capturing' ? ' is-busy' : ''}`}
            style={{
              position: 'relative',
              width: 82, height: 82, borderRadius: '50%',
              background: 'transparent',
              border: '3px solid var(--gold)',
              cursor: isLive ? 'pointer' : 'not-allowed',
              opacity: isLive ? 1 : .4,
              boxShadow: isLive
                ? '0 0 24px rgba(196,168,120,.45), inset 0 0 0 4px rgba(15,11,35,.85)'
                : 'inset 0 0 0 4px rgba(15,11,35,.85)',
              flexShrink: 0,
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <span className="cam-shutter-fill"/>
          </button>
        )}

        {/* Gallery — ALWAYS enabled (this is the escape hatch when
            camera permission is broken). */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={phase === 'capturing'}
          aria-label={t('photo.gallery')}
          className="cam-orbit-btn"
          style={orbitBtn(phase === 'capturing')}
        >
          <IconGallery size={20}/>
        </button>
      </div>
      )}

      <input
        ref={fileRef}
        type="file" accept="image/*"
        onChange={pickFile}
        style={{ display: 'none' }}
      />
    </div>
  ), document.body);
}
