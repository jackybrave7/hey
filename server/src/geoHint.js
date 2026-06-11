// Определение «вероятно из РФ» для публичных подсказок (без VPN и т.п.).
// Без внешних geo-БД: заголовки CDN/прокси + Accept-Language.

function pickCountryHeader(headers) {
  const h = headers || {};
  const raw =
    h['cf-ipcountry'] ||
    h['x-country-code'] ||
    h['x-vercel-ip-country'] ||
    h['cloudfront-viewer-country'] ||
    h['x-appengine-country'];
  if (!raw || String(raw).toUpperCase() === 'XX') return null;
  return String(raw).toUpperCase();
}

function primaryAcceptLanguage(headers) {
  const raw = String(headers?.['accept-language'] || '').split(',')[0] || '';
  return raw.trim().toLowerCase();
}

function showVpnNoteFromRequest(req) {
  const country = pickCountryHeader(req.headers);
  if (country === 'RU') return { show: true, source: 'country-header' };

  const lang = primaryAcceptLanguage(req.headers);
  if (lang === 'ru' || lang.startsWith('ru-')) {
    return { show: true, source: 'accept-language' };
  }

  return { show: false, source: null };
}

module.exports = { showVpnNoteFromRequest };
