// tgBot.js — Telegram-бот восстановления пароля.
//
// Бот: @hey_messenger_support_bot
// Сценарий:
//   1. Юзер нажимает /start (или /reset).
//   2. Бот просит поделиться номером (request_contact).
//   3. Юзер делится — Telegram отдаёт verified phone_number.
//   4. Бот ищет HEY-юзера с таким номером. Если есть — генерит
//      разовый пароль, ставит must_change_password=1, сообщает.
//   5. Юзер логинится в HEY обычным потоком — при первом входе
//      попросит задать постоянный пароль (см. ForcePasswordModal).
//
// Long-poll по https://api.telegram.org/bot<TOKEN>/getUpdates —
// без необходимости настраивать webhook + ssl + публичный URL.
// Бот тихо отключён, если TG_SUPPORT_BOT_TOKEN не задан.

const bcrypt = require('bcryptjs');

const TG_API = (token) => `https://api.telegram.org/bot${token}`;

function normalizePhone(s) {
  const digits = String(s || '').replace(/\D/g, '');
  if (!digits) return '';
  // Telegram contact для российских номеров часто отдаёт без +,
  // 11 цифр начинающихся с 7 или 8. Приводим к E.164.
  if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1);
  return '+' + digits;
}

// 10-символьный пароль из понятных символов (без 0/O/l/I).
function genTempPassword() {
  const ABC = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 10; i++) s += ABC[Math.floor(Math.random() * ABC.length)];
  return s;
}

async function tg(token, method, body) {
  const res = await fetch(TG_API(token) + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json();
  if (!data.ok) throw new Error('TG ' + method + ': ' + (data.description || res.status));
  return data.result;
}

async function send(token, chatId, text, extra) {
  try { await tg(token, 'sendMessage', { chat_id: chatId, text, ...(extra || {}) }); }
  catch (e) { console.error('[tg-bot] send fail:', e.message); }
}

const RESET_KEYBOARD = {
  reply_markup: {
    keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]],
    resize_keyboard: true, one_time_keyboard: true,
  },
};

async function handleUpdate(upd, ctx) {
  const msg = upd.message;
  if (!msg) return;
  const chatId = msg.chat.id;
  const { token, db } = ctx;

  // Юзер поделился контактом → выдаём разовый пароль.
  if (msg.contact) {
    // Принимаем только СВОЙ собственный контакт — phone_number Telegram
    // верифицирует, и его user_id должен совпадать с автором сообщения,
    // иначе кто угодно мог бы переслать чужой контакт.
    if (msg.contact.user_id && msg.contact.user_id !== msg.from?.id) {
      return send(token, chatId,
        'Пришли СВОЙ номер (кнопка «📱 Поделиться номером» ниже), а не чужой контакт.',
        RESET_KEYBOARD);
    }
    const phone = normalizePhone(msg.contact.phone_number);
    let user = db.findUserByPhone(phone);
    if (!user) {
      return send(token, chatId,
        `Не нашёл аккаунт HEY с номером ${phone}.\n\n` +
        'Если регистрировался с другим номером — переключи аккаунт в Telegram ' +
        'и пришли его контакт, или напиши боту повторно командой /start.');
    }
    if (user.is_blocked || user.is_deleted) {
      return send(token, chatId,
        `Аккаунт ${phone} заблокирован или удалён. Свяжись с админом.`);
    }
    const tmp = genTempPassword();
    try {
      db.updateUser(user.id, {
        password: bcrypt.hashSync(tmp, 10),
        must_change_password: 1,
      });
    } catch (e) {
      console.error('[tg-bot] pw reset fail:', e.message);
      return send(token, chatId, 'Что-то сломалось при обновлении пароля, напиши админу.');
    }
    await send(token, chatId,
      `✓ Готово!\n\nВойди в HEY:\n• Телефон: <code>${user.phone}</code>\n` +
      `• Разовый пароль: <code>${tmp}</code>\n\n` +
      `При первом входе попросит задать постоянный пароль.`,
      { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } });
    return;
  }

  // Команды / любой текст — показываем инструкцию + кнопку контакта.
  const text = (msg.text || '').trim().toLowerCase();
  if (text === '/start' || text === '/reset' || text === '/restore' ||
      text === 'reset' || text === 'восстановить' || text === 'восстановление') {
    return send(token, chatId,
      'Привет! Это поддержка HEY Messenger 🔑\n\n' +
      'Чтобы восстановить доступ — нажми кнопку ниже и поделись своим номером телефона. ' +
      'Если он совпадёт с аккаунтом HEY, я сразу выдам разовый пароль.',
      RESET_KEYBOARD);
  }
  // Fallback
  return send(token, chatId,
    'Я понимаю только команду /reset для восстановления пароля HEY.\n' +
    'Жми /reset и поделись номером.',
    RESET_KEYBOARD);
}

async function setupCommands(token) {
  try {
    await tg(token, 'setMyCommands', {
      commands: [
        { command: 'start',  description: 'Начать' },
        { command: 'reset',  description: 'Восстановить пароль HEY' },
      ],
    });
  } catch (e) { console.warn('[tg-bot] setMyCommands fail:', e.message); }
}

async function startBot({ db }) {
  const token = process.env.TG_SUPPORT_BOT_TOKEN;
  if (!token) {
    console.log('[tg-bot] TG_SUPPORT_BOT_TOKEN не задан — бот не запущен');
    return;
  }
  await setupCommands(token);
  console.log('[tg-bot] long-poll started');

  let offset = 0;
  // Если приложение перезапустилось и накопились сообщения — пропускаем
  // их (offset = -1 даёт «только последнее», +1 = drain).
  try {
    const drain = await tg(token, 'getUpdates', { offset: -1, timeout: 0 });
    if (drain.length) offset = drain[drain.length - 1].update_id + 1;
  } catch {}

  // Экспоненциальный backoff: с московского VDS api.telegram.org может
  // быть недоступен вовсе (connect timeout). Раньше бот ретраил каждые
  // ~15с и спамил лог «poll fail» тысячами строк в сутки. Теперь пауза
  // растёт 5с → 10с → … → 15 мин и держится там, пока сеть не оживёт.
  // Лог — только на первом фейле и при восстановлении.
  let failStreak = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const updates = await tg(token, 'getUpdates', { offset, timeout: 25 });
      if (failStreak) {
        console.log(`[tg-bot] связь с Telegram восстановлена (после ${failStreak} фейлов)`);
        failStreak = 0;
      }
      for (const upd of updates) {
        offset = upd.update_id + 1;
        try { await handleUpdate(upd, { token, db }); }
        catch (e) { console.error('[tg-bot] handle fail:', e.message); }
      }
    } catch (e) {
      failStreak++;
      if (failStreak === 1 || failStreak % 50 === 0) {
        console.error(`[tg-bot] poll fail (#${failStreak}):`, e.message);
      }
      const delay = Math.min(5000 * 2 ** Math.min(failStreak - 1, 8), 15 * 60 * 1000);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

module.exports = { startBot };
