// server/src/video-embed.js
// Parses YouTube / Vimeo / RuTube / Kinescope URLs from text and fetches embed data

const YT_REGEX        = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
const VIMEO_REGEX     = /vimeo\.com\/(?:video\/)?(\d+)/;
const RUTUBE_REGEX    = /rutube\.ru\/video\/([a-f0-9]{32})/i;
const KINESCOPE_REGEX = /kinescope\.io\/(?:embed\/)?([a-zA-Z0-9]+)/;

// Extract first supported video URL from arbitrary text
function extractVideoUrl(text) {
  if (!text) return null;
  const urlMatch = text.match(/https?:\/\/[^\s]+/g);
  if (!urlMatch) return null;
  for (const url of urlMatch) {
    if (YT_REGEX.test(url) || VIMEO_REGEX.test(url) ||
        RUTUBE_REGEX.test(url) || KINESCOPE_REGEX.test(url)) return url;
  }
  return null;
}

// Fetch oEmbed / API data for a supported video URL
// Returns null on any error (graceful degradation)
async function fetchEmbedData(url) {
  try {
    const ytMatch        = url.match(YT_REGEX);
    const vimeoMatch     = url.match(VIMEO_REGEX);
    const rutubeMatch    = url.match(RUTUBE_REGEX);
    const kinescopeMatch = url.match(KINESCOPE_REGEX);

    // ── YouTube ──────────────────────────────────────────────────────────────
    if (ytMatch) {
      const videoId = ytMatch[1];
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      let title = null, author = null;
      try {
        const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) { const d = await res.json(); title = d.title || null; author = d.author_name || null; }
      } catch {}
      return {
        provider: 'youtube', video_id: videoId, url,
        thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        title, author, duration_seconds: null,
      };
    }

    // ── Vimeo ────────────────────────────────────────────────────────────────
    if (vimeoMatch) {
      const videoId = vimeoMatch[1];
      const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
      const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { provider: 'vimeo', video_id: videoId, url, thumbnail_url: null, title: null, author: null, duration_seconds: null };
      const data = await res.json();
      return {
        provider: 'vimeo', video_id: videoId, url,
        thumbnail_url: data.thumbnail_url || null,
        title: data.title || null,
        author: data.author_name || null,
        duration_seconds: data.duration || null,
      };
    }

    // ── RuTube ───────────────────────────────────────────────────────────────
    if (rutubeMatch) {
      const videoId = rutubeMatch[1];
      const oembedUrl = `https://rutube.ru/api/oembed/?url=${encodeURIComponent(url)}&format=json`;
      let thumbnail_url = null, title = null, author = null, duration_seconds = null;
      try {
        const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const d = await res.json();
          thumbnail_url   = d.thumbnail_url || null;
          title           = d.title         || null;
          author          = d.author_name   || null;
          duration_seconds = d.duration     || null;
        }
      } catch {}
      return { provider: 'rutube', video_id: videoId, url, thumbnail_url, title, author, duration_seconds };
    }

    // ── Kinescope ────────────────────────────────────────────────────────────
    if (kinescopeMatch) {
      const videoId = kinescopeMatch[1];
      let thumbnail_url = null, title = null, author = null, duration_seconds = null;
      // 1. Пробуем oEmbed (если включён у воркспейса) — берём thumbnail_url из ответа
      try {
        const oembedUrl = `https://kinescope.io/oembed?url=${encodeURIComponent(`https://kinescope.io/${videoId}`)}`;
        const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const d = await res.json();
          title           = d.title         || null;
          author          = d.author_name   || null;
          duration_seconds = d.duration     || null;
          thumbnail_url   = d.thumbnail_url || null;
        }
      } catch {}
      // 2. Если oEmbed не дал обложку — пробуем парсить og:image со страницы видео
      if (!thumbnail_url) {
        try {
          const pageRes = await fetch(`https://kinescope.io/${videoId}`, {
            signal: AbortSignal.timeout(5000),
            headers: { 'User-Agent': 'Mozilla/5.0 (HEY Messenger bot)' },
          });
          if (pageRes.ok) {
            const html = await pageRes.text();
            const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                   || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
            if (m && m[1]) thumbnail_url = m[1];
          }
        } catch {}
      }
      // 3. Не нашли — оставляем null. UI красиво покажет градиент-плейсхолдер.
      return { provider: 'kinescope', video_id: videoId, url, thumbnail_url, title, author, duration_seconds };
    }

    return null;
  } catch {
    return null;
  }
}

// Given moment text, return embedded_video data object or null
async function parseEmbeddedVideo(text) {
  const url = extractVideoUrl(text);
  if (!url) return null;
  return await fetchEmbedData(url);
}

module.exports = { parseEmbeddedVideo };
