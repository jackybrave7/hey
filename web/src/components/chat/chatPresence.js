function pluralRu(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/** Формат «был(а) / заходил(а)» для шапки чата — по макету. */
export function fmtChatPresence(lastSeen, online) {
  if (online) return 'онлайн';
  if (!lastSeen) return '';

  const now = new Date();
  const then = new Date(lastSeen * 1000);
  const diffMin = Math.floor((now - then) / 60000);
  const diffH = Math.floor(diffMin / 60);
  const time = then.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });

  if (diffH < 3) {
    if (diffMin < 1) return 'был(а) только что';
    if (diffMin < 60) {
      return `был(а) ${diffMin} ${pluralRu(diffMin, 'минуту', 'минуты', 'минут')} назад`;
    }
    return `был(а) ${diffH} ${pluralRu(diffH, 'час', 'часа', 'часов')} назад`;
  }

  if (now.toDateString() === then.toDateString()) return `был(а) в ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (yesterday.toDateString() === then.toDateString()) return `заходил(а) вчера в ${time}`;

  if (now.getFullYear() === then.getFullYear()) {
    const date = then.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
    return `заходил(а) ${date} в ${time}`;
  }

  const date = then.toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
  return `заходил(а) ${date} в ${time}`;
}
