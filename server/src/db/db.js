const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const { v4: uuid } = require('uuid');
const path = require('path');
const fs   = require('fs');

const DATA_DIR = path.join(__dirname, '../../data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'hey.db'));

// WAL mode: concurrent reads, non-blocking writes
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_moments_user ON moments(user_id, status)`); } catch {}

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

// ── Admin columns (safe migrations) ──────────────────────────────────────────
try { db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN blocked_at INTEGER'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN blocked_by TEXT'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0'); } catch {}
try { db.exec(`CREATE TABLE IF NOT EXISTS admin_logs (
  id               TEXT PRIMARY KEY,
  admin_id         TEXT NOT NULL,
  action           TEXT NOT NULL,
  target_user_id   TEXT,
  target_moment_id TEXT,
  reason           TEXT,
  created_at       INTEGER NOT NULL
)`); } catch {}

// Back-fill invite codes for existing users without one (safe — users table now exists)
db.prepare("SELECT id FROM users WHERE invite_code IS NULL").all().forEach(u => {
  const code = u.id.replace(/-/g,'').slice(0,10).toUpperCase();
  db.prepare("UPDATE users SET invite_code=? WHERE id=?").run(code, u.id);
});

function now() { return Math.floor(Date.now() / 1000); }

// ── Users ──────────────────────────────────────────────────────────────────

const stmtInsertUser = db.prepare(
  `INSERT INTO users (id,phone,name,password,avatar,birthday,created_at,invite_code,referral_by)
   VALUES (@id,@phone,@name,@password,@avatar,@birthday,@created_at,@invite_code,@referral_by)`
);
const stmtInsertPresence = db.prepare(
  `INSERT INTO presence (user_id,online,last_seen) VALUES (@user_id,0,@last_seen)`
);

function makeInviteCode(id) {
  return id.replace(/-/g,'').slice(0,10).toUpperCase();
}

function createUser({ phone, name, password, birthday, avatar, inviteCode }) {
  const id = uuid();
  const referredBy = inviteCode
    ? (db.prepare('SELECT id FROM users WHERE invite_code=?').get(inviteCode)?.id || null)
    : null;
  const user = { id, phone, name, password: bcrypt.hashSync(password, 10),
    avatar: avatar || null, birthday: birthday || null, created_at: now(),
    invite_code: makeInviteCode(id), referral_by: referredBy };
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

function updateUser(id, fields) {
  const allowed = ['name','phone','birthday','avatar'];
  const sets = Object.keys(fields).filter(k => allowed.includes(k));
  if (!sets.length) return findUserById(id);
  const sql = `UPDATE users SET ${sets.map(k=>`${k}=@${k}`).join(',')} WHERE id=@id`;
  db.prepare(sql).run({ ...fields, id });
  return findUserById(id);
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
  return rows.map(({ password, ...r }) => ({ ...r, online: !!r.online }));
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
  db.prepare('DELETE FROM contacts WHERE owner_id=? AND contact_id=?').run(ownerId, contactId);
}

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

function getOrCreateDirectConversation(userId1, userId2) {
  const existing = db.prepare(
    `SELECT c.id FROM conversations c
     JOIN members m1 ON m1.conversation_id=c.id AND m1.user_id=?
     JOIN members m2 ON m2.conversation_id=c.id AND m2.user_id=?
     WHERE c.type='direct'
     AND (SELECT COUNT(*) FROM members WHERE conversation_id=c.id)=2
     LIMIT 1`
  ).get(userId1, userId2);
  if (existing) return existing;

  const id = uuid();
  db.transaction(() => {
    db.prepare(`INSERT INTO conversations (id,type,created_at) VALUES (?,?,?)`).run(id,'direct',now());
    db.prepare(`INSERT INTO members (conversation_id,user_id,joined_at) VALUES (?,?,?)`).run(id,userId1,now());
    db.prepare(`INSERT INTO members (conversation_id,user_id,joined_at) VALUES (?,?,?)`).run(id,userId2,now());
  })();
  return { id };
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

  return convIds.map(convId => {
    const conv = convsMap[convId];
    if (!conv) return null;

    let name = conv.name, partnerId = null, partnerAvatar = null;
    if (conv.type === 'direct') {
      partnerId = partnerIdMap[convId] || null;
      const partner = partnerId ? usersMap[partnerId] : null;
      name = (partnerId && nickMap[partnerId]) || partner?.name || 'Диалог';
      partnerAvatar = partner?.avatar || null;
    }

    const last = lastMap[convId];
    return { id: convId, type: conv.type, name, icon: conv.icon || null,
      admin_id: conv.admin_id || null, partner_id: partnerId,
      avatar: partnerAvatar,
      last_text: last?.text || null,
      last_at:   last?.created_at || conv.created_at,
      last_sender_id: last?.sender_id || null,
      unread_count: unreadMap[convId] || 0 };
  }).filter(Boolean).sort((a, b) => b.last_at - a.last_at);
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

function getMessages(convId, before, limit = 50) {
  const rows = db.prepare(
    `SELECT m.*, u.name AS sender_name, u.avatar AS sender_avatar
     FROM messages m JOIN users u ON u.id=m.sender_id
     WHERE m.conversation_id=? AND m.created_at<?
     ORDER BY m.created_at ASC
     LIMIT ?`
  ).all(convId, before, limit);
  return rows.map(_parseMsg);
}

function createMessage({ conversationId, senderId, text, attachment }) {
  const msg = { id: uuid(), conversation_id: conversationId, sender_id: senderId,
    text: text || null,
    attachment: attachment ? JSON.stringify(attachment) : null,
    status: 'sent', created_at: now(), edited_at: null };
  db.prepare(
    `INSERT INTO messages (id,conversation_id,sender_id,text,attachment,status,created_at)
     VALUES (@id,@conversation_id,@sender_id,@text,@attachment,@status,@created_at)`
  ).run(msg);
  return _parseMsg(msg);
}

function updateMessageStatus(id, status) {
  db.prepare('UPDATE messages SET status=? WHERE id=?').run(status, id);
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
  return db.prepare(
    `SELECT u.id, u.name, u.phone, u.avatar, b.created_at
     FROM blocks b JOIN users u ON u.id = b.blocked_id
     WHERE b.user_id = ? ORDER BY b.created_at DESC`
  ).all(userId);
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
  return { ...m, auto_tags: JSON.parse(m.auto_tags || '[]'), is_search: !!m.is_search, edited: !!m.edited };
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

function getMomentFeed(userId) {
  const contactIds = getContactIds(userId);
  if (!contactIds.length) return [];
  const blockedIds = getBlockedByIds(userId);
  const visible = contactIds.filter(id => !blockedIds.includes(id));
  if (!visible.length) return [];
  const ph = visible.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT m.*, u.name AS author_name, u.avatar AS author_avatar
     FROM moments m JOIN users u ON u.id=m.user_id
     WHERE m.user_id IN (${ph}) AND m.status='active'
     ORDER BY m.created_at DESC`
  ).all(...visible);
  return rows.map(r => _withStats(_parseMoment(r)));
}

function getMyMoments(userId, status = 'active') {
  let where = status === 'all' ? '' : `AND m.status='${status}'`;
  const rows = db.prepare(
    `SELECT m.*, u.name AS author_name, u.avatar AS author_avatar
     FROM moments m JOIN users u ON u.id=m.user_id
     WHERE m.user_id=? ${where}
     ORDER BY m.created_at DESC`
  ).all(userId);
  return rows.map(r => _withStats(_parseMoment(r)));
}

function _withStats(m) {
  if (!m) return null;
  const reactions = db.prepare(
    `SELECT reaction, COUNT(*) as cnt FROM moment_reactions WHERE moment_id=? GROUP BY reaction`
  ).all(m.id);
  const views = db.prepare('SELECT COUNT(*) as cnt FROM moment_views WHERE moment_id=?').get(m.id)?.cnt ?? 0;
  const stats = { see: 0, resonate: 0, talk: 0 };
  reactions.forEach(r => { stats[r.reaction] = r.cnt; });
  return { ...m, stats, views };
}

function getMomentById(id) {
  const m = db.prepare(
    `SELECT m.*, u.name AS author_name, u.avatar AS author_avatar
     FROM moments m JOIN users u ON u.id=m.user_id WHERE m.id=?`
  ).get(id);
  return _withStats(_parseMoment(m));
}

function getActiveMomentCount(userId) {
  return db.prepare("SELECT COUNT(*) as c FROM moments WHERE user_id=? AND status='active'").get(userId)?.c ?? 0;
}

function getActiveMoment(userId) {
  const m = db.prepare(
    `SELECT m.*, u.name AS author_name, u.avatar AS author_avatar
     FROM moments m JOIN users u ON u.id=m.user_id
     WHERE m.user_id=? AND m.status='active' LIMIT 1`
  ).get(userId);
  return _withStats(_parseMoment(m));
}

function createMoment({ userId, text, mediaType, mediaUrl, mediaDuration, autoTags, isSearch }) {
  const id = 'mom_' + uuid().replace(/-/g,'').slice(0,12);
  const t = now();
  db.prepare(
    `INSERT INTO moments (id,user_id,text,media_type,media_url,media_duration,auto_tags,is_search,status,created_at,updated_at,edited,archived_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,0,NULL)`
  ).run(id, userId, text, mediaType||null, mediaUrl||null, mediaDuration||null,
        JSON.stringify(autoTags||[]), isSearch ? 1 : 0, 'active', t, t);
  return getMomentById(id);
}

function updateMoment(id, { text, mediaType, mediaUrl, mediaDuration, autoTags, isSearch }) {
  const t = now();
  const sets = ['updated_at=?', 'edited=1'];
  const vals = [t];
  if (text !== undefined)          { sets.push('text=?');           vals.push(text); }
  if (mediaType !== undefined)     { sets.push('media_type=?');     vals.push(mediaType || null); }
  if (mediaUrl !== undefined)      { sets.push('media_url=?');      vals.push(mediaUrl || null); }
  if (mediaDuration !== undefined) { sets.push('media_duration=?'); vals.push(mediaDuration || null); }
  if (autoTags !== undefined)      { sets.push('auto_tags=?');      vals.push(JSON.stringify(autoTags)); }
  if (isSearch !== undefined)      { sets.push('is_search=?');      vals.push(isSearch ? 1 : 0); }
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
  const users   = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const blocked = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_blocked=1').get().c;
  const admins  = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_admin=1').get().c;
  const moments = db.prepare("SELECT COUNT(*) as c FROM moments WHERE status != 'deleted'").get().c;
  const activeMoments = db.prepare("SELECT COUNT(*) as c FROM moments WHERE status='active'").get().c;
  const reactions = db.prepare('SELECT COUNT(*) as c FROM moment_reactions').get().c;
  return { users, blocked, admins, moments, activeMoments, reactions };
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
    `SELECT u.id, u.name, u.phone, u.avatar, u.created_at, u.is_admin, u.is_blocked,
            u.blocked_at, u.blocked_by, u.must_change_password,
            p.online, p.last_seen,
            (SELECT COUNT(*) FROM moments WHERE user_id=u.id AND status='active') AS active_moments,
            (SELECT COUNT(*) FROM moments WHERE user_id=u.id AND status!='deleted') AS total_moments
     FROM users u
     LEFT JOIN presence p ON p.user_id=u.id
     WHERE ${where}
     ORDER BY u.created_at DESC`
  ).all(...params);
  return rows.map(r => ({ ...r, online: !!r.online, is_admin: !!r.is_admin, is_blocked: !!r.is_blocked, must_change_password: !!r.must_change_password }));
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
  return { ...safe, online: !!safe.online, is_admin: !!safe.is_admin, is_blocked: !!safe.is_blocked, must_change_password: !!safe.must_change_password };
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
  let where = "status != 'deleted'";
  const params = [];
  if (status && status !== 'all') { where += ' AND m.status=?'; params.push(status); }
  if (userId) { where += ' AND m.user_id=?'; params.push(userId); }
  const rows = db.prepare(
    `SELECT m.*, u.name AS author_name, u.phone AS author_phone
     FROM moments m JOIN users u ON u.id=m.user_id
     WHERE ${where}
     ORDER BY m.created_at DESC LIMIT 200`
  ).all(...params);
  return rows.map(r => _withStats(_parseMoment(r)));
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

module.exports = {
  now,
  createUser, findUserByPhone, findUserById, updateUser,
  getContacts, addContact, removeContact, getContactOwners, getContactIds,
  createGroup, updateGroup, addGroupMember, removeGroupMember, getGroupMembers,
  getOrCreateDirectConversation, getConversationsForUser, getConversationMembers, isMember,
  getMessages, createMessage, updateMessageStatus, getMessageById,
  clearConversationMessages, editMessage, deleteMessage,
  getMediaMessages, searchMessages,
  getCalls, createCall,
  setOnline, getPresence,
  toggleReaction, getMessageReactions, getReactionsForMessages,
  blockUser, unblockUser, getBlockedUsers, isBlocked, updateContactNotes,
  getReferralCount, findUserByInviteCode,
  // Moments
  getMomentFeed, getMyMoments, getMomentById, getActiveMoment, getActiveMomentCount,
  createMoment, updateMoment, archiveMoment, restoreMoment, deleteMomentForever,
  upsertMomentReaction, deleteMomentReaction, getMomentReactions, getUserMomentReaction,
  addMomentView, getDisciplinesCloud,
  // Admin
  getAdminStats, getAdminUsers, getAdminUserById,
  adminResetPassword, adminBlockUser, adminUnblockUser,
  adminMakeAdmin, adminRevokeAdmin,
  getAdminMoments, adminDeleteMoment,
  logAdminAction, getAdminLogs,
};
