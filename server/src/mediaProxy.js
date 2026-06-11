// Стрим медиа с S3 / локального uploads для GET /media/* и /api/media/*
const path = require('path');
const storage = require('./storage');
const { PUBLIC_BASE } = require('./mediaUrl');

const UPLOADS_DIR = path.join(__dirname, '../data/uploads');

async function streamMedia(key, res, opts = {}) {
  if (!key || key.includes('..')) return res.status(400).end();

  if (storage.MODE === 'local') {
    const localPath = path.join(UPLOADS_DIR, key.replace(/\//g, path.sep));
    return res.sendFile(localPath, err => { if (err) res.status(404).end(); });
  }

  // Сначала пробуем public URL. Если ACL провайдером игнорируется или бакет
  // приватный, используем presigned read URL через S3 API.
  let upstream = await fetch(`${PUBLIC_BASE()}/${key}`);
  if (!upstream.ok && typeof storage.getReadUrl === 'function') {
    const signedUrl = await storage.getReadUrl(key, 300);
    upstream = await fetch(signedUrl);
  }
  if (!upstream.ok) return res.status(upstream.status).end();
  res.set('Cache-Control', 'public, max-age=86400, immutable');
  const ct = upstream.headers.get('content-type');
  const buf = Buffer.from(await upstream.arrayBuffer());

  if (opts.format === 'jpeg' && shouldTranscodeToJpeg(key, ct)) {
    try {
      const sharp = require('sharp');
      const jpg = await sharp(buf, { animated: false })
        .rotate()
        .jpeg({ quality: 84, mozjpeg: true })
        .toBuffer();
      res.set('Content-Type', 'image/jpeg');
      return res.send(jpg);
    } catch (e) {
      console.warn('[/media] jpeg transcode failed:', key, e.message);
    }
  }

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

module.exports = { mediaProxyHandler, streamMedia };
