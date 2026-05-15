import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../../i18n.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';
import { StreakInline } from '../StreakBadge.jsx';

export default function RankingModal({ open, onClose, rankRows, bets, profiles, credits, user }) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const { t } = useLang();
  if (!open) return null;

  // Per-person computed stats
  const statsFor = uid => {
    const won  = bets.filter(b => b.creator === uid && b.status === 'won');
    const lost = bets.filter(b => b.creator === uid && b.status === 'lost');
    const net  = won.reduce((s, b) => s + (b.potentialWin - b.stake), 0)
               - lost.reduce((s, b) => s + b.stake, 0);
    const rate = (won.length + lost.length) > 0
      ? Math.round(won.length / (won.length + lost.length) * 100) : 0;
    const best = won.reduce((bst, b) =>
      (!bst || (b.potentialWin - b.stake) > (bst.potentialWin - bst.stake)) ? b : bst, null);
    return { w: won.length, l: lost.length, net: Math.round(net), rate, best };
  };

  const medals = ['🥇', '🥈', '🥉'];

  // H2H — only meaningful when exactly 2 members
  const h2hSection = (() => {
    if (rankRows.length !== 2) return null;
    const [pa, pb] = rankRows;
    const h2h = bets.filter(bet =>
      ((bet.creator === pa.id && bet.opponent === pb.id) ||
       (bet.creator === pb.id && bet.opponent === pa.id)) &&
      ['won', 'lost'].includes(bet.status)
    );
    // Overall wins (fallback if no direct 1v1 bets)
    const paWins = h2h.length > 0
      ? h2h.filter(bet =>
          (bet.creator === pa.id && bet.status === 'won') ||
          (bet.creator === pb.id && bet.status === 'lost')
        ).length
      : pa.w;
    const pbWins = h2h.length > 0 ? h2h.length - paWins : pb.w;
    const total  = h2h.length > 0 ? h2h.length : pa.w + pb.w;
    const label  = h2h.length > 0 ? '— Testa a testa (dirette)' : '— Testa a testa (totali)';
    const leader = paWins > pbWins ? pa : paWins < pbWins ? pb : null;

    return (
      <div style={{ padding: '18px 22px', borderTop: '1px solid var(--rule)' }}>
        <div className="bc-meta" style={{ fontSize: 8, marginBottom: 14 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {/* Person A */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', overflow: 'hidden',
              background: `${pa.c}33`, border: `2px solid ${paWins >= pbWins ? 'var(--gold)' : `${pa.c}55`}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
              boxShadow: paWins > pbWins ? '0 0 12px var(--gold)44' : 'none',
            }}>
              {pa.p?.avatarUrl
                ? <img src={pa.p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                : (pa.p?.avatar ?? '👤')}
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic', fontSize: 13,
              color: paWins >= pbWins ? 'var(--gold)' : 'var(--dim)', textAlign: 'center',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80,
            }}>{pa.p?.name}</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: 36,
              color: paWins >= pbWins ? 'var(--gold)' : 'var(--txt)', lineHeight: 1 }}>{paWins}</div>
          </div>

          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
            fontSize: 20, color: 'var(--mut)', opacity: .5, flexShrink: 0, paddingBottom: 10 }}>vs</div>

          {/* Person B */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', overflow: 'hidden',
              background: `${pb.c}33`, border: `2px solid ${pbWins >= paWins ? 'var(--gold)' : `${pb.c}55`}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
              boxShadow: pbWins > paWins ? '0 0 12px var(--gold)44' : 'none',
            }}>
              {pb.p?.avatarUrl
                ? <img src={pb.p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                : (pb.p?.avatar ?? '👤')}
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic', fontSize: 13,
              color: pbWins >= paWins ? 'var(--gold)' : 'var(--dim)', textAlign: 'center',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80,
            }}>{pb.p?.name}</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: 36,
              color: pbWins >= paWins ? 'var(--gold)' : 'var(--txt)', lineHeight: 1 }}>{pbWins}</div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 10, fontFamily: "'Cormorant Garamond',serif",
          fontStyle: 'italic', fontSize: 13, color: 'var(--dim)' }}>
          {leader
            ? <>{leader.p?.name} è in testa su {total} bet 🔥</>
            : <>Pari — {total} bet giocate 🤝</>}
        </div>
      </div>
    );
  })();

  const myStats = statsFor(user);

  const overlay = (
    <div onClick={onClose} role="dialog" aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(8,6,18,.82)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
      <div onClick={e => e.stopPropagation()} className="bIn" style={{
        width: '100%', maxWidth: 520,
        maxHeight: 'min(90dvh, 760px)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--surf)',
        border: '1px solid var(--rule)',
        borderTop: '4px solid var(--gold)',
        borderRadius: 14,
        boxShadow: '0 30px 80px rgba(0,0,0,.6)',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 22px 14px',
          borderBottom: '1px solid var(--rule)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div className="bc-meta" style={{ fontSize: 8 }}>— Report completo</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
              fontSize: 26, fontWeight: 700, color: 'var(--gold)', lineHeight: 1.1, marginTop: 2 }}>
              Classifica
            </div>
          </div>
          <button onClick={onClose} aria-label="Chiudi" style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--dim)', fontSize: 22, padding: '4px 8px', lineHeight: 1,
            WebkitTapHighlightColor: 'transparent',
          }}>✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

          {/* ── Full ranking table ── */}
          <div style={{ padding: '14px 22px 6px' }}>
            <div className="bc-meta" style={{ fontSize: 8 }}>— Tutti i giocatori</div>
          </div>

          {rankRows.map((s, i) => {
            const st = statsFor(s.id);
            const isMe = s.id === user;
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 22px',
                borderBottom: '1px solid var(--rule)',
                background: isMe ? 'var(--gold)07' : 'transparent',
              }}>
                {/* Rank / medal */}
                <div style={{ width: 26, flexShrink: 0, textAlign: 'center' }}>
                  {i < 3
                    ? <span style={{ fontSize: 15 }}>{medals[i]}</span>
                    : <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 13,
                        fontWeight: 700, color: 'var(--mut)' }}>#{i + 1}</span>}
                </div>

                {/* Avatar */}
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: `${s.c}33`,
                  border: `2px solid ${i === 0 ? 'var(--gold)' : `${s.c}66`}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, overflow: 'hidden',
                  boxShadow: i === 0 ? '0 0 10px var(--gold)44' : 'none',
                }}>
                  {s.p?.avatarUrl
                    ? <img src={s.p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}/>
                    : (s.p?.avatar ?? '👤')}
                </div>

                {/* Name + sub-stats */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
                    fontSize: 16, fontWeight: 700, lineHeight: 1,
                    color: i === 0 ? 'var(--gold)' : isMe ? 'var(--gold)' : 'var(--txt)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {s.p?.name}
                    {isMe && <span style={{ fontFamily: "'Manrope',sans-serif", fontStyle: 'normal',
                      fontSize: 8, color: 'var(--gold)', marginLeft: 6, letterSpacing: '.15em' }}>TU</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <span className="bc-meta" style={{ fontSize: 9 }}>
                      {st.w}V · {st.l}P · {st.rate}%
                    </span>
                    {(s.streaks.winStreak >= 2 || s.streaks.lossStreak >= 2) && (
                      <StreakInline winStreak={s.streaks.winStreak} lossStreak={s.streaks.lossStreak} size={11}/>
                    )}
                  </div>
                </div>

                {/* Net ₡ */}
                <div style={{
                  fontFamily: "'Playfair Display',serif", fontWeight: 700,
                  fontSize: 15, flexShrink: 0, textAlign: 'right',
                  color: st.net >= 0 ? 'var(--grn)' : 'var(--red)',
                  letterSpacing: '-0.02em',
                }}>
                  {st.net >= 0 ? '+' : ''}{st.net}
                  <span style={{ fontSize: 10, marginLeft: 2, opacity: .65 }}>₡</span>
                </div>
              </div>
            );
          })}

          {/* ── My personal summary ── */}
          {(myStats.w > 0 || myStats.l > 0) && (
            <div style={{ padding: '18px 22px', borderTop: '1px solid var(--rule)' }}>
              <div className="bc-meta" style={{ fontSize: 8, marginBottom: 14 }}>— Il tuo riepilogo</div>

              {/* Stats grid */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 14 }}>
                {[
                  { l: 'Vinte',      v: myStats.w,   c: 'var(--grn)' },
                  { l: 'Perse',      v: myStats.l,   c: 'var(--red)' },
                  { l: 'Win rate',   v: `${myStats.rate}%`, c: myStats.rate >= 50 ? 'var(--grn)' : 'var(--red)' },
                  { l: 'Saldo netto',v: `${myStats.net >= 0 ? '+' : ''}${myStats.net} ₡`, c: myStats.net >= 0 ? 'var(--grn)' : 'var(--red)' },
                  { l: 'Crediti',    v: `${Math.round(credits[user] ?? 0)} ₡`, c: 'var(--gold)' },
                ].map((s, i, arr) => (
                  <div key={s.l} style={{
                    flex: 1, textAlign: 'center',
                    borderLeft: i === 0 ? 'none' : '1px solid var(--rule)',
                    paddingLeft: i === 0 ? 0 : 6,
                  }}>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18,
                      fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.v}</div>
                    <div className="bc-meta" style={{ fontSize: 7, marginTop: 5 }}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Best bet */}
              {myStats.best && (
                <div style={{
                  padding: '10px 12px',
                  background: 'var(--gold)0d', border: '1px solid var(--gold)33',
                  borderLeft: '3px solid var(--gold)', borderRadius: 6,
                }}>
                  <div className="bc-meta" style={{ fontSize: 8, marginBottom: 4 }}>— Miglior vincita</div>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
                    fontSize: 15, color: 'var(--txt)', lineHeight: 1.3 }}>
                    "{myStats.best.title}"
                  </div>
                  <div className="bc-meta" style={{ fontSize: 9, marginTop: 4, color: 'var(--grn)' }}>
                    +{Math.round(myStats.best.potentialWin - myStats.best.stake)} ₡ incassati
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── H2H (2-person groups) ── */}
          {h2hSection}

          {/* Bottom safe-area padding */}
          <div style={{ height: 'calc(12px + env(safe-area-inset-bottom))' }}/>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay;
}
