#!/usr/bin/env node
/**
 * Pre-deploy smoke tests — DB + HTTP API.
 * Run: node server/scripts/predeploy-smoke.js
 * Env: API_BASE=http://127.0.0.1:3001 (optional)
 */
const path = require('path');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');

const ROOT = path.join(__dirname, '..');
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3001';

const results = [];
let failed = 0;

function pass(name, detail = '') {
  results.push({ ok: true, name, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failed++;
  results.push({ ok: false, name, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function assert(cond, name, detail) {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

function request(method, urlPath, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, API_BASE);
    const lib = url.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
      timeout: 10000,
    }, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch {}
        resolve({ status: res.statusCode, json, raw });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

async function testHttp(token) {
  console.log('\n── HTTP API ──');

  try {
    const healthRoot = await request('GET', '/health');
    assert(healthRoot.status === 200, 'GET /health', `status ${healthRoot.status}`);
  } catch (e) {
    fail('GET /health', e.message);
  }

  try {
    const health = await request('GET', '/api/health');
    assert(health.status === 200 && health.json?.ok, 'GET /api/health', `status ${health.status}`);
  } catch (e) {
    fail('GET /api/health', e.message);
    return;
  }

  const noAuth = await request('GET', '/api/me');
  assert(noAuth.status === 401, 'GET /api/me без токена → 401', `status ${noAuth.status}`);

  if (!token) {
    fail('Auth token', 'не удалось получить тестовый токен');
    return;
  }

  const me = await request('GET', '/api/me', { token });
  assert(me.status === 200 && me.json?.id, 'GET /api/me', me.json?.name ? 'ok' : 'no user');

  const convs = await request('GET', '/api/conversations', { token });
  assert(convs.status === 200 && Array.isArray(convs.json), 'GET /api/conversations', `count ${convs.json?.length ?? '?'}`);

  const archived = await request('GET', '/api/conversations?archived=1', { token });
  assert(archived.status === 200 && Array.isArray(archived.json), 'GET /api/conversations?archived=1', `count ${archived.json?.length ?? '?'}`);

  const contacts = await request('GET', '/api/contacts', { token });
  assert(contacts.status === 200 && Array.isArray(contacts.json), 'GET /api/contacts');

  const moments = await request('GET', '/api/moments', { token });
  assert(
    moments.status === 200 && Array.isArray(moments.json?.items),
    'GET /api/moments',
    `items ${moments.json?.items?.length ?? '?'}`,
  );

  const pushKey = await request('GET', '/api/push/public-key');
  assert(pushKey.status === 200, 'GET /api/push/public-key');

  const settings = await request('GET', '/api/settings/public');
  assert(settings.status === 200, 'GET /api/settings/public');

  const convId = convs.json?.[0]?.id;
  if (convId) {
    const msgs = await request('GET', `/api/conversations/${convId}/messages`, { token });
    assert(msgs.status === 200 && Array.isArray(msgs.json), 'GET /api/conversations/:id/messages');

    const scheduled = await request('GET', `/api/conversations/${convId}/scheduled`, { token });
    assert(scheduled.status === 200 && Array.isArray(scheduled.json), 'GET /api/conversations/:id/scheduled');
  } else {
    pass('GET /api/conversations/:id/messages', 'skip — нет чатов');
  }

  return { me: me.json, convs: convs.json, convId };
}

function wsOnce(token, onOpen) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE);
    const host = url.hostname;
    const port = url.port || (url.protocol === 'https:' ? 443 : 80);
    const proto = url.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${host}:${port}/ws?token=${encodeURIComponent(token)}`);
    const timer = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error('ws timeout'));
    }, 8000);
    ws.on('error', (e) => { clearTimeout(timer); reject(e); });
    ws.on('close', () => clearTimeout(timer));
    ws.on('open', async () => {
      try {
        const result = await onOpen(ws);
        clearTimeout(timer);
        ws.close();
        resolve(result);
      } catch (e) {
        clearTimeout(timer);
        try { ws.close(); } catch {}
        reject(e);
      }
    });
  });
}

async function testFlows(token, userId, convId) {
  console.log('\n── Потоки (API + WS) ──');
  if (!token || !userId) {
    fail('flows', 'нет токена');
    return;
  }

  const db = require(path.join(ROOT, 'src/db/db.js'));
  const Database = require('better-sqlite3');
  const raw = new Database(path.join(ROOT, 'data', 'hey.db'));

  const group = raw.prepare(`
    SELECT c.id FROM conversations c
    JOIN members m ON m.conversation_id=c.id AND m.user_id=?
    WHERE c.type='group' LIMIT 1
  `).get(userId);

  const flowConvId = convId || group?.id;
  if (!flowConvId) {
    pass('WS message:send', 'skip — нет чата');
    pass('reaction', 'skip');
    pass('mute toggle', 'skip');
    pass('archive toggle', 'skip');
    pass('scheduled CRUD', 'skip');
    raw.close();
    return;
  }

  // WS: отправка текста (пробуем все активные чаты пользователя)
  try {
    const smokeText = `[smoke] ${Date.now()}`;
    const convIds = db.getConversationsForUser(userId, { archived: false }).map(c => c.id);
    let sent = null;
    let usedConv = null;
    for (const cid of convIds) {
      try {
        sent = await wsOnce(token, (ws) => new Promise((resolve, reject) => {
          const tempId = `smoke-${Date.now()}`;
          const onMsg = (rawEv) => {
            let msg; try { msg = JSON.parse(rawEv); } catch { return; }
            if (msg.type === 'message:new' && msg.message?.tempId === tempId) {
              ws.off('message', onMsg);
              resolve(msg.message);
            }
          };
          ws.on('message', onMsg);
          ws.send(JSON.stringify({
            type: 'message:send',
            conversationId: cid,
            text: smokeText,
            tempId,
          }));
          setTimeout(() => { ws.off('message', onMsg); reject(new Error('timeout')); }, 3000);
        }));
        if (sent?.id) { usedConv = cid; break; }
      } catch { /* next conv */ }
    }
    if (!sent?.id) {
      await new Promise(r => setTimeout(r, 500));
      for (const cid of convIds) {
        const list = await request('GET', `/api/conversations/${cid}/messages`, { token });
        sent = Array.isArray(list.json) ? list.json.find(m => m.text === smokeText) : null;
        if (sent?.id) { usedConv = cid; break; }
      }
    }
    assert(!!sent?.id, 'WS message:send', sent?.id ? `${sent.id.slice(0, 8)} in ${usedConv?.slice(0, 8)}` : 'no conv accepted');
  } catch (e) {
    fail('WS message:send', e.message);
  }

  // Реакция на своё сообщение
  try {
    const msgs = await request('GET', `/api/conversations/${flowConvId}/messages`, { token });
    const mine = Array.isArray(msgs.json) ? msgs.json.find(m => m.sender_id === userId && !m.is_deleted) : null;
    if (mine?.id) {
      const rx = await request('POST', `/api/conversations/${flowConvId}/messages/${mine.id}/reactions`, {
        token, body: { emoji: '👍' },
      });
      assert(rx.status === 200 && rx.json?.reactions, 'POST reaction', '👍');
      await request('POST', `/api/conversations/${flowConvId}/messages/${mine.id}/reactions`, {
        token, body: { emoji: '👍' },
      });
    } else {
      pass('POST reaction', 'skip — нет сообщения');
    }
  } catch (e) {
    fail('POST reaction', e.message);
  }

  // Mute группы (только для group)
  if (group?.id) {
    try {
      const wasMuted = db.isNotificationsMuted(group.id, userId);
      const mute = await request('PATCH', `/api/groups/${group.id}/notifications`, {
        token, body: { muted: !wasMuted },
      });
      assert(mute.status === 200 && mute.json?.notifications_muted === !wasMuted, 'PATCH mute', String(!wasMuted));
      const restore = await request('PATCH', `/api/groups/${group.id}/notifications`, {
        token, body: { muted: wasMuted },
      });
      assert(restore.status === 200, 'PATCH mute restore');
    } catch (e) {
      fail('PATCH mute', e.message);
    }
  } else {
    pass('PATCH mute', 'skip — нет группы');
  }

  // Архив / восстановление
  try {
    const wasArchived = db.isConversationArchived(flowConvId, userId);
    if (!wasArchived) {
      const arch = await request('POST', `/api/conversations/${flowConvId}/archive`, { token });
      assert(arch.status === 200, 'POST archive');
      assert(db.isConversationArchived(flowConvId, userId), 'archive в БД');
      const unarch = await request('DELETE', `/api/conversations/${flowConvId}/archive`, { token });
      assert(unarch.status === 200, 'DELETE archive');
      assert(!db.isConversationArchived(flowConvId, userId), 'unarchive в БД');
    } else {
      pass('archive toggle', 'skip — чат уже в архиве');
    }
  } catch (e) {
    fail('archive toggle', e.message);
  }

  // Отложенное сообщение: create → patch → delete
  try {
    const sendAt = Math.floor(Date.now() / 1000) + 3600;
    const created = await request('POST', `/api/conversations/${flowConvId}/scheduled`, {
      token,
      body: { text: '[smoke] scheduled', send_at: sendAt },
    });
    assert(created.status === 200 && created.json?.id, 'POST scheduled', created.json?.id?.slice(0, 8));
    if (created.json?.id) {
      const patched = await request('PATCH', `/api/scheduled/${created.json.id}`, {
        token,
        body: { text: '[smoke] scheduled edited', send_at: sendAt + 60 },
      });
      assert(patched.status === 200 && patched.json?.text?.includes('edited'), 'PATCH scheduled');
      const removed = await request('DELETE', `/api/scheduled/${created.json.id}`, { token });
      assert(removed.status === 200, 'DELETE scheduled');
    }
  } catch (e) {
    fail('scheduled CRUD', e.message);
  }

  // Админское удаление чужого сообщения в группе
  try {
    const adminGroup = raw.prepare(`
      SELECT c.id FROM conversations c
      JOIN members m ON m.conversation_id=c.id AND m.user_id=? AND m.is_admin=1
      WHERE c.type='group' LIMIT 1
    `).get(userId);
    const victim = adminGroup ? raw.prepare(`
      SELECT m.id, m.conversation_id FROM messages m
      WHERE m.conversation_id=? AND m.sender_id!=? AND m.is_deleted=0
        AND m.text LIKE '[smoke]%'
      LIMIT 1
    `).get(adminGroup.id, userId) : null;
    if (adminGroup && victim) {
      const del = await request('DELETE', `/api/conversations/${victim.conversation_id}/messages/${victim.id}`, { token });
      assert(del.status === 200 && del.json?.deleted_by_id, 'admin DELETE message');
    } else {
      pass('admin DELETE message', 'skip — нет smoke-сообщения для удаления');
    }
  } catch (e) {
    fail('admin DELETE message', e.message);
  }

  // Сообщение с несколькими фото — структура attachment в БД
  try {
    const imgs = raw.prepare(
      "SELECT id FROM messages WHERE attachment LIKE '%\"type\":\"images\"%' AND is_deleted=0 LIMIT 1"
    ).get();
    if (imgs) {
      const parsed = db.getMessageById(imgs.id);
      const att = typeof parsed?.attachment === 'string'
        ? JSON.parse(parsed.attachment)
        : parsed?.attachment;
      assert(att?.type === 'images' && Array.isArray(att.urls) && att.urls.length >= 2, 'multi-image attachment', `${att?.urls?.length ?? 0} фото`);
    } else {
      pass('multi-image attachment', 'skip');
    }
  } catch (e) {
    fail('multi-image attachment', e.message);
  }

  raw.close();
}

function testDb() {
  console.log('\n── Database / бизнес-логика ──');

  const db = require(path.join(ROOT, 'src/db/db.js'));
  const Database = require('better-sqlite3');
  const raw = new Database(path.join(ROOT, 'data', 'hey.db'), { readonly: true });

  const user = raw.prepare('SELECT id FROM users WHERE is_deleted=0 LIMIT 1').get();
  assert(!!user?.id, 'DB: есть активный пользователь');

  const group = raw.prepare("SELECT id FROM conversations WHERE type='group' LIMIT 1").get();
  if (group?.id && user?.id) {
    const isMember = db.isMember(group.id, user.id);
    assert(typeof isMember === 'boolean', 'isMember()');

    const muted = db.isNotificationsMuted(group.id, user.id);
    assert(typeof muted === 'boolean', 'isNotificationsMuted()');

    const archived = db.isConversationArchived(group.id, user.id);
    assert(typeof archived === 'boolean', 'isConversationArchived()');

    const isAdmin = db.isGroupAdmin(group.id, user.id);
    assert(typeof isAdmin === 'boolean', 'isGroupAdmin()');
  } else {
    pass('Group helpers', 'skip — нет группы');
  }

  const activeConvs = db.getConversationsForUser(user.id, { archived: false });
  const archConvs = db.getConversationsForUser(user.id, { archived: true });
  assert(Array.isArray(activeConvs), 'getConversationsForUser(active)');
  assert(Array.isArray(archConvs), 'getConversationsForUser(archived)');

  const overlap = activeConvs.some(c => archConvs.some(a => a.id === c.id));
  assert(!overlap, 'архив и активные чаты не пересекаются');

  for (const c of activeConvs) {
    if (c.notifications_muted !== undefined) {
      pass('notifications_muted в списке чатов');
      break;
    }
  }

  const deletedMsg = raw.prepare(
    'SELECT id FROM messages WHERE is_deleted=1 AND deleted_by_id IS NOT NULL LIMIT 1'
  ).get();
  if (deletedMsg) {
    const parsed = db.getMessageById(deletedMsg.id);
    assert(parsed?.deleted_by_id != null, 'deleted_by_id в getMessageById');
  } else {
    pass('admin delete tombstone', 'skip — нет удалённых админом');
  }

  const imagesMsg = raw.prepare(
    "SELECT id FROM messages WHERE attachment LIKE '%\"type\":\"images\"%' LIMIT 1"
  ).get();
  assert(!!imagesMsg?.id, 'есть сообщение с несколькими фото', imagesMsg ? 'found' : 'none in DB');

  const unread = db.getTotalUnreadFor(user.id);
  assert(Number.isFinite(unread) && unread >= 0, 'getTotalUnreadFor', String(unread));

  raw.close();
  return user;
}

function makeToken(userId) {
  const auth = require(path.join(ROOT, 'src/auth.js'));
  return auth.signToken({ id: userId });
}

async function testWebBuild() {
  console.log('\n── Web build ──');
  const { execSync } = require('child_process');
  try {
    execSync('npm run build', {
      cwd: path.join(ROOT, '..', 'web'),
      stdio: 'pipe',
      encoding: 'utf8',
    });
    pass('npm run build (web)');
  } catch (e) {
    fail('npm run build (web)', (e.stderr || e.stdout || e.message).split('\n').slice(-3).join(' '));
  }
}

async function main() {
  console.log('HEY pre-deploy smoke tests');
  console.log(`API: ${API_BASE}`);

  let user;
  try {
    user = testDb();
  } catch (e) {
    fail('DB module load', e.message);
  }

  let token = null;
  let httpMeta = null;
  if (user?.id) {
    try { token = makeToken(user.id); } catch (e) { fail('JWT sign', e.message); }
  }

  try {
    httpMeta = await testHttp(token);
  } catch (e) {
    fail('HTTP suite', e.message);
  }

  if (user?.id) {
    try {
      await testFlows(token, user.id, httpMeta?.convId);
    } catch (e) {
      fail('flows suite', e.message);
    }
  }
  await testWebBuild();

  console.log('\n── Итог ──');
  const total = results.length;
  const ok = results.filter(r => r.ok).length;
  console.log(`${ok}/${total} passed, ${failed} failed`);

  if (failed > 0) {
    console.error('\nНе готово к деплою — исправьте ошибки выше.');
    process.exit(1);
  }
  console.log('\nГотово к деплою (smoke).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
