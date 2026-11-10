// Service worker: deixa o sistema abrir mesmo sem internet.
// Arquivos da tela: busca na rede primeiro (para receber atualizações) e usa a cópia guardada se cair a conexão.
// A API nunca é guardada: dados sempre vêm do servidor.
const CACHE = 'patrimonio-v1';
const SHELL = ['/', '/style.css', '/app.js', '/barcode.js', '/theme.js', '/icon.svg', '/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('/')))
  );
});
