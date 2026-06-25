import React, { useState } from 'react';
import { Btn, Inp, VincitWordmark } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import * as api from '../../api.js';

const S = {
  btn: { display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 18px', borderRadius:10, border:'none', cursor:'pointer', fontFamily:"'Archivo',sans-serif", fontSize:13, fontWeight:600, transition:'all .18s', userSelect:'none', whiteSpace:'nowrap' },
};

const EMOJIS = ['🎲','⚡','🎯','🔥','💜','🌙','🏆','🎮','🍕','🎸'];

export default function PairingView({ user, onGroupCreated }) {
  const { t } = useLang();
  const [tab,     setTab]     = useState('create');
  const [name,    setName]    = useState('');
  const [emoji,   setEmoji]   = useState('🎲');
  const [code,    setCode]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true); setError('');
    try {
      const group = await api.createGroup({ name: name.trim(), emoji });
      onGroupCreated(group);
    } catch { setError(t('group.err_generic')); }
    finally { setLoading(false); }
  };

  const handleJoin = async () => {
    if (code.length < 6) return;
    setLoading(true); setError('');
    try {
      const group = await api.joinGroup(code);
      onGroupCreated(group);
    } catch (e) {
      if (e.data?.error === 'already_member')       setError(t('group.err_already_member'));
      else if (e.data?.error === 'group_full')      setError(t('group.err_full'));
      else if (e.data?.error === 'invite_expired') setError(t('group.err_invite_expired'));
      else                                          setError(t('group.err_invalid_code'));
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ marginBottom:6 }}>
            <VincitWordmark size={34} />
          </div>
          <div style={{ fontSize:22, marginTop:4 }}>👋 {user.name}</div>
          <div style={{ fontSize:13, color:'var(--dim)', marginTop:6 }}>{t('group.pairing_subtitle')}</div>
        </div>

        {/* Tab switcher */}
        <div style={{ display:'flex', gap:6, marginBottom:20, background:'var(--card)', borderRadius:12, padding:4, border:'1px solid var(--brd)' }}>
          {['create','join'].map(tab_id => (
            <button key={tab_id} onClick={() => { setTab(tab_id); setError(''); }}
              style={{ ...S.btn, flex:1, padding:'10px 0', fontSize:13,
                background: tab === tab_id ? 'var(--gold)' : 'transparent',
                color:      tab === tab_id ? '#07060f'      : 'var(--dim)',
                border:     'none', borderRadius:8 }}>
              {tab_id === 'create' ? t('group.tab_create') : t('group.tab_join')}
            </button>
          ))}
        </div>

        {tab === 'create' && (
          <div className="sUp" style={{ background:'var(--card)', border:'1px solid var(--brd)', borderRadius:20, padding:28 }}>
            <div style={{ fontSize:11, color:'var(--dim)', letterSpacing:2, textTransform:'uppercase', marginBottom:10 }}>
              {t('group.name_label')}
            </div>
            <Inp value={name} onChange={e => setName(e.target.value)}
              placeholder={t('group.name_ph')} style={{ marginBottom:16 }} />

            <div style={{ fontSize:11, color:'var(--dim)', letterSpacing:2, textTransform:'uppercase', marginBottom:8 }}>
              {t('group.emoji_label')}
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  style={{ width:42, height:42, borderRadius:10, border:`2px solid ${emoji===e?'var(--gold)':'var(--brd)'}`,
                    background: emoji===e?'var(--gold)22':'transparent', cursor:'pointer', fontSize:22,
                    transition:'all .15s' }}>
                  {e}
                </button>
              ))}
            </div>

            {error && <div style={{ fontSize:13, color:'var(--red)', marginBottom:12 }}>{error}</div>}
            <button onClick={handleCreate} disabled={!name.trim() || loading}
              style={{ ...S.btn, width:'100%', padding:'13px 0', fontSize:15, justifyContent:'center',
                background: name.trim() ? 'var(--gold)' : 'var(--mut)',
                color:      name.trim() ? '#07060f' : 'var(--dim)',
                border:'none', borderRadius:12,
                opacity: loading ? 0.7 : 1 }}>
              {loading ? '…' : t('group.create_btn')}
            </button>
          </div>
        )}

        {tab === 'join' && (
          <div className="sUp" style={{ background:'var(--card)', border:'1px solid var(--brd)', borderRadius:20, padding:28 }}>
            <div style={{ fontSize:11, color:'var(--dim)', letterSpacing:2, textTransform:'uppercase', marginBottom:10 }}>
              {t('group.code_label')}
            </div>
            <Inp value={code}
              onChange={e => { setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6)); setError(''); }}
              placeholder={t('group.code_ph')}
              style={{ textAlign:'center', letterSpacing:6, fontSize:24, fontFamily:'monospace', marginBottom:16 }} />
            {error && <div style={{ fontSize:13, color:'var(--red)', marginBottom:12 }}>{error}</div>}
            <button onClick={handleJoin} disabled={code.length < 6 || loading}
              style={{ ...S.btn, width:'100%', padding:'13px 0', fontSize:15, justifyContent:'center',
                background: code.length >= 6 ? 'var(--gold)' : 'var(--mut)',
                color:      code.length >= 6 ? '#07060f' : 'var(--dim)',
                border:'none', borderRadius:12,
                opacity: loading ? 0.7 : 1 }}>
              {loading ? '…' : t('group.join_btn')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
