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
const { showVpnNoteFromRequest } = require('./geoHint');
const { CURRENT_TERMS_VERSION } = require('./legal');

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

function requireSuperAdmin(req, res, next) {
  requireAdmin(req, res, () => {
    if (!req.adminUser?.is_super_admin) {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
  });
}

// Middleware: проверяет что юзер — бизнес-аккаунт (approved) или админ.
// Используется для входа в AWO-функционал (управление школами).
function requireBusinessOrAdmin(req, res, next) {
  requireAuth(req, res, () => {
    const user = db.findUserById(req.user.id);
    if (!user || user.is_blocked) return res.status(403).json({ error: 'Forbidden' });
    // Доступ к /integrations/awo получают:
    //  • системные админы (is_admin);
    //  • бизнес-юзеры со статусом approved (свои школы);
    //  • со-админы хотя бы одной школы — пускаем посмотреть список и
    //    зайти в настройки той школы, куда их добавил владелец.
    const hasTenantAccess = db.listTenantsForUser(user.id).length > 0;
    if (!user.is_admin && user.business_status !== 'approved' && !hasTenantAccess) {
      return res.status(403).json({
        error: 'Доступ только для бизнес-аккаунтов',
        code: 'BUSINESS_REQUIRED',
        business_status: user.business_status || 'none',
      });
    }
    req.businessUser = user;
    next();
  });
}

function publicOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

async function probeMediaUrl(label, url, headers = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      headers: { Range: 'bytes=0-511', ...headers },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      label,
      url,
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get('content-type') || null,
      contentLength: res.headers.get('content-length') || null,
      bytesRead: buf.length,
      firstBytesHex: buf.subarray(0, 24).toString('hex'),
      firstText: buf.subarray(0, 80).toString('utf8').replace(/\s+/g, ' ').slice(0, 80),
    };
  } catch (e) {
    return {
      label,
      url,
      ok: false,
      error: e?.name === 'AbortError' ? 'timeout' : (e?.message || String(e)),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function buildMediaDiagnostics(req, input) {
  const { s3KeyFromUrl, PUBLIC_BASE } = require('./mediaUrl');
  const key = s3KeyFromUrl(input.src || input.currentSrc || input.failedUrl || '');
  const origin = publicOrigin(req);
  const probes = [];

  if (!key) {
    return { key: null, probes, error: 'no_s3_key' };
  }

  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const ua = input.userAgent || req.headers['user-agent'] || '';
  const commonHeaders = ua ? { 'User-Agent': ua } : {};

  probes.push(await probeMediaUrl('same-origin /media', `${origin}/media/${encodedKey}`, commonHeaders));
  probes.push(await probeMediaUrl('same-origin /api/media', `${origin}/api/media/${encodedKey}`, commonHeaders));
  probes.push(await probeMediaUrl('same-origin /api/media jpeg', `${origin}/api/media/${encodedKey}?format=jpeg`, commonHeaders));
  probes.push(await probeMediaUrl('direct s3', `${PUBLIC_BASE()}/${key}`, commonHeaders));

  if (typeof storage.getReadUrl === 'function') {
    try {
      const signedUrl = await storage.getReadUrl(key, 300);
      probes.push(await probeMediaUrl('presigned s3', signedUrl, commonHeaders));
    } catch (e) {
      probes.push({ label: 'presigned s3', ok: false, error: e?.message || String(e) });
    }
  }

  return { key, probes };
}

function s3DeleteEnabled() {
  return process.env.S3_SWEEP_ALLOW_DELETE === '1';
}

// Ручное удаление из админ-галереи — только confirm-токен + requireAdmin.
// Авто-sweep по-прежнему требует S3_SWEEP_ALLOW_DELETE=1.
function adminManualS3DeleteAllowed(req, expected) {
  return hasS3DeleteConfirmation(req, expected);
}

function hasS3DeleteConfirmation(req, expected) {
  return req.body?.confirm === expected || req.query?.confirm === expected;
}

// Middleware для tenant-scoped ручек: пускает либо системного админа,
// либо владельца tenant'а (tenant.owner_id === req.user.id). Кладёт в req:
//   req.tenant     — объект tenant'а
//   req.tenantUser — db-объект юзера-владельца
// Защищает per-tenant route'ы от self-service UI (шаг 4.2) — но UI пока
// admin-only, так что эта проверка — фундамент для будущего.
function requireTenantAccess(getTenantIdFromReq) {
  return (req, res, next) => requireAuth(req, res, () => {
    const tid = (typeof getTenantIdFromReq === 'function')
      ? getTenantIdFromReq(req)
      : (req.params.tenantId || req.query.tenantId || req.body?.tenantId);
    if (!tid) return res.status(400).json({ error: 'tenantId required' });
    const tenant = db.getTenantById(tid);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const user = db.findUserById(req.user.id);
    if (!user || user.is_blocked) return res.status(403).json({ error: 'Forbidden' });
    // Доступ к ручкам tenant'а: системный админ, владелец или со-админ
    // (запись в tenant_admins). Со-админ получает весь self-service:
    // привязки чатов к курсам, чтение логов, секрет вебхука, /join-ссылки.
    // Управление списком со-админов и удаление школы остаются за владельцем.
    const isOwner   = tenant.owner_id === user.id;
    const isCoAdmin = db.isTenantOwnerOrAdmin(tenant.id, user.id);
    if (!user.is_admin && !isOwner && !isCoAdmin) {
      return res.status(403).json({ error: 'Нет доступа к этой школе' });
    }
    req.tenant = tenant;
    req.tenantUser = user;
    req.isTenantOwner = isOwner || user.is_admin;
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

  // Моменты HEY-заведующего: WS-апдейты счётчиков шлём и админам в админке.
  function momentStatsNotifyIds(moment, extraUserIds = []) {
    const ids = new Set([moment.user_id, ...extraUserIds]);
    if (moment.user_id === db.SYSTEM_USER_ID) {
      db.getAdminIds().forEach(id => ids.add(id));
    }
    return [...ids];
  }

  r.get('/geo/hint', (req, res) => {
    const hint = showVpnNoteFromRequest(req);
    res.json({ showVpnNote: hint.show, source: hint.source });
  });

  r.post('/register', rateLimit(5, 15 * 60 * 1000), (req, res) => {
    const { phone, name, password, birthday, avatar, inviteUserId, email, schoolInviteCode, groupInviteToken, legalAccepted } = req.body;

    // Если есть groupInviteToken — валидируем заранее и достаём inviterId
    // (он же становится referrer'ом, как обычная invite-ссылка)
    let groupInvite = null;
    if (groupInviteToken) {
      const data = awo.verifyGroupInvite(groupInviteToken);
      if (data) {
        const conv = db.getConversationById(data.groupId);
        const inv  = db.findUserById(data.inviterId);
        if (conv && conv.type === 'group' && inv && !inv.is_blocked && db.isGroupAdmin(conv.id, inv.id)) {
          groupInvite = { groupId: conv.id, inviterId: inv.id };
        }
      }
    }
    // inviteUserId в теле — UUID или буквенный invite_code из ссылки.
    const inviterFromLink = inviteUserId ? db.resolveInviterByInviteRef(inviteUserId) : null;
    if (inviteUserId && !inviterFromLink && !groupInvite) {
      const peek = db.findInviterByInviteRef(inviteUserId);
      if (peek && db.isInviteLinkExhausted(peek.id)) {
        return res.status(400).json({
          error: 'По этой ссылке уже зарегистрировалось 100 человек. Попроси друга нажать «Обновить ссылку» в приложении.',
          code: 'INVITE_EXHAUSTED',
        });
      }
    }
    const effectiveInviteUserId = inviterFromLink?.id || (groupInvite ? groupInvite.inviterId : null);
    if (!phone || !name || !password)
      return res.status(400).json({ error: 'phone, name, password required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Пароль минимум 8 символов' });
    if (legalAccepted !== true) {
      return res.status(400).json({
        error: 'Нужно принять пользовательское соглашение и политику персональных данных',
        code: 'LEGAL_REQUIRED',
      });
    }

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
      if (inviteUserId) {
        return res.status(400).json({
          error: 'Ссылка-приглашение недействительна или устарела. Попроси новую у друга.',
          code: 'INVITE_INVALID',
        });
      }
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

    const user = db.createUser({
      phone, name, password, birthday, avatar, email: finalEmail,
      termsAcceptedAt: Date.now(),
      termsVersion: CURRENT_TERMS_VERSION,
      inviteCode: inviterFromLink?.invite_code || undefined,
    });

    if (inviterFromLink) {
      try { db.incrementInviteLinkUse(inviterFromLink.id); } catch (e) {
        console.warn('[invite] link use increment failed:', e.message);
      }
    }

    // Email из АВО-инвайта мы считаем уже подтверждённым (его привязал
    // школьный бизнес-процесс, не самостоятельный пользователь).
    // Самостоятельно введённые email'ы получают email_verified=0 и
    // ждут клика по верификационной ссылке.
    if (finalEmail) {
      const verified = !!schoolInvite?.bound_email;
      db.updateUser(user.id, { email_verified: verified ? 1 : 0 });
      if (!verified) {
        sendEmailVerification(user.id, finalEmail, name).catch(e =>
          console.warn('[verify-email] send failed:', e.message));
      }
    }

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
        // Реферальная запись. createUser её создаёт только когда передан
        // invite_code (буквенный), а через /register?invite=USER_ID мы
        // передаём UUID приглашающего — поэтому пишем referral здесь
        // напрямую. Сам зачёт (invited_confirmed++) произойдёт когда
        // новый юзер напишет первое сообщение (ws.js → confirmReferralIfPending).
        try {
          db.markReferralFromInviter(inviter.id, user.id);
        } catch (e) { console.warn('[referral] insert failed:', e.message); }
      }
    }

    // Активация школьного инвайта (от АВО): отметить как использованный + добавить
    // школьный аккаунт в контакты + автодобавление в групповой чат курса
    if (schoolInvite) {
      // tenant_id берём из инвайта — webhook сохранил его туда. Все
      // последующие действия (школьный аккаунт, чат курса, приветствие)
      // выполняются от лица этого tenant'а.
      const inviteTenantId = schoolInvite.tenant_id || db.DEFAULT_TENANT_ID;
      try { db.markSchoolInviteUsed(schoolInvite.code, user.id); } catch (e) { console.error('[school-invite]', e.message); }
      try { db.creditSchoolReferral(inviteTenantId, user.id); } catch (e) {
        console.warn('[referral] school credit failed:', e.message);
      }
      try {
        const school = db.getSchoolAccount(inviteTenantId);
        if (school) {
          try { db.addContact(user.id, school.id, null); } catch {}
        }
      } catch {}
      if (schoolInvite.course) {
        const chatId = db.getChatForCourse(schoolInvite.course, inviteTenantId);
        if (chatId) {
          try {
            const result = db.addUserToChat(chatId, user.id);
            if (result.added) {
              try {
                const senderId = db.getSchoolUserId(inviteTenantId);
                const msg = db.createMessage({
                  conversationId: chatId,
                  senderId,
                  text: `🎓 ${user.name} присоединился к курсу «${schoolInvite.course}»`,
                });
                const senderUser = db.findUserById(senderId);
                const members = db.getConversationMembers(chatId);
                broadcast(members, { type: 'message:new',
                  message: { ...msg, sender_name: senderUser?.name || 'Школа', conversationId: chatId } });
              } catch (e) { console.error('[awo-course-msg]', e.message); }
              try { broadcast([user.id], { type: 'conversation:added', chat_id: chatId }); } catch {}
            }
          } catch (e) { console.error('[awo-course-chat]', e.message); }
        } else {
          console.warn(`[awo][${inviteTenantId}] нет маппинга курса "${schoolInvite.course}" → чат`);
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

  // Помечаем заявку как уведомленную (когда админ написал юзеру). Делает
  // её «не висящей» в бейдже сайдбара. POST { notified: true|false }
  // — можно и снять отметку, если надо переписать.
  r.post('/admin/waitlist/:id/notified', requireAdmin, (req, res) => {
    const setOn = req.body?.notified !== false; // default true
    if (setOn) db.markWaitlistNotified(req.params.id);
    else       db.unmarkWaitlistNotified(req.params.id);
    res.json({ ok: true });
  });

  r.delete('/admin/waitlist/:id', requireAdmin, (req, res) => {
    db.deleteWaitlistEntry(req.params.id);
    res.json({ ok: true });
  });

  r.post('/login', rateLimit(10, 15 * 60 * 1000), (req, res) => {
    const { phone, password } = req.body;
    let user = db.findUserByPhone(phone);

    // Если по телефону юзера нет — может быть аккаунт сейчас в grace-периоде
    // (само-удаление, телефон заменён на placeholder). Пробуем восстановить.
    let restored = false;
    if (!user) {
      const restoreResult = db.tryRestoreFromGrace(phone, password, bcrypt);
      if (restoreResult?.conflict === 'phone_taken') {
        return res.status(409).json({
          error: 'Этот номер уже зарегистрировал другой пользователь, пока ваш аккаунт был в очереди удаления. Восстановление невозможно.',
          code: 'GRACE_PHONE_TAKEN',
        });
      }
      if (restoreResult?.user) {
        user = restoreResult.user;
        restored = true;
      }
    }

    if (!user) return res.status(401).json({ error: 'Неверный телефон или пароль' });
    if (!bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Неверный телефон или пароль' });
    if (user.is_blocked) {
      return res.status(403).json({
        error: 'Аккаунт заблокирован администрацией',
        code: 'BLOCKED',
      });
    }
    const token = signToken({ id: user.id, phone: user.phone, name: user.name });
    setSessionCookie(res, token);
    const { password: _, ...safe } = user;
    res.json({
      token,
      user: {
        ...safe,
        is_admin: !!safe.is_admin,
        is_super_admin: !!safe.is_super_admin,
        is_super: !!safe.is_super,
      },
      restored,
    });
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
    const user = db.findInviterByInviteRef(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const trimmed = String(req.params.id).trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed);
    if (isUuid && user.invite_rotated_at) return res.status(404).json({ error: 'Not found' });
    if (db.isInviteLinkExhausted(user.id)) {
      return res.status(410).json({
        error: 'По этой ссылке уже зарегистрировалось 100 человек. Попроси друга обновить ссылку в приложении.',
        code: 'INVITE_EXHAUSTED',
      });
    }
    res.json({ id: user.id, name: user.name, avatar_url: user.avatar || null });
  });

  // /api/media/* — дубль app-level handler (на случай если роутер смонтирован без index.js)
  r.get(/^\/media\/(.+)/, (req, res) => {
    const { streamMedia } = require('./mediaProxy');
    const key = req.params[0];
    streamMedia(key, res, req.query || {}).catch(e => {
      console.error('[/api/media]', key, e.message);
      if (!res.headersSent) res.status(502).end();
    });
  });

  r.post('/diagnostics/media-image', requireAuth, async (req, res) => {
    const body = req.body || {};
    try {
      const report = {
        id: uuid(),
        at: new Date().toISOString(),
        userId: req.user.id,
        reason: String(body.reason || 'unknown').slice(0, 80),
        src: String(body.src || '').slice(0, 500),
        currentSrc: String(body.currentSrc || '').slice(0, 500),
        failedUrl: String(body.failedUrl || '').slice(0, 500),
        page: String(body.page || '').slice(0, 300),
        userAgent: String(body.userAgent || req.headers['user-agent'] || '').slice(0, 300),
      };
      const diagnostics = await buildMediaDiagnostics(req, report);
      console.warn('[media-diagnostic]', JSON.stringify({ ...report, ...diagnostics }));
      res.json({ ok: true, id: report.id, key: diagnostics.key || null });
    } catch (e) {
      console.error('[media-diagnostic:error]', e);
      res.status(500).json({ error: 'Diagnostic failed' });
    }
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
    // S3 / media URL — стримим через Node, без редиректа: так не зависим от
    // кеша /media и public-read ACL, а Android получает обычный image response.
    const { s3KeyFromUrl } = require('./mediaUrl');
    const { streamMedia } = require('./mediaProxy');
    const key = s3KeyFromUrl(av);
    if (key) {
      res.set('Cache-Control', 'public, max-age=300');
      return streamMedia(key, res, req.query || {}).catch(e => {
        console.error('[/api/avatars]', req.params.userId, key, e.message);
        if (!res.headersSent) res.status(404).end();
      });
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
    const contactEntry  = contacts.find(c => c.id === target.id);
    const isContact     = !!contactEntry;
    const { password, phone, must_change_password, achievements: achRaw, ...safe } = target;
    const achievements = (() => { try { return JSON.parse(achRaw || '[]'); } catch { return []; } })();
    res.json({
      ...safe,
      achievements,
      active_moments: activeMoments,
      active_moment: activeMoments[0] || null,
      presence,
      is_contact: isContact,
      // Личные заметки и прозвище — только для своих контактов.
      nickname: contactEntry?.nickname ?? null,
      notes: contactEntry?.notes ?? null,
    });
  });

  r.post('/me/app-client', requireAuth, (req, res) => {
    const kind = req.body?.kind;
    if (!kind) return res.status(400).json({ error: 'kind required' });
    try {
      db.recordAppClient(req.user.id, kind, req.get('User-Agent') || null);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.get('/me', requireAuth, (req, res) => {
    db.checkAndExpireSuper(req.user.id);
    const user = db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const { password, achievements: achRaw, ...safe } = user;
    const achievements = (() => { try { return JSON.parse(achRaw || '[]'); } catch { return []; } })();
    // Сколько школ юзеру доступно (как владельцу или со-админу) — UI
    // прячет/показывает по этому полю карточку «АВО / Школы» в /me и
    // пускает в /integrations/awo даже тех, у кого business_status != approved.
    const tenantsAccessible = db.listTenantsForUser(user.id).length;
    // Счётчики приглашённых считаем напрямую из referrals — поле
    // users.invited_count за годы рассинхронизировалось из-за back-fill'ов,
    // полагаться на него больше нельзя. invited_total — все кто
    // зарегистрировался по нашей ссылке; invited_confirmed — те, кто
    // дошёл до отправки первого сообщения (только они засчитываются
    // в Super-бонус «3 друзей»).
    const inv = db.getInvitedCounts(user.id);
    res.json({
      ...safe, achievements,
      is_admin: !!safe.is_admin,
      is_super_admin: !!safe.is_super_admin,
      is_super: !!safe.is_super,
      tenants_accessible: tenantsAccessible,
      invited_total: inv.total,
      invited_confirmed: inv.confirmed,
      // Алиас для обратной совместимости со старым полем — теперь это
      // confirmed, чтобы прогресс-бар «N/3 друзей» был честным.
      invited_count: inv.confirmed,
    });
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
      // Email подтверждается отдельно по ссылке. При смене / очистке
      // ставим verified=0. Если email не менялся — флаг не трогаем.
      const currentUser = db.findUserById(req.user.id);
      if ((currentUser?.email || null) !== cleanedEmail) {
        updates.email_verified = 0;
      }
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
    // Если email сменился и теперь висит как unverified — шлём ссылку
    // подтверждения в фоне. Не валим запрос, если SMTP лежит — юзер
    // всё равно сохранил email; кнопка «отправить ещё раз» в профиле
    // позволит дернуть письмо позже.
    if (updates.email_verified === 0 && user.email) {
      sendEmailVerification(user.id, user.email, user.name).catch(e =>
        console.warn('[verify-email] send failed:', e.message));
    }
    const { password, achievements: achRaw, ...safe } = user;
    safe.achievements = (() => { try { return JSON.parse(achRaw || '[]'); } catch { return []; } })();
    res.json(safe);
  });

  // ── Email verification ───────────────────────────────────────────────
  // Перевыслать ссылку подтверждения (для случаев когда первое письмо
  // потерялось / попало в спам).
  r.post('/me/email/resend-verification', requireAuth, async (req, res) => {
    const u = db.findUserById(req.user.id);
    if (!u?.email)          return res.status(400).json({ error: 'Email не указан' });
    if (u.email_verified)   return res.status(400).json({ error: 'Email уже подтверждён' });
    try {
      await sendEmailVerification(u.id, u.email, u.name);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Не удалось отправить письмо: ' + e.message });
    }
  });

  // Клик по ссылке из письма. token = JWT { uid, email, exp }.
  r.get('/verify-email', async (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(400).send('Нет токена');
    let payload;
    try { payload = authModule.verifyToken(String(token)); }
    catch { return res.status(400).send('Ссылка недействительна или устарела'); }
    if (!payload?.uid || !payload?.email || payload?.kind !== 'email-verify') {
      return res.status(400).send('Ссылка некорректна');
    }
    const u = db.findUserById(payload.uid);
    if (!u)                   return res.status(404).send('Пользователь не найден');
    if (u.email !== payload.email) return res.status(409).send('Email был изменён, ссылка не актуальна');
    if (!u.email_verified) {
      db.updateUser(payload.uid, { email_verified: 1 });
    }
    // Редирект в профиль с маркером успешного подтверждения
    res.redirect('/me?email_verified=1');
  });

  async function sendEmailVerification(userId, email, name) {
    // 7 дней — длинный TTL, чтобы юзер успел кликнуть из спам-папки
    const token = authModule.signToken({ uid: userId, email, kind: 'email-verify' });
    const link = `${process.env.PUBLIC_ORIGIN || 'https://hey-messenger.ru'}/api/verify-email?token=${encodeURIComponent(token)}`;
    const t = createTransporter();
    if (!t) {
      // SMTP не настроен — записываем ссылку в feedback log, чтобы
      // админ мог отправить её юзеру вручную. Это лучше чем терять
      // верификацию совсем.
      try {
        fs.appendFileSync(FEEDBACK_LOG,
          `\n[${new Date().toISOString()}] VERIFY-EMAIL fallback user=${userId} <${email}>\n  ${link}\n`);
        console.warn('[verify-email] SMTP не настроен — ссылка для', email, 'сохранена в feedback.log');
      } catch {}
      throw new Error('Сервис рассылки писем не настроен. Свяжитесь с поддержкой.');
    }
    await t.sendMail({
      from: `"HEY Messenger" <${process.env.SMTP_USER}>`,
      to:   email,
      subject: 'Подтвердите email для HEY',
      text: `Привет, ${name || ''}!\n\nПодтверди email в HEY:\n${link}\n\nЕсли это не ты — просто проигнорируй письмо.`,
      html: `<p>Привет, ${name || ''}!</p>
<p>Подтверди email в HEY, нажав на ссылку:</p>
<p><a href="${link}" style="background:#5F4080;color:#F9F0F0;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Подтвердить email</a></p>
<p style="color:#888;font-size:12px">Если кнопка не работает — открой в браузере: ${link}</p>
<p style="color:#888;font-size:12px">Если это не ты — просто проигнорируй письмо.</p>`,
    });
  }

  // ── Password reset via email ────────────────────────────────────────────
  // POST /password-reset/request { email } — публичный.
  //   • Ищем юзера по email. Если есть и не заблокирован — отправляем
  //     письмо с reset-ссылкой. Если нет — возвращаем такой же 200,
  //     чтобы не давать enumerate-возможность.
  // POST /password-reset/confirm { token, newPassword } — публичный.
  //   • Валидируем подписанный JWT (kind:'password-reset', TTL 1ч),
  //     обновляем пароль и снимаем must_change_password.
  async function sendPasswordReset(userId, email, name) {
    const token = authModule.signToken({ uid: userId, email, kind: 'password-reset' }, { expiresIn: '1h' });
    const link = `${process.env.PUBLIC_ORIGIN || 'https://hey-messenger.ru'}/password-reset?token=${encodeURIComponent(token)}`;
    const t = createTransporter();
    if (!t) {
      console.warn('[password-reset] SMTP не настроен — ссылка для', email, ':', link);
      throw new Error('Сервис рассылки писем не настроен');
    }
    await t.sendMail({
      from: `"HEY Messenger" <${process.env.SMTP_USER}>`,
      to:   email,
      subject: 'Восстановление пароля HEY',
      text: `Привет, ${name || ''}!\n\nКто-то запросил сброс пароля для аккаунта HEY с этим email.\nЕсли это ты — открой ссылку и задай новый пароль:\n${link}\n\nСсылка действительна 1 час. Если это не ты — просто проигнорируй письмо.`,
      html: `<p>Привет, ${name || ''}!</p>
<p>Кто-то запросил сброс пароля для аккаунта HEY с этим email.</p>
<p>Если это ты — задай новый пароль:</p>
<p><a href="${link}" style="background:#5F4080;color:#F9F0F0;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Задать новый пароль</a></p>
<p style="color:#888;font-size:12px">Если кнопка не работает — открой в браузере: ${link}</p>
<p style="color:#888;font-size:12px">Ссылка действительна 1 час. Если это не ты — просто проигнорируй письмо.</p>`,
    });
  }

  r.post('/password-reset/request', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!awo.isValidEmail(email)) return res.status(400).json({ error: 'Неверный email' });
    const user = db.findUserByEmail(email);
    // Идемпотентный ответ — не выдаём enumerate-сигнал
    if (!user || user.is_blocked || user.is_deleted) {
      return res.json({ ok: true });
    }
    try {
      await sendPasswordReset(user.id, email, user.name);
      res.json({ ok: true });
    } catch (e) {
      console.error('[password-reset/request]', e.message);
      res.status(500).json({ error: 'Не удалось отправить письмо' });
    }
  });

  r.post('/password-reset/confirm', (req, res) => {
    const { token, newPassword } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Нет токена' });
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Пароль минимум 8 символов' });
    }
    let payload;
    try { payload = authModule.verifyToken(token); }
    catch { return res.status(400).json({ error: 'Ссылка недействительна или устарела' }); }
    if (payload?.kind !== 'password-reset' || !payload?.uid) {
      return res.status(400).json({ error: 'Ссылка недействительна' });
    }
    const user = db.findUserById(payload.uid);
    if (!user || user.is_blocked || user.is_deleted) {
      return res.status(400).json({ error: 'Аккаунт недоступен' });
    }
    db.updateUser(payload.uid, {
      password: bcrypt.hashSync(newPassword, 10),
      must_change_password: 0,
    });
    res.json({ ok: true });
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
    const result = db.deleteUserAccount(req.user.id);
    // Notify the deleted user's own WS connections so the client logs out
    broadcast([req.user.id], { type: 'account:deleted' });
    res.json({ ok: true, graceExpiresAt: result?.graceExpiresAt || null });
  });

  // ── Заявка на бизнес-доступ ────────────────────────────────────────────
  r.post('/me/business/request', requireAuth, (req, res) => {
    const { note } = req.body || {};
    try {
      db.requestBusinessAccess(req.user.id, note);
      // Сообщение в HEY-заведующий админам не делаем (пока) — просто
      // увидят в /admin/business-requests
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.post('/me/business/cancel', requireAuth, (req, res) => {
    db.cancelBusinessRequest(req.user.id);
    res.json({ ok: true });
  });

  // Админка: список заявок
  r.get('/admin/business-requests', requireAdmin, (req, res) => {
    const status = (req.query.status || 'pending').toString();
    res.json(db.listBusinessRequests(status));
  });
  r.post('/admin/business-requests/:userId/approve', requireAdmin, (req, res) => {
    try {
      db.approveBusinessRequest(req.params.userId, req.user.id);
      // Уведомление пользователю через WS — обновим в шаге UI ниже
      broadcast([req.params.userId], { type: 'business:approved' });
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.post('/admin/business-requests/:userId/reject', requireAdmin, (req, res) => {
    const { reason } = req.body || {};
    db.rejectBusinessRequest(req.params.userId, req.user.id, reason);
    broadcast([req.params.userId], { type: 'business:rejected' });
    res.json({ ok: true });
  });
  r.post('/admin/business-requests/:userId/revoke', requireAdmin, (req, res) => {
    const { reason } = req.body || {};
    db.revokeBusinessAccess(req.params.userId, req.user.id, reason);
    broadcast([req.params.userId], { type: 'business:revoked' });
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

  // Lookup-only: найти юзера по телефону, ничего не добавляя.
  // Нужно для UX «введи номер → покажи карточку → подтверди добавление».
  r.get('/users/lookup', requireAuth, (req, res) => {
    const digits = (req.query.phone || '').replace(/\D/g, '');
    if (digits.length < 7) return res.status(400).json({ error: 'Слишком короткий номер' });
    const phone = '+' + (digits.startsWith('8') ? '7' + digits.slice(1) : digits);
    const target = db.findUserByPhone(phone);
    if (!target || target.is_blocked) return res.status(404).json({ error: 'Пользователь не найден' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'Это вы' });
    if (target.is_deleted) return res.status(400).json({ error: 'Пользователь удалил аккаунт' });
    // Возвращаем безопасный профиль (как /users/:id/profile) — без активных моментов.
    const { password, ...safe } = target;
    safe.is_contact = !!db.getContacts(req.user.id).find(c => c.id === target.id);
    res.json(safe);
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
    // Идемпотентность: повторное добавление того же контакта не должно
    // ломать UX 409-ой. Часто срабатывает на двойном тапе по кнопке
    // «Добавить в контакты» в карточке — первый запрос отрабатывает,
    // второй приходит когда client-state ещё не успел перейти в
    // «уже в контактах». Возвращаем 200 с тем же телом.
    try { db.addContact(req.user.id, target.id, nickname); }
    catch (e) {
      if (!/Already in contacts/i.test(e.message)) {
        return res.status(409).json({ error: e.message });
      }
    }
    try { db.attributeReferralIfUnassigned(req.user.id, target.id); } catch {}
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

  r.patch('/contacts/:id/nickname', requireAuth, (req, res) => {
    db.updateContactNickname(req.user.id, req.params.id, req.body.nickname);
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
    const archived = req.query.archived === '1' || req.query.archived === 'true';
    res.json(db.getConversationsForUser(req.user.id, { archived }));
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
    const limit = req.user.is_super ? 15 : 5;
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

  // Архивировать/восстановить чат (персональное действие)
  r.post('/conversations/:id/archive', requireAuth, (req, res) => {
    if (!db.isMember(req.params.id, req.user.id))
      return res.status(403).json({ error: 'Forbidden' });
    db.archiveConversation(req.params.id, req.user.id);
    broadcast([req.user.id], {
      type: 'conversation:archived',
      conversationId: req.params.id,
    });
    res.json({ ok: true });
  });
  r.delete('/conversations/:id/archive', requireAuth, (req, res) => {
    db.unarchiveConversation(req.params.id, req.user.id);
    broadcast([req.user.id], {
      type: 'conversation:unarchived',
      conversationId: req.params.id,
    });
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
      'group-icon':    ['image/jpeg', 'image/png', 'image/webp'],
      'feedback-attachment': [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/zip',
        'application/x-zip-compressed',
        'application/octet-stream',
      ],
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
      'group-icon':    2 * MB,
      'feedback-attachment': 10 * MB,
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
      'avatar':       `avatars/${req.user.id}/${uuid()}.${ext}`,
      // group-icon: уникальный ключ на каждую загрузку, чтобы икона
      // одной группы не перетирала иконку другой. Раньше при правке
      // группы клиент использовал category='avatar' — а её ключ
      // стабилен по userId, и оба групповых icon начинали ссылаться
      // на одну и ту же ячейку S3 (всегда последняя загрузка).
      'group-icon':   `group-icons/${uuid()}.${ext}`,
      'feedback-attachment': `feedback/${uuid()}.${ext}`,
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
    const msgs = db.getMessages(req.params.id, before, limit, req.user.id);
    const reactionsMap = db.getReactionsForMessages(msgs.map(m => m.id));
    res.json(msgs.map(m => ({ ...m, reactions: reactionsMap[m.id] || {} })));
  });

  r.patch('/conversations/:id/messages/:msgId', requireAuth, (req, res) => {
    const m = db.getMessageById(req.params.msgId);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (Number(m.is_deleted) === 1) return res.status(400).json({ error: 'Сообщение удалено' });
    if (m.sender_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!db.isMember(req.params.id, req.user.id)) return res.status(403).json({ error: 'Not a member' });
    if (db.now() - m.created_at > 24 * 60 * 60)
      return res.status(403).json({ error: 'Редактировать можно только в течение 24 часов' });
    const { text, attachment } = req.body || {};
    const patch = {};
    if (text !== undefined) patch.text = (text == null ? '' : String(text)).trim() || null;
    if (attachment !== undefined) {
      if (!attachment || typeof attachment !== 'object') {
        return res.status(400).json({ error: 'Некорректное вложение' });
      }
      if (attachment.type === 'image') {
        if (!attachment.url || typeof attachment.url !== 'string') {
          return res.status(400).json({ error: 'Некорректное вложение' });
        }
      } else if (attachment.type === 'images') {
        if (!Array.isArray(attachment.urls) || !attachment.urls.length
          || attachment.urls.some(u => typeof u !== 'string' || !u)) {
          return res.status(400).json({ error: 'Некорректное вложение' });
        }
      } else {
        return res.status(400).json({ error: 'Можно менять только картинки' });
      }
      patch.attachment = attachment;
    }
    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: 'Нечего обновлять' });
    }
    const updated = db.editMessage(req.params.msgId, patch);
    broadcast(db.getConversationMembers(req.params.id), { type: 'message:edited', message: updated });
    res.json(updated);
  });

  r.delete('/conversations/:id/messages/:msgId', requireAuth, (req, res) => {
    const m = db.getMessageById(req.params.msgId);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (Number(m.is_deleted) === 1) return res.status(400).json({ error: 'Сообщение уже удалено' });
    if (!db.isMember(req.params.id, req.user.id)) return res.status(403).json({ error: 'Not a member' });
    const conv = db.getConversationById(req.params.id);
    const isOwn = m.sender_id === req.user.id;
    if (conv?.type === 'monolog') {
      if (!isOwn) return res.status(403).json({ error: 'Forbidden' });
      const deleted = db.hardDeleteMessage(req.params.msgId, storage);
      broadcast(db.getConversationMembers(req.params.id), {
        type: 'message:deleted', messageId: req.params.msgId, hard: true, conversationId: req.params.id,
      });
      return res.json(deleted);
    }
    if (!isOwn) {
      if (conv?.type !== 'group' || !db.isGroupAdmin(req.params.id, req.user.id)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const tombstone = db.deleteMessage(req.params.msgId, storage, req.user.id);
    broadcast(db.getConversationMembers(req.params.id), {
      type: 'message:deleted', message: tombstone, conversationId: req.params.id,
    });
    res.json(tombstone);
  });

  r.post('/conversations/:id/messages/:msgId/reactions', requireAuth, (req, res) => {
    const { emoji } = req.body || {};
    if (!emoji || typeof emoji !== 'string') return res.status(400).json({ error: 'Нужен emoji' });
    if (!db.isMember(req.params.id, req.user.id)) return res.status(403).json({ error: 'Not a member' });
    const m = db.getMessageById(req.params.msgId);
    if (!m || m.conversation_id !== req.params.id) return res.status(404).json({ error: 'Not found' });
    if (Number(m.is_deleted) === 1) return res.status(400).json({ error: 'Сообщение удалено' });
    db.toggleReaction(req.params.msgId, req.user.id, emoji);
    const reactions = db.getMessageReactions(req.params.msgId);
    broadcast(db.getConversationMembers(req.params.id), {
      type: 'reaction:update', messageId: req.params.msgId, conversationId: req.params.id, reactions,
    });
    res.json({ reactions });
  });

  r.delete('/conversations/:id', requireAuth, (req, res) => {
    try {
      const { memberIds, type } = db.deleteConversation(req.params.id, req.user.id, storage);
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
    // Передаём userId — для group вернётся общий пин, для direct/monolog личный
    const pinned = db.getPinnedMessage(req.params.id, req.user.id);
    res.json(pinned || null);
  });

  // Закрепить сообщение в чате. URL отличается от sticky-chat pin
  // (/conversations/:id/pin), который мы регистрируем выше — поэтому здесь
  // отдельный путь /pinned-message, иначе Express матчит первый зарегистрированный.
  r.post('/conversations/:id/pinned-message', requireAuth, (req, res) => {
    const { messageId } = req.body || {};
    if (!messageId) return res.status(400).json({ error: 'messageId required' });
    try {
      const { scope, pinned } = db.pinMessage(req.params.id, messageId, req.user.id);
      if (scope === 'group') {
        // Группа — общий пин, рассылаем всем участникам
        const members = db.getConversationMembers(req.params.id);
        broadcast(members, { type: 'message:pinned', conversationId: req.params.id, message: pinned });
      } else {
        // direct/monolog — личный пин, только сам инициатор
        broadcast([req.user.id], { type: 'message:pinned', conversationId: req.params.id, message: pinned });
      }
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

  r.delete('/conversations/:id/pinned-message', requireAuth, (req, res) => {
    try {
      const { scope } = db.unpinMessage(req.params.id, req.user.id);
      if (scope === 'group') {
        const members = db.getConversationMembers(req.params.id);
        broadcast(members, { type: 'message:pinned', conversationId: req.params.id, message: null });
      } else {
        broadcast([req.user.id], { type: 'message:pinned', conversationId: req.params.id, message: null });
      }
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
    // Для групповых чатов содержимое может удалить только админ группы
    // (создатель ИЛИ назначенный со-админ). Direct-чаты (1-на-1) и
    // monolog — любой участник.
    const conv = db.getConversationById(convId);
    if (conv?.type === 'group' && !db.isGroupAdmin(convId, req.user.id)) {
      return res.status(403).json({
        error: 'Только администратор группы может удалить содержимое чата',
        code: 'ADMIN_ONLY',
      });
    }
    const members = db.getConversationMembers(convId);
    db.clearConversationMessages(convId);
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

  // Полные сведения о группе для экрана настроек (фильтрованные поля)
  r.get('/groups/:id', requireAuth, (req, res) => {
    if (!db.isMember(req.params.id, req.user.id)) return res.status(403).json({ error: 'Forbidden' });
    const conv = db.getConversationById(req.params.id);
    if (!conv || conv.type !== 'group') return res.status(404).json({ error: 'Not found' });
    res.json({
      id: conv.id, name: conv.name, icon: conv.icon,
      admin_id: conv.admin_id,
      history_visibility: conv.history_visibility || 'all',
      notifications_muted: db.isNotificationsMuted(req.params.id, req.user.id),
    });
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
      // HEY-заведующий и прочие системные аккаунты не могут быть участниками групп.
      if (target.is_system || String(target.id).startsWith('system_')) {
        return res.status(400).json({ error: 'Системный аккаунт нельзя добавить в группу' });
      }
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
      const conv    = db.getConversationById(req.params.id);
      const target  = db.findUserById(req.params.userId);
      const actor   = db.findUserById(req.user.id);
      const isLeave = req.user.id === req.params.userId;
      // Только в группах кидаем системное сообщение — direct/monolog не трогаем.
      const postSystemMsg = conv?.type === 'group' && target;
      db.removeGroupMember(req.params.id, req.user.id, req.params.userId);

      if (postSystemMsg) {
        const sysMsg = db.createSystemEventMessage(req.params.id, isLeave
          ? { type: 'member_left', userId: target.id, userName: target.name }
          : { type: 'member_removed', userId: target.id, userName: target.name,
              byUserId: actor?.id, byUserName: actor?.name }
        );
        // Удалённого/вышедшего УЖЕ нет в members — поэтому он системку не увидит,
        // и это правильно (у него чат пропадёт из списка).
        broadcast(members.filter(uid => uid !== req.params.userId), {
          type: 'message:new',
          message: { ...sysMsg, conversationId: req.params.id },
        });
      }

      broadcast(members, { type: 'group:member_removed', conversationId: req.params.id, userId: req.params.userId });
      // Удаляемого тоже уведомляем (вдруг он сейчас в чате)
      broadcast([req.params.userId], { type: 'group:member_removed', conversationId: req.params.id, userId: req.params.userId,
        // Сразу везём ему причину — кто и из какой группы убрал. Клиент
        // покажет toast, иначе чат просто пропадёт без объяснений.
        kicked_by_name: !isLeave ? (actor?.name || null) : null,
        group_name:     !isLeave ? (conv?.name || null) : null,
      });

      // Push-уведомление выгнанному (только если не сам ушёл и есть подписки).
      // Без него кикнутый юзер увидит лишь исчезнувший чат — никакой
      // обратной связи о том, что и кем сделано.
      if (!isLeave && conv?.type === 'group' && target) {
        try {
          const subs = db.getPushSubscriptions(target.id);
          if (subs.length) {
            push.sendPushToUser(subs, {
              title: `Группа «${conv.name || 'без названия'}»`,
              body:  `${actor?.name || 'Администратор'} удалил вас из группы`,
              tag:   `group-kick:${conv.id}`,
            }).then(gone => { if (gone?.length) db.removePushSubscriptions(gone); })
              .catch(() => {});
          }
        } catch {}
      }

      res.json({ ok: true });
    } catch(e) { res.status(403).json({ error: e.message }); }
  });

  // Принять приглашение в группу (pending → active)
  r.post('/groups/:id/accept', requireAuth, (req, res) => {
    try {
      const r2 = db.acceptGroupInvite(req.params.id, req.user.id);
      try { db.creditGroupInviterReferral(req.params.id, req.user.id); } catch (e) {
        console.warn('[referral] group accept credit failed:', e.message);
      }
      const members = db.getConversationMembers(req.params.id);
      // Уведомляем активных участников — у них в списке появится новый участник
      broadcast(members, { type: 'group:member_added', conversationId: req.params.id, userId: req.user.id });
      // Себя тоже — фронт должен перезагрузить список чатов
      broadcast([req.user.id], { type: 'group:invite_accepted', conversationId: req.params.id });
      // Системное сообщение в чат — чтобы все увидели нового участника
      if (!r2?.alreadyActive) {
        try {
          const msg = db.createMessage({
            conversationId: req.params.id,
            senderId: db.SYSTEM_USER_ID,
            text: `👋 ${req.user.name} присоединился к группе`,
          });
          // Раздаём системное сообщение всем участникам по WS
          broadcast(members, { type: 'message:new',
            message: { ...msg, sender_name: 'HEY-заведующий',
              conversationId: req.params.id } });
        } catch (e) { console.error('[group-accept-msg]', e.message); }
      }
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

  // Назначить/снять админа группы (только текущий админ группы)
  r.patch('/groups/:id/members/:userId/admin', requireAuth, (req, res) => {
    try {
      const value = !!req.body?.is_admin;
      db.setMemberAdmin(req.params.id, req.user.id, req.params.userId, value);
      const members = db.getConversationMembers(req.params.id);
      broadcast(members, { type: 'group:updated', conversationId: req.params.id, fields: { members_changed: true } });
      res.json({ ok: true });
    } catch(e) { res.status(403).json({ error: e.message }); }
  });

  // Видимость истории для новых участников (только админ): 'all' | 'since_joined'
  r.patch('/groups/:id/history-visibility', requireAuth, (req, res) => {
    try {
      const value = req.body?.value;
      db.setGroupHistoryVisibility(req.params.id, req.user.id, value);
      const members = db.getConversationMembers(req.params.id);
      broadcast(members, { type: 'group:updated', conversationId: req.params.id, fields: { history_visibility: value } });
      res.json({ ok: true });
    } catch(e) { res.status(403).json({ error: e.message }); }
  });

  // Персональное отключение уведомлений по группе (для текущего участника)
  r.patch('/groups/:id/notifications', requireAuth, (req, res) => {
    try {
      const conv = db.getConversationById(req.params.id);
      if (!conv || conv.type !== 'group') return res.status(404).json({ error: 'Not found' });
      const muted = !!req.body?.muted;
      db.setNotificationsMuted(req.params.id, req.user.id, muted);
      broadcast([req.user.id], {
        type: 'conversation:notifications_muted',
        conversationId: req.params.id,
        muted,
      });
      res.json({ ok: true, notifications_muted: muted });
    } catch (e) { res.status(403).json({ error: e.message }); }
  });

  // ── Group invite links (admin shares a link, anyone can join) ────────────
  // Сгенерировать invite-ссылку. Доступно как создателю (conv.admin_id),
  // так и назначенным со-админам (members.is_admin=1). Раньше проверяли
  // только admin_id и со-админы упирались в 403 при попытке поделиться.
  r.post('/groups/:id/invite-link', requireAuth, (req, res) => {
    const conv = db.getConversationById(req.params.id);
    if (!conv || conv.type !== 'group') return res.status(404).json({ error: 'Группа не найдена' });
    if (!db.isGroupAdmin(conv.id, req.user.id)) {
      return res.status(403).json({ error: 'Только админ группы может создавать ссылки' });
    }
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
    // Ссылка теряет силу, если приглашающий перестал быть админом
    // (создатель ИЛИ соадмин). Раньше проверяли только admin_id и
    // ссылки от соадминов сразу отдавали «больше не админ группы».
    if (!db.isGroupAdmin(conv.id, inviter.id)) {
      return res.status(400).json({ error: 'Приглашающий больше не админ группы' });
    }
    const memberCount = db.getGroupMembers(conv.id, false).length;
    // Если запрос пришёл с Authorization — узнаём, состоит ли юзер
    // уже в группе. Клиент использует это, чтобы перейти сразу в чат
    // вместо показа landing-страницы. Эндпоинт остаётся публичным —
    // отсутствие или невалидный токен просто = null.
    let already_member = false;
    let pending_member = false;
    try {
      const header = req.headers.authorization;
      if (header?.startsWith('Bearer ')) {
        const decoded = require('./auth').verifyToken(header.slice(7));
        const meId = decoded?.id;
        if (meId) {
          if (db.isMember(conv.id, meId)) already_member = true;
          else if (db.getInviterForPendingMember?.(conv.id, meId)) pending_member = true;
        }
      }
    } catch { /* инвалидный токен — игнорируем, ответ публичный */ }
    res.json({
      group:   { id: conv.id, name: conv.name, icon: conv.icon, member_count: memberCount },
      inviter: { id: inviter.id, name: inviter.name, avatar: inviter.avatar },
      already_member,
      pending_member,
    });
  });

  // Принять приглашение (auth required). Добавляет юзера в группу сразу как active.
  r.post('/group-invite/:token/accept', requireAuth, (req, res) => {
    const data = awo.verifyGroupInvite(req.params.token);
    if (!data) return res.status(400).json({ error: 'Ссылка недействительна или устарела' });
    const conv = db.getConversationById(data.groupId);
    if (!conv || conv.type !== 'group') return res.status(404).json({ error: 'Группа не найдена' });
    const inviter = db.findUserById(data.inviterId);
    if (!inviter || !db.isGroupAdmin(conv.id, inviter.id)) {
      return res.status(400).json({ error: 'Ссылка недействительна' });
    }
    try {
      const result = db.joinGroupViaInvite(conv.id, req.user.id, data.inviterId);
      try { db.creditGroupInviterReferral(conv.id, req.user.id); } catch (e) {
        console.warn('[referral] group invite credit failed:', e.message);
      }
      // Приглашающего сразу в контакты к новичку
      try { db.addContact(req.user.id, data.inviterId, null); } catch {}
      // Уведомить участников и нового юзера о появлении чата
      try {
        const members = db.getGroupMembers(conv.id, false).map(m => m.id);
        broadcast(members, { type: 'group:member_joined', conversationId: conv.id, userId: req.user.id });
        broadcast([req.user.id], { type: 'conversation:added', chat_id: conv.id });
      } catch {}
      // Системное сообщение в чат + WS-доставка всем участникам
      if (!result.alreadyActive) {
        try {
          const msg = db.createMessage({
            conversationId: conv.id,
            senderId: db.SYSTEM_USER_ID,
            text: `👋 ${req.user.name} присоединился по приглашению`,
          });
          const members = db.getConversationMembers(conv.id);
          broadcast(members, { type: 'message:new',
            message: { ...msg, sender_name: 'HEY-заведующий', conversationId: conv.id } });
        } catch (e) { console.error('[invite-link-msg]', e.message); }
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
    const link  = db.getInviteLinkStatus(req.user.id);
    res.json({
      code: user.invite_code,
      referral_count: count,
      invite_uses: link.uses,
      invite_limit: link.limit,
      invite_remaining: link.remaining,
      invite_exhausted: link.exhausted,
    });
  });

  r.post('/invite/rotate', requireAuth, rateLimit(10, 60 * 60 * 1000), (req, res) => {
    try {
      const code = db.rotateInviteCode(req.user.id);
      const count = db.getReferralCount(req.user.id);
      const link  = db.getInviteLinkStatus(req.user.id);
      res.json({
        code,
        referral_count: count,
        invite_uses: link.uses,
        invite_limit: link.limit,
        invite_remaining: link.remaining,
        invite_exhausted: link.exhausted,
      });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Не удалось обновить ссылку' });
    }
  });

  r.get('/invite/:code', (req, res) => {
    const user = db.findUserByInviteCode(req.params.code.toUpperCase());
    if (!user) return res.status(404).json({ error: 'Не найдено' });
    if (db.isInviteLinkExhausted(user.id)) {
      return res.status(410).json({
        error: 'По этой ссылке уже зарегистрировалось 100 человек. Попроси друга обновить ссылку.',
        code: 'INVITE_EXHAUSTED',
      });
    }
    res.json({ name: user.name, avatar: user.avatar });
  });

  // ── Feedback ───────────────────────────────────────────────────────────────
  r.post('/feedback', rateLimit(3, 60 * 60 * 1000), optionalAuth, async (req, res) => {
    const { text, type, attachment_url, attachment_name, attachment_mime } = req.body;
    const trimmed = (text || '').trim();
    const attUrl = typeof attachment_url === 'string' ? attachment_url.trim() : '';
    if (!trimmed && !attUrl) return res.status(400).json({ error: 'Нужен текст или вложение' });

    const from = req.user
      ? `${req.user.name} (${req.user.phone})`
      : 'Аноним';
    const subject = `HEY Feedback [${type || 'общее'}] от ${from}`;
    const bodyLines = [
      `От: ${from}`,
      `Тип: ${type || 'общее'}`,
      attUrl ? `Вложение: ${attachment_name || 'файл'} (${attUrl})` : null,
      '',
      trimmed || '(без текста)',
    ].filter(l => l !== null);
    const body = bodyLines.join('\n');

    // Кладём в БД (для админки), параллельно в файл (легаси).
    try {
      db.createFeedback({
        userId: req.user?.id || null,
        name:   req.user?.name || null,
        phone:  req.user?.phone || null,
        type:   type || null,
        text:   trimmed || '',
        attachmentUrl: attUrl || null,
        attachmentName: attachment_name || null,
        attachmentMime: attachment_mime || null,
      });
    } catch (e) { console.error('[FEEDBACK] DB insert failed:', e.message); }

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
    res.json(db.getMomentReactorsList(req.params.id, req.user.id));
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

    // Notify author + сам реагирующий (у него может быть второе устройство /
    // вторая вкладка — там реакция должна тоже подсветиться).
    broadcast(momentStatsNotifyIds(m, [req.user.id]), {
      type: 'moment:reaction',
      momentId: req.params.id,
      userId: req.user.id,
      reaction,
      action: 'set',
    });

    res.json({ ok: true });
  });

  r.delete('/moments/:id/react', requireAuth, (req, res) => {
    const m = db.getMomentById(req.params.id);
    db.deleteMomentReaction(req.params.id, req.user.id);
    if (m) {
      broadcast(momentStatsNotifyIds(m, [req.user.id]), {
        type: 'moment:reaction',
        momentId: req.params.id,
        userId: req.user.id,
        action: 'unset',
      });
    }
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

  // Админ: счётчики для бейджей в сайдбаре (лёгкий polling-endpoint)
  r.get('/admin/counts', requireAdmin, (_req, res) => {
    try {
      const openReports = db.getReports({ status: 'open', limit: 9999 }).length;
      const pendingBusiness = db.listBusinessRequests
        ? db.listBusinessRequests('pending').length
        : 0;
      const openFeedbacks = db.countOpenFeedbacks ? db.countOpenFeedbacks() : 0;
      const pendingWaitlist = db.countPendingWaitlist ? db.countPendingWaitlist() : 0;
      res.json({ openReports, pendingBusiness, openFeedbacks, pendingWaitlist });
    } catch (e) {
      res.json({ openReports: 0, pendingBusiness: 0, openFeedbacks: 0, pendingWaitlist: 0 });
    }
  });

  // Админ: список feedback
  r.get('/admin/feedbacks', requireAdmin, (req, res) => {
    const status = req.query.status || 'open';
    res.json(db.getFeedbacks({ status }));
  });

  // Админ: закрыть/переоткрыть/добавить заметку к feedback
  r.patch('/admin/feedbacks/:id', requireAdmin, (req, res) => {
    const { action, note } = req.body;
    if (!['done','dismissed','open'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    db.resolveFeedback(req.params.id, req.user.id, action, note);
    res.json({ ok: true });
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

  // Ручной запуск S3-«сборщика сирот». Полезно когда не хочется ждать
  // 24-часового тика после правки данных в БД.
  // Список всех объектов на S3 для админ-галереи. Каждому ключу проставляем
  // флаг orphan (на него не ссылается ни одно живое сообщение/момент/аватар).
  // Возвращаем url (публичный, через S3_PUBLIC_URL_BASE) — для админа этого
  // достаточно, presign не нужен.
  r.get('/admin/s3/list', requireSuperAdmin, async (req, res) => {
    try {
      const prefixes = ['chat/', 'moments/', 'avatars/', 'group-icons/'];
      const base = (process.env.S3_PUBLIC_URL_BASE || 'https://s3.twcstorage.ru/heymessenger').replace(/\/$/, '');
      const live = db.collectLiveS3Keys();
      // Префиксы живых моментов — чтобы не помечать всё внутри moments/{id}/ как orphan
      const liveMomentPrefixes = [];
      for (const k of live) {
        if (k.startsWith('moments/') && k.endsWith('/__live_prefix__')) {
          liveMomentPrefixes.push(k.slice(0, -'__live_prefix__'.length));
        }
      }
      const out = [];
      function kindFromKey(k) {
        const ext = (k.split('.').pop() || '').toLowerCase();
        if (['webp','jpg','jpeg','png','gif','heic','svg'].includes(ext)) return 'image';
        if (['mp4','mov','webm','mkv','m4v'].includes(ext)) return 'video';
        if (['mp3','ogg','m4a','wav','webm','opus'].includes(ext)) return 'audio';
        return 'file';
      }
      function categoryFromKey(k) {
        if (k.startsWith('chat/audio/'))   return 'chat-audio';
        if (k.startsWith('chat/files/'))   return 'chat-file';
        if (k.startsWith('chat/'))         return 'chat-image';
        if (k.startsWith('moments/'))      return 'moment';
        if (k.startsWith('avatars/'))      return 'avatar';
        if (k.startsWith('group-icons/'))  return 'group-icon';
        return 'other';
      }
      for (const p of prefixes) {
        let objs;
        try { objs = await storage.listKeysByPrefix(p); }
        catch (e) { console.warn('[s3-list]', p, e.message); continue; }
        for (const o of objs) {
          const isOrphan = !live.has(o.key)
            && !liveMomentPrefixes.some(lp => o.key.startsWith(lp));
          out.push({
            key:          o.key,
            size:         o.size || 0,
            lastModified: o.lastModified,
            url:          `${base}/${o.key}`,
            kind:         kindFromKey(o.key),
            category:     categoryFromKey(o.key),
            isOrphan,
          });
        }
      }
      // Сортировка: свежие сверху
      out.sort((a, b) => new Date(b.lastModified || 0) - new Date(a.lastModified || 0));
      res.json({ items: out, totalSize: out.reduce((s, x) => s + x.size, 0) });
    } catch (e) {
      console.error('GET /admin/s3/list error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Удалить один объект по ключу (для разовых ручных правок). Без проверки
  // ссылок — админ берёт ответственность сам. Если в БД есть живое
  // сообщение/момент/аватар на этот ключ — превью у юзера сломается.
  r.delete('/admin/s3/object', requireSuperAdmin, async (req, res) => {
    const key = req.body?.key || req.query?.key;
    if (!key) return res.status(400).json({ error: 'key required' });
    if (!adminManualS3DeleteAllowed(req, 'DELETE_S3_OBJECT')) {
      return res.status(403).json({
        error: 'Подтверждение удаления не получено',
        requiredConfirm: 'DELETE_S3_OBJECT',
        key,
      });
    }
    try {
      await storage.deleteFile(key);
      res.json({ ok: true, key });
    } catch (e) {
      console.error('DELETE /admin/s3/object error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Пакетное удаление. Принимает { keys: [...] }. Идёт последовательно,
  // чтобы не упереться в rate-limit S3-провайдера; собирает per-key
  // ok/error для отчёта в UI.
  r.post('/admin/s3/objects/delete', requireSuperAdmin, async (req, res) => {
    const keys = Array.isArray(req.body?.keys) ? req.body.keys.filter(k => typeof k === 'string' && k) : [];
    if (!keys.length) return res.status(400).json({ error: 'keys required' });
    if (keys.length > 1000) return res.status(400).json({ error: 'максимум 1000 ключей за раз' });
    if (!adminManualS3DeleteAllowed(req, 'DELETE_S3_OBJECTS')) {
      return res.status(403).json({
        error: 'Подтверждение удаления не получено',
        requiredConfirm: 'DELETE_S3_OBJECTS',
        requested: keys.length,
        deleted: 0,
        errors: 0,
        failed: [],
      });
    }
    let deleted = 0, errors = 0;
    const failed = [];
    for (const k of keys) {
      try { await storage.deleteFile(k); deleted++; }
      catch (e) { errors++; failed.push({ key: k, error: e.message }); }
    }
    res.json({ requested: keys.length, deleted, errors, failed });
  });

  r.post('/admin/system/s3-sweep', requireSuperAdmin, async (req, res) => {
    try {
      const minAgeHours = parseInt(req.query.minAgeHours);
      const allowDelete = s3DeleteEnabled() && hasS3DeleteConfirmation(req, 'DELETE_S3_ORPHANS');
      const r2 = await db.sweepOrphanS3Media(storage, {
        minAgeMs: Number.isFinite(minAgeHours) ? minAgeHours * 3600 * 1000 : undefined,
        dryRun: !allowDelete,
      });
      res.json({
        ...r2,
        allowDelete,
        requiredEnv: 'S3_SWEEP_ALLOW_DELETE=1',
        requiredConfirm: 'DELETE_S3_ORPHANS',
      });
    } catch (e) {
      console.error('POST /admin/system/s3-sweep error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── HEY-заведующий: чтение моментов и рассылок (admin only) ────────────
  r.get('/admin/system/moments', requireAdmin, (req, res) => {
    const status = req.query.status || 'published';
    res.json(db.getSystemMoments({ status }));
  });

  r.get('/admin/system/moments/:id/reactors', requireAdmin, (req, res) => {
    const m = db.getMomentById(req.params.id);
    if (!m || m.user_id !== db.SYSTEM_USER_ID) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(db.getMomentReactorsList(req.params.id, req.user.id));
  });

  function validateSystemAttachment(attachment) {
    if (!attachment) return null;
    const okType = ['image', 'images', 'audio'].includes(attachment.type);
    if (!okType) throw new Error('Неверный тип вложения');
    if (attachment.type === 'image' && !attachment.url) throw new Error('Нет url');
    if (attachment.type === 'images' && (!Array.isArray(attachment.urls) || !attachment.urls.length)) {
      throw new Error('Нет urls');
    }
    return attachment;
  }

  // Плановые рассылки HEY-заведующего (по времени с регистрации)
  r.get('/admin/system/onboarding', requireAdmin, (req, res) => {
    res.json(db.listOnboardingMessages());
  });

  r.post('/admin/system/onboarding', requireAdmin, (req, res) => {
    try {
      const { title, delayDays, delayHours, delayMinutes, text, attachment, enabled } = req.body;
      const trimmed = (text || '').trim();
      if (trimmed.length > 2000) return res.status(400).json({ error: 'Слишком длинно (макс. 2000)' });
      const att = attachment ? validateSystemAttachment(attachment) : null;
      const row = db.createOnboardingMessage({
        title, delayDays, delayHours, delayMinutes,
        text: trimmed, attachment: att, enabled,
      });
      db.logAdminAction?.({
        adminId: req.user.id,
        action: 'onboarding_create',
        reason: `rule=${row.id}; delay=${row.delay_seconds}s`,
      });
      res.json(row);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.patch('/admin/system/onboarding/:id', requireAdmin, (req, res) => {
    try {
      const patch = {};
      if (req.body.title !== undefined) patch.title = req.body.title;
      if (req.body.delayDays !== undefined) patch.delayDays = req.body.delayDays;
      if (req.body.delayHours !== undefined) patch.delayHours = req.body.delayHours;
      if (req.body.delayMinutes !== undefined) patch.delayMinutes = req.body.delayMinutes;
      if (req.body.text !== undefined) {
        const trimmed = (req.body.text || '').trim();
        if (trimmed.length > 2000) return res.status(400).json({ error: 'Слишком длинно (макс. 2000)' });
        patch.text = trimmed;
      }
      if (req.body.attachment !== undefined) {
        patch.attachment = req.body.attachment ? validateSystemAttachment(req.body.attachment) : null;
      }
      if (req.body.enabled !== undefined) patch.enabled = !!req.body.enabled;
      const row = db.updateOnboardingMessage(req.params.id, patch);
      if (!row) return res.status(404).json({ error: 'Not found' });
      db.logAdminAction?.({
        adminId: req.user.id,
        action: 'onboarding_update',
        reason: `rule=${req.params.id}`,
      });
      res.json(row);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.delete('/admin/system/onboarding/:id', requireAdmin, (req, res) => {
    const ok = db.deleteOnboardingMessage(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    db.logAdminAction?.({
      adminId: req.user.id,
      action: 'onboarding_delete',
      reason: `rule=${req.params.id}`,
    });
    res.json({ ok: true });
  });

  r.get('/admin/system/broadcasts', requireAdmin, (req, res) => {
    res.json(db.getSystemBroadcasts({}));
  });

  // Прочие сообщения от системного аккаунта без broadcast_id —
  // те, что в админке под «Рассылками» не появлялись и потому не
  // могли быть удалены через UI.
  r.get('/admin/system/orphan-messages', requireAdmin, (req, res) => {
    res.json(db.listOrphanSystemMessages({}));
  });

  r.delete('/admin/system/messages/:id', requireAdmin, (req, res) => {
    try {
      const deleted = db.deleteSystemMessage(req.params.id);
      if (deleted === 0) return res.status(404).json({ error: 'Не найдено или не от заведующего' });
      if (db.logAdminAction) db.logAdminAction({
        adminId: req.user.id, action: 'system_message_delete',
        reason: `messageId=${req.params.id}`,
      });
      res.json({ ok: true });
    } catch (e) {
      console.error('DELETE /admin/system/messages/:id', e);
      res.status(500).json({ error: e.message || 'Internal error' });
    }
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
    broadcast(momentStatsNotifyIds(m), { type: 'moment:view', momentId: req.params.id, userId: req.user.id });
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

  // ── Scheduled messages ─────────────────────────────────────────────────
  // Запланировать сообщение. Тело — то же, что у обычного: text, attachment,
  // reply_to_id + send_at (unix-секунды). Минимально через 30с в будущем
  // и максимум через 365 дней — чтобы не плодить «вечные» драфты.
  r.post('/conversations/:id/scheduled', requireAuth, (req, res) => {
    const convId = req.params.id;
    if (!db.isMember(convId, req.user.id)) {
      return res.status(403).json({ error: 'Not a member' });
    }
    const { text, attachment, reply_to_id, send_at } = req.body || {};
    const sendAt = Number(send_at);
    if (!Number.isFinite(sendAt)) return res.status(400).json({ error: 'send_at required' });
    const now = Math.floor(Date.now() / 1000);
    if (sendAt < now + 30) return res.status(400).json({ error: 'Время отправки — минимум через 30 секунд' });
    if (sendAt > now + 365 * 24 * 3600) return res.status(400).json({ error: 'Не больше года вперёд' });
    if (!text?.trim() && !attachment) return res.status(400).json({ error: 'Пустое сообщение' });
    const sched = db.scheduleMessage({
      conversationId: convId, senderId: req.user.id,
      text: text || null, attachment: attachment || null,
      replyToId: reply_to_id || null, sendAt,
    });
    res.json(sched);
  });

  r.get('/conversations/:id/scheduled', requireAuth, (req, res) => {
    if (!db.isMember(req.params.id, req.user.id)) {
      return res.status(403).json({ error: 'Not a member' });
    }
    res.json(db.listScheduledMessages(req.user.id, req.params.id));
  });

  r.delete('/scheduled/:id', requireAuth, (req, res) => {
    const ok = db.cancelScheduledMessage(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Не найдено или уже отправлено' });
    res.json({ ok: true });
  });

  r.patch('/scheduled/:id', requireAuth, (req, res) => {
    const { text, send_at } = req.body || {};
    const sendAt = Number(send_at);
    if (!Number.isFinite(sendAt)) return res.status(400).json({ error: 'send_at required' });
    const now = Math.floor(Date.now() / 1000);
    if (sendAt < now + 30) return res.status(400).json({ error: 'Время отправки — минимум через 30 секунд' });
    if (sendAt > now + 365 * 24 * 3600) return res.status(400).json({ error: 'Не больше года вперёд' });
    try {
      const updated = db.updateScheduledMessage(req.params.id, req.user.id, {
        text: text || null,
        sendAt,
      });
      if (!updated) return res.status(404).json({ error: 'Не найдено или уже отправлено' });
      res.json(updated);
    } catch (e) {
      res.status(400).json({ error: e.message || 'Не удалось обновить' });
    }
  });

  // ── Admin: Groups ───────────────────────────────────────────────────────
  r.get('/admin/groups', requireAdmin, (req, res) => {
    res.json(db.getAdminGroups({ search: req.query.search }));
  });

  r.get('/admin/groups/:id', requireAdmin, (req, res) => {
    const g = db.getAdminGroupDetail(req.params.id);
    if (!g) return res.status(404).json({ error: 'Not found' });
    res.json(g);
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
    if (user.is_admin || user.is_super_admin) return res.status(400).json({ error: 'Сначала снимите права администратора' });
    db.deleteUserAccount(req.params.id);
    if (db.logAdminAction) db.logAdminAction({
      adminId: req.user.id,
      action: 'delete_user',
      targetUserId: req.params.id,
      reason: `phone=${user.phone}`,
    });
    res.json({ ok: true });
  });

  r.post('/admin/users/:id/make-admin', requireSuperAdmin, (req, res) => {
    const user = db.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (user.is_blocked) return res.status(400).json({ error: 'Пользователь заблокирован' });
    db.adminMakeAdmin(req.params.id, req.user.id);
    res.json({ ok: true });
  });

  r.post('/admin/users/:id/revoke-admin', requireSuperAdmin, (req, res) => {
    const user = db.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (user.id === req.user.id) return res.status(400).json({ error: 'Cannot revoke your own admin' });
    if (user.is_super_admin) return res.status(400).json({ error: 'Нельзя снять права у суперадминистратора' });
    try {
      db.adminRevokeAdmin(req.params.id, req.user.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
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

  r.delete('/admin/moments/:id', requireAdmin, async (req, res) => {
    const m = db.getMomentById(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    // hard:
    //   true  → стереть строку из БД и медиа из S3
    //   false → пометить status='deleted', медиа остаётся (можно откатить)
    //   undefined → используем системную политику db.getSetting('delete_policy')
    const policy = db.getSetting('delete_policy', 'soft');
    const explicit = req.body?.hard;
    const hard = explicit === undefined ? policy === 'hard' : !!explicit;
    db.adminDeleteMoment(req.params.id, req.user.id, req.body?.reason, { hard, storage });
    if (hard) {
      try { await storage.deleteByPrefix(`moments/${req.params.id}/`); }
      catch (e) { console.error('[hard-delete moment S3]', e.message); }
    }
    broadcast(db.getContactOwners(m.user_id), { type: 'moment:deleted', momentId: req.params.id });
    broadcast([m.user_id], { type: 'moment:deleted', momentId: req.params.id });
    res.json({ ok: true, hard });
  });

  // ── Admin settings ─────────────────────────────────────────────────────────
  // Глобальные настройки админки (политика удаления и т.п.).
  r.get('/admin/settings', requireAdmin, (_req, res) => {
    res.json({
      delete_policy:        db.getSetting('delete_policy', 'soft'),        // 'soft' | 'hard'
      sales_pressure_level: db.getSetting('sales_pressure_level', 1),      // 1 (мягкий) | 2 (жёсткий)
    });
  });
  r.patch('/admin/settings', requireAdmin, (req, res) => {
    const { delete_policy, sales_pressure_level } = req.body || {};
    if (delete_policy !== undefined) {
      if (!['soft', 'hard'].includes(delete_policy)) {
        return res.status(400).json({ error: 'Invalid delete_policy' });
      }
      db.setSetting('delete_policy', delete_policy);
    }
    if (sales_pressure_level !== undefined) {
      const lvl = Number(sales_pressure_level);
      if (![1, 2].includes(lvl)) {
        return res.status(400).json({ error: 'Invalid sales_pressure_level' });
      }
      db.setSetting('sales_pressure_level', lvl);
    }
    res.json({
      ok: true,
      delete_policy:        db.getSetting('delete_policy', 'soft'),
      sales_pressure_level: db.getSetting('sales_pressure_level', 1),
    });
  });

  // Публичный (без admin) геттер для клиентского кода — клиент должен
  // знать уровень нажима чтобы показывать/не показывать промо-блоки.
  // Возвращаем только public-флаги, не утечка delete_policy и прочего.
  r.get('/settings/public', (_req, res) => {
    res.json({
      sales_pressure_level: db.getSetting('sales_pressure_level', 1),
    });
  });

  // Полное удаление пользователя со всеми материалами (моменты, медиа в S3,
  // контакты, реакции, push-подписки, аватарка, presence, ...). Сообщения
  // анонимизируются ('[сообщение удалено]'), чтобы не порвать чаты других
  // участников. Tenants освобождаются (owner=NULL), сам tenant остаётся.
  r.delete('/admin/users/:id/hard', requireAdmin, async (req, res) => {
    const target = db.findUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Not found' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'Нельзя удалить себя' });
    if (target.is_admin || target.is_super_admin) {
      return res.status(400).json({ error: 'Сначала снимите права администратора' });
    }
    try {
      const { s3Keys, s3Prefixes } = db.hardDeleteUserAccount(req.params.id);
      for (const k of s3Keys)     { try { await storage.deleteFile(k); }   catch (e) { console.error('[hard-delete user S3 key]', e.message); } }
      for (const p of s3Prefixes) { try { await storage.deleteByPrefix(p); } catch (e) { console.error('[hard-delete user S3 prefix]', e.message); } }
      broadcast([req.params.id], { type: 'account:deleted' });
    } catch (e) {
      console.error('[hard-delete user]', e);
      return res.status(500).json({ error: 'Hard delete failed: ' + e.message });
    }
    res.json({ ok: true });
  });

  r.get('/admin/logs', requireAdmin, (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    res.json(db.getAdminLogs(limit));
  });

  // ── Batch admin actions ──────────────────────────────────────────────────
  // Общий помощник: применяет одиночную операцию `op(id)` к списку ids,
  // собирает результат и не падает на первом фейле — фронт показывает
  // сводку «N успешно, M с ошибкой».
  async function runBatch(ids, op) {
    if (!Array.isArray(ids) || !ids.length) return { processed: 0, failed: [] };
    if (ids.length > 500) ids = ids.slice(0, 500); // hard cap
    const failed = [];
    let processed = 0;
    for (const id of ids) {
      try { await op(id); processed++; }
      catch (e) { failed.push({ id, error: e.message || String(e) }); }
    }
    return { processed, failed };
  }

  // Пользователи: block / unblock / delete (soft) / hard_delete
  r.post('/admin/users/batch', requireAdmin, async (req, res) => {
    const { ids, action, reason } = req.body || {};
    const ALLOWED = ['block', 'unblock', 'delete', 'hard_delete'];
    if (!ALLOWED.includes(action)) return res.status(400).json({ error: 'Invalid action' });

    const result = await runBatch(ids, async (id) => {
      const u = db.findUserById(id);
      if (!u) throw new Error('Not found');
      if (u.id === req.user.id) throw new Error('Нельзя применить к себе');
      if ((action === 'delete' || action === 'hard_delete') && (u.is_admin || u.is_super_admin)) {
        throw new Error('Сначала снимите права администратора');
      }
      if (action === 'block')   return db.adminBlockUser(id, req.user.id, reason);
      if (action === 'unblock') return db.adminUnblockUser(id, req.user.id);
      if (action === 'delete')  { db.deleteUserAccount(id); broadcast([id], { type: 'account:deleted' }); return; }
      if (action === 'hard_delete') {
        const { s3Keys, s3Prefixes } = db.hardDeleteUserAccount(id);
        for (const k of s3Keys)     { try { await storage.deleteFile(k); }    catch {} }
        for (const p of s3Prefixes) { try { await storage.deleteByPrefix(p); } catch {} }
        broadcast([id], { type: 'account:deleted' });
      }
    });
    res.json({ ok: true, ...result });
  });

  // Моменты: delete (soft) / hard_delete
  r.post('/admin/moments/batch', requireAdmin, async (req, res) => {
    const { ids, action, reason } = req.body || {};
    const ALLOWED = ['delete', 'hard_delete'];
    if (!ALLOWED.includes(action)) return res.status(400).json({ error: 'Invalid action' });
    const hard = action === 'hard_delete';

    const result = await runBatch(ids, async (id) => {
      const m = db.getMomentById(id);
      if (!m) throw new Error('Not found');
      db.adminDeleteMoment(id, req.user.id, reason, { hard });
      if (hard) { try { await storage.deleteByPrefix(`moments/${id}/`); } catch {} }
      try {
        broadcast(db.getContactOwners(m.user_id), { type: 'moment:deleted', momentId: id });
        broadcast([m.user_id], { type: 'moment:deleted', momentId: id });
      } catch {}
    });
    res.json({ ok: true, ...result });
  });

  // Жалобы: resolved / dismissed
  r.post('/admin/reports/batch', requireAdmin, (req, res) => {
    const { ids, action } = req.body || {};
    const ALLOWED = ['resolved', 'dismissed'];
    if (!ALLOWED.includes(action)) return res.status(400).json({ error: 'Invalid action' });
    // resolveReport не бросает на «не найдено», просто 0 rows — считаем
    // всё успешным; ошибки кроме программных не ожидаются.
    let processed = 0;
    for (const id of (Array.isArray(ids) ? ids.slice(0, 500) : [])) {
      try { db.resolveReport(id, req.user.id, action); processed++; } catch {}
    }
    res.json({ ok: true, processed, failed: [] });
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
    const explicitTenantId = (req.query.tenant || '').trim() || null;

    if (!email) return res.status(400).json({ ok: false, error: 'email обязателен' });
    if (!awo.isValidEmail(email)) return res.status(400).json({ ok: false, error: 'Неверный формат email' });

    // Уже есть аккаунт с таким email — фронт покажет «войди»
    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.json({ ok: true, alreadyRegistered: true, email, course });
    }

    // Ищем подготовленный webhook'ом инвайт. Если в query явно указан tenant
    // — фильтруем по нему; иначе берём свежайший в любом tenant'е.
    let invite = db.findActiveSchoolInviteByEmail(email, explicitTenantId);
    // Tenant для проверки sig + связанных операций
    let tenantId = invite?.tenant_id || explicitTenantId || db.DEFAULT_TENANT_ID;
    const tenant = db.getTenantById(tenantId);
    // verifyJoin теперь с tenant-секретом
    const validSig = sig && tenant && awo.verifyJoin(email, course, sig, tenant.awo_join_secret);

    // Если подписи нет и инвайта нет — отказ. Возможно оплата ещё не дошла.
    if (!validSig && !invite) {
      return res.status(403).json({
        ok: false,
        error: 'Ссылка недействительна или оплата ещё не подтверждена. Попробуйте через несколько минут.',
      });
    }

    // Если подпись валидна, но инвайта нет (webhook ещё не пришёл) — создаём на лету
    if (validSig && !invite) {
      invite = db.createSchoolInvite({ bound_email: email, course, tenantId });
    }

    res.json({
      ok: true,
      alreadyRegistered: false,
      email,
      course: invite.course || course,
      schoolInviteCode: invite.code,
      schoolName: db.getSchoolAccount(invite.tenant_id)?.name || 'Школа',
      tenantId: invite.tenant_id || null,
      // Поля для предзаполнения формы регистрации (из payload АВО)
      prefillName:  invite.bound_name  || null,
      prefillPhone: invite.bound_phone || null,
    });
  });

  // Webhook от АВО — публичный endpoint, защищён токеном из .env (AWO_WEBHOOK_TOKEN)
  // Multi-tenant AWO webhook. Два URL'а:
  //   POST /api/integrations/awo/webhook?token=…              (legacy → tnt_default)
  //   POST /api/integrations/awo/webhook/:tenantId?token=…    (явный tenant)
  // В обоих случаях token должен совпадать с tenant.awo_webhook_token.
  function handleAwoWebhook(req, res, explicitTenantId) {
    const payload = req.body || {};
    console.log('[AWO webhook]', JSON.stringify(payload).slice(0, 500));

    const provided = awo.extractWebhookToken(req);
    let tenant = null;
    if (explicitTenantId) {
      tenant = db.getTenantById(explicitTenantId);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      if (tenant.awo_webhook_token !== provided) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    } else {
      // Legacy URL — ищем tenant'а по токену. Если токен пустой и default
      // tenant тоже без токена (dev) — пропускаем.
      if (provided) {
        tenant = db.getTenantByToken(provided);
        if (!tenant) return res.status(401).json({ error: 'Invalid token' });
      } else {
        tenant = db.getTenantById(db.DEFAULT_TENANT_ID);
        if (tenant?.awo_webhook_token) {
          // У дефолта есть токен, а в запросе нет → отказ
          return res.status(401).json({ error: 'Invalid token' });
        }
      }
    }
    const tenantId = tenant.id;

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

    // Идемпотентность — per-tenant
    if (db.awoIsProcessed(id_account, tenantId)) {
      return res.json({ ok: true, ignored: 'already_processed' });
    }

    // Тестовый режим из настроек tenant'а
    if (tenant.test_mode) {
      const testCourse = (tenant.test_course || '').trim().toLowerCase();
      if (testCourse && goods.toLowerCase() !== testCourse) {
        db.awoMarkProcessed({ id_account, email: rawEmail, phone: rawPhone, course: goods,
          result: 'ignored_test_mode', raw_payload: payload, tenantId });
        console.log(`[AWO][${tenantId}] тестовый режим: курс "${goods}" не совпадает с "${testCourse}" — игнор`);
        return res.json({ ok: true, ignored: 'test_mode' });
      }
    }

    // Валидация — email обязателен (основной ключ)
    if (!awo.isValidEmail(rawEmail)) {
      db.awoMarkProcessed({ id_account, email: rawEmail, phone: rawPhone, course: goods,
        result: 'invalid_email', raw_payload: payload, tenantId });
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
      try { db.creditSchoolReferral(tenantId, existing.id); } catch (e) {
        console.warn('[referral] school credit failed:', e.message);
      }
      if (goods) {
        const chatId = db.getChatForCourse(goods, tenantId);
        if (chatId) {
          try {
            const r = db.addUserToChat(chatId, existing.id);
            if (r.added) {
              try {
                const senderId = db.getSchoolUserId(tenantId);
                const msg = db.createMessage({
                  conversationId: chatId,
                  senderId,
                  text: `🎓 ${existing.name} присоединился к курсу «${goods}»`,
                });
                const senderUser = db.findUserById(senderId);
                const members = db.getConversationMembers(chatId);
                broadcast(members, { type: 'message:new',
                  message: { ...msg, sender_name: senderUser?.name || 'Школа', conversationId: chatId } });
              } catch (e) { console.error('[awo-existing-msg]', e.message); }
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
        result: extraResult, raw_payload: payload, tenantId });
      return res.json({ ok: true, result: extraResult });
    }

    // Новый пользователь — создаём школьный инвайт с пред-заполненными
    // полями (name/phone), фронт подставит их на форму регистрации.
    const invite = db.createSchoolInvite({
      bound_email: rawEmail, bound_phone: phone, course: goods, bound_name: rawName,
      tenantId,
    });
    db.awoMarkProcessed({ id_account, email: rawEmail, phone, course: goods,
      invite_code: invite.code, result: 'invite_created', raw_payload: payload, tenantId });

    res.json({ ok: true, result: 'invite_created', invite_code: invite.code });
  }

  // Legacy URL → дефолтный tenant (через token lookup)
  r.post('/integrations/awo/webhook', rateLimit(120, 60 * 1000),
    (req, res) => handleAwoWebhook(req, res, null));
  // Multi-tenant URL — явный tenant id
  r.post('/integrations/awo/webhook/:tenantId', rateLimit(120, 60 * 1000),
    (req, res) => handleAwoWebhook(req, res, req.params.tenantId));

  // Админка: настройки AWO
  // Helper: tenantId из query или дефолт. Все админ-AWO ручки умеют его принять.
  function tenantFromReq(req) {
    return (req.query.tenantId || req.body?.tenantId || db.DEFAULT_TENANT_ID);
  }

  // Helper: формирует объект ответа settings из tenant'а (без секретов лишних)
  function tenantToSettings(t, opts = {}) {
    const account = t.account_id ? db.findUserById(t.account_id) : null;
    // Со-админам не отдаём webhook_token (это секрет владельца) — у них
    // в UI всё равно нет блоков, его потребляющих, и зная токен можно
    // подделывать запросы от АВО. Владелец и системный админ видят токен.
    const includeSecrets = opts.includeSecrets !== false;
    return {
      tenant_id:    t.id,
      owner_id:     t.owner_id || null,
      test_mode:    !!t.test_mode,
      test_course:  t.test_course || '',
      chat_excludes: t.chat_excludes || 'слушатель,запись',
      webhook_token: includeSecrets ? t.awo_webhook_token : null,
      school_account: account ? {
        id: account.id, name: account.name, avatar: account.avatar, phone: account.phone,
        is_default: false,
      } : null,
    };
  }

  r.get('/admin/awo/settings', requireTenantAccess(tenantFromReq), (req, res) => {
    res.json(tenantToSettings(req.tenant, { includeSecrets: req.isTenantOwner }));
  });
  r.put('/admin/awo/settings', requireTenantAccess(tenantFromReq), (req, res) => {
    const tid = req.tenant.id;
    const { test_mode, test_course, chat_excludes, school_account_id } = req.body || {};
    try {
      // Привязка/отвязка официального школьного аккаунта — только владелец
      // или системный админ. Со-админ не может перепривязать школу на
      // другой профиль: это операция уровня владельца.
      if (school_account_id !== undefined && !req.isTenantOwner) {
        return res.status(403).json({
          error: 'Менять привязанный аккаунт школы может только владелец',
        });
      }
      // school_account_id: не-админу разрешаем привязывать ТОЛЬКО себя
      // или кого-то из своих контактов (контакты — двустороннее согласие на
      // взаимодействие, так что «угона» чужого профиля не происходит).
      if (school_account_id !== undefined && school_account_id) {
        if (!req.tenantUser.is_admin && school_account_id !== req.tenantUser.id) {
          // Проверяем что target есть в контактах у владельца tenant'а
          const contactIds = db.getContactIds(req.tenantUser.id) || [];
          if (!contactIds.includes(school_account_id)) {
            return res.status(403).json({ error: 'Привязать можно себя или кого-то из своих контактов' });
          }
        }
        const u = db.findUserById(school_account_id);
        if (!u) throw new Error('Пользователь не найден');
        if (u.is_blocked) throw new Error('Пользователь заблокирован');
        if (u.is_deleted) throw new Error('Пользователь удалил аккаунт');
      }
      const t = db.updateTenant(tid, {
        test_mode, test_course, chat_excludes,
        ...(school_account_id !== undefined ? { account_id: school_account_id || null } : {}),
      });
      res.json(tenantToSettings(t, { includeSecrets: req.isTenantOwner }));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Маппинг курс ↔ чат — per-tenant
  r.get('/admin/awo/course-chats', requireTenantAccess(tenantFromReq), (req, res) => {
    res.json(db.listAwoCourseChats(req.tenant.id));
  });
  r.post('/admin/awo/course-chats', requireTenantAccess(tenantFromReq), (req, res) => {
    const { course, chat_id } = req.body || {};
    if (!course || !chat_id) return res.status(400).json({ error: 'course и chat_id обязательны' });
    // Для не-админа: можно мапить только чаты, где он сам админ группы
    if (!req.tenantUser.is_admin) {
      if (!db.isGroupAdmin(chat_id, req.tenantUser.id)) {
        return res.status(403).json({ error: 'Можно привязывать только чаты, где вы админ' });
      }
    }
    try {
      db.setAwoCourseChat(course, chat_id, req.tenant.id);
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.delete('/admin/awo/course-chats/:course', requireTenantAccess(tenantFromReq), (req, res) => {
    db.deleteAwoCourseChat(req.params.course, req.tenant.id);
    res.json({ ok: true });
  });

  // Список доступных групповых чатов для маппинга. Админу — все группы,
  // обычному юзеру — только где он сам админ.
  r.get('/admin/group-chats', requireAuth, (req, res) => {
    const user = db.findUserById(req.user.id);
    if (!user || user.is_blocked) return res.status(403).json({ error: 'Forbidden' });
    const all = db.listAllGroupChats();
    if (user.is_admin) return res.json(all);
    res.json(all.filter(c => db.isGroupAdmin(c.id, user.id)));
  });

  // Лог webhook'ов AWO — per-tenant
  r.get('/admin/awo/log', requireTenantAccess(tenantFromReq), (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    res.json(db.awoListProcessed(limit, req.tenant.id));
  });

  // ── Multi-tenant CRUD ───────────────────────────────────────────────────
  // Список школ: админу — все, бизнес-юзеру — свои + те, где он со-админ
  r.get('/admin/awo/tenants', requireBusinessOrAdmin, (req, res) => {
    const user = req.businessUser;
    if (user.is_admin) return res.json(db.listTenants());
    res.json(db.listTenantsForUser(user.id));
  });
  // Создание школы: бизнес-юзер или админ, non-admin лимит 3 школы
  const MAX_TENANTS_PER_USER = 3;
  r.post('/admin/awo/tenants', requireBusinessOrAdmin, (req, res) => {
    const { name } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });
    const user = req.businessUser;
    if (!user.is_admin) {
      // Создавать новые школы могут только системные админы и
      // approved-бизнес-юзеры. Со-админы чужих школ — нет.
      if (user.business_status !== 'approved') {
        return res.status(403).json({
          error: 'Создавать школы могут только бизнес-аккаунты с подтверждённым доступом',
        });
      }
      const own = db.listTenantsForOwner(user.id);
      if (own.length >= MAX_TENANTS_PER_USER) {
        return res.status(403).json({ error: `Лимит школ — ${MAX_TENANTS_PER_USER}` });
      }
    }
    try {
      const t = db.createTenant({ name: name.trim(), ownerId: user.id });
      res.json(t);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.delete('/admin/awo/tenants/:id',
    requireTenantAccess(req => req.params.id),
    (req, res) => {
      if (req.params.id === db.DEFAULT_TENANT_ID) {
        return res.status(400).json({ error: 'Нельзя удалить tenant по умолчанию' });
      }
      // Только владелец (или системный админ) может удалить школу.
      if (!req.isTenantOwner) {
        return res.status(403).json({ error: 'Удалить школу может только владелец' });
      }
      db.deleteTenant(req.params.id);
      res.json({ ok: true });
    });

  // ── Tenant admins (co-admins) ───────────────────────────────────────────
  // Только владелец (и системный админ) видят и меняют этот список.
  r.get('/admin/awo/tenants/:id/admins',
    requireTenantAccess(req => req.params.id),
    (req, res) => {
      if (!req.isTenantOwner) {
        return res.status(403).json({ error: 'Только владелец может управлять админами' });
      }
      res.json(db.listTenantAdmins(req.params.id));
    });

  r.post('/admin/awo/tenants/:id/admins',
    requireTenantAccess(req => req.params.id),
    (req, res) => {
      if (!req.isTenantOwner) {
        return res.status(403).json({ error: 'Только владелец может добавлять админов' });
      }
      // Принимаем либо userId, либо phone — для удобства из UI школы.
      let { userId, phone } = req.body || {};
      if (!userId && phone) {
        const u = db.findUserByPhone(phone);
        if (!u) return res.status(404).json({ error: 'Пользователь с таким телефоном не найден' });
        userId = u.id;
      }
      if (!userId) return res.status(400).json({ error: 'userId или phone обязателен' });
      try {
        const admins = db.addTenantAdmin(req.params.id, userId, req.user.id);
        res.json(admins);
      } catch (e) { res.status(400).json({ error: e.message }); }
    });

  r.delete('/admin/awo/tenants/:id/admins/:userId',
    requireTenantAccess(req => req.params.id),
    (req, res) => {
      if (!req.isTenantOwner) {
        return res.status(403).json({ error: 'Только владелец может удалять админов' });
      }
      db.removeTenantAdmin(req.params.id, req.params.userId);
      res.json(db.listTenantAdmins(req.params.id));
    });
  r.post('/admin/awo/tenants/:id/rotate-token',
    requireTenantAccess(req => req.params.id),
    (req, res) => {
      // Ротация webhook-токена — только владелец / системный админ.
      // Со-админ не должен иметь возможность поломать боевой webhook,
      // от которого зависят чужие курсы.
      if (!req.isTenantOwner) {
        return res.status(403).json({ error: 'Ротация токена доступна только владельцу' });
      }
      const t = db.rotateTenantToken(req.params.id);
      if (!t) return res.status(404).json({ error: 'Tenant not found' });
      res.json(t);
    });

  // Сгенерировать /join-ссылку для конкретного tenant'а
  r.post('/admin/awo/join-link',
    requireTenantAccess(req => req.body?.tenantId || db.DEFAULT_TENANT_ID),
    (req, res) => {
    const email  = (req.body?.email  || '').trim().toLowerCase();
    const course = (req.body?.course || '').trim();
    const tenant = req.tenant;
    const tenantId = tenant.id;
    if (!awo.isValidEmail(email)) return res.status(400).json({ error: 'Неверный email' });
    const sig = awo.signJoin(email, course, tenant.awo_join_secret);
    const base = process.env.PUBLIC_URL || (req.protocol + '://' + req.get('host'));
    const tenantParam = tenantId !== db.DEFAULT_TENANT_ID ? `&tenant=${encodeURIComponent(tenantId)}` : '';
    const url = `${base}/join?email=${encodeURIComponent(email)}&course=${encodeURIComponent(course)}${tenantParam}&sig=${sig}`;
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