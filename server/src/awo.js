// AWO (АвтоВебОфис) integration helpers
// HMAC signing for /join links, phone normalization, payload validation.
const crypto = require('crypto');

const JOIN_SECRET    = process.env.AWO_JOIN_SECRET    || 'dev-awo-join-secret-change-me';
const WEBHOOK_TOKEN  = process.env.AWO_WEBHOOK_TOKEN  || '';

// HMAC(email|course) для защиты /join-ссылок от подделки
function signJoin(email, course) {
  const payload = `${(email || '').trim().toLowerCase()}|${(course || '').trim()}`;
  return crypto.createHmac('sha256', JOIN_SECRET).update(payload).digest('hex').slice(0, 32);
}

function verifyJoin(email, course, sig) {
  if (!sig) return false;
  const expected = signJoin(email, course);
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

// Проверка токена webhook — поддерживает заголовок X-AWO-Token и query ?token=
function checkWebhookToken(req) {
  if (!WEBHOOK_TOKEN) return true; // если токен не задан — пропускаем (dev/тест)
  const provided = req.query?.token
    || req.get('X-AWO-Token')
    || req.get('x-awo-token')
    || null;
  return provided === WEBHOOK_TOKEN;
}

// id_account_status === 5 значит «оплачен» (по документации АВО)
const AWO_STATUS_PAID = 5;

module.exports = {
  signJoin,
  verifyJoin,
  normalizePhone,
  isValidEmail,
  checkWebhookToken,
  AWO_STATUS_PAID,
};
