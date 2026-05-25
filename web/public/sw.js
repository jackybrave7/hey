// HEY Service Worker — минимальный, только для Web Push нотификаций.
// Не кэширует ассеты (это сделано намеренно — чтобы не было stale-кэш проблем,
// которые я уже видел в чате). Только handlers для push и click.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {}
  const title = payload.title || 'HEY';
  const body  = payload.body  || 'Новое сообщение';
  const url   = payload.url   || '/';
  const tag   = payload.tag   || 'hey-msg';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/apple-touch-icon.svg',
      badge: '/favicon.svg',
      tag,
      data: { url, messageId: payload.messageId || null },
      vibrate: [80, 40, 80],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Если уже открыт HEY где-нибудь — фокусируем
    for (const client of allClients) {
      try {
        const u = new URL(client.url);
        if (u.origin === self.location.origin) {
          await client.focus();
          // Просим клиента перейти на нужный URL (через postMessage)
          client.postMessage({ type: 'hey:navigate', url });
          return;
        }
      } catch {}
    }
    // Иначе открываем новую вкладку
    if (self.clients.openWindow) {
      await self.clients.openWindow(url);
    }
  })());
});
