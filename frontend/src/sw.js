import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ── Push notifications ──────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { data = { title: 'StayLite', body: event.data?.text() }; }

  const options = {
    body:    data.body  || '',
    icon:    data.icon  || '/favicon.svg',
    badge:   '/favicon.svg',
    vibrate: [100, 50, 100],
    data:    { url: data.url || '/' },
    actions: [{ action: 'open', title: 'Open' }],
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'StayLite', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
