// Переписывает S3/legacy URL в same-origin /media/… (nginx → S3, Android PWA/TWA).
const API_MEDIA = '/media/';

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
  if (url.startsWith('/api/media/')) return url.slice('/api/media/'.length).split('?')[0];
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
  if (url.startsWith(API_MEDIA)) {
    return absolutize(url);
  }
  if (url.startsWith('/api/media/')) {
    return absolutize(API_MEDIA + url.slice('/api/media/'.length).split('?')[0]);
  }
  const key = s3KeyFromUrl(url);
  if (key) return absolutize(API_MEDIA + key);
  return url;
}

function absolutize(path) {
  if (!path.startsWith('/')) return path;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin + path;
  }
  return path;
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
