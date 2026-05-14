import React from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.jsx';
import { LanguageProvider } from './i18n.js';
import { ToastProvider } from './Toast.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

// Error tracking — no-op unless VITE_SENTRY_DSN is set. The user adds
// the DSN as an env var on Render (or in a local .env.local) when they
// sign up at sentry.io; the rest of the app stays identical.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    // Conservative defaults — turn up later if you need session replay
    // or performance traces. tracesSampleRate=0 disables transaction
    // capture; only errors are sent.
    tracesSampleRate: 0,
    // Don't ship PII (avatar URLs, group invite codes, etc.) automatically.
    sendDefaultPii: false,
    ignoreErrors: [
      // Browser noise we can't fix server-side
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],
  });
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <LanguageProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </LanguageProvider>
  </ErrorBoundary>
);
