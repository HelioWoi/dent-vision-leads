self.addEventListener('push', (event) => {
  let payload = { title: 'Dent Vision', body: 'New lead waiting for your quote', url: '/#/partner/leads' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // keep defaults
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: 'https://wtfstakxspbnghalelby.supabase.co/storage/v1/object/public/media/favicon.png',
        badge: 'https://wtfstakxspbnghalelby.supabase.co/storage/v1/object/public/media/favicon.png',
        data: { url: payload.url },
        silent: false,
      }),
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (const client of windowClients) {
          client.postMessage({ type: 'partner-new-lead-push' });
        }
      }),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/#/partner/leads';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
    }),
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
