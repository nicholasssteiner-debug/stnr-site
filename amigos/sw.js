// Service worker mínimo: permite instalar como app. Não guarda nada em cache (os dados vêm do Firebase).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
