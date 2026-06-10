const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const { v4: uuid } = require('uuid');
const path = require('path');
const fs   = require('fs');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'hey.db'));

// WAL mode + performance PRAGMAs
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');   // safe with WAL, much faster than FULL
db.pragma('cache_size = -32000');    // 32 MB page cache
db.pragma('temp_store = MEMORY');    // temp tables in RAM

// Кастомная LOWER, корректно работающая с кириллицей (и любым unicode).
// Перекрывает встроенную LOWER, которая в SQLite поддерживает только ASCII.
db.function('LOWER', { deterministic: true }, (s) =>
  s == null ? null : String(s).toLocaleLowerCase('ru-RU')
);
db.pragma('mmap_size = 268435456'); // 256 MB memory-mapped I/O

// Safe migrations for existing DBs
try { db.exec('ALTER TABLE conversations ADD COLUMN admin_id TEXT'); }  catch {}
try { db.exec('ALTER TABLE conversations ADD COLUMN icon TEXT'); }      catch {}
try { db.exec(`CREATE TABLE IF NOT EXISTS reactions (
  message_id TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
)`); } catch {}
try { db.exec(`CREATE TABLE IF NOT EXISTS blocks (
  user_id    TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, blocked_id)
)`); } catch {}
try { db.exec('ALTER TABLE contacts ADD COLUMN notes TEXT'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN invite_code TEXT'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN referral_by TEXT'); } catch {}
try { db.exec(`CREATE TABLE IF NOT EXISTS referrals (
  inviter_id  TEXT NOT NULL,
  invitee_id  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (invitee_id)
)`); } catch {}
// confirmed_at — момент подтверждения реферала (написал первое сообщение).
// До этого реферал считается «pending» и не идёт в зачёт.
try { db.exec('ALTER TABLE referrals ADD COLUMN confirmed_at INTEGER'); } catch {}
// ── Moments tables ────────────────────────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS moments (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  text           TEXT NOT NULL,
  media_type     TEXT,
  media_url      TEXT,
  media_duration INTEGER,
  auto_tags      TEXT NOT NULL DEFAULT '[]',
  is_search      INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  edited         INTEGER NOT NULL DEFAULT 0,
  archived_at    INTEGER
)`); } catch {}
try { db.exec(`CREATE TABLE IF NOT EXISTS moment_reactions (
  id         TEXT PRIMARY KEY,
  moment_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  reaction   TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(moment_id, user_id)
)`); } catch {}
try { db.exec(`CREATE TABLE IF NOT EXISTS moment_views (
  moment_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  viewed_at  INTEGER NOT NULL,
  PRIMARY KEY (moment_id, user_id)
)`); } catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_moments_user        ON moments(user_id, status)`); }          catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_moments_status_ts   ON moments(status, created_at DESC)`); }   catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_mrx_moment          ON moment_reactions(moment_id)`); }        catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_mrx_user            ON moment_reactions(user_id)`); }          catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_mviews_moment       ON moment_views(moment_id)`); }            catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_blocks_user         ON blocks(user_id)`); }                    catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_blocks_blocked      ON blocks(blocked_id)`); }                 catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_contacts_owner      ON contacts(owner_id)`); }                 catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_contacts_contact    ON contacts(contact_id)`); }               catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_members_user        ON members(user_id)`); }                   catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_sender     ON messages(sender_id)`); }                catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    phone      TEXT UNIQUE NOT NULL,
    name       TEXT NOT NULL,
    password   TEXT NOT NULL,
    avatar     TEXT,
    birthday   TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS presence (
    user_id   TEXT PRIMARY KEY,
    online    INTEGER NOT NULL DEFAULT 0,
    last_seen INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id         TEXT PRIMARY KEY,
    owner_id   TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    nickname   TEXT,
    UNIQUE(owner_id, contact_id)
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL DEFAULT 'direct',
    name       TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS members (
    conversation_id TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    joined_at       INTEGER NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id       TEXT NOT NULL,
    text            TEXT,
    attachment      TEXT,
    status          TEXT NOT NULL DEFAULT 'sent',
    created_at      INTEGER NOT NULL,
    edited_at       INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);

  CREATE TABLE IF NOT EXISTS calls (

    id         TEXT PRIMARY KEY,
    caller_id  TEXT NOT NULL,
    callee_id  TEXT NOT NULL,
    type       TEXT NOT NULL DEFAULT 'voice',
    status     TEXT NOT NULL DEFAULT 'missed',
    duration   INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
`);

try { db.exec('ALTER TABLE moments ADD COLUMN moment_order INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE moments ADD COLUMN embedded_video TEXT'); } catch {}
try { db.exec('ALTER TABLE moments ADD COLUMN mood_emoji TEXT'); } catch {}
try { db.exec('ALTER TABLE moments ADD COLUMN media_position TEXT'); } catch {}  // CSS object-position, например "50% 30%"
try { db.exec('ALTER TABLE messages ADD COLUMN reply_to_id TEXT'); } catch {}     // id сообщения на которое отвечаем
try { db.exec('ALTER TABLE messages ADD COLUMN broadcast_id TEXT'); } catch {}    // группировка системных рассылок
try { db.exec('ALTER TABLE messages ADD COLUMN forwarded_from_user_id TEXT'); } catch {}    // переслано от автора
try { db.exec('ALTER TABLE messages ADD COLUMN forwarded_from_message_id TEXT'); } catch {} // ссылка на оригинал (опционально)
try { db.exec('ALTER TABLE messages ADD COLUMN link_preview TEXT'); } catch {}              // JSON c metadata видео-ссылки (YouTube/Vimeo/RuTube/Kinescope)
try { db.exec('ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE messages ADD COLUMN deleted_at INTEGER'); } catch {}

// Кеш og-tags / oEmbed для линк-превью. Если url-fetch успешен — кладём сюда,
// а в новых сообщениях достаём из кеша. TTL ~7 дней (mark fetched_at и сверяем).
try { db.exec(`CREATE TABLE IF NOT EXISTS link_previews (
  url        TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
)`); } catch {}
try { db.exec('ALTER TABLE conversations ADD COLUMN pinned_message_id TEXT'); } catch {}    // одно закреплённое сообщение на чат

// Статус участника группы: 'active' (обычно) | 'pending' (приглашён, ждёт подтверждения)
// + кто пригласил (чтобы показать ученику «Иван пригласил тебя в …»)
try { db.exec("ALTER TABLE members ADD COLUMN status TEXT DEFAULT 'active'"); } catch {}
try { db.exec('ALTER TABLE members ADD COLUMN invited_by TEXT'); } catch {}
// Multi-admin: любой участник может быть админом. conversations.admin_id
// остаётся как «создатель/владелец» (не может быть отозван). Дополнительных
// админов отмечаем тут.
try { db.exec('ALTER TABLE members ADD COLUMN is_admin INTEGER DEFAULT 0'); } catch {}
// Архив чата — персональный для каждого юзера. NULL = не в архиве.
try { db.exec('ALTER TABLE members ADD COLUMN archived_at INTEGER'); } catch {}
// Видимость истории для добавленных позже: 'all' (по умолчанию) или 'since_joined'
try { db.exec("ALTER TABLE conversations ADD COLUMN history_visibility TEXT DEFAULT 'all'"); } catch {}
// Заполняем status для существующих записей (миграция, ОДИН раз — UPDATE no-op если уже 'active')
try { db.exec("UPDATE members SET status='active' WHERE status IS NULL"); } catch {}

// Флаг что юзер — тестовый (сидинг через админку). Видимы только админу
// при включённом 'test_users_enabled' в system_settings.
try { db.exec('ALTER TABLE users ADD COLUMN is_test INTEGER DEFAULT 0'); } catch {}

// Web Push подписки (один юзер — много устройств/браузеров)
try { db.exec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint    TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  INTEGER NOT NULL
)`); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_messages_broadcast ON messages(broadcast_id)'); } catch {}

// Отложенные сообщения. Лежат до момента send_at, потом фоновый
// диспетчер превращает в обычное сообщение через createMessage и
// удаляет запись. status='pending' пока не отправлено; никакого
// «sent»-состояния не храним — отправленные удаляем сразу.
try { db.exec(`CREATE TABLE IF NOT EXISTS scheduled_messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id       TEXT NOT NULL,
  text            TEXT,
  attachment      TEXT,            -- JSON, как в messages.attachment
  reply_to_id     TEXT,
  send_at         INTEGER NOT NULL,
  created_at      INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
)`); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_scheduled_due ON scheduled_messages(status, send_at)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_scheduled_sender ON scheduled_messages(sender_id, conversation_id)'); } catch {}

// ── Admin columns (safe migrations) ──────────────────────────────────────────
try { db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN blocked_at INTEGER'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN blocked_by TEXT'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN is_super INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN is_deleted INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN deleted_at INTEGER'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN bio TEXT'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN headline TEXT'); } catch {}  // Главное обо мне (короткая фраза)
// ── Message requests ──────────────────────────────────────────────────────────
try { db.exec('ALTER TABLE conversations ADD COLUMN request_from TEXT'); } catch {}
try { db.exec(`CREATE TABLE IF NOT EXISTS pinned_conversations (
  user_id   TEXT NOT NULL,
  conv_id   TEXT NOT NULL,
  pinned_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, conv_id)
)`); } catch {}

// Личные закрепы сообщений в direct/monolog чатах. В группах
// pinned_message_id остаётся на conversations (общий для всех, ставит
// только админ). Здесь — приватный per-user pin для не-групповых чатов,
// который собеседник НЕ видит.
try { db.exec(`CREATE TABLE IF NOT EXISTS personal_message_pins (
  user_id    TEXT NOT NULL,
  conv_id    TEXT NOT NULL,
  message_id TEXT NOT NULL,
  pinned_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, conv_id)
)`); } catch {}
try { db.exec(`CREATE TABLE IF NOT EXISTS admin_logs (
  id               TEXT PRIMARY KEY,
  admin_id         TEXT NOT NULL,
  action           TEXT NOT NULL,
  target_user_id   TEXT,
  target_moment_id TEXT,
  reason           TEXT,
  created_at       INTEGER NOT NULL
)`); } catch {}

// Жалобы от юзеров на моменты / других юзеров
try { db.exec(`CREATE TABLE IF NOT EXISTS reports (
  id               TEXT PRIMARY KEY,
  reporter_id      TEXT NOT NULL,
  target_type      TEXT NOT NULL,    -- 'moment' | 'user' | 'message'
  target_id        TEXT NOT NULL,
  target_user_id   TEXT,
  reason           TEXT NOT NULL,
  status           TEXT DEFAULT 'open',  -- 'open' | 'resolved' | 'dismissed'
  created_at       INTEGER NOT NULL,
  resolved_at      INTEGER,
  resolved_by      TEXT
)`); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC)'); } catch {}

// Feedbacks: «Написать разработчику» — обращения юзеров (анонимные тоже).
// Раньше падали только в feedback.log + email. Теперь дублируются в БД,
// чтобы видеть/обрабатывать из админки и считать незакрытые в бейдже.
try { db.exec(`CREATE TABLE IF NOT EXISTS feedbacks (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,                  -- NULL для анонимных
  name        TEXT,                  -- name на момент отправки (для аноним: NULL)
  phone       TEXT,                  -- phone на момент отправки
  type        TEXT,                  -- 'bug' | 'idea' | 'общее' | etc.
  text        TEXT NOT NULL,
  status      TEXT DEFAULT 'open',   -- 'open' | 'done' | 'dismissed'
  created_at  INTEGER NOT NULL,
  handled_at  INTEGER,
  handled_by  TEXT,                  -- admin user_id
  admin_note  TEXT                   -- внутренний комментарий
)`); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks(status, created_at DESC)'); } catch {}

// Two-step self-delete: после `DELETE /me` юзер становится `is_deleted=1`,
// но 30 дней лежит в deletion_grace со снапшотом оригинальных полей.
// Если за это время кто-то логинится с правильным телефоном+паролем —
// аккаунт восстанавливается. Иначе scheduled task hard-удаляет.
try { db.exec(`CREATE TABLE IF NOT EXISTS deletion_grace (
  user_id        TEXT PRIMARY KEY,
  original_phone TEXT NOT NULL,
  snapshot       TEXT NOT NULL,   -- JSON: {name, phone, email, avatar, bio, headline, password}
  created_at     INTEGER NOT NULL,
  expires_at     INTEGER NOT NULL
)`); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_grace_expires ON deletion_grace(expires_at)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_grace_phone   ON deletion_grace(original_phone)'); } catch {}

// Лист ожидания на открытую регистрацию (без инвайта)
try { db.exec(`CREATE TABLE IF NOT EXISTS waitlist (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  source       TEXT,
  created_at   INTEGER NOT NULL,
  notified_at  INTEGER
)`); } catch {}

// ── Referral / Super bonus migrations ─────────────────────────────────────────
try { db.exec('ALTER TABLE users ADD COLUMN invited_count INTEGER DEFAULT 0'); } catch {}
// email_verified: 0 пока юзер не подтвердил почту. Старые юзеры,
// у кого email уже стоял на момент введения колонки — считаются
// подтверждёнными (бэк-фил ниже). Для новых дополнений через PATCH /me
// флаг сбрасывается, пока юзер не кликнет verify-ссылку.
try { db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0'); } catch {}
try { db.prepare("UPDATE users SET email_verified=1 WHERE email IS NOT NULL AND email_verified=0").run(); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN super_bonus_claimed INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN super_expires_at INTEGER'); } catch {}
// Бизнес-доступ: можно запросить статус «бизнес-пользователь», админ
// одобряет → открывается раздел «Мои школы» (AWO multi-tenant).
//   business_status: 'none' (по умолчанию) | 'pending' | 'approved' | 'rejected'
try { db.exec("ALTER TABLE users ADD COLUMN business_status TEXT DEFAULT 'none'"); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN business_requested_at INTEGER'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN business_request_note TEXT'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN business_approved_at INTEGER'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN business_approved_by TEXT'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN business_reject_reason TEXT'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN achievements TEXT DEFAULT \'[]\''); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN is_system INTEGER DEFAULT 0'); } catch {} // системные аккаунты (нельзя писать им)

// ── AWO integration migrations ────────────────────────────────────────────────
try { db.exec('ALTER TABLE users ADD COLUMN email TEXT'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN is_school_account INTEGER DEFAULT 0'); } catch {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email COLLATE NOCASE) WHERE email IS NOT NULL"); } catch {}

// Школьные инвайты (для интеграции с АВО)
try { db.exec(`CREATE TABLE IF NOT EXISTS school_invites (
  code            TEXT PRIMARY KEY,
  issued_by       TEXT NOT NULL,
  bound_email     TEXT,
  bound_phone     TEXT,
  course          TEXT,
  created_at      INTEGER NOT NULL,
  used_at         INTEGER,
  used_by_user_id TEXT
)`); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_school_invites_email ON school_invites(bound_email COLLATE NOCASE)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_school_invites_phone ON school_invites(bound_phone)'); } catch {}
// bound_name — добавляем для предзаполнения формы регистрации из АВО payload
try { db.exec('ALTER TABLE school_invites ADD COLUMN bound_name TEXT'); } catch {}

// Обработанные счета АВО (идемпотентность). tenant_id добавлен миграцией
// ниже, чтобы id_account был уникален в рамках одного tenant'а.
try { db.exec(`CREATE TABLE IF NOT EXISTS awo_processed (
  id_account    TEXT PRIMARY KEY,
  processed_at  INTEGER NOT NULL,
  email         TEXT,
  phone         TEXT,
  course        TEXT,
  invite_code   TEXT,
  result        TEXT,
  raw_payload   TEXT
)`); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_awo_processed_email ON awo_processed(email COLLATE NOCASE)'); } catch {}

// Соответствия курс АВО ↔ групповой чат HEY
try { db.exec(`CREATE TABLE IF NOT EXISTS awo_course_chats (
  course      TEXT PRIMARY KEY COLLATE NOCASE,
  chat_id     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
)`); } catch {}

// ── Multi-tenant AWO (Шаг 1) ─────────────────────────────────────────────
// Любой бизнес-юзер может создать свой tenant (школу) и привязать к нему
// собственную интеграцию с АвтоВебОфисом. Текущий single-school setup
// мигрируется в дефолтный tenant 'tnt_default' ниже.
try { db.exec(`CREATE TABLE IF NOT EXISTS tenants (
  id              TEXT PRIMARY KEY,           -- 'tnt_default', 'tnt_abc123'
  name            TEXT NOT NULL,
  owner_id        TEXT NOT NULL,              -- user.id управляющего
  awo_webhook_token TEXT UNIQUE NOT NULL,     -- свой токен webhook'а
  awo_join_secret   TEXT NOT NULL,            -- свой HMAC-секрет для /join
  account_id      TEXT,                       -- user.id «бот-аккаунта» школы
  test_mode       INTEGER DEFAULT 0,
  test_course     TEXT,
  chat_excludes   TEXT DEFAULT 'слушатель,запись',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
)`); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_id)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_tenants_token ON tenants(awo_webhook_token)'); } catch {}

// Соадмины школы: дополнительно к одному `owner_id` можно прокинуть
// права администратора школы любому юзеру. У них тот же доступ к
// CRUD интеграции (привязки чатов к курсам, секреты вебхука,
// /join-ссылки) — кроме удаления самой школы и управления списком
// соадминов: это делает только владелец.
try { db.exec(`CREATE TABLE IF NOT EXISTS tenant_admins (
  tenant_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  added_by   TEXT,
  added_at   INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, user_id)
)`); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_tenant_admins_user ON tenant_admins(user_id)'); } catch {}

// tenant_id — на все ключевые таблицы интеграции. NULL = дефолтный tenant
// (для существующих записей). После миграции мы их перекодируем.
try { db.exec('ALTER TABLE awo_course_chats ADD COLUMN tenant_id TEXT'); } catch {}
try { db.exec('ALTER TABLE awo_processed   ADD COLUMN tenant_id TEXT'); } catch {}
try { db.exec('ALTER TABLE school_invites  ADD COLUMN tenant_id TEXT'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_awo_course_chats_tenant ON awo_course_chats(tenant_id)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_awo_processed_tenant   ON awo_processed(tenant_id)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_school_invites_tenant  ON school_invites(tenant_id)'); } catch {}

// Системные настройки key-value (тестовый режим AWO, тестовый курс и т.п.)
try { db.exec(`CREATE TABLE IF NOT EXISTS system_settings (
  key    TEXT PRIMARY KEY,
  value  TEXT
)`); } catch {}

// Back-fill invite codes for existing users without one (safe — users table now exists)
db.prepare("SELECT id FROM users WHERE invite_code IS NULL").all().forEach(u => {
  const code = u.id.replace(/-/g,'').slice(0,10).toUpperCase();
  db.prepare("UPDATE users SET invite_code=? WHERE id=?").run(code, u.id);
});

// Back-fill invited_count from referrals table (one-time, safe)
db.prepare(`
  UPDATE users SET invited_count = (
    SELECT COUNT(*) FROM referrals WHERE inviter_id = users.id
  ) WHERE invited_count = 0
`).run();

// ── System user: «HEY-заведующий» ──────────────────────────────────────────
// Создаётся один раз, если ещё нет в БД. Используется для сервисных уведомлений.
// Юзеры не могут отправлять ему сообщения, но могут получать.
const SYSTEM_USER_ID = 'system_hey_official';
const SYSTEM_AVATAR  = '/favicon.svg'; // лого HEY как аватар сервисного аккаунта

(function ensureSystemUser() {
  const existing = db.prepare('SELECT id, avatar FROM users WHERE id=?').get(SYSTEM_USER_ID);
  if (existing) {
    // Если аватар не выставлен или устарел — обновим до текущего лого
    if (existing.avatar !== SYSTEM_AVATAR) {
      db.prepare('UPDATE users SET avatar=? WHERE id=?').run(SYSTEM_AVATAR, SYSTEM_USER_ID);
    }
    return;
  }
  try {
    db.prepare(`
      INSERT INTO users (id, name, phone, password, avatar, created_at,
                         is_admin, is_super, is_blocked, is_system, bio,
                         invite_code, must_change_password)
      VALUES (?, ?, ?, ?, ?, ?, 0, 1, 0, 1, ?, ?, 0)
    `).run(
      SYSTEM_USER_ID,
      'HEY-заведующий',
      '+0',
      '$disabled$', // невозможно войти под этим аккаунтом
      SYSTEM_AVATAR,
      Math.floor(Date.now() / 1000),
      'Сервисный аккаунт HEY. Сюда приходят системные уведомления и анонсы.',
      'HEYSYSTEM1',
    );
  } catch (e) {
    console.warn('[system-user] не удалось создать:', e.message);
  }
})();

function now() { return Math.floor(Date.now() / 1000); }

// ── School (BL School) inviter account ──────────────────────────────────────
// Системный аккаунт от имени которого выпускаются школьные инвайты через АВО.
const SCHOOL_USER_ID = 'system_school_bl';
const SCHOOL_NAME    = process.env.AWO_SCHOOL_NAME || 'BL School';

(function ensureSchoolAccount() {
  const existing = db.prepare('SELECT id FROM users WHERE id=?').get(SCHOOL_USER_ID);
  if (existing) return;
  try {
    db.prepare(`
      INSERT INTO users (id, name, phone, password, avatar, created_at,
                         is_admin, is_super, is_blocked, is_system, is_school_account,
                         bio, invite_code, must_change_password)
      VALUES (?, ?, ?, ?, ?, ?, 0, 1, 0, 1, 1, ?, ?, 0)
    `).run(
      SCHOOL_USER_ID,
      SCHOOL_NAME,
      '+00000000001',  // плейсхолдер, логин невозможен
      '$disabled$',
      '/favicon.svg',
      Math.floor(Date.now() / 1000),
      'Системный аккаунт школы BL School. Через него приходят приглашения ученикам.',
      'BLSCHOOL01',
    );
  } catch (e) {
    console.warn('[school-account] не удалось создать:', e.message);
  }
})();

// ── Multi-tenant миграция: создаём дефолтный tenant из существующих
//    settings (.env AWO_* + system_settings.awo_*) и проставляем tenant_id
//    на все «бесхозные» строки. Идемпотентно. ───────────────────────────
const DEFAULT_TENANT_ID = 'tnt_default';
(function ensureDefaultTenant() {
  try {
    const existing = db.prepare('SELECT id FROM tenants WHERE id=?').get(DEFAULT_TENANT_ID);
    if (existing) return;
    // Берём токен/секрет из .env (как было), либо генерим
    const envToken  = process.env.AWO_WEBHOOK_TOKEN || crypto.randomBytes(24).toString('hex');
    const envSecret = process.env.AWO_JOIN_SECRET   || crypto.randomBytes(32).toString('hex');
    const t = Math.floor(Date.now() / 1000);
    // Owner — первый найденный админ; если ещё никого нет — system_hey_official
    const adminRow = db.prepare("SELECT id FROM users WHERE is_admin=1 LIMIT 1").get();
    const ownerId = adminRow?.id || 'system_hey_official';
    // Перенос текущих system_settings.awo_*
    const getS = (k, d=null) => {
      const r = db.prepare('SELECT value FROM system_settings WHERE key=?').get(k);
      if (!r) return d;
      try { return JSON.parse(r.value); } catch { return r.value; }
    };
    const testMode    = getS('awo_test_mode', false);
    const testCourse  = getS('awo_test_course', '') || '';
    const chatExcl    = getS('awo_chat_excludes', 'слушатель,запись');
    const accountId   = getS('awo_school_account_id', null);
    db.prepare(`INSERT INTO tenants
      (id, name, owner_id, awo_webhook_token, awo_join_secret, account_id,
       test_mode, test_course, chat_excludes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(DEFAULT_TENANT_ID, 'Школа по умолчанию', ownerId,
        envToken, envSecret, accountId,
        testMode ? 1 : 0, testCourse, chatExcl, t, t);
    // Backfill: все осиротевшие записи перекодируем на дефолтный tenant
    db.prepare("UPDATE awo_course_chats SET tenant_id=? WHERE tenant_id IS NULL")
      .run(DEFAULT_TENANT_ID);
    db.prepare("UPDATE awo_processed   SET tenant_id=? WHERE tenant_id IS NULL")
      .run(DEFAULT_TENANT_ID);
    db.prepare("UPDATE school_invites  SET tenant_id=? WHERE tenant_id IS NULL")
      .run(DEFAULT_TENANT_ID);
    console.log('[multi-tenant] migrated existing AWO setup → tnt_default');
  } catch (e) {
    console.warn('[multi-tenant] не удалось создать default tenant:', e.message);
  }
})();

// ── Users ──────────────────────────────────────────────────────────────────

const stmtInsertUser = db.prepare(
  `INSERT INTO users (id,phone,name,password,avatar,birthday,created_at,invite_code,referral_by,email)
   VALUES (@id,@phone,@name,@password,@avatar,@birthday,@created_at,@invite_code,@referral_by,@email)`
);
const stmtInsertPresence = db.prepare(
  `INSERT INTO presence (user_id,online,last_seen) VALUES (@user_id,0,@last_seen)`
);

function makeInviteCode(id) {
  return id.replace(/-/g,'').slice(0,10).toUpperCase();
}

function createUser({ phone, name, password, birthday, avatar, inviteCode, email }) {
  const id = uuid();
  const referredBy = inviteCode
    ? (db.prepare('SELECT id FROM users WHERE invite_code=?').get(inviteCode)?.id || null)
    : null;
  const user = { id, phone, name, password: bcrypt.hashSync(password, 10),
    avatar: avatar || null, birthday: birthday || null, created_at: now(),
    invite_code: makeInviteCode(id), referral_by: referredBy,
    email: email ? String(email).trim().toLowerCase() : null };
  db.transaction(() => {
    stmtInsertUser.run(user);
    stmtInsertPresence.run({ user_id: id, last_seen: now() });
    if (referredBy) {
      db.prepare('INSERT OR IGNORE INTO referrals (inviter_id,invitee_id,created_at) VALUES (?,?,?)')
        .run(referredBy, id, now());
    }
  })();
  return user;
}

// Создаёт строку referrals (inviter → invitee) + проставляет referral_by
// на invitee, если он ещё не задан. Идемпотентно (UNIQUE/INSERT OR IGNORE).
// Используется когда /register получает inviteUserId (UUID приглашающего),
// а не invite_code — createUser в таком случае реферал не создаёт.
function markReferralFromInviter(inviterId, inviteeId) {
  if (!inviterId || !inviteeId || inviterId === inviteeId) return;
  db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO referrals (inviter_id,invitee_id,created_at) VALUES (?,?,?)')
      .run(inviterId, inviteeId, now());
    db.prepare('UPDATE users SET referral_by=? WHERE id=? AND (referral_by IS NULL OR referral_by="")')
      .run(inviterId, inviteeId);
  })();
}

function getReferralCount(userId) {
  return db.prepare('SELECT COUNT(*) as c FROM referrals WHERE inviter_id=?').get(userId)?.c ?? 0;
}

// Возвращает { total, confirmed } — приглашённые этим юзером (зарегистрированы
// по его ссылке) и из них подтвердившиеся (написали первое сообщение).
function getInvitedCounts(userId) {
  const total     = db.prepare('SELECT COUNT(*) as c FROM referrals WHERE inviter_id=?').get(userId)?.c ?? 0;
  const confirmed = db.prepare('SELECT COUNT(*) as c FROM referrals WHERE inviter_id=? AND confirmed_at IS NOT NULL').get(userId)?.c ?? 0;
  return { total, confirmed };
}

function findUserByInviteCode(code) {
  return db.prepare('SELECT * FROM users WHERE invite_code=?').get(code) || null;
}

const stmtFindByPhone = db.prepare('SELECT * FROM users WHERE phone=?');
const stmtFindById    = db.prepare('SELECT * FROM users WHERE id=?');

function findUserByPhone(phone) { return stmtFindByPhone.get(phone) || null; }
function findUserById(id)       { return stmtFindById.get(id) || null; }

// Avatar payload helper.
// Если аватар — base64 (data:image/...), возвращает ссылку на /api/avatars/:userId
// (кешируется на 30 дней, не таскается инлайн в каждом сообщении/чате).
// Если аватар — URL (S3/http) или emoji/буква — возвращает как есть.
const { toPublicMediaUrl, rewriteAttachment } = require('../mediaUrl');

function avatarPayload(userId, rawAvatar) {
  if (!rawAvatar) return null;
  if (rawAvatar.startsWith('data:image/')) return `/api/avatars/${userId}`;
  return toPublicMediaUrl(rawAvatar); // S3 → /media/…; emoji/буква без изменений
}

// Универсальный post-process: проходит по строке/массиву строк и заменяет тяжёлые
// base64 аватары на ссылку /api/avatars/:userId. Применяется к любым полям имени
// avatar / author_avatar / sender_avatar / partner_avatar и т.п.
// Берёт ID юзера из соседних полей: id / user_id / author_id / sender_id / partner_id.
const _AVATAR_FIELDS = [
  ['avatar',         'id'],
  ['author_avatar',  'user_id'],     // moments
  ['sender_avatar',  'sender_id'],   // messages
  ['partner_avatar', 'partner_id'],  // direct convs
];
function normalizeAvatars(rows) {
  if (!rows) return rows;
  const list = Array.isArray(rows) ? rows : [rows];
  for (const r of list) {
    if (!r) continue;
    for (const [avField, idField] of _AVATAR_FIELDS) {
      const v = r[avField];
      if (typeof v === 'string' && v.startsWith('data:image/')) {
        const uid = r[idField] ?? r.user_id ?? r.id;
        if (uid) r[avField] = `/api/avatars/${uid}`;
      }
    }
  }
  return rows;
}

function updateUser(id, fields) {
  const allowed = ['name','phone','birthday','avatar','bio','headline','email','email_verified','password','must_change_password'];
  const sets = Object.keys(fields).filter(k => allowed.includes(k));
  if (!sets.length) return findUserById(id);
  const normalized = { ...fields };
  if (normalized.email != null) {
    normalized.email = String(normalized.email).trim().toLowerCase() || null;
  }
  const sql = `UPDATE users SET ${sets.map(k=>`${k}=@${k}`).join(',')} WHERE id=@id`;
  db.prepare(sql).run({ ...normalized, id });
  return findUserById(id);
}

function findUserByEmail(email) {
  if (!email) return null;
  return db.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE').get(String(email).trim().toLowerCase()) || null;
}

function findUserByEmailOrPhone(email, phone) {
  if (email) {
    const u = findUserByEmail(email);
    if (u) return u;
  }
  if (phone) {
    const u = findUserByPhone(phone);
    if (u) return u;
  }
  return null;
}

// Возвращает id официального школьного аккаунта.
// По умолчанию это системный SCHOOL_USER_ID, но админ может привязать
// в /admin/awo обычного пользователя — тогда возвращается его id.
// Multi-tenant: возвращает user.id «школьного аккаунта» tenant'а.
// Если tenant передан и у него есть account_id — он. Иначе legacy
// system_settings.awo_school_account_id (для совместимости). Если ничего
// нет / привязанный юзер удалён / заблокирован — fallback SCHOOL_USER_ID.
function getSchoolUserId(tenantId) {
  let configured = null;
  if (tenantId) {
    const t = getTenantById(tenantId);
    configured = t?.account_id || null;
  }
  if (!configured) configured = getSetting('awo_school_account_id', null);
  if (!configured) return SCHOOL_USER_ID;
  const u = db.prepare('SELECT id, is_blocked FROM users WHERE id=?').get(configured);
  if (!u || u.is_blocked) return SCHOOL_USER_ID;
  return configured;
}

function getSchoolAccount(tenantId) {
  return findUserById(getSchoolUserId(tenantId));
}

// ── Contacts ───────────────────────────────────────────────────────────────

function getContacts(ownerId) {
  // HEY-заведующий — служебный контакт, добавляется автоматически каждому
  // юзеру. В UI-списке контактов его не показываем (доступ к чату — из
  // списка чатов или из публикаций); юзер не должен иметь возможность
  // его «удалить» или путаться рядом с реальными контактами.
  const rows = db.prepare(
    `SELECT u.*, c.nickname, c.notes, p.online, p.last_seen
     FROM contacts c
     JOIN users u ON u.id = c.contact_id
     LEFT JOIN presence p ON p.user_id = c.contact_id
     WHERE c.owner_id = ? AND c.contact_id != ?`
  ).all(ownerId, SYSTEM_USER_ID);
  return normalizeAvatars(
    rows.map(({ password, ...r }) => ({ ...r, online: !!r.online, is_deleted: !!r.is_deleted }))
  );
}

// Полное физическое удаление аккаунта и всего, что с ним связано в БД.
// Возвращает массив S3-ключей/префиксов, которые надо стереть в хранилище
// (вызывающий код сам делает storage.deleteByPrefix — db.js не зависит от storage).
function hardDeleteUserAccount(userId) {
  const u = findUserById(userId);
  if (!u) return { s3Keys: [], s3Prefixes: [] };

  // Сначала собираем S3-ключи, которые надо будет стереть после транзакции
  const momentIds = db.prepare('SELECT id FROM moments WHERE user_id=?').all(userId).map(r => r.id);
  const s3Prefixes = momentIds.map(id => `moments/${id}/`);
  const avatarExt  = (u.avatar && typeof u.avatar === 'string' && /\.(webp|png|jpe?g)(\?|$)/i.exec(u.avatar)?.[1]) || 'webp';
  const s3Keys     = [`avatars/${userId}.${avatarExt.toLowerCase()}`];

  db.transaction(() => {
    // 1. Реакции/просмотры/жалобы/feedback'и пользователя
    db.prepare('DELETE FROM moment_reactions WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM moment_views WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM reports WHERE reporter_id=? OR target_user_id=?').run(userId, userId);
    db.prepare('DELETE FROM feedbacks WHERE user_id=?').run(userId);
    // 2. Реакции и просмотры на МОМЕНТЫ пользователя (от других людей)
    if (momentIds.length) {
      const ph = momentIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM moment_reactions WHERE moment_id IN (${ph})`).run(...momentIds);
      db.prepare(`DELETE FROM moment_views     WHERE moment_id IN (${ph})`).run(...momentIds);
    }
    // 3. Моменты пользователя
    db.prepare('DELETE FROM moments WHERE user_id=?').run(userId);
    // 4. Контакты в обе стороны
    db.prepare('DELETE FROM contacts WHERE owner_id=? OR contact_id=?').run(userId, userId);
    // 5. Блокировки в обе стороны
    db.prepare('DELETE FROM blocks WHERE user_id=? OR blocked_id=?').run(userId, userId);
    // 6. Реакции на сообщения
    try { db.prepare('DELETE FROM reactions WHERE user_id=?').run(userId); } catch {}
    // 7. Закреплённые чаты / push-подписки / presence
    try { db.prepare('DELETE FROM pinned_conversations WHERE user_id=?').run(userId); } catch {}
    try { db.prepare('DELETE FROM push_subscriptions WHERE user_id=?').run(userId); } catch {}
    try { db.prepare('DELETE FROM presence WHERE user_id=?').run(userId); } catch {}
    // 8. Сообщения: анонимизируем (NOT NULL FK на conversations, не рвём
    //    переписку для других участников; ставим sender NULL, текст
    //    помечаем как удалённый, чтобы у собеседника осталась канва диалога,
    //    но содержимого/идентификации не было).
    try {
      db.prepare(
        "UPDATE messages SET text='[сообщение удалено]', attachment=NULL WHERE sender_id=?"
      ).run(userId);
    } catch {}
    // 9. Members: убираем пользователя из всех чатов. Direct-чаты, где
    //    он был одним из двух участников, оставляем у собеседника пустыми
    //    с пометкой типа deleted_partner (либо потом ручная чистка).
    db.prepare('DELETE FROM members WHERE user_id=?').run(userId);
    // 10. Tenants — если этот юзер owner какого-то tenant'а, обнуляем
    //     (сам tenant не удаляем, чтобы не ронять курсы школы).
    try { db.prepare('UPDATE tenants SET owner_id=NULL, account_id=NULL WHERE owner_id=? OR account_id=?').run(userId, userId); } catch {}
    try { db.prepare('DELETE FROM tenant_admins WHERE user_id=?').run(userId); } catch {}
    // 11. Admin logs — оставляем как историю, но обнуляем target_user_id
    try { db.prepare('UPDATE admin_logs SET target_user_id=NULL WHERE target_user_id=?').run(userId); } catch {}
    // 12. Наконец сам пользователь
    db.prepare('DELETE FROM users WHERE id=?').run(userId);
  })();

  return { s3Keys, s3Prefixes };
}

// Self-delete юзера. Two-step:
//   1. сейчас — анонимизируем как раньше + кладём в deletion_grace снапшот
//      оригинальных полей (включая bcrypt password hash) на 30 дней.
//   2. через 30 дней scheduled task превращает в hardDeleteUserAccount.
//   3. если за 30 дней юзер логинится с оригинальным телефоном+паролем —
//      см. tryRestoreFromGrace → восстанавливается, grace-строка удаляется.
const GRACE_DAYS = 30;
function deleteUserAccount(userId) {
  const t = now();
  const u = findUserById(userId);
  if (!u) return null;

  const snapshot = {
    name:     u.name,
    phone:    u.phone,
    email:    u.email,
    avatar:   u.avatar,
    bio:      u.bio,
    headline: u.headline,
    password: u.password, // bcrypt hash — нужен для проверки на восстановлении
  };

  const placeholderPhone = `_deleted_${userId.replace(/-/g,'').slice(0,12)}_${t}`;
  db.transaction(() => {
    // Снапшот в grace-таблицу
    db.prepare(
      `INSERT INTO deletion_grace (user_id, original_phone, snapshot, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         original_phone=excluded.original_phone,
         snapshot=excluded.snapshot,
         created_at=excluded.created_at,
         expires_at=excluded.expires_at`
    ).run(userId, u.phone, JSON.stringify(snapshot), t, t + GRACE_DAYS * 24 * 3600);

    // Анонимизация (как раньше)
    db.prepare(
      `UPDATE users SET
         is_deleted=1, deleted_at=?,
         name='Удалённый пользователь',
         phone=?,
         email=NULL,
         avatar=NULL,
         bio=NULL,
         headline=NULL,
         password=?
       WHERE id=?`
    ).run(t, placeholderPhone, `DELETED_${userId}_${t}`, userId);
    db.prepare(
      `UPDATE moments SET status='archived' WHERE user_id=? AND status='active'`
    ).run(userId);
  })();

  return { graceExpiresAt: t + GRACE_DAYS * 24 * 3600 };
}

// Восстановление из grace-периода. Возвращает { user } если пароль совпал
// со снапшотом, иначе null. После успешного восстановления grace-строка
// удаляется и моменты возвращаются в active.
function tryRestoreFromGrace(originalPhone, plainPassword, bcrypt) {
  const row = db.prepare(
    'SELECT * FROM deletion_grace WHERE original_phone=? AND expires_at > ?'
  ).get(originalPhone, now());
  if (!row) return null;
  let snap;
  try { snap = JSON.parse(row.snapshot); } catch { return null; }
  if (!snap?.password) return null;
  if (!bcrypt.compareSync(plainPassword, snap.password)) return null;

  // Проверка: телефон не занят кем-то другим за это время
  const occupant = db.prepare('SELECT id FROM users WHERE phone=? AND id != ?')
    .get(originalPhone, row.user_id);
  if (occupant) return { conflict: 'phone_taken' };

  db.transaction(() => {
    db.prepare(
      `UPDATE users SET
         is_deleted=0, deleted_at=NULL,
         name=?, phone=?, email=?, avatar=?, bio=?, headline=?, password=?
       WHERE id=?`
    ).run(
      snap.name || 'Пользователь',
      snap.phone,
      snap.email || null,
      snap.avatar || null,
      snap.bio || null,
      snap.headline || null,
      snap.password,
      row.user_id,
    );
    db.prepare(`UPDATE moments SET status='active' WHERE user_id=? AND status='archived'`)
      .run(row.user_id);
    db.prepare('DELETE FROM deletion_grace WHERE user_id=?').run(row.user_id);
  })();

  return { user: findUserById(row.user_id) };
}

// Прогоняемый периодически — превращает истёкшие grace-записи в hard-delete.
function expireDeletionGrace(storage) {
  const rows = db.prepare(
    'SELECT user_id, original_phone FROM deletion_grace WHERE expires_at <= ?'
  ).all(now());
  if (!rows.length) return { processed: 0 };
  for (const r of rows) {
    try {
      const { s3Keys, s3Prefixes } = hardDeleteUserAccount(r.user_id);
      // storage может быть undefined в тестах — тогда S3-cleanup пропускаем
      if (storage) {
        (async () => {
          for (const k of s3Keys)     { try { await storage.deleteFile(k); }   catch {} }
          for (const p of s3Prefixes) { try { await storage.deleteByPrefix(p); } catch {} }
        })();
      }
    } catch (e) {
      console.error('[expireDeletionGrace]', r.user_id, e.message);
    }
    db.prepare('DELETE FROM deletion_grace WHERE user_id=?').run(r.user_id);
  }
  return { processed: rows.length };
}

function getDeletionGraceInfo(userId) {
  return db.prepare(
    'SELECT user_id, original_phone, created_at, expires_at FROM deletion_grace WHERE user_id=?'
  ).get(userId) || null;
}

function addContact(ownerId, contactId, nickname) {
  try {
    db.prepare(
      `INSERT INTO contacts (id,owner_id,contact_id,nickname) VALUES (?,?,?,?)`
    ).run(uuid(), ownerId, contactId, nickname || null);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new Error('Already in contacts');
    throw e;
  }
}

function removeContact(ownerId, contactId) {
  // Защита: системный пользователь не должен удаляться из контактов
  if (contactId === SYSTEM_USER_ID) return;
  db.prepare('DELETE FROM contacts WHERE owner_id=? AND contact_id=?').run(ownerId, contactId);
}

// Добавляет системный аккаунт в контакты юзера (если ещё не там)
function addSystemContactFor(userId) {
  if (!userId || userId === SYSTEM_USER_ID) return;
  try {
    db.prepare(
      `INSERT OR IGNORE INTO contacts (id,owner_id,contact_id,nickname) VALUES (?,?,?,?)`
    ).run(uuid(), userId, SYSTEM_USER_ID, null);
  } catch {}
}

// Бэкфилл: добавляем системного юзера в контакты всем существующим
(function backfillSystemContact() {
  try {
    const users = db.prepare("SELECT id FROM users WHERE id != ? AND is_deleted = 0").all(SYSTEM_USER_ID);
    const ins = db.prepare(`INSERT OR IGNORE INTO contacts (id,owner_id,contact_id,nickname) VALUES (?,?,?,?)`);
    users.forEach(u => { try { ins.run(uuid(), u.id, SYSTEM_USER_ID, null); } catch {} });
  } catch {}
})();

// Бэкфилл: у каждого юзера должен быть «Монолог» (self-chat)
(function backfillSelfChat() {
  try {
    const users = db.prepare("SELECT id FROM users WHERE id != ? AND is_deleted = 0").all(SYSTEM_USER_ID);
    users.forEach(u => {
      const has = db.prepare(
        `SELECT 1 FROM conversations c
         JOIN members m ON m.conversation_id=c.id AND m.user_id=?
         WHERE c.type='monolog' LIMIT 1`
      ).get(u.id);
      if (has) return;
      const id = uuid();
      db.transaction(() => {
        db.prepare(`INSERT INTO conversations (id,type,name,created_at) VALUES (?,?,?,?)`)
          .run(id, 'monolog', 'Монолог', now());
        db.prepare(`INSERT INTO members (conversation_id,user_id,joined_at) VALUES (?,?,?)`)
          .run(id, u.id, now());
      })();
    });
  } catch (e) { console.warn('[self-chat backfill]', e.message); }
})();

function getContactOwners(userId) {
  return db.prepare('SELECT owner_id FROM contacts WHERE contact_id=?')
    .all(userId).map(r => r.owner_id);
}

// ── Conversations ──────────────────────────────────────────────────────────

// ── Groups ─────────────────────────────────────────────────────────────────

// Лимиты размера группы: 100 если ни создатель ни админы не Супер,
// и 500 если хоть один Супер. Считаются active + pending — pending
// тоже «занимают слот» в инвайтах.
const GROUP_LIMIT_REGULAR = 100;
const GROUP_LIMIT_SUPER   = 500;

function groupMaxSize(convId) {
  // Любой Super среди активных админов даёт повышенный лимит.
  const row = db.prepare(
    `SELECT 1 FROM members m
     JOIN users u ON u.id = m.user_id
     JOIN conversations c ON c.id = m.conversation_id
     WHERE m.conversation_id = ? AND m.status='active'
       AND (m.is_admin=1 OR c.admin_id = m.user_id)
       AND u.is_super=1
     LIMIT 1`
  ).get(convId);
  return row ? GROUP_LIMIT_SUPER : GROUP_LIMIT_REGULAR;
}

function groupMemberSlots(convId) {
  // Считаем active + pending — pending уже занимают место.
  return db.prepare(
    "SELECT COUNT(*) AS c FROM members WHERE conversation_id=? AND status IN ('active','pending')"
  ).get(convId).c;
}

function createGroup({ creatorId, name, icon, memberIds }) {
  const id = uuid(), t = now();
  const invitees = memberIds.filter(uid => uid !== creatorId);
  // Проверяем лимит уже на этапе создания (1 создатель + N инвайтов).
  const creator = findUserById(creatorId);
  const max = creator?.is_super ? GROUP_LIMIT_SUPER : GROUP_LIMIT_REGULAR;
  if (1 + invitees.length > max) {
    throw new Error(`Лимит группы — ${max} участников`);
  }
  db.transaction(() => {
    db.prepare(`INSERT INTO conversations (id,type,name,icon,admin_id,created_at) VALUES (?,?,?,?,?,?)`)
      .run(id, 'group', name, icon || null, creatorId, t);
    // Создатель — сразу active
    db.prepare(`INSERT INTO members (conversation_id,user_id,joined_at,status,invited_by)
      VALUES (?,?,?,'active',NULL)`).run(id, creatorId, t);
    // Остальные — pending (ждут подтверждения)
    const insInvited = db.prepare(`INSERT OR IGNORE INTO members
      (conversation_id,user_id,joined_at,status,invited_by) VALUES (?,?,?,'pending',?)`);
    invitees.forEach(uid => insInvited.run(id, uid, t, creatorId));
  })();
  return { id, invitedIds: invitees };
}

function updateGroup(convId, adminId, fields) {
  if (!isGroupAdmin(convId, adminId)) throw new Error('Not authorized');
  const keys = Object.keys(fields).filter(k => ['name','icon'].includes(k));
  if (!keys.length) return;
  db.prepare(`UPDATE conversations SET ${keys.map(k=>`${k}=@${k}`).join(',')} WHERE id=@id`)
    .run({ ...fields, id: convId });
}

// Добавляет пользователя в группу СО СТАТУСОМ 'pending' — он получит
// приглашение и должен сам его принять. Если такая запись уже есть —
// ничего не меняем (повторное добавление не сбрасывает статус).
function addGroupMember(convId, requesterId, userId) {
  if (!isGroupAdmin(convId, requesterId)) throw new Error('Not authorized');
  const existing = db.prepare('SELECT status FROM members WHERE conversation_id=? AND user_id=?')
    .get(convId, userId);
  if (existing) return { alreadyMember: true, status: existing.status };
  // Лимит: 100 (или 500 если есть Супер среди админов).
  if (groupMemberSlots(convId) >= groupMaxSize(convId)) {
    throw new Error(`Лимит группы — ${groupMaxSize(convId)} участников`);
  }
  db.prepare(`INSERT INTO members (conversation_id,user_id,joined_at,status,invited_by)
     VALUES (?,?,?,'pending',?)`)
    .run(convId, userId, now(), requesterId);
  return { alreadyMember: false, status: 'pending' };
}

// Прямое добавление в группу как active member (для invite-link flow,
// когда пользователь сам активно вступает по ссылке — pending не нужен).
function joinGroupViaInvite(convId, userId, invitedBy) {
  const conv = db.prepare('SELECT id, admin_id, type FROM conversations WHERE id=?').get(convId);
  if (!conv) throw new Error('Группа не найдена');
  if (conv.type !== 'group') throw new Error('Это не групповой чат');
  const existing = db.prepare('SELECT status FROM members WHERE conversation_id=? AND user_id=?')
    .get(convId, userId);
  if (existing) {
    if (existing.status === 'active') return { alreadyActive: true };
    // pending → переводим в active
    db.prepare(`UPDATE members SET status='active', joined_at=? WHERE conversation_id=? AND user_id=?`)
      .run(now(), convId, userId);
    return { alreadyActive: false, fromPending: true };
  }
  // Лимит размера группы.
  if (groupMemberSlots(convId) >= groupMaxSize(convId)) {
    throw new Error(`Лимит группы — ${groupMaxSize(convId)} участников`);
  }
  db.prepare(`INSERT INTO members (conversation_id,user_id,joined_at,status,invited_by)
     VALUES (?,?,?,'active',?)`)
    .run(convId, userId, now(), invitedBy || conv.admin_id);
  return { alreadyActive: false, fromPending: false };
}

function removeGroupMember(convId, requesterId, userId) {
  if (!isGroupAdmin(convId, requesterId) && requesterId !== userId) throw new Error('Not authorized');
  // Создателя (conversations.admin_id) убрать нельзя — даже самим собой выйти, нужно сначала передать владельца
  const conv = db.prepare('SELECT admin_id FROM conversations WHERE id=?').get(convId);
  if (conv?.admin_id === userId) throw new Error('Нельзя удалить создателя группы');
  db.prepare('DELETE FROM members WHERE conversation_id=? AND user_id=?').run(convId, userId);
}

// Проверка прав админа на группе. Админ — либо создатель (admin_id), либо
// явно назначенный (members.is_admin=1). Используется во всех проверках прав.
function isGroupAdmin(convId, userId) {
  if (!convId || !userId) return false;
  const conv = db.prepare('SELECT admin_id, type FROM conversations WHERE id=?').get(convId);
  if (!conv || conv.type !== 'group') return false;
  if (conv.admin_id === userId) return true;
  const m = db.prepare(
    "SELECT is_admin FROM members WHERE conversation_id=? AND user_id=? AND status='active'"
  ).get(convId, userId);
  return !!(m && m.is_admin);
}

// Дать/отозвать админство у активного участника. Только админ может это
// делать. Создателя (admin_id) трогать нельзя — он всегда админ.
function setMemberAdmin(convId, requesterId, userId, value) {
  if (!isGroupAdmin(convId, requesterId)) throw new Error('Not authorized');
  const conv = db.prepare('SELECT admin_id FROM conversations WHERE id=?').get(convId);
  if (conv?.admin_id === userId) throw new Error('Создатель группы — всегда админ');
  const m = db.prepare(
    "SELECT 1 FROM members WHERE conversation_id=? AND user_id=? AND status='active'"
  ).get(convId, userId);
  if (!m) throw new Error('Пользователь не активный участник группы');
  db.prepare('UPDATE members SET is_admin=? WHERE conversation_id=? AND user_id=?')
    .run(value ? 1 : 0, convId, userId);
}

// Архивировать/восстановить чат для конкретного юзера (персональное действие)
function archiveConversation(convId, userId) {
  db.prepare(
    `UPDATE members SET archived_at=? WHERE conversation_id=? AND user_id=? AND archived_at IS NULL`
  ).run(now(), convId, userId);
}
function unarchiveConversation(convId, userId) {
  db.prepare(
    `UPDATE members SET archived_at=NULL WHERE conversation_id=? AND user_id=?`
  ).run(convId, userId);
}

// История для добавленных позже: 'all' (по умолчанию) или 'since_joined'.
// Меняет только админ группы.
function setGroupHistoryVisibility(convId, requesterId, value) {
  if (!isGroupAdmin(convId, requesterId)) throw new Error('Not authorized');
  if (!['all', 'since_joined'].includes(value)) throw new Error('Invalid value');
  db.prepare('UPDATE conversations SET history_visibility=? WHERE id=?').run(value, convId);
}

// Принять приглашение в группу — переводит запись из pending в active.
function acceptGroupInvite(convId, userId) {
  const row = db.prepare('SELECT status FROM members WHERE conversation_id=? AND user_id=?')
    .get(convId, userId);
  if (!row) throw new Error('Приглашение не найдено');
  if (row.status === 'active') return { alreadyActive: true };
  db.prepare(`UPDATE members SET status='active', joined_at=? WHERE conversation_id=? AND user_id=?`)
    .run(now(), convId, userId);
  return { alreadyActive: false };
}

// Отклонить приглашение в группу — просто удаляем запись.
function declineGroupInvite(convId, userId) {
  db.prepare(`DELETE FROM members WHERE conversation_id=? AND user_id=? AND status='pending'`)
    .run(convId, userId);
}

// Возвращает участников группы. По умолчанию только active (для broadcast и т.п.).
// includePending=true — для UI настроек группы, чтобы админ видел кто ещё не ответил.
function getGroupMembers(convId, includePending = false) {
  const where = includePending
    ? `m.conversation_id=?`
    : `m.conversation_id=? AND m.status='active'`;
  return db.prepare(
    `SELECT u.id, u.name, u.avatar, u.phone, p.online, m.status, m.is_admin
     FROM members m JOIN users u ON u.id=m.user_id
     LEFT JOIN presence p ON p.user_id=m.user_id
     WHERE ${where}`
  ).all(convId).map(r => ({ ...r, online: !!r.online, is_admin: !!r.is_admin }));
}

function getMediaMessages(convId) {
  return db.prepare(
    `SELECT m.*, u.name AS sender_name FROM messages m
     JOIN users u ON u.id=m.sender_id
     WHERE m.conversation_id=? AND m.attachment IS NOT NULL
       AND (m.is_deleted IS NULL OR m.is_deleted = 0)
     ORDER BY m.created_at DESC`
  ).all(convId).map(_parseMsg);
}

function searchMessages(convId, query) {
  return db.prepare(
    `SELECT m.*, u.name AS sender_name FROM messages m
     JOIN users u ON u.id=m.sender_id
     WHERE m.conversation_id=? AND m.text LIKE ?
       AND (m.is_deleted IS NULL OR m.is_deleted = 0)
     ORDER BY m.created_at ASC`
  ).all(convId, `%${query}%`).map(_parseMsg);
}

// Глобальный поиск по сообщениям юзера — для поиска по всем чатам.
// Возвращает массив с conversation_id чтобы клик мог открыть нужный чат.
function searchAllMessages(userId, query) {
  const q = `%${query.toLowerCase()}%`;
  // Только из чатов, где пользователь состоит. case-insensitive (LOWER переопределён).
  return db.prepare(
    `SELECT m.id, m.conversation_id, m.text, m.sender_id, m.created_at,
            u.name AS sender_name
     FROM messages m
     JOIN members mem ON mem.conversation_id = m.conversation_id AND mem.user_id = ?
     JOIN users   u   ON u.id = m.sender_id
     WHERE LOWER(m.text) LIKE ?
       AND (m.is_deleted IS NULL OR m.is_deleted = 0)
     ORDER BY m.created_at DESC
     LIMIT 100`
  ).all(userId, q);
}

function getOrCreateDirectConversation(userId1, userId2) {
  // Self-chat — «Монолог»: пользователь пишет сам себе
  if (userId1 === userId2) return getOrCreateSelfChat(userId1);

  const existing = db.prepare(
    `SELECT c.id, c.request_from FROM conversations c
     JOIN members m1 ON m1.conversation_id=c.id AND m1.user_id=?
     JOIN members m2 ON m2.conversation_id=c.id AND m2.user_id=?
     WHERE c.type='direct'
     AND (SELECT COUNT(*) FROM members WHERE conversation_id=c.id)=2
     LIMIT 1`
  ).get(userId1, userId2);
  if (existing) return existing;

  // Request-lock: срабатывает, если отправитель (userId1) НЕ в контактах
  // у получателя (userId2). Обратная связь не важна — наличие получателя
  // в контактах у отправителя ничего не говорит о согласии получателя.
  const u1inU2 = !!db.prepare('SELECT 1 FROM contacts WHERE owner_id=? AND contact_id=?').get(userId2, userId1);
  const requestFrom = u1inU2 ? null : userId1;

  const id = uuid();
  db.transaction(() => {
    db.prepare(`INSERT INTO conversations (id,type,created_at,request_from) VALUES (?,?,?,?)`)
      .run(id, 'direct', now(), requestFrom);
    db.prepare(`INSERT INTO members (conversation_id,user_id,joined_at) VALUES (?,?,?)`).run(id,userId1,now());
    db.prepare(`INSERT INTO members (conversation_id,user_id,joined_at) VALUES (?,?,?)`).run(id,userId2,now());
  })();
  return { id, request_from: requestFrom };
}

// Self-chat «Монолог» — диалог пользователя с самим собой.
// Хранится как conversation type='monolog' с одним участником.
function getOrCreateSelfChat(userId) {
  const existing = db.prepare(
    `SELECT c.id FROM conversations c
     JOIN members m ON m.conversation_id=c.id AND m.user_id=?
     WHERE c.type='monolog'
     AND (SELECT COUNT(*) FROM members WHERE conversation_id=c.id)=1
     LIMIT 1`
  ).get(userId);
  if (existing) return { id: existing.id, request_from: null };
  const id = uuid();
  db.transaction(() => {
    db.prepare(`INSERT INTO conversations (id,type,name,created_at) VALUES (?,?,?,?)`)
      .run(id, 'monolog', 'Монолог', now());
    db.prepare(`INSERT INTO members (conversation_id,user_id,joined_at) VALUES (?,?,?)`)
      .run(id, userId, now());
  })();
  return { id, request_from: null };
}

// Accept a message request: add requester as contact, unlock conversation
function acceptRequest(convId, acceptorId) {
  const conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(convId);
  if (!conv || !conv.request_from) return false;
  const requesterId = conv.request_from;
  if (requesterId === acceptorId) return false; // can't accept own request
  // Add requester to acceptor's contacts
  try { addContact(acceptorId, requesterId, null); } catch {}
  // Unlock conversation
  db.prepare('UPDATE conversations SET request_from=NULL WHERE id=?').run(convId);
  return requesterId;
}

// Полное удаление переписки (включая все сообщения и связи).
// Право:
//   · direct  — любой участник
//   · group   — только админ группы
//   · monolog — нельзя (self-chat)
function deleteConversation(convId, userId, storage) {
  const conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(convId);
  if (!conv) throw new Error('Чат не найден');
  if (conv.type === 'monolog') throw new Error('Монолог удалить нельзя');
  if (conv.type === 'group' && conv.admin_id !== userId) {
    throw new Error('Только админ группы может удалить её');
  }
  if (!isMember(convId, userId)) {
    throw new Error('Вы не участник этого чата');
  }
  // Direct-чат с HEY-заведующим удалить нельзя — это служебный канал.
  if (conv.type === 'direct') {
    const partner = db.prepare(
      `SELECT user_id FROM members WHERE conversation_id=? AND user_id != ? LIMIT 1`
    ).get(convId, userId);
    if (partner && partner.user_id === SYSTEM_USER_ID) {
      throw new Error('Чат с HEY-заведующим удалить нельзя');
    }
  }
  // Список участников нужен ДО удаления — для broadcast уведомления
  const memberIds = db.prepare('SELECT user_id FROM members WHERE conversation_id=?')
    .all(convId).map(r => r.user_id);
  // Собираем все S3-ключи аттачей ДО удаления сообщений — после транзакции
  // строк уже не будет, чтобы перечислить.
  const attRows = db.prepare(
    `SELECT attachment FROM messages WHERE conversation_id=? AND attachment IS NOT NULL`
  ).all(convId);
  const allKeys = new Set();
  for (const r of attRows) for (const k of _attachmentS3Keys(r.attachment)) allKeys.add(k);
  db.transaction(() => {
    // Реакции на сообщения этого чата
    db.prepare(`DELETE FROM reactions WHERE message_id IN
      (SELECT id FROM messages WHERE conversation_id=?)`).run(convId);
    db.prepare('DELETE FROM messages WHERE conversation_id=?').run(convId);
    db.prepare('DELETE FROM members WHERE conversation_id=?').run(convId);
    db.prepare('DELETE FROM pinned_conversations WHERE conv_id=?').run(convId);
    db.prepare('DELETE FROM conversations WHERE id=?').run(convId);
  })();
  // После транзакции — фоновый S3-cleanup (с проверкой что ключ не
  // используется живыми сообщениями в других чатах: форвард, копия).
  _cleanupS3Keys(storage, [...allKeys], null);
  return { memberIds, type: conv.type };
}

// Decline a request: delete the whole conversation
function declineRequest(convId, userId) {
  // Only the recipient can decline
  const conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(convId);
  if (!conv || !conv.request_from || conv.request_from === userId) return false;
  db.transaction(() => {
    db.prepare('DELETE FROM messages WHERE conversation_id=?').run(convId);
    db.prepare('DELETE FROM members  WHERE conversation_id=?').run(convId);
    db.prepare('DELETE FROM conversations WHERE id=?').run(convId);
  })();
  return true;
}

function getUnreadCounts(userId, convIds) {
  if (!convIds.length) return {};
  const placeholders = convIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT conversation_id, COUNT(*) as cnt FROM messages
     WHERE conversation_id IN (${placeholders}) AND sender_id!=? AND status!='read'
     GROUP BY conversation_id`
  ).all(...convIds, userId);
  return Object.fromEntries(rows.map(r => [r.conversation_id, r.cnt]));
}

// Общий счётчик непрочитанных для виджета — суммирует по всем чатам где
// пользователь активный участник.
function getTotalUnreadFor(userId) {
  const convIds = db.prepare(
    `SELECT conversation_id FROM members WHERE user_id=? AND status='active'`
  ).all(userId).map(r => r.conversation_id);
  if (!convIds.length) return 0;
  const ph = convIds.map(() => '?').join(',');
  const row = db.prepare(
    `SELECT COUNT(*) AS cnt FROM messages
     WHERE conversation_id IN (${ph}) AND sender_id!=? AND status!='read'`
  ).get(...convIds, userId);
  return row?.cnt || 0;
}

function getConversationsForUser(userId, opts = {}) {
  const { archived = false } = opts; // false → активные, true → только архивные
  // Включаем и активные, и pending членства — pending покажем как «приглашение»
  const memberRows = db.prepare(
    'SELECT conversation_id, status, invited_by, archived_at, is_admin FROM members WHERE user_id=?'
  ).all(userId)
    .filter(r => archived ? r.archived_at != null : r.archived_at == null);
  if (!memberRows.length) return [];
  const convIds = memberRows.map(r => r.conversation_id);
  const memberMeta = Object.fromEntries(
    memberRows.map(r => [r.conversation_id, {
      status: r.status || 'active', invited_by: r.invited_by, archived_at: r.archived_at,
      is_admin: !!r.is_admin,
    }])
  );

  const ph = convIds.map(() => '?').join(',');

  // 1 query: all conversations
  const convsMap = Object.fromEntries(
    db.prepare(`SELECT * FROM conversations WHERE id IN (${ph})`).all(...convIds)
      .map(c => [c.id, c])
  );

  // 1 query: partner user_id for each direct conversation
  const directIds = convIds.filter(id => convsMap[id]?.type === 'direct');
  const partnerIdMap = {}; // convId -> partnerId
  if (directIds.length) {
    const dph = directIds.map(() => '?').join(',');
    db.prepare(
      `SELECT conversation_id, user_id FROM members
       WHERE conversation_id IN (${dph}) AND user_id != ?`
    ).all(...directIds, userId)
      .forEach(r => { partnerIdMap[r.conversation_id] = r.user_id; });
  }

  // 1 query: partner user rows
  const partnerIds = [...new Set(Object.values(partnerIdMap))];
  const usersMap = {}; // userId -> user
  if (partnerIds.length) {
    const uph = partnerIds.map(() => '?').join(',');
    db.prepare(`SELECT * FROM users WHERE id IN (${uph})`).all(...partnerIds)
      .forEach(u => { usersMap[u.id] = u; });
  }

  // 1 query: partner presence (online / last_seen)
  const presenceMap = {}; // userId -> { online, last_seen }
  if (partnerIds.length) {
    const pph = partnerIds.map(() => '?').join(',');
    db.prepare(`SELECT user_id, online, last_seen FROM presence WHERE user_id IN (${pph})`)
      .all(...partnerIds)
      .forEach(p => { presenceMap[p.user_id] = { online: !!p.online, last_seen: p.last_seen }; });
  }

  // 1 query: contact nicknames
  const nickMap = {}; // partnerId -> nickname
  if (partnerIds.length) {
    const uph = partnerIds.map(() => '?').join(',');
    db.prepare(
      `SELECT contact_id, nickname FROM contacts WHERE owner_id=? AND contact_id IN (${uph})`
    ).all(userId, ...partnerIds)
      .forEach(r => { nickMap[r.contact_id] = r.nickname; });
  }

  // 1 query: last message per conversation
  const lastMap = {}; // convId -> { text, created_at, sender_id, sender_name }
  db.prepare(
    `SELECT m.conversation_id, m.text, m.attachment, m.created_at, m.sender_id, m.is_deleted,
            u.name AS sender_name
     FROM messages m
     JOIN (
       SELECT conversation_id, MAX(created_at) AS max_at
       FROM messages WHERE conversation_id IN (${ph})
       GROUP BY conversation_id
     ) t ON m.conversation_id = t.conversation_id AND m.created_at = t.max_at
     LEFT JOIN users u ON u.id = m.sender_id
     GROUP BY m.conversation_id`
  ).all(...convIds)
    .forEach(r => {
      if (Number(r.is_deleted) === 1) {
        r.text = r.sender_id === userId
          ? 'Вы удалили сообщение'
          : `${r.sender_name || 'Участник'} удалил(а) сообщение`;
        r.attachment = null;
      }
      // Если последнее сообщение — системное событие группы, генерим читаемое превью.
      if (!r.text && r.attachment) {
        try {
          const att = JSON.parse(r.attachment);
          const ev = att?.system_event;
          if (ev?.type === 'member_left') {
            r.text = `${ev.userName || 'Участник'} покинул(а) группу`;
          } else if (ev?.type === 'member_removed') {
            r.text = ev.byUserName
              ? `${ev.byUserName} удалил(а) ${ev.userName || 'участника'}`
              : `${ev.userName || 'Участник'} удалён(а) из группы`;
          }
        } catch {}
      }
      lastMap[r.conversation_id] = r;
    });

  // 1 query: unread counts
  const unreadMap = getUnreadCounts(userId, convIds);

  // Collect blocked ids (both directions)
  const blockedIds = new Set(getBlockedByIds(userId));
  const pinnedSet  = new Set(getPinnedConvIds(userId));

  // Личные пины сообщений (для direct/monolog) — батчем за один запрос
  const personalPinMap = {}; // convId → messageId
  if (convIds.length) {
    const ph2 = convIds.map(() => '?').join(',');
    db.prepare(
      `SELECT conv_id, message_id FROM personal_message_pins
       WHERE user_id=? AND conv_id IN (${ph2})`
    ).all(userId, ...convIds)
      .forEach(r => { personalPinMap[r.conv_id] = r.message_id; });
  }

  // Имена тех кто пригласил в pending-группы (для UI «X пригласил тебя в …»)
  const inviterIds = [...new Set(memberRows
    .filter(r => r.status === 'pending' && r.invited_by)
    .map(r => r.invited_by))];
  const inviterNames = {};
  const inviterAvatars = {};
  if (inviterIds.length) {
    const iph = inviterIds.map(() => '?').join(',');
    db.prepare(`SELECT id, name, avatar FROM users WHERE id IN (${iph})`).all(...inviterIds)
      .forEach(u => {
        inviterNames[u.id] = u.name;
        inviterAvatars[u.id] = avatarPayload(u.id, u.avatar);
      });
  }

  return convIds.map(convId => {
    const conv = convsMap[convId];
    if (!conv) return null;

    let name = conv.name, partnerId = null, partnerAvatar = null;
    if (conv.type === 'direct') {
      partnerId = partnerIdMap[convId] || null;
      // Hide conversations with blocked users
      if (partnerId && blockedIds.has(partnerId)) return null;
      const partner = partnerId ? usersMap[partnerId] : null;
      name = (partnerId && nickMap[partnerId]) || partner?.name || 'Диалог';
      partnerAvatar = partner ? avatarPayload(partner.id, partner.avatar) : null;
    } else if (conv.type === 'monolog') {
      name = 'Монолог';
    }

    const isRequest = !!conv.request_from;
    // Recipient of a request: hide message preview
    const isRecipient = isRequest && conv.request_from !== userId;
    const last = lastMap[convId];

    const meta = memberMeta[convId] || { status: 'active', invited_by: null };
    const isGroupInvite = conv.type === 'group' && meta.status === 'pending';

    const partnerUser = conv.type === 'direct' && partnerId ? usersMap[partnerId] : null;
    return {
      id: convId, type: conv.type, name, icon: conv.icon || null,
      admin_id: conv.admin_id || null,
      // Текущий юзер — админ этой группы (создатель ИЛИ назначенный
      // через members.is_admin). Раньше клиент проверял только
      // admin_id === me.id и назначенные соадмины не получали
      // прав в UI чата.
      my_is_group_admin: conv.type === 'group'
        ? (conv.admin_id === userId || !!meta.is_admin)
        : false,
      partner_id: partnerId,
      avatar: partnerAvatar,
      partner_is_deleted: !!(partnerUser?.is_deleted),
      partner_is_blocked: !!(partnerUser?.is_blocked),
      partner_is_super:   !!(partnerUser?.is_super),
      partner_is_system:  !!(partnerUser?.is_system),
      partner_online:     !!(partnerId && presenceMap[partnerId]?.online),
      partner_last_seen:  partnerId ? (presenceMap[partnerId]?.last_seen || null) : null,
      // Для pending group приглашений скрываем превью + не считаем непрочитанные
      last_text: (isRecipient || isGroupInvite) ? null : (last?.text || null),
      last_at:   last?.created_at || conv.created_at,
      last_sender_id: isRecipient ? null : (last?.sender_id || null),
      last_sender_name: (isRecipient || isGroupInvite) ? null : (last?.sender_name || null),
      unread_count: (isRecipient || isGroupInvite) ? 0 : (unreadMap[convId] || 0),
      is_request: isRequest,
      request_from: conv.request_from || null,
      is_pinned: pinnedSet.has(convId),
      // Для группы — общий пин из conversations; для direct/monolog — личный
      pinned_message_id: conv.type === 'group'
        ? (conv.pinned_message_id || null)
        : (personalPinMap[convId] || null),
      // Pending group invite
      is_group_invite: isGroupInvite,
      group_invited_by_id:     isGroupInvite ? meta.invited_by : null,
      group_invited_by_name:   isGroupInvite && meta.invited_by ? (inviterNames[meta.invited_by] || null) : null,
      group_invited_by_avatar: isGroupInvite && meta.invited_by ? (inviterAvatars[meta.invited_by] || null) : null,
    };
  }).filter(Boolean).sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return b.last_at - a.last_at;
  });
}

function getPinnedConvIds(userId) {
  return db.prepare('SELECT conv_id FROM pinned_conversations WHERE user_id=? ORDER BY pinned_at ASC')
    .all(userId).map(r => r.conv_id);
}

function getPinnedCount(userId) {
  return db.prepare('SELECT COUNT(*) as c FROM pinned_conversations WHERE user_id=?').get(userId)?.c ?? 0;
}

function pinConversation(userId, convId) {
  db.prepare('INSERT OR IGNORE INTO pinned_conversations (user_id, conv_id, pinned_at) VALUES (?,?,?)')
    .run(userId, convId, now());
}

function unpinConversation(userId, convId) {
  db.prepare('DELETE FROM pinned_conversations WHERE user_id=? AND conv_id=?').run(userId, convId);
}


function getConversationById(convId) {
  return db.prepare('SELECT * FROM conversations WHERE id=?').get(convId) || null;
}

function getConversationMembers(convId) {
  // Только активные участники — pending исключаются из broadcast (они ещё
  // не приняли приглашение, нечего им слать новые сообщения)
  return db.prepare(`SELECT user_id FROM members WHERE conversation_id=? AND status='active'`)
    .all(convId).map(r => r.user_id);
}

// Member со статусом 'active' — может писать, видеть историю, получать broadcast
function isMember(convId, userId) {
  return !!db.prepare(`SELECT 1 FROM members WHERE conversation_id=? AND user_id=? AND status='active'`)
    .get(convId, userId);
}

// Pending — приглашён, но ещё не подтвердил
function isPendingMember(convId, userId) {
  return !!db.prepare(`SELECT 1 FROM members WHERE conversation_id=? AND user_id=? AND status='pending'`)
    .get(convId, userId);
}

// Возвращает {id, name, avatar} того кто пригласил данного pending-юзера
function getInviterForPendingMember(convId, userId) {
  const row = db.prepare(
    `SELECT u.id, u.name, u.avatar FROM members m
     JOIN users u ON u.id = m.invited_by
     WHERE m.conversation_id=? AND m.user_id=? AND m.status='pending'`
  ).get(convId, userId);
  if (!row) return null;
  return { id: row.id, name: row.name, avatar: avatarPayload(row.id, row.avatar) };
}

// ── Messages ───────────────────────────────────────────────────────────────

function _parseMsg(m) {
  if (!m) return null;
  const parsed = { ...m,
    attachment:   m.attachment   ? JSON.parse(m.attachment)   : null,
    link_preview: m.link_preview ? JSON.parse(m.link_preview) : null,
    is_deleted:   Number(m.is_deleted) === 1,
  };
  if (parsed.is_deleted) {
    parsed.text = null;
    parsed.attachment = null;
    parsed.link_preview = null;
  }
  if (parsed.attachment) parsed.attachment = rewriteAttachment(parsed.attachment);
  if (parsed.sender_avatar) parsed.sender_avatar = toPublicMediaUrl(parsed.sender_avatar);
  if (parsed.forwarded_from_user_id) {
    const u = db.prepare('SELECT id, name, avatar, is_deleted FROM users WHERE id=?')
      .get(parsed.forwarded_from_user_id);
    if (u) {
      parsed.forwarded_from = {
        id: u.id,
        name: u.is_deleted ? 'Удалённый пользователь' : u.name,
        avatar: u.avatar ? avatarPayload(u.id, u.avatar) : null,
      };
    }
  }
  return parsed;
}

// Возвращает короткий snippet для цитаты — текст до 120 симв + тип/превью вложения
function _replySnippet(replyToId) {
  if (!replyToId) return null;
  const r = db.prepare(
    `SELECT m.id, m.sender_id, m.text, m.attachment, m.is_deleted, u.name AS sender_name
     FROM messages m JOIN users u ON u.id=m.sender_id
     WHERE m.id=?`
  ).get(replyToId);
  if (!r) return null;
  if (Number(r.is_deleted) === 1) {
    return {
      id: r.id, sender_id: r.sender_id, sender_name: r.sender_name,
      text: null, attachment_type: 'deleted', attachment_url: null, is_deleted: true,
    };
  }
  let attType = null, attUrl = null;
  try {
    if (r.attachment) {
      const att = JSON.parse(r.attachment);
      attType = att?.type || null;
      if (attType === 'image')  attUrl = att.url || null;
      if (attType === 'images') attUrl = (att.urls && att.urls[0]) || null;
      if (attUrl) attUrl = toPublicMediaUrl(attUrl);
    }
  } catch {}
  return {
    id: r.id, sender_id: r.sender_id, sender_name: r.sender_name,
    text: r.text ? r.text.slice(0, 120) : null,
    attachment_type: attType,
    attachment_url:  attUrl,
  };
}

function getMessages(convId, before, limit = 50, requesterId = null) {
  // Не таскаем avatar инлайн — он берётся через /api/avatars/:userId с долгим кешем.
  // ASC-reverse трюк — см. ниже.
  // Опционально: если в группе history_visibility='since_joined', берём
  // только сообщения после joined_at для этого юзера (если он не админ).
  let minTs = 0;
  if (requesterId) {
    const conv = db.prepare(
      "SELECT type, admin_id, history_visibility FROM conversations WHERE id=?"
    ).get(convId);
    if (conv?.type === 'group' && conv.history_visibility === 'since_joined') {
      const isAdminUser = isGroupAdmin(convId, requesterId);
      if (!isAdminUser) {
        const m = db.prepare(
          "SELECT joined_at FROM members WHERE conversation_id=? AND user_id=?"
        ).get(convId, requesterId);
        if (m?.joined_at) minTs = m.joined_at;
      }
    }
  }
  const rows = db.prepare(
    `SELECT m.*, u.name AS sender_name, u.id AS _sender_id_for_avatar,
            CASE
              WHEN u.avatar IS NULL OR u.avatar = '' THEN NULL
              WHEN u.avatar LIKE 'data:image/%' THEN '/api/avatars/' || u.id
              ELSE u.avatar
            END AS sender_avatar
     FROM messages m JOIN users u ON u.id=m.sender_id
     WHERE m.conversation_id=? AND m.created_at<? AND m.created_at>=?
     ORDER BY m.created_at DESC
     LIMIT ?`
  ).all(convId, before, minTs, limit).reverse();
  return rows.map(r => {
    delete r._sender_id_for_avatar;
    const parsed = _parseMsg(r);
    if (parsed && parsed.reply_to_id) parsed.reply_to = _replySnippet(parsed.reply_to_id);
    return parsed;
  });
}

function createMessage({ conversationId, senderId, text, attachment, replyToId, broadcastId,
  forwardedFromUserId, forwardedFromMessageId, linkPreview }) {
  const msg = { id: uuid(), conversation_id: conversationId, sender_id: senderId,
    text: text || null,
    attachment: attachment ? JSON.stringify(attachment) : null,
    link_preview: linkPreview ? JSON.stringify(linkPreview) : null,
    status: 'sent', created_at: now(), edited_at: null,
    reply_to_id: replyToId || null,
    broadcast_id: broadcastId || null,
    forwarded_from_user_id: forwardedFromUserId || null,
    forwarded_from_message_id: forwardedFromMessageId || null };
  db.prepare(
    `INSERT INTO messages (id,conversation_id,sender_id,text,attachment,link_preview,status,created_at,
                           reply_to_id,broadcast_id,forwarded_from_user_id,forwarded_from_message_id)
     VALUES (@id,@conversation_id,@sender_id,@text,@attachment,@link_preview,@status,@created_at,
             @reply_to_id,@broadcast_id,@forwarded_from_user_id,@forwarded_from_message_id)`
  ).run(msg);
  const parsed = _parseMsg(msg);
  if (parsed && parsed.reply_to_id) parsed.reply_to = _replySnippet(parsed.reply_to_id);
  return parsed;
}

// ── Scheduled messages ────────────────────────────────────────────────────
function scheduleMessage({ conversationId, senderId, text, attachment, replyToId, sendAt }) {
  const id = 'sched_' + uuid().replace(/-/g,'').slice(0,12);
  db.prepare(
    `INSERT INTO scheduled_messages
       (id, conversation_id, sender_id, text, attachment, reply_to_id, send_at, created_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
  ).run(
    id, conversationId, senderId,
    text || null,
    attachment ? JSON.stringify(attachment) : null,
    replyToId || null,
    sendAt, now()
  );
  return getScheduledMessage(id);
}

function getScheduledMessage(id) {
  const r = db.prepare('SELECT * FROM scheduled_messages WHERE id=?').get(id);
  if (!r) return null;
  return { ...r, attachment: r.attachment ? JSON.parse(r.attachment) : null };
}

function listScheduledMessages(senderId, conversationId) {
  const rows = db.prepare(
    `SELECT * FROM scheduled_messages
     WHERE sender_id=? AND conversation_id=? AND status='pending'
     ORDER BY send_at ASC`
  ).all(senderId, conversationId);
  return rows.map(r => ({ ...r, attachment: r.attachment ? JSON.parse(r.attachment) : null }));
}

function cancelScheduledMessage(id, senderId) {
  const info = db.prepare(
    "DELETE FROM scheduled_messages WHERE id=? AND sender_id=? AND status='pending'"
  ).run(id, senderId);
  return info.changes > 0;
}

function updateScheduledMessage(id, senderId, { text, sendAt }) {
  const row = db.prepare(
    "SELECT attachment FROM scheduled_messages WHERE id=? AND sender_id=? AND status='pending'"
  ).get(id, senderId);
  if (!row) return null;
  const nextText = text == null ? null : String(text).trim() || null;
  if (!nextText && !row.attachment) {
    throw new Error('Пустое сообщение');
  }
  const info = db.prepare(
    `UPDATE scheduled_messages SET text=?, send_at=?
     WHERE id=? AND sender_id=? AND status='pending'`
  ).run(nextText, sendAt, id, senderId);
  if (!info.changes) return null;
  return getScheduledMessage(id);
}

// Достать всё что пора отправить. Удаляем запись внутри транзакции
// при создании реального сообщения — чтобы не отправить дважды.
function popDueScheduledMessages(nowTs, limit = 50) {
  const rows = db.prepare(
    `SELECT * FROM scheduled_messages
     WHERE status='pending' AND send_at <= ?
     ORDER BY send_at ASC LIMIT ?`
  ).all(nowTs, limit);
  return rows.map(r => ({ ...r, attachment: r.attachment ? JSON.parse(r.attachment) : null }));
}

function deleteScheduledMessageById(id) {
  db.prepare('DELETE FROM scheduled_messages WHERE id=?').run(id);
}

// Системное событие в групповом чате: «X удалил Y из группы», «Y покинул группу»
// и т.п. Кладётся как обычное сообщение от SYSTEM_USER_ID с attachment.system_event.
// Клиент рендерит такие сообщения отдельной серой плашкой по центру.
function createSystemEventMessage(convId, event) {
  return createMessage({
    conversationId: convId,
    senderId: SYSTEM_USER_ID,
    text: null,
    attachment: { system_event: event },
  });
}

// ── Link-preview cache (для видео-ссылок в чате) ─────────────────────────
const LINK_PREVIEW_TTL = 7 * 24 * 3600; // 7 дней

function getLinkPreviewCached(url) {
  const row = db.prepare('SELECT data, fetched_at FROM link_previews WHERE url=?').get(url);
  if (!row) return null;
  if (now() - row.fetched_at > LINK_PREVIEW_TTL) return null;
  try { return JSON.parse(row.data); } catch { return null; }
}

function setLinkPreviewCached(url, data) {
  if (!url || !data) return;
  db.prepare(
    `INSERT INTO link_previews (url, data, fetched_at) VALUES (?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET data=excluded.data, fetched_at=excluded.fetched_at`
  ).run(url, JSON.stringify(data), now());
}

function updateMessageLinkPreview(messageId, linkPreview) {
  db.prepare('UPDATE messages SET link_preview=? WHERE id=?')
    .run(linkPreview ? JSON.stringify(linkPreview) : null, messageId);
}

// ── Pin message ────────────────────────────────────────────────────────────
// Закрепляется одно сообщение на чат (как в WhatsApp). Право:
//   · group   — только админ группы
//   · direct  — любой участник
//   · monolog — только владелец (= единственный участник)
// ── Push subscriptions ────────────────────────────────────────────────────
function pushSubscribe({ userId, endpoint, p256dh, auth, userAgent }) {
  db.prepare(`INSERT INTO push_subscriptions
    (endpoint, user_id, p256dh, auth, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id=excluded.user_id, p256dh=excluded.p256dh,
      auth=excluded.auth, user_agent=excluded.user_agent`)
    .run(endpoint, userId, p256dh, auth, userAgent || null, now());
}

function pushUnsubscribe(endpoint) {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').run(endpoint);
}

function getPushSubscriptions(userId) {
  return db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id=?')
    .all(userId);
}

function removePushSubscriptions(endpoints) {
  if (!endpoints || !endpoints.length) return;
  const ph = endpoints.map(() => '?').join(',');
  db.prepare(`DELETE FROM push_subscriptions WHERE endpoint IN (${ph})`).run(...endpoints);
}

// Пин сообщений с разной семантикой для типов чатов:
//   • group  — общий пин (conversations.pinned_message_id), только admin
//              может ставить/снимать, видят все участники
//   • direct / monolog — личный пин юзера (personal_message_pins),
//              ставит любой участник, видит только он сам
function pinMessage(convId, messageId, byUserId) {
  const conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(convId);
  if (!conv) throw new Error('Чат не найден');
  if (!isMember(convId, byUserId)) throw new Error('Вы не участник этого чата');
  const msg = db.prepare('SELECT id FROM messages WHERE id=? AND conversation_id=?')
    .get(messageId, convId);
  if (!msg) throw new Error('Сообщение не найдено в этом чате');

  if (conv.type === 'group') {
    // Закрепить сообщение в группе может создатель ИЛИ назначенный со-админ.
    if (!isGroupAdmin(convId, byUserId)) {
      throw new Error('Только админ группы может закреплять сообщения');
    }
    db.prepare('UPDATE conversations SET pinned_message_id=? WHERE id=?').run(messageId, convId);
    return { scope: 'group', pinned: getPinnedMessage(convId, byUserId) };
  }

  // direct / monolog — личный пин юзера
  db.prepare(
    `INSERT INTO personal_message_pins (user_id, conv_id, message_id, pinned_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, conv_id) DO UPDATE SET
       message_id=excluded.message_id,
       pinned_at=excluded.pinned_at`
  ).run(byUserId, convId, messageId, now());
  return { scope: 'personal', pinned: getPinnedMessage(convId, byUserId) };
}

function unpinMessage(convId, byUserId) {
  const conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(convId);
  if (!conv) throw new Error('Чат не найден');
  if (!isMember(convId, byUserId)) throw new Error('Вы не участник этого чата');

  if (conv.type === 'group') {
    if (!isGroupAdmin(convId, byUserId)) {
      throw new Error('Только админ группы может откреплять сообщения');
    }
    db.prepare('UPDATE conversations SET pinned_message_id=NULL WHERE id=?').run(convId);
    return { scope: 'group' };
  }

  db.prepare('DELETE FROM personal_message_pins WHERE user_id=? AND conv_id=?')
    .run(byUserId, convId);
  return { scope: 'personal' };
}

// Универсальный геттер: для группы возвращает общий пин, для direct/monolog —
// личный пин этого userId.
function getPinnedMessage(convId, userId) {
  const conv = db.prepare('SELECT type, pinned_message_id FROM conversations WHERE id=?').get(convId);
  if (!conv) return null;

  let pinnedId = null;
  if (conv.type === 'group') {
    pinnedId = conv.pinned_message_id || null;
  } else if (userId) {
    const row = db.prepare(
      'SELECT message_id FROM personal_message_pins WHERE user_id=? AND conv_id=?'
    ).get(userId, convId);
    pinnedId = row?.message_id || null;
  }
  if (!pinnedId) return null;

  const row = db.prepare(
    `SELECT m.*, u.name AS sender_name
     FROM messages m JOIN users u ON u.id=m.sender_id
     WHERE m.id=?`
  ).get(pinnedId);
  if (!row) return null;
  return _parseMsg(row);
}

// ── Forward ───────────────────────────────────────────────────────────────
// Пересылает сообщение в несколько чатов от имени byUserId. Возвращает
// массив созданных сообщений с conversationId. Допустимы только чаты, где
// byUserId является участником.
function forwardMessageToChats(originalMessageId, targetConvIds, byUserId) {
  const original = db.prepare('SELECT * FROM messages WHERE id=?').get(originalMessageId);
  if (!original) throw new Error('Исходное сообщение не найдено');
  // Если исходное само было переслано — сохраняем исходного автора (chain shortening)
  const trueAuthor = original.forwarded_from_user_id || original.sender_id;
  const created = [];
  for (const convId of targetConvIds) {
    if (!isMember(convId, byUserId)) continue;
    const conv = db.prepare('SELECT type FROM conversations WHERE id=?').get(convId);
    if (!conv) continue;
    // Запрет писать системному пользователю
    if (conv.type === 'direct') {
      const members = db.prepare('SELECT user_id FROM members WHERE conversation_id=?').all(convId).map(r => r.user_id);
      const recipient = members.find(id => id !== byUserId);
      if (recipient === SYSTEM_USER_ID && byUserId !== SYSTEM_USER_ID) continue;
      const recUser = recipient ? findUserById(recipient) : null;
      if (recUser?.is_blocked) continue;
    }
    const att = original.attachment ? JSON.parse(original.attachment) : null;
    const msg = createMessage({
      conversationId: convId,
      senderId: byUserId,
      text: original.text || null,
      attachment: att,
      forwardedFromUserId: trueAuthor,
      forwardedFromMessageId: original.id,
    });
    created.push({ ...msg, conversationId: convId });
  }
  return created;
}

function updateMessageStatus(id, status) {
  db.prepare('UPDATE messages SET status=? WHERE id=?').run(status, id);
}

// Mark all unread incoming messages up to (and including) the given message as read.
// Returns array of {id, sender_id} for broadcast.
function markMessagesReadUpTo(conversationId, readerId, upToMessageId) {
  const ref = db.prepare('SELECT created_at FROM messages WHERE id=?').get(upToMessageId);
  if (!ref) return [];
  const toUpdate = db.prepare(
    `SELECT id, sender_id FROM messages
     WHERE conversation_id=? AND sender_id!=? AND status!='read' AND created_at<=?`
  ).all(conversationId, readerId, ref.created_at);
  if (!toUpdate.length) return [];
  const ph = toUpdate.map(() => '?').join(',');
  db.prepare(`UPDATE messages SET status='read' WHERE id IN (${ph})`).run(...toUpdate.map(m => m.id));
  return toUpdate;
}

function getMessageById(id) {
  const row = db.prepare(
    `SELECT m.*, u.name AS sender_name,
            CASE
              WHEN u.avatar IS NULL OR u.avatar = '' THEN NULL
              WHEN u.avatar LIKE 'data:image/%' THEN '/api/avatars/' || u.id
              ELSE u.avatar
            END AS sender_avatar
     FROM messages m JOIN users u ON u.id=m.sender_id
     WHERE m.id=?`
  ).get(id);
  return _parseMsg(row);
}

function clearConversationMessages(convId) {
  db.prepare('UPDATE conversations SET pinned_message_id=NULL WHERE id=?').run(convId);
  db.prepare('DELETE FROM personal_message_pins WHERE conv_id=?').run(convId);
  db.prepare('DELETE FROM messages WHERE conversation_id=?').run(convId);
}

function editMessage(id, text) {
  const ts = now();
  db.prepare(
    'UPDATE messages SET text=?, edited_at=? WHERE id=? AND (is_deleted IS NULL OR is_deleted = 0)'
  ).run(text, ts, id);
  return getMessageById(id);
}

// Парсит JSON-аттач и возвращает все S3-ключи, на которые он ссылается.
// На клиенте chat-image/moment-* кладут { url, key }; chat-audio/chat-file —
// только { url }; для них ключ восстанавливаем из URL (PUBLIC_BASE + key).
function _attachmentS3Keys(attachmentJson) {
  if (!attachmentJson) return [];
  let a;
  try { a = JSON.parse(attachmentJson); } catch { return []; }
  if (!a || typeof a !== 'object') return [];
  const keys = new Set();
  const push = k => { if (k && typeof k === 'string') keys.add(k); };
  // В attachment встречаются разные формы:
  // { url }, { urls: [...] }, { key }, { thumbUrl }, { moment: { media_url } }.
  // Sweep должен видеть все ссылки, иначе живые файлы из пачек картинок
  // ошибочно становятся "сиротами".
  const walk = (v) => {
    if (!v) return;
    if (typeof v === 'string') {
      const k = _s3KeyFromUrl(v);
      if (k) push(k);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
      return;
    }
    if (typeof v === 'object') {
      for (const x of Object.values(v)) walk(x);
    }
  };
  walk(a);
  return [...keys];
}

// Проверяет, есть ли в БД ещё живые сообщения, ссылающиеся на тот же S3-ключ
// (форвард/копия). LIKE по JSON — медленно, но удалений мало.
function _isS3KeyStillReferenced(key, excludeMessageId) {
  if (!key) return false;
  const needle = '%' + JSON.stringify(key).slice(1, -1) + '%'; // экранирует кавычки
  const row = db.prepare(
    `SELECT 1 FROM messages WHERE id != ? AND attachment LIKE ? LIMIT 1`
  ).get(excludeMessageId || '', needle);
  return !!row;
}

function _cleanupS3Keys(storage, keys, excludeMessageId) {
  if (!storage || !keys || !keys.length) return;
  // Fire-and-forget: не блокируем респонс.
  (async () => {
    for (const k of keys) {
      try {
        if (_isS3KeyStillReferenced(k, excludeMessageId)) continue;
        await storage.deleteFile(k);
      } catch (e) {
        console.warn('[s3-cleanup]', k, e.message);
      }
    }
  })();
}

// Универсальная конвертация URL → S3-key. Возвращает null если URL не
// принадлежит нашему S3 (data URL, /uploads/, что-то постороннее).
function _s3KeyFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('data:') || url.startsWith('/uploads/')) return null;
  if (/^(chat\/|moments\/|avatars\/|group-icons\/)/.test(url)) return url.split('?')[0];
  const base = (process.env.S3_PUBLIC_URL_BASE || 'https://s3.twcstorage.ru/heymessenger').replace(/\/$/, '');
  if (url.startsWith(base + '/')) return url.slice(base.length + 1).split('?')[0];
  const m = url.match(/\/(chat\/(?:audio\/|files\/)?[^?#]+|moments\/[^?#]+|avatars\/[^?#]+|group-icons\/[^?#]+)/);
  return m ? m[1] : null;
}

// Собирает Set всех S3-ключей, на которые ссылается живая БД (сообщения,
// моменты, аватарки, иконы групп). Используется sweepOrphanS3Media.
function collectLiveS3Keys() {
  const live = new Set();
  const add = k => { if (k) live.add(k); };
  // messages.attachment
  const msgs = db.prepare(
    `SELECT attachment FROM messages WHERE attachment IS NOT NULL`
  ).all();
  for (const r of msgs) for (const k of _attachmentS3Keys(r.attachment)) add(k);
  // moments.media_url + moments/{id}/* префикс (если момент жив — весь префикс трогать нельзя)
  const moms = db.prepare(`SELECT id, media_url FROM moments WHERE status != 'hard_deleted' OR status IS NULL`).all();
  for (const m of moms) {
    add(_s3KeyFromUrl(m.media_url));
    // Защитим весь префикс момента — добавим маркер. sweep будет
    // пропускать ключи, начинающиеся на любой живой префикс моментов.
    if (m.id) live.add('moments/' + m.id + '/__live_prefix__');
  }
  // users.avatar
  const us = db.prepare(`SELECT avatar FROM users WHERE avatar IS NOT NULL`).all();
  for (const u of us) add(_s3KeyFromUrl(u.avatar));
  // conversations.icon (group icons)
  try {
    const cs = db.prepare(`SELECT icon FROM conversations WHERE icon IS NOT NULL`).all();
    for (const c of cs) add(_s3KeyFromUrl(c.icon));
  } catch {} // icon column может отсутствовать в очень старых БД
  return live;
}

// Ночная задача-«сборщик сирот»: листает S3 по префиксам, сравнивает с
// БД, удаляет всё что не используется + старше minAgeMs (по умолчанию
// 24 часа — защита от гонки с in-progress загрузкой, у которой ключ
// уже на S3, но строка-сообщение в БД ещё не создана).
async function sweepOrphanS3Media(storage, opts = {}) {
  if (!storage || typeof storage.listKeysByPrefix !== 'function') {
    return { skipped: true, reason: 'storage not available' };
  }
  const minAgeMs = opts.minAgeMs ?? 24 * 60 * 60 * 1000;
  const prefixes = opts.prefixes || ['chat/', 'moments/', 'group-icons/'];
  const cutoff = Date.now() - minAgeMs;
  const live = collectLiveS3Keys();
  // Префиксы живых моментов — защита для thumbnail'ов/доп. файлов внутри moments/{id}/
  const liveMomentPrefixes = [];
  for (const k of live) {
    if (k.startsWith('moments/') && k.endsWith('/__live_prefix__')) {
      liveMomentPrefixes.push(k.slice(0, -'__live_prefix__'.length));
    }
  }
  let scanned = 0, deleted = 0, skippedYoung = 0, skippedLive = 0, errors = 0;
  for (const prefix of prefixes) {
    let objects;
    try { objects = await storage.listKeysByPrefix(prefix); }
    catch (e) { errors++; console.warn('[sweep] list', prefix, e.message); continue; }
    for (const obj of objects) {
      scanned++;
      const k = obj.key;
      if (live.has(k)) { skippedLive++; continue; }
      // Защита моментов: если ключ лежит в префиксе живого момента — не трогаем
      if (liveMomentPrefixes.some(p => k.startsWith(p))) { skippedLive++; continue; }
      const mtime = obj.lastModified ? new Date(obj.lastModified).getTime() : 0;
      if (mtime > cutoff) { skippedYoung++; continue; }
      try {
        await storage.deleteFile(k);
        deleted++;
      } catch (e) { errors++; console.warn('[sweep] del', k, e.message); }
    }
  }
  return { scanned, deleted, skippedYoung, skippedLive, errors };
}

function deleteMessage(id, storage) {
  const row = db.prepare('SELECT attachment, is_deleted FROM messages WHERE id=?').get(id);
  if (!row || Number(row.is_deleted) === 1) return getMessageById(id);
  const keys = _attachmentS3Keys(row.attachment);
  db.prepare('UPDATE conversations SET pinned_message_id=NULL WHERE pinned_message_id=?').run(id);
  db.prepare('DELETE FROM personal_message_pins WHERE message_id=?').run(id);
  const ts = now();
  db.prepare(
    `UPDATE messages SET is_deleted=1, deleted_at=?, text=NULL, attachment=NULL,
            link_preview=NULL, edited_at=NULL WHERE id=?`
  ).run(ts, id);
  _cleanupS3Keys(storage, keys, id);
  return getMessageById(id);
}

function hardDeleteMessage(id, storage) {
  const row = db.prepare('SELECT attachment FROM messages WHERE id=?').get(id);
  if (!row) return { id, hard_deleted: true };
  const keys = _attachmentS3Keys(row.attachment);
  db.transaction(() => {
    db.prepare('UPDATE conversations SET pinned_message_id=NULL WHERE pinned_message_id=?').run(id);
    db.prepare('DELETE FROM personal_message_pins WHERE message_id=?').run(id);
    db.prepare('DELETE FROM reactions WHERE message_id=?').run(id);
    db.prepare('DELETE FROM messages WHERE id=?').run(id);
  })();
  _cleanupS3Keys(storage, keys, id);
  return { id, hard_deleted: true };
}

// ── Calls ──────────────────────────────────────────────────────────────────

function getCalls(userId) {
  return db.prepare(
    `SELECT c.*,
       caller.name AS caller_name, caller.avatar AS caller_avatar,
       callee.name AS callee_name, callee.avatar AS callee_avatar
     FROM calls c
     JOIN users caller ON caller.id=c.caller_id
     JOIN users callee ON callee.id=c.callee_id
     WHERE c.caller_id=? OR c.callee_id=?
     ORDER BY c.created_at DESC LIMIT 50`
  ).all(userId, userId);
}

function createCall({ callerId, calleeId, type, status, duration }) {
  const id = uuid();
  db.prepare(
    `INSERT INTO calls (id,caller_id,callee_id,type,status,duration,created_at)
     VALUES (?,?,?,?,?,?,?)`
  ).run(id, callerId, calleeId, type||'voice', status||'missed', duration||0, now());
  return id;
}

// ── Presence ───────────────────────────────────────────────────────────────

// ── Blocks ─────────────────────────────────────────────────────────────────

function blockUser(userId, blockedId) {
  db.prepare('INSERT OR IGNORE INTO blocks (user_id, blocked_id, created_at) VALUES (?,?,?)').run(userId, blockedId, now());
}

function unblockUser(userId, blockedId) {
  db.prepare('DELETE FROM blocks WHERE user_id=? AND blocked_id=?').run(userId, blockedId);
}

function getBlockedUsers(userId) {
  return normalizeAvatars(db.prepare(
    `SELECT u.id, u.name, u.phone, u.avatar, b.created_at
     FROM blocks b JOIN users u ON u.id = b.blocked_id
     WHERE b.user_id = ? ORDER BY b.created_at DESC`
  ).all(userId));
}

function isBlocked(userId, blockedId) {
  return !!db.prepare('SELECT 1 FROM blocks WHERE user_id=? AND blocked_id=?').get(userId, blockedId);
}

function updateContactNotes(ownerId, contactId, notes) {
  db.prepare('UPDATE contacts SET notes=? WHERE owner_id=? AND contact_id=?').run(notes ?? null, ownerId, contactId);
}

function updateContactNickname(ownerId, contactId, nickname) {
  const v = nickname == null ? null : String(nickname).trim().slice(0, 60) || null;
  db.prepare('UPDATE contacts SET nickname=? WHERE owner_id=? AND contact_id=?').run(v, ownerId, contactId);
}

// ── Reactions ──────────────────────────────────────────────────────────────

function toggleReaction(messageId, userId, emoji) {
  // Check if user already has THIS exact reaction → toggle off
  const sameExists = db.prepare(
    'SELECT 1 FROM reactions WHERE message_id=? AND user_id=? AND emoji=?'
  ).get(messageId, userId, emoji);
  if (sameExists) {
    db.prepare('DELETE FROM reactions WHERE message_id=? AND user_id=? AND emoji=?')
      .run(messageId, userId, emoji);
    return;
  }
  // Non-premium: max 1 reaction per message — remove any existing reaction first (swap)
  db.prepare('DELETE FROM reactions WHERE message_id=? AND user_id=?')
    .run(messageId, userId);
  // Add new reaction
  db.prepare('INSERT INTO reactions (message_id, user_id, emoji) VALUES (?,?,?)')
    .run(messageId, userId, emoji);
}

// Структура: { emoji: [{ id, name, avatar }, …] }.
// Avatar нормализуется через avatarPayload (data: → /api/avatars/<id>).
function _reactorInfo(userRow) {
  const av = avatarPayload(userRow.id, userRow.avatar);
  return { id: userRow.id, name: userRow.name, avatar: av };
}

function getMessageReactions(messageId) {
  // У reactions нет created_at — порядок задаём через rowid (SQLite
  // системный, монотонно растёт при INSERT). Это и есть порядок
  // добавления реакций.
  const rows = db.prepare(
    `SELECT r.emoji, u.id, u.name, u.avatar
     FROM reactions r JOIN users u ON u.id = r.user_id
     WHERE r.message_id=? ORDER BY r.rowid ASC`
  ).all(messageId);
  const grouped = {};
  rows.forEach(r => {
    if (!grouped[r.emoji]) grouped[r.emoji] = [];
    grouped[r.emoji].push(_reactorInfo(r));
  });
  return grouped;
}

function getReactionsForMessages(messageIds) {
  if (!messageIds.length) return {};
  const ph = messageIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT r.message_id, r.emoji, u.id, u.name, u.avatar
     FROM reactions r JOIN users u ON u.id = r.user_id
     WHERE r.message_id IN (${ph}) ORDER BY r.rowid ASC`
  ).all(...messageIds);
  const result = {};
  rows.forEach(r => {
    if (!result[r.message_id]) result[r.message_id] = {};
    if (!result[r.message_id][r.emoji]) result[r.message_id][r.emoji] = [];
    result[r.message_id][r.emoji].push(_reactorInfo(r));
  });
  return result;
}

// ── Moments ────────────────────────────────────────────────────────────────

function _parseMoment(m) {
  if (!m) return null;
  const parsed = {
    ...m,
    auto_tags: JSON.parse(m.auto_tags || '[]'),
    is_search: !!m.is_search,
    edited: !!m.edited,
    embedded_video: m.embedded_video ? JSON.parse(m.embedded_video) : null,
  };
  // Заменяем тяжёлый base64 author_avatar на ссылку /api/avatars/:userId
  if (typeof parsed.author_avatar === 'string' && parsed.author_avatar.startsWith('data:image/')) {
    parsed.author_avatar = `/api/avatars/${parsed.user_id}`;
  } else if (parsed.author_avatar) {
    parsed.author_avatar = toPublicMediaUrl(parsed.author_avatar);
  }
  if (parsed.media_url) parsed.media_url = toPublicMediaUrl(parsed.media_url);
  return parsed;
}

function getContactIds(userId) {
  return db.prepare('SELECT contact_id FROM contacts WHERE owner_id=?')
    .all(userId).map(r => r.contact_id);
}

function getBlockedByIds(userId) {
  // ids who have blocked userId OR userId has blocked them
  const blocked = db.prepare('SELECT blocked_id FROM blocks WHERE user_id=?').all(userId).map(r => r.blocked_id);
  const blockedBy = db.prepare('SELECT user_id FROM blocks WHERE blocked_id=?').all(userId).map(r => r.user_id);
  return [...new Set([...blocked, ...blockedBy])];
}

function getMomentFeed(userId, limit = 20, before = null) {
  const contactIds = getContactIds(userId);
  const blockedIds = getBlockedByIds(userId);
  let visible = contactIds.filter(id => !blockedIds.includes(id));
  // Test-users mode: админу подсыпаем моменты тестовых юзеров
  const requester = findUserById(userId);
  if (requester?.is_admin && isTestUsersEnabled()) {
    visible = [...visible, ...getTestUserIds()];
  }
  if (!visible.length) return { items: [], hasMore: false };
  const ph = visible.map(() => '?').join(',');
  const beforeCond = before ? `AND m.created_at < ?` : '';
  const args = before ? [...visible, before] : visible;
  const rows = db.prepare(
    `SELECT m.*, u.name AS author_name, u.avatar AS author_avatar, u.is_super AS author_is_super
     FROM moments m JOIN users u ON u.id=m.user_id
     WHERE m.user_id IN (${ph}) AND m.status='active' AND u.is_blocked=0 ${beforeCond}
     ORDER BY m.created_at DESC
     LIMIT ?`
  ).all(...args, limit + 1);
  const hasMore = rows.length > limit;
  const items = _withStatsBatch(rows.slice(0, limit).map(_parseMoment));
  // Прокидываем моих реакций на эти моменты одним запросом — клиент
  // показывает на превью один значок собственной реакции вместо
  // россыпи иконок с тотал-счётчиками.
  if (items.length) {
    const itemIds = items.map(m => m.id);
    const myRx = db.prepare(
      `SELECT moment_id, reaction FROM moment_reactions
       WHERE user_id=? AND moment_id IN (${itemIds.map(() => '?').join(',')})`
    ).all(userId, ...itemIds);
    const myMap = Object.fromEntries(myRx.map(r => [r.moment_id, r.reaction]));
    items.forEach(m => { m.myReaction = myMap[m.id] || null; });
  }
  return { items, hasMore };
}

function getMyMoments(userId, status = 'active') {
  let where = status === 'all' ? '' : `AND m.status='${status}'`;
  const rows = db.prepare(
    `SELECT m.*, u.name AS author_name, u.avatar AS author_avatar, u.is_super AS author_is_super
     FROM moments m JOIN users u ON u.id=m.user_id
     WHERE m.user_id=? ${where}
     ORDER BY m.created_at DESC`
  ).all(userId);
  return _withStatsBatch(rows.map(_parseMoment));
}

// Attach stats to a single moment (used when only one moment is available)
function _withStats(m) {
  if (!m) return null;
  return _withStatsBatch([m])[0];
}

// Batch version: 2 queries regardless of how many moments — eliminates N+1
function _withStatsBatch(moments) {
  if (!moments.length) return [];
  const ids = moments.map(m => m.id);
  const ph  = ids.map(() => '?').join(',');

  // All reaction counts in one query
  const rxRows = db.prepare(
    `SELECT moment_id, reaction, COUNT(*) as cnt
     FROM moment_reactions WHERE moment_id IN (${ph})
     GROUP BY moment_id, reaction`
  ).all(...ids);

  // All view counts in one query.
  // Исключаем тех, кто оставил «сильную» реакцию (resonate/talk) на этом
  // же моменте — иначе автору кажется, что один зритель посчитан
  // дважды (и в просмотрах, и в реакции). «Резонирует»/«Поговорить»
  // implicitly включают факт просмотра.
  const viewRows = db.prepare(
    `SELECT mv.moment_id, COUNT(*) as cnt
     FROM moment_views mv
     WHERE mv.moment_id IN (${ph})
       AND NOT EXISTS (
         SELECT 1 FROM moment_reactions mr
         WHERE mr.moment_id = mv.moment_id AND mr.user_id = mv.user_id
       )
     GROUP BY mv.moment_id`
  ).all(...ids);

  // Build lookup maps
  const rxMap   = {};  // moment_id → { see, resonate, talk }
  const viewMap = {};  // moment_id → count
  rxRows.forEach(r => {
    if (!rxMap[r.moment_id]) rxMap[r.moment_id] = { see: 0, resonate: 0, talk: 0 };
    rxMap[r.moment_id][r.reaction] = r.cnt;
  });
  viewRows.forEach(r => { viewMap[r.moment_id] = r.cnt; });

  return moments.map(m => ({
    ...m,
    stats:          rxMap[m.id]   ?? { see: 0, resonate: 0, talk: 0 },
    views:          viewMap[m.id] ?? 0,
    author_is_super: !!(m.author_is_super), // already JOINed in the SELECT below
  }));
}

// ── Saved moments (talk reaction = bookmark) ──────────────────────────────────
function getSavedMoments(userId) {
  const rows = db.prepare(
    `SELECT m.*, u.name AS author_name, u.avatar AS author_avatar, u.is_super AS author_is_super
     FROM moment_reactions mr
     JOIN moments m ON m.id = mr.moment_id
     JOIN users u ON u.id = m.user_id
     WHERE mr.user_id=? AND mr.reaction='talk' AND m.status='active' AND u.is_blocked=0
     ORDER BY mr.created_at DESC`
  ).all(userId);
  return _withStatsBatch(rows.map(_parseMoment));
}

function getMomentReactorsList(momentId) {
  // Реакции (resonate, talk) — moment_reactions имеет UNIQUE(moment_id, user_id),
  // но на всякий случай дедуплицируем по (user_id, reaction)
  const reactions = db.prepare(
    `SELECT mr.user_id AS id, mr.reaction, MAX(mr.created_at) AS created_at, u.name, u.avatar
     FROM moment_reactions mr JOIN users u ON u.id=mr.user_id
     WHERE mr.moment_id=? AND u.is_blocked=0 AND u.is_deleted=0
     GROUP BY mr.user_id, mr.reaction
     ORDER BY created_at DESC`
  ).all(momentId);
  // Просмотры — один user_id = одна запись. PK (moment_id,user_id), но всё равно
  // оборачиваем в GROUP BY на случай legacy-данных.
  // ВАЖНО: исключаем тех, у кого уже есть «сильная» реакция (resonate/talk) —
  // иначе они появляются и в «Вижу», и в своей реакции, и юзер думает что
  // одна реакция повлекла другую. Резонирует/Поговорить implicitly включают
  // факт того, что момент видели.
  const reactedUserIds = new Set(reactions.map(r => r.id));
  const reactedPh = reactedUserIds.size
    ? Array.from(reactedUserIds).map(() => '?').join(',')
    : null;
  const views = db.prepare(
    `SELECT mv.user_id AS id, 'see' AS reaction, MAX(mv.viewed_at) AS created_at, u.name, u.avatar
     FROM moment_views mv JOIN users u ON u.id=mv.user_id
     WHERE mv.moment_id=? AND u.is_blocked=0 AND u.is_deleted=0
       ${reactedPh ? `AND mv.user_id NOT IN (${reactedPh})` : ''}
     GROUP BY mv.user_id
     ORDER BY created_at DESC`
  ).all(momentId, ...(reactedPh ? Array.from(reactedUserIds) : []));
  return normalizeAvatars([...reactions, ...views]);
}

function makeUserSuper(userId) { db.prepare('UPDATE users SET is_super=1 WHERE id=?').run(userId); }
function revokeUserSuper(userId) { db.prepare('UPDATE users SET is_super=0 WHERE id=?').run(userId); }

function getMomentById(id) {
  const m = db.prepare(
    `SELECT m.*, u.name AS author_name, u.avatar AS author_avatar, u.is_super AS author_is_super
     FROM moments m JOIN users u ON u.id=m.user_id WHERE m.id=?`
  ).get(id);
  return _withStats(_parseMoment(m));
}

function getActiveMomentCount(userId) {
  return db.prepare("SELECT COUNT(*) as c FROM moments WHERE user_id=? AND status='active'").get(userId)?.c ?? 0;
}

function getActiveMoment(userId) {
  const m = db.prepare(
    `SELECT m.*, u.name AS author_name, u.avatar AS author_avatar, u.is_super AS author_is_super
     FROM moments m JOIN users u ON u.id=m.user_id
     WHERE m.user_id=? AND m.status='active' ORDER BY m.moment_order DESC, m.created_at DESC LIMIT 1`
  ).get(userId);
  return _withStats(_parseMoment(m));
}

function getActiveMoments(userId) {
  const rows = db.prepare(
    `SELECT m.*, u.name AS author_name, u.avatar AS author_avatar, u.is_super AS author_is_super
     FROM moments m JOIN users u ON u.id=m.user_id
     WHERE m.user_id=? AND m.status='active'
     ORDER BY m.moment_order DESC, m.created_at DESC`
  ).all(userId);
  return _withStatsBatch(rows.map(_parseMoment));
}

function reorderMoments(userId, orderedIds) {
  const stmt = db.prepare('UPDATE moments SET moment_order=? WHERE id=? AND user_id=?');
  db.transaction(() => {
    orderedIds.forEach((id, idx) => {
      stmt.run(orderedIds.length - idx, id, userId);
    });
  })();
}

function createMoment({ userId, text, mediaType, mediaUrl, mediaDuration, autoTags, isSearch, embeddedVideo, moodEmoji, mediaPosition }) {
  const id = 'mom_' + uuid().replace(/-/g,'').slice(0,12);
  const t = now();
  db.prepare(
    `INSERT INTO moments (id,user_id,text,media_type,media_url,media_duration,auto_tags,is_search,status,created_at,updated_at,edited,archived_at,embedded_video,mood_emoji,media_position)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,0,NULL,?,?,?)`
  ).run(id, userId, text, mediaType||null, mediaUrl||null, mediaDuration||null,
        JSON.stringify(autoTags||[]), isSearch ? 1 : 0, 'active', t, t,
        embeddedVideo ? JSON.stringify(embeddedVideo) : null,
        moodEmoji || null,
        mediaPosition || null);
  return getMomentById(id);
}

function updateMoment(id, { text, mediaType, mediaUrl, mediaDuration, autoTags, isSearch, embeddedVideo, moodEmoji, mediaPosition }) {
  const t = now();
  const sets = ['updated_at=?', 'edited=1'];
  const vals = [t];
  if (text !== undefined)          { sets.push('text=?');           vals.push(text); }
  if (mediaType !== undefined)     { sets.push('media_type=?');     vals.push(mediaType || null); }
  if (mediaUrl !== undefined)      { sets.push('media_url=?');      vals.push(mediaUrl || null); }
  if (mediaDuration !== undefined) { sets.push('media_duration=?'); vals.push(mediaDuration || null); }
  if (autoTags !== undefined)      { sets.push('auto_tags=?');      vals.push(JSON.stringify(autoTags)); }
  if (isSearch !== undefined)      { sets.push('is_search=?');      vals.push(isSearch ? 1 : 0); }
  if (embeddedVideo !== undefined) { sets.push('embedded_video=?'); vals.push(embeddedVideo ? JSON.stringify(embeddedVideo) : null); }
  if (moodEmoji !== undefined)     { sets.push('mood_emoji=?');     vals.push(moodEmoji || null); }
  if (mediaPosition !== undefined) { sets.push('media_position=?'); vals.push(mediaPosition || null); }
  db.prepare(`UPDATE moments SET ${sets.join(',')} WHERE id=?`).run(...vals, id);
  return getMomentById(id);
}

function archiveMoment(id) {
  const t = now();
  db.prepare("UPDATE moments SET status='archived', archived_at=?, updated_at=? WHERE id=?").run(t, t, id);
}

function restoreMoment(id) {
  const t = now();
  db.prepare("UPDATE moments SET status='active', archived_at=NULL, updated_at=? WHERE id=?").run(t, id);
}

function deleteMomentForever(id) {
  db.transaction(() => {
    db.prepare('DELETE FROM moment_reactions WHERE moment_id=?').run(id);
    db.prepare('DELETE FROM moment_views WHERE moment_id=?').run(id);
    db.prepare("UPDATE moments SET status='deleted', updated_at=? WHERE id=?").run(now(), id);
  })();
}

// ── Moment Reactions ──────────────────────────────────────────────────────

function upsertMomentReaction(momentId, userId, reaction) {
  const existing = db.prepare('SELECT id FROM moment_reactions WHERE moment_id=? AND user_id=?')
    .get(momentId, userId);
  if (existing) {
    db.prepare('UPDATE moment_reactions SET reaction=?, created_at=? WHERE id=?')
      .run(reaction, now(), existing.id);
  } else {
    db.prepare('INSERT INTO moment_reactions (id,moment_id,user_id,reaction,created_at) VALUES (?,?,?,?,?)')
      .run('rxn_'+uuid().replace(/-/g,'').slice(0,10), momentId, userId, reaction, now());
  }
}

function deleteMomentReaction(momentId, userId) {
  db.prepare('DELETE FROM moment_reactions WHERE moment_id=? AND user_id=?').run(momentId, userId);
}

function getMomentReactions(momentId) {
  return db.prepare(
    `SELECT mr.*, u.name, u.avatar FROM moment_reactions mr
     JOIN users u ON u.id=mr.user_id WHERE mr.moment_id=? ORDER BY mr.created_at DESC`
  ).all(momentId);
}

function getUserMomentReaction(momentId, userId) {
  return db.prepare('SELECT reaction FROM moment_reactions WHERE moment_id=? AND user_id=?')
    .get(momentId, userId);
}

// ── Moment Views ──────────────────────────────────────────────────────────

function addMomentView(momentId, userId) {
  db.prepare('INSERT OR IGNORE INTO moment_views (moment_id,user_id,viewed_at) VALUES (?,?,?)')
    .run(momentId, userId, now());
}

// ── Disciplines cloud ──────────────────────────────────────────────────────

function getDisciplinesCloud(userId) {
  const moments = db.prepare(
    "SELECT auto_tags FROM moments WHERE user_id=? AND status != 'deleted'"
  ).all(userId);
  const counts = {};
  moments.forEach(m => {
    try {
      JSON.parse(m.auto_tags || '[]').forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    } catch {}
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));
}

// ── Admin ──────────────────────────────────────────────────────────────────

function getAdminStats() {
  const users   = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_deleted = 0').get().c;
  const blocked = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_blocked=1').get().c;
  const admins  = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_admin=1').get().c;
  const moments = db.prepare("SELECT COUNT(*) as c FROM moments WHERE status != 'deleted'").get().c;
  const activeMoments = db.prepare("SELECT COUNT(*) as c FROM moments WHERE status='active'").get().c;
  const reactions = db.prepare('SELECT COUNT(*) as c FROM moment_reactions').get().c;
  const messages  = db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
  const openReports = db.prepare("SELECT COUNT(*) as c FROM reports WHERE status='open'").get().c;
  // Активные за последние 3 дня (по presence.last_seen)
  const threeDaysAgo = now() - 3 * 24 * 60 * 60;
  const activeUsers = db.prepare(
    `SELECT COUNT(DISTINCT p.user_id) as c FROM presence p
     JOIN users u ON u.id = p.user_id
     WHERE p.last_seen >= ? AND u.is_blocked = 0 AND u.is_deleted = 0`
  ).get(threeDaysAgo).c;
  const groups = db.prepare("SELECT COUNT(*) as c FROM conversations WHERE type='group'").get().c;
  return { users, blocked, admins, moments, activeMoments, reactions, messages, openReports, activeUsers, groups };
}

// Список групп для админки. Считаем количество активных участников,
// общее число сообщений и время последней активности — чтобы было видно
// какие группы реально живут, а какие давно «мертвы».
function getAdminGroups({ search } = {}) {
  let where = "c.type='group'";
  const params = [];
  if (search) {
    where += ' AND c.name LIKE ?';
    params.push(`%${search}%`);
  }
  return db.prepare(
    `SELECT c.id, c.name, c.icon, c.admin_id, c.created_at,
            c.history_visibility,
            (SELECT COUNT(*) FROM members  m WHERE m.conversation_id=c.id AND m.status='active')  AS members_count,
            (SELECT COUNT(*) FROM members  m WHERE m.conversation_id=c.id AND m.status='pending') AS pending_count,
            (SELECT COUNT(*) FROM messages msg WHERE msg.conversation_id=c.id)                    AS messages_count,
            (SELECT MAX(created_at) FROM messages msg WHERE msg.conversation_id=c.id)             AS last_message_at,
            (SELECT u.name FROM users u WHERE u.id=c.admin_id)                                    AS admin_name
     FROM conversations c
     WHERE ${where}
     ORDER BY last_message_at IS NULL, last_message_at DESC, c.created_at DESC`
  ).all(...params);
}

function getAdminGroupDetail(convId) {
  const c = db.prepare(
    `SELECT c.id, c.name, c.icon, c.admin_id, c.created_at, c.history_visibility, c.pinned_message_id,
            (SELECT u.name FROM users u WHERE u.id=c.admin_id) AS admin_name,
            (SELECT COUNT(*) FROM messages msg WHERE msg.conversation_id=c.id) AS messages_count,
            (SELECT MAX(created_at) FROM messages msg WHERE msg.conversation_id=c.id) AS last_message_at
     FROM conversations c
     WHERE c.id=? AND c.type='group'`
  ).get(convId);
  if (!c) return null;
  const members = db.prepare(
    `SELECT m.user_id AS id, m.status, m.is_admin, m.joined_at, m.invited_by,
            u.name, u.avatar, u.is_blocked, u.is_deleted,
            p.online, p.last_seen
     FROM members m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN presence p ON p.user_id = m.user_id
     WHERE m.conversation_id = ?
     ORDER BY m.is_admin DESC, m.joined_at ASC`
  ).all(convId).map(r => ({
    ...r,
    is_admin:   !!r.is_admin,
    is_blocked: !!r.is_blocked,
    is_deleted: !!r.is_deleted,
    online:     !!r.online,
    avatar:     avatarPayload(r.id, r.avatar),
  }));
  return { ...c, members };
}

// ── Системные публикации HEY-заведующего ────────────────────────────────
function getSystemMoments({ status = 'all', limit = 100 } = {}) {
  const where = status === 'all' ? '' : 'AND m.status = ?';
  const params = [SYSTEM_USER_ID];
  if (status !== 'all') params.push(status);
  params.push(limit);
  const rows = db.prepare(
    `SELECT m.*
     FROM moments m
     WHERE m.user_id = ? ${where}
     ORDER BY m.created_at DESC LIMIT ?`
  ).all(...params);
  return rows.map(_parseMoment);
}

// Группирует системные сообщения по broadcast_id: возвращает уникальные рассылки
// с превью текста и количеством получателей.
function getSystemBroadcasts({ limit = 50 } = {}) {
  return db.prepare(
    `SELECT broadcast_id AS id, MAX(created_at) AS sent_at,
            COUNT(*) AS recipients, MAX(text) AS text
     FROM messages
     WHERE sender_id = ? AND broadcast_id IS NOT NULL
     GROUP BY broadcast_id
     ORDER BY sent_at DESC LIMIT ?`
  ).all(SYSTEM_USER_ID, limit);
}

function deleteBroadcast(broadcastId) {
  const info = db.prepare('DELETE FROM messages WHERE broadcast_id=? AND sender_id=?')
    .run(broadcastId, SYSTEM_USER_ID);
  return info.changes;
}

// «Прочие» прямые сообщения от системного аккаунта — те, что НЕ являются
// частью рассылки (broadcast_id IS NULL). Например тестовые/ручные
// сообщения админа конкретному юзеру. Они не показывались в админке
// под «Рассылками» и из-за этого их нельзя было удалить из UI.
function listOrphanSystemMessages({ limit = 100 } = {}) {
  return db.prepare(
    `SELECT m.id, m.conversation_id, m.text, m.created_at,
            (SELECT user_id FROM members WHERE conversation_id = m.conversation_id
                                          AND user_id != ? LIMIT 1) AS recipient_id,
            (SELECT u.name FROM users u
              WHERE u.id = (SELECT user_id FROM members
                            WHERE conversation_id = m.conversation_id
                              AND user_id != ? LIMIT 1)) AS recipient_name,
            (SELECT u.phone FROM users u
              WHERE u.id = (SELECT user_id FROM members
                            WHERE conversation_id = m.conversation_id
                              AND user_id != ? LIMIT 1)) AS recipient_phone
     FROM messages m
     WHERE m.sender_id = ? AND m.broadcast_id IS NULL
     ORDER BY m.created_at DESC LIMIT ?`
  ).all(SYSTEM_USER_ID, SYSTEM_USER_ID, SYSTEM_USER_ID, SYSTEM_USER_ID, limit);
}

function deleteSystemMessage(messageId) {
  const info = db.prepare(
    'DELETE FROM messages WHERE id=? AND sender_id=?'
  ).run(messageId, SYSTEM_USER_ID);
  return info.changes;
}

function editBroadcast(broadcastId, newText) {
  const t = now();
  const info = db.prepare(
    `UPDATE messages SET text=?, edited_at=? WHERE broadcast_id=? AND sender_id=?`
  ).run(newText, t, broadcastId, SYSTEM_USER_ID);
  return info.changes;
}

// Search users by name or phone (для контактов; case-insensitive в том числе и для кириллицы)
// Тестовые юзеры (is_test=1) видны только админам когда включён test_users_enabled.
function searchUsers(query, excludeUserId) {
  const q = `%${(query || '').toLowerCase()}%`;
  const requester = excludeUserId ? findUserById(excludeUserId) : null;
  const testVisible = requester?.is_admin && isTestUsersEnabled();
  const testFilter = testVisible ? '' : 'AND u.is_test = 0';
  const rows = db.prepare(
    `SELECT u.id, u.name, u.avatar, u.phone,
            p.online
     FROM users u
     LEFT JOIN presence p ON p.user_id = u.id
     WHERE (LOWER(u.name) LIKE ? OR LOWER(u.phone) LIKE ?)
       AND u.is_blocked = 0
       AND u.id != ?
       ${testFilter}
     ORDER BY u.name ASC
     LIMIT 20`
  ).all(q, q, excludeUserId || 0);
  return normalizeAvatars(rows.map(r => ({ ...r, online: !!r.online })));
}

// ── Reports ──────────────────────────────────────────────────────────────
function createReport({ reporterId, targetType, targetId, targetUserId, reason }) {
  const id = 'rep_' + uuid().replace(/-/g,'').slice(0,12);
  db.prepare(
    `INSERT INTO reports (id, reporter_id, target_type, target_id, target_user_id, reason, status, created_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(id, reporterId, targetType, targetId, targetUserId || null, reason, 'open', now());
  return { id };
}

function getReports({ status = 'open', limit = 100 } = {}) {
  const rows = db.prepare(
    `SELECT r.*,
            u1.name AS reporter_name,    u1.avatar AS reporter_avatar,
            u2.name AS target_user_name, u2.avatar AS target_user_avatar,
            u3.name AS resolved_by_name
     FROM reports r
     LEFT JOIN users u1 ON u1.id = r.reporter_id
     LEFT JOIN users u2 ON u2.id = r.target_user_id
     LEFT JOIN users u3 ON u3.id = r.resolved_by
     ${status === 'all' ? '' : 'WHERE r.status = ?'}
     ORDER BY r.created_at DESC LIMIT ?`
  ).all(...(status === 'all' ? [limit] : [status, limit]));
  return normalizeAvatars(rows);
}

function resolveReport(id, adminId, action /* 'resolved' | 'dismissed' */) {
  db.prepare('UPDATE reports SET status=?, resolved_at=?, resolved_by=? WHERE id=?')
    .run(action, now(), adminId, id);
}

// ── Feedbacks ─────────────────────────────────────────────────────────────
function createFeedback({ userId, name, phone, type, text }) {
  const id = 'fb_' + uuid().replace(/-/g,'').slice(0,12);
  db.prepare(
    `INSERT INTO feedbacks (id, user_id, name, phone, type, text, status, created_at)
     VALUES (?,?,?,?,?,?,'open',?)`
  ).run(id, userId || null, name || null, phone || null, type || null, text, now());
  return id;
}

function getFeedbacks({ status = 'open', limit = 200 } = {}) {
  const where = status === 'all' ? '1=1' : 'f.status = @status';
  return db.prepare(
    `SELECT f.*,
            u.name  AS current_name,
            u.phone AS current_phone,
            u.is_deleted AS user_is_deleted,
            a.name  AS handled_by_name
     FROM feedbacks f
     LEFT JOIN users u ON u.id = f.user_id
     LEFT JOIN users a ON a.id = f.handled_by
     WHERE ${where}
     ORDER BY f.created_at DESC
     LIMIT @limit`
  ).all({ status, limit });
}

function resolveFeedback(id, adminId, action /* 'done' | 'dismissed' | 'open' */, note) {
  if (action === 'open') {
    db.prepare('UPDATE feedbacks SET status=\'open\', handled_at=NULL, handled_by=NULL, admin_note=COALESCE(?, admin_note) WHERE id=?')
      .run(note ?? null, id);
  } else {
    db.prepare('UPDATE feedbacks SET status=?, handled_at=?, handled_by=?, admin_note=COALESCE(?, admin_note) WHERE id=?')
      .run(action, now(), adminId, note ?? null, id);
  }
}

function countOpenFeedbacks() {
  return db.prepare('SELECT COUNT(*) AS c FROM feedbacks WHERE status=\'open\'').get()?.c ?? 0;
}

// ── Waitlist ─────────────────────────────────────────────────────────────
function addToWaitlist(email, source) {
  const id = 'wl_' + uuid().replace(/-/g,'').slice(0,12);
  try {
    db.prepare('INSERT INTO waitlist (id, email, source, created_at) VALUES (?,?,?,?)')
      .run(id, email, source || null, now());
    return { id, isNew: true };
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { isNew: false };
    }
    throw e;
  }
}

function getWaitlist({ limit = 500 } = {}) {
  return db.prepare(
    'SELECT id, email, source, created_at, notified_at FROM waitlist ORDER BY created_at DESC LIMIT ?'
  ).all(limit);
}

// Бейдж в админ-сайдбаре — сколько ещё не уведомлённых заявок осталось.
function countPendingWaitlist() {
  return db.prepare(
    'SELECT COUNT(*) AS c FROM waitlist WHERE notified_at IS NULL'
  ).get()?.c ?? 0;
}

function markWaitlistNotified(id) {
  db.prepare('UPDATE waitlist SET notified_at=? WHERE id=?').run(now(), id);
}

function unmarkWaitlistNotified(id) {
  db.prepare('UPDATE waitlist SET notified_at=NULL WHERE id=?').run(id);
}

function deleteWaitlistEntry(id) {
  db.prepare('DELETE FROM waitlist WHERE id=?').run(id);
}

function getAdminUsers({ search, filter } = {}) {
  let where = '1=1';
  const params = [];
  if (search) {
    where += ' AND (u.name LIKE ? OR u.phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (filter === 'blocked')  { where += ' AND u.is_blocked=1'; }
  if (filter === 'admins')   { where += ' AND u.is_admin=1'; }
  if (filter === 'active3d') {
    // Активные за 3 дня: presence.last_seen в окне, не забан, не удалён.
    // Та же логика что и в getAdminStats.activeUsers — клик по кафлю
    // дашборда «Активные за 3 дня» открывает ровно тот же список.
    where += ' AND p.last_seen >= ? AND u.is_blocked=0 AND u.is_deleted=0';
    params.push(now() - 3 * 24 * 60 * 60);
  }
  const rows = db.prepare(
    `SELECT u.id, u.name, u.phone, u.avatar, u.created_at, u.is_admin, u.is_super, u.is_blocked,
            u.super_expires_at,
            u.blocked_at, u.blocked_by, u.must_change_password,
            p.online, p.last_seen,
            SUM(CASE WHEN m.status='active'   THEN 1 ELSE 0 END) AS active_moments,
            SUM(CASE WHEN m.status!='deleted' THEN 1 ELSE 0 END) AS total_moments,
            (SELECT COUNT(*) FROM referrals r WHERE r.inviter_id=u.id)                                      AS invited_total,
            (SELECT COUNT(*) FROM referrals r WHERE r.inviter_id=u.id AND r.confirmed_at IS NOT NULL)       AS invited_confirmed
     FROM users u
     LEFT JOIN presence p  ON p.user_id=u.id
     LEFT JOIN moments  m  ON m.user_id=u.id
     WHERE ${where}
     GROUP BY u.id
     ORDER BY u.created_at DESC`
  ).all(...params);
  return rows.map(r => ({ ...r, online: !!r.online, is_admin: !!r.is_admin, is_super: !!r.is_super, is_blocked: !!r.is_blocked, must_change_password: !!r.must_change_password }));
}

function getAdminUserById(id) {
  const u = db.prepare(
    `SELECT u.*, p.online, p.last_seen,
            (SELECT COUNT(*) FROM moments WHERE user_id=u.id AND status!='deleted') AS total_moments,
            (SELECT COUNT(*) FROM moment_reactions mr JOIN moments m ON m.id=mr.moment_id WHERE m.user_id=u.id) AS total_reactions_received,
            (SELECT COUNT(*) FROM referrals r WHERE r.inviter_id=u.id)                                AS invited_total,
            (SELECT COUNT(*) FROM referrals r WHERE r.inviter_id=u.id AND r.confirmed_at IS NOT NULL) AS invited_confirmed,
            (SELECT inv.name FROM users inv WHERE inv.id = u.referral_by)                             AS invited_by_name
     FROM users u
     LEFT JOIN presence p ON p.user_id=u.id
     WHERE u.id=?`
  ).get(id);
  if (!u) return null;
  const { password: _, ...safe } = u;
  // Список приглашённых юзеров для подробной карточки
  const invitees = db.prepare(
    `SELECT inv.id, inv.name, inv.avatar, inv.phone, inv.is_blocked,
            r.created_at AS invited_at, r.confirmed_at
     FROM referrals r JOIN users inv ON inv.id = r.invitee_id
     WHERE r.inviter_id = ?
     ORDER BY r.created_at DESC`
  ).all(id).map(r => ({ ...r, is_blocked: !!r.is_blocked }));
  return {
    ...safe,
    online: !!safe.online, is_admin: !!safe.is_admin, is_super: !!safe.is_super,
    is_blocked: !!safe.is_blocked, must_change_password: !!safe.must_change_password,
    invitees,
  };
}

function adminResetPassword(userId, newHashedPassword) {
  db.prepare('UPDATE users SET password=?, must_change_password=1 WHERE id=?').run(newHashedPassword, userId);
}

function adminBlockUser(userId, adminId, reason) {
  const t = now();
  db.prepare('UPDATE users SET is_blocked=1, blocked_at=?, blocked_by=? WHERE id=?').run(t, adminId, userId);
  logAdminAction({ adminId, action: 'block_user', targetUserId: userId, reason });
}

function adminUnblockUser(userId, adminId) {
  db.prepare('UPDATE users SET is_blocked=0, blocked_at=NULL, blocked_by=NULL WHERE id=?').run(userId);
  logAdminAction({ adminId, action: 'unblock_user', targetUserId: userId });
}

function adminMakeAdmin(userId, adminId) {
  db.prepare('UPDATE users SET is_admin=1 WHERE id=?').run(userId);
  logAdminAction({ adminId, action: 'make_admin', targetUserId: userId });
}

function adminRevokeAdmin(userId, adminId) {
  db.prepare('UPDATE users SET is_admin=0 WHERE id=?').run(userId);
  logAdminAction({ adminId, action: 'revoke_admin', targetUserId: userId });
}

function getAdminMoments({ status, userId } = {}) {
  let where = "m.status != 'deleted'";
  const params = [];
  if (status && status !== 'all') { where += ' AND m.status=?'; params.push(status); }
  if (userId) { where += ' AND m.user_id=?'; params.push(userId); }
  const rows = db.prepare(
    `SELECT m.*, u.name AS author_name, u.phone AS author_phone,
            u.is_super AS author_is_super, u.is_deleted AS author_is_deleted
     FROM moments m JOIN users u ON u.id=m.user_id
     WHERE ${where}
     ORDER BY m.created_at DESC LIMIT 200`
  ).all(...params);
  return _withStatsBatch(rows.map(_parseMoment));
}

function adminDeleteMoment(momentId, adminId, reason, opts = {}) {
  const hard = !!opts.hard;
  const storage = opts.storage || null;
  // Перед удалением — забираем media_url для последующего S3-cleanup
  const prevRow = hard ? db.prepare('SELECT media_url FROM moments WHERE id=?').get(momentId) : null;
  db.transaction(() => {
    db.prepare('DELETE FROM moment_reactions WHERE moment_id=?').run(momentId);
    db.prepare('DELETE FROM moment_views WHERE moment_id=?').run(momentId);
    if (hard) {
      db.prepare('DELETE FROM moments WHERE id=?').run(momentId);
    } else {
      db.prepare("UPDATE moments SET status='deleted', updated_at=? WHERE id=?").run(now(), momentId);
    }
    // Авто-resolve всех открытых жалоб на этот момент — админ уже принял меры,
    // повторно вручную закрывать их не нужно.
    db.prepare(
      `UPDATE reports SET status='resolved', resolved_at=?, resolved_by=?
       WHERE target_type='moment' AND target_id=? AND status='open'`
    ).run(now(), adminId, momentId);
  })();
  // S3-cleanup для hard-delete: убираем весь префикс moments/{id}/ (cover,
  // video, audio, thumbnails) + точечный media_url ключ если он вне префикса.
  if (hard && storage) {
    (async () => {
      try { await storage.deleteByPrefix(`moments/${momentId}/`); } catch (e) {
        console.warn('[s3-moment-prefix]', momentId, e.message);
      }
      const k = _s3KeyFromUrl(prevRow?.media_url);
      if (k && !k.startsWith(`moments/${momentId}/`)) {
        try { await storage.deleteFile(k); } catch (e) {
          console.warn('[s3-moment-media]', k, e.message);
        }
      }
    })();
  }
  logAdminAction({
    adminId,
    action: hard ? 'hard_delete_moment' : 'delete_moment',
    targetMomentId: momentId,
    reason,
  });
}

function logAdminAction({ adminId, action, targetUserId, targetMomentId, reason }) {
  db.prepare(
    `INSERT INTO admin_logs (id,admin_id,action,target_user_id,target_moment_id,reason,created_at)
     VALUES (?,?,?,?,?,?,?)`
  ).run('log_'+uuid().replace(/-/g,'').slice(0,10), adminId, action,
        targetUserId||null, targetMomentId||null, reason||null, now());
}

function getAdminLogs(limit = 100) {
  return db.prepare(
    `SELECT al.*, u.name AS admin_name,
            tu.name AS target_user_name,
            m.text AS target_moment_text
     FROM admin_logs al
     JOIN users u ON u.id=al.admin_id
     LEFT JOIN users tu ON tu.id=al.target_user_id
     LEFT JOIN moments m ON m.id=al.target_moment_id
     ORDER BY al.created_at DESC LIMIT ?`
  ).all(limit);
}

function setOnline(userId, online) {
  db.prepare('UPDATE presence SET online=?, last_seen=? WHERE user_id=?')
    .run(online ? 1 : 0, now(), userId);
}

function getPresence(userId) {
  const p = db.prepare('SELECT * FROM presence WHERE user_id=?').get(userId);
  return p ? { ...p, online: !!p.online } : { online: false, last_seen: null };
}

// ── Referral mechanics ─────────────────────────────────────────────────────────

// Админский override: установить произвольную дату окончания Super,
// «без ограничения» (NULL) или отозвать. Не использует логику extendSuper
// (та накапливает месяцы относительно текущего expires_at).
//   mode='set'        → expiresAt — unix timestamp (число)
//   mode='unlimited'  → super_expires_at = NULL, is_super = 1 (бесконечно)
//   mode='revoke'     → is_super = 0, super_expires_at = NULL
function setSuperExpiry(userId, mode, expiresAt) {
  const u = findUserById(userId);
  if (!u) throw new Error('Пользователь не найден');
  if (mode === 'revoke') {
    db.prepare('UPDATE users SET is_super=0, super_expires_at=NULL WHERE id=?').run(userId);
    return { is_super: false, super_expires_at: null };
  }
  if (mode === 'unlimited') {
    db.prepare('UPDATE users SET is_super=1, super_expires_at=NULL WHERE id=?').run(userId);
    return { is_super: true, super_expires_at: null };
  }
  if (mode === 'set') {
    const ts = Number(expiresAt);
    if (!Number.isFinite(ts) || ts <= 0) throw new Error('Некорректная дата');
    if (ts < now()) throw new Error('Дата окончания должна быть в будущем');
    db.prepare('UPDATE users SET is_super=1, super_expires_at=? WHERE id=?').run(ts, userId);
    return { is_super: true, super_expires_at: ts };
  }
  throw new Error('Неизвестный режим: ' + mode);
}

function extendSuper(userId, months) {
  const user = findUserById(userId);
  const n = now();
  const base = (user.super_expires_at && user.super_expires_at > n) ? user.super_expires_at : n;
  const newExpiry = base + months * 30 * 24 * 3600;
  db.prepare('UPDATE users SET is_super=1, super_expires_at=? WHERE id=?').run(newExpiry, userId);
  return newExpiry;
}

// Засчитать реферала: вызывается из confirmReferralIfPending — только когда
// приглашённый написал ПЕРВОЕ сообщение. До этого момента реферал болтается
// как pending (есть запись в referrals с confirmed_at=NULL).
function _grantReferralCredit(inviterId) {
  // Раньше доверяли invited_count из users — но back-fill в миграции
  // считал ВСЕ referrals (включая pending), а инкремент тут добавлял ещё
  // +1 на каждое подтверждение. Семантика разъехалась. Теперь считаем
  // подтверждённых напрямую из referrals.confirmed_at и зеркалим в
  // users.invited_count для legacy-кеша.
  const inviter = findUserById(inviterId);
  const count = getInvitedCounts(inviterId).confirmed;
  db.prepare('UPDATE users SET invited_count=? WHERE id=?').run(count, inviterId);
  const result = { superGranted: false, newBadge: null, invitedCount: count };

  // 3-й приглашённый — разовый бонус 3 мес СУПЕР
  if (count >= 3 && !inviter.super_bonus_claimed) {
    const expiresAt = extendSuper(inviterId, 3);
    db.prepare('UPDATE users SET super_bonus_claimed=1 WHERE id=?').run(inviterId);
    result.superGranted = true;
    result.superExpiresAt = expiresAt;
  }

  // Ачивки
  const achievements = JSON.parse(inviter.achievements || '[]');
  const milestones = [
    { count: 5,  key: 'connector',          label: 'Связной' },
    { count: 10, key: 'circle_keeper',       label: 'Хранитель круга' },
    { count: 25, key: 'community_founder',   label: 'Основатель сообщества' },
  ];
  for (const m of milestones) {
    if (count === m.count && !achievements.includes(m.key)) {
      achievements.push(m.key);
      result.newBadge = m;
    }
  }
  if (result.newBadge) {
    db.prepare("UPDATE users SET achievements=? WHERE id=?").run(JSON.stringify(achievements), inviterId);
  }
  return result;
}

// Старый процессор оставлен для обратной совместимости — теперь это no-op
// (запись о рефералке создаётся в createUser, зачёт идёт только после первого
// сообщения через confirmReferralIfPending).
function processReferral(/* inviterId */) {
  return { superGranted: false, newBadge: null, invitedCount: 0 };
}

// Если у приглашённого ещё нет confirmed_at — отмечает реферала подтверждённым
// и засчитывает inviter'у. Идемпотентно (повторные вызовы — no-op).
// Вызывается из ws.js при отправке первого сообщения пользователем.
function confirmReferralIfPending(inviteeId) {
  const ref = db.prepare(
    'SELECT inviter_id, confirmed_at FROM referrals WHERE invitee_id=?'
  ).get(inviteeId);
  if (!ref || ref.confirmed_at) return null;
  db.prepare('UPDATE referrals SET confirmed_at=? WHERE invitee_id=?').run(now(), inviteeId);
  return { inviterId: ref.inviter_id, credit: _grantReferralCredit(ref.inviter_id) };
}

function checkAndExpireSuper(userId) {
  const user = findUserById(userId);
  if (user?.is_super && user.super_expires_at && user.super_expires_at < now()) {
    db.prepare('UPDATE users SET is_super=0 WHERE id=?').run(userId);
  }
}

// ── AWO Integration helpers ────────────────────────────────────────────────────

// Добавляет пользователя в групповой чат без проверки прав (для системных потоков:
// AWO-интеграция, авто-добавление в курс). Идемпотентно.
function addUserToChat(convId, userId) {
  const conv = db.prepare('SELECT id, type FROM conversations WHERE id=?').get(convId);
  if (!conv) throw new Error('Чат не найден');
  if (conv.type !== 'group') throw new Error('Это не групповой чат');
  const before = db.prepare('SELECT 1 FROM members WHERE conversation_id=? AND user_id=?').get(convId, userId);
  if (before) return { added: false, alreadyMember: true };
  db.prepare(`INSERT OR IGNORE INTO members (conversation_id,user_id,joined_at) VALUES (?,?,?)`)
    .run(convId, userId, now());
  return { added: true, alreadyMember: false };
}

function _makeShortCode(len = 16) {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < len; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

function createSchoolInvite({ bound_email, bound_phone, course, bound_name, tenantId }) {
  const code = _makeShortCode(16);
  const email = bound_email ? String(bound_email).trim().toLowerCase() : null;
  const tid = tenantId || DEFAULT_TENANT_ID;
  // issued_by — это user.id «бот-аккаунта» tenant'а (если есть), иначе legacy
  // SCHOOL_USER_ID. Через него сохраняется trail кто выпустил.
  const tenant = getTenantById(tid);
  const issuedBy = (tenant && tenant.account_id) || SCHOOL_USER_ID;
  db.prepare(`INSERT INTO school_invites
    (code, issued_by, bound_email, bound_phone, course, bound_name, tenant_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(code, issuedBy, email, bound_phone || null, course || null,
      bound_name ? String(bound_name).trim().slice(0, 80) : null, tid, now());
  return { code, issued_by: issuedBy, bound_email: email, bound_phone, course, bound_name, tenant_id: tid };
}

function findSchoolInviteByCode(code) {
  if (!code) return null;
  return db.prepare('SELECT * FROM school_invites WHERE code=?').get(code) || null;
}

// tenantId фильтрует поиск — два tenant'а могут принять оплату с одинаковым
// email независимо. Без явного tenantId возвращаем самый свежий (legacy).
function findActiveSchoolInviteByEmail(email, tenantId) {
  if (!email) return null;
  if (tenantId) {
    return db.prepare(
      `SELECT * FROM school_invites
       WHERE bound_email = ? COLLATE NOCASE AND used_at IS NULL AND tenant_id = ?
       ORDER BY created_at DESC LIMIT 1`
    ).get(String(email).trim().toLowerCase(), tenantId) || null;
  }
  return db.prepare(
    `SELECT * FROM school_invites
     WHERE bound_email = ? COLLATE NOCASE AND used_at IS NULL
     ORDER BY created_at DESC LIMIT 1`
  ).get(String(email).trim().toLowerCase()) || null;
}

function markSchoolInviteUsed(code, userId) {
  db.prepare('UPDATE school_invites SET used_at=?, used_by_user_id=? WHERE code=?')
    .run(now(), userId, code);
}

// ── AWO processed (idempotency) ─────────────────────────────────────────────────

// id_account уникален глобально (PRIMARY KEY), но мы дополнительно фильтруем
// по tenant'у — два tenant'а в теории могут получать webhook от одного и того
// же АВО-аккаунта (если переиспользуют его), и идемпотентность должна быть
// per-tenant. Без tenantId возвращаем true если запись есть в любом tenant'е.
function awoIsProcessed(id_account, tenantId) {
  if (!id_account) return false;
  if (tenantId) {
    return !!db.prepare('SELECT 1 FROM awo_processed WHERE id_account=? AND tenant_id=?')
      .get(String(id_account), tenantId);
  }
  return !!db.prepare('SELECT 1 FROM awo_processed WHERE id_account=?').get(String(id_account));
}

function awoMarkProcessed({ id_account, email, phone, course, invite_code, result, raw_payload, tenantId }) {
  const tid = tenantId || DEFAULT_TENANT_ID;
  try {
    db.prepare(`INSERT INTO awo_processed
      (id_account, processed_at, email, phone, course, invite_code, result, raw_payload, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(String(id_account), now(),
           email ? String(email).toLowerCase() : null,
           phone || null, course || null, invite_code || null,
           result || null, raw_payload ? JSON.stringify(raw_payload).slice(0, 8000) : null,
           tid);
  } catch (e) {
    // Уже есть — игнорируем (race condition)
    if (e.code !== 'SQLITE_CONSTRAINT_PRIMARYKEY') throw e;
  }
}

function awoListProcessed(limit = 100, tenantId) {
  if (tenantId) {
    return db.prepare(
      `SELECT id_account, processed_at, email, phone, course, invite_code, result
       FROM awo_processed WHERE tenant_id=? ORDER BY processed_at DESC LIMIT ?`
    ).all(tenantId, limit);
  }
  return db.prepare(
    `SELECT id_account, processed_at, email, phone, course, invite_code, result
     FROM awo_processed ORDER BY processed_at DESC LIMIT ?`
  ).all(limit);
}

// ── AWO course ↔ group chat mapping ─────────────────────────────────────────────

// Per-tenant маппинг: один и тот же course может быть у двух tenant'ов
// независимо (разные школы — разные курсы с похожими названиями). Идём по
// (tenant_id, course). Уникальность сохраняем на уровне приложения: при
// upsert делаем DELETE + INSERT, чтобы не зависеть от старого PK course-only.
function setAwoCourseChat(course, chatId, tenantId) {
  if (!course || !chatId) throw new Error('course and chatId required');
  const tid = tenantId || DEFAULT_TENANT_ID;
  db.transaction(() => {
    db.prepare('DELETE FROM awo_course_chats WHERE tenant_id=? AND course=? COLLATE NOCASE')
      .run(tid, String(course).trim());
    db.prepare(`INSERT INTO awo_course_chats (course, chat_id, tenant_id, created_at)
      VALUES (?, ?, ?, ?)`)
      .run(String(course).trim(), chatId, tid, now());
  })();
}

function deleteAwoCourseChat(course, tenantId) {
  const tid = tenantId || DEFAULT_TENANT_ID;
  db.prepare('DELETE FROM awo_course_chats WHERE tenant_id=? AND course=? COLLATE NOCASE')
    .run(tid, course);
}

// Подбор чата под название курса из АВО.
// Логика:
//   1. Берём название `goods` от АВО (например "BL School — Zoom Участник, поток 5")
//   2. Проверяем глобальные исключающие слова из настроек (например "слушатель, запись")
//      — если совпало хоть одно → доступ к чату НЕ даём (вернём null)
//   3. Ищем маппинг где сохранённый `course` входит подстрокой в `goods`
//      (case-insensitive). Например маппинг "Zoom Участник" сматчит
//      "BL School — Zoom Участник, поток 5"
function getChatForCourse(goods, tenantId) {
  if (!goods) return null;
  const goodsLower = String(goods).trim().toLowerCase();
  if (!goodsLower) return null;
  const tid = tenantId || DEFAULT_TENANT_ID;

  // Стоп-слова берём из tenant'а (старые system_settings.awo_chat_excludes
  // мигрированы в tenant.chat_excludes)
  const tenant = getTenantById(tid);
  const excludeRaw = (tenant?.chat_excludes ?? getSetting('awo_chat_excludes', 'слушатель,запись')) || '';
  const excludes = String(excludeRaw).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  for (const ex of excludes) {
    if (goodsLower.includes(ex)) {
      console.log(`[AWO][${tid}] курс "${goods}" содержит стоп-слово "${ex}" — чат не назначаем`);
      return null;
    }
  }

  // Точный матч в рамках tenant'а
  const exact = db.prepare(
    'SELECT chat_id FROM awo_course_chats WHERE tenant_id=? AND course=? COLLATE NOCASE'
  ).get(tid, String(goods).trim());
  if (exact) return exact.chat_id;

  // Подстрочный матч — только маппинги текущего tenant'а
  const all = db.prepare('SELECT course, chat_id FROM awo_course_chats WHERE tenant_id=?').all(tid);
  let best = null;
  for (const row of all) {
    const pattern = String(row.course || '').trim().toLowerCase();
    if (pattern && goodsLower.includes(pattern)) {
      if (!best || pattern.length > best.patternLen) {
        best = { chat_id: row.chat_id, patternLen: pattern.length };
      }
    }
  }
  return best ? best.chat_id : null;
}

function listAllGroupChats() {
  return db.prepare(
    `SELECT c.id, c.name, c.icon, c.created_at,
            (SELECT COUNT(*) FROM members WHERE conversation_id=c.id) AS member_count
     FROM conversations c WHERE c.type='group'
     ORDER BY c.created_at DESC`
  ).all();
}

function listAwoCourseChats(tenantId) {
  if (tenantId) {
    return db.prepare(
      `SELECT ac.course, ac.chat_id, ac.created_at,
              c.name AS chat_name, c.type AS chat_type
       FROM awo_course_chats ac
       LEFT JOIN conversations c ON c.id = ac.chat_id
       WHERE ac.tenant_id = ?
       ORDER BY ac.created_at DESC`
    ).all(tenantId);
  }
  return db.prepare(
    `SELECT ac.course, ac.chat_id, ac.created_at,
            c.name AS chat_name, c.type AS chat_type
     FROM awo_course_chats ac
     LEFT JOIN conversations c ON c.id = ac.chat_id
     ORDER BY ac.created_at DESC`
  ).all();
}

// ── System settings (key-value) ─────────────────────────────────────────────────

function getSetting(key, defaultValue = null) {
  const row = db.prepare('SELECT value FROM system_settings WHERE key=?').get(key);
  if (!row) return defaultValue;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function setSetting(key, value) {
  const v = typeof value === 'string' ? value : JSON.stringify(value);
  db.prepare(`INSERT INTO system_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key, v);
}

// ── Test users (admin convenience) ─────────────────────────────────────────
function isTestUsersEnabled() {
  return !!getSetting('test_users_enabled', false);
}
function setTestUsersEnabled(enabled) {
  setSetting('test_users_enabled', !!enabled);
}
function getTestUserIds() {
  return db.prepare('SELECT id FROM users WHERE is_test=1').all().map(r => r.id);
}
// Создаёт/обновляет 100 тестовых пользователей с моментами.
// Идемпотентно: повторный вызов перезаписывает имя/аватар, не дублирует.
function seedTestUsers() {
  const { generateTestUsers } = require('../testUsersData');
  const users = generateTestUsers(100);
  const ts = now();
  let created = 0, updated = 0;
  for (const u of users) {
    const exists = db.prepare('SELECT id FROM users WHERE id=?').get(u.id);
    if (exists) {
      db.prepare(`UPDATE users SET name=?, avatar=?, bio=?, headline=?, is_super=?, is_test=1
        WHERE id=?`).run(u.name, u.avatar, u.bio, u.headline, u.is_super, u.id);
      updated++;
    } else {
      db.prepare(`INSERT INTO users
        (id, phone, name, password, avatar, bio, headline, is_super, is_test,
         created_at, invite_code)
        VALUES (?, ?, ?, '$disabled$', ?, ?, ?, ?, 1, ?, ?)`)
        .run(u.id,
          `+0test${String(u.id).slice(-4)}` + String(Math.random()).slice(2,8),
          u.name, u.avatar, u.bio, u.headline, u.is_super, ts,
          makeInviteCode(u.id));
      try {
        db.prepare(`INSERT INTO presence (user_id, online, last_seen) VALUES (?, 0, ?)`)
          .run(u.id, ts - Math.floor(Math.random() * 86400 * 30)); // случайный последний онлайн за месяц
      } catch {}
      created++;
    }
    // Моменты: чистим существующие активные test-моменты юзера и пересоздаём
    db.prepare(`DELETE FROM moments WHERE user_id=?`).run(u.id);
    for (const m of u.moments) {
      const mid = `test-moment-${u.id}-${Math.random().toString(36).slice(2,8)}`;
      const auto_tags = '[]';
      // Определяем тип медиа и URL
      let mediaType = null, mediaUrl = null, mediaDuration = null;
      if (m.type === 'image' && m.url) {
        // URL уже сформирован в testUsersData.pickImage()
        mediaType = 'image';
        mediaUrl  = m.url;
      } else if (m.type === 'video' && m.video) {
        mediaType = 'video';
        mediaUrl  = m.video;
      } else if (m.type === 'audio' && m.audio) {
        mediaType = 'audio';
        mediaUrl  = m.audio;
        mediaDuration = 30 + Math.floor(Math.random() * 120); // 30-150 сек
      }
      db.prepare(`INSERT INTO moments
        (id, user_id, text, media_type, media_url, media_duration,
         mood_emoji, auto_tags, is_search, status, created_at, updated_at, edited)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?, ?, 0)`)
        .run(mid, u.id, m.text, mediaType, mediaUrl, mediaDuration,
          m.mood || null, auto_tags,
          ts - Math.floor(Math.random() * 86400 * 7), // случайно за последнюю неделю
          ts);
    }
  }
  return { created, updated, total: users.length };
}
function clearTestUsers() {
  const ids = getTestUserIds();
  if (!ids.length) return { deleted: 0 };
  const ph = ids.map(() => '?').join(',');
  // Чистим моменты, реакции, presence — потом самих юзеров
  db.prepare(`DELETE FROM moment_reactions WHERE user_id IN (${ph})`).run(...ids);
  db.prepare(`DELETE FROM moment_views WHERE user_id IN (${ph})`).run(...ids);
  db.prepare(`DELETE FROM moments WHERE user_id IN (${ph})`).run(...ids);
  db.prepare(`DELETE FROM presence WHERE user_id IN (${ph})`).run(...ids);
  db.prepare(`DELETE FROM users WHERE id IN (${ph})`).run(...ids);
  return { deleted: ids.length };
}

// ── Business access (бизнес-пользователи) ──────────────────────────────
function requestBusinessAccess(userId, note) {
  const u = findUserById(userId);
  if (!u) throw new Error('Пользователь не найден');
  if (u.business_status === 'approved') throw new Error('Уже одобрено');
  if (u.business_status === 'pending')  throw new Error('Заявка уже на рассмотрении');
  db.prepare(`UPDATE users SET business_status='pending', business_requested_at=?,
                business_request_note=?, business_reject_reason=NULL WHERE id=?`)
    .run(now(), note ? String(note).slice(0, 500) : null, userId);
}
function cancelBusinessRequest(userId) {
  db.prepare("UPDATE users SET business_status='none', business_requested_at=NULL, business_request_note=NULL WHERE id=? AND business_status='pending'")
    .run(userId);
}
function listBusinessRequests(status = 'pending') {
  return db.prepare(
    `SELECT id, name, phone, avatar, business_status,
            business_requested_at, business_request_note,
            business_approved_at, business_approved_by, business_reject_reason
     FROM users
     WHERE business_status = ?
     ORDER BY business_requested_at DESC`
  ).all(status);
}
function approveBusinessRequest(userId, byAdminId) {
  const u = findUserById(userId);
  if (!u) throw new Error('Пользователь не найден');
  db.prepare(`UPDATE users SET business_status='approved', business_approved_at=?,
                business_approved_by=?, business_reject_reason=NULL WHERE id=?`)
    .run(now(), byAdminId, userId);
}
function rejectBusinessRequest(userId, byAdminId, reason) {
  db.prepare(`UPDATE users SET business_status='rejected', business_approved_at=?,
                business_approved_by=?, business_reject_reason=? WHERE id=?`)
    .run(now(), byAdminId, String(reason || '').slice(0, 500), userId);
}
function revokeBusinessAccess(userId, byAdminId, reason) {
  db.prepare(`UPDATE users SET business_status='rejected', business_approved_at=?,
                business_approved_by=?, business_reject_reason=? WHERE id=?`)
    .run(now(), byAdminId, String(reason || 'отозван').slice(0, 500), userId);
}

// ── Multi-tenant AWO helpers (Шаг 1) ────────────────────────────────────
function _rowToTenant(r) {
  if (!r) return null;
  return { ...r, test_mode: !!r.test_mode };
}
function listTenants() {
  return db.prepare('SELECT * FROM tenants ORDER BY created_at ASC').all().map(_rowToTenant);
}
function listTenantsForOwner(ownerId) {
  return db.prepare('SELECT * FROM tenants WHERE owner_id=? ORDER BY created_at ASC')
    .all(ownerId).map(_rowToTenant);
}

// Школы, к которым у юзера есть доступ как у владельца ИЛИ как у
// со-админа. Используется в self-service UI «Мои школы».
function listTenantsForUser(userId) {
  return db.prepare(
    `SELECT t.* FROM tenants t
     WHERE t.owner_id = ?
        OR EXISTS (SELECT 1 FROM tenant_admins ta
                   WHERE ta.tenant_id = t.id AND ta.user_id = ?)
     ORDER BY t.created_at ASC`
  ).all(userId, userId).map(_rowToTenant);
}

function isTenantOwnerOrAdmin(tenantId, userId) {
  if (!tenantId || !userId) return false;
  const t = db.prepare('SELECT owner_id FROM tenants WHERE id=?').get(tenantId);
  if (!t) return false;
  if (t.owner_id === userId) return true;
  return !!db.prepare(
    'SELECT 1 FROM tenant_admins WHERE tenant_id=? AND user_id=?'
  ).get(tenantId, userId);
}

function listTenantAdmins(tenantId) {
  return db.prepare(
    `SELECT u.id, u.name, u.phone, u.avatar, ta.added_at, ta.added_by,
            (SELECT inv.name FROM users inv WHERE inv.id = ta.added_by) AS added_by_name
     FROM tenant_admins ta
     JOIN users u ON u.id = ta.user_id
     WHERE ta.tenant_id = ?
     ORDER BY ta.added_at ASC`
  ).all(tenantId).map(r => ({ ...r, avatar: avatarPayload(r.id, r.avatar) }));
}

function addTenantAdmin(tenantId, userId, addedBy) {
  const t = db.prepare('SELECT owner_id FROM tenants WHERE id=?').get(tenantId);
  if (!t) throw new Error('Tenant not found');
  if (t.owner_id === userId) throw new Error('Владелец уже имеет доступ к школе');
  const u = db.prepare('SELECT id, is_deleted FROM users WHERE id=?').get(userId);
  if (!u || u.is_deleted) throw new Error('Пользователь не найден');
  db.prepare(
    `INSERT OR IGNORE INTO tenant_admins (tenant_id, user_id, added_by, added_at)
     VALUES (?, ?, ?, ?)`
  ).run(tenantId, userId, addedBy || null, now());
  return listTenantAdmins(tenantId);
}

function removeTenantAdmin(tenantId, userId) {
  db.prepare('DELETE FROM tenant_admins WHERE tenant_id=? AND user_id=?').run(tenantId, userId);
}
function getTenantById(id) {
  return _rowToTenant(db.prepare('SELECT * FROM tenants WHERE id=?').get(id));
}
function getTenantByToken(token) {
  if (!token) return null;
  return _rowToTenant(db.prepare('SELECT * FROM tenants WHERE awo_webhook_token=?').get(token));
}
function createTenant({ name, ownerId }) {
  const id = 'tnt_' + crypto.randomBytes(6).toString('hex');
  const token  = crypto.randomBytes(24).toString('hex');
  const secret = crypto.randomBytes(32).toString('hex');
  const t = now();
  db.prepare(`INSERT INTO tenants
    (id, name, owner_id, awo_webhook_token, awo_join_secret,
     chat_excludes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'слушатель,запись', ?, ?)`)
    .run(id, name, ownerId, token, secret, t, t);
  return getTenantById(id);
}
function updateTenant(id, fields) {
  const allowed = ['name','account_id','test_mode','test_course','chat_excludes'];
  const keys = Object.keys(fields).filter(k => allowed.includes(k));
  if (!keys.length) return getTenantById(id);
  const vals = {};
  for (const k of keys) {
    vals[k] = k === 'test_mode' ? (fields[k] ? 1 : 0) : (fields[k] ?? null);
  }
  vals.id = id;
  vals.updated_at = now();
  db.prepare(`UPDATE tenants SET ${keys.map(k=>`${k}=@${k}`).join(',')}, updated_at=@updated_at WHERE id=@id`)
    .run(vals);
  return getTenantById(id);
}
function deleteTenant(id) {
  db.transaction(() => {
    db.prepare('DELETE FROM tenants WHERE id=?').run(id);
    // Связанные данные оставляем — лог истории; новый tenant с тем же id
    // не появится (id уникальные). Если хочется очистить — отдельная ручка.
  })();
}
function rotateTenantToken(id) {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('UPDATE tenants SET awo_webhook_token=?, updated_at=? WHERE id=?')
    .run(token, now(), id);
  return getTenantById(id);
}

function getAwoSettings() {
  const accountId = getSchoolUserId();
  const account   = findUserById(accountId);
  return {
    test_mode:    !!getSetting('awo_test_mode', false),
    test_course:  getSetting('awo_test_course', ''),
    chat_excludes: getSetting('awo_chat_excludes', 'слушатель,запись'),
    school_account: account ? {
      id:     account.id,
      name:   account.name,
      avatar: account.avatar,
      phone:  account.phone,
      is_default: account.id === SCHOOL_USER_ID,
    } : null,
  };
}

function setAwoSettings({ test_mode, test_course, chat_excludes, school_account_id }) {
  if (test_mode != null)     setSetting('awo_test_mode', !!test_mode);
  if (test_course != null)   setSetting('awo_test_course', String(test_course || ''));
  if (chat_excludes != null) setSetting('awo_chat_excludes', String(chat_excludes || ''));
  if (school_account_id !== undefined) {
    if (!school_account_id || school_account_id === SCHOOL_USER_ID) {
      setSetting('awo_school_account_id', null);
    } else {
      const u = findUserById(school_account_id);
      if (!u) throw new Error('Пользователь не найден');
      if (u.is_blocked) throw new Error('Пользователь заблокирован');
      setSetting('awo_school_account_id', school_account_id);
    }
  }
  return getAwoSettings();
}

module.exports = {
  now,
  SYSTEM_USER_ID,
  SCHOOL_USER_ID,
  createUser, findUserByPhone, findUserById, updateUser, deleteUserAccount, hardDeleteUserAccount,
  tryRestoreFromGrace, expireDeletionGrace, getDeletionGraceInfo,
  collectLiveS3Keys, sweepOrphanS3Media,
  getContacts, addContact, removeContact, addSystemContactFor, getContactOwners, getContactIds,
  createGroup, updateGroup, addGroupMember, removeGroupMember, getGroupMembers,
  acceptGroupInvite, declineGroupInvite, isPendingMember, getInviterForPendingMember,
  joinGroupViaInvite, isGroupAdmin, setMemberAdmin, setGroupHistoryVisibility,
  archiveConversation, unarchiveConversation,
  getOrCreateDirectConversation, getOrCreateSelfChat, acceptRequest, declineRequest, deleteConversation,
  getConversationById, getConversationsForUser, getConversationMembers, isMember,
  getPinnedCount, pinConversation, unpinConversation,
  getMessages, createMessage, createSystemEventMessage, updateMessageStatus, markMessagesReadUpTo, getMessageById,
  scheduleMessage, getScheduledMessage, listScheduledMessages, cancelScheduledMessage, updateScheduledMessage,
  popDueScheduledMessages, deleteScheduledMessageById,
  getLinkPreviewCached, setLinkPreviewCached, updateMessageLinkPreview,
  pinMessage, unpinMessage, getPinnedMessage, forwardMessageToChats,
  pushSubscribe, pushUnsubscribe, getPushSubscriptions, removePushSubscriptions,
  clearConversationMessages, editMessage, deleteMessage, hardDeleteMessage,
  getMediaMessages, searchMessages, searchAllMessages,
  getCalls, createCall,
  setOnline, getPresence,
  toggleReaction, getMessageReactions, getReactionsForMessages,
  blockUser, unblockUser, getBlockedUsers, isBlocked, updateContactNotes, updateContactNickname,
  getReferralCount, getInvitedCounts, findUserByInviteCode, markReferralFromInviter,
  findUserByEmail, findUserByEmailOrPhone, getSchoolAccount, getSchoolUserId,
  getTotalUnreadFor,
  // AWO integration
  createSchoolInvite, findSchoolInviteByCode, findActiveSchoolInviteByEmail, markSchoolInviteUsed,
  addUserToChat,
  awoIsProcessed, awoMarkProcessed, awoListProcessed,
  setAwoCourseChat, deleteAwoCourseChat, getChatForCourse, listAwoCourseChats, listAllGroupChats,
  getSetting, setSetting, getAwoSettings, setAwoSettings,
  // Multi-tenant AWO (Шаг 1)
  DEFAULT_TENANT_ID,
  listTenants, listTenantsForOwner, listTenantsForUser, getTenantById, getTenantByToken,
  isTenantOwnerOrAdmin, listTenantAdmins, addTenantAdmin, removeTenantAdmin,
  createTenant, updateTenant, deleteTenant, rotateTenantToken,
  // Business access (Шаг 4.2)
  requestBusinessAccess, cancelBusinessRequest, listBusinessRequests,
  approveBusinessRequest, rejectBusinessRequest, revokeBusinessAccess,
  isTestUsersEnabled, setTestUsersEnabled, getTestUserIds,
  seedTestUsers, clearTestUsers,
  extendSuper, setSuperExpiry, processReferral, confirmReferralIfPending, checkAndExpireSuper,
  // Moments
  getMomentFeed, getMyMoments, getMomentById, getActiveMoment, getActiveMoments, getActiveMomentCount,
  createMoment, updateMoment, archiveMoment, restoreMoment, deleteMomentForever, reorderMoments,
  upsertMomentReaction, deleteMomentReaction, getMomentReactions, getUserMomentReaction,
  getSavedMoments, getMomentReactorsList,
  addMomentView, getDisciplinesCloud,
  // Admin
  searchUsers,
  // Reports
  createReport, getReports, resolveReport,
  createFeedback, getFeedbacks, resolveFeedback, countOpenFeedbacks,
  // Waitlist
  addToWaitlist, getWaitlist, countPendingWaitlist,
  markWaitlistNotified, unmarkWaitlistNotified, deleteWaitlistEntry,
  // System (HEY-заведующий)
  getSystemMoments, getSystemBroadcasts, deleteBroadcast, editBroadcast,
  listOrphanSystemMessages, deleteSystemMessage,
  // Admin
  getAdminStats, getAdminUsers, getAdminUserById,
  getAdminGroups, getAdminGroupDetail,
  adminResetPassword, adminBlockUser, adminUnblockUser,
  adminMakeAdmin, adminRevokeAdmin, makeUserSuper, revokeUserSuper,
  getAdminMoments, adminDeleteMoment,
  logAdminAction, getAdminLogs,
};
