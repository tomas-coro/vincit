import React from 'react';

// Root-level error boundary. Instead of the dreaded white screen, show
// the actual error + stack so we can read it from the user's phone.
// Production builds otherwise swallow render errors silently.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
    this.setState({ info });
  }
  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', padding: '24px 16px',
        background: '#0f0b23', color: '#ede8fd',
        fontFamily: "'Archivo',sans-serif",
        overflowY: 'auto',
      }}>
        <div style={{
          fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
          fontSize: 28, color: '#e3434b', marginBottom: 8,
        }}>Qualcosa è andato storto</div>
        <div style={{ fontSize: 12, color: '#8480a0', marginBottom: 18, letterSpacing: 1, textTransform: 'uppercase' }}>
          Errore rilevato — schermata fallback
        </div>

        <div style={{
          background: '#1a1530', border: '1px solid #2d2654',
          borderRadius: 10, padding: 14, marginBottom: 14,
          fontSize: 12, color: '#ff8a96', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{error.name}: {error.message}</div>
          {error.stack && (
            <div style={{ fontSize: 10, color: '#8480a0', fontFamily: 'ui-monospace, monospace', lineHeight: 1.5 }}>
              {error.stack}
            </div>
          )}
        </div>

        {info?.componentStack && (
          <div style={{
            background: '#1a1530', border: '1px solid #2d2654',
            borderRadius: 10, padding: 14, marginBottom: 14,
            fontSize: 10, color: '#8480a0', fontFamily: 'ui-monospace, monospace',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5,
          }}>
            {info.componentStack}
          </div>
        )}

        <button onClick={() => { window.location.reload(); }} style={{
          padding: '10px 22px', borderRadius: 999, border: 'none',
          background: '#c4a878', color: '#1a1530',
          fontFamily: "'Archivo',sans-serif", fontSize: 12, fontWeight: 800,
          letterSpacing: '.18em', textTransform: 'uppercase',
          cursor: 'pointer',
        }}>Ricarica</button>
      </div>
    );
  }
}
