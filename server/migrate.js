// Run once: node server/migrate.js
const fs  = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const jsonPath = path.join(__dirname, 'data/hey.json');
const dbPath   = path.join(__dirname, 'data/hey.db');

if (!fs.existsSync(jsonPath)) { console.log('hey.json not found, nothing to migrate'); process.exit(0); }

const old = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const db  = new Database(dbPath);
db.pragma('journal_mode = WAL');

let users = 0, contacts = 0, convs = 0, members = 0, messages = 0, calls = 0;

db.transaction(() => {
  // ── Users ──────────────────────────────────────────────────────────────
  const insUser = db.prepare(
    `INSERT OR IGNORE INTO users (id,phone,name,password,avatar,birthday,created_at)
     VALUES (@id,@phone,@name,@password,@avatar,@birthday,@created_at)`
  );
  const insPresence = db.prepare(
    `INSERT OR IGNORE INTO presence (user_id,online,last_seen) VALUES (?,0,?)`
  );
  for (const u of (old.users || [])) {
    insUser.run({ id:u.id, phone:u.phone, name:u.name||'?', password:u.password,
      avatar:u.avatar||null, birthday:u.birthday||null, created_at:u.created_at||0 });
    insPresence.run(u.id, u.created_at||0);
    users++;
  }

  // ── Contacts ────────────────────────────────────────────────────────────
  const insContact = db.prepare(
    `INSERT OR IGNORE INTO contacts (id,owner_id,contact_id,nickname) VALUES (?,?,?,?)`
  );
  for (const c of (old.contacts || [])) {
    insContact.run(c.id, c.owner_id, c.contact_id, c.nickname||null);
    contacts++;
  }

  // ── Conversations ───────────────────────────────────────────────────────
  const insConv = db.prepare(
    `INSERT OR IGNORE INTO conversations (id,type,name,created_at) VALUES (?,?,?,?)`
  );
  for (const c of (old.conversations || [])) {
    insConv.run(c.id, c.type||'direct', c.name||null, c.created_at||0);
    convs++;
  }

  // ── Members ─────────────────────────────────────────────────────────────
  const insMember = db.prepare(
    `INSERT OR IGNORE INTO members (conversation_id,user_id,joined_at) VALUES (?,?,?)`
  );
  for (const m of (old.members || [])) {
    insMember.run(m.conversation_id, m.user_id, m.joined_at||0);
    members++;
  }

  // ── Messages ────────────────────────────────────────────────────────────
  const insMsg = db.prepare(
    `INSERT OR IGNORE INTO messages (id,conversation_id,sender_id,text,attachment,status,created_at)
     VALUES (@id,@conversation_id,@sender_id,@text,@attachment,@status,@created_at)`
  );
  for (const m of (old.messages || [])) {
    insMsg.run({ id:m.id, conversation_id:m.conversation_id, sender_id:m.sender_id,
      text:m.text||null,
      attachment: m.attachment ? JSON.stringify(m.attachment) : null,
      status:m.status||'sent', created_at:m.created_at||0 });
    messages++;
  }

  // ── Calls ────────────────────────────────────────────────────────────────
  const insCall = db.prepare(
    `INSERT OR IGNORE INTO calls (id,caller_id,callee_id,type,status,duration,created_at)
     VALUES (?,?,?,?,?,?,?)`
  );
  for (const c of (old.calls || [])) {
    insCall.run(c.id, c.caller_id, c.callee_id,
      c.type||'voice', c.status||'missed', c.duration||0, c.created_at||0);
    calls++;
  }
})();

console.log(`Migration complete:
  Users:         ${users}
  Contacts:      ${contacts}
  Conversations: ${convs}
  Members:       ${members}
  Messages:      ${messages}
  Calls:         ${calls}
`);
