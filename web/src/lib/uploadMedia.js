// web/src/lib/uploadMedia.js
// Direct-to-S3 upload via presigned PUT URL.
import { mediaUrl } from './mediaUrl';
// Falls back to legacy base64 endpoint when STORAGE_MODE=local (no uploadUrl returned).

// ── Client-side image resize ──────────────────────────────────────────────────
// Returns { blob, contentType }. GIFs pass through unchanged to preserve animation.
// Если после первого прохода блоб > targetBytes — пробуем снизить размеры/качество
// (важно для фото с современных смартфонов 12+ МП, которые после resize@1920 всё
// ещё могут быть 6-10 МБ из-за высокой детализации).
function resizeToBlob(file, maxPx = 1920, targetBytes = 6 * 1024 * 1024) {
  if (file.type === 'image/gif') return Promise.resolve({ blob: file, contentType: file.type });

  return new Promise(resolve => {
    const img    = new Image();
    const objUrl = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(objUrl);

      // Прогрессивная компрессия: 3 попытки с уменьшающимися параметрами
      const passes = [
        { px: maxPx, q: 0.85 },
        { px: Math.min(maxPx, 1600), q: 0.8 },
        { px: Math.min(maxPx, 1280), q: 0.75 },
      ];

      let result = null;
      for (const pass of passes) {
        const scale = Math.min(1, pass.px / Math.max(img.width, img.height));
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', pass.q));
        if (!blob) continue;
        result = { blob, contentType: 'image/webp' };
        if (blob.size <= targetBytes) break;
      }

      resolve(result || { blob: file, contentType: file.type });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      resolve({ blob: file, contentType: file.type });
    };
    img.src = objUrl;
  });
}

// ── PUT directly to S3 ────────────────────────────────────────────────────────
async function putToS3(uploadUrl, blob, contentType, extraHeaders = {}) {
  const resp = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': contentType, ...extraHeaders },
  });
  if (!resp.ok) throw new Error(`Ошибка загрузки на S3 (${resp.status})`);
}

// ── Blob → data URL (local dev fallback) ─────────────────────────────────────
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * Upload a media file — direct to S3 if available, base64 fallback for local dev.
 *
 * @param {File}   file     - original File object
 * @param {'chat-image'|'moment-image'|'moment-video'|'moment-audio'} category
 * @param {{ getPresignUrl, uploadImage?, uploadMomentMedia? }} apiFns
 * @returns {Promise<{ url: string, key?: string, mediaType: string }>}
 */
export async function uploadMedia(file, category, apiFns) {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  // 1. Client-side resize for images (replaces server-side sharp)
  let uploadBlob  = file;
  let contentType = file.type;
  if (isImage) {
    const r = await resizeToBlob(file, 1920);
    uploadBlob  = r.blob;
    contentType = r.contentType;
  }

  // 2. Get presigned URL (or null for local mode) — pass size for server-side limit check
  const presign = await apiFns.getPresignUrl(category, contentType, uploadBlob.size);

  // 3a. Direct S3 upload ✓
  if (presign.uploadUrl) {
    await putToS3(presign.uploadUrl, uploadBlob, contentType, presign.headers || {});
    return {
      url:       mediaUrl(presign.publicUrl),
      key:       presign.key,
      mediaType: isImage ? 'image' : isVideo ? 'video' : 'audio',
    };
  }

  // 3b. Local dev fallback — legacy base64 endpoint
  const dataUrl = await blobToDataUrl(uploadBlob);
  if (category === 'chat-image') {
    const res = await apiFns.uploadImage(dataUrl);
    return { url: res.url, mediaType: 'image' };
  }
  const res = await apiFns.uploadMomentMedia(dataUrl);
  return { url: res.url, key: res.key, mediaType: res.mediaType };
}

/**
 * Upload a raw audio Blob (from MediaRecorder) to S3 via presign.
 * Falls back to a data URL for local dev (no S3 configured).
 *
 * @param {Blob}   blob        - audio blob from MediaRecorder
 * @param {{ getPresignUrl }} apiFns
 * @returns {Promise<string>}  - public URL of uploaded audio
 */
export async function uploadAudioBlob(blob, apiFns) {
  // Normalize MIME type — strip codec suffix ("audio/webm;codecs=opus" → "audio/webm")
  const contentType = (blob.type || 'audio/webm').split(';')[0].trim();
  const presign = await apiFns.getPresignUrl('chat-audio', contentType, blob.size);
  if (presign.uploadUrl) {
    await putToS3(presign.uploadUrl, blob, contentType, presign.headers || {});
    return mediaUrl(presign.publicUrl);
  }
  // Local fallback: base64 data URL stored as-is
  return blobToDataUrl(blob);
}

/**
 * Upload an arbitrary file (PDF, DOC, ZIP и т.п.) — без ресайза, как есть.
 *
 * @param {File} file
 * @param {{ getPresignUrl }} apiFns
 * @returns {Promise<{ url: string, name: string, size: number, mime: string }>}
 */
export async function uploadFile(file, apiFns) {
  const contentType = file.type || 'application/octet-stream';
  const presign = await apiFns.getPresignUrl('chat-file', contentType, file.size);
  if (presign.uploadUrl) {
    await putToS3(presign.uploadUrl, file, contentType, presign.headers || {});
    return {
      url:  mediaUrl(presign.publicUrl),
      name: file.name,
      size: file.size,
      mime: contentType,
    };
  }
  // Local dev fallback не поддерживается для произвольных файлов
  throw new Error('Загрузка файлов недоступна в локальной разработке без S3');
}

/**
 * Create an object URL for local preview without reading the whole file.
 * Remember to call URL.revokeObjectURL(url) when the preview is no longer needed.
 */
export function previewUrl(file) {
  return URL.createObjectURL(file);
}

/**
 * Upload avatar directly to S3.
 * Falls back to base64 data URL (for local dev) — caller passes it to PATCH /me as-is.
 *
 * @param {File} file
 * @param {{ getPresignUrl }} apiFns
 * @returns {Promise<string>} — S3 URL or base64 data URL
 */
export async function uploadAvatar(file, apiFns) {
  const { blob, contentType } = await resizeToBlob(file, 512); // avatars don't need to be huge
  const presign = await apiFns.getPresignUrl('avatar', contentType, blob.size);
  if (presign.uploadUrl) {
    await putToS3(presign.uploadUrl, blob, contentType, presign.headers || {});
    return mediaUrl(presign.publicUrl);
  }
  // Local fallback: return data URL (stored in SQLite as before)
  return blobToDataUrl(blob);
}

/** Вложение к обращению разработчику — картинка (скриншот) или файл до 10 МБ. */
export async function uploadFeedbackAttachment(file, apiFns) {
  const isImage = file.type.startsWith('image/');
  let uploadBlob = file;
  let contentType = file.type || 'application/octet-stream';
  if (isImage) {
    const r = await resizeToBlob(file, 1920, 8 * 1024 * 1024);
    uploadBlob = r.blob;
    contentType = r.contentType;
  }
  const presign = await apiFns.getPresignUrl('feedback-attachment', contentType, uploadBlob.size);
  if (presign.uploadUrl) {
    await putToS3(presign.uploadUrl, uploadBlob, contentType, presign.headers || {});
    return {
      url: mediaUrl(presign.publicUrl),
      name: file.name,
      mime: contentType,
    };
  }
  if (isImage && apiFns.uploadImage) {
    const dataUrl = await blobToDataUrl(uploadBlob);
    const res = await apiFns.uploadImage(dataUrl);
    return { url: res.url, name: file.name, mime: contentType };
  }
  throw new Error('Загрузка вложений недоступна без S3');
}

/** Как uploadAvatar, но category group-icon — уникальный S3-ключ на каждую загрузку. */
export async function uploadGroupIcon(file, apiFns) {
  const { blob, contentType } = await resizeToBlob(file, 512);
  const presign = await apiFns.getPresignUrl('group-icon', contentType, blob.size);
  if (presign.uploadUrl) {
    await putToS3(presign.uploadUrl, blob, contentType, presign.headers || {});
    return mediaUrl(presign.publicUrl);
  }
  return blobToDataUrl(blob);
}
