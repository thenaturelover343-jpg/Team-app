/* global self, caches */
const APP_VERSION = '2026-09-18-pwa2';
const CACHE = 'barlicious-shell-' + APP_VERSION;
const SHELL = ['/', '/install', '/install.html', '/manifest.webmanifest', '/favicon.svg', '/pwa-192x192.png', '/pwa-512x512.png', '/brand-logo.svg', '/install-qr.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => undefined));
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const network = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, network.clone());
        return network;
      } catch {
        return (await caches.match(request)) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const network = await fetch(request);
      if (network.ok && (url.pathname.startsWith('/_next/') || url.pathname.match(/\.(png|svg|webmanifest|js|css|html)$/))) {
        const cache = await caches.open(CACHE);
        cache.put(request, network.clone());
      }
      return network;
    } catch {
      return cached || Response.error();
    }
  })());
});

self.addEventListener('push', event => {
  let message = { title: 'Barlicious Team', body: 'U hebt een nieuwe melding.', url: '/' };
  try { message = { ...message, ...JSON.parse(event.data?.text() || '{}') }; } catch { /* keep safe fallback */ }
  event.waitUntil(self.registration.showNotification(message.title, {
    body: message.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: message.url || '/' },
    tag: message.tag || 'barlicious',
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      existing.focus();
      if ('navigate' in existing) return existing.navigate(target);
      return undefined;
    }
    return self.clients.openWindow(target);
  }));
});
