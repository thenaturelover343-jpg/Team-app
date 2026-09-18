/* global self */
/* Barlicious Team SW — push + soft update (skipWaiting) */

self.addEventListener('install', (event) => {
  // Activate ASAP when client asks via SKIP_WAITING; otherwise wait for navigation.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;
  if (data === 'SKIP_WAITING' || data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  let message = { title: 'Barlicious Team', body: 'U hebt een nieuwe melding.' };
  try {
    message = { ...message, ...JSON.parse(event.data?.text() || '{}') };
  } catch {
    /* keep safe fallback */
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { url: message.url || '/' },
      tag: message.tag || undefined,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        return existing.focus().then(() => {
          try {
            existing.postMessage({ type: 'APP_UPDATE_AVAILABLE' });
          } catch {
            /* ignore */
          }
          if ('navigate' in existing) return existing.navigate(target);
        });
      }
      return self.clients.openWindow(target);
    })
  );
});
