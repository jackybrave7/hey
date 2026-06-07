// server/src/storage.js
// Abstraction over local filesystem and S3-compatible storage.
// Set STORAGE_MODE=local (default) for development, =s3 for production.

const fs   = require('fs');
const path = require('path');

const MODE = (process.env.STORAGE_MODE || 'local').toLowerCase();

// ── Local paths ───────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '../data/uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── S3 client (lazy-initialized) ──────────────────────────────────────────────
let _s3 = null;
function getS3() {
  if (_s3) return _s3;
  const { S3Client } = require('@aws-sdk/client-s3');
  _s3 = new S3Client({
    endpoint:        process.env.S3_ENDPOINT || 'https://s3.twcstorage.ru',
    region:          process.env.S3_REGION   || 'ru-1',
    credentials: {
      accessKeyId:     process.env.S3_ACCESS_KEY || '',
      secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
    forcePathStyle: true,
  });
  return _s3;
}

const BUCKET = () => process.env.S3_BUCKET || 'heymessenger';
const PUBLIC_BASE = () => (process.env.S3_PUBLIC_URL_BASE || 'https://s3.twcstorage.ru/heymessenger').replace(/\/$/, '');

// ── Helpers ───────────────────────────────────────────────────────────────────
function mimeToExt(contentType) {
  const map = {
    'image/jpeg': 'jpg', 'image/png': 'png',
    'image/webp': 'webp', 'image/gif': 'gif',
    'video/mp4': 'mp4', 'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg', 'audio/mp4': 'm4a',
  };
  return map[contentType] || contentType.split('/')[1] || 'bin';
}

// ── Core: uploadFile ──────────────────────────────────────────────────────────
// key: e.g. "avatars/usr_123.webp"  |  buffer: Buffer  |  contentType: MIME
// Returns: { key, url }
async function uploadFile(key, buffer, contentType) {
  if (MODE === 's3') {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await getS3().send(new PutObjectCommand({
      Bucket:      BUCKET(),
      Key:         key,
      Body:        buffer,
      ContentType: contentType,
      ACL:         'public-read',
    }));
    // For a private bucket presigned URLs are used at read time.
    // Store the key — URL generated via getReadUrl().
    return { key, url: `${PUBLIC_BASE()}/${key}` };
  }

  // local mode
  const localPath = path.join(UPLOADS_DIR, key.replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, buffer);
  return { key, url: '/uploads/' + key.replace(/\\/g, '/') };
}

// ── Core: deleteFile ──────────────────────────────────────────────────────────
async function deleteFile(key) {
  if (!key) return;
  if (MODE === 's3') {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    try {
      await getS3().send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }));
    } catch (e) { console.error('[storage] deleteFile error:', e.message); }
    return;
  }
  const localPath = path.join(UPLOADS_DIR, key.replace(/\//g, path.sep));
  try { fs.unlinkSync(localPath); } catch {}
}

// ── Core: deleteByPrefix ──────────────────────────────────────────────────────
async function deleteByPrefix(prefix) {
  if (!prefix) return;
  if (MODE === 's3') {
    const { ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
    let token;
    do {
      const list = await getS3().send(new ListObjectsV2Command({
        Bucket: BUCKET(), Prefix: prefix, ContinuationToken: token,
      }));
      const keys = (list.Contents || []).map(o => ({ Key: o.Key }));
      if (keys.length) {
        await getS3().send(new DeleteObjectsCommand({
          Bucket: BUCKET(), Delete: { Objects: keys },
        }));
      }
      token = list.NextContinuationToken;
    } while (token);
    return;
  }
  // local: delete directory
  const localDir = path.join(UPLOADS_DIR, prefix.replace(/\//g, path.sep));
  try { fs.rmSync(localDir, { recursive: true, force: true }); } catch {}
}

// ── Core: getReadUrl ──────────────────────────────────────────────────────────
// Returns a presigned URL (S3) or plain URL (local).
async function getReadUrl(key, expiresIn = 3600) {
  if (!key) return null;
  if (MODE === 's3') {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl }     = require('@aws-sdk/s3-request-presigner');
    return getSignedUrl(getS3(), new GetObjectCommand({ Bucket: BUCKET(), Key: key }), { expiresIn });
  }
  return '/uploads/' + key.replace(/\\/g, '/');
}

// ── uploadImage ───────────────────────────────────────────────────────────────
// Processes an image buffer with sharp (if available), saves full + thumb.
// baseKey: e.g. "avatars/usr_123"  (without extension)
// Returns: { fullKey, fullUrl, thumbKey, thumbUrl }
async function uploadImage(buffer, baseKey) {
  let fullBuf  = buffer;
  let thumbBuf = buffer;

  try {
    const sharp = require('sharp');
    [fullBuf, thumbBuf] = await Promise.all([
      sharp(buffer)
        .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer(),
      sharp(buffer)
        .resize(400, 400, { fit: 'cover', position: 'center' })
        .webp({ quality: 75 })
        .toBuffer(),
    ]);
    const fullKey  = baseKey + '.webp';
    const thumbKey = baseKey + '_thumb.webp';
    const [full, thumb] = await Promise.all([
      uploadFile(fullKey,  fullBuf,  'image/webp'),
      uploadFile(thumbKey, thumbBuf, 'image/webp'),
    ]);
    return { fullKey, fullUrl: full.url, thumbKey, thumbUrl: thumb.url };
  } catch (e) {
    // sharp not available or unsupported format — save as-is
    console.warn('[storage] sharp unavailable, saving raw:', e.message);
    const ext = 'jpg'; // fallback
    const fullKey  = baseKey + '.' + ext;
    const thumbKey = baseKey + '_thumb.' + ext;
    const [full, thumb] = await Promise.all([
      uploadFile(fullKey,  buffer, 'image/jpeg'),
      uploadFile(thumbKey, buffer, 'image/jpeg'),
    ]);
    return { fullKey, fullUrl: full.url, thumbKey, thumbUrl: thumb.url };
  }
}

// ── getPresignedUploadUrl ─────────────────────────────────────────────────────
// Returns a presigned PUT URL so the client uploads directly to S3.
// The client MUST send Content-Type and x-amz-acl headers that match the signature.
// Set S3_NO_ACL=1 if your S3 provider doesn't support per-object ACL.
async function getPresignedUploadUrl(key, contentType, expiresIn = 300) {
  if (MODE !== 's3') {
    // Local dev — no presigned URL; client falls back to base64 endpoint
    return { uploadUrl: null, headers: {}, key, publicUrl: '/uploads/' + key };
  }
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl }     = require('@aws-sdk/s3-request-presigner');
  const noAcl = !!process.env.S3_NO_ACL;
  const cmd = new PutObjectCommand({
    Bucket:      BUCKET(),
    Key:         key,
    ContentType: contentType,
    ...(noAcl ? {} : { ACL: 'public-read' }),
  });
  const uploadUrl = await getSignedUrl(getS3(), cmd, { expiresIn });
  return {
    uploadUrl,
    headers: noAcl ? {} : { 'x-amz-acl': 'public-read' },
    key,
    publicUrl: `${PUBLIC_BASE()}/${key}`,
  };
}

// ── listKeysByPrefix ─────────────────────────────────────────────────────────
// Возвращает [{ key, lastModified, size }] по префиксу. Для local — обходит
// директорию рекурсивно. Используется ночной задачей-«сборщиком сирот».
async function listKeysByPrefix(prefix) {
  if (MODE === 's3') {
    const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const out = [];
    let token;
    do {
      const list = await getS3().send(new ListObjectsV2Command({
        Bucket: BUCKET(), Prefix: prefix, ContinuationToken: token,
      }));
      for (const o of (list.Contents || [])) {
        out.push({ key: o.Key, lastModified: o.LastModified, size: o.Size });
      }
      token = list.NextContinuationToken;
    } while (token);
    return out;
  }
  // local
  const baseDir = path.join(UPLOADS_DIR, prefix.replace(/\//g, path.sep));
  const out = [];
  function walk(dir, rel) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(full, r);
      else {
        try {
          const st = fs.statSync(full);
          out.push({ key: prefix + r, lastModified: st.mtime, size: st.size });
        } catch {}
      }
    }
  }
  walk(baseDir, '');
  return out;
}

module.exports = { uploadFile, uploadImage, deleteFile, deleteByPrefix, listKeysByPrefix, getReadUrl, getPresignedUploadUrl, MODE };
