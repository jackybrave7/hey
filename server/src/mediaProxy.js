// Стрим медиа с S3 / локального uploads для GET /media/*
const path = require('path');
const storage = require('./storage');
const { PUBLIC_BASE } = require('./mediaUrl');

const UPLOADS_DIR = path.join(__dirname, '../data/uploads');

async function streamMedia(key, res) {
  if (!key || key.includes('..')) return res.status(400).end();

  if (storage.MODE === 'local') {
    const localPath = path.join(UPLOADS_DIR, key.replace(/\//g, path.sep));
    return res.sendFile(localPath, err => { if (err) res.status(404).end(); });
  }

  // public-read бакет — прямой URL надёжнее presigned fetch с Node (давал 502)
  const upstream = await fetch(`${PUBLIC_BASE()}/${key}`);
  if (!upstream.ok) return res.status(upstream.status).end();
  res.set('Cache-Control', 'public, max-age=86400, immutable');
  const ct = upstream.headers.get('content-type');
  if (ct) res.set('Content-Type', ct);
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
}

function mediaProxyHandler(req, res) {
  const key = req.path.replace(/^\/media\//, '');
  streamMedia(key, res).catch(e => {
    console.error('[/media]', key, e.message);
    if (!res.headersSent) res.status(502).end();
  });
}

module.exports = { mediaProxyHandler, streamMedia };
