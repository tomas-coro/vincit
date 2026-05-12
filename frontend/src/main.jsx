import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { LanguageProvider } from './i18n.js';
import { ToastProvider } from './Toast.jsx';

createRoot(document.getElementById('root')).render(
  <LanguageProvider>
    <ToastProvider>
      <App />
    </ToastProvider>
  </LanguageProvider>
);
