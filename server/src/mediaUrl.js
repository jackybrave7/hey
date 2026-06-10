// mediaUrl.js — переписывает прямые S3-URL в same-origin /media/…
// Android PWA/TWA часто не грузит s3.twcstorage.ru (Data Saver, лишний TLS).

const PUBLIC_BASE = () =>
  (process.env.S3_PUBLIC_URL_BASE || 'https://s3.twcstorage.ru/heymessenger').replace(/\/$/, '');

const API_MEDIA = '/media/';
const LEGACY_MEDIA = '/api/media/';

function s3KeyFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('data:') || url.startsWith('/uploads/')) return null;
  if (url.startsWith(API_MEDIA)) return url.slice(API_MEDIA.length).split('?')[0];
  if (url.startsWith(LEGACY_MEDIA)) return url.slice(LEGACY_MEDIA.length).split('?')[0];
  const legacyAbs = url.match(/\/api\/media\/([^?#]+)/);
  if (legacyAbs) return legacyAbs[1];
  const base = PUBLIC_BASE();
  if (url.startsWith(base + '/')) return url.slice(base.length + 1).split('?')[0];
  const m = url.match(/\/(chat\/(?:audio\/|files\/)?[^?#]+|moments\/[^?#]+|avatars\/[^?#]+|group-icons\/[^?#]+)/);
  return m ? m[1] : null;
}

function toPublicMediaUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('data:') || url.startsWith('/uploads/')) return url;
  if (url.startsWith('/api/avatars/')) return url;
  if (url.startsWith(API_MEDIA)) return url;
  if (url.startsWith(LEGACY_MEDIA)) return API_MEDIA + url.slice(LEGACY_MEDIA.length).split('?')[0];
  const key = s3KeyFromUrl(url);
  if (key) return API_MEDIA + key;
  return url;
}

function rewriteAttachment(att) {
  if (!att || typeof att !== 'object') return att;
  const out = { ...att };
  if (out.url) out.url = toPublicMediaUrl(out.url);
  if (Array.isArray(out.urls)) out.urls = out.urls.map(toPublicMediaUrl);
  if (out.moment && typeof out.moment === 'object') {
    out.moment = { ...out.moment };
    if (out.moment.media_url) out.moment.media_url = toPublicMediaUrl(out.moment.media_url);
  }
  return out;
}

module.exports = { toPublicMediaUrl, rewriteAttachment, s3KeyFromUrl, PUBLIC_BASE, API_MEDIA };
