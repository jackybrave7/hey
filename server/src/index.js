// server/src/index.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
// db loads automatically
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db/init');
const makeRouter = require('./routes');
const setupWS = require('./ws');

const app = express();
const PORT = process.env.PORT || 3001;

// In dev, reflect any origin (LAN access from other devices via Vite proxy still routes
// API/WS through the host's loopback, but the browser-side origin can be any LAN IP).
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '30mb' }));
// AWO webhook отправляет данные в формате application/x-www-form-urlencoded —
// добавляем парсер, чтобы req.body содержал поля
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../data/uploads')));

const { mediaProxyHandler, streamMedia } = require('./mediaProxy');
// GET /media/* — nginx в проде проксирует на S3; без nginx (dev, vite proxy) — Node стримит
app.get('/media/*', mediaProxyHandler);
// Legacy /api/media/* → тот же стрим (без 301 — иначе SPA/vite отдаёт HTML)
app.get('/api/media/*', (req, res) => {
  const key = req.path.replace(/^\/api\/media\//, '');
  streamMedia(key, res).catch(e => {
    console.error('[/api/media]', key, e.message);
    if (!res.headersSent) res.status(502).end();
  });
});
// Pre-downloaded test-user images (avoid third-party CDN blocking by browsers).
// Под /api/ потому что только этот префикс проксируется nginx'ом → Node.
app.use('/api/test-images', express.static(path.join(__dirname, '../data/test-images'), {
  maxAge: '7d',
}));

// Health check
app.get('/health', (_, res) => res.json({ ok: true, time: new Date() }));

// Create HTTP server (shared with WebSocket)
const server = http.createServer(app);

// WebSocket — must come after server creation
const { broadcast } = setupWS(server, db);

// REST API
app.use('/api', makeRouter(db, broadcast));

// Serve built frontend in production (after API routes)
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../../web/dist');
  // extensions:['html'] позволяет статически отдавать /for-schools без .html
  // — нужно для SEO-страницы /for-schools.html, которая лежит в web/public/.
  app.use(express.static(dist, { extensions: ['html'] }));
  // Явный alias на случай если extensions-резолв в текущей версии
  // express.static не срабатывает раньше SPA-fallback ниже.
  app.get('/for-schools', (req, res) =>
    res.sendFile(path.join(dist, 'for-schools.html')));
  // SPA-fallback. Если запрошенный путь — известная статика на диске,
  // express.static выше уже отдал её. Сюда попадают только клиентские
  // роуты React-приложения → отдаём index.html.
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}


server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════╗
  ║  HEY Server running          ║
  ║  HTTP  → http://localhost:${PORT}  ║
  ║  WS    → ws://localhost:${PORT}/ws ║
  ╚══════════════════════════════╝
  `);
});

// ── Scheduled jobs ─────────────────────────────────────────────────────────
// Раз в час прогоняем grace-период удаления: всё что просрочено (по умолчанию
// >30 дней с момента self-delete) → hard-delete + S3 cleanup. На старте тоже
// сразу прогоняем, чтобы не ждать целый час после рестарта.
const storage = require('./storage');
function runGraceExpiry() {
  try {
    const r = db.expireDeletionGrace(storage);
    if (r.processed) console.log(`[grace-expire] hard-deleted ${r.processed} expired account(s)`);
  } catch (e) {
    console.error('[grace-expire] failed:', e.message);
  }
}
setTimeout(runGraceExpiry, 30 * 1000);          // через 30с после старта
setInterval(runGraceExpiry, 60 * 60 * 1000);    // далее каждый час

// Диспетчер отложенных сообщений. Раз в 10 секунд достаёт все
// scheduled_messages с send_at <= now и отправляет их через обычный
// createMessage + WS-broadcast. Удаляем запись сразу после успешной
// доставки, чтобы исключить повторную отправку. Точность 10 секунд
// нас устраивает: пользовательский ввод send_at и так с минутной
// гранулярностью, плюс minDelay 30 секунд в роуте.
function runScheduledDispatcher() {
  let due;
  try { due = db.popDueScheduledMessages(Math.floor(Date.now() / 1000), 50); }
  catch (e) { return console.error('[scheduled] poll failed:', e.message); }
  if (!due.length) return;
  for (const s of due) {
    try {
      // Проверим что отправитель ещё существует и состоит в чате —
      // могли удалить аккаунт / выйти из группы за это время.
      const u = db.findUserById(s.sender_id);
      if (!u || u.is_blocked || u.is_deleted || !db.isMember(s.conversation_id, s.sender_id)) {
        db.deleteScheduledMessageById(s.id);
        continue;
      }
      const msg = db.createMessage({
        conversationId: s.conversation_id,
        senderId: s.sender_id,
        text: s.text,
        attachment: s.attachment,
        replyToId: s.reply_to_id,
      });
      db.deleteScheduledMessageById(s.id);
      const members = db.getConversationMembers(s.conversation_id);
      broadcast(members, { type: 'message:new', message: { ...msg, sender_name: u.name } });
      // Отправителю отдельно — чтобы его клиент убрал запись из
      // индикатора «Запланировано: N» без перезапроса.
      broadcast([s.sender_id], { type: 'scheduled:sent',
        conversationId: s.conversation_id, scheduledId: s.id });
    } catch (e) {
      console.error('[scheduled] dispatch failed for', s.id, e.message);
      // На ошибке оставляем запись — может succeed на следующем тике.
      // Если становится зомби (повторяющиеся фейлы) — потом разберём.
    }
  }
}
setTimeout(runScheduledDispatcher, 5 * 1000);
setInterval(runScheduledDispatcher, 10 * 1000);

// Telegram-бот восстановления пароля. Тихо ничего не делает если
// TG_SUPPORT_BOT_TOKEN не задан в окружении.
const { startBot } = require('./tgBot');
startBot({ db }).catch(e => console.error('[tg-bot] fatal:', e.message));

// S3-«сборщик сирот». Потенциально удаляет пользовательские медиа, поэтому
// автоматический запуск выключен по умолчанию. Ручная кнопка в админке остаётся.
// Для автоочистки явно выставить S3_SWEEP_ENABLED=1.
async function runOrphanSweep() {
  try {
    const r = await db.sweepOrphanS3Media(storage);
    console.log('[s3-sweep]', JSON.stringify(r));
  } catch (e) {
    console.error('[s3-sweep] failed:', e.message);
  }
}
if (process.env.S3_SWEEP_ENABLED === '1') {
  setTimeout(runOrphanSweep, 10 * 60 * 1000);            // через 10 минут после старта
  setInterval(runOrphanSweep, 24 * 60 * 60 * 1000);      // далее раз в сутки
}
