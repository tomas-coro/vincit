import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fmtD, COLORS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';

// Simple list-view modal used from Dashboard tiles (Vittorie / Sconfitte).
// Lists the resolved bets in the chosen bucket — newest first — with
// title, opponent, stake / net, and date. Tap a row to be told which
// bet view it lives in (the modal closes; caller decides what to do).
//
// Layout: bottom sheet on mobile, centered card on desktop. The header
// keeps the editorial italic-Cormorant + colored accent stripe used in
// the rest of the app.

export default function BetListModal({
  open,
  title,            // header text
  accentColor,      // "var(--grn)" for wins, "var(--red)" for losses, etc.
  bets,             // array of bet objects already filtered (user's POV)
  profiles = {},    // id → profile for opponent name lookup
  userId,           // current user id, to know which side the user is on
  emptyHint,        // string shown when bets is empty
  onClose,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sorted = [...(bets || [])].sort(
    (a, b) => (b.resolvedAt || b.createdAt || 0) - (a.resolvedAt || a.createdAt || 0)
  );

  // For each bet figure out who the opponent / target was, from the
  // user's POV. Falls back to "—" / "Vault" / "Aperta" when there's
  // no single counterpart (vault bets, open bets nobody accepted, etc.)
  const counterpartFor = (b) => {
    if (b.isSecret) return { id: null, label: 'Vault', emoji: '🔒' };
    const otherId = b.creator === userId ? (b.opponent || b.targetUser) : b.creator;
    if (!otherId) return { id: null, label: 'Aperta', emoji: '👥' };
    const p = profiles[otherId];
    return {
      id: otherId,
      label: p?.name || '—',
      emoji: p?.avatar || '🙂',
      avatarUrl: p?.avatarUrl,
      color: COLORS[p?.colorKey] || '#5b8af0',
    };
  };

  const overlay = (
    <div
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label={title}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(8, 6, 18, 0.78)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: 0,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bIn"
        style={{
          width: '100%', maxWidth: 520,
          maxHeight: 'min(86dvh, 720px)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--surf)',
          border: '1px solid var(--rule)',
          borderTop: `4px solid ${accentColor || 'var(--gold)'}`,
          borderRadius: '14px 14px 0 0',
          boxShadow: '0 -20px 60px rgba(0,0,0,.55)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 22px 12px',
          borderBottom: '1px solid var(--rule)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <div className="bc-meta" style={{ fontSize: 8 }}>— Dettaglio</div>
            <div style={{
              fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
              fontSize: 22, fontWeight: 700, lineHeight: 1.1,
              color: accentColor || 'var(--txt)', marginTop: 2,
            }}>{title}</div>
            <div className="bc-meta" style={{ fontSize: 9, marginTop: 6 }}>
              {sorted.length} {sorted.length === 1 ? 'bet' : 'bet'}
            </div>
          </div>
          <button onClick={onClose} aria-label="Chiudi" style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--dim)', fontSize: 22, padding: '4px 8px',
            WebkitTapHighlightColor: 'transparent',
          }}>✕</button>
        </div>

        {/* Body — scrollable list */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: '8px 0 calc(20px + env(safe-area-inset-bottom))',
        }}>
          {sorted.length === 0 && (
            <div style={{
              padding: '40px 24px', textAlign: 'center', color: 'var(--mut)',
              fontSize: 13, lineHeight: 1.5,
            }}>
              {emptyHint || 'Niente da mostrare qui.'}
            </div>
          )}

          {sorted.map(b => {
            const cp = counterpartFor(b);
            const won = b.status === 'won';
            const iWasCreator = b.creator === userId;
            // From the user's POV: did *I* win this bet? (Same logic as h2h.)
            const iWon =
              (iWasCreator && b.status === 'won') ||
              (!iWasCreator && b.status === 'lost');
            const delta = iWon
              ? Number(b.potentialWin || 0) - Number(b.stake || 0)
              : -Number(b.stake || 0);
            return (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 22px', borderBottom: '1px solid var(--rule)',
              }}>
                {/* Counterpart avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: cp.color ? `${cp.color}33` : 'var(--mut)33',
                  border: `2px solid ${cp.color ? `${cp.color}88` : 'var(--brd)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, overflow: 'hidden', fontSize: 18, lineHeight: 1,
                }}>
                  {cp.avatarUrl
                    ? <img src={cp.avatarUrl} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/>
                    : cp.emoji}
                </div>

                {/* Title + counterpart */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
                    fontSize: 15, fontWeight: 600, color: 'var(--txt)',
                    lineHeight: 1.25, marginBottom: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{b.title}</div>
                  <div style={{
                    fontSize: 11, color: 'var(--dim)', lineHeight: 1.3,
                    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                  }}>
                    <span>vs {cp.label}</span>
                    <span style={{ color: 'var(--mut)' }}>·</span>
                    <span>{fmtD(b.resolvedAt || b.createdAt)}</span>
                  </div>
                </div>

                {/* Delta */}
                <div style={{
                  flexShrink: 0, textAlign: 'right',
                  fontFamily: "'Playfair Display',serif",
                  fontFeatureSettings: "'lnum' 1, 'tnum' 1",
                  fontSize: 16, fontWeight: 700,
                  color: iWon ? 'var(--grn)' : 'var(--red)',
                  letterSpacing: '-0.02em',
                }}>
                  {iWon ? '+' : ''}{delta}<span style={{ fontSize: 11, marginLeft: 2 }}>₡</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay;
}
