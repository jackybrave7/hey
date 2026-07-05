// Стрим медиа с S3 / локального uploads для GET /media/* и /api/media/*
//
// Дисковый кеш: каждый S3-объект после первого запроса сохраняется в
// data/media-cache/ и дальше отдаётся локально через res.sendFile
// (это + Range-поддержка для перемотки видео). Ключи иммутабельны
// (UUID в имени), поэтому кеш не протухает — только вытесняется по
// размеру (см. sweepMediaCache). До кеша каждый запрос картинки был
// полным круговым походом в S3 с буферизацией всего файла до первого
// байта ответа (~1 сек на изображение).
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const storage = require('./storage');
const { PUBLIC_BASE } = require('./mediaUrl');

const UPLOADS_DIR = path.join(__dirname, '../data/uploads');
const CACHE_DIR = path.join(__dirname, '../data/media-cache');
// Мягкий потолок кеша. При превышении sweep удаляет самые старые
// (по mtime) файлы до 80% лимита. Диск 50ГБ, медиа-бакет маленький —
// 3ГБ хватит на годы вперёд.
const CACHE_MAX_BYTES = parseInt(process.env.MEDIA_CACHE_MAX_BYTES || '') || 3 * 1024 ** 3;

const CACHE_HEADER = 'public, max-age=31536000, immutable';

function cachePathFor(key, suffix = '') {
  // Ключи уже валидируются на '..' в streamMedia; зеркалим структуру.
  return path.join(CACHE_DIR, key.replace(/\//g, path.sep)) + suffix;
}

// Атомарная запись: tmp-файл + rename, чтобы параллельный запрос не
// прочитал недописанный файл.
async function writeCacheFile(finalPath, buf) {
  await fsp.mkdir(path.dirname(finalPath), { recursive: true });
  const tmp = finalPath + '.tmp-' + crypto.randomBytes(4).toString('hex');
  await fsp.writeFile(tmp, buf);
  await fsp.rename(tmp, finalPath);
}

function sendCached(res, filePath, contentType) {
  return new Promise((resolve) => {
    const headers = { 'Cache-Control': CACHE_HEADER };
    if (contentType) headers['Content-Type'] = contentType;
    res.sendFile(filePath, { headers }, (err) => {
      // ENOENT между stat и sendFile (гонка со sweep'ом) — вернём 404,
      // клиент ретрайнет и получит свежую копию из S3.
      if (err && !res.headersSent) res.status(404).end();
      resolve();
    });
  });
}

async function readCachedContentType(key) {
  try { return (await fsp.readFile(cachePathFor(key, '.ct'), 'utf8')).trim() || null; }
  catch { return null; }
}

async function streamMedia(key, res, opts = {}) {
  if (!key || key.includes('..')) return res.status(400).end();

  if (storage.MODE === 'local') {
    const localPath = path.join(UPLOADS_DIR, key.replace(/\//g, path.sep));
    return res.sendFile(localPath, err => { if (err) res.status(404).end(); });
  }

  const wantJpeg = opts.format === 'jpeg';
  const cached = cachePathFor(key);
  const cachedJpeg = cachePathFor(key, '.jpeg');

  // ── Cache hit ────────────────────────────────────────────────────────────
  if (wantJpeg && fs.existsSync(cachedJpeg)) {
    return sendCached(res, cachedJpeg, 'image/jpeg');
  }
  if (fs.existsSync(cached)) {
    const ct = await readCachedContentType(key);
    if (!wantJpeg || !shouldTranscodeToJpeg(key, ct)) {
      return sendCached(res, cached, ct);
    }
    // jpeg-вариант ещё не собран — транскодим из кеша, сохраняем.
    try {
      const sharp = require('sharp');
      const jpg = await sharp(await fsp.readFile(cached), { animated: false })
        .rotate()
        .jpeg({ quality: 84, mozjpeg: true })
        .toBuffer();
      writeCacheFile(cachedJpeg, jpg).catch(() => {});
      res.set('Cache-Control', CACHE_HEADER);
      res.set('Content-Type', 'image/jpeg');
      return res.send(jpg);
    } catch (e) {
      console.warn('[/media] jpeg transcode failed:', key, e.message);
      return sendCached(res, cached, ct);
    }
  }

  // ── Cache miss → S3 ──────────────────────────────────────────────────────
  // В проде S3_PUBLIC_URL_BASE может указывать на same-origin /media, поэтому
  // для Node-proxy сначала читаем S3 напрямую через presigned URL.
  let upstream = null;
  if (typeof storage.getReadUrl === 'function') {
    const signedUrl = await storage.getReadUrl(key, 300);
    upstream = await fetch(signedUrl);
  }
  if (!upstream || !upstream.ok) {
    upstream = await fetch(`${PUBLIC_BASE()}/${key}`);
  }
  // Ошибки НЕ кешируем и отдаём без Cache-Control: свежезалитый файл может
  // 404-нуться на первые секунды — браузер не должен запомнить ошибку.
  if (!upstream.ok) return res.status(upstream.status).end();

  const ct = upstream.headers.get('content-type');
  const buf = Buffer.from(await upstream.arrayBuffer());

  // Пишем в кеш в фоне — ответ клиенту не ждёт диска.
  (async () => {
    try {
      await writeCacheFile(cached, buf);
      if (ct) await fsp.writeFile(cachePathFor(key, '.ct'), ct);
    } catch (e) { console.warn('[media-cache] write failed:', key, e.message); }
  })();

  if (wantJpeg && shouldTranscodeToJpeg(key, ct)) {
    try {
      const sharp = require('sharp');
      const jpg = await sharp(buf, { animated: false })
        .rotate()
        .jpeg({ quality: 84, mozjpeg: true })
        .toBuffer();
      writeCacheFile(cachedJpeg, jpg).catch(() => {});
      res.set('Cache-Control', CACHE_HEADER);
      res.set('Content-Type', 'image/jpeg');
      return res.send(jpg);
    } catch (e) {
      console.warn('[/media] jpeg transcode failed:', key, e.message);
    }
  }

  res.set('Cache-Control', CACHE_HEADER);
  if (ct) res.set('Content-Type', ct);
  res.send(buf);
}

function mediaProxyHandler(req, res) {
  const key = req.path.replace(/^\/media\//, '');
  streamMedia(key, res, req.query || {}).catch(e => {
    console.error('[/media]', key, e.message);
    if (!res.headersSent) res.status(502).end();
  });
}

function shouldTranscodeToJpeg(key, contentType) {
  if (!/\.(avif|heic|heif|jpe?g|png|webp)$/i.test(key)) return false;
  if (/\.gif$/i.test(key)) return false;
  if (contentType && !/^image\//i.test(contentType)) return false;
  if (contentType && /svg/i.test(contentType)) return false;
  return true;
}

// ── Вытеснение по размеру ────────────────────────────────────────────────
// Обходит кеш, считает суммарный размер; при превышении CACHE_MAX_BYTES
// удаляет самые старые (mtime) файлы до 80% лимита. Дёргается из index.js
// на старте и раз в сутки.
async function sweepMediaCache() {
  const files = [];
  async function walk(dir) {
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else {
        try {
          const st = await fsp.stat(full);
          files.push({ path: full, size: st.size, mtime: st.mtimeMs });
        } catch {}
      }
    }
  }
  await walk(CACHE_DIR);
  let total = files.reduce((s, f) => s + f.size, 0);
  if (total <= CACHE_MAX_BYTES) {
    return { files: files.length, totalMb: Math.round(total / 1048576), deleted: 0 };
  }
  files.sort((a, b) => a.mtime - b.mtime); // старые первыми
  const target = CACHE_MAX_BYTES * 0.8;
  let deleted = 0;
  for (const f of files) {
    if (total <= target) break;
    try { await fsp.unlink(f.path); total -= f.size; deleted++; } catch {}
  }
  return { files: files.length - deleted, totalMb: Math.round(total / 1048576), deleted };
}

module.exports = { mediaProxyHandler, streamMedia, sweepMediaCache };
