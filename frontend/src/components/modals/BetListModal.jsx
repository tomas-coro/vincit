import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fmtD, COLORS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';

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
  useBodyScrollLock(open);
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

  // Build a tiny "person chip" payload from a profile id.
  const personFromId = (id) => {
    const p = profiles[id];
    return {
      id,
      label: p?.name || '—',
      emoji: p?.avatar || '🙂',
      avatarUrl: p?.avatarUrl,
      color: COLORS[p?.colorKey] || '#5b8af0',
    };
  };

  // Everyone on the OPPOSING side of the bet from the viewer's POV.
  // "vs" should only list actual opponents, not allies who happened to
  // place a counter-bet on the SAME side as the viewer (e.g. both
  // voted YES on an open bet — they were teammates, not rivals).
  //
  // Side semantics for an open bet:
  //   - The creator's implicit position is YES (the bet title).
  //   - Each counter_bet has a `side` of 'yes' or 'no'.
  //   - The viewer's side: 'yes' if they're the creator OR a counter
  //     with side='yes', otherwise 'no'.
  // For a 1-vs-1 targeted bet without counter-bets, the opponent is
  // simply the other named person (opponent or target_user).
  const participantsFor = (b) => {
    if (b.isSecret) return [{ id: null, label: 'Vault', emoji: '🔒' }];
    const counterBets = Array.isArray(b.counterBets) ? b.counterBets : [];

    // Resolve the viewer's own side.
    let mySide = null;
    if (b.creator === userId) mySide = 'yes';
    else {
      const mine = counterBets.find(c => c?.bettor === userId);
      if (mine?.side) mySide = mine.side;
    }
    const opposite = mySide === 'yes' ? 'no' : 'yes';

    const ids = new Set();
    // Creator only counts as an "opponent" when the viewer is on the
    // OTHER side from creator (i.e. viewer is on 'no').
    if (b.creator !== userId && mySide === 'no') ids.add(b.creator);
    // Named opponent + target_user always count as opponents (they're
    // the explicit opposition by design of targeted/surprise bets).
    if (b.opponent && b.opponent !== userId)     ids.add(b.opponent);
    if (b.targetUser && b.targetUser !== userId) ids.add(b.targetUser);
    // Counter-bettors: only those on the OPPOSITE side from the viewer.
    // If mySide is null (somehow neither creator nor counter-bettor)
    // we include every counter-bettor as opposition by default.
    for (const cb of counterBets) {
      if (!cb?.bettor || cb.bettor === userId) continue;
      if (!mySide || cb.side === opposite) ids.add(cb.bettor);
    }

    if (ids.size === 0) return [{ id: null, label: 'Aperta', emoji: '👥' }];
    return Array.from(ids).map(personFromId);
  };

  // Full roster for the expanded view — every party with their side,
  // stake, and (for resolved bets) win/loss outcome.
  const rosterFor = (b) => {
    if (b.isSecret) return [];
    const counterBets = Array.isArray(b.counterBets) ? b.counterBets : [];
    const creatorWon = b.status === 'won';
    const seen = new Set();
    const rows = [];

    const push = (id, side, stake, quotaUsed) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      const p = personFromId(id);
      const q = parseFloat(quotaUsed) || parseFloat(b.quota) || 1;
      const won = side === 'yes' ? creatorWon : !creatorWon;
      const payout = won ? Math.round((stake || 0) * q) : 0;
      const delta = won ? payout - (stake || 0) : -(stake || 0);
      rows.push({
        ...p, side, stake: stake || 0,
        outcome: (b.status === 'won' || b.status === 'lost') ? (won ? 'won' : 'lost') : null,
        delta,
        isYou: id === userId,
      });
    };

    push(b.creator, 'yes', b.stake, b.quota);
    if (b.opponent && b.opponent !== b.creator && counterBets.every(c => c.bettor !== b.opponent)) {
      // 1v1 targeted/surprise bet without an explicit counter row.
      const oppStake = b.opponentStake != null ? b.opponentStake : b.stake;
      push(b.opponent, 'no', oppStake, b.quota);
    }
    for (const cb of counterBets) {
      push(cb.bettor, cb.side, cb.stake, cb.quotaUsed);
    }
    return rows;
  };

  const overlay = (
    <div
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label={title}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(8, 6, 18, 0.78)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        // Centered overlay — matches the rest of the app's modal language.
        // Bottom-sheet was the original v1; the user wants a unified look.
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
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
          borderRadius: 14,
          boxShadow: '0 30px 80px rgba(0,0,0,.55)',
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

          {sorted.map(b => (
            <BetRow
              key={b.id}
              bet={b}
              roster={rosterFor(b)}
              participants={participantsFor(b)}
              userId={userId}
              autoExpand={sorted.length === 1}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay;
}

// One bet entry — collapsible row with an expandable participants
// roster underneath. Auto-expanded when the modal contains a single
// bet (the Dashboard V/P case), so the user immediately sees who was
// in. For multi-bet lists the row stays compact and expands on tap.
function BetRow({ bet: b, roster, participants, userId, autoExpand }) {
  const [open, setOpen] = useState(!!autoExpand);
  const parts = participants;
  const lead  = parts[0] || { label: '—', emoji: '🙂', color: '#5b8af0' };
  const extras = parts.slice(1);
  const iWasCreator = b.creator === userId;
  const iWon =
    (iWasCreator && b.status === 'won') ||
    (!iWasCreator && b.status === 'lost');
  const delta = iWon
    ? Number(b.potentialWin || 0) - Number(b.stake || 0)
    : -Number(b.stake || 0);
  const partsLabel = parts.map(p => p.label).join(' · ');
  const canExpand = roster.length > 0;

  return (
    <div style={{ borderBottom: '1px solid var(--rule)' }}>
      <div
        onClick={canExpand ? () => setOpen(o => !o) : undefined}
        role={canExpand ? 'button' : undefined}
        tabIndex={canExpand ? 0 : undefined}
        onKeyDown={canExpand ? (e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); }
        }) : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 22px',
          cursor: canExpand ? 'pointer' : 'default',
          WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: lead.color ? `${lead.color}33` : 'var(--mut)33',
            border: `2px solid ${lead.color ? `${lead.color}88` : 'var(--brd)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', fontSize: 18, lineHeight: 1,
          }}>
            {lead.avatarUrl
              ? <img src={lead.avatarUrl} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/>
              : lead.emoji}
          </div>
          {extras.slice(0, 2).map((p, i) => (
            <div key={p.id || i} style={{
              width: 28, height: 28, borderRadius: '50%',
              background: p.color ? `${p.color}33` : 'var(--mut)33',
              border: '2px solid var(--surf)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', fontSize: 14, lineHeight: 1,
              marginLeft: -10,
            }}>
              {p.avatarUrl
                ? <img src={p.avatarUrl} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/>
                : p.emoji}
            </div>
          ))}
          {extras.length > 2 && (
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--card)', border: '2px solid var(--surf)',
              color: 'var(--dim)', fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginLeft: -10,
            }}>+{extras.length - 2}</div>
          )}
        </div>

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
            <span style={{
              maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>vs {partsLabel}</span>
            <span style={{ color: 'var(--mut)' }}>·</span>
            <span>{fmtD(b.resolvedAt || b.createdAt)}</span>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            textAlign: 'right',
            fontFamily: "'Playfair Display',serif",
            fontFeatureSettings: "'lnum' 1, 'tnum' 1",
            fontSize: 16, fontWeight: 700,
            color: iWon ? 'var(--grn)' : 'var(--red)',
            letterSpacing: '-0.02em',
          }}>
            {iWon ? '+' : ''}{delta}<span style={{ fontSize: 11, marginLeft: 2 }}>₡</span>
          </div>
          {canExpand && (
            <span aria-hidden style={{
              color: 'var(--mut)', fontSize: 11, lineHeight: 1,
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform .2s ease',
              display: 'inline-block', width: 12, textAlign: 'center',
            }}>▸</span>
          )}
        </div>
      </div>

      {/* Expanded roster — each participant with avatar, side, stake,
          and (for resolved bets) their personal delta. "Tu" is pinned
          first so the viewer's row is immediately visible. */}
      {open && canExpand && (
        <div style={{
          padding: '4px 22px 14px',
          background: 'var(--card)55',
          borderTop: '1px solid var(--rule)',
        }}>
          <div className="bc-meta" style={{ fontSize: 8, padding: '10px 0 8px' }}>
            — Partecipanti
          </div>
          {[...roster].sort((a,b)=> (a.isYou ? -1 : b.isYou ? 1 : 0)).map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0',
              borderTop: '1px dashed var(--rule)',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: `${r.color}33`, border: `2px solid ${r.color}88`,
                display:'flex', alignItems:'center', justifyContent:'center',
                overflow:'hidden', fontSize: 15, lineHeight: 1, flexShrink: 0,
              }}>
                {r.avatarUrl
                  ? <img src={r.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : r.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: 'var(--txt)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {r.label}{r.isYou && (
                    <span style={{
                      fontSize: 9, marginLeft: 6, color: 'var(--gold)',
                      letterSpacing: 1, fontFamily: "'Manrope',sans-serif",
                    }}>TU</span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 1 }}>
                  {r.side === 'yes' ? 'SÌ' : 'NO'} · {r.stake} ₡
                </div>
              </div>
              {r.outcome && (
                <div style={{
                  textAlign: 'right',
                  fontFamily: "'Playfair Display',serif",
                  fontFeatureSettings: "'lnum' 1, 'tnum' 1",
                  fontSize: 14, fontWeight: 700,
                  color: r.outcome === 'won' ? 'var(--grn)' : 'var(--red)',
                  letterSpacing: '-0.02em',
                }}>
                  {r.outcome === 'won' ? '+' : ''}{r.delta}<span style={{ fontSize: 10, marginLeft: 2 }}>₡</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
