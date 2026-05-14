import React, { useEffect, useState } from 'react';
import { COLORS } from './Atoms.jsx';
import useBodyScrollLock from '../hooks/useBodyScrollLock.js';

// Small popover triggered by tapping the user avatar in the header.
// Two actions: open the profile editor, or log out. Logout is two-step:
// first tap arms the button (shows "Conferma uscita"), second tap fires.
// 4-second arm timeout in case the user doesn't confirm — avoids a stale
// "click anywhere = logout" trap on the menu.
//
// Layout: centered modal with backdrop, same shell pattern as the trophy
// detail / invitees-peek modals. Works identically on desktop and mobile.
export default function ProfileAvatarMenu({ profile, t, onEdit, onLogout, onClose }) {
  useBodyScrollLock();
  const [armed, setArmed] = useState(false);
  const color = COLORS[profile?.colorKey] || '#5b8af0';
  const name = profile?.name || '';
  const avatar = profile?.avatar;
  const avatarUrl = profile?.avatarUrl;

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const itemBase = {
    display:'flex', alignItems:'center', gap:14,
    width:'100%', padding:'14px 18px', background:'transparent',
    border:'none', cursor:'pointer',
    fontFamily:"'Manrope',sans-serif", fontSize:14, fontWeight:600,
    color:'var(--txt)', textAlign:'left',
    transition:'background .12s',
  };

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:250,
      background:'rgba(8,6,18,.72)',
      backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    }}>
      <div onClick={e => e.stopPropagation()} className="bIn" style={{
        width:'100%', maxWidth:320,
        background:'var(--surf)', border:'1px solid var(--rule)',
        borderRadius:16, boxShadow:'0 30px 80px rgba(0,0,0,.55)',
        overflow:'hidden',
      }}>
        <div style={{
          display:'flex', alignItems:'center', gap:12,
          padding:'18px 18px 14px', borderBottom:'1px solid var(--rule)',
        }}>
          <div style={{
            width:44, height:44, borderRadius:'50%',
            background:`${color}33`, border:`2px solid ${color}88`,
            display:'flex', alignItems:'center', justifyContent:'center',
            overflow:'hidden', fontSize:20, lineHeight:1, flexShrink:0,
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/>
              : (avatar || '😊')}
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{
              fontFamily:"'Manrope',sans-serif",
              fontSize:15, fontWeight:700, color:'var(--txt)',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{name}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onEdit}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--soft)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          style={itemBase}
        >
          <span aria-hidden style={{fontSize:18, lineHeight:1, width:22, textAlign:'center'}}>✏️</span>
          <span>{t('settings.profile_menu_edit')}</span>
        </button>

        <div style={{height:1, background:'var(--rule)'}}/>

        <button
          type="button"
          onClick={() => {
            if (!armed) { setArmed(true); return; }
            onLogout?.();
          }}
          onMouseEnter={e => { e.currentTarget.style.background = armed ? 'var(--red)18' : 'var(--soft)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          style={{
            ...itemBase,
            color: armed ? 'var(--red)' : 'var(--txt)',
            background: armed ? 'var(--red)0e' : 'transparent',
          }}
        >
          <span aria-hidden style={{fontSize:18, lineHeight:1, width:22, textAlign:'center'}}>{armed ? '⚠' : '↪'}</span>
          <span>{armed ? t('settings.profile_menu_logout_confirm') : t('settings.profile_menu_logout')}</span>
        </button>
      </div>
    </div>
  );
}
