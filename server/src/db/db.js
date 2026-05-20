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

// ── Referral / Super bonus migrations ─────────────────────────────────────────
try { db.exec('ALTER TABLE users ADD COLUMN invited_count INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN super_bonus_claimed INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN super_expires_at INTEGER'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN achievements TEXT DEFAULT \'[]\''); } catch {}

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
  return rows.map(({ password, ...r }) => ({ ...r, online: !!r.online, is_deleted: !!r.is_deleted }));
}

function deleteUserAccount(userId) {
  const t = now();
  db.transaction(() => {
    // Anonymise personal data
    db.prepare(
      `UPDATE users SET
         is_deleted=1, deleted_at=?,
         name='Удалённый пользователь',
         phone=NULL,
         avatar=NULL,
         password=?
       WHERE id=?`
    ).run(t, `DELETED_${userId}_${t}`, userId);
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
      partnerAvatar = partner?.avatar || null;
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
  return db.prepare(
    `SELECT mr.user_id, mr.reaction, mr.created_at, u.name, u.avatar
     FROM moment_reactions mr JOIN users u ON u.id=mr.user_id
     WHERE mr.moment_id=? ORDER BY mr.created_at DESC`
  ).all(momentId);
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

module.exports = {
  now,
  createUser, findUserByPhone, findUserById, updateUser, deleteUserAccount,
  getContacts, addContact, removeContact, getContactOwners, getContactIds,
  createGroup, updateGroup, addGroupMember, removeGroupMember, getGroupMembers,
  getOrCreateDirectConversation, acceptRequest, declineRequest,
  getConversationById, getConversationsForUser, getConversationMembers, isMember,
  getPinnedCount, pinConversation, unpinConversation,
  getMessages, createMessage, updateMessageStatus, markMessagesReadUpTo, getMessageById,
  clearConversationMessages, editMessage, deleteMessage,
  getMediaMessages, searchMessages,
  getCalls, createCall,
  setOnline, getPresence,
  toggleReaction, getMessageReactions, getReactionsForMessages,
  blockUser, unblockUser, getBlockedUsers, isBlocked, updateContactNotes,
  getReferralCount, findUserByInviteCode,
  extendSuper, processReferral, checkAndExpireSuper,
  // Moments
  getMomentFeed, getMyMoments, getMomentById, getActiveMoment, getActiveMoments, getActiveMomentCount,
  createMoment, updateMoment, archiveMoment, restoreMoment, deleteMomentForever, reorderMoments,
  upsertMomentReaction, deleteMomentReaction, getMomentReactions, getUserMomentReaction,
  getSavedMoments, getMomentReactorsList,
  addMomentView, getDisciplinesCloud,
  // Admin
  getAdminStats, getAdminUsers, getAdminUserById,
  adminResetPassword, adminBlockUser, adminUnblockUser,
  adminMakeAdmin, adminRevokeAdmin, makeUserSuper, revokeUserSuper,
  getAdminMoments, adminDeleteMoment,
  logAdminAction, getAdminLogs,
};
