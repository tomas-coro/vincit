import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Btn, COLORS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import useEscClose from '../../hooks/useEscClose.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';

/**
 * Modal shown when an opponent decides to accept a targeted bet.
 * They choose their stake (default = creator's stake). Winner takes the
 * combined pot (creator's stake + opponent's stake) at resolution.
 */
export default function AcceptModal({ bet, profiles, myCredits, onAccept, onClose }) {
  useEscClose(onClose);
  useBodyScrollLock();
  const { t } = useLang();
  const suggested = bet.stake;
  const maxStake  = Math.max(1, Math.floor(myCredits));
  const [stake, setStake] = useState(Math.min(suggested, maxStake));
  const [busy, setBusy]   = useState(false);
  const creatorProfile    = profiles[bet.creator] || {};
  const creatorColor      = COLORS[creatorProfile.colorKey] || '#5b8af0';

  const handleConfirm = async () => {
    if (stake < 1 || stake > maxStake) return;
    setBusy(true);
    try { await onAccept(bet.id, { stake }); onClose(); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,11,35,.78)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9300, padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} className="bIn" style={{
        background: 'var(--surf)', border: '1px solid var(--rule)',
        borderRadius: 6, width: '100%', maxWidth: 460,
        boxShadow: '0 30px 80px rgba(0,0,0,.55)',
        padding: '30px 30px 24px',
      }}>
        {/* Editorial header */}
        <div className="bc-meta" style={{ marginBottom: 10 }}>— {t('accept.title')}</div>

        {/* Creator + bet quote */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, paddingBottom: 22, borderBottom: '1px solid var(--rule)' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: `${creatorColor}22`, border: `1px solid ${creatorColor}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, overflow: 'hidden', flexShrink: 0,
          }}>
            {creatorProfile.avatarUrl
              ? <img src={creatorProfile.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : (creatorProfile.avatar || '😊')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bc-meta" style={{ fontSize: 8, marginBottom: 4 }}>
              {t('accept.from', { name: creatorProfile.name || '—' })}
            </div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic', fontSize: 20, fontWeight: 600, lineHeight: 1.2, color: 'var(--txt)' }}>
              “{bet.title}”
            </div>
          </div>
        </div>

        {/* Creator stake — quiet meta line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
          <span className="bc-meta">{t('accept.creator_stake')}</span>
          <span className="bc-num" style={{ color: 'var(--gold)', fontSize: 20 }}>{bet.stake}<span style={{fontSize:10,opacity:.6,marginLeft:3}}>₡</span></span>
        </div>

        {/* My stake — main interaction */}
        <div style={{ marginBottom: 24 }}>
          <label className="bc-meta" style={{ marginBottom: 14, display: 'block' }}>
            {t('accept.your_stake')}
          </label>
          <input
            type="range"
            min={1} max={maxStake} step={1}
            value={stake}
            onChange={e => setStake(parseInt(e.target.value, 10))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
            <button onClick={() => setStake(Math.min(suggested, maxStake))} style={{
              background: 'transparent', border: '1px solid var(--rule)', borderRadius: 999,
              padding: '6px 14px', fontSize: 10, color: 'var(--dim)', cursor: 'pointer',
              fontFamily: "'Manrope',sans-serif", fontWeight: 600,
              letterSpacing: '.12em', textTransform: 'uppercase',
            }}>= {suggested}₡ {t('accept.match')}</button>
            <input
              type="number"
              min={1} max={maxStake}
              value={stake}
              onChange={e => setStake(Math.max(1, Math.min(maxStake, parseInt(e.target.value, 10) || 1)))}
              style={{
                width: 110, textAlign: 'right',
                background: 'transparent', border: 0, borderBottom: '1px solid var(--brd)', borderRadius: 0,
                color: 'var(--gold)', padding: '6px 4px', fontWeight: 700,
                fontFamily: "'Playfair Display',serif", fontSize: 22, outline: 'none',
              }}
            />
          </div>
          <div className="bc-meta" style={{ marginTop: 8, fontSize: 8 }}>
            {t('accept.max_avail', { n: maxStake })}
          </div>
        </div>

        {/* Pot summary — hairline, no card */}
        <div style={{ borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)', padding: '16px 0', marginBottom: 22 }}>
          <div className="bc-meta" style={{ color: 'var(--gold)', marginBottom: 14 }}>
            {t('accept.pot_label')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>{t('accept.if_you_win')}</span>
            <span className="bc-num" style={{ color: 'var(--grn)', fontSize: 22 }}>+{bet.stake}<span style={{fontSize:10,opacity:.6,marginLeft:3}}>₡</span></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>{t('accept.if_you_lose')}</span>
            <span className="bc-num" style={{ color: 'var(--red)', fontSize: 22 }}>−{stake}<span style={{fontSize:10,opacity:.6,marginLeft:3}}>₡</span></span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="ghost" full onClick={onClose}>{t('reveal.cancel')}</Btn>
          <Btn variant="gold" full onClick={handleConfirm} disabled={busy || stake < 1 || stake > maxStake}>
            {busy ? '…' : t('accept.confirm')}
          </Btn>
        </div>
      </div>
    </div>,
    document.body
  );
}
