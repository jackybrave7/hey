// Переписывает S3/legacy URL в same-origin /media/…
const API_MEDIA = '/media/';
const LEGACY_MEDIA = '/api/media/';

const MEDIA_KEYS = new Set([
  'url', 'media_url', 'avatar', 'icon', 'attachment_url', 'publicUrl',
  'thumbnail_url', 'thumb_url', 'thumbUrl',
  'author_avatar', 'sender_avatar', 'partner_avatar', 'group_invited_by_avatar',
  'avatar_url',
]);

function s3KeyFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('data:') || url.startsWith('/uploads/')) return null;
  if (url.startsWith(API_MEDIA)) return url.slice(API_MEDIA.length).split('?')[0];
  if (url.startsWith(LEGACY_MEDIA)) return url.slice(LEGACY_MEDIA.length).split('?')[0];
  const direct = url.match(/s3\.twcstorage\.ru\/heymessenger\/([^?#]+)/i);
  if (direct) return direct[1];
  const legacyAbs = url.match(/\/api\/media\/([^?#]+)/);
  if (legacyAbs) return legacyAbs[1];
  const m = url.match(/\/(chat\/(?:audio\/|files\/)?[^?#]+|moments\/[^?#]+|avatars\/[^?#]+|group-icons\/[^?#]+)/);
  if (m) return m[1];
  return null;
}

export function mediaUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('data:') || url.startsWith('/uploads/') || url.startsWith('/api/avatars/')) return url;
  const key = s3KeyFromUrl(url);
  if (url.startsWith(API_MEDIA)) {
    return absolutize(url);
  }
  if (url.startsWith(LEGACY_MEDIA)) {
    return absolutize(API_MEDIA + url.slice(LEGACY_MEDIA.length).split('?')[0]);
  }
  if (key) return absolutize(API_MEDIA + key);
  return url;
}

export function mediaFallbackUrl(url) {
  const key = s3KeyFromUrl(url);
  if (!key) return null;
  return `https://s3.twcstorage.ru/heymessenger/${key}`;
}

export function mediaFallbackUrls(url) {
  const key = s3KeyFromUrl(url);
  if (!key) return [];
  const mediaProxy = absolutize(API_MEDIA + key);
  const apiProxy = absolutize(LEGACY_MEDIA + key);
  const directS3 = `https://s3.twcstorage.ru/heymessenger/${key}`;
  return [mediaProxy, apiProxy, directS3].filter((candidate, index, arr) => (
    candidate && arr.indexOf(candidate) === index && candidate !== mediaUrl(url)
  ));
}

export function androidImageFetchUrls(url) {
  if (!isAndroidBrowser()) return [];
  const key = s3KeyFromUrl(url);
  if (!key || !isImageKey(key)) return [];
  const jpegProxy = absolutize(`${LEGACY_MEDIA}${key}?mobile=1&format=jpeg`);
  const mediaProxy = absolutize(API_MEDIA + key);
  return [jpegProxy, mediaProxy].filter((candidate, index, arr) => (
    candidate && arr.indexOf(candidate) === index
  ));
}

function absolutize(path) {
  // Для TWA/Android всегда отдаём полный same-origin URL: так WebView не
  // интерпретирует /media относительно нестандартного app/base контекста.
  if (typeof window !== 'undefined' && /^https?:$/i.test(window.location.protocol)) {
    return window.location.origin + path;
  }
  return path;
}

function isAndroidBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

function isImageKey(key) {
  return /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(key);
}

function rewriteAttachment(att) {
  if (!att || typeof att !== 'object') return att;
  const out = { ...att };
  if (out.url) out.url = mediaUrl(out.url);
  if (Array.isArray(out.urls)) out.urls = out.urls.map(mediaUrl);
  if (out.moment && typeof out.moment === 'object') {
    out.moment = { ...out.moment };
    if (out.moment.media_url) out.moment.media_url = mediaUrl(out.moment.media_url);
  }
  return out;
}

export function rewriteMediaDeep(data) {
  if (data == null) return data;
  if (Array.isArray(data)) return data.map(rewriteMediaDeep);
  if (typeof data !== 'object') return data;
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'attachment' && v && typeof v === 'object') {
      out[k] = rewriteAttachment(v);
    } else if (k === 'urls' && Array.isArray(v)) {
      out[k] = v.map(mediaUrl);
    } else if (MEDIA_KEYS.has(k) && typeof v === 'string') {
      out[k] = mediaUrl(v);
    } else if (v && typeof v === 'object') {
      out[k] = rewriteMediaDeep(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
