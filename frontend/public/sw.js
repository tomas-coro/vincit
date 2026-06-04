// ── Offline shell ────────────────────────────────────────────────────
// Network-first SOLO sulle navigazioni: se la rete manca, servi la shell
// (index.html) dalla cache. Niente cache per /api/* né per gli asset
// hashati di Vite (HTTP cache). Bump della versione = invalidazione.
const SHELL_CACHE = 'vincit-shell-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.add('/')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        // Tieni fresca la copia della shell (solo pathname "/", così una
        // navigazione tipo /qualcosa non inquina la chiave).
        if (r.ok && new URL(e.request.url).pathname === '/') {
          const copy = r.clone();
          caches.open(SHELL_CACHE).then(c => c.put('/', copy)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match('/'))
  );
});

self.addEventListener('push', e => {
  const d = e.data?.json() ?? {};
  e.waitUntil(self.registration.showNotification(d.title || 'Vincit 🎲', {
    body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: d.url || '/' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window'}).then(list => {
    const w = list.find(c => c.url.includes(self.location.origin));
    return w ? w.focus() : clients.openWindow(e.notification.data.url);
  }));
});
