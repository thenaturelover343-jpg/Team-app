/* global self */
const CACHE = 'barlicious-team-v2026-09-18-compass-pwa-icons';
const PRECACHE = [
  '/',
  '/install',
  '/install/',
  '/install.html',
  '/manifest.webmanifest',
  '/app-version.txt',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/favicon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE).catch(() => undefined)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/** Network-first for install + version so update banner / install steps stay fresh. */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  const isInstallOrVersion =
    url.pathname === '/install' ||
    url.pathname === '/install/' ||
    url.pathname === '/install.html' ||
    url.pathname === '/install/index.html' ||
    url.pathname === '/app-version.txt' ||
    url.pathname === '/manifest.webmanifest';

  if (isInstallOrVersion) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
});

self.addEventListener('push', event => {
  let message = { title: 'Barlicious Team', body: 'U hebt een nieuwe melding.' };
  try { message = { ...message, ...JSON.parse(event.data?.text() || '{}') }; } catch { /* keep safe fallback */ }
  event.waitUntil(self.registration.showNotification(message.title, {
    body: message.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: '/' },
    tag: message.tag || undefined,
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    return existing ? existing.focus() : self.clients.openWindow('/');
  }));
});
