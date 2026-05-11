import React, { useState, useRef } from 'react';
import { Btn, Inp, AVATARS, COLORS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import * as api from '../../api.js';
import { fileToSquareDataUrl } from '../../imageUtils.js';

const S = {
  wrap:  { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'var(--bg)' },
  card:  { width:'100%', maxWidth:400, background:'var(--card)', border:'1px solid var(--brd)', borderRadius:20, padding:32 },
  label: { fontSize:11, color:'var(--dim)', letterSpacing:2, textTransform:'uppercase', display:'block', marginBottom:6 },
  err:   { fontSize:13, color:'var(--red)', marginTop:8 },
};

export default function AuthView({ onAuth }) {
  const { t } = useLang();
  const [tab, setTab]         = useState('login');
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar]   = useState('😊');
  const [customAvatar, setCustomAvatar] = useState(null); // data URL preview
  const [colorKey, setColorKey] = useState('blue');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async e => {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow same file twice
    if (!f) return;
    try {
      const dataUrl = await fileToSquareDataUrl(f, 512, 0.85);
      setCustomAvatar(dataUrl);
    } catch { setError(t('auth.err_generic')); }
  };

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let result;
      if (tab === 'register') {
        if (!name.trim() || !email.includes('@') || password.length < 8) {
          setError(t('auth.err_fields'));
          setLoading(false);
          return;
        }
        result = await api.register({ email, password, name: name.trim(), avatar, color_key: colorKey });
        if (customAvatar && result?.token) {
          try {
            const { avatar_url } = await api.uploadAvatar(customAvatar, { token: result.token });
            result.user = { ...result.user, avatar_url };
          } catch { /* keep emoji fallback */ }
        }
      } else {
        result = await api.login(email, password);
      }
      onAuth(result);
    } catch (err) {
      if (err.status === 409) setError(t('auth.err_taken'));
      else if (err.status === 401) setError(t('auth.err_credentials'));
      else setError(t('auth.err_generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:34, fontWeight:900, marginBottom:6 }}>
            <span className="shim">BetCouple</span>
          </div>
          <div style={{ fontSize:12, color:'var(--dim)' }}>{t('welcome.subtitle')}</div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:24, background:'var(--surf)', borderRadius:10, padding:4 }}>
          {['login','register'].map(t2 => (
            <button key={t2} onClick={() => { setTab(t2); setError(''); }}
              style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer',
                fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:600,
                background: tab===t2 ? 'var(--gold)' : 'transparent',
                color: tab===t2 ? '#fff' : 'var(--dim)', transition:'all .18s' }}>
              {t2 === 'register' ? t('auth.tab_register') : t('auth.tab_login')}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          {tab === 'register' && (
            <>
              <div style={{ marginBottom:14 }}>
                <label style={S.label}>{t('auth.name_ph')}</label>
                <Inp value={name} onChange={e => setName(e.target.value)} placeholder={t('auth.name_ph')} />
              </div>

              {/* Avatar picker */}
              <div style={{ marginBottom:14 }}>
                <label style={S.label}>{t('settings.avatar_label')}</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
                  {/* Upload custom photo */}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile}
                    style={{ display:'none' }} />
                  <div onClick={() => fileInputRef.current?.click()} title="Carica foto"
                    style={{ width:36, height:36, borderRadius:8, display:'flex', alignItems:'center',
                      justifyContent:'center', cursor:'pointer', overflow:'hidden',
                      background: customAvatar ? 'var(--gold)22' : 'var(--surf)',
                      border:`1px solid ${customAvatar ? 'var(--gold)' : 'var(--brd)'}` }}>
                    {customAvatar
                      ? <img src={customAvatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      : <span style={{fontSize:18}}>📷</span>}
                  </div>
                  {customAvatar && (
                    <button type="button" onClick={() => setCustomAvatar(null)}
                      style={{ width:24, height:24, borderRadius:'50%', border:'none',
                        background:'var(--red)33', color:'var(--red)', cursor:'pointer', fontSize:11, marginRight:4 }}>✕</button>
                  )}
                  {AVATARS.slice(0,11).map(a => (
                    <div key={a} onClick={() => { setAvatar(a); setCustomAvatar(null); }}
                      style={{ width:36, height:36, borderRadius:8, display:'flex', alignItems:'center',
                        justifyContent:'center', fontSize:20, cursor:'pointer',
                        background: !customAvatar && avatar===a ? 'var(--gold)22' : 'var(--surf)',
                        border:`1px solid ${!customAvatar && avatar===a ? 'var(--gold)' : 'var(--brd)'}` }}>
                      {a}
                    </div>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div style={{ marginBottom:14 }}>
                <label style={S.label}>{t('settings.color_label')}</label>
                <div style={{ display:'flex', gap:8 }}>
                  {Object.entries(COLORS).map(([k, hex]) => (
                    <div key={k} onClick={() => setColorKey(k)}
                      style={{ width:26, height:26, borderRadius:'50%', background:hex, cursor:'pointer',
                        border:`3px solid ${colorKey===k ? '#fff' : 'transparent'}`,
                        boxShadow: colorKey===k ? `0 0 8px ${hex}` : 'none' }} />
                  ))}
                </div>
              </div>
            </>
          )}

          <div style={{ marginBottom:14 }}>
            <label style={S.label}>{t('auth.email_ph')}</label>
            <Inp type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('auth.email_ph')} />
          </div>

          <div style={{ marginBottom:20 }}>
            <label style={S.label}>{t('auth.password_ph')}</label>
            <Inp type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('auth.password_ph')} />
          </div>

          {error && <div style={S.err}>{error}</div>}

          <button type="submit" disabled={loading}
            style={{ width:'100%', marginTop:16, padding:'13px 0', borderRadius:12, border:'none',
              background:'var(--gold)', color:'#07060f', fontFamily:"'Syne',sans-serif",
              fontSize:15, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, boxShadow:'0 4px 16px var(--glow)' }}>
            {loading ? '…' : tab === 'register' ? t('auth.register_btn') : t('auth.login_btn')}
          </button>
        </form>
      </div>
    </div>
  );
}
