import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Btn, COLORS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import * as api from '../../api.js';

export default function SubsetEditModal({ bet, groupMembers, onSaved, onClose }) {
  const { t } = useLang();
  const locked = useMemo(() => {
    const s = new Set([bet.creator]);
    for (const cb of (bet.counterBets || [])) s.add(cb.bettor);
    return s;
  }, [bet]);

  const initial = useMemo(() => {
    const set = new Set();
    if (Array.isArray(bet.allowedMembers)) bet.allowedMembers.forEach(id => set.add(id));
    return set;
  }, [bet.allowedMembers]);

  const [picked, setPicked] = useState(initial);
  const [busy, setBusy]     = useState(false);
  const [err,  setErr]      = useState(null);

  const toggle = id => {
    if (locked.has(id)) return; // can\'t remove someone who already bet
    setPicked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const ids = picked.size === 0 ? [] : Array.from(picked);
      const result = await api.editAllowed(bet.id, ids);
      onSaved?.(result.allowedMembers);
      onClose();
    } catch (e) {
      console.error(e);
      setErr(t('app.error_edit'));
    } finally { setBusy(false); }
  };

  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9400, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} className="bIn" style={{
        background: 'var(--surf)', border: '1px solid var(--brd)',
        borderRadius: 18, width: '100%', maxWidth: 440,
        maxHeight: 'calc(100dvh - 32px)', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,.6)', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--brd)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700 }}>
            👥 {t('subset_edit.title')}
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: '1px solid var(--brd)', borderRadius: 10,
            color: 'var(--dim)', padding: '5px 11px', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
          }}>✕</button>
        </div>

        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 12 }}>
            {t('subset_edit.body')}
          </div>

          {/* "Everyone" toggle */}
          <button onClick={() => setPicked(new Set())}
            style={{
              width: '100%', padding: '10px 14px', marginBottom: 8,
              borderRadius: 12,
              border: `1px solid ${picked.size === 0 ? 'var(--gold)' : 'var(--brd)'}`,
              background: picked.size === 0 ? 'var(--gold)1a' : 'transparent',
              color: picked.size === 0 ? 'var(--gold)' : 'var(--dim)',
              cursor: 'pointer', fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600,
              textAlign: 'left',
            }}>
            🌐 {t('subset_edit.everyone')}
          </button>

          {(groupMembers || []).filter(m => m.id !== bet.creator).map(m => {
            const isPicked = picked.has(m.id);
            const isLocked = locked.has(m.id);
            const color = COLORS[m.color_key || m.colorKey] || '#5b8af0';
            return (
              <button key={m.id} onClick={() => toggle(m.id)} disabled={isLocked}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', marginBottom: 6,
                  borderRadius: 12,
                  border: `1px solid ${isPicked ? 'var(--gold)' : 'var(--brd)'}`,
                  background: isPicked ? 'var(--gold)10' : 'transparent',
                  color: isPicked ? 'var(--gold)' : 'var(--txt)',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? .5 : 1,
                  fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600,
                  textAlign: 'left',
                }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: `${color}33`, border: `2px solid ${color}66`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, overflow: 'hidden', flexShrink: 0,
                }}>
                  {m.avatar_url
                    ? <img src={m.avatar_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : (m.avatar || '😊')}
                </div>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.name}
                </span>
                {isLocked && (
                  <span style={{ fontSize: 10, color: 'var(--gold)' }}>{t('subset_edit.locked')}</span>
                )}
                {!isLocked && isPicked && <span style={{ color: 'var(--gold)' }}>✓</span>}
              </button>
            );
          })}

          {err && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--red)' }}>{err}</div>
          )}
        </div>

        <div style={{
          display: 'flex', gap: 8, padding: '12px 18px',
          borderTop: '1px solid var(--brd)', justifyContent: 'flex-end',
        }}>
          <Btn variant="ghost" onClick={onClose}>{t('reveal.cancel')}</Btn>
          <Btn variant="gold" onClick={save} disabled={busy} style={{padding: '10px 22px'}}>
            {busy ? '…' : t('subset_edit.save')}
          </Btn>
        </div>
      </div>
    </div>,
    document.body
  );
}
