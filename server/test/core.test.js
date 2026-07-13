const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  setupTestDb,
  startTestServer,
  stopTestServer,
  createTestUser,
  login,
  api,
} = require('./helpers');

function db() { return require('./helpers').db; }

describe('HEY core — database', () => {
  before(() => setupTestDb());

  after(() => stopTestServer());

  it('creates users with email', () => {
    const u = createTestUser({ email: 'alice@example.com', name: 'Alice' });
    const row = db().findUserById(u.id);
    assert.equal(row.email, 'alice@example.com');
    assert.equal(row.name, 'Alice');
  });

  it('getInvitedCounts does not throw (SQL params)', () => {
    const u = createTestUser();
    assert.doesNotThrow(() => db().getInvitedCounts(u.id));
    const counts = db().getInvitedCounts(u.id);
    assert.equal(typeof counts.total, 'number');
    assert.equal(typeof counts.confirmed, 'number');
  });

  it('direct chat between two users', () => {
    const a = createTestUser({ name: 'A' });
    const b = createTestUser({ name: 'B' });
    const conv = db().getOrCreateDirectConversation(a.id, b.id);
    assert.ok(conv?.id);
    assert.equal(db().isMember(conv.id, a.id), true);
    assert.equal(db().isMember(conv.id, b.id), true);
  });

  it('group message read receipts', () => {
    const owner = createTestUser({ name: 'Owner' });
    const reader = createTestUser({ name: 'Reader' });
    const { id: groupId } = db().createGroup({
      creatorId: owner.id,
      name: 'Test group',
      memberIds: [reader.id],
    });
    db().acceptGroupInvite(groupId, reader.id);

    const msg = db().createMessage({
      conversationId: groupId,
      senderId: owner.id,
      text: 'Hello group',
    });
    assert.ok(msg.id);

    const before = db().getMessageReaders(msg.id, groupId, owner.id);
    assert.equal(before.readers.length, 0);
    assert.equal(before.total_members, 1);

    db().markMessagesReadUpTo(groupId, reader.id, msg.id);

    const after = db().getMessageReaders(msg.id, groupId, owner.id);
    assert.equal(after.readers.length, 1);
    assert.equal(after.readers[0].id, reader.id);
  });

  it('getMessageReaders returns null for direct chat', () => {
    const a = createTestUser();
    const b = createTestUser();
    const conv = db().getOrCreateDirectConversation(a.id, b.id);
    const msg = db().createMessage({ conversationId: conv.id, senderId: a.id, text: 'hi' });
    assert.equal(db().getMessageReaders(msg.id, conv.id, a.id), null);
  });

  it('admin users list includes email and search by email', () => {
    createTestUser({ email: 'findme@hey.test', name: 'FindMe' });
    createTestUser({ email: 'other@hey.test', name: 'Other' });
    const all = db().getAdminUsers({});
    assert.ok(all.some(u => u.email === 'findme@hey.test'));
    const found = db().getAdminUsers({ search: 'findme@hey' });
    assert.equal(found.length, 1);
    assert.equal(found[0].email, 'findme@hey.test');
  });

  it('stores video attachment on message', () => {
    const a = createTestUser();
    const b = createTestUser();
    const conv = db().getOrCreateDirectConversation(a.id, b.id);
    const msg = db().createMessage({
      conversationId: conv.id,
      senderId: a.id,
      attachment: { type: 'video', url: '/media/chat/video/x.mp4', name: 'clip.mp4' },
    });
    assert.equal(msg.attachment.type, 'video');
    assert.equal(msg.attachment.name, 'clip.mp4');
  });
});

describe('HEY core — HTTP API', () => {
  before(async () => {
    setupTestDb();
    await startTestServer();
  });

  after(async () => {
    await stopTestServer();
  });

  it('GET /health', async () => {
    const r = await api(null, 'GET', '/health');
    assert.equal(r.status, 200);
    assert.equal(r.data.ok, true);
  });

  it('login returns token', async () => {
    const u = createTestUser({ phone: '+79991112233', email: 'login@test.local' });
    const { status, token, data } = await login(u.phone);
    assert.equal(status, 200);
    assert.ok(token);
    assert.equal(data.user.phone, u.phone);
  });

  it('GET /conversations requires auth', async () => {
    const r = await api(null, 'GET', '/conversations');
    assert.equal(r.status, 401);
  });

  it('GET /conversations for logged-in user', async () => {
    const u = createTestUser();
    const { token } = await login(u.phone);
    const r = await api(token, 'GET', '/conversations');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data));
  });

  it('GET /me returns profile', async () => {
    const u = createTestUser();
    const { token } = await login(u.phone);
    const r = await api(token, 'GET', '/me');
    assert.equal(r.status, 200);
    assert.equal(r.data.id, u.id);
    assert.equal(r.data.phone, u.phone);
  });

  it('presign chat-video within limit', async () => {
    const u = createTestUser();
    const { token } = await login(u.phone);
    const r = await api(token, 'POST', '/upload/presign', {
      category: 'chat-video',
      contentType: 'video/mp4',
      size: 5 * 1024 * 1024,
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.maxBytes, 10 * 1024 * 1024);
  });

  it('presign chat-video rejects oversize for regular user', async () => {
    const u = createTestUser();
    const { token } = await login(u.phone);
    const r = await api(token, 'POST', '/upload/presign', {
      category: 'chat-video',
      contentType: 'video/mp4',
      size: 11 * 1024 * 1024,
    });
    assert.equal(r.status, 413);
  });

  it('presign chat-video allows 20MB for super user', async () => {
    const u = createTestUser({ is_super: true });
    const { token } = await login(u.phone);
    const r = await api(token, 'POST', '/upload/presign', {
      category: 'chat-video',
      contentType: 'video/mp4',
      size: 15 * 1024 * 1024,
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.maxBytes, 20 * 1024 * 1024);
  });

  it('GET message readers in group via API', async () => {
    const owner = createTestUser({ name: 'GOwner' });
    const reader = createTestUser({ name: 'GReader' });
    const { id: groupId } = db().createGroup({
      creatorId: owner.id,
      name: 'API group',
      memberIds: [reader.id],
    });
    db().acceptGroupInvite(groupId, reader.id);
    const msg = db().createMessage({ conversationId: groupId, senderId: owner.id, text: 'ping' });
    db().markMessagesReadUpTo(groupId, reader.id, msg.id);

    const ownerTok = (await login(owner.phone)).token;
    const r = await api(ownerTok, 'GET', `/conversations/${groupId}/messages/${msg.id}/readers`);
    assert.equal(r.status, 200);
    assert.equal(r.data.readers.length, 1);
    assert.equal(r.data.readers[0].id, reader.id);
  });

  it('admin users API includes email', async () => {
    const admin = createTestUser({ is_admin: true, email: 'admin@hey.test' });
    createTestUser({ email: 'listed@hey.test', name: 'Listed' });
    const { token } = await login(admin.phone);
    const r = await api(token, 'GET', '/admin/users?search=listed@hey');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data));
    assert.equal(r.data.length, 1);
    assert.equal(r.data[0].email, 'listed@hey.test');
  });
});
