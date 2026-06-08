// HEY Service Worker — минимальный, только для Web Push нотификаций.
// Не кэширует ассеты (это сделано намеренно — чтобы не было stale-кэш проблем,
// которые я уже видел в чате). Только handlers для push и click.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Chrome требует наличие fetch-handler'а для пометки SW как «installable»
// (т.е. чтобы появилась подсказка «Add to Home Screen» в Android Chrome).
// Кеширование делать не хотим — staleness в чате критична. Просто отдаём
// сетевой ответ как есть, без перехвата. Если сеть упала — браузер сам
// покажет свою offline-страницу.
self.addEventListener('fetch', (event) => {
  // ничего не делаем — событие обработано, респонс из сети идёт сам
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {}
  const title = payload.title || 'HEY';
  const body  = payload.body  || 'Новое сообщение';
  const url   = payload.url   || '/';
  const tag   = payload.tag   || 'hey-msg';

  event.waitUntil((async () => {
    // Подавляем дубль уведомления, если приложение сейчас открыто и в фокусе:
    // юзер уже видит сообщение через WS, второе системное notification только
    // мешает. Если ни одного focused-клиента нет (PWA свернут / TWA в фоне /
    // приложение закрыто) — показываем как обычно.
    //
    // Opera Android (и часть других браузеров) врут на c.focused — всегда
    // false. Поэтому проверяем не только focused, но и visibilityState:
    // если есть хоть один visible-клиент того же origin, считаем что юзер
    // видит приложение и push не нужен.
    const clientsList = await self.clients.matchAll({
      type: 'window', includeUncontrolled: true,
    });
    const hasVisible = clientsList.some(c => c.visibilityState === 'visible');
    if (hasVisible) return;
    await self.registration.showNotification(title, {
      body,
      // icon — крупная цветная иконка в шторке уведомлений (рядом с текстом)
      icon: '/icon-192.png',
      // badge — мелкая монохромная иконка в самой верхней статус-строке Android.
      // Android требует белый силуэт на прозрачном фоне; цветную PNG он
      // покажет квадратом. /badge-96.png — белая звезда HEY.
      badge: '/badge-96.png',
      tag,
      data: { url, messageId: payload.messageId || null },
      vibrate: [80, 40, 80],
    });
  })());
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
