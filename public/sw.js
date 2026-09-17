/* global self */
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
