const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const express = require('express');

const SRC_ROOT = path.join(__dirname, '../src');

let testDbPath = null;
let db = null;
let server = null;
let baseUrl = null;

function resetModules() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}server${path.sep}src${path.sep}`)) {
      delete require.cache[key];
    }
  }
}

function setupTestDb() {
  if (testDbPath && fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch {}
    for (const ext of ['-wal', '-shm']) {
      try { fs.unlinkSync(testDbPath + ext); } catch {}
    }
  }
  testDbPath = path.join(os.tmpdir(), `hey-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  process.env.HEY_DB_PATH = testDbPath;
  process.env.JWT_SECRET = 'hey-test-jwt-secret';
  process.env.STORAGE_MODE = 'local';
  delete process.env.OPEN_SIGNUP;
  resetModules();
  db = require(path.join(SRC_ROOT, 'db/db'));
  return db;
}

async function startTestServer() {
  if (!db) setupTestDb();
  const makeRouter = require(path.join(SRC_ROOT, 'routes'));
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api', makeRouter(db, () => {}));
  await new Promise((resolve) => {
    server = http.createServer(app).listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api`;
  return { app, baseUrl, db };
}

async function stopTestServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
  baseUrl = null;
  if (testDbPath) {
    for (const p of [testDbPath, testDbPath + '-wal', testDbPath + '-shm']) {
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch {}
      }
    }
    testDbPath = null;
  }
  db = null;
  resetModules();
}

function createTestUser(opts = {}) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const user = db.createUser({
    phone: opts.phone || `+7900${suffix.padEnd(7, '0').slice(0, 7)}`,
    name: opts.name || `Test ${suffix}`,
    password: 'password123',
    email: opts.email ?? `user${suffix}@test.local`,
    termsAcceptedAt: Date.now(),
    termsVersion: '1',
  });
  const patch = {};
  if (opts.is_admin) patch.is_admin = 1;
  if (opts.is_super_admin) patch.is_super_admin = 1;
  if (opts.is_super) patch.is_super = 1;
  if (Object.keys(patch).length) patchTestUser(user.id, patch);
  return { ...user, password: 'password123' };
}

function patchTestUser(userId, patch) {
  const Database = require('better-sqlite3');
  const conn = new Database(process.env.HEY_DB_PATH);
  const keys = Object.keys(patch);
  conn.prepare(`UPDATE users SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`)
    .run(...keys.map(k => patch[k]), userId);
  conn.close();
}

async function login(phone, password = 'password123') {
  const res = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  const data = await res.json();
  return { status: res.status, data, token: data.token };
}

async function api(token, method, urlPath, body) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

module.exports = {
  setupTestDb,
  startTestServer,
  stopTestServer,
  createTestUser,
  login,
  api,
  get db() { return db; },
  get baseUrl() { return baseUrl; },
};
