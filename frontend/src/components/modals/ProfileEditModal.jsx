import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Btn, Inp, AVATAR_CATEGORIES, COLORS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import { useToast } from '../../Toast.jsx';
import { fileToSquareDataUrl } from '../../imageUtils.js';
import * as api from '../../api.js';

export default function ProfileEditModal({ profile, onClose, onSaved }) {
  const { t } = useLang();
  const toast = useToast();

  const [name,        setName]        = useState(profile?.name      || '');
  const [avatar,      setAvatar]      = useState(profile?.avatar    || '🃏');
  const [colorKey,    setColorKey]    = useState(profile?.colorKey  || 'blue');
  const [avatarUrl,   setAvatarUrl]   = useState(profile?.avatarUrl || null);
  const [activeCat,   setActiveCat]   = useState(AVATAR_CATEGORIES[1].id); // default 'animals'
  const [busy,        setBusy]        = useState(false);
  const [photoBusy,   setPhotoBusy]   = useState(false);
  const fileRef = useRef(null);

  const c = COLORS[colorKey] || '#5b8af0';

  const handleFile = async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await fileToSquareDataUrl(f, 512, 0.85);
      const { avatar_url } = await api.uploadAvatar(dataUrl);
      setAvatarUrl(avatar_url);
    } catch { toast.error(t('app.error_create')); }
    finally { setPhotoBusy(false); }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try { await api.deleteAvatar(); setAvatarUrl(null); }
    catch { toast.error(t('app.error_cancel')); }
    finally { setPhotoBusy(false); }
  };

  const save = async () => {
    if (!name.trim()) { toast.error(t('auth.name_ph')); return; }
    setBusy(true);
    try {
      await api.updateProfile({ name: name.trim(), avatar, color_key: colorKey });
      onSaved?.({ name: name.trim(), avatar, colorKey, avatarUrl });
      toast.success(t('app.ok_edited'));
      onClose();
    } catch { toast.error(t('app.error_edit')); }
    finally { setBusy(false); }
  };

  const activeItems = (AVATAR_CATEGORIES.find(c => c.id === activeCat) || AVATAR_CATEGORIES[0]).items;

  const overlay = (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.85)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9100,
      padding:16, overflow:'hidden',
      fontFamily:"'Syne', sans-serif",
    }}>
      <div onClick={e => e.stopPropagation()} className="bIn" style={{
        background:'var(--surf)', border:'1px solid var(--brd)',
        borderRadius:18, width:'100%', maxWidth:520,
        maxHeight:'calc(100dvh - 32px)', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 64px rgba(0,0,0,.6)',
      }}>
        {/* Header */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'14px 18px', borderBottom:'1px solid var(--brd)',
          background:'linear-gradient(180deg, var(--surf), var(--card))',
          borderRadius:'18px 18px 0 0', flexShrink:0,
        }}>
          <div style={{fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700}}>
            {t('profile.edit_title')}
          </div>
          <button onClick={onClose} style={{
            background:'transparent', border:'1px solid var(--brd)', borderRadius:10,
            color:'var(--dim)', padding:'5px 11px', cursor:'pointer',
            fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:600,
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
                color:'var(--gold)', cursor:'pointer', fontFamily:"'Syne',sans-serif",
                fontSize:12, fontWeight:600, marginBottom:6,
                opacity: photoBusy ? .6 : 1,
              }}>{avatarUrl ? t('settings.photo_change') : t('settings.photo_upload')}</button>
              {avatarUrl && (
                <button onClick={removePhoto} disabled={photoBusy} style={{
                  display:'block', width:'100%', padding:'6px 12px', borderRadius:10,
                  background:'transparent', border:'1px solid var(--red)44', color:'var(--red)',
                  cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:600,
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
            {/* Grid */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(46px, 1fr))', gap:6}}>
              {activeItems.map(em => {
                const sel = avatar === em && !avatarUrl;
                return (
                  <div key={em} onClick={() => { setAvatar(em); }}
                    style={{
                      aspectRatio:'1/1', borderRadius:10, display:'flex',
                      alignItems:'center', justifyContent:'center', fontSize:24,
                      cursor:'pointer',
                      background: sel ? 'var(--gold)22' : 'var(--surf)',
                      border: `1px solid ${sel ? 'var(--gold)' : 'var(--brd)'}`,
                      transition:'all .12s',
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
  return typeof document !== 'undefined'
    ? createPortal(overlay, document.body)
    : overlay;
}
