const express = require('express');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const nodemailer = require('nodemailer');
const authModule = require('./auth');
const { signToken, requireAuth, optionalAuth, setSessionCookie, clearSessionCookie, getSessionFromCookie } = authModule;
const db = require('./db/db');
const { detectTags, detectMoodEmoji } = require('./auto-tags');
const { parseEmbeddedVideo } = require('./video-embed');
const storage = require('./storage');
const awo = require('./awo');
const push = require('./push');

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
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB после ресайза (соответствует chat-image лимиту в presign)

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
    const { phone, name, password, birthday, avatar, inviteUserId, email, schoolInviteCode, groupInviteToken } = req.body;

    // Если есть groupInviteToken — валидируем заранее и достаём inviterId
    // (он же становится referrer'ом, как обычная invite-ссылка)
    let groupInvite = null;
    if (groupInviteToken) {
      const data = awo.verifyGroupInvite(groupInviteToken);
      if (data) {
        const conv = db.getConversationById(data.groupId);
        const inv  = db.findUserById(data.inviterId);
        if (conv && conv.type === 'group' && inv && conv.admin_id === inv.id && !inv.is_blocked) {
          groupInvite = { groupId: conv.id, inviterId: inv.id };
        }
      }
    }
    // Если регистрация через group-invite — приравниваем к inviteUserId
    // (чтобы пройти проверку «только по приглашению» и записался referral)
    const effectiveInviteUserId = inviteUserId || (groupInvite ? groupInvite.inviterId : null);
    if (!phone || !name || !password)
      return res.status(400).json({ error: 'phone, name, password required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Пароль минимум 8 символов' });

    // Школьный инвайт (от АВО) — отдельный канал регистрации, не требует inviteUserId
    let schoolInvite = null;
    if (schoolInviteCode) {
      schoolInvite = db.findSchoolInviteByCode(schoolInviteCode);
      if (!schoolInvite) return res.status(400).json({ error: 'Школьный инвайт недействителен' });
      if (schoolInvite.used_at) return res.status(400).json({ error: 'Школьный инвайт уже использован' });
    }

    // Пока открыта регистрация только по инвайту (личному, школьному или групповому)
    const openSignup = process.env.OPEN_SIGNUP === '1';
    if (!openSignup && !effectiveInviteUserId && !schoolInvite) {
      return res.status(403).json({
        error: 'Регистрация пока только по приглашению. Попроси ссылку у знакомых.',
        code: 'INVITE_REQUIRED',
      });
    }

    // Email из школьного инвайта имеет приоритет (зашит в /join-ссылку)
    const finalEmail = schoolInvite?.bound_email || (email ? String(email).trim().toLowerCase() : null);
    if (finalEmail && !awo.isValidEmail(finalEmail)) {
      return res.status(400).json({ error: 'Неверный формат email' });
    }

    if (db.findUserByPhone(phone))
      return res.status(409).json({ error: 'Телефон уже зарегистрирован' });
    if (finalEmail && db.findUserByEmail(finalEmail))
      return res.status(409).json({ error: 'Email уже зарегистрирован' });

    const user = db.createUser({ phone, name, password, birthday, avatar, email: finalEmail });

    // Системный пользователь автоматически в контактах у нового юзера
    db.addSystemContactFor(user.id);

    // Создаём self-chat «Монолог»
    try { db.getOrCreateSelfChat(user.id); } catch {}

    // Auto-add mutual contacts if registered via invite link (личной или групповой)
    if (effectiveInviteUserId) {
      const inviter = db.findUserById(effectiveInviteUserId);
      if (inviter && !inviter.is_blocked) {
        try { db.addContact(user.id, inviter.id, null); } catch {}
        try { db.addContact(inviter.id, user.id, null); } catch {}
        // Реферальная запись создалась в createUser (referral_by + referrals row).
        // Сам зачёт inviter'у произойдёт когда новый юзер напишет первое сообщение
        // (см. ws.js → confirmReferralIfPending). Так требует спека:
        // «должны зарегистрироваться И написать хотя бы 1 сообщение».
      }
    }

    // Активация школьного инвайта (от АВО): отметить как использованный + добавить
    // школьный аккаунт в контакты + автодобавление в групповой чат курса
    if (schoolInvite) {
      try { db.markSchoolInviteUsed(schoolInvite.code, user.id); } catch (e) { console.error('[school-invite]', e.message); }
      try {
        const school = db.getSchoolAccount();
        if (school) {
          try { db.addContact(user.id, school.id, null); } catch {}
        }
      } catch {}
      // Автодобавление в групповой чат курса
      if (schoolInvite.course) {
        const chatId = db.getChatForCourse(schoolInvite.course);
        if (chatId) {
          try {
            const result = db.addUserToChat(chatId, user.id);
            if (result.added) {
              try {
                db.createMessage({
                  conversationId: chatId,
                  senderId: db.getSchoolUserId(),
                  text: `🎓 ${user.name} присоединился к курсу «${schoolInvite.course}»`,
                });
              } catch {}
              try { broadcast([user.id], { type: 'conversation:added', chat_id: chatId }); } catch {}
            }
          } catch (e) { console.error('[awo-course-chat]', e.message); }
        } else {
          console.warn(`[awo] нет маппинга курса "${schoolInvite.course}" → чат`);
        }
      }
    }

    // Авто-вступление в группу по invite-ссылке (если регистрация шла через /gjoin)
    if (groupInvite) {
      try {
        db.joinGroupViaInvite(groupInvite.groupId, user.id, groupInvite.inviterId);
        const members = db.getGroupMembers(groupInvite.groupId, false).map(m => m.id);
        try { broadcast(members, { type: 'group:member_joined', conversationId: groupInvite.groupId, userId: user.id }); } catch {}
        try { broadcast([user.id], { type: 'conversation:added', chat_id: groupInvite.groupId }); } catch {}
        try {
          db.createMessage({
            conversationId: groupInvite.groupId,
            senderId: db.SYSTEM_USER_ID,
            text: `👋 ${user.name} присоединился по приглашению`,
          });
        } catch {}
      } catch (e) { console.error('[group-invite-register]', e.message); }
    }

    const token = signToken({ id: user.id, phone: user.phone, name: user.name });
    setSessionCookie(res, token);
    const { password: _, ...safe } = user;
    res.json({ token, user: safe });
  });

  // ── Waitlist (email уведомления когда регистрация откроется) ──────────
  r.post('/waitlist', rateLimit(5, 60 * 60 * 1000), (req, res) => {
    const raw = (req.body?.email || '').trim().toLowerCase();
    if (!raw) return res.status(400).json({ error: 'Введите email' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw)) {
      return res.status(400).json({ error: 'Неверный формат email' });
    }
    if (raw.length > 200) return res.status(400).json({ error: 'Слишком длинный email' });
    try {
      const result = db.addToWaitlist(raw, req.body?.source || 'register-page');
      res.json({ ok: true, isNew: result.isNew });
    } catch (e) {
      console.error('[waitlist]', e);
      res.status(500).json({ error: 'Не удалось сохранить' });
    }
  });

  // Админ: список ожидания
  r.get('/admin/waitlist', requireAdmin, (req, res) => {
    res.json(db.getWaitlist());
  });

  r.post('/login', rateLimit(10, 15 * 60 * 1000), (req, res) => {
    const { phone, password } = req.body;
    const user = db.findUserByPhone(phone);
    if (!user) return res.status(401).json({ error: 'Неверный телефон или пароль' });
    if (!bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Неверный телефон или пароль' });
    // Сначала верифицируем пароль, потом проверяем блокировку — чтобы
    // блокировка не была способом проверить, существует ли аккаунт по телефону.
    if (user.is_blocked) {
      return res.status(403).json({
        error: 'Аккаунт заблокирован администрацией',
        code: 'BLOCKED',
      });
    }
    const token = signToken({ id: user.id, phone: user.phone, name: user.name });
    setSessionCookie(res, token);
    const { password: _, ...safe } = user;
    res.json({ token, user: safe });
  });

  // Logout — очищает cookie-сессию (JWT в localStorage клиент чистит сам)
  r.post('/logout', (req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // ── Widget для виджета HEY в личном кабинете АВО ─────────────────────────
  // Возвращает счётчик непрочитанных, но ТОЛЬКО если:
  //   1) у браузера есть валидная cookie-сессия HEY
  //   2) email сессии совпадает с переданным query-параметром (email из АВО)
  // Без совпадения — { authenticated: false }, никаких персональных данных.
  // CORS: app-wide cors уже эхо-возвращает origin с credentials — для виджета
  // на чужом домене этого достаточно.
  r.get('/widget/unread', (req, res) => {
    // Безкэшевый ответ
    res.set('Cache-Control', 'no-store');
    const session = getSessionFromCookie(req);
    if (!session) return res.json({ authenticated: false });
    const user = db.findUserById(session.id);
    if (!user || user.is_blocked) return res.json({ authenticated: false });
    // Email из АВО → нормализуем
    const askedEmail = String(req.query.email || '').trim().toLowerCase();
    const userEmail  = (user.email || '').trim().toLowerCase();
    if (!askedEmail || !userEmail || askedEmail !== userEmail) {
      return res.json({ authenticated: false });
    }
    const unread = db.getTotalUnreadFor(user.id);
    res.json({ authenticated: true, unread });
  });

  // Public invite info endpoint (no auth required)
  r.get('/users/:id/invite-info', (req, res) => {
    const user = db.findUserById(req.params.id);
    if (!user || user.is_blocked) return res.status(404).json({ error: 'Not found' });
    res.json({ id: user.id, name: user.name, avatar_url: user.avatar || null });
  });

  // ── Avatar endpoint — отдельный endpoint, кешируется браузером на 30 дней ───
  // /api/avatars/:userId  → возвращает бинарь аватара с сильным Cache-Control,
  // позволяя клиентским запросам conversation/messages не таскать base64 инлайн.
  // Без auth (аватары и так публичны через профили), чтобы можно было кешировать на CDN.
  r.get('/avatars/:userId', (req, res) => {
    const user = db.findUserById(req.params.userId);
    const av = user?.avatar;
    if (!av) {
      // 1x1 прозрачный пиксель — не падаем, чтобы не сбивать <img>
      const px = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
      res.set('Content-Type', 'image/gif');
      res.set('Cache-Control', 'public, max-age=60'); // короткий кеш — может появиться позже
      return res.send(px);
    }
    // Если это уже внешний URL (S3 / http) — редирект, браузер сам закеширует с того ресурса
    if (/^https?:\/\//i.test(av)) {
      res.set('Cache-Control', 'public, max-age=86400');
      return res.redirect(302, av);
    }
    // Если это data URL — декодируем и отдаём бинарём
    const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/s.exec(av);
    if (m) {
      const [, mime, b64] = m;
      const buf = Buffer.from(b64, 'base64');
      res.set('Content-Type', mime);
      res.set('Cache-Control', 'public, max-age=2592000, immutable'); // 30 дней
      res.set('ETag', `"${user.id}-${buf.length}"`);
      return res.send(buf);
    }
    // Иначе (эмодзи / буква) — отдаём прозрачный пиксель, чтобы <img> не сломался;
    // UI должен сам отрендерить букву через AvatarDisplay
    const px = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(px);
  });

  // Public profile endpoint (auth required)
  r.get('/users/:id/profile', requireAuth, (req, res) => {
    const target = db.findUserById(req.params.id);
    if (!target || target.is_blocked) return res.status(404).json({ error: 'Not found' });
    const activeMoments = db.getActiveMoments(target.id);
    const presence      = db.getPresence(target.id);
    const contacts      = db.getContacts(req.user.id);
    const isContact     = contacts.some(c => c.id === target.id);
    const { password, phone, must_change_password, achievements: achRaw, ...safe } = target;
    const achievements = (() => { try { return JSON.parse(achRaw || '[]'); } catch { return []; } })();
    res.json({ ...safe, achievements, active_moments: activeMoments, active_moment: activeMoments[0] || null, presence, is_contact: isContact });
  });

  r.get('/me', requireAuth, (req, res) => {
    db.checkAndExpireSuper(req.user.id);
    const user = db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const { password, achievements: achRaw, ...safe } = user;
    const achievements = (() => { try { return JSON.parse(achRaw || '[]'); } catch { return []; } })();
    res.json({ ...safe, achievements });
  });

  r.patch('/me', requireAuth, (req, res) => {
    const { name, phone, birthday, avatar, bio, headline, email } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (birthday !== undefined) updates.birthday = birthday;
    if (avatar  !== undefined) updates.avatar = avatar;
    if (email !== undefined) {
      const cleanedEmail = email ? String(email).trim().toLowerCase() : null;
      if (cleanedEmail) {
        if (!awo.isValidEmail(cleanedEmail)) {
          return res.status(400).json({ error: 'Неверный формат email' });
        }
        const existing = db.findUserByEmail(cleanedEmail);
        if (existing && existing.id !== req.user.id) {
          return res.status(409).json({ error: 'Email уже используется' });
        }
      }
      updates.email = cleanedEmail;
    }
    if (bio !== undefined) {
      const cleanedBio = bio ? bio.slice(0, 200) : null;
      // Проверка лимита ссылок: обычный — 1, Super — до 5
      if (cleanedBio) {
        const urls = cleanedBio.match(/https?:\/\/\S+/gi) || [];
        const me = db.findUserById(req.user.id);
        const maxLinks = me?.is_super ? 5 : 1;
        if (urls.length > maxLinks) {
          return res.status(400).json({
            error: me?.is_super
              ? `В описании можно до ${maxLinks} ссылок (у вас ${urls.length}).`
              : `В описании можно только 1 ссылку (у вас ${urls.length}). В ✦ Super — до 5.`,
            code: 'TOO_MANY_LINKS',
            maxLinks,
            current: urls.length,
          });
        }
      }
      updates.bio = cleanedBio;
    }
    if (headline  !== undefined) updates.headline = headline ? headline.slice(0, 100) : null;
    const user = db.updateUser(req.user.id, updates);
    const { password, achievements: achRaw, ...safe } = user;
    safe.achievements = (() => { try { return JSON.parse(achRaw || '[]'); } catch { return []; } })();
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

  // Delete own account — anonymise data, kick WS
  r.delete('/me', requireAuth, (req, res) => {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'Введите пароль для подтверждения' });
    const user = db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (!bcrypt.compareSync(password, user.password))
      return res.status(403).json({ error: 'Неверный пароль' });
    db.deleteUserAccount(req.user.id);
    // Notify the deleted user's own WS connections so the client logs out
    broadcast([req.user.id], { type: 'account:deleted' });
    res.json({ ok: true });
  });

  r.get('/users/search', requireAuth, (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 3) return res.json([]);
    res.json(db.searchUsers(q, req.user.id));
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
    if (target.is_deleted) return res.status(400).json({ error: 'Пользователь удалил аккаунт' });
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
    const target = db.findUserById(userId);
    if (!target || target.is_blocked) return res.status(404).json({ error: 'Пользователь не найден' });
    if (target.is_deleted) return res.status(400).json({ error: 'Пользователь удалил аккаунт' });
    if (db.isBlocked(req.user.id, userId) || db.isBlocked(userId, req.user.id))
      return res.status(403).json({ error: 'Переписка недоступна' });
    const conv = db.getOrCreateDirectConversation(req.user.id, userId);
    res.json({ id: conv.id, is_request: !!conv.request_from });
  });

  // Pin / unpin conversation
  r.post('/conversations/:id/pin', requireAuth, (req, res) => {
    if (!db.isMember(req.params.id, req.user.id))
      return res.status(403).json({ error: 'Forbidden' });
    const limit = req.user.is_super ? 10 : 5;
    const count = db.getPinnedCount(req.user.id);
    if (count >= limit)
      return res.status(409).json({ error: `Можно закрепить не более ${limit} чатов` });
    db.pinConversation(req.user.id, req.params.id);
    res.json({ ok: true });
  });

  r.delete('/conversations/:id/pin', requireAuth, (req, res) => {
    db.unpinConversation(req.user.id, req.params.id);
    res.json({ ok: true });
  });

  // Accept a message request
  r.post('/conversations/:id/accept', requireAuth, (req, res) => {
    if (!db.isMember(req.params.id, req.user.id))
      return res.status(403).json({ error: 'Forbidden' });
    const requesterId = db.acceptRequest(req.params.id, req.user.id);
    if (!requesterId) return res.status(400).json({ error: 'Нет активного запроса' });
    res.json({ ok: true, requesterId });
  });

  // Decline a message request
  r.delete('/conversations/:id/request', requireAuth, (req, res) => {
    if (!db.isMember(req.params.id, req.user.id))
      return res.status(403).json({ error: 'Forbidden' });
    const ok = db.declineRequest(req.params.id, req.user.id);
    if (!ok) return res.status(400).json({ error: 'Нет активного запроса' });
    res.json({ ok: true });
  });

  // ── Presigned upload URL (client uploads directly to S3) ────────────────────
  r.post('/upload/presign', requireAuth, async (req, res) => {
    const { category, contentType: rawContentType, size } = req.body;
    // Normalize: strip codec suffix ("audio/webm;codecs=opus" → "audio/webm")
    const contentType = (rawContentType || '').split(';')[0].trim();
    const allowed = {
      'chat-image':    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      'chat-audio':    ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'],
      'chat-file':     [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'application/zip',
        'application/x-zip-compressed',
        'application/x-rar-compressed',
        'application/vnd.rar',
        'application/octet-stream', // fallback для ZIP/RAR на некоторых браузерах
      ],
      'moment-image':  ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      'moment-video':  ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'],
      'moment-audio':  ['audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/webm'],
      'avatar':        ['image/jpeg', 'image/png', 'image/webp'],
    };
    if (!allowed[category]?.includes(contentType))
      return res.status(400).json({ error: 'Unsupported type' });

    // ── Size limits per category (МБ). Super accounts get higher limits ─────
    const MB = 1024 * 1024;
    const isSuper = !!req.user.is_super;
    const limits = {
      'chat-image':    isSuper ? 15 * MB : 8 * MB,
      'chat-audio':    10 * MB,                       // голосовухи — короткие
      'chat-file':     isSuper ? 50 * MB : 25 * MB,   // документы и архивы
      'moment-image':  isSuper ? 15 * MB : 5 * MB,
      'moment-video':  isSuper ? 50 * MB : 20 * MB,
      'moment-audio':  isSuper ? 30 * MB : 5 * MB,
      'avatar':        2 * MB,
    };
    const maxBytes = limits[category];
    if (typeof size === 'number' && size > maxBytes) {
      const maxMb = Math.round(maxBytes / MB);
      return res.status(413).json({
        error: `Файл слишком большой. Максимум ${maxMb} МБ${!isSuper && (category==='moment-image'||category==='moment-audio'||category==='moment-video') ? ' (для Super — больше)' : ''}`,
        maxBytes,
        isSuper,
      });
    }

    const ext   = contentType.split('/')[1].split(';')[0].replace('quicktime','mov').replace('x-matroska','mkv');
    // Расширение для chat-file берётся из имени файла на клиенте — здесь не критично
    const keyMap = {
      'chat-image':   `chat/${uuid()}.${ext}`,
      'chat-audio':   `chat/audio/${uuid()}.${ext}`,
      'chat-file':    `chat/files/${uuid()}`,
      'moment-image': `moments/${uuid()}/media.${ext}`,
      'moment-video': `moments/${uuid()}/video.${ext}`,
      'moment-audio': `moments/${uuid()}/audio.${ext}`,
      'avatar':       `avatars/${req.user.id}.${ext}`,
    };
    try {
      const result = await storage.getPresignedUploadUrl(keyMap[category], contentType);
      res.json({ ...result, maxBytes });
    } catch (e) {
      console.error('[/upload/presign]', e);
      res.status(500).json({ error: 'Presign failed' });
    }
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
      if (buf.length > MAX_BYTES) return res.status(400).json({ error: 'Файл слишком большой. Максимум 8 МБ' });
      const baseKey = 'chat/' + uuid();
      const { fullUrl } = await storage.uploadImage(buf, baseKey);
      res.json({ url: fullUrl });
    } catch (e) {
      console.error('[/upload]', e);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  r.get('/conversations/:id/messages', requireAuth, (req, res) => {
    // Pending приглашение в группу — возвращаем lock с инфой кто пригласил
    if (db.isPendingMember(req.params.id, req.user.id)) {
      const conv = db.getConversationById(req.params.id);
      // Найдём кто пригласил
      const row = require('./db/db'); // already imported as db, no-op
      const inviterRow = db.getInviterForPendingMember
        ? db.getInviterForPendingMember(req.params.id, req.user.id)
        : null;
      return res.json({
        groupInvite: true,
        conversation: {
          id: conv.id, type: conv.type, name: conv.name, icon: conv.icon || null,
          admin_id: conv.admin_id || null,
        },
        invitedBy: inviterRow || null,
      });
    }
    if (!db.isMember(req.params.id, req.user.id))
      return res.status(403).json({ error: 'Not a member' });
    // Lock messages for the recipient of an unaccepted request
    const conv = db.getConversationById(req.params.id);
    if (conv?.request_from && conv.request_from !== req.user.id) {
      const requester = db.findUserById(conv.request_from);
      return res.json({
        locked: true,
        requester: requester
          ? { id: requester.id, name: requester.name, avatar: requester.avatar || null }
          : null,
      });
    }
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

  r.delete('/conversations/:id', requireAuth, (req, res) => {
    try {
      const { memberIds, type } = db.deleteConversation(req.params.id, req.user.id);
      broadcast(memberIds, { type: 'conversation:deleted', conversationId: req.params.id, convType: type });
      res.json({ ok: true });
    } catch (e) {
      const msg = String(e.message || '');
      const code = msg.includes('админ') ? 403
                 : msg.includes('Монолог') ? 400
                 : msg.includes('участник') ? 403
                 : msg.includes('не найден') ? 404
                 : 500;
      res.status(code).json({ error: msg || 'Не удалось удалить чат' });
    }
  });

  // ── Pin message ────────────────────────────────────────────────────────
  r.get('/conversations/:id/pinned', requireAuth, (req, res) => {
    if (!db.isMember(req.params.id, req.user.id))
      return res.status(403).json({ error: 'Not a member' });
    const pinned = db.getPinnedMessage(req.params.id);
    res.json(pinned || null);
  });

  r.post('/conversations/:id/pin', requireAuth, (req, res) => {
    const { messageId } = req.body || {};
    if (!messageId) return res.status(400).json({ error: 'messageId required' });
    try {
      const pinned = db.pinMessage(req.params.id, messageId, req.user.id);
      const members = db.getConversationMembers(req.params.id);
      broadcast(members, { type: 'message:pinned', conversationId: req.params.id, message: pinned });
      res.json({ ok: true, pinned });
    } catch (e) {
      const msg = String(e.message || '');
      const code = msg.includes('админ')      ? 403
                 : msg.includes('участник')   ? 403
                 : msg.includes('не найден') || msg.includes('не найдено') ? 404
                 : 500;
      res.status(code).json({ error: msg });
    }
  });

  r.delete('/conversations/:id/pin', requireAuth, (req, res) => {
    try {
      db.unpinMessage(req.params.id, req.user.id);
      const members = db.getConversationMembers(req.params.id);
      broadcast(members, { type: 'message:pinned', conversationId: req.params.id, message: null });
      res.json({ ok: true });
    } catch (e) {
      const msg = String(e.message || '');
      const code = msg.includes('админ') || msg.includes('участник') ? 403 : 500;
      res.status(code).json({ error: msg });
    }
  });

  // ── Forward message ────────────────────────────────────────────────────
  r.post('/messages/:id/forward', requireAuth, (req, res) => {
    const { toConvIds } = req.body || {};
    if (!Array.isArray(toConvIds) || toConvIds.length === 0) {
      return res.status(400).json({ error: 'toConvIds (array) required' });
    }
    if (toConvIds.length > 20) {
      return res.status(400).json({ error: 'Можно переслать максимум в 20 чатов за раз' });
    }
    try {
      const created = db.forwardMessageToChats(req.params.id, toConvIds, req.user.id);
      // Broadcast каждого нового сообщения участникам соответствующего чата
      for (const msg of created) {
        const members = db.getConversationMembers(msg.conversationId);
        const full = { ...msg, sender_name: req.user.name };
        broadcast(members, { type: 'message:new', message: full });
      }
      res.json({ ok: true, forwardedCount: created.length });
    } catch (e) {
      const msg = String(e.message || '');
      const code = msg.includes('не найдено') ? 404 : 500;
      res.status(code).json({ error: msg });
    }
  });

  r.delete('/conversations/:id/messages', requireAuth, (req, res) => {
    const convId = req.params.id;
    if (!db.isMember(convId, req.user.id))
      return res.status(403).json({ error: 'Not a member' });
    // Для групповых чатов содержимое может удалить только админ группы.
    // Direct-чаты (1-на-1) и monolog — любой участник.
    const conv = db.getConversationById(convId);
    if (conv?.type === 'group' && conv.admin_id !== req.user.id) {
      return res.status(403).json({
        error: 'Только администратор группы может удалить содержимое чата',
        code: 'ADMIN_ONLY',
      });
    }
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
    // Приглашённые получают 'group:invited' — у них появится pending-чат в списке
    if (group.invitedIds?.length) {
      broadcast(group.invitedIds, { type: 'group:invited', conversationId: group.id });
    }
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
    // Админ группы видит и pending — чтобы понимать кто ещё не подтвердил
    const conv = db.getConversationById(req.params.id);
    const includePending = conv?.admin_id === req.user.id;
    res.json(db.getGroupMembers(req.params.id, includePending));
  });

  r.post('/groups/:id/members', requireAuth, (req, res) => {
    try {
      const target = db.findUserById(req.body.userId);
      if (!target) return res.status(404).json({ error: 'User not found' });
      const r2 = db.addGroupMember(req.params.id, req.user.id, req.body.userId);
      // Уведомление приглашённому — обновить список чатов
      broadcast([req.body.userId], { type: 'group:invited', conversationId: req.params.id });
      // Существующим активным членам — заявка ещё не активна, поэтому не шлём member_added
      res.json({ ok: true, status: r2?.status || 'pending', alreadyMember: !!r2?.alreadyMember });
    } catch(e) { res.status(403).json({ error: e.message }); }
  });

  r.delete('/groups/:id/members/:userId', requireAuth, (req, res) => {
    try {
      const members = db.getConversationMembers(req.params.id);
      db.removeGroupMember(req.params.id, req.user.id, req.params.userId);
      broadcast(members, { type: 'group:member_removed', conversationId: req.params.id, userId: req.params.userId });
      // Удаляемого тоже уведомляем (вдруг он сейчас в чате)
      broadcast([req.params.userId], { type: 'group:member_removed', conversationId: req.params.id, userId: req.params.userId });
      res.json({ ok: true });
    } catch(e) { res.status(403).json({ error: e.message }); }
  });

  // Принять приглашение в группу (pending → active)
  r.post('/groups/:id/accept', requireAuth, (req, res) => {
    try {
      const r2 = db.acceptGroupInvite(req.params.id, req.user.id);
      const members = db.getConversationMembers(req.params.id);
      // Уведомляем активных участников — у них в списке появится новый участник
      broadcast(members, { type: 'group:member_added', conversationId: req.params.id, userId: req.user.id });
      // Себя тоже — фронт должен перезагрузить список чатов
      broadcast([req.user.id], { type: 'group:invite_accepted', conversationId: req.params.id });
      res.json({ ok: true, alreadyActive: !!r2?.alreadyActive });
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  });

  // Отклонить приглашение в группу — запись удаляется
  r.post('/groups/:id/decline', requireAuth, (req, res) => {
    db.declineGroupInvite(req.params.id, req.user.id);
    broadcast([req.user.id], { type: 'group:invite_declined', conversationId: req.params.id });
    res.json({ ok: true });
  });

  // ── Group invite links (admin shares a link, anyone can join) ────────────
  // Только админ группы может сгенерировать ссылку. Сама ссылка self-contained
  // (HMAC-подписанный токен), без записи в БД.
  r.post('/groups/:id/invite-link', requireAuth, (req, res) => {
    const conv = db.getConversationById(req.params.id);
    if (!conv || conv.type !== 'group') return res.status(404).json({ error: 'Группа не найдена' });
    if (conv.admin_id !== req.user.id) return res.status(403).json({ error: 'Только админ группы может создавать ссылки' });
    const token = awo.signGroupInvite(conv.id, req.user.id);
    res.json({ token, ttl_days: 30 });
  });

  // Публичное превью группы по токену (без auth) — для landing-страницы /gjoin.
  r.get('/group-invite/:token', (req, res) => {
    const data = awo.verifyGroupInvite(req.params.token);
    if (!data) return res.status(400).json({ error: 'Ссылка недействительна или устарела' });
    const conv = db.getConversationById(data.groupId);
    if (!conv || conv.type !== 'group') return res.status(404).json({ error: 'Группа не найдена' });
    const inviter = db.findUserById(data.inviterId);
    if (!inviter || inviter.is_blocked) return res.status(404).json({ error: 'Приглашающий недоступен' });
    // Если приглашающий уже не админ — ссылка теряет силу
    if (conv.admin_id !== inviter.id) return res.status(400).json({ error: 'Приглашающий больше не админ группы' });
    const memberCount = db.getGroupMembers(conv.id, false).length;
    res.json({
      group:   { id: conv.id, name: conv.name, icon: conv.icon, member_count: memberCount },
      inviter: { id: inviter.id, name: inviter.name, avatar: inviter.avatar },
    });
  });

  // Принять приглашение (auth required). Добавляет юзера в группу сразу как active.
  r.post('/group-invite/:token/accept', requireAuth, (req, res) => {
    const data = awo.verifyGroupInvite(req.params.token);
    if (!data) return res.status(400).json({ error: 'Ссылка недействительна или устарела' });
    const conv = db.getConversationById(data.groupId);
    if (!conv || conv.type !== 'group') return res.status(404).json({ error: 'Группа не найдена' });
    const inviter = db.findUserById(data.inviterId);
    if (!inviter || conv.admin_id !== inviter.id) {
      return res.status(400).json({ error: 'Ссылка недействительна' });
    }
    try {
      const result = db.joinGroupViaInvite(conv.id, req.user.id, data.inviterId);
      // Приглашающего сразу в контакты к новичку
      try { db.addContact(req.user.id, data.inviterId, null); } catch {}
      // Уведомить участников и нового юзера о появлении чата
      try {
        const members = db.getGroupMembers(conv.id, false).map(m => m.id);
        broadcast(members, { type: 'group:member_joined', conversationId: conv.id, userId: req.user.id });
        broadcast([req.user.id], { type: 'conversation:added', chat_id: conv.id });
      } catch {}
      // Системное сообщение в чат
      if (!result.alreadyActive) {
        try {
          db.createMessage({
            conversationId: conv.id,
            senderId: db.SYSTEM_USER_ID,
            text: `👋 ${req.user.name} присоединился по приглашению`,
          });
        } catch {}
      }
      res.json({ ok: true, conversationId: conv.id, alreadyActive: !!result.alreadyActive });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
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

  // Глобальный поиск по сообщениям юзера (для поиска по всем чатам)
  r.get('/search/messages', requireAuth, (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json([]);
    res.json(db.searchAllMessages(req.user.id, q));
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

      // image — 5 МБ обычным, 15 МБ Super
      const imgMatch = data.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/s);
      if (imgMatch) {
        const [, mime, b64] = imgMatch;
        const ALLOWED = ['image/jpeg','image/png','image/webp','image/gif'];
        if (!ALLOWED.includes(mime)) return res.status(400).json({ error: 'Unsupported image type' });
        const buf = Buffer.from(b64, 'base64');
        const maxBytes = req.user.is_super ? 15 * 1024 * 1024 : 5 * 1024 * 1024;
        if (buf.length > maxBytes) {
          const maxMb = req.user.is_super ? 15 : 5;
          return res.status(400).json({ error: `Image too large (max ${maxMb} MB)` });
        }
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

      // audio — 5 МБ обычным, 30 МБ Super
      const audMatch = data.match(/^data:(audio\/[a-zA-Z0-9]+);base64,(.+)$/s);
      if (audMatch) {
        const [, mime, b64] = audMatch;
        const buf = Buffer.from(b64, 'base64');
        const maxBytes = req.user.is_super ? 30 * 1024 * 1024 : 5 * 1024 * 1024;
        if (buf.length > maxBytes) {
          const maxMb = req.user.is_super ? 30 : 5;
          return res.status(400).json({ error: `Audio too large (max ${maxMb} MB)` });
        }
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
    if (status === 'active') return res.json(db.getActiveMoments(req.user.id));
    res.json(db.getMyMoments(req.user.id, status));
  });

  // Изменить порядок активных моментов (только Супер)
  r.post('/moments/reorder', requireAuth, (req, res) => {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ error: 'orderedIds required' });
    }
    db.reorderMoments(req.user.id, orderedIds);
    res.json({ ok: true });
  });

  // Закладки (talk reaction)
  r.get('/moments/saved', requireAuth, (req, res) => {
    const items = db.getSavedMoments(req.user.id);
    res.json(items.map(m => ({ ...m, myReaction: 'talk' })));
  });

  // Список реагировавших (только для Super-автора)
  r.get('/moments/:id/reactors', requireAuth, (req, res) => {
    const m = db.getMomentById(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (m.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!req.user.is_super) return res.status(403).json({ error: 'Super required' });
    res.json(db.getMomentReactorsList(req.params.id));
  });

  // Один момент
  // Публичный — момент по share-ссылке открывается без логина.
  // Если юзер залогинен, дополнительно возвращаем myReaction.
  r.get('/moments/:id', optionalAuth, (req, res) => {
    const m = db.getMomentById(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    // Удалённое навсегда — не показываем никому
    if (m.status === 'deleted') return res.status(404).json({ error: 'Not found' });
    // Проверка прав на просмотр заблокированного контента
    const requester = req.user ? db.findUserById(req.user.id) : null;
    const isAdmin = !!requester?.is_admin;
    const author = db.findUserById(m.user_id);
    // Заблокированный момент / автор-блок: видит только админ (чтобы проверить
    // жалобу) и сам автор (чтобы видеть свой архив)
    const blocked = m.status === 'blocked' || author?.is_blocked || author?.is_deleted;
    if (blocked && !isAdmin && requester?.id !== m.user_id) {
      return res.status(404).json({ error: 'Not found' });
    }
    const myReaction = req.user
      ? db.getUserMomentReaction(req.params.id, req.user.id)
      : null;
    res.json({ ...m, myReaction: myReaction?.reaction || null });
  });

  // Создать момент
  r.post('/moments', requireAuth, async (req, res) => {
    try {
      const { text, mediaUrl, mediaType, mediaDuration, isSearch, moodEmoji: userMoodEmoji, mediaPosition } = req.body;
      if (!text?.trim()) return res.status(400).json({ error: 'text required' });
      if (text.length > 2000) return res.status(400).json({ error: 'Текст слишком длинный (макс. 2000 символов)' });

      const MAX_ACTIVE = req.user.is_super ? 3 : 1;
      const activeCount = db.getActiveMomentCount(req.user.id);
      if (activeCount >= MAX_ACTIVE) {
        const existing = db.getActiveMoment(req.user.id);
        return res.status(409).json({ error: 'already_has_active', existing });
      }

      const embeddedVideo = await parseEmbeddedVideo(text);
      const hasEmbeddedVideo = !!embeddedVideo;
      const autoTags = detectTags(text, mediaType, hasEmbeddedVideo);
      // Если юзер сам выбрал эмодзи — используем его, иначе авто-определяем
      const moodEmoji = userMoodEmoji || detectMoodEmoji(text, isSearch);
      const moment = db.createMoment({
        userId: req.user.id,
        text: text.trim(),
        mediaType: mediaType || null,
        mediaUrl: mediaUrl || null,
        mediaDuration: mediaDuration || null,
        autoTags,
        isSearch: !!isSearch,
        embeddedVideo,
        moodEmoji,
        mediaPosition: mediaPosition || null,
      });
      // WebSocket push to contacts
      const contactOwners = db.getContactOwners(req.user.id);
      broadcast(contactOwners, { type: 'moment:new', moment: { ...moment, mood_emoji: moodEmoji } });
      res.json({ ...moment, mood_emoji: moodEmoji });
    } catch (err) {
      console.error('POST /moments error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Редактировать момент
  r.patch('/moments/:id', requireAuth, async (req, res) => {
    try {
      const m = db.getMomentById(req.params.id);
      if (!m || m.status === 'deleted') return res.status(404).json({ error: 'Not found' });
      if (m.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
      const { text, isSearch, moodEmoji: userMoodEmoji, mediaPosition } = req.body;
      const newText = text?.trim() ?? m.text;
      const embeddedVideo = await parseEmbeddedVideo(newText);
      const hasEmbeddedVideo = !!embeddedVideo;
      const autoTags = detectTags(newText, m.media_type, hasEmbeddedVideo);
      // Если юзер прислал moodEmoji — обновляем, иначе сохраняем сохранённое (или авто-определяем если пусто)
      const moodEmoji = userMoodEmoji !== undefined
        ? (userMoodEmoji || null)
        : (m.mood_emoji || detectMoodEmoji(newText, isSearch !== undefined ? isSearch : m.is_search));
      const updated = db.updateMoment(req.params.id, {
        text: newText,
        mediaUrl: m.media_url,
        mediaType: m.media_type,
        mediaDuration: m.media_duration,
        autoTags,
        isSearch: isSearch !== undefined ? isSearch : m.is_search,
        embeddedVideo,
        moodEmoji,
        mediaPosition: mediaPosition !== undefined ? (mediaPosition || null) : undefined,
      });
      const members = db.getContactOwners(req.user.id);
      broadcast(members, { type: 'moment:updated', moment: { ...updated, mood_emoji: moodEmoji } });
      res.json({ ...updated, mood_emoji: moodEmoji });
    } catch (err) {
      console.error('PATCH /moments/:id error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
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
    if (activeCount >= (req.user.is_super ? 3 : 1)) return res.status(409).json({ error: 'already_has_active' });
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

    res.json({ ok: true });
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

  // ── Reports / Жалобы ───────────────────────────────────────────────────
  // Юзер жалуется на момент или другого юзера. Минимум 20 символов в описании.
  r.post('/reports', requireAuth, (req, res) => {
    const { targetType, targetId, reason } = req.body;
    if (!['moment','user','message'].includes(targetType)) {
      return res.status(400).json({ error: 'Неверный тип объекта' });
    }
    if (!targetId) return res.status(400).json({ error: 'Не указан объект' });
    const trimmed = (reason || '').trim();
    if (trimmed.length < 5) {
      return res.status(400).json({ error: 'Опишите ситуацию подробнее (минимум 5 символов)' });
    }
    if (trimmed.length > 1000) {
      return res.status(400).json({ error: 'Слишком длинное описание (максимум 1000 символов)' });
    }
    // Определяем target_user_id для удобства админки
    let targetUserId = null;
    if (targetType === 'moment') {
      const m = db.getMomentById(targetId);
      if (!m) return res.status(404).json({ error: 'Момент не найден' });
      targetUserId = m.user_id;
    } else if (targetType === 'user') {
      const u = db.findUserById(targetId);
      if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
      targetUserId = u.id;
    }
    const report = db.createReport({
      reporterId: req.user.id,
      targetType, targetId, targetUserId, reason: trimmed,
    });
    res.json({ ok: true, id: report.id });
  });

  // Админ: список жалоб
  r.get('/admin/reports', requireAdmin, (req, res) => {
    const status = req.query.status || 'open';
    res.json(db.getReports({ status }));
  });

  // Админ: закрыть жалобу
  r.patch('/admin/reports/:id', requireAdmin, (req, res) => {
    const { action } = req.body; // 'resolved' | 'dismissed'
    if (!['resolved','dismissed'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    db.resolveReport(req.params.id, req.user.id, action);
    res.json({ ok: true });
  });

  // ── HEY-заведующий: системные публикации (admin only) ──────────────────
  // Опубликовать момент от лица системного аккаунта
  r.post('/admin/system/moment', requireAdmin, async (req, res) => {
    try {
      const { text, mediaUrl, mediaType, mediaDuration, moodEmoji, mediaPosition } = req.body;
      if (!text?.trim()) return res.status(400).json({ error: 'text required' });
      if (text.length > 2000) return res.status(400).json({ error: 'Текст слишком длинный (макс. 2000)' });

      // Архивируем предыдущий активный (один за раз, как у обычных юзеров — но для system без лимита можно)
      const embeddedVideo = await parseEmbeddedVideo(text);
      const autoTags = detectTags(text, mediaType, !!embeddedVideo);
      const moment = db.createMoment({
        userId: db.SYSTEM_USER_ID,
        text: text.trim(),
        mediaType: mediaType || null,
        mediaUrl: mediaUrl || null,
        mediaDuration: mediaDuration || null,
        autoTags,
        isSearch: false,
        embeddedVideo,
        moodEmoji: moodEmoji || null,
        mediaPosition: mediaPosition || null,
      });
      // Лог админ-действия
      if (db.logAdminAction) {
        db.logAdminAction({ adminId: req.user.id, action: 'system_moment_create', targetMomentId: moment.id });
      }
      // Бродкаст всем юзерам у которых системный в контактах (это все юзеры по сути)
      const allUserIds = db.getContactOwners(db.SYSTEM_USER_ID);
      broadcast(allUserIds, { type: 'moment:new', moment });
      res.json({ ok: true, moment });
    } catch (err) {
      console.error('POST /admin/system/moment error:', err);
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  });

  // Массовая рассылка сообщения от HEY-заведующего всем юзерам
  r.post('/admin/system/broadcast', requireAdmin, (req, res) => {
    try {
      const { text, attachment } = req.body;
      const trimmed = (text || '').trim();
      // Можно либо текст, либо вложение, либо то и другое
      if (!trimmed && !attachment) return res.status(400).json({ error: 'Нужен текст или вложение' });
      if (trimmed.length > 2000) return res.status(400).json({ error: 'Слишком длинно (макс. 2000)' });
      // Минимальная валидация attachment
      if (attachment) {
        const okType = ['image', 'images', 'audio'].includes(attachment.type);
        if (!okType) return res.status(400).json({ error: 'Неверный тип вложения' });
        if (attachment.type === 'image'  && !attachment.url)  return res.status(400).json({ error: 'Нет url' });
        if (attachment.type === 'images' && (!Array.isArray(attachment.urls) || !attachment.urls.length))
          return res.status(400).json({ error: 'Нет urls' });
      }

      // Все юзеры кроме самого системного и удалённых
      const recipients = db.getContactOwners(db.SYSTEM_USER_ID); // у всех системный в контактах
      const broadcastId = 'br_' + Math.random().toString(36).slice(2, 14);
      let delivered = 0;
      for (const userId of recipients) {
        try {
          // Создаём (если нет) диалог с системным
          const conv = db.getOrCreateDirectConversation(userId, db.SYSTEM_USER_ID);
          // Создаём сообщение от имени системного юзера с общим broadcast_id
          const saved = db.createMessage({
            conversationId: conv.id,
            senderId: db.SYSTEM_USER_ID,
            text: trimmed || null,
            attachment: attachment || null,
            broadcastId,
          });
          // Бродкастим получателю
          broadcast([userId], {
            type: 'message:new',
            message: {
              ...saved,
              sender_name: 'HEY-заведующий',
              conversationId: conv.id,
            },
          });
          delivered++;
        } catch (e) {
          console.warn('[broadcast] fail for', userId, e.message);
        }
      }
      if (db.logAdminAction) {
        db.logAdminAction({
          adminId: req.user.id,
          action: 'system_broadcast',
          reason: `recipients=${delivered}; text="${trimmed.slice(0, 100)}"`,
        });
      }
      res.json({ ok: true, delivered, total: recipients.length, broadcastId });
    } catch (err) {
      console.error('POST /admin/system/broadcast error:', err);
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  });

  // ── HEY-заведующий: чтение моментов и рассылок (admin only) ────────────
  r.get('/admin/system/moments', requireAdmin, (req, res) => {
    const status = req.query.status || 'all';
    res.json(db.getSystemMoments({ status }));
  });

  r.get('/admin/system/broadcasts', requireAdmin, (req, res) => {
    res.json(db.getSystemBroadcasts({}));
  });

  // Редактировать системный момент
  r.patch('/admin/system/moments/:id', requireAdmin, async (req, res) => {
    try {
      const m = db.getMomentById(req.params.id);
      if (!m || m.user_id !== db.SYSTEM_USER_ID) return res.status(404).json({ error: 'Not found' });
      const { text, mediaUrl, mediaType, moodEmoji, mediaPosition } = req.body;
      const newText = (text ?? m.text)?.trim();
      if (!newText) return res.status(400).json({ error: 'text required' });
      const embeddedVideo = await parseEmbeddedVideo(newText);
      const autoTags = detectTags(newText, mediaType ?? m.media_type, !!embeddedVideo);
      const updated = db.updateMoment(req.params.id, {
        text: newText,
        mediaUrl:  mediaUrl  !== undefined ? mediaUrl  : m.media_url,
        mediaType: mediaType !== undefined ? mediaType : m.media_type,
        autoTags,
        embeddedVideo,
        moodEmoji:     moodEmoji     !== undefined ? moodEmoji     : undefined,
        mediaPosition: mediaPosition !== undefined ? mediaPosition : undefined,
      });
      if (db.logAdminAction) db.logAdminAction({
        adminId: req.user.id, action: 'system_moment_edit', targetMomentId: req.params.id,
      });
      // Рассылаем обновление всем кто видит этот момент (контакты системного = все)
      const recipients = db.getContactOwners(db.SYSTEM_USER_ID);
      broadcast(recipients, { type: 'moment:updated', moment: updated });
      res.json({ ok: true, moment: updated });
    } catch (e) {
      console.error('PATCH /admin/system/moments/:id', e);
      res.status(500).json({ error: e.message || 'Internal error' });
    }
  });

  // Удалить системный момент
  r.delete('/admin/system/moments/:id', requireAdmin, (req, res) => {
    try {
      const m = db.getMomentById(req.params.id);
      if (!m || m.user_id !== db.SYSTEM_USER_ID) return res.status(404).json({ error: 'Not found' });
      db.deleteMomentForever(req.params.id);
      if (db.logAdminAction) db.logAdminAction({
        adminId: req.user.id, action: 'system_moment_delete', targetMomentId: req.params.id,
      });
      const recipients = db.getContactOwners(db.SYSTEM_USER_ID);
      broadcast(recipients, { type: 'moment:deleted', momentId: req.params.id });
      res.json({ ok: true });
    } catch (e) {
      console.error('DELETE /admin/system/moments/:id', e);
      res.status(500).json({ error: e.message || 'Internal error' });
    }
  });

  // Редактировать ВСЮ рассылку (текст меняется во всех копиях у каждого юзера)
  r.patch('/admin/system/broadcasts/:id', requireAdmin, (req, res) => {
    try {
      const { text } = req.body;
      const trimmed = (text || '').trim();
      if (!trimmed) return res.status(400).json({ error: 'text required' });
      if (trimmed.length > 2000) return res.status(400).json({ error: 'Слишком длинно' });
      const changed = db.editBroadcast(req.params.id, trimmed);
      if (!changed) return res.status(404).json({ error: 'Not found' });
      if (db.logAdminAction) db.logAdminAction({
        adminId: req.user.id, action: 'system_broadcast_edit',
        reason: `broadcast=${req.params.id}; changed=${changed}`,
      });
      res.json({ ok: true, changed });
    } catch (e) {
      console.error('PATCH /admin/system/broadcasts/:id', e);
      res.status(500).json({ error: e.message || 'Internal error' });
    }
  });

  // Удалить ВСЮ рассылку (все сообщения с этим broadcast_id у всех юзеров)
  r.delete('/admin/system/broadcasts/:id', requireAdmin, (req, res) => {
    try {
      const changed = db.deleteBroadcast(req.params.id);
      if (db.logAdminAction) db.logAdminAction({
        adminId: req.user.id, action: 'system_broadcast_delete',
        reason: `broadcast=${req.params.id}; deleted=${changed}`,
      });
      res.json({ ok: true, deleted: changed });
    } catch (e) {
      console.error('DELETE /admin/system/broadcasts/:id', e);
      res.status(500).json({ error: e.message || 'Internal error' });
    }
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

  // Полное удаление аккаунта (анонимизация). Только для админов.
  r.delete('/admin/users/:id', requireAdmin, (req, res) => {
    const user = db.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (user.id === req.user.id) return res.status(400).json({ error: 'Нельзя удалить свой аккаунт через админку' });
    if (user.is_admin)             return res.status(400).json({ error: 'Сначала снимите права администратора' });
    db.deleteUserAccount(req.params.id);
    if (db.logAdminAction) db.logAdminAction({
      adminId: req.user.id,
      action: 'delete_user',
      targetUserId: req.params.id,
      reason: `phone=${user.phone}`,
    });
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

  r.post('/admin/users/:id/make-super', requireAdmin, (req, res) => {
    const user = db.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    db.makeUserSuper(req.params.id);
    res.json({ ok: true });
  });

  r.post('/admin/users/:id/revoke-super', requireAdmin, (req, res) => {
    const user = db.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    db.revokeUserSuper(req.params.id);
    res.json({ ok: true });
  });

  // Установить срок действия Super: { mode: 'set'|'unlimited'|'revoke',
  //   expires_at: <unix-ts> (для mode='set') }
  r.patch('/admin/users/:id/super', requireAdmin, (req, res) => {
    const user = db.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const { mode, expires_at } = req.body || {};
    try {
      const result = db.setSuperExpiry(req.params.id, mode, expires_at);
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
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

  // ═════════════════════════════════════════════════════════════════════════
  // AWO (АвтоВебОфис) integration
  // ═════════════════════════════════════════════════════════════════════════

  // Публичная валидация /join-ссылки (без auth). Возвращает ok=true и подготовленный
  // школьный инвайт-код, который фронт прокинет в /register.
  //
  // Авторизация ссылки — двухуровневая (АВО не умеет считать HMAC в шаблонах):
  //   1. Если есть валидный HMAC `sig` — пропускаем (классический путь по ТЗ)
  //   2. Если `sig` нет/невалиден — ищем активный школьный инвайт для этого email.
  //      Инвайт создаётся только webhook'ом от АВО (защищён токеном),
  //      то есть «доверие к свежей оплате» — подделать ссылку с произвольным email
  //      бесполезно: для него не будет инвайта.
  r.get('/join/validate', rateLimit(30, 60 * 1000), (req, res) => {
    const email  = (req.query.email  || '').trim().toLowerCase();
    const course = (req.query.course || '').trim();
    const sig    = (req.query.sig    || '').trim();

    if (!email) return res.status(400).json({ ok: false, error: 'email обязателен' });
    if (!awo.isValidEmail(email)) return res.status(400).json({ ok: false, error: 'Неверный формат email' });

    const validSig = sig && awo.verifyJoin(email, course, sig);

    // Уже есть аккаунт с таким email — фронт покажет «войди»
    const existing = db.findUserByEmail(email);
    if (existing) {
      // Для существующего пользователя — пускаем только если есть валидная подпись
      // ИЛИ есть запись об оплате в awo_processed (защита от перебора)
      if (!validSig) {
        return res.json({ ok: true, alreadyRegistered: true, email, course });
      }
      return res.json({ ok: true, alreadyRegistered: true, email, course });
    }

    // Ищем подготовленный webhook'ом инвайт
    let invite = db.findActiveSchoolInviteByEmail(email);

    // Если подписи нет и инвайта нет — отказ. Возможно оплата ещё не дошла.
    if (!validSig && !invite) {
      return res.status(403).json({
        ok: false,
        error: 'Ссылка недействительна или оплата ещё не подтверждена. Попробуйте через несколько минут.',
      });
    }

    // Если подпись валидна, но инвайта нет (webhook ещё не пришёл) — создаём на лету
    if (validSig && !invite) {
      invite = db.createSchoolInvite({ bound_email: email, course });
    }

    res.json({
      ok: true,
      alreadyRegistered: false,
      email,
      course: invite.course || course,
      schoolInviteCode: invite.code,
      schoolName: db.getSchoolAccount()?.name || 'Школа',
      // Поля для предзаполнения формы регистрации (из payload АВО)
      prefillName:  invite.bound_name  || null,
      prefillPhone: invite.bound_phone || null,
    });
  });

  // Webhook от АВО — публичный endpoint, защищён токеном из .env (AWO_WEBHOOK_TOKEN)
  r.post('/integrations/awo/webhook', rateLimit(120, 60 * 1000), (req, res) => {
    // Логируем raw payload до любых проверок (для отладки)
    const payload = req.body || {};
    console.log('[AWO webhook]', JSON.stringify(payload).slice(0, 500));

    if (!awo.checkWebhookToken(req)) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const id_account        = payload.id_account || payload.invoice_id || payload.id;
    const id_account_status = Number(payload.id_account_status ?? payload.status ?? 0);
    // АВО кладёт товары в payload.lines = { lineId: { goods: '...', id_goods, ... } }.
    // Берём первый goods из lines (обычно заказ из одной позиции). Fallback на
    // корневые поля для совместимости с альтернативными webhook-форматами.
    let goodsFromLines = '';
    if (payload.lines && typeof payload.lines === 'object') {
      const first = Object.values(payload.lines).find(l => l && (l.goods || l.product));
      if (first) goodsFromLines = (first.goods || first.product || '').toString().trim();
    }
    const goods             = (goodsFromLines || payload.goods || payload.product || payload.course || '').toString().trim();
    const rawEmail          = (payload.email || '').toString().trim().toLowerCase();
    const rawPhone          = payload.phone_number || payload.phone || null;
    // Имя из payload: last_name + name (или middle_name) — для предзаполнения
    // формы регистрации. Если в payload только одно поле — берём его.
    const rawName = [payload.last_name, payload.name]
      .map(s => (s || '').toString().trim())
      .filter(Boolean)
      .join(' ')
      .slice(0, 80) || null;

    if (!id_account) {
      return res.status(400).json({ error: 'id_account required' });
    }

    // Только статус «оплачен». Промежуточные статусы (1=создан, и т.д.) —
    // только логируем, НЕ пишем в awo_processed (иначе при последующем status=5
    // тот же id_account будет считаться обработанным и пропустится).
    if (id_account_status !== awo.AWO_STATUS_PAID) {
      console.log(`[AWO] счёт ${id_account} статус=${id_account_status} — пропускаем`);
      return res.json({ ok: true, ignored: 'status_' + id_account_status });
    }

    // Идемпотентность — срабатывает только для уже финально обработанных оплат
    if (db.awoIsProcessed(id_account)) {
      return res.json({ ok: true, ignored: 'already_processed' });
    }

    // Тестовый режим: фильтруем по курсу
    const settings = db.getAwoSettings();
    if (settings.test_mode) {
      const testCourse = (settings.test_course || '').trim().toLowerCase();
      if (testCourse && goods.toLowerCase() !== testCourse) {
        db.awoMarkProcessed({ id_account, email: rawEmail, phone: rawPhone, course: goods,
          result: 'ignored_test_mode', raw_payload: payload });
        console.log(`[AWO] тестовый режим: курс "${goods}" не совпадает с "${testCourse}" — игнор`);
        return res.json({ ok: true, ignored: 'test_mode' });
      }
    }

    // Валидация — email обязателен (основной ключ)
    if (!awo.isValidEmail(rawEmail)) {
      db.awoMarkProcessed({ id_account, email: rawEmail, phone: rawPhone, course: goods,
        result: 'invalid_email', raw_payload: payload });
      return res.status(400).json({ error: 'Invalid email' });
    }

    const phone = awo.normalizePhone(rawPhone);

    // Уже в HEY? Ищем ТОЛЬКО по email — он каноничный ключ ученика в АВО.
    // Phone может пересекаться у разных людей (например админ тестирует с одним
    // и тем же номером, но разными email), поэтому matching по phone здесь
    // приводил к ошибочному «опознанию» чужого аккаунта как ученика курса.
    // Phone оставляем fallback только если в payload вообще нет email.
    const existing = rawEmail
      ? db.findUserByEmail(rawEmail)
      : (phone ? db.findUserByPhone(phone) : null);
    if (existing) {
      let extraResult = 'user_exists';
      // Если есть маппинг курса → добавить в чат курса
      if (goods) {
        const chatId = db.getChatForCourse(goods);
        if (chatId) {
          try {
            const r = db.addUserToChat(chatId, existing.id);
            if (r.added) {
              try {
                db.createMessage({
                  conversationId: chatId,
                  senderId: db.getSchoolUserId(),
                  text: `🎓 ${existing.name} присоединился к курсу «${goods}»`,
                });
              } catch {}
              try { broadcast([existing.id], { type: 'conversation:added', chat_id: chatId }); } catch {}
              extraResult = 'user_exists_added_to_chat';
            } else {
              extraResult = 'user_exists_already_in_chat';
            }
          } catch (e) { console.error('[awo-existing-add]', e.message); extraResult = 'user_exists_chat_error'; }
        } else {
          extraResult = 'user_exists_no_chat_mapping';
        }
      }
      db.awoMarkProcessed({ id_account, email: rawEmail, phone, course: goods,
        result: extraResult, raw_payload: payload });
      return res.json({ ok: true, result: extraResult });
    }

    // Новый пользователь — создаём школьный инвайт с пред-заполненными
    // полями (name/phone), фронт подставит их на форму регистрации.
    const invite = db.createSchoolInvite({
      bound_email: rawEmail, bound_phone: phone, course: goods, bound_name: rawName,
    });
    db.awoMarkProcessed({ id_account, email: rawEmail, phone, course: goods,
      invite_code: invite.code, result: 'invite_created', raw_payload: payload });

    res.json({ ok: true, result: 'invite_created', invite_code: invite.code });
  });

  // Админка: настройки AWO
  r.get('/admin/awo/settings', requireAdmin, (req, res) => {
    res.json(db.getAwoSettings());
  });
  r.put('/admin/awo/settings', requireAdmin, (req, res) => {
    const { test_mode, test_course, chat_excludes, school_account_id } = req.body || {};
    try {
      res.json(db.setAwoSettings({ test_mode, test_course, chat_excludes, school_account_id }));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Админка: маппинг курс ↔ групповой чат
  r.get('/admin/awo/course-chats', requireAdmin, (req, res) => {
    res.json(db.listAwoCourseChats());
  });
  r.post('/admin/awo/course-chats', requireAdmin, (req, res) => {
    const { course, chat_id } = req.body || {};
    if (!course || !chat_id) return res.status(400).json({ error: 'course и chat_id обязательны' });
    try {
      db.setAwoCourseChat(course, chat_id);
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.delete('/admin/awo/course-chats/:course', requireAdmin, (req, res) => {
    db.deleteAwoCourseChat(req.params.course);
    res.json({ ok: true });
  });

  // Админка: список всех групповых чатов (для выбора при маппинге)
  r.get('/admin/group-chats', requireAdmin, (req, res) => {
    res.json(db.listAllGroupChats());
  });

  // Админка: лог webhook'ов AWO
  r.get('/admin/awo/log', requireAdmin, (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    res.json(db.awoListProcessed(limit));
  });

  // Админка: сгенерировать /join-ссылку (для ручной отправки/тестирования)
  r.post('/admin/awo/join-link', requireAdmin, (req, res) => {
    const email  = (req.body?.email  || '').trim().toLowerCase();
    const course = (req.body?.course || '').trim();
    if (!awo.isValidEmail(email)) return res.status(400).json({ error: 'Неверный email' });
    const sig = awo.signJoin(email, course);
    const base = process.env.PUBLIC_URL || (req.protocol + '://' + req.get('host'));
    const url = `${base}/join?email=${encodeURIComponent(email)}&course=${encodeURIComponent(course)}&sig=${sig}`;
    res.json({ url, sig });
  });

  // ── Web Push ──────────────────────────────────────────────────────────────
  r.get('/push/public-key', (_, res) => {
    res.json({ publicKey: push.getPublicKey() });
  });

  r.post('/push/subscribe', requireAuth, (req, res) => {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    try {
      db.pushSubscribe({
        userId: req.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth:   keys.auth,
        userAgent: req.get('User-Agent') || null,
      });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  r.post('/push/unsubscribe', requireAuth, (req, res) => {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
    db.pushUnsubscribe(endpoint);
    res.json({ ok: true });
  });

  // Тестовый пуш самому себе (для проверки настройки)
  r.post('/push/test', requireAuth, async (req, res) => {
    const subs = db.getPushSubscriptions(req.user.id);
    if (!subs.length) return res.status(400).json({ error: 'Нет активных подписок' });
    const gone = await push.sendPushToUser(subs, {
      title: 'HEY',
      body:  'Тестовое уведомление работает ✓',
      url:   '/chats',
    });
    if (gone.length) db.removePushSubscriptions(gone);
    res.json({ ok: true, sent: subs.length - gone.length, cleaned: gone.length });
  });

  // ── Admin: Test users mode ───────────────────────────────────────────────
  r.get('/admin/test-users/status', requireAdmin, (req, res) => {
    res.json({
      enabled: db.isTestUsersEnabled(),
      count: db.getTestUserIds().length,
    });
  });
  r.post('/admin/test-users/toggle', requireAdmin, (req, res) => {
    const { enabled } = req.body || {};
    db.setTestUsersEnabled(!!enabled);
    // При включении — автоматически сидим (идемпотентно)
    if (enabled && db.getTestUserIds().length === 0) {
      try { db.seedTestUsers(); } catch (e) { console.error('[test-users seed]', e.message); }
    }
    res.json({
      enabled: db.isTestUsersEnabled(),
      count: db.getTestUserIds().length,
    });
  });
  r.post('/admin/test-users/reseed', requireAdmin, (req, res) => {
    try {
      const r2 = db.seedTestUsers();
      res.json({ ok: true, ...r2 });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  r.delete('/admin/test-users', requireAdmin, (req, res) => {
    try {
      const r2 = db.clearTestUsers();
      db.setTestUsersEnabled(false);
      res.json({ ok: true, ...r2 });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  r.get('/health', (_, res) => res.json({ ok: true }));

  return r;
};