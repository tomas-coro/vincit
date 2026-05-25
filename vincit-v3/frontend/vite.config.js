import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Capacitor serves assets from file:// (or capacitor://localhost), so paths
  // must be relative. The standard web build keeps the default '/'.
  base: mode === 'capacitor' ? './' : '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
  },
  build: {
    // Vite's default chunk-size warning threshold (500kb) is conservative
    // — bump it slightly so the warning only fires on genuine bloat now
    // that the heavy stuff is split off into per-route chunks anyway.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Keep the React runtime + Sentry in their own dedicated chunks
        // so a small app-code change doesn't bust their cached copies.
        // Everything else falls into the default chunking + the dynamic
        // imports we added via React.lazy.
        manualChunks: {
          react:  ['react', 'react-dom'],
          sentry: ['@sentry/react'],
        },
      },
    },
  },
}));
