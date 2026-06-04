import React, { useState, useRef } from 'react';
import { Btn, Inp, AVATARS, COLORS, VincitWordmark } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import * as api from '../../api.js';
import { fileToSquareDataUrl } from '../../imageUtils.js';
import { validatePassword } from '../../passwordPolicy.js';

// Editorial entrance — no card, just whitespace + ample type.
const S = {
  wrap:  { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 28px', background:'var(--bg)' },
  shell: { width:'100%', maxWidth:440 },
  label: { fontSize:9, color:'var(--dim)', letterSpacing:'.3em', textTransform:'uppercase', fontWeight:600, display:'block', marginBottom:8 },
  err:   { fontSize:12, color:'var(--red)', marginTop:14, fontWeight:600 },
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
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState(null); // {type:'ok'|'err', text:string}
  const [forgotBusy, setForgotBusy] = useState(false);
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

  const submitForgot = async e => {
    e.preventDefault();
    if (!forgotEmail.includes('@')) { setForgotMsg({ type: 'err', text: t('auth.forgot_err_email') }); return; }
    setForgotBusy(true); setForgotMsg(null);
    try {
      await api.forgotPassword(forgotEmail.trim().toLowerCase());
      setForgotMsg({ type: 'ok', text: t('auth.forgot_ok') });
    } catch (err) {
      setForgotMsg({ type: 'err', text: t('auth.forgot_err_generic') });
    } finally { setForgotBusy(false); }
  };

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let result;
      if (tab === 'register') {
        if (!name.trim() || !email.includes('@')) {
          setError(t('auth.err_fields'));
          setLoading(false);
          return;
        }
        const pwErr = validatePassword(password);
        if (pwErr) {
          setError(t(`pw.${pwErr.replace('password_', '')}`));
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
      const code = err?.message || '';
      if (err.status === 409) setError(t('auth.err_taken'));
      else if (err.status === 401) setError(t('auth.err_credentials'));
      else if (code.startsWith('password_')) setError(t(`pw.${code.replace('password_', '')}`));
      else setError(t('auth.err_generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.wrap}>
      <div style={S.shell}>
        {/* Editorial masthead */}
        <div style={{ marginBottom:48 }}>
          <div className="bc-meta" style={{ marginBottom:14 }}>
            {tab === 'register' ? '— Iscriviti' : '— Bentornato'}
          </div>
          <div style={{ marginBottom:10 }}>
            <VincitWordmark size={64} />
          </div>
          <div style={{ fontSize:13, color:'var(--dim)', lineHeight:1.6 }}>{t('welcome.subtitle')}</div>
        </div>

        {/* Tabs — underline only, no box */}
        <div style={{ display:'flex', gap:28, marginBottom:36, borderBottom:'1px solid var(--rule)' }}>
          {['login','register'].map(t2 => (
            <button key={t2} onClick={() => { setTab(t2); setError(''); }}
              style={{ padding:'6px 0 14px', border:'none', cursor:'pointer',
                background:'transparent',
                fontFamily:"'Manrope',sans-serif",
                fontSize:11, fontWeight:600, letterSpacing:'.22em', textTransform:'uppercase',
                borderBottom:`2px solid ${tab===t2 ? 'var(--gold)' : 'transparent'}`,
                marginBottom:-1,
                color: tab===t2 ? 'var(--txt)' : 'var(--dim)', transition:'all .18s' }}>
              {t2 === 'register' ? t('auth.tab_register') : t('auth.tab_login')}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          {tab === 'register' && (
            <>
              <div style={{ marginBottom:24 }}>
                <label style={S.label}>{t('auth.name_ph')}</label>
                <Inp value={name} onChange={e => setName(e.target.value)} placeholder={t('auth.name_ph')} />
              </div>

              {/* Avatar picker */}
              <div style={{ marginBottom:24 }}>
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
              <div style={{ marginBottom:24 }}>
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

          <div style={{ marginBottom:24 }}>
            <label style={S.label}>{t('auth.email_ph')}</label>
            <Inp type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('auth.email_ph')} />
          </div>

          <div style={{ marginBottom:32 }}>
            <label style={S.label}>{t('auth.password_ph')}</label>
            <Inp type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('auth.password_ph')} />
            {tab === 'register' && (() => {
              const pwErr = password ? validatePassword(password) : null;
              const tone  = !password ? 'var(--dim)' : pwErr ? 'var(--red)' : 'var(--grn)';
              const msg   = !password ? t('pw.hint') : pwErr ? t(`pw.${pwErr.replace('password_', '')}`) : t('pw.ok');
              return <div style={{ marginTop:6, fontSize:11, color:tone, fontWeight:600 }}>{msg}</div>;
            })()}
          </div>

          {error && <div style={S.err}>{error}</div>}

          {tab === 'login' && (
            <div style={{ textAlign: 'right', marginTop: 4 }}>
              <button type="button"
                onClick={() => { setForgotEmail(email); setForgotOpen(true); setForgotMsg(null); }}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--dim)', fontSize: 12, padding: 0, textDecoration: 'underline',
                  fontFamily: "'Manrope',sans-serif",
                }}>
                {t('auth.forgot_link')}
              </button>
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width:'100%', marginTop:28, padding:'17px 0', borderRadius:999, border:'none',
              background:'var(--pur)', color:'#1a1530', fontFamily:"'Manrope',sans-serif",
              fontSize:13, fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow:'0 14px 36px -12px var(--pur), 0 1px 0 rgba(255,255,255,.15) inset' }}>
            {loading ? '…' : tab === 'register' ? t('auth.register_btn') : t('auth.login_btn')}
          </button>
        </form>
      </div>

      {forgotOpen && (
        <div onClick={() => setForgotOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} className="bIn" style={{
            background: 'var(--surf)', border: '1px solid var(--brd)',
            borderRadius: 18, width: '100%', maxWidth: 380, padding: 22,
            boxShadow: '0 24px 64px rgba(0,0,0,.6)',
          }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 19, fontWeight: 700, marginBottom: 8 }}>
              🔑 {t('auth.forgot_title')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 16 }}>
              {t('auth.forgot_body')}
            </div>
            <form onSubmit={submitForgot}>
              <Inp type="email" value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                placeholder={t('auth.email_ph')} />
              {forgotMsg && (
                <div style={{
                  marginTop: 10, padding: '10px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.5,
                  background: forgotMsg.type === 'err' ? 'var(--red)18' : 'var(--grn)18',
                  border: `1px solid ${forgotMsg.type === 'err' ? 'var(--red)44' : 'var(--grn)44'}`,
                  color: forgotMsg.type === 'err' ? 'var(--red)' : 'var(--grn)',
                  wordBreak: 'break-all',
                }}>
                  {forgotMsg.text}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setForgotOpen(false)} style={{
                  padding: '8px 14px', borderRadius: 10,
                  background: 'transparent', border: '1px solid var(--brd)',
                  color: 'var(--dim)', cursor: 'pointer',
                  fontFamily: "'Manrope',sans-serif", fontSize: 13, fontWeight: 600,
                }}>{t('reveal.cancel')}</button>
                <button type="submit" disabled={forgotBusy} style={{
                  padding: '10px 18px', borderRadius: 10, border: 'none',
                  background: 'var(--gold)', color: '#07060f',
                  fontFamily: "'Manrope',sans-serif", fontSize: 13, fontWeight: 800,
                  cursor: forgotBusy ? 'wait' : 'pointer', opacity: forgotBusy ? 0.7 : 1,
                }}>{forgotBusy ? '…' : t('auth.forgot_send')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
