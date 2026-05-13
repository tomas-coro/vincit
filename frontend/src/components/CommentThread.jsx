import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLang } from '../i18n.js';
import { useToast } from '../Toast.jsx';
import * as api from '../api.js';
import { COLORS } from './Atoms.jsx';

// Format a created_at (ms) as a short relative time: "2m", "1h", "3g".
// Falls back to a date string after a week.
function relTime(ms, lang = 'it') {
  const d = Date.now() - ms;
  if (d < 60_000)        return lang === 'en' ? 'now' : 'ora';
  if (d < 3_600_000)     return Math.floor(d / 60_000)    + 'm';
  if (d < 86_400_000)    return Math.floor(d / 3_600_000) + 'h';
  if (d < 604_800_000)   return Math.floor(d / 86_400_000) + (lang === 'en' ? 'd' : 'g');
  return new Date(ms).toLocaleDateString();
}

// Twitter-style comment thread under a bet. Anyone in the bet's room can
// post. Author can delete their own.
//
// Props:
//   betId           — the bet to thread under
//   user            — current viewer's userId (to highlight own messages)
//   profiles        — { userId: { name, avatar, avatarUrl, colorKey } } for fallback when row lacks fresh profile data
//   initialCount    — server-supplied count for the collapsed badge
//   onCountChange   — fires with the new count after post/delete; lets BetCard refresh visible badge
//   defaultExpanded — debug/test toggle
export default function CommentThread({
  betId, user, profiles = {}, initialCount = 0, onCountChange, defaultExpanded = false,
}) {
  const { t, lang } = useLang();
  const toast = useToast();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [messages, setMessages] = useState([]);
  const [loaded,   setLoaded]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [draft,    setDraft]    = useState('');
  const [sending,  setSending]  = useState(false);
  const inputRef = useRef(null);

  // Lazy-load on first expand. Subsequent expand/collapse keeps the
  // already-fetched list in memory.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { messages: list } = await api.getBetMessages(betId);
      setMessages(list || []);
      setLoaded(true);
      onCountChange?.((list || []).length);
    } catch (e) {
      console.error('[CommentThread load]', e);
      toast.error(t('comments.err_load'));
    } finally {
      setLoading(false);
    }
  }, [betId, onCountChange, t, toast]);

  useEffect(() => {
    if (expanded && !loaded) load();
  }, [expanded, loaded, load]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    if (body.length > 500) { toast.error(t('comments.err_long')); return; }
    setSending(true);
    try {
      const { message } = await api.postBetMessage(betId, body);
      if (message) {
        setMessages(m => {
          const next = [...m, message];
          onCountChange?.(next.length);
          return next;
        });
      }
      setDraft('');
      // Auto-grow textarea reset
      if (inputRef.current) inputRef.current.style.height = 'auto';
    } catch (e) {
      console.error('[CommentThread send]', e);
      toast.error(t('comments.err_send'));
    } finally {
      setSending(false);
    }
  };

  const remove = async (msgId) => {
    try {
      await api.deleteBetMessage(betId, msgId);
      setMessages(m => {
        const next = m.filter(x => x.id !== msgId);
        onCountChange?.(next.length);
        return next;
      });
    } catch (e) {
      console.error('[CommentThread delete]', e);
      toast.error(t('comments.err_delete'));
    }
  };

  // Visible badge count — prefer the freshly-loaded count, fall back to
  // the server-provided initialCount before the thread has been opened.
  const visibleCount = loaded ? messages.length : initialCount;

  return (
    <div style={{ marginTop: 8, borderTop: '1px solid var(--brd)', paddingTop: 8 }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '6px 0',
          color: 'var(--dim)',
          fontFamily: "'Manrope',sans-serif",
          fontSize: 11, fontWeight: 600, letterSpacing: '.18em', textTransform: 'uppercase',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span>
          💬 {t('comments.label')}
          {visibleCount > 0 && (
            <span style={{ marginLeft: 6, color: 'var(--gold)' }}>{visibleCount}</span>
          )}
        </span>
        <span style={{ fontSize: 14, color: 'var(--mut)' }}>{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div style={{ marginTop: 10 }}>
          {/* Message list */}
          {loading && !loaded && (
            <div className="bc-meta" style={{ fontSize: 9, color: 'var(--mut)', padding: '12px 0', textAlign: 'center' }}>
              {t('comments.loading')}
            </div>
          )}
          {loaded && messages.length === 0 && (
            <div style={{
              fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
              fontSize: 14, color: 'var(--mut)', padding: '10px 2px 14px',
              textAlign: 'center',
            }}>
              {t('comments.empty')}
            </div>
          )}
          {loaded && messages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
              {messages.map(m => {
                const isMine = m.author_id === user;
                const fallbackProfile = profiles[m.author_id];
                const avatar = m.author_avatar || fallbackProfile?.avatar || '👤';
                const name   = m.author_name   || fallbackProfile?.name   || '—';
                const colorKey = m.author_color || fallbackProfile?.colorKey || fallbackProfile?.color || 'blue';
                const accent = COLORS[colorKey] || '#5b8af0';
                return (
                  <div key={m.id} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: `${accent}33`,
                      border: `1px solid ${accent}66`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, overflow: 'hidden',
                    }}>
                      {fallbackProfile?.avatarUrl
                        ? <img src={fallbackProfile.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                        : avatar}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex', alignItems: 'baseline', gap: 8,
                        flexWrap: 'wrap',
                      }}>
                        <span style={{
                          fontFamily: "'Manrope',sans-serif",
                          fontSize: 12, fontWeight: 700, color: accent,
                          letterSpacing: '-0.01em',
                        }}>{name}</span>
                        <span className="bc-meta" style={{ fontSize: 8, opacity: .6 }}>
                          · {relTime(m.created_at, lang)}
                        </span>
                        {isMine && (
                          <button
                            onClick={() => remove(m.id)}
                            aria-label={t('comments.delete')}
                            style={{
                              marginLeft: 'auto',
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              color: 'var(--mut)', fontSize: 11, padding: '0 2px',
                              WebkitTapHighlightColor: 'transparent',
                            }}
                          >✕</button>
                        )}
                      </div>
                      <div style={{
                        fontFamily: "'Manrope',sans-serif",
                        fontSize: 13, lineHeight: 1.45,
                        color: 'var(--txt)', wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        marginTop: 2,
                      }}>
                        {m.body}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Input row */}
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-end',
            padding: '8px 0 4px',
            borderTop: '1px dashed var(--brd)',
          }}>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                // Auto-grow up to ~4 lines.
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
              }}
              placeholder={t('comments.placeholder')}
              maxLength={500}
              rows={1}
              style={{
                flex: 1, resize: 'none',
                background: 'transparent',
                border: 'none', borderBottom: '1px solid var(--brd)',
                color: 'var(--txt)', padding: '6px 2px',
                fontFamily: "'Manrope',sans-serif", fontSize: 13,
                outline: 'none', minHeight: 26, maxHeight: 96,
                lineHeight: 1.4,
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button
              onClick={send}
              disabled={!draft.trim() || sending}
              style={{
                flexShrink: 0,
                padding: '8px 16px', borderRadius: 999,
                background: draft.trim() ? 'var(--gold)' : 'var(--mut)44',
                color: draft.trim() ? '#1a1530' : 'var(--mut)',
                border: 'none',
                fontFamily: "'Manrope',sans-serif", fontSize: 11, fontWeight: 800,
                letterSpacing: '.18em', textTransform: 'uppercase',
                cursor: draft.trim() && !sending ? 'pointer' : 'not-allowed',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}
            >
              {t('comments.send')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
