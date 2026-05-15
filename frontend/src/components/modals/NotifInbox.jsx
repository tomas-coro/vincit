import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

function relTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'ora';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm fa';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h fa';
  if (diff < 172800000) return 'ieri';
  return new Date(ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function typeBorderColor(type) {
  switch (type) {
    case 'won':     return 'var(--grn)';
    case 'lost':    return 'var(--red)';
    case 'trophy':  return 'var(--gold)';
    case 'new_bet': return 'var(--pur)';
    case 'counter': return 'var(--blu)';
    default:        return 'var(--brd)';
  }
}

export default function NotifInbox({ open, onClose, items, onMarkAllRead, onClearAll, onGoToBet }) {
  const [visible, setVisible] = useState(false);
  const isDesktop = typeof window !== 'undefined' && window.innerWidth > 768;
  const unreadCount = items.filter(i => !i.read).length;

  useEffect(() => {
    if (open) {
      setVisible(true);
    } else {
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!visible && !open) return null;

  const sheetStyle = isDesktop
    ? {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: open ? 'translate(-50%, -50%)' : 'translate(-50%, calc(-50% + 40px))',
        opacity: open ? 1 : 0,
        maxWidth: 400,
        width: '90vw',
        maxHeight: '80vh',
        borderRadius: 12,
        background: 'var(--surf)',
        border: '1px solid var(--brd)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        transition: 'transform .3s cubic-bezier(.4,0,.2,1), opacity .3s cubic-bezier(.4,0,.2,1)',
        overflow: 'hidden',
      }
    : {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        maxHeight: '70vh',
        borderRadius: '16px 16px 0 0',
        background: 'var(--surf)',
        border: '1px solid var(--brd)',
        borderBottom: 'none',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        transition: 'transform .3s cubic-bezier(.4,0,.2,1)',
        overflow: 'hidden',
      };

  const modal = (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 999,
          opacity: open ? 1 : 0,
          transition: 'opacity .3s cubic-bezier(.4,0,.2,1)',
        }}
      />
      <div style={sheetStyle}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '14px 16px 10px',
          borderBottom: '1px solid var(--rule)',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: 'italic',
            fontSize: 22,
            color: 'var(--txt)',
            flex: 1,
            lineHeight: 1,
          }}>
            Notifiche
          </span>

          {unreadCount > 0 && (
            <span style={{
              background: 'var(--gold)',
              color: '#000',
              borderRadius: 999,
              fontSize: 11,
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.04em',
              padding: '2px 7px',
              lineHeight: 1.4,
            }}>
              {unreadCount}
            </span>
          )}

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--dim)',
              fontSize: 18,
              cursor: 'pointer',
              padding: '0 2px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {(unreadCount > 0 || items.length > 0) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 16,
            padding: '8px 16px',
            borderBottom: '1px solid var(--rule)',
            flexShrink: 0,
          }}>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--gold)',
                  fontSize: 12,
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  letterSpacing: '0.03em',
                }}
              >
                Segna tutti come letti
              </button>
            )}
            {items.length > 0 && (
              <button
                onClick={onClearAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--dim)',
                  fontSize: 11,
                  fontFamily: "'Manrope', sans-serif",
                  cursor: 'pointer',
                  padding: 0,
                  letterSpacing: '0.03em',
                }}
              >
                Svuota
              </button>
            )}
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {items.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 120,
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: 'italic',
              fontSize: 17,
              color: 'var(--dim)',
            }}>
              Nessuna notifica
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.id}
                onClick={item.betId ? () => { onGoToBet(item.betId); onClose(); } : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 16px',
                  background: !item.read ? 'color-mix(in srgb, var(--gold) 5%, transparent)' : 'transparent',
                  borderLeft: `2px solid ${typeBorderColor(item.type)}`,
                  borderBottom: idx < items.length - 1 ? '1px solid var(--rule)' : 'none',
                  cursor: item.betId ? 'pointer' : 'default',
                  transition: 'background .15s',
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1.2, flexShrink: 0 }}>
                  {item.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Manrope', sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    color: 'var(--txt)',
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {item.title}
                  </div>
                  {item.body && (
                    <div style={{
                      fontFamily: "'Manrope', sans-serif",
                      fontSize: 11,
                      color: 'var(--dim)',
                      marginTop: 2,
                      lineHeight: 1.4,
                    }}>
                      {item.body}
                    </div>
                  )}
                </div>
                <span style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 10,
                  color: 'var(--dim)',
                  flexShrink: 0,
                  marginTop: 2,
                  letterSpacing: '0.01em',
                }}>
                  {relTime(item.at)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );

  return ReactDOM.createPortal(modal, document.body);
}
