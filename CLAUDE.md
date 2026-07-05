# HEY Messenger — заметки для будущих сессий

«HEY» — мессенджер с лентой моментов, групповыми/директ чатами,
многотенантной интеграцией с АВО (АвтоВебОфис) и админкой.

## Стек

- **Web:** React 18 + Vite, React Router v6. Один файл `web/src/components/Screens.jsx` содержит большинство экранов (~10k строк). Hooks-стиль, без TS, без CSS-фреймворка — inline-стили + `index.css`. Иконки — самописный `<Icon name="…"/>`.
- **Server:** Node + Express, `better-sqlite3`, `ws` (WebSocket). Точки входа — `server/src/index.js`, основной роутер — `server/src/routes.js` (~2k строк). БД-логика — `server/src/db/db.js`.
- **Auth:** JWT в Authorization header + cookie-сессия для виджета в АВО ЛК (`server/src/auth.js`). `init(db)` дёргается на старте — после этого `requireAuth` делает DB lookup и валидирует `is_blocked`, токен до блокировки.
- **Хранилище медиа:** S3 (через presign), fallback на data URL в БД. См. `server/src/storage.js`, `web/src/lib/uploadMedia.js`.
- **Realtime:** WS, события через `broadcast(memberIds, msg)`.

## Деплой

Прод: `hey-messenger.ru`, сервер `root@45.153.71.162` (Москва), app в Docker `hey`, рабочая директория `/opt/hey`, порт `3002`.

```bash
ssh root@45.153.71.162 "cd /opt/hey && git pull && docker exec hey sh -c 'cd /app && npm run build' && docker restart hey"
```

Деплой с Windows: `deploy.bat` (сборка + push + git pull + Docker restart).

Ветка для разработки: `feat/messaging-extras` (она же deploy-ветка).

База в проде: `/opt/hey/server/data/hey.db` (SQLite). Бэкап рядом: `hey_backup.db`.

## Ключевые особенности кода (не очевидные)

### Whitelist в `db.updateUser`

```js
const allowed = ['name','phone','birthday','avatar','bio','headline','email','password','must_change_password'];
```

Раньше там не было `password`/`must_change_password` — из-за этого
`POST /me/password` ничего не делал и пользователь после сброса
админом залипал в модалке смены пароля.

### `must_change_password`

Если выставлен — клиентский api.js при 403 + `code='MUST_CHANGE_PASSWORD'`
диспатчит `hey:must-change-password` event, и `App.jsx` поверх всего
открывает `ForcePasswordModal` (`Screens.jsx`).

Поток смены: `POST /me/password { newPassword }` — при `must_change_password=1`
не требует `oldPassword`, после смены сбрасывает флаг.

### Удаление аккаунта (`deleteUserAccount`)

НЕ удаляет строку из БД — анонимизирует: `is_deleted=1`, name='Удалённый пользователь',
phone заменяется на `_deleted_{uuid}_{ts}`, моменты → `status='archived'`.

Соответственно «восстановление»: `UPDATE users SET is_deleted=0, name=?, phone=?, password=?, must_change_password=1` + при необходимости `UPDATE moments SET status='active'` + проверить `is_blocked` (он МОЖЕТ остаться от старого бана и не сбрасывается при удалении).

### Аватарка S3 ключ — стабильный

Avatar key = `avatars/{userId}.{ext}` (один файл на юзера). Поэтому
publicUrl без cache-buster всегда одинаков → React не видит «change»,
браузер кеш. Фикс: в `routes.js /upload/presign` для `category='avatar'`
к `publicUrl` дописывается `?v={Date.now()}`.

### Request-lock (запрос на переписку)

`getOrCreateDirectConversation`: `requestFrom = u1inU2 ? null : userId1`.
Только проверка «отправитель в контактах у получателя». Что у отправителя
в контактах — не важно. Соответственно `is_request=true` блокирует превью
сообщения у получателя, пока он не нажмёт accept/decline.

### `/gjoin/:token` → `/chat/:id` после accept

Файл `web/src/components/GroupJoinScreen.jsx` — после `groupInviteAccept`
делает `nav('/chat/' + r.conversationId)`. **Singular `/chat/`**, а не `/chats/`.
Роут в `App.jsx` — `<Route path="/chat/:convId">`.

### Пин сообщений vs пин диалога

Два разных эндпоинта:
- `POST/DELETE /conversations/:id/pin` — sticky chat (закрепить чат в списке).
- `POST/DELETE /conversations/:id/pinned-message` — закрепить сообщение В чате.

Названия раньше совпадали (`/pin`), Express брал первый зарегистрированный, фича пинов сообщений не работала. Если будешь править — не своди обратно.

### Add contact: preview-flow

`POST /contacts` НЕ вызывается напрямую при нажатии «+». Сначала
`GET /users/lookup?phone=…` (нет добавления, только поиск), потом открывается
`ContactCardModal` с `isContact=false`, и кнопка «Добавить» в карточке
делает реальный `POST /contacts`. Это устраняет «фантомные» тосты-ошибки.

### Никнейм контакта

`PATCH /contacts/:id/nickname { nickname }` — пустое значение очищает.
В `ContactCardModal` карандаш «✎» рядом с именем открывает инлайн-input.
Никнейм пишется только через импорт (CSV/VCF/XLSX) или явное редактирование — обычный «добавить по номеру» nickname=null.

### Админ-сайдбар бейджи

`GET /admin/counts` → `{ openReports, pendingBusiness }`. Сайдбар
поллит каждые 30с + при `visibilitychange`.

### `/admin/reports`

- «→ Карточка юзера» открывается в новой вкладке.
- «→ Открыть момент» — инлайн-попап `MomentDetailPopup` (через `api.getMoment`), поверх плашка `⚙ Админ · 🗑 Удалить момент`.
- При `adminDeleteMoment` автоматически резолвятся все открытые жалобы на этот момент (UPDATE reports → 'resolved' в той же транзакции).

### Аватарка приглашающего

Серверный `getConversationsForUser` отдаёт `group_invited_by_avatar` через `avatarPayload(uid, avatar)`.
`getInviterForPendingMember` тоже использует `avatarPayload`.
UI: в чат-листе бейдж приглашения показывает мини-аватарку рядом с именем,
в `ChatScreen.groupInvite` accept-screen — аватарка перед текстом «X приглашает тебя».

### Multi-tenant АВО

- `tenants` таблица. У не-админа лимит 3 школы (`MAX_TENANTS_PER_USER`).
- `/integrations/awo/*` — UI для бизнес-юзера (не админа), привязка своего аккаунта или контакта.
- `business_status`: 'none' | 'pending' | 'approved' | 'rejected' | 'revoked'.
- Заявки на бизнес-доступ — `/admin/business-requests`, WS-события `business:approved/rejected/revoked` реал-тайм апдейтят `user.business_status` и кидают тост.

## Известные хвосты (TODO)

- [ ] **«Поиск» (matchmaking) не фильтрует NSFW** — попадание откровенных моментов
  в публичный поиск незнакомцев. Нужен авто-фильтр (либо ручной флаг `is_nsfw`
  на момент, либо классификатор).
- [ ] **В `/admin/moments`** — показать моменты `is_deleted` авторов с пометкой
  «🪦 автор удалён» + кнопка hard-delete (физическое удаление из БД + S3).
- [ ] **`.claude/settings.local.json`** иногда уезжает в коммиты — стоит
  добавить в `.gitignore`.
- [ ] Кикнуть `vapid.json` в gitignore если ещё нет (приватный ключ для push).

## Принципы при правках

- Прод-дев в одной ветке (`feat/messaging-extras`). После каждой задачи —
  `deploy.bat` или вручную: `ssh root@45.153.71.162 "cd /opt/hey && git pull && docker exec hey sh -c 'cd /app && npm run build' && docker restart hey"`.
- Если в `npm run build` есть `Duplicate key "display"` warning в `Screens.jsx` — это известная esbuild-косметика, билд продолжается, можно игнорировать (но если рядом — поправь).
- Никнейм/имена/телефоны — **никогда** не пробрасывать через query string логов.
- Восстановление пользователя из удалённого требует bcrypt — делать через
  `node -e` на сервере, у которого `bcryptjs` уже установлен.
