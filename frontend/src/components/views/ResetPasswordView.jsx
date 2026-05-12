import React, { useState } from 'react';
import { Inp } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import * as api from '../../api.js';

const S = {
  wrap: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'var(--bg)' },
  card: { width:'100%', maxWidth:400, background:'var(--card)', border:'1px solid var(--brd)', borderRadius:20, padding:32 },
  label:{ fontSize:11, color:'var(--dim)', letterSpacing:2, textTransform:'uppercase', display:'block', marginBottom:6 },
};

export default function ResetPasswordView({ token, onDone }) {
  const { t } = useLang();
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone]   = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError(null);
    if (pw1.length < 8)       { setError(t('reset.err_short')); return; }
    if (pw1 !== pw2)          { setError(t('reset.err_mismatch')); return; }
    setBusy(true);
    try {
      await api.resetPassword(token, pw1);
      setDone(true);
    } catch (err) {
      const code = err?.message || '';
      const msg = code === 'token_used' || code === 'token_expired' || code === 'invalid_token'
        ? t('reset.err_token')
        : code === 'password_too_short'
          ? t('reset.err_short')
          : t('reset.err_generic');
      setError(msg);
    } finally { setBusy(false); }
  };

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 900, marginBottom: 6 }}>
            <span className="shim">BetCouple</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--dim)' }}>{t('reset.subtitle')}</div>
        </div>

        {done ? (
          <>
            <div style={{
              padding: 18, borderRadius: 14,
              background: 'var(--grn)18', border: '1px solid var(--grn)55',
              color: 'var(--grn)', textAlign: 'center', fontSize: 14, fontWeight: 600,
              marginBottom: 14,
            }}>
              ✓ {t('reset.done')}
            </div>
            <button onClick={onDone} style={{
              width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
              background: 'var(--gold)', color: '#07060f', fontFamily: "'Syne',sans-serif",
              fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px var(--glow)',
            }}>
              {t('reset.go_login')}
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>{t('reset.new_password')}</label>
              <Inp type="password" value={pw1} onChange={e => setPw1(e.target.value)} placeholder={t('reset.placeholder')} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>{t('reset.confirm_password')}</label>
              <Inp type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder={t('reset.placeholder')} />
            </div>
            {error && (
              <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 8 }}>{error}</div>
            )}
            <button type="submit" disabled={busy} style={{
              width: '100%', marginTop: 8, padding: '13px 0', borderRadius: 12, border: 'none',
              background: 'var(--gold)', color: '#07060f', fontFamily: "'Syne',sans-serif",
              fontSize: 15, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.7 : 1, boxShadow: '0 4px 16px var(--glow)',
            }}>{busy ? '…' : t('reset.confirm_btn')}</button>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button type="button" onClick={onDone} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--dim)', fontSize: 12, padding: 0, textDecoration: 'underline',
              }}>{t('reset.cancel_link')}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
