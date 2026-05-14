import React, { useState } from 'react';

// Generic empty-state with the editorial language of the app: big emoji,
// italic Cormorant headline, dimmed body, optional CTA pill, optional
// "Come funziona?" disclosure that reveals 2-3 lines of plain-language
// help. Used to turn "Nessuna bet" dead-ends into a guided next step.
export default function EmptyState({
  emoji, title, body,
  cta,            // { label, onClick, icon? }
  tutorial,       // { label, body }  — body can be string or string[] for paragraphs
  align = 'center',
}) {
  const [open, setOpen] = useState(false);
  const para = Array.isArray(tutorial?.body) ? tutorial.body : (tutorial?.body ? [tutorial.body] : []);

  return (
    <div style={{
      textAlign: align, padding: '40px 16px 36px', color: 'var(--dim)',
      maxWidth: 460, marginLeft: align === 'center' ? 'auto' : 0, marginRight: align === 'center' ? 'auto' : 0,
    }}>
      {emoji && (
        <div style={{ fontSize: 48, marginBottom: 14, lineHeight: 1, filter: 'drop-shadow(0 8px 22px var(--glow))' }}>
          {emoji}
        </div>
      )}

      {title && (
        <div style={{
          fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
          fontSize: 22, fontWeight: 600, color: 'var(--txt)',
          lineHeight: 1.15, letterSpacing: '-0.01em', marginBottom: 8,
        }}>{title}</div>
      )}

      {body && (
        <div style={{
          fontSize: 13, color: 'var(--dim)', lineHeight: 1.6,
          marginBottom: cta || tutorial ? 18 : 0,
          whiteSpace: 'pre-line',
        }}>{body}</div>
      )}

      {cta && (
        <button onClick={cta.onClick} style={{
          padding: '10px 20px', borderRadius: 999, border: 'none',
          background: 'linear-gradient(90deg, var(--gold) 0%, var(--goldL) 50%, var(--gold) 100%)',
          backgroundSize: '200% 100%', animation: 'shimmer 3s linear infinite',
          color: '#1a1530',
          fontFamily: "'Manrope',sans-serif", fontSize: 12, fontWeight: 800,
          letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer',
          boxShadow: '0 14px 30px -10px var(--gold)',
          WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
        }}>
          {cta.icon && <span style={{ marginRight: 6 }}>{cta.icon}</span>}
          {cta.label}
        </button>
      )}

      {tutorial && (
        <div style={{ marginTop: cta ? 22 : 14 }}>
          <button onClick={() => setOpen(o => !o)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--dim)',
            fontFamily: "'Manrope',sans-serif", fontSize: 10, fontWeight: 700,
            letterSpacing: '.22em', textTransform: 'uppercase',
            padding: '6px 8px',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              display: 'inline-block', transition: 'transform .25s',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              color: 'var(--gold)',
            }}>›</span>
            {tutorial.label}
          </button>
          {open && (
            <div className="fIn" style={{
              marginTop: 8, padding: '12px 14px',
              borderLeft: '2px solid var(--gold)',
              background: 'var(--gold)0a',
              textAlign: 'left',
              fontSize: 12, lineHeight: 1.6, color: 'var(--dim)',
            }}>
              {para.map((p, i) => (
                <div key={i} style={{ marginTop: i ? 8 : 0 }}>{p}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
