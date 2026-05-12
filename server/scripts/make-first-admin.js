// server/scripts/make-first-admin.js
// Sets is_admin=1 for the oldest user in the database
// Usage: node server/scripts/make-first-admin.js

const path = require('path');
const db = require(path.join(__dirname, '../src/db/db'));

const oldest = require('better-sqlite3')(
  path.join(__dirname, '../data/hey.db')
);

const user = oldest.prepare('SELECT id, name, phone FROM users ORDER BY created_at ASC LIMIT 1').get();
if (!user) {
  console.error('No users found in database.');
  process.exit(1);
}

oldest.prepare('UPDATE users SET is_admin=1 WHERE id=?').run(user.id);
console.log(`✓ Made admin: ${user.name} (${user.phone}) [${user.id}]`);
oldest.close();
