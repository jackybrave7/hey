// Web Push helpers — регистрация SW, подписка, отписка.
import { api } from '../api';

const SW_PATH = '/sw.js';

export function isPushSupported() {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
}

export function getPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

// Регистрирует SW (если ещё нет). Возвращает Registration.
export async function registerServiceWorker() {
  if (!isPushSupported()) throw new Error('Push не поддерживается в этом браузере');
  let reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!reg) reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
  await navigator.serviceWorker.ready;
  return reg;
}

function urlBase64ToUint8Array(b64) {
  const padding = '='.repeat((4 - b64.length % 4) % 4);
  const base64  = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  const out     = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Спрашивает разрешение, регистрирует SW, создаёт подписку, отправляет на сервер.
// Возвращает {ok: true} или {ok: false, reason: '...'}
export async function subscribeToPush() {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: permission };

  const { publicKey } = await api.getPushPublicKey();
  if (!publicKey) return { ok: false, reason: 'no-server-key' };

  const reg = await registerServiceWorker();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await api.pushSubscribe(sub.toJSON());
  return { ok: true };
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    try { await api.pushUnsubscribe(sub.endpoint); } catch {}
    try { await sub.unsubscribe(); } catch {}
  }
}

// При успешном логине вызываем — если permission уже granted, пере-подписываем
// (на случай если subscription пропала после reinstall браузера и т.п.)
export async function ensurePushIfGranted() {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  try { await subscribeToPush(); } catch (e) { console.warn('[push] auto-resubscribe failed', e); }
}
