const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const { v4: uuid } = require('uuid');
const path = require('path');
const fs   = require('fs');

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
try { db.exec('CREATE INDEX IF NOT EXISTS idx_messages_broadcast ON messages(broadcast_id)'); } catch {}

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
try { db.exec('ALTER TABLE users ADD COLUMN super_bonus_claimed INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN super_expires_at INTEGER'); } catch {}
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

// Обработанные счета АВО (идемпотентность)
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

function getReferralCount(userId) {
  return db.prepare('SELECT COUNT(*) as c FROM referrals WHERE inviter_id=?').get(userId)?.c ?? 0;
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
function avatarPayload(userId, rawAvatar) {
  if (!rawAvatar) return null;
  if (rawAvatar.startsWith('data:image/')) return `/api/avatars/${userId}`;
  return rawAvatar; // URL / emoji / one-char letter — пропускаем как есть
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
  const allowed = ['name','phone','birthday','avatar','bio','headline','email'];
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

function getSchoolAccount() {
  return findUserById(SCHOOL_USER_ID);
}

// ── Contacts ───────────────────────────────────────────────────────────────

function getContacts(ownerId) {
  const rows = db.prepare(
    `SELECT u.*, c.nickname, c.notes, p.online, p.last_seen
     FROM contacts c
     JOIN users u ON u.id = c.contact_id
     LEFT JOIN presence p ON p.user_id = c.contact_id
     WHERE c.owner_id = ?`
  ).all(ownerId);
  return normalizeAvatars(
    rows.map(({ password, ...r }) => ({ ...r, online: !!r.online, is_deleted: !!r.is_deleted }))
  );
}

function deleteUserAccount(userId) {
  const t = now();
  // phone имеет NOT NULL + UNIQUE — нельзя выставлять NULL.
  // Подставляем уникальный плейсхолдер, чтобы освободить «настоящий» телефон
  // для повторной регистрации и не нарушать constraint.
  const placeholderPhone = `_deleted_${userId.replace(/-/g,'').slice(0,12)}_${t}`;
  db.transaction(() => {
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
    // Archive all active moments so they vanish from feeds
    db.prepare(
      `UPDATE moments SET status='archived' WHERE user_id=? AND status='active'`
    ).run(userId);
  })();
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

function createGroup({ creatorId, name, icon, memberIds }) {
  const id = uuid(), t = now();
  const all = [creatorId, ...memberIds.filter(id => id !== creatorId)];
  db.transaction(() => {
    db.prepare(`INSERT INTO conversations (id,type,name,icon,admin_id,created_at) VALUES (?,?,?,?,?,?)`)
      .run(id, 'group', name, icon || null, creatorId, t);
    const ins = db.prepare(`INSERT OR IGNORE INTO members (conversation_id,user_id,joined_at) VALUES (?,?,?)`);
    all.forEach(uid => ins.run(id, uid, t));
  })();
  return { id };
}

function updateGroup(convId, adminId, fields) {
  const conv = db.prepare('SELECT admin_id FROM conversations WHERE id=?').get(convId);
  if (conv?.admin_id !== adminId) throw new Error('Not authorized');
  const keys = Object.keys(fields).filter(k => ['name','icon'].includes(k));
  if (!keys.length) return;
  db.prepare(`UPDATE conversations SET ${keys.map(k=>`${k}=@${k}`).join(',')} WHERE id=@id`)
    .run({ ...fields, id: convId });
}

function addGroupMember(convId, requesterId, userId) {
  const conv = db.prepare('SELECT admin_id FROM conversations WHERE id=?').get(convId);
  if (conv?.admin_id !== requesterId) throw new Error('Not authorized');
  db.prepare(`INSERT OR IGNORE INTO members (conversation_id,user_id,joined_at) VALUES (?,?,?)`)
    .run(convId, userId, now());
}

function removeGroupMember(convId, requesterId, userId) {
  const conv = db.prepare('SELECT admin_id FROM conversations WHERE id=?').get(convId);
  if (conv?.admin_id !== requesterId && requesterId !== userId) throw new Error('Not authorized');
  db.prepare('DELETE FROM members WHERE conversation_id=? AND user_id=?').run(convId, userId);
}

function getGroupMembers(convId) {
  return db.prepare(
    `SELECT u.id, u.name, u.avatar, u.phone, p.online
     FROM members m JOIN users u ON u.id=m.user_id
     LEFT JOIN presence p ON p.user_id=m.user_id
     WHERE m.conversation_id=?`
  ).all(convId).map(r => ({ ...r, online: !!r.online }));
}

function getMediaMessages(convId) {
  return db.prepare(
    `SELECT m.*, u.name AS sender_name FROM messages m
     JOIN users u ON u.id=m.sender_id
     WHERE m.conversation_id=? AND m.attachment IS NOT NULL
     ORDER BY m.created_at DESC`
  ).all(convId).map(_parseMsg);
}

function searchMessages(convId, query) {
  return db.prepare(
    `SELECT m.*, u.name AS sender_name FROM messages m
     JOIN users u ON u.id=m.sender_id
     WHERE m.conversation_id=? AND m.text LIKE ?
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

  // Determine if this is a request (neither is in the other's contacts)
  const u1inU2 = !!db.prepare('SELECT 1 FROM contacts WHERE owner_id=? AND contact_id=?').get(userId2, userId1);
  const u2inU1 = !!db.prepare('SELECT 1 FROM contacts WHERE owner_id=? AND contact_id=?').get(userId1, userId2);
  const requestFrom = (u1inU2 || u2inU1) ? null : userId1;

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

function getConversationsForUser(userId) {
  const convIds = db.prepare(
    'SELECT conversation_id FROM members WHERE user_id=?'
  ).all(userId).map(r => r.conversation_id);
  if (!convIds.length) return [];

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
  const lastMap = {}; // convId -> { text, created_at, sender_id }
  db.prepare(
    `SELECT m.conversation_id, m.text, m.created_at, m.sender_id
     FROM messages m
     JOIN (
       SELECT conversation_id, MAX(created_at) AS max_at
       FROM messages WHERE conversation_id IN (${ph})
       GROUP BY conversation_id
     ) t ON m.conversation_id = t.conversation_id AND m.created_at = t.max_at
     GROUP BY m.conversation_id`
  ).all(...convIds)
    .forEach(r => { lastMap[r.conversation_id] = r; });

  // 1 query: unread counts
  const unreadMap = getUnreadCounts(userId, convIds);

  // Collect blocked ids (both directions)
  const blockedIds = new Set(getBlockedByIds(userId));
  const pinnedSet  = new Set(getPinnedConvIds(userId));

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

    const partnerUser = conv.type === 'direct' && partnerId ? usersMap[partnerId] : null;
    return {
      id: convId, type: conv.type, name, icon: conv.icon || null,
      admin_id: conv.admin_id || null, partner_id: partnerId,
      avatar: partnerAvatar,
      partner_is_deleted: !!(partnerUser?.is_deleted),
      partner_is_blocked: !!(partnerUser?.is_blocked),
      partner_is_super:   !!(partnerUser?.is_super),
      partner_is_system:  !!(partnerUser?.is_system),
      partner_online:     !!(partnerId && presenceMap[partnerId]?.online),
      partner_last_seen:  partnerId ? (presenceMap[partnerId]?.last_seen || null) : null,
      last_text: isRecipient ? null : (last?.text || null),
      last_at:   last?.created_at || conv.created_at,
      last_sender_id: isRecipient ? null : (last?.sender_id || null),
      unread_count: isRecipient ? 0 : (unreadMap[convId] || 0),
      is_request: isRequest,
      request_from: conv.request_from || null,
      is_pinned: pinnedSet.has(convId),
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
  return db.prepare('SELECT user_id FROM members WHERE conversation_id=?')
    .all(convId).map(r => r.user_id);
}

function isMember(convId, userId) {
  return !!db.prepare('SELECT 1 FROM members WHERE conversation_id=? AND user_id=?').get(convId, userId);
}

// ── Messages ───────────────────────────────────────────────────────────────

function _parseMsg(m) {
  if (!m) return null;
  return { ...m, attachment: m.attachment ? JSON.parse(m.attachment) : null };
}

// Возвращает короткий snippet для цитаты — текст до 120 симв + тип/превью вложения
function _replySnippet(replyToId) {
  if (!replyToId) return null;
  const r = db.prepare(
    `SELECT m.id, m.sender_id, m.text, m.attachment, u.name AS sender_name
     FROM messages m JOIN users u ON u.id=m.sender_id
     WHERE m.id=?`
  ).get(replyToId);
  if (!r) return null;
  let attType = null, attUrl = null;
  try {
    if (r.attachment) {
      const att = JSON.parse(r.attachment);
      attType = att?.type || null;
      if (attType === 'image')  attUrl = att.url || null;
      if (attType === 'images') attUrl = (att.urls && att.urls[0]) || null;
    }
  } catch {}
  return {
    id: r.id, sender_id: r.sender_id, sender_name: r.sender_name,
    text: r.text ? r.text.slice(0, 120) : null,
    attachment_type: attType,
    attachment_url:  attUrl,
  };
}

function getMessages(convId, before, limit = 50) {
  // Не таскаем avatar инлайн — он берётся через /api/avatars/:userId с долгим кешем.
  // Возвращаем только sender_avatar как ссылку, чтобы UI мог рендерить <img src>.
  const rows = db.prepare(
    `SELECT m.*, u.name AS sender_name, u.id AS _sender_id_for_avatar,
            CASE
              WHEN u.avatar IS NULL OR u.avatar = '' THEN NULL
              WHEN u.avatar LIKE 'data:image/%' THEN '/api/avatars/' || u.id
              ELSE u.avatar
            END AS sender_avatar
     FROM messages m JOIN users u ON u.id=m.sender_id
     WHERE m.conversation_id=? AND m.created_at<?
     ORDER BY m.created_at ASC
     LIMIT ?`
  ).all(convId, before, limit);
  return rows.map(r => {
    delete r._sender_id_for_avatar;
    const parsed = _parseMsg(r);
    if (parsed && parsed.reply_to_id) parsed.reply_to = _replySnippet(parsed.reply_to_id);
    return parsed;
  });
}

function createMessage({ conversationId, senderId, text, attachment, replyToId, broadcastId }) {
  const msg = { id: uuid(), conversation_id: conversationId, sender_id: senderId,
    text: text || null,
    attachment: attachment ? JSON.stringify(attachment) : null,
    status: 'sent', created_at: now(), edited_at: null,
    reply_to_id: replyToId || null,
    broadcast_id: broadcastId || null };
  db.prepare(
    `INSERT INTO messages (id,conversation_id,sender_id,text,attachment,status,created_at,reply_to_id,broadcast_id)
     VALUES (@id,@conversation_id,@sender_id,@text,@attachment,@status,@created_at,@reply_to_id,@broadcast_id)`
  ).run(msg);
  const parsed = _parseMsg(msg);
  if (parsed && parsed.reply_to_id) parsed.reply_to = _replySnippet(parsed.reply_to_id);
  return parsed;
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
  return _parseMsg(db.prepare('SELECT * FROM messages WHERE id=?').get(id));
}

function clearConversationMessages(convId) {
  db.prepare('DELETE FROM messages WHERE conversation_id=?').run(convId);
}

function editMessage(id, text) {
  const ts = now();
  db.prepare('UPDATE messages SET text=?, edited_at=? WHERE id=?').run(text, ts, id);
  return _parseMsg(db.prepare('SELECT * FROM messages WHERE id=?').get(id));
}

function deleteMessage(id) {
  db.prepare('DELETE FROM messages WHERE id=?').run(id);
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

function getMessageReactions(messageId) {
  const rows = db.prepare('SELECT emoji, user_id FROM reactions WHERE message_id=?').all(messageId);
  const grouped = {};
  rows.forEach(r => {
    if (!grouped[r.emoji]) grouped[r.emoji] = [];
    grouped[r.emoji].push(r.user_id);
  });
  return grouped;
}

function getReactionsForMessages(messageIds) {
  if (!messageIds.length) return {};
  const ph = messageIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT message_id, emoji, user_id FROM reactions WHERE message_id IN (${ph})`
  ).all(...messageIds);
  const result = {};
  rows.forEach(r => {
    if (!result[r.message_id]) result[r.message_id] = {};
    if (!result[r.message_id][r.emoji]) result[r.message_id][r.emoji] = [];
    result[r.message_id][r.emoji].push(r.user_id);
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
  }
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
  if (!contactIds.length) return { items: [], hasMore: false };
  const blockedIds = getBlockedByIds(userId);
  const visible = contactIds.filter(id => !blockedIds.includes(id));
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

  // All view counts in one query
  const viewRows = db.prepare(
    `SELECT moment_id, COUNT(*) as cnt
     FROM moment_views WHERE moment_id IN (${ph})
     GROUP BY moment_id`
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
  const views = db.prepare(
    `SELECT mv.user_id AS id, 'see' AS reaction, MAX(mv.viewed_at) AS created_at, u.name, u.avatar
     FROM moment_views mv JOIN users u ON u.id=mv.user_id
     WHERE mv.moment_id=? AND u.is_blocked=0 AND u.is_deleted=0
     GROUP BY mv.user_id
     ORDER BY created_at DESC`
  ).all(momentId);
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
  return { users, blocked, admins, moments, activeMoments, reactions, messages, openReports, activeUsers };
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

function editBroadcast(broadcastId, newText) {
  const t = now();
  const info = db.prepare(
    `UPDATE messages SET text=?, edited_at=? WHERE broadcast_id=? AND sender_id=?`
  ).run(newText, t, broadcastId, SYSTEM_USER_ID);
  return info.changes;
}

// Search users by name or phone (для контактов; case-insensitive в том числе и для кириллицы)
function searchUsers(query, excludeUserId) {
  const q = `%${(query || '').toLowerCase()}%`;
  const rows = db.prepare(
    `SELECT u.id, u.name, u.avatar, u.phone,
            p.online
     FROM users u
     LEFT JOIN presence p ON p.user_id = u.id
     WHERE (LOWER(u.name) LIKE ? OR LOWER(u.phone) LIKE ?)
       AND u.is_blocked = 0
       AND u.id != ?
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

function getAdminUsers({ search, filter } = {}) {
  let where = '1=1';
  const params = [];
  if (search) {
    where += ' AND (u.name LIKE ? OR u.phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (filter === 'blocked')  { where += ' AND u.is_blocked=1'; }
  if (filter === 'admins')   { where += ' AND u.is_admin=1'; }
  const rows = db.prepare(
    `SELECT u.id, u.name, u.phone, u.avatar, u.created_at, u.is_admin, u.is_super, u.is_blocked,
            u.blocked_at, u.blocked_by, u.must_change_password,
            p.online, p.last_seen,
            SUM(CASE WHEN m.status='active'   THEN 1 ELSE 0 END) AS active_moments,
            SUM(CASE WHEN m.status!='deleted' THEN 1 ELSE 0 END) AS total_moments
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
            (SELECT COUNT(*) FROM moment_reactions mr JOIN moments m ON m.id=mr.moment_id WHERE m.user_id=u.id) AS total_reactions_received
     FROM users u
     LEFT JOIN presence p ON p.user_id=u.id
     WHERE u.id=?`
  ).get(id);
  if (!u) return null;
  const { password: _, ...safe } = u;
  return { ...safe, online: !!safe.online, is_admin: !!safe.is_admin, is_super: !!safe.is_super, is_blocked: !!safe.is_blocked, must_change_password: !!safe.must_change_password };
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
    `SELECT m.*, u.name AS author_name, u.phone AS author_phone, u.is_super AS author_is_super
     FROM moments m JOIN users u ON u.id=m.user_id
     WHERE ${where}
     ORDER BY m.created_at DESC LIMIT 200`
  ).all(...params);
  return _withStatsBatch(rows.map(_parseMoment));
}

function adminDeleteMoment(momentId, adminId, reason) {
  db.transaction(() => {
    db.prepare('DELETE FROM moment_reactions WHERE moment_id=?').run(momentId);
    db.prepare('DELETE FROM moment_views WHERE moment_id=?').run(momentId);
    db.prepare("UPDATE moments SET status='deleted', updated_at=? WHERE id=?").run(now(), momentId);
  })();
  logAdminAction({ adminId, action: 'delete_moment', targetMomentId: momentId, reason });
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

function extendSuper(userId, months) {
  const user = findUserById(userId);
  const n = now();
  const base = (user.super_expires_at && user.super_expires_at > n) ? user.super_expires_at : n;
  const newExpiry = base + months * 30 * 24 * 3600;
  db.prepare('UPDATE users SET is_super=1, super_expires_at=? WHERE id=?').run(newExpiry, userId);
  return newExpiry;
}

function processReferral(inviterId) {
  db.prepare('UPDATE users SET invited_count = invited_count + 1 WHERE id=?').run(inviterId);
  const inviter = findUserById(inviterId);
  const count = inviter.invited_count;
  const result = { superGranted: false, newBadge: null, invitedCount: count };

  // 3-й приглашённый — разовый бонус 3 мес СУПЕР
  if (count === 3 && !inviter.super_bonus_claimed) {
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

function createSchoolInvite({ bound_email, bound_phone, course }) {
  const code = _makeShortCode(16);
  const email = bound_email ? String(bound_email).trim().toLowerCase() : null;
  db.prepare(`INSERT INTO school_invites
    (code, issued_by, bound_email, bound_phone, course, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(code, SCHOOL_USER_ID, email, bound_phone || null, course || null, now());
  return { code, issued_by: SCHOOL_USER_ID, bound_email: email, bound_phone, course };
}

function findSchoolInviteByCode(code) {
  if (!code) return null;
  return db.prepare('SELECT * FROM school_invites WHERE code=?').get(code) || null;
}

function findActiveSchoolInviteByEmail(email) {
  if (!email) return null;
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

function awoIsProcessed(id_account) {
  if (!id_account) return false;
  return !!db.prepare('SELECT 1 FROM awo_processed WHERE id_account=?').get(String(id_account));
}

function awoMarkProcessed({ id_account, email, phone, course, invite_code, result, raw_payload }) {
  try {
    db.prepare(`INSERT INTO awo_processed
      (id_account, processed_at, email, phone, course, invite_code, result, raw_payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(String(id_account), now(),
           email ? String(email).toLowerCase() : null,
           phone || null, course || null, invite_code || null,
           result || null, raw_payload ? JSON.stringify(raw_payload).slice(0, 8000) : null);
  } catch (e) {
    // Уже есть — игнорируем (race condition)
    if (e.code !== 'SQLITE_CONSTRAINT_PRIMARYKEY') throw e;
  }
}

function awoListProcessed(limit = 100) {
  return db.prepare(
    `SELECT id_account, processed_at, email, phone, course, invite_code, result
     FROM awo_processed ORDER BY processed_at DESC LIMIT ?`
  ).all(limit);
}

// ── AWO course ↔ group chat mapping ─────────────────────────────────────────────

function setAwoCourseChat(course, chatId) {
  if (!course || !chatId) throw new Error('course and chatId required');
  db.prepare(`INSERT INTO awo_course_chats (course, chat_id, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT(course) DO UPDATE SET chat_id=excluded.chat_id`)
    .run(String(course).trim(), chatId, now());
}

function deleteAwoCourseChat(course) {
  db.prepare('DELETE FROM awo_course_chats WHERE course=? COLLATE NOCASE').run(course);
}

// Подбор чата под название курса из АВО.
// Логика:
//   1. Берём название `goods` от АВО (например "BL School — Zoom Участник, поток 5")
//   2. Проверяем глобальные исключающие слова из настроек (например "слушатель, запись")
//      — если совпало хоть одно → доступ к чату НЕ даём (вернём null)
//   3. Ищем маппинг где сохранённый `course` входит подстрокой в `goods`
//      (case-insensitive). Например маппинг "Zoom Участник" сматчит
//      "BL School — Zoom Участник, поток 5"
function getChatForCourse(goods) {
  if (!goods) return null;
  const goodsLower = String(goods).trim().toLowerCase();
  if (!goodsLower) return null;

  // Глобальные стоп-слова
  const excludeRaw = getSetting('awo_chat_excludes', 'слушатель,запись') || '';
  const excludes = String(excludeRaw).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  for (const ex of excludes) {
    if (goodsLower.includes(ex)) {
      console.log(`[AWO] курс "${goods}" содержит стоп-слово "${ex}" — чат не назначаем`);
      return null;
    }
  }

  // Сначала пробуем точный матч (быстрый путь, обратная совместимость)
  const exact = db.prepare('SELECT chat_id FROM awo_course_chats WHERE course=? COLLATE NOCASE')
    .get(String(goods).trim());
  if (exact) return exact.chat_id;

  // Затем — подстрочный матч: маппинг с самым длинным совпавшим паттерном выигрывает
  const all = db.prepare('SELECT course, chat_id FROM awo_course_chats').all();
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

function listAwoCourseChats() {
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

function getAwoSettings() {
  return {
    test_mode:    !!getSetting('awo_test_mode', false),
    test_course:  getSetting('awo_test_course', ''),
    chat_excludes: getSetting('awo_chat_excludes', 'слушатель,запись'),
  };
}

function setAwoSettings({ test_mode, test_course, chat_excludes }) {
  if (test_mode != null)     setSetting('awo_test_mode', !!test_mode);
  if (test_course != null)   setSetting('awo_test_course', String(test_course || ''));
  if (chat_excludes != null) setSetting('awo_chat_excludes', String(chat_excludes || ''));
  return getAwoSettings();
}

module.exports = {
  now,
  SYSTEM_USER_ID,
  SCHOOL_USER_ID,
  createUser, findUserByPhone, findUserById, updateUser, deleteUserAccount,
  getContacts, addContact, removeContact, addSystemContactFor, getContactOwners, getContactIds,
  createGroup, updateGroup, addGroupMember, removeGroupMember, getGroupMembers,
  getOrCreateDirectConversation, getOrCreateSelfChat, acceptRequest, declineRequest,
  getConversationById, getConversationsForUser, getConversationMembers, isMember,
  getPinnedCount, pinConversation, unpinConversation,
  getMessages, createMessage, updateMessageStatus, markMessagesReadUpTo, getMessageById,
  clearConversationMessages, editMessage, deleteMessage,
  getMediaMessages, searchMessages, searchAllMessages,
  getCalls, createCall,
  setOnline, getPresence,
  toggleReaction, getMessageReactions, getReactionsForMessages,
  blockUser, unblockUser, getBlockedUsers, isBlocked, updateContactNotes,
  getReferralCount, findUserByInviteCode,
  findUserByEmail, findUserByEmailOrPhone, getSchoolAccount,
  // AWO integration
  createSchoolInvite, findSchoolInviteByCode, findActiveSchoolInviteByEmail, markSchoolInviteUsed,
  addUserToChat,
  awoIsProcessed, awoMarkProcessed, awoListProcessed,
  setAwoCourseChat, deleteAwoCourseChat, getChatForCourse, listAwoCourseChats, listAllGroupChats,
  getSetting, setSetting, getAwoSettings, setAwoSettings,
  extendSuper, processReferral, checkAndExpireSuper,
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
  // Waitlist
  addToWaitlist, getWaitlist,
  // System (HEY-заведующий)
  getSystemMoments, getSystemBroadcasts, deleteBroadcast, editBroadcast,
  // Admin
  getAdminStats, getAdminUsers, getAdminUserById,
  adminResetPassword, adminBlockUser, adminUnblockUser,
  adminMakeAdmin, adminRevokeAdmin, makeUserSuper, revokeUserSuper,
  getAdminMoments, adminDeleteMoment,
  logAdminAction, getAdminLogs,
};
