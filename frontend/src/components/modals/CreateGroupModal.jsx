import React, { useState } from 'react';
import { Btn, Inp } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import * as api from '../../api.js';

const S = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 },
  card: { background:'var(--card)', border:'1px solid var(--brd)', borderRadius:20, width:'100%', maxWidth:380, padding:28 },
  btn: { display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 18px', borderRadius:10, border:'none', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:600, transition:'all .18s', userSelect:'none', whiteSpace:'nowrap' },
  lbl: { fontSize:10, color:'var(--dim)', letterSpacing:2, textTransform:'uppercase', display:'block', marginBottom:6 },
};

const EMOJIS = ['🎲','⚡','🎯','🔥','💜','🌙','🏆','🎮','🍕','🎸','🌊','🎪'];

export default function CreateGroupModal({ onCreated, onClose }) {
  const { t } = useLang();
  const [tab,      setTab]      = useState('create');
  const [name,     setName]     = useState('');
  const [emoji,    setEmoji]    = useState('🎲');
  const [code,     setCode]     = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true); setError('');
    try {
      const group = await api.createGroup({ name: name.trim(), emoji });
      onCreated(group);
    } catch (e) {
      setError(t('group.err_generic'));
    } finally { setLoading(false); }
  };

  const handleJoin = async () => {
    if (code.length < 6) return;
    setLoading(true); setError('');
    try {
      const group = await api.joinGroup(code);
      onCreated(group);
    } catch (e) {
      if (e.data?.error === 'already_member')  setError(t('group.err_already_member'));
      else if (e.data?.error === 'group_full') setError(t('group.err_full'));
      else                                     setError(t('group.err_invalid_code'));
    } finally { setLoading(false); }
  };

  return (
    <div style={S.overlay}>
      <div className="bIn" style={S.card}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700, marginBottom:20 }}>
          {t('group.modal_title')}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:6, marginBottom:20, background:'var(--surf)', borderRadius:10, padding:4 }}>
          {['create','join'].map(tab_id => (
            <button key={tab_id} onClick={() => { setTab(tab_id); setError(''); }}
              style={{ ...S.btn, flex:1, padding:'8px 0', fontSize:12,
                background: tab === tab_id ? 'var(--gold)' : 'transparent',
                color:      tab === tab_id ? '#07060f'      : 'var(--dim)',
                border:     'none' }}>
              {tab_id === 'create' ? t('group.tab_create') : t('group.tab_join')}
            </button>
          ))}
        </div>

        {tab === 'create' && (
          <div className="fIn">
            <label style={S.lbl}>{t('group.name_label')}</label>
            <Inp value={name} onChange={e => setName(e.target.value)}
              placeholder={t('group.name_ph')} style={{ marginBottom:14 }} />

            <label style={S.lbl}>{t('group.emoji_label')}</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:20 }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  style={{ width:38, height:38, borderRadius:10, border:`2px solid ${emoji===e?'var(--gold)':'var(--brd)'}`,
                    background: emoji===e?'var(--gold)22':'transparent', cursor:'pointer', fontSize:20,
                    transition:'all .15s' }}>
                  {e}
                </button>
              ))}
            </div>
            {error && <div style={{ fontSize:12, color:'var(--red)', marginBottom:10 }}>{error}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <Btn variant="ghost" style={{ flex:1 }} onClick={onClose}>{t('group.cancel')}</Btn>
              <Btn variant="gold" style={{ flex:2 }} disabled={!name.trim() || loading}
                onClick={handleCreate}>
                {loading ? '…' : t('group.create_btn')}
              </Btn>
            </div>
          </div>
        )}

        {tab === 'join' && (
          <div className="fIn">
            <label style={S.lbl}>{t('group.code_label')}</label>
            <Inp value={code}
              onChange={e => { setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6)); setError(''); }}
              placeholder={t('group.code_ph')}
              style={{ textAlign:'center', letterSpacing:6, fontSize:24, fontFamily:'monospace', marginBottom:14 }} />
            {error && <div style={{ fontSize:12, color:'var(--red)', marginBottom:10 }}>{error}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <Btn variant="ghost" style={{ flex:1 }} onClick={onClose}>{t('group.cancel')}</Btn>
              <Btn variant="gold" style={{ flex:2 }} disabled={code.length < 6 || loading}
                onClick={handleJoin}>
                {loading ? '…' : t('group.join_btn')}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
