// AWO (АвтоВебОфис) integration helpers
// HMAC signing for /join links, phone normalization, payload validation.
const crypto = require('crypto');

// JOIN_SECRET остаётся только как fallback для signGroupInvite (HEY-внутренние
// invite-ссылки в группы — не tenant-scoped). Для школьных /join-ссылок
// используется tenant.awo_join_secret (multi-tenant), который пробрасывается
// через параметр secret.
const JOIN_SECRET    = process.env.AWO_JOIN_SECRET    || 'dev-awo-join-secret-change-me';

// HMAC(email|course) для защиты /join-ссылок от подделки.
// secret — tenant.awo_join_secret. Если не передан, fallback на env (для
// обратной совместимости со старыми ссылками, выпущенными до multi-tenant).
function signJoin(email, course, secret = JOIN_SECRET) {
  const payload = `${(email || '').trim().toLowerCase()}|${(course || '').trim()}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
}

function verifyJoin(email, course, sig, secret = JOIN_SECRET) {
  if (!sig) return false;
  const expected = signJoin(email, course, secret);
  // timing-safe сравнение
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

// Нормализация телефона из АВО: "79035900000" → "+79035900000"
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('7')) return '+' + digits;
  if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1);
  if (digits.length === 10) return '+7' + digits;
  // Прочий формат — возвращаем с плюсом
  return '+' + digits;
}

function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
}

// Достаёт webhook token из request (?token=… или X-AWO-Token header).
// Сам token-→tenant lookup — в маршруте.
function extractWebhookToken(req) {
  return req.query?.token
    || req.get('X-AWO-Token')
    || req.get('x-awo-token')
    || null;
}

// id_account_status === 5 значит «оплачен» (по документации АВО)
const AWO_STATUS_PAID = 5;

// ── Group invite tokens ───────────────────────────────────────────────
// Подписанный токен для приглашения в группу. Никакой записи в БД не нужно —
// токен self-contained: { groupId, inviterId, ts } + HMAC.
// Срок жизни — 30 дней (защита от устаревших ссылок).
const GROUP_INVITE_TTL_MS = 30 * 24 * 3600 * 1000;

function signGroupInvite(groupId, inviterId) {
  const ts = Date.now();
  const payload = `${groupId}.${inviterId}.${ts}`;
  const sig = crypto.createHmac('sha256', JOIN_SECRET).update(payload).digest('hex').slice(0, 24);
  // base64url(payload) + '.' + sig
  const b64 = Buffer.from(payload).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64}.${sig}`;
}

function verifyGroupInvite(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  let payload;
  try {
    payload = Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch { return null; }
  const expected = crypto.createHmac('sha256', JOIN_SECRET).update(payload).digest('hex').slice(0, 24);
  if (expected.length !== sig.length) return null;
  let ok;
  try { ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig)); } catch { return null; }
  if (!ok) return null;
  const [groupId, inviterId, tsStr] = payload.split('.');
  if (!groupId || !inviterId || !tsStr) return null;
  const ts = Number(tsStr);
  if (!Number.isFinite(ts)) return null;
  if (Date.now() - ts > GROUP_INVITE_TTL_MS) return null;
  return { groupId, inviterId, ts };
}

module.exports = {
  signJoin,
  verifyJoin,
  normalizePhone,
  isValidEmail,
  extractWebhookToken,
  AWO_STATUS_PAID,
  signGroupInvite,
  verifyGroupInvite,
  GROUP_INVITE_TTL_MS,
};
