// web/src/lib/formatTime.js
export function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' });
}

export function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('ru', { day:'numeric', month:'long', year:'numeric' });
}

// Короткая дата + время для каталога медиа: «5 июн, 18:42»
// или «5 июн 2025, 18:42» если год не текущий.
export function fmtDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const opts = sameYear
    ? { day:'numeric', month:'short' }
    : { day:'numeric', month:'short', year:'numeric' };
  return d.toLocaleDateString('ru', opts) +
    ', ' + d.toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' });
}

// Короткая форма «был X назад» для шапки чата
export function fmtLastSeenShort(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts * 1000) / 60000);
  if (diff < 1)   return 'только что';
  if (diff < 60)  return `${diff} мин. назад`;
  const h = Math.floor(diff / 60);
  if (h < 24)     return `${h} ч. назад`;
  const days = Math.floor(h / 24);
  if (days < 7)   return `${days} дн. назад`;
  return new Date(ts * 1000).toLocaleDateString('ru', { day:'numeric', month:'short' });
}
