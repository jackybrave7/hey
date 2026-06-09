// Web Push notifications (browser push даже когда вкладка закрыта).
// Использует web-push (VAPID, RFC 8292).
const fs   = require('fs');
const path = require('path');
const webpush = require('web-push');

const DATA_DIR = path.join(__dirname, '../data');
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');

// Получаем VAPID-ключи: сначала из .env, затем из файла-кеша, затем генерим и кешируем.
function loadOrCreateVapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey:  process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  }
  if (fs.existsSync(VAPID_FILE)) {
    try { return JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8')); } catch {}
  }
  console.log('[push] VAPID keys not found, generating new pair...');
  const keys = webpush.generateVAPIDKeys();
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
  fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2));
  console.log('[push] VAPID keys saved to', VAPID_FILE);
  return keys;
}

const VAPID = loadOrCreateVapidKeys();
const CONTACT = process.env.VAPID_CONTACT_EMAIL || 'mailto:admin@hey-messenger.ru';

webpush.setVapidDetails(CONTACT, VAPID.publicKey, VAPID.privateKey);

function getPublicKey() { return VAPID.publicKey; }

// Отправка push одному получателю. Возвращает true если ОК, false если 410/404
// (subscription мертва — её нужно удалить).
//
// Опции отправки:
//   urgency:'high' — RFC 8030 / Web Push Protocol. Без этого FCM/Mozilla
//     могут батчить пуши на устройствах в Doze-режиме до десятков минут.
//     'high' = реалтайм-доставка (как мессенджер).
//   TTL: 86400 (24ч) — если устройство офлайн дольше суток, пуш сжигается
//     (старое сообщение всё равно потеряло актуальность).
//   topic — позволяет push-сервису заменять предыдущий неполученный пуш
//     по той же теме. По convId — если за время оффлайна пришло 5 сообщений
//     в одном чате, на устройство приедет один последний, а не 5 устаревших.
async function sendPush(subscription, payload) {
  try {
    const opts = {
      TTL: 86400,
      urgency: 'high',
    };
    // tag в payload приходит в формате "msg:<convId>" — используем как topic
    // для деудуп-а на стороне push-сервиса (FCM/AutoPush).
    if (payload?.tag && typeof payload.tag === 'string' && payload.tag.length <= 32) {
      // Web Push Topic: только base64url-safe символы, максимум 32 байта
      const topic = payload.tag.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32);
      if (topic) opts.topic = topic;
    }
    await webpush.sendNotification(subscription, JSON.stringify(payload), opts);
    return { ok: true };
  } catch (err) {
    const code = err.statusCode || 0;
    // 410 Gone / 404 Not Found — подписка истекла, нужно удалить
    if (code === 410 || code === 404) return { ok: false, gone: true };
    console.warn('[push] sendNotification error:', code, err.body || err.message);
    return { ok: false, gone: false, error: err.message };
  }
}

// Bulk-отправка: получает массив подписок одного юзера. Возвращает endpoints
// которые надо удалить из БД.
async function sendPushToUser(subscriptions, payload) {
  const toRemove = [];
  await Promise.all(subscriptions.map(async sub => {
    const res = await sendPush({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    }, payload);
    if (res.gone) toRemove.push(sub.endpoint);
  }));
  return toRemove;
}

module.exports = { getPublicKey, sendPush, sendPushToUser };
