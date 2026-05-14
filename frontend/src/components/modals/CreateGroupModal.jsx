import React, { useState } from 'react';
import { Btn, Inp } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import * as api from '../../api.js';
import useEscClose from '../../hooks/useEscClose.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';

const S = {
  overlay: { position:'fixed', inset:0, background:'rgba(15,11,35,.78)', backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:24 },
  panel:   { background:'var(--surf)', border:'1px solid var(--rule)', borderRadius:6, width:'100%', maxWidth:420, padding:'32px 30px', boxShadow:'0 30px 80px rgba(0,0,0,.55)' },
  lbl:     { fontSize:9, color:'var(--dim)', letterSpacing:'.3em', textTransform:'uppercase', fontWeight:600, display:'block', marginBottom:10 },
};

const EMOJIS = ['🎲','⚡','🎯','🔥','💜','🌙','🏆','🎮','🍕','🎸','🌊','🎪'];

export default function CreateGroupModal({ onCreated, onClose }) {
  useEscClose(onClose);
  useBodyScrollLock();
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
      if (e.data?.error === 'already_member')       setError(t('group.err_already_member'));
      else if (e.data?.error === 'group_full')      setError(t('group.err_full'));
      else if (e.data?.error === 'invite_expired') setError(t('group.err_invite_expired'));
      else                                          setError(t('group.err_invalid_code'));
    } finally { setLoading(false); }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div className="bIn" style={S.panel} onClick={e => e.stopPropagation()}>
        <div className="bc-meta" style={{ marginBottom:10 }}>— Gruppo</div>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic', fontSize:26, fontWeight:600, lineHeight:1, marginBottom:24, color:'var(--txt)' }}>
          {t('group.modal_title')}
        </div>

        {/* Tabs underline */}
        <div style={{ display:'flex', gap:28, marginBottom:28, borderBottom:'1px solid var(--rule)' }}>
          {['create','join'].map(tab_id => (
            <button key={tab_id} onClick={() => { setTab(tab_id); setError(''); }}
              style={{
                padding:'6px 0 12px', border:'none', cursor:'pointer', background:'transparent',
                fontFamily:"'Manrope',sans-serif", fontSize:10, fontWeight:600,
                letterSpacing:'.22em', textTransform:'uppercase',
                color: tab===tab_id ? 'var(--txt)' : 'var(--dim)',
                borderBottom: `2px solid ${tab===tab_id ? 'var(--gold)' : 'transparent'}`,
                marginBottom:-1, transition:'all .18s',
              }}>
              {tab_id === 'create' ? t('group.tab_create') : t('group.tab_join')}
            </button>
          ))}
        </div>

        {tab === 'create' && (
          <div className="fIn">
            <label style={S.lbl}>{t('group.name_label')}</label>
            <Inp value={name} onChange={e => setName(e.target.value)}
              placeholder={t('group.name_ph')} style={{ marginBottom:24 }} />

            <label style={S.lbl}>{t('group.emoji_label')}</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:26 }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  style={{ width:42, height:42, borderRadius:4, border:`1px solid ${emoji===e?'var(--gold)':'var(--rule)'}`,
                    background: emoji===e ? 'var(--soft)' : 'transparent', cursor:'pointer', fontSize:22,
                    transition:'all .15s' }}>
                  {e}
                </button>
              ))}
            </div>
            {error && <div style={{ fontSize:12, color:'var(--red)', marginBottom:14, fontWeight:600 }}>{error}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <Btn variant="ghost" full onClick={onClose}>{t('group.cancel')}</Btn>
              <Btn variant="gold" full disabled={!name.trim() || loading}
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
              style={{ textAlign:'center', letterSpacing:10, fontSize:28, fontFamily:"'Playfair Display',serif", marginBottom:24 }} />
            {error && <div style={{ fontSize:12, color:'var(--red)', marginBottom:14, fontWeight:600 }}>{error}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <Btn variant="ghost" full onClick={onClose}>{t('group.cancel')}</Btn>
              <Btn variant="gold" full disabled={code.length < 6 || loading}
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
