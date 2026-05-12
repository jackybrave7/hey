const express = require('express');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const nodemailer = require('nodemailer');
const authModule = require('./auth');
const { signToken, requireAuth, optionalAuth } = authModule;
const db = require('./db/db');
const { detectTags, detectMoodEmoji } = require('./auto-tags');
const storage = require('./storage');

// ── requireAdmin middleware ────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    const user = db.findUserById(req.user.id);
    if (!user || !user.is_admin) return res.status(403).json({ error: 'Admin access required' });
    if (user.is_blocked) return res.status(403).json({ error: 'Account is blocked' });
    req.adminUser = user;
    next();
  });
}

const MOMENTS_DIR = path.join(__dirname, '../data/uploads/moments');
fs.mkdirSync(MOMENTS_DIR, { recursive: true });

// ── Mailer ────────────────────────────────────────────────────────────────────
const FEEDBACK_LOG = path.join(__dirname, '../data/feedback.log');

function createTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return null;
}

function saveFeedbackToFile(subject, body) {
  try {
    fs.mkdirSync(path.dirname(FEEDBACK_LOG), { recursive: true });
    const entry = `\n${'='.repeat(60)}\n[${new Date().toISOString()}] ${subject}\n${body}\n`;
    fs.appendFileSync(FEEDBACK_LOG, entry, 'utf8');
  } catch(e) { console.error('[FEEDBACK] file write failed:', e.message); }
}

const UPLOAD_DIR = path.join(__dirname, '../data/uploads');
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 3 * 1024 * 1024; // 3 MB after compression

// In-memory rate limiter — no extra dependencies needed
const _buckets = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const b = _buckets.get(key);
    if (!b || now > b.reset) {
      _buckets.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    if (b.count >= max)
      return res.status(429).json({ error: 'Слишком много попыток. Попробуйте позже.' });
    b.count++;
    next();
  };
}

module.exports = function makeRouter(db, broadcast) {
  const r = express.Router();
  authModule.init(db); // inject DB into auth for block checks

  r.post('/register', rateLimit(5, 15 * 60 * 1000), (req, res) => {
    const { phone, name, password, birthday, avatar } = req.body;
    if (!phone || !name || !password)
      return res.status(400).json({ error: 'phone, name, password required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Пароль минимум 8 символов' });
    if (db.findUserByPhone(phone))
      return res.status(409).json({ error: 'Телефон уже зарегистрирован' });
    const user = db.createUser({ phone, name, password, birthday, avatar });
    const token = signToken({ id: user.id, phone: user.phone, name: user.name });
    const { password: _, ...safe } = user;
    res.json({ token, user: safe });
  });

  r.post('/login', rateLimit(10, 15 * 60 * 1000), (req, res) => {
    const { phone, password } = req.body;
    const user = db.findUserByPhone(phone);
    if (!user) return res.status(401).json({ error: 'Неверный телефон или пароль' });
    if (!bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Неверный телефон или пароль' });
    if (user.is_blocked) return res.status(403).json({ error: 'Неверный телефон или пароль' });
    const token = signToken({ id: user.id, phone: user.phone, name: user.name });
    const { password: _, ...safe } = user;
    res.json({ token, user: safe });
  });

  // Public invite info endpoint (no auth required)
  r.get('/users/:id/invite-info', (req, res) => {
    const user = db.findUserById(req.params.id);
    if (!user || user.is_blocked) return res.status(404).json({ error: 'Not found' });
    res.json({ id: user.id, name: user.name, avatar_url: user.avatar || null });
  });

  // Public profile endpoint (auth required)
  r.get('/users/:id/profile', requireAuth, (req, res) => {
    const target = db.findUserById(req.params.id);
    if (!target || target.is_blocked) return res.status(404).json({ error: 'Not found' });
    const activeMoment = db.getActiveMoment(target.id);
    const presence     = db.getPresence(target.id);
    const contacts     = db.getContacts(req.user.id);
    const isContact    = contacts.some(c => c.id === target.id);
    const { password, phone, must_change_password, ...safe } = target;
    res.json({ ...safe, active_moment: activeMoment || null, presence, is_contact: isContact });
  });

  r.get('/me', requireAuth, (req, res) => {
    const user = db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const { password, ...safe } = user;
    res.json(safe);
  });

  r.patch('/me', requireAuth, (req, res) => {
    const { name, phone, birthday, avatar } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (birthday !== undefined) updates.birthday = birthday;
    if (avatar !== undefined) updates.avatar = avatar;
    const user = db.updateUser(req.user.id, updates);
    const { password, ...safe } = user;
    res.json(safe);
  });

  r.post('/me/password', requireAuth, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'Заполните все поля' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Пароль минимум 8 символов' });
    const user = db.findUserById(req.user.id);
    // If must_change_password, allow skipping old password verification
    if (!user.must_change_password) {
      if (!oldPassword) return res.status(400).json({ error: 'Введите текущий пароль' });
      if (!bcrypt.compareSync(oldPassword, user.password))
        return res.status(403).json({ error: 'Неверный текущий пароль' });
    }
    db.updateUser(req.user.id, { password: bcrypt.hashSync(newPassword, 10), must_change_password: 0 });
    res.json({ ok: true });
  });

  r.get('/contacts', requireAuth, (req, res) => {
    res.json(db.getContacts(req.user.id));
  });

  r.post('/contacts', requireAuth, (req, res) => {
    const { phone: rawPhone, nickname, userId } = req.body;
    let target;
    if (userId) {
      target = db.findUserById(userId);
    } else {
      const digits = (rawPhone || '').replace(/\D/g, '');
      const phone = '+' + (digits.startsWith('8') ? '7' + digits.slice(1) : digits);
      target = db.findUserByPhone(phone);
    }
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'Нельзя добавить себя' });
    if (target.is_blocked) return res.status(404).json({ error: 'Пользователь не найден' });
    try { db.addContact(req.user.id, target.id, nickname); }
    catch(e) { return res.status(409).json({ error: e.message }); }
    const { password, ...safe } = target;
    res.json({ ...safe, nickname });
  });

  r.delete('/contacts/:id', requireAuth, (req, res) => {
    db.removeContact(req.user.id, req.params.id);
    res.json({ ok: true });
  });

  r.patch('/contacts/:id/notes', requireAuth, (req, res) => {
    db.updateContactNotes(req.user.id, req.params.id, req.body.notes);
    res.json({ ok: true });
  });

  // ── Blocks ──────────────────────────────────────────────────────────────────
  r.get('/blocks', requireAuth, (req, res) => {
    res.json(db.getBlockedUsers(req.user.id));
  });

  r.post('/blocks', requireAuth, (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (userId === req.user.id) return res.status(400).json({ error: 'Нельзя заблокировать себя' });
    db.blockUser(req.user.id, userId);
    res.json({ ok: true });
  });

  r.delete('/blocks/:userId', requireAuth, (req, res) => {
    db.unblockUser(req.user.id, req.params.userId);
    res.json({ ok: true });
  });

  r.get('/conversations', requireAuth, (req, res) => {
    res.json(db.getConversationsForUser(req.user.id));
  });

  r.post('/conversations', requireAuth, (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const conv = db.getOrCreateDirectConversation(req.user.id, userId);
    res.json({ id: conv.id });
  });

  r.post('/upload', requireAuth, async (req, res) => {
    try {
      const { data } = req.body;
      if (!data) return res.status(400).json({ error: 'No data' });
      const match = data.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/s);
      if (!match) return res.status(400).json({ error: 'Invalid format' });
      const [, mime, b64] = match;
      if (!ALLOWED_MIME.includes(mime)) return res.status(400).json({ error: 'Unsupported type. Use JPEG, PNG, WebP or GIF' });
      const buf = Buffer.from(b64, 'base64');
      if (buf.length > MAX_BYTES) return res.status(400).json({ error: 'Image too large (max 3 MB)' });
      const baseKey = 'avatars/' + req.user.id;
      const { fullUrl } = await storage.uploadImage(buf, baseKey);
      res.json({ url: fullUrl });
    } catch (e) {
      console.error('[/upload]', e);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  r.get('/conversations/:id/messages', requireAuth, (req, res) => {
    if (!db.isMember(req.params.id, req.user.id))
      return res.status(403).json({ error: 'Not a member' });
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before ? parseInt(req.query.before) : db.now() + 1;
    const msgs = db.getMessages(req.params.id, before, limit);
    const reactionsMap = db.getReactionsForMessages(msgs.map(m => m.id));
    res.json(msgs.map(m => ({ ...m, reactions: reactionsMap[m.id] || {} })));
  });

  r.patch('/conversations/:id/messages/:msgId', requireAuth, (req, res) => {
    const m = db.getMessageById(req.params.msgId);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (m.sender_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!db.isMember(req.params.id, req.user.id)) return res.status(403).json({ error: 'Not a member' });
    if (db.now() - m.created_at > 3 * 60 * 60)
      return res.status(403).json({ error: 'Слишком поздно для редактирования' });
    const updated = db.editMessage(req.params.msgId, req.body.text?.trim());
    broadcast(db.getConversationMembers(req.params.id), { type: 'message:edited', message: updated });
    res.json(updated);
  });

  r.delete('/conversations/:id/messages/:msgId', requireAuth, (req, res) => {
    const m = db.getMessageById(req.params.msgId);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (m.sender_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!db.isMember(req.params.id, req.user.id)) return res.status(403).json({ error: 'Not a member' });
    db.deleteMessage(req.params.msgId);
    broadcast(db.getConversationMembers(req.params.id), {
      type: 'message:deleted', messageId: req.params.msgId, conversationId: req.params.id
    });
    res.json({ ok: true });
  });

  r.delete('/conversations/:id/messages', requireAuth, (req, res) => {
    const convId = req.params.id;
    if (!db.isMember(convId, req.user.id))
      return res.status(403).json({ error: 'Not a member' });
    db.clearConversationMessages(convId);
    const members = db.getConversationMembers(convId);
    broadcast(members, { type: 'chat:cleared', conversationId: convId });
    res.json({ ok: true });
  });

  // ── Groups ────────────────────────────────────────────────────────────────
  r.post('/groups', requireAuth, (req, res) => {
    const { name, icon, memberIds = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });
    const group = db.createGroup({ creatorId: req.user.id, name: name.trim(), icon, memberIds });
    const members = db.getConversationMembers(group.id);
    broadcast(members.filter(id => id !== req.user.id), { type: 'group:created', conversationId: group.id });
    res.json(group);
  });

  r.patch('/groups/:id', requireAuth, (req, res) => {
    try {
      db.updateGroup(req.params.id, req.user.id, req.body);
      const members = db.getConversationMembers(req.params.id);
      broadcast(members, { type: 'group:updated', conversationId: req.params.id, fields: req.body });
      res.json({ ok: true });
    } catch(e) { res.status(403).json({ error: e.message }); }
  });

  r.get('/groups/:id/members', requireAuth, (req, res) => {
    if (!db.isMember(req.params.id, req.user.id)) return res.status(403).json({ error: 'Forbidden' });
    res.json(db.getGroupMembers(req.params.id));
  });

  r.post('/groups/:id/members', requireAuth, (req, res) => {
    try {
      const target = db.findUserById(req.body.userId);
      if (!target) return res.status(404).json({ error: 'User not found' });
      db.addGroupMember(req.params.id, req.user.id, req.body.userId);
      const members = db.getConversationMembers(req.params.id);
      broadcast(members, { type: 'group:member_added', conversationId: req.params.id, userId: req.body.userId });
      res.json({ ok: true });
    } catch(e) { res.status(403).json({ error: e.message }); }
  });

  r.delete('/groups/:id/members/:userId', requireAuth, (req, res) => {
    try {
      const members = db.getConversationMembers(req.params.id);
      db.removeGroupMember(req.params.id, req.user.id, req.params.userId);
      broadcast(members, { type: 'group:member_removed', conversationId: req.params.id, userId: req.params.userId });
      res.json({ ok: true });
    } catch(e) { res.status(403).json({ error: e.message }); }
  });

  // ── Media & Search ────────────────────────────────────────────────────────
  r.get('/conversations/:id/media', requireAuth, (req, res) => {
    if (!db.isMember(req.params.id, req.user.id)) return res.status(403).json({ error: 'Forbidden' });
    res.json(db.getMediaMessages(req.params.id));
  });

  r.get('/conversations/:id/search', requireAuth, (req, res) => {
    if (!db.isMember(req.params.id, req.user.id)) return res.status(403).json({ error: 'Forbidden' });
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    res.json(db.searchMessages(req.params.id, q));
  });

  r.get('/calls', requireAuth, (req, res) => {
    res.json(db.getCalls(req.user.id));
  });

  r.post('/calls', requireAuth, (req, res) => {
    const { calleeId, type, status, duration } = req.body;
    const id = db.createCall({ callerId: req.user.id, calleeId, type, status, duration });
    res.json({ id });
  });

  r.get('/presence/:userId', requireAuth, (req, res) => {
    res.json(db.getPresence(req.params.userId));
  });

  // ── Invite / Referral ──────────────────────────────────────────────────────
  r.get('/invite', requireAuth, (req, res) => {
    const user  = db.findUserById(req.user.id);
    const count = db.getReferralCount(req.user.id);
    res.json({ code: user.invite_code, referral_count: count });
  });

  r.get('/invite/:code', (req, res) => {
    const user = db.findUserByInviteCode(req.params.code.toUpperCase());
    if (!user) return res.status(404).json({ error: 'Не найдено' });
    res.json({ name: user.name, avatar: user.avatar });
  });

  // ── Feedback ───────────────────────────────────────────────────────────────
  r.post('/feedback', rateLimit(3, 60 * 60 * 1000), optionalAuth, async (req, res) => {
    const { text, type } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Текст не может быть пустым' });

    const from = req.user
      ? `${req.user.name} (${req.user.phone})`
      : 'Аноним';
    const subject = `HEY Feedback [${type || 'общее'}] от ${from}`;
    const body = `От: ${from}\nТип: ${type || 'общее'}\n\n${text.trim()}`;

    // Always save to file
    saveFeedbackToFile(subject, body);
    console.log('[FEEDBACK]', subject);

    // Try to send email (transporter created fresh so it picks up .env changes at runtime)
    const t = createTransporter();
    if (t) {
      try {
        await t.sendMail({
          from: `"HEY Messenger" <${process.env.SMTP_USER}>`,
          to: 'evgeny.alferov@gmail.com',
          subject,
          text: body,
        });
        console.log('[FEEDBACK] email sent ✓');
      } catch (e) {
        console.error('[FEEDBACK] email failed:', e.message);
      }
    } else {
      console.warn('[FEEDBACK] SMTP not configured — saved to file only');
    }

    res.json({ ok: true });
  });

  // ── Moments Media Upload ──────────────────────────────────────────────────
  r.post('/moments/upload', requireAuth, async (req, res) => {
    try {
      const { data } = req.body;
      if (!data) return res.status(400).json({ error: 'No data' });

      // image
      const imgMatch = data.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/s);
      if (imgMatch) {
        const [, mime, b64] = imgMatch;
        const ALLOWED = ['image/jpeg','image/png','image/webp','image/gif'];
        if (!ALLOWED.includes(mime)) return res.status(400).json({ error: 'Unsupported image type' });
        const buf = Buffer.from(b64, 'base64');
        if (buf.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Image too large (max 5 MB)' });
        const baseKey = 'moments/' + uuid() + '/media';
        const { fullKey, fullUrl, thumbKey, thumbUrl } = await storage.uploadImage(buf, baseKey);
        return res.json({ url: fullUrl, key: fullKey, thumb_url: thumbUrl, thumb_key: thumbKey, mediaType: 'image' });
      }

      // video
      const vidMatch = data.match(/^data:(video\/[a-zA-Z0-9]+);base64,(.+)$/s);
      if (vidMatch) {
        const [, mime, b64] = vidMatch;
        const buf = Buffer.from(b64, 'base64');
        if (buf.length > 20 * 1024 * 1024) return res.status(400).json({ error: 'Video too large (max 20 MB)' });
        const ext = mime.split('/')[1];
        const key = 'moments/' + uuid() + '/video.' + ext;
        const { url } = await storage.uploadFile(key, buf, mime);
        return res.json({ url, key, mediaType: 'video' });
      }

      // audio
      const audMatch = data.match(/^data:(audio\/[a-zA-Z0-9]+);base64,(.+)$/s);
      if (audMatch) {
        const [, mime, b64] = audMatch;
        const buf = Buffer.from(b64, 'base64');
        if (buf.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'Audio too large (max 10 MB)' });
        const ext = mime.split('/')[1];
        const key = 'moments/' + uuid() + '/audio.' + ext;
        const { url } = await storage.uploadFile(key, buf, mime);
        return res.json({ url, key, mediaType: 'audio' });
      }

      return res.status(400).json({ error: 'Unsupported media format' });
    } catch (e) {
      console.error('[/moments/upload]', e);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // ── Moments CRUD ──────────────────────────────────────────────────────────

  // Лента моментов от контактов (с пагинацией)
  r.get('/moments', requireAuth, (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit) || 20, 50);
    const before = req.query.before ? parseInt(req.query.before) : null;
    res.json(db.getMomentFeed(req.user.id, limit, before));
  });

  // Мои моменты
  r.get('/moments/my', requireAuth, (req, res) => {
    const status = ['active','archived','all'].includes(req.query.status) ? req.query.status : 'active';
    res.json(db.getMyMoments(req.user.id, status));
  });

  // Один момент
  r.get('/moments/:id', requireAuth, (req, res) => {
    const m = db.getMomentById(req.params.id);
    if (!m || m.status === 'deleted') return res.status(404).json({ error: 'Not found' });
    const myReaction = db.getUserMomentReaction(req.params.id, req.user.id);
    res.json({ ...m, myReaction: myReaction?.reaction || null });
  });

  // Создать момент
  r.post('/moments', requireAuth, (req, res) => {
    const { text, mediaUrl, mediaType, mediaDuration, isSearch } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text required' });
    if (text.length > 2000) return res.status(400).json({ error: 'Текст слишком длинный (макс. 2000 символов)' });

    const activeCount = db.getActiveMomentCount(req.user.id);
    const MAX_ACTIVE = 1; // premium = 3, пока у всех 1
    if (activeCount >= MAX_ACTIVE) {
      const existing = db.getActiveMoment(req.user.id);
      return res.status(409).json({ error: 'already_has_active', existing });
    }

    const autoTags = detectTags(text, mediaType);
    const moodEmoji = detectMoodEmoji(text, isSearch);
    const moment = db.createMoment({
      userId: req.user.id,
      text: text.trim(),
      mediaType: mediaType || null,
      mediaUrl: mediaUrl || null,
      mediaDuration: mediaDuration || null,
      autoTags,
      isSearch: !!isSearch,
    });
    // WebSocket push to contacts
    const contactOwners = db.getContactOwners(req.user.id);
    broadcast(contactOwners, { type: 'moment:new', moment: { ...moment, mood_emoji: moodEmoji } });
    res.json({ ...moment, mood_emoji: moodEmoji });
  });

  // Редактировать момент
  r.patch('/moments/:id', requireAuth, (req, res) => {
    const m = db.getMomentById(req.params.id);
    if (!m || m.status === 'deleted') return res.status(404).json({ error: 'Not found' });
    if (m.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const { text, mediaUrl, mediaType, mediaDuration, isSearch } = req.body;
    const newText = text?.trim() ?? m.text;
    const newMediaType = mediaType !== undefined ? mediaType : m.media_type;
    const autoTags = detectTags(newText, newMediaType);
    const updated = db.updateMoment(req.params.id, {
      text: newText, mediaUrl, mediaType, mediaDuration, autoTags,
      isSearch: isSearch !== undefined ? isSearch : m.is_search,
    });
    const moodEmoji = detectMoodEmoji(newText, updated.is_search);
    const members = db.getContactOwners(req.user.id);
    broadcast(members, { type: 'moment:updated', moment: { ...updated, mood_emoji: moodEmoji } });
    res.json({ ...updated, mood_emoji: moodEmoji });
  });

  // Архивировать
  r.post('/moments/:id/archive', requireAuth, (req, res) => {
    const m = db.getMomentById(req.params.id);
    if (!m || m.status === 'deleted') return res.status(404).json({ error: 'Not found' });
    if (m.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    db.archiveMoment(req.params.id);
    broadcast(db.getContactOwners(req.user.id), { type: 'moment:archived', momentId: req.params.id });
    res.json({ ok: true });
  });

  // Восстановить из архива
  r.post('/moments/:id/restore', requireAuth, (req, res) => {
    const m = db.getMomentById(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (m.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const activeCount = db.getActiveMomentCount(req.user.id);
    if (activeCount >= 1) return res.status(409).json({ error: 'already_has_active' });
    db.restoreMoment(req.params.id);
    const restored = db.getMomentById(req.params.id);
    broadcast(db.getContactOwners(req.user.id), { type: 'moment:new', moment: restored });
    res.json(restored);
  });

  // Удалить навсегда
  r.delete('/moments/:id', requireAuth, (req, res) => {
    const { confirm } = req.body;
    if (confirm !== 'удалить') return res.status(400).json({ error: 'Введите слово «удалить» для подтверждения' });
    const m = db.getMomentById(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (m.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    db.deleteMomentForever(req.params.id);
    broadcast(db.getContactOwners(req.user.id), { type: 'moment:deleted', momentId: req.params.id });
    res.json({ ok: true });
  });

  // ── Moment Reactions ──────────────────────────────────────────────────────

  r.post('/moments/:id/react', requireAuth, (req, res) => {
    const { reaction } = req.body;
    if (!['see','resonate','talk'].includes(reaction))
      return res.status(400).json({ error: 'Invalid reaction' });
    const m = db.getMomentById(req.params.id);
    if (!m || m.status !== 'active') return res.status(404).json({ error: 'Not found' });
    if (m.user_id === req.user.id) return res.status(400).json({ error: 'Cannot react to own moment' });

    db.upsertMomentReaction(req.params.id, req.user.id, reaction);

    // Notify author
    broadcast([m.user_id], { type: 'moment:reaction', momentId: req.params.id, userId: req.user.id, reaction });

    let chatId = null;
    if (reaction === 'talk') {
      const conv = db.getOrCreateDirectConversation(req.user.id, m.user_id);
      chatId = conv.id;
    }
    res.json({ ok: true, chatId });
  });

  r.delete('/moments/:id/react', requireAuth, (req, res) => {
    db.deleteMomentReaction(req.params.id, req.user.id);
    res.json({ ok: true });
  });

  r.get('/moments/:id/reactions', requireAuth, (req, res) => {
    const m = db.getMomentById(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (m.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    res.json(db.getMomentReactions(req.params.id));
  });

  // ── Moment Views ──────────────────────────────────────────────────────────

  r.post('/moments/:id/view', requireAuth, (req, res) => {
    const m = db.getMomentById(req.params.id);
    if (!m || m.status !== 'active') return res.status(404).json({ error: 'Not found' });
    db.addMomentView(req.params.id, req.user.id);
    broadcast([m.user_id], { type: 'moment:view', momentId: req.params.id, userId: req.user.id });
    res.json({ ok: true });
  });

  // ── Disciplines cloud ─────────────────────────────────────────────────────
  r.get('/moments/disciplines/:userId', requireAuth, (req, res) => {
    res.json(db.getDisciplinesCloud(req.params.userId));
  });

  // ── Admin Routes ─────────────────────────────────────────────────────────────

  r.get('/admin/stats', requireAdmin, (req, res) => {
    res.json(db.getAdminStats());
  });

  r.get('/admin/users', requireAdmin, (req, res) => {
    const { search, filter } = req.query;
    res.json(db.getAdminUsers({ search, filter }));
  });

  r.get('/admin/users/:id', requireAdmin, (req, res) => {
    const user = db.getAdminUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  });

  r.post('/admin/users/:id/reset-password', requireAdmin, (req, res) => {
    const user = db.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    // Generate a random 10-char password
    const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
    let newPassword = '';
    for (let i = 0; i < 10; i++) newPassword += chars[Math.floor(Math.random() * chars.length)];
    db.adminResetPassword(req.params.id, bcrypt.hashSync(newPassword, 10));
    db.logAdminAction({ adminId: req.user.id, action: 'reset_password', targetUserId: req.params.id });
    res.json({ ok: true, newPassword });
  });

  r.post('/admin/users/:id/block', requireAdmin, (req, res) => {
    const user = db.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (user.id === req.user.id) return res.status(400).json({ error: 'Cannot block yourself' });
    db.adminBlockUser(req.params.id, req.user.id, req.body.reason);
    res.json({ ok: true });
  });

  r.post('/admin/users/:id/unblock', requireAdmin, (req, res) => {
    const user = db.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    db.adminUnblockUser(req.params.id, req.user.id);
    res.json({ ok: true });
  });

  r.post('/admin/users/:id/make-admin', requireAdmin, (req, res) => {
    const user = db.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    db.adminMakeAdmin(req.params.id, req.user.id);
    res.json({ ok: true });
  });

  r.post('/admin/users/:id/revoke-admin', requireAdmin, (req, res) => {
    const user = db.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (user.id === req.user.id) return res.status(400).json({ error: 'Cannot revoke your own admin' });
    db.adminRevokeAdmin(req.params.id, req.user.id);
    res.json({ ok: true });
  });

  r.get('/admin/moments', requireAdmin, (req, res) => {
    const { status, userId } = req.query;
    res.json(db.getAdminMoments({ status, userId }));
  });

  r.delete('/admin/moments/:id', requireAdmin, (req, res) => {
    const m = db.getMomentById(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    db.adminDeleteMoment(req.params.id, req.user.id, req.body?.reason);
    broadcast(db.getContactOwners(m.user_id), { type: 'moment:deleted', momentId: req.params.id });
    broadcast([m.user_id], { type: 'moment:deleted', momentId: req.params.id });
    res.json({ ok: true });
  });

  r.get('/admin/logs', requireAdmin, (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    res.json(db.getAdminLogs(limit));
  });

  r.get('/health', (_, res) => res.json({ ok: true }));

  return r;
};