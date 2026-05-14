import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Btn, Inp, AVATAR_CATEGORIES, COLORS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import { useToast } from '../../Toast.jsx';
import { readImageFile, cropImageToSquare } from '../../imageUtils.js';
import PhotoCropModal from './PhotoCropModal.jsx';
import * as api from '../../api.js';
import useEscClose from '../../hooks/useEscClose.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';

export default function ProfileEditModal({ profile, onClose, onSaved }) {
  useEscClose(onClose);
  useBodyScrollLock();
  const { t } = useLang();
  const toast = useToast();

  const [name,        setName]        = useState(profile?.name      || '');
  const [avatar,      setAvatar]      = useState(profile?.avatar    || '🃏');
  const [colorKey,    setColorKey]    = useState(profile?.colorKey  || 'blue');
  const [avatarUrl,   setAvatarUrl]   = useState(profile?.avatarUrl || null);
  const [activeCat,   setActiveCat]   = useState(AVATAR_CATEGORIES[1].id); // default 'animals'
  const [busy,        setBusy]        = useState(false);
  const [photoBusy,   setPhotoBusy]   = useState(false);
  const [cropSrc,     setCropSrc]     = useState(null); // { img, dataUrl } when crop modal is open
  // When a photo is uploaded the emoji acts as a silent fallback. If the user
  // taps an emoji we treat that as an intent to actually use it: stash the
  // pending pick and ask whether to also drop the photo. If they decline, the
  // emoji is still saved as the fallback.
  const [pendingEmoji, setPendingEmoji] = useState(null);
  const fileRef = useRef(null);

  const c = COLORS[colorKey] || '#5b8af0';

  const reportPhotoError = err => {
    console.error('[profile-avatar-upload]', err);
    const code = err?.message || '';
    const key = (code === 'decode_failed' || code === 'not_an_image' || code === 'invalid_image')
      ? 'profile.err_format'
      : (code === 'file_too_large' || code === 'image_too_large')
        ? 'profile.err_too_big'
        : (code === 'image_upload_unavailable')
          ? 'profile.err_unavailable'
          : 'profile.err_upload';
    toast.error(t(key));
  };

  // Pick file → decode → open the crop modal (or upload as-is for HEIC).
  const handleFile = async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setPhotoBusy(true);
    try {
      const { dataUrl, img, heicFallback } = await readImageFile(f);
      if (heicFallback) {
        // Can\'t crop client-side; let Cloudinary center-crop with gravity:face.
        const { avatar_url } = await api.uploadAvatar(dataUrl);
        setAvatarUrl(avatar_url);
        toast.success(t('profile.ok_uploaded'));
        setPhotoBusy(false);
        return;
      }
      // Open the reposition / zoom UI.
      setCropSrc({ img, dataUrl });
    } catch (err) {
      reportPhotoError(err);
    } finally { setPhotoBusy(false); }
  };

  // Called once the user confirms the crop region.
  const handleCropConfirm = async (croppedDataUrl) => {
    setCropSrc(null);
    setPhotoBusy(true);
    try {
      const { avatar_url } = await api.uploadAvatar(croppedDataUrl);
      setAvatarUrl(avatar_url);
      toast.success(t('profile.ok_uploaded'));
    } catch (err) {
      reportPhotoError(err);
    } finally { setPhotoBusy(false); }
  };

  // Emoji tile click. If there's no photo, just update the state. If there
  // IS a photo, stage the pick and surface a small prompt so the user can
  // choose to actually use the emoji (drops the photo) or keep it as fallback.
  const handlePickEmoji = (em) => {
    setAvatar(em);
    if (avatarUrl) setPendingEmoji(em);
  };

  const confirmReplaceWithEmoji = async () => {
    if (!avatarUrl) { setPendingEmoji(null); return; }
    setPhotoBusy(true);
    try {
      await api.deleteAvatar();
      setAvatarUrl(null);
      toast.success(t('profile.ok_removed'));
    } catch (err) {
      console.error('[profile-avatar-replace]', err);
      toast.error(t('profile.err_remove'));
    } finally {
      setPhotoBusy(false);
      setPendingEmoji(null);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      await api.deleteAvatar();
      setAvatarUrl(null);
      toast.success(t('profile.ok_removed'));
    } catch (err) {
      console.error('[profile-avatar-remove]', err);
      toast.error(t('profile.err_remove'));
    } finally { setPhotoBusy(false); }
  };

  const save = async () => {
    if (!name.trim()) { toast.error(t('auth.name_ph')); return; }
    setBusy(true);
    try {
      await api.updateProfile({ name: name.trim(), avatar, color_key: colorKey });
      onSaved?.({ name: name.trim(), avatar, colorKey, avatarUrl });
      toast.success(t('app.ok_profile_saved'));
      onClose();
    } catch { toast.error(t('app.error_edit')); }
    finally { setBusy(false); }
  };

  const activeItems = (AVATAR_CATEGORIES.find(c => c.id === activeCat) || AVATAR_CATEGORIES[0]).items;

  const overlay = (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(15,11,35,.78)',
      backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9100,
      padding:24, overflow:'hidden',
      fontFamily:"'Manrope', sans-serif",
    }}>
      <div onClick={e => e.stopPropagation()} className="bIn" style={{
        background:'var(--surf)', border:'1px solid var(--rule)',
        borderRadius:6, width:'100%', maxWidth:520,
        maxHeight:'calc(100dvh - 48px)', display:'flex', flexDirection:'column',
        boxShadow:'0 30px 80px rgba(0,0,0,.55)',
      }}>
        {/* Header */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'flex-end',
          padding:'24px 28px 18px', borderBottom:'1px solid var(--rule)',
          flexShrink:0,
        }}>
          <div>
            <div className="bc-meta" style={{marginBottom:8}}>— Profilo</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic', fontSize:24, fontWeight:600, lineHeight:1, color:'var(--txt)'}}>
              {t('profile.edit_title')}
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'transparent', border:'none', cursor:'pointer',
            color:'var(--dim)', fontSize:18, padding:4,
          }}>✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{padding:'16px 18px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:16}}>
          {/* Big preview + photo upload */}
          <div style={{display:'flex', alignItems:'center', gap:14}}>
            <div style={{
              width:78, height:78, borderRadius:'50%',
              background:`${c}33`, border:`3px solid ${c}66`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:40, overflow:'hidden', flexShrink:0,
              boxShadow:`0 0 16px ${c}33`,
            }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                : avatar}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:'none'}}/>
              <button onClick={() => fileRef.current?.click()} disabled={photoBusy} style={{
                display:'block', width:'100%', padding:'8px 12px', borderRadius:10,
                background:'var(--gold)22', border:'1px solid var(--gold)44',
                color:'var(--gold)', cursor:'pointer', fontFamily:"'Manrope',sans-serif",
                fontSize:12, fontWeight:600, marginBottom:6,
                opacity: photoBusy ? .6 : 1,
              }}>{avatarUrl ? t('settings.photo_change') : t('settings.photo_upload')}</button>
              {avatarUrl && (
                <button onClick={removePhoto} disabled={photoBusy} style={{
                  display:'block', width:'100%', padding:'6px 12px', borderRadius:10,
                  background:'transparent', border:'1px solid var(--red)44', color:'var(--red)',
                  cursor:'pointer', fontFamily:"'Manrope',sans-serif", fontSize:11, fontWeight:600,
                  opacity: photoBusy ? .6 : 1,
                }}>{t('settings.photo_remove')}</button>
              )}
              {photoBusy && <div style={{fontSize:11, color:'var(--dim)', marginTop:4}}>{t('settings.photo_uploading')}</div>}
            </div>
          </div>

          {/* Name */}
          <div>
            <label style={{fontSize:10, color:'var(--dim)', letterSpacing:2, textTransform:'uppercase', fontWeight:700, display:'block', marginBottom:6}}>
              {t('auth.name_ph')}
            </label>
            <Inp value={name} onChange={e => setName(e.target.value.slice(0, 24))} placeholder={t('auth.name_ph')}/>
          </div>

          {/* Color */}
          <div>
            <label style={{fontSize:10, color:'var(--dim)', letterSpacing:2, textTransform:'uppercase', fontWeight:700, display:'block', marginBottom:8}}>
              {t('settings.color_label')}
            </label>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {Object.entries(COLORS).map(([k, hex]) => (
                <div key={k} onClick={() => setColorKey(k)}
                  style={{
                    width:30, height:30, borderRadius:'50%', background:hex, cursor:'pointer',
                    border: `3px solid ${colorKey === k ? '#fff' : 'transparent'}`,
                    boxShadow: colorKey === k ? `0 0 10px ${hex}aa` : 'none',
                    transition:'all .15s',
                  }}/>
              ))}
            </div>
          </div>

          {/* Avatar — category tabs + grid */}
          <div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6}}>
              <label style={{fontSize:10, color:'var(--dim)', letterSpacing:2, textTransform:'uppercase', fontWeight:700}}>
                {t('settings.avatar_label')}{avatarUrl ? t('settings.photo_fallback') : ''}
              </label>
            </div>
            {/* Category tab strip — icon-only, all 7 visible on a single row */}
            <div style={{display:'grid', gridTemplateColumns:`repeat(${AVATAR_CATEGORIES.length}, 1fr)`, gap:4, marginBottom:6}}>
              {AVATAR_CATEGORIES.map(cat => {
                const active = activeCat === cat.id;
                return (
                  <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                    title={t('profile.cat_'+cat.id)}
                    style={{
                      padding:'8px 0', borderRadius:10,
                      border:`1px solid ${active ? 'var(--gold)' : 'var(--brd)'}`,
                      background: active ? 'var(--gold)22' : 'var(--surf)',
                      color: active ? 'var(--gold)' : 'var(--dim)',
                      cursor:'pointer', fontSize:20, lineHeight:1, transition:'all .15s',
                    }}>
                    {cat.icon}
                  </button>
                );
              })}
            </div>
            {/* Label of the currently-selected category */}
            <div style={{fontSize:10, color:'var(--dim)', letterSpacing:2, textTransform:'uppercase', fontWeight:700, marginBottom:8, textAlign:'center'}}>
              {t('profile.cat_'+activeCat)}
            </div>

            {/* Replace-photo prompt — only when user taps emoji while a photo
                is uploaded. Lets them either drop the photo or keep the emoji
                as silent fallback. */}
            {pendingEmoji && avatarUrl && (
              <div style={{
                marginBottom:10, padding:'10px 12px',
                borderRadius:10, background:'var(--gold)11',
                border:'1px solid var(--gold)44',
                display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
              }}>
                <div style={{fontSize:24, lineHeight:1}}>{pendingEmoji}</div>
                <div style={{flex:1, minWidth:120, fontSize:12, color:'var(--txt)'}}>
                  {t('profile.replace_q')}
                </div>
                <div style={{display:'flex', gap:6, flexShrink:0}}>
                  <button onClick={() => setPendingEmoji(null)} disabled={photoBusy}
                    style={{
                      padding:'6px 12px', borderRadius:999,
                      background:'transparent', border:'1px solid var(--brd)',
                      color:'var(--dim)', fontSize:11, fontWeight:600,
                      cursor: photoBusy ? 'wait' : 'pointer',
                      fontFamily:"'Manrope',sans-serif",
                    }}>{t('profile.replace_no')}</button>
                  <button onClick={confirmReplaceWithEmoji} disabled={photoBusy}
                    style={{
                      padding:'6px 12px', borderRadius:999,
                      background:'var(--gold)', border:'none',
                      color:'#1a1530', fontSize:11, fontWeight:700,
                      cursor: photoBusy ? 'wait' : 'pointer',
                      fontFamily:"'Manrope',sans-serif",
                    }}>{t('profile.replace_yes')}</button>
                </div>
              </div>
            )}
            {/* Grid */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(46px, 1fr))', gap:6}}>
              {activeItems.map(em => {
                // Always reflect the selected emoji visually, even when a photo
                // is uploaded — otherwise clicking emojis appears to do nothing
                // (the photo overrides the preview and the selection ring was
                // suppressed). The fallback hint below explains the precedence.
                const sel = avatar === em;
                return (
                  <div key={em} onClick={() => { handlePickEmoji(em); }}
                    style={{
                      aspectRatio:'1/1', borderRadius:10, display:'flex',
                      alignItems:'center', justifyContent:'center', fontSize:24,
                      cursor:'pointer',
                      background: sel ? 'var(--gold)22' : 'var(--surf)',
                      border: `1px solid ${sel ? 'var(--gold)' : 'var(--brd)'}`,
                      transition:'all .12s',
                      WebkitTapHighlightColor:'transparent',
                      touchAction:'manipulation',
                      userSelect:'none',
                    }}>{em}</div>
                );
              })}
            </div>
            {avatarUrl && (
              <div style={{fontSize:10, color:'var(--mut)', marginTop:8, fontStyle:'italic', lineHeight:1.4}}>
                {t('profile.fallback_hint')}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display:'flex', gap:8, justifyContent:'flex-end',
          padding:'12px 18px', borderTop:'1px solid var(--brd)', flexShrink:0,
        }}>
          <Btn variant="ghost" onClick={onClose}>{t('reveal.cancel')}</Btn>
          <Btn variant="gold" onClick={save} disabled={busy} style={{padding:'10px 22px'}}>
            {busy ? '...' : t('settings.pin_save')}
          </Btn>
        </div>
      </div>
    </div>
  );

  // Portal to document.body so the modal escapes any ancestor with a
  // `transform` (the `sUp` animation on the view root creates a containing
  // block that would otherwise pin position:fixed to the scrolled page).
  return (
    <>
      {typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay}
      {cropSrc && (
        <PhotoCropModal
          img={cropSrc.img}
          dataUrl={cropSrc.dataUrl}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </>
  );
}
