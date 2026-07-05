#!/usr/bin/env node
/**
 * Pre-deploy SQLite snapshot (safe with WAL via .backup()).
 * Run on server: node server/scripts/predeploy-backup.js
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
const dataDir = path.join(ROOT, 'data');
const src = path.join(dataDir, 'hey.db');
const KEEP = 20;

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

if (!fs.existsSync(src)) {
  console.error('hey.db not found:', src);
  process.exit(1);
}

const dest = path.join(dataDir, `hey_pre_${stamp()}.db`);
const db = new Database(src, { readonly: true });
db.backup(dest);
db.close();
console.log('Snapshot:', dest);

const backups = fs.readdirSync(dataDir)
  .filter((f) => f.startsWith('hey_pre_') && f.endsWith('.db'))
  .map((f) => ({ f, mtime: fs.statSync(path.join(dataDir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

for (const old of backups.slice(KEEP)) {
  fs.unlinkSync(path.join(dataDir, old.f));
  console.log('Removed old snapshot:', old.f);
}
