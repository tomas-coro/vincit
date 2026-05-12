import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';

const ToastContext = createContext(null);
let _nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback(id => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const push = useCallback((message, variant = 'info', duration = 3500) => {
    const id = _nextId++;
    setToasts(t => [...t, { id, message, variant, duration }]);
    return id;
  }, []);

  const api = useMemo(() => ({
    success: m => push(m, 'success', 3000),
    error:   m => push(m, 'error',   5000),
    info:    m => push(m, 'info',    3500),
    dismiss,
    push,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
  return ctx;
}

function ToastViewport({ toasts, dismiss }) {
  return (
    <div style={{
      position:'fixed', top:16, right:16, zIndex:9000,
      display:'flex', flexDirection:'column', gap:8,
      alignItems:'flex-end', pointerEvents:'none',
      maxWidth: 'calc(100vw - 32px)',
    }}>
      <style>{`
        @keyframes toastIn  { from { transform: translateX(40px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        @keyframes toastBar { from { transform: scaleX(1) } to { transform: scaleX(0) } }
      `}</style>
      {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />)}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    if (toast.duration <= 0) return;
    const id = setTimeout(onDismiss, toast.duration);
    return () => clearTimeout(id);
  }, [toast.duration, onDismiss]);

  const cfg = {
    success: { color: 'var(--grn)',  icon: '✓' },
    error:   { color: 'var(--red)',  icon: '⚠' },
    info:    { color: 'var(--gold)', icon: 'ℹ' },
  }[toast.variant] || { color: 'var(--gold)', icon: 'ℹ' };

  return (
    <div onClick={onDismiss} style={{
      pointerEvents: 'auto',
      background: 'var(--surf)',
      border: '1px solid var(--brd)',
      borderLeft: `4px solid ${cfg.color}`,
      borderRadius: 10,
      padding: '10px 16px',
      minWidth: 240,
      maxWidth: 380,
      boxShadow: '0 10px 28px rgba(0,0,0,.45)',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 10,
      fontFamily: "'Syne', sans-serif", fontSize: 13,
      color: 'var(--txt)',
      animation: 'toastIn .25s cubic-bezier(.34,1.56,.64,1) both',
      position: 'relative', overflow: 'hidden',
    }}>
      <span style={{ color: cfg.color, fontSize: 16, fontWeight: 800, flexShrink: 0 }}>{cfg.icon}</span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
      <span style={{ fontSize: 11, color: 'var(--mut)', flexShrink: 0 }}>✕</span>
      {toast.duration > 0 && (
        <div style={{
          position: 'absolute', left: 0, bottom: 0, height: 2, width: '100%',
          background: cfg.color, transformOrigin: 'left',
          animation: `toastBar ${toast.duration}ms linear forwards`,
        }}/>
      )}
    </div>
  );
}
