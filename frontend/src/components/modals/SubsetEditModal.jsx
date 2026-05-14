import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Btn, COLORS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import * as api from '../../api.js';
import useEscClose from '../../hooks/useEscClose.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';

export default function SubsetEditModal({ bet, groupMembers, onSaved, onClose }) {
  useEscClose(onClose);
  useBodyScrollLock();
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
      position: 'fixed', inset: 0, background: 'rgba(15,11,35,.78)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9400, padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} className="bIn" style={{
        background: 'var(--surf)', border: '1px solid var(--rule)',
        borderRadius: 6, width: '100%', maxWidth: 460,
        maxHeight: 'calc(100dvh - 48px)', display: 'flex', flexDirection: 'column',
        boxShadow: '0 30px 80px rgba(0,0,0,.55)', overflow: 'hidden',
      }}>
        {/* Editorial header */}
        <div style={{
          padding: '26px 28px 20px', borderBottom: '1px solid var(--rule)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        }}>
          <div>
            <div className="bc-meta" style={{ marginBottom: 8 }}>— Inviti</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic', fontSize: 26, fontWeight: 600, lineHeight: 1, color: 'var(--txt)' }}>
              {t('subset_edit.title')}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--dim)', fontSize: 18, padding: 4,
          }}>✕</button>
        </div>

        <div style={{ padding: '20px 28px', overflowY: 'auto', flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6, marginBottom: 20 }}>
            {t('subset_edit.body')}
          </div>

          {/* "Everyone" toggle — sharp pill outline */}
          <button onClick={() => setPicked(new Set())}
            style={{
              width: '100%', padding: '14px 16px', marginBottom: 14,
              borderRadius: 4,
              border: `1px solid ${picked.size === 0 ? 'var(--gold)' : 'var(--rule)'}`,
              background: picked.size === 0 ? 'var(--soft)' : 'transparent',
              color: picked.size === 0 ? 'var(--gold)' : 'var(--dim)',
              cursor: 'pointer', fontFamily: "'Manrope',sans-serif", fontSize: 12, fontWeight: 600,
              letterSpacing: '.06em', textAlign: 'left', transition: 'all .15s',
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
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 4px',
                  borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                  borderBottom: '1px solid var(--rule)',
                  background: 'transparent',
                  color: isPicked ? 'var(--gold)' : 'var(--txt)',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? .45 : 1,
                  fontFamily: "'Manrope',sans-serif", fontSize: 14, fontWeight: 500,
                  textAlign: 'left', transition: 'color .18s',
                }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: `${color}22`, border: `1px solid ${color}55`,
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
                  <span className="bc-meta" style={{ fontSize: 8, color: 'var(--gold)' }}>{t('subset_edit.locked')}</span>
                )}
                {!isLocked && isPicked && <span style={{ color: 'var(--gold)', fontSize: 16 }}>✓</span>}
              </button>
            );
          })}

          {err && (
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>{err}</div>
          )}
        </div>

        <div style={{
          display: 'flex', gap: 10, padding: '18px 28px',
          borderTop: '1px solid var(--rule)',
        }}>
          <Btn variant="ghost" full onClick={onClose}>{t('reveal.cancel')}</Btn>
          <Btn variant="gold" full onClick={save} disabled={busy}>
            {busy ? '…' : t('subset_edit.save')}
          </Btn>
        </div>
      </div>
    </div>,
    document.body
  );
}
