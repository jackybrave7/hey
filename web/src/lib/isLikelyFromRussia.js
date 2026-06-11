// Heuristic: Russian IANA timezones cover all RF federal subjects.
const RU_TIMEZONES = new Set([
  'Europe/Moscow',
  'Europe/Kaliningrad',
  'Europe/Samara',
  'Europe/Volgograd',
  'Asia/Anadyr',
  'Asia/Barnaul',
  'Asia/Chita',
  'Asia/Irkutsk',
  'Asia/Kamchatka',
  'Asia/Khandyga',
  'Asia/Krasnoyarsk',
  'Asia/Magadan',
  'Asia/Novokuznetsk',
  'Asia/Novosibirsk',
  'Asia/Omsk',
  'Asia/Sakhalin',
  'Asia/Srednekolymsk',
  'Asia/Tomsk',
  'Asia/Ust-Nera',
  'Asia/Vladivostok',
  'Asia/Yakutsk',
  'Asia/Yekaterinburg',
]);

// getTimezoneOffset(): минуты UTC − local. Для РФ: UTC+2…+12.
const RU_OFFSETS_MIN = new Set([-120, -180, -240, -300, -360, -420, -480, -540, -600, -660, -720]);

function hasRussianLocale() {
  if (typeof navigator === 'undefined') return false;
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.some((l) => l && String(l).toLowerCase().startsWith('ru'));
}

function hasRussianOffset() {
  try {
    return RU_OFFSETS_MIN.has(new Date().getTimezoneOffset());
  } catch {
    return false;
  }
}

function hasRussianTimezone() {
  if (typeof Intl === 'undefined') return false;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return RU_TIMEZONES.has(tz);
  } catch {
    return false;
  }
}

function isHeyRuSite() {
  if (typeof window === 'undefined') return false;
  const host = (window.location?.hostname || '').toLowerCase();
  return host === 'hey-messenger.ru' || host.endsWith('.hey-messenger.ru') || host.endsWith('.ru');
}

/** Синхронная эвристика в браузере (без сети). */
export function isLikelyFromRussiaClient() {
  if (hasRussianTimezone()) return true;
  if (hasRussianLocale() && hasRussianOffset()) return true;
  // Firefox/Brave с анти-фингерпринтингом часто отдают UTC — на .ru + ru UI всё равно показываем.
  if (isHeyRuSite() && hasRussianLocale()) return true;
  return false;
}

/** Клиент + серверный /api/geo/hint (IP/CDN, Accept-Language). */
export async function detectLikelyFromRussia() {
  if (isLikelyFromRussiaClient()) return true;
  try {
    const res = await fetch('/api/geo/hint', { credentials: 'same-origin' });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.showVpnNote;
  } catch {
    return false;
  }
}

// Обратная совместимость
export function isLikelyFromRussia() {
  return isLikelyFromRussiaClient();
}
