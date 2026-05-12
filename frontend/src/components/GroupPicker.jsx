import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../i18n.js';
import { COLORS } from './Atoms.jsx';

function timeAgo(ts, t) {
  if (!ts || ts === 0) return null;
  const diff = Date.now() - Number(ts);
  if (diff < 0) return null;
  const m = Math.floor(diff / 60000);
  if (m < 1)   return t('picker.now');
  if (m < 60)  return t('picker.ago_min', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24)  return t('picker.ago_h',   { n: h });
  const d = Math.floor(h / 24);
  if (d < 30)  return t('picker.ago_d',   { n: d });
  const mo = Math.floor(d / 30);
  return t('picker.ago_mo', { n: mo });
}

function AvatarChip({ m, size = 22 }) {
  const color = COLORS[m?.color_key] || '#5b8af0';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `${color}33`, border: `1.5px solid ${color}88`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.55), overflow: 'hidden',
      flexShrink: 0, color: '#fff',
    }}>
      {m?.avatar_url
        ? <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (m?.avatar || '?')}
    </div>
  );
}

export default function GroupPicker({
  groups,
  activeGroupId,
  onSwitch,
  onCreate,
  onOpenGroupInfo,
  compact = false,
}) {
  const { t } = useLang();
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState('');
  const chipRef             = useRef(null);
  const panelRef            = useRef(null);
  const searchRef           = useRef(null);
  const [anchor, setAnchor] = useState(null);

  const active = useMemo(
    () => groups.find(g => g.id === activeGroupId) || groups[0],
    [groups, activeGroupId]
  );

  // Compute panel position from the chip
  const updateAnchor = useCallback(() => {
    if (!chipRef.current) return;
    const r = chipRef.current.getBoundingClientRect();
    setAnchor({
      top:   r.bottom + 8,
      left:  r.left,
      width: Math.max(r.width, 320),
    });
  }, []);

  // Open/close handlers
  const openPicker = useCallback(() => {
    updateAnchor();
    setOpen(true);
    setQuery('');
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [updateAnchor]);

  const closePicker = useCallback(() => setOpen(false), []);

  // Cmd/Ctrl + K shortcut
  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open ? closePicker() : openPicker();
      } else if (e.key === 'Escape' && open) {
        closePicker();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, openPicker, closePicker]);

  // Re-anchor on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const onScroll = () => updateAnchor();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, updateAnchor]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g => (g.name || '').toLowerCase().includes(q));
  }, [groups, query]);

  if (!groups.length || !active) return null;

  const totalPending = groups.reduce((sum, g) => sum + (g.pending_count || 0), 0);
  const activePending = active.pending_count || 0;
  const otherPending  = Math.max(0, totalPending - activePending);

  // --- Active chip ---
  const chip = (
    <button
      ref={chipRef}
      onClick={openPicker}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        width: '100%', padding: compact ? '7px 11px' : '8px 12px',
        background: 'var(--card)',
        border: '1px solid var(--brd)',
        borderRadius: 14, cursor: 'pointer',
        fontFamily: "'Syne',sans-serif",
        color: 'var(--txt)',
        textAlign: 'left',
        transition: 'all .18s',
        position: 'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)44'; e.currentTarget.style.background = 'var(--gold)08'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brd)';     e.currentTarget.style.background = 'var(--card)'; }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 10,
        background: 'var(--gold)18',
        border: '1px solid var(--gold)55',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0,
      }}>
        {active.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, fontSize: 13, lineHeight: 1.1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{active.name}</div>
        <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2, letterSpacing: 0.4 }}>
          👥 {active.member_count}
          {activePending > 0 && (
            <span style={{ color: 'var(--gold)', marginLeft: 6 }}>· {activePending} {t('picker.live')}</span>
          )}
        </div>
      </div>
      <div style={{
        fontSize: 11, color: 'var(--dim)', flexShrink: 0,
        transform: open ? 'rotate(180deg)' : 'rotate(0)',
        transition: 'transform .2s',
      }}>▾</div>
      {!open && otherPending > 0 && (
        <div style={{
          position: 'absolute', top: -5, right: -5,
          minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
          background: 'var(--gold)', color: '#07060f',
          fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px var(--glow)',
        }}>{otherPending}</div>
      )}
    </button>
  );

  // --- Dropdown panel ---
  const panel = open && anchor && createPortal(
    <>
      <div
        onClick={closePicker}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
          zIndex: 200, animation: 'fIn .15s ease both',
        }}
      />
      <div
        ref={panelRef}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top:   Math.min(anchor.top, window.innerHeight - 80),
          left:  Math.max(8, Math.min(anchor.left, window.innerWidth - anchor.width - 8)),
          width: Math.min(anchor.width, window.innerWidth - 16),
          maxHeight: `min(72dvh, ${window.innerHeight - anchor.top - 16}px)`,
          background: 'var(--surf)',
          border: '1px solid var(--brd)',
          borderRadius: 16,
          boxShadow: '0 20px 50px rgba(0,0,0,.45), 0 0 0 1px var(--gold)18',
          zIndex: 201,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'sUp .22s ease both',
        }}
      >
        {/* Search */}
        <div style={{
          padding: 12,
          borderBottom: '1px solid var(--brd)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: 'var(--dim)', fontSize: 14 }}>🔍</span>
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('picker.search')}
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', color: 'var(--txt)',
              fontFamily: "'Syne',sans-serif", fontSize: 13,
            }}
          />
          <kbd style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 6px', borderRadius: 5,
            background: 'var(--card)', border: '1px solid var(--brd)',
            color: 'var(--dim)', fontSize: 9, fontFamily: "'Syne',sans-serif",
            letterSpacing: 0.5,
          }}>ESC</kbd>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {filtered.length === 0 && (
            <div style={{
              padding: 24, textAlign: 'center',
              color: 'var(--dim)', fontSize: 12,
            }}>
              {t('picker.no_results')}
            </div>
          )}
          {filtered.map(g => {
            const isActive  = g.id === activeGroupId;
            const members   = g.members_preview || [];
            const pending   = g.pending_count || 0;
            const lastSeen  = timeAgo(g.last_activity, t);
            return (
              <div key={g.id}
                onClick={() => { onSwitch(g.id); closePicker(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 12px', cursor: 'pointer',
                  borderBottom: '1px solid var(--brd)44',
                  background: isActive ? 'var(--gold)0e' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--gold)' : '3px solid transparent',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--card)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 11,
                  background: isActive ? 'var(--gold)25' : 'var(--card)',
                  border: `1px solid ${isActive ? 'var(--gold)66' : 'var(--brd)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>{g.emoji}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontWeight: 700, fontSize: 13, lineHeight: 1.2,
                    color: isActive ? 'var(--gold)' : 'var(--txt)',
                  }}>
                    <span style={{
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      flex: 1, minWidth: 0,
                    }}>{g.name}</span>
                    {g.role !== 'member' && (
                      <span style={{
                        fontSize: 8, padding: '2px 5px', borderRadius: 4,
                        background: 'var(--gold)22', color: 'var(--gold)',
                        fontWeight: 800, letterSpacing: 0.5, flexShrink: 0,
                      }}>{g.role === 'owner' ? '★' : '☆'}</span>
                    )}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
                    fontSize: 10, color: 'var(--dim)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: -6 }}>
                      {members.slice(0, 3).map((m, i) => (
                        <div key={m.id || i} style={{
                          marginLeft: i === 0 ? 0 : -6,
                          border: '1.5px solid var(--surf)',
                          borderRadius: '50%',
                          zIndex: 3 - i,
                        }}>
                          <AvatarChip m={m} size={18} />
                        </div>
                      ))}
                      {g.member_count > members.slice(0, 3).length && (
                        <span style={{
                          marginLeft: 4, fontSize: 10, color: 'var(--mut)',
                        }}>+{g.member_count - Math.min(3, members.length)}</span>
                      )}
                    </div>
                    {lastSeen && <span>· {lastSeen}</span>}
                  </div>
                </div>

                {pending > 0 && (
                  <div style={{
                    minWidth: 22, height: 22, padding: '0 6px',
                    borderRadius: 11,
                    background: isActive ? 'var(--gold)' : 'var(--gold)33',
                    color: isActive ? '#07060f' : 'var(--gold)',
                    fontSize: 10, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>{pending}</div>
                )}

                {isActive && onOpenGroupInfo && (
                  <button
                    onClick={e => { e.stopPropagation(); closePicker(); onOpenGroupInfo(); }}
                    title={t('picker.info')}
                    style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: 'transparent', border: '1px solid var(--brd)',
                      color: 'var(--dim)', cursor: 'pointer', fontSize: 12,
                    }}
                  >👥</button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer: create */}
        <div
          onClick={() => { onCreate(); closePicker(); }}
          style={{
            padding: 12,
            borderTop: '1px solid var(--brd)',
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', background: 'var(--card)',
            color: 'var(--gold)', fontSize: 13, fontWeight: 700,
            transition: 'background .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold)15'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)'; }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 9,
            background: 'var(--gold)22', border: '1px solid var(--gold)55',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>＋</div>
          <span style={{ flex: 1 }}>{t('picker.create')}</span>
          <kbd style={{
            padding: '2px 6px', borderRadius: 5,
            background: 'var(--surf)', border: '1px solid var(--brd)',
            color: 'var(--dim)', fontSize: 9,
          }}>⌘K</kbd>
        </div>
      </div>
    </>,
    document.body
  );

  return (
    <>
      {chip}
      {panel}
    </>
  );
}
