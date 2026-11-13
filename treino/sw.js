/* Protocolo V — service worker: app abre offline; arquivos próprios em rede-primeiro, SDK e fontes em cache-primeiro. */
const VERSION = 'pv-11';
const SHELL = ['./', 'index.html', 'app.css?v=10', 'app.js?v=10', 'data.js?v=10', 'taco.js?v=10', 'manifest.webmanifest?v=2', 'icons/icon.svg', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const CACHE_FIRST = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.googleapis\.com|fonts\.gstatic\.com)/;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.startsWith('/treino/')) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined))));
    return;
  }
  if (CACHE_FIRST.test(req.url)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res;
    })));
  }
});
