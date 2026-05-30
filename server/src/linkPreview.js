// linkPreview.js — поиск видео-ссылок в тексте сообщения и получение
// метаданных (title / author / thumbnail / duration) для рендера красивой
// карточки превью в чате. Поддерживаем 4 платформы:
//   YouTube   — официальный oEmbed (нет duration, но всё остальное есть)
//   Vimeo     — официальный oEmbed (есть duration)
//   Kinescope — og-tags из HTML
//   RuTube    — og-tags из HTML
//
// Намерения:
//   • Никогда не блокировать отправку сообщения: внешний fetch с таймаутом
//     2.5 секунды, при ошибке/таймауте просто возвращаем null.
//   • Все ответы кешируются в БД (`link_previews`) на 7 дней — если урл
//     ранее уже шарили, в следующем сообщении превью появится мгновенно.

const URL_RE = /https?:\/\/[^\s<>"']+/g;

const PATTERNS = [
  { provider: 'youtube',
    re: /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/ },
  { provider: 'vimeo',
    re: /^https?:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?(\d+)/ },
  { provider: 'rutube',
    re: /^https?:\/\/(?:www\.)?rutube\.ru\/video\/([a-f0-9]{32})/i },
  { provider: 'kinescope',
    re: /^https?:\/\/(?:[a-z0-9-]+\.)?kinescope\.io\/(?:embed\/)?([a-zA-Z0-9]+)/ },
];

// Возвращает первый url в тексте, который соответствует одному из видео-
// провайдеров. Не пытаемся проксировать произвольные ссылки — это сильно
// расширило бы атак-поверхность.
function detectVideoUrl(text) {
  if (!text || typeof text !== 'string') return null;
  const urls = text.match(URL_RE);
  if (!urls) return null;
  for (const raw of urls) {
    const url = raw.replace(/[.,;:!?)]$/, ''); // обрезаем хвост-пунктуацию
    for (const { provider, re } of PATTERNS) {
      const m = url.match(re);
      if (m) return { provider, url, video_id: m[1] };
    }
  }
  return null;
}

// Helper: fetch с таймаутом
async function fetchWithTimeout(url, ms = 2500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; HEYMessengerBot/1.0)',
        'accept': 'text/html,application/json,application/xhtml+xml',
        'accept-language': 'ru,en;q=0.8',
      },
    });
    return res;
  } finally { clearTimeout(t); }
}

// Helper: вытаскиваем og:* / twitter:* из HTML
function grabOgTag(html, prop) {
  // Поддерживаем оба порядка атрибутов:
  //   <meta property="og:title" content="…">
  //   <meta content="…" property="og:title">
  const escaped = prop.replace(/:/g, '\\:');
  const re1 = new RegExp(
    `<meta[^>]+(?:property|name)\\s*=\\s*["']${escaped}["'][^>]+content\\s*=\\s*["']([^"']*)["']`,
    'i'
  );
  const re2 = new RegExp(
    `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]+(?:property|name)\\s*=\\s*["']${escaped}["']`,
    'i'
  );
  const m1 = html.match(re1);
  if (m1) return decodeHtml(m1[1]);
  const m2 = html.match(re2);
  return m2 ? decodeHtml(m2[1]) : null;
}

function decodeHtml(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
}

// ── YouTube via oEmbed ───────────────────────────────────────────────────
async function fetchYouTube(url, videoId) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetchWithTimeout(oembedUrl);
    if (!res.ok) return null;
    const j = await res.json();
    return {
      provider: 'youtube',
      url,
      video_id: videoId,
      title: j.title || null,
      author: j.author_name || null,
      thumbnail_url: j.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration_seconds: null,
    };
  } catch { return null; }
}

// ── Vimeo via oEmbed ─────────────────────────────────────────────────────
async function fetchVimeo(url, videoId) {
  try {
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
    const res = await fetchWithTimeout(oembedUrl);
    if (!res.ok) return null;
    const j = await res.json();
    return {
      provider: 'vimeo',
      url,
      video_id: videoId,
      title: j.title || null,
      author: j.author_name || null,
      thumbnail_url: j.thumbnail_url || null,
      duration_seconds: typeof j.duration === 'number' ? j.duration : null,
    };
  } catch { return null; }
}

// ── Generic og-tags fetch (Kinescope / RuTube) ───────────────────────────
async function fetchOgTags(url, provider, videoId) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const html = await res.text();
    const dur = grabOgTag(html, 'og:video:duration') || grabOgTag(html, 'video:duration');
    const thumb = grabOgTag(html, 'og:image:secure_url') || grabOgTag(html, 'og:image') || grabOgTag(html, 'twitter:image');
    return {
      provider,
      url,
      video_id: videoId,
      title:    grabOgTag(html, 'og:title') || grabOgTag(html, 'twitter:title') || null,
      author:   grabOgTag(html, 'og:site_name') || (provider === 'rutube' ? 'RuTube' : provider === 'kinescope' ? 'Kinescope' : null),
      thumbnail_url: thumb || null,
      duration_seconds: dur ? parseInt(dur, 10) || null : null,
    };
  } catch { return null; }
}

async function fetchByProvider({ provider, url, video_id }) {
  if (provider === 'youtube')   return fetchYouTube(url, video_id);
  if (provider === 'vimeo')     return fetchVimeo(url, video_id);
  if (provider === 'rutube')    return fetchOgTags(url, provider, video_id);
  if (provider === 'kinescope') return fetchOgTags(url, provider, video_id);
  return null;
}

// Высокоуровневая точка входа: дай текст, получи { videoData | null }.
// Сначала кеш, потом сетевой fetch с таймаутом.
async function resolvePreviewFromText(text, db) {
  const hit = detectVideoUrl(text);
  if (!hit) return null;
  // Cache
  if (db?.getLinkPreviewCached) {
    const cached = db.getLinkPreviewCached(hit.url);
    if (cached) return cached;
  }
  // Fetch
  const data = await fetchByProvider(hit);
  if (data && db?.setLinkPreviewCached) {
    db.setLinkPreviewCached(hit.url, data);
  }
  return data;
}

module.exports = { detectVideoUrl, resolvePreviewFromText, fetchByProvider };
