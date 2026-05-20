// server/src/video-embed.js
// Parses YouTube / Vimeo URLs from text and fetches oEmbed data

const YT_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
const VIMEO_REGEX = /vimeo\.com\/(?:video\/)?(\d+)/;

// Extract first YouTube or Vimeo URL from arbitrary text
function extractVideoUrl(text) {
  if (!text) return null;
  // Find all URLs in text first, then check each
  const urlMatch = text.match(/https?:\/\/[^\s]+/g);
  if (!urlMatch) return null;
  for (const url of urlMatch) {
    if (YT_REGEX.test(url) || VIMEO_REGEX.test(url)) return url;
  }
  return null;
}

// Fetch oEmbed data for a YouTube or Vimeo URL
// Returns null on any error (graceful degradation)
async function fetchEmbedData(url) {
  try {
    const ytMatch = url.match(YT_REGEX);
    const vimeoMatch = url.match(VIMEO_REGEX);

    if (ytMatch) {
      const videoId = ytMatch[1];
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const res = await fetch(oembedUrl);
      if (!res.ok) {
        // oEmbed may fail for private/unlisted videos — build minimal data from videoId
        return {
          provider: 'youtube',
          video_id: videoId,
          url,
          thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          title: null,
          author: null,
          duration_seconds: null,
        };
      }
      const data = await res.json();
      return {
        provider: 'youtube',
        video_id: videoId,
        url,
        thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        title: data.title || null,
        author: data.author_name || null,
        duration_seconds: null, // YouTube oEmbed doesn't return duration
      };
    }

    if (vimeoMatch) {
      const videoId = vimeoMatch[1];
      const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
      const res = await fetch(oembedUrl);
      if (!res.ok) {
        return {
          provider: 'vimeo',
          video_id: videoId,
          url,
          thumbnail_url: null,
          title: null,
          author: null,
          duration_seconds: null,
        };
      }
      const data = await res.json();
      return {
        provider: 'vimeo',
        video_id: videoId,
        url,
        thumbnail_url: data.thumbnail_url || null,
        title: data.title || null,
        author: data.author_name || null,
        duration_seconds: data.duration || null,
      };
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
