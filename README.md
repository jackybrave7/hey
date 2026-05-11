# HEY Messenger

Полный стек: Node.js бэкенд + React веб-клиент.

## Быстрый старт

### Требования
- Node.js 18+
- npm 9+

### 1. Установка зависимостей

```bash
cd hey-app
npm install
cd server && npm install && cd ..
cd web && npm install && cd ..
```

### 2. Запуск (оба сервера одновременно)

```bash
# Из папки hey-app:
npm run dev
```

Откроет:
- **Веб-клиент** → http://localhost:5173
- **API сервер** → http://localhost:3001
- **WebSocket** → ws://localhost:3001/ws

### 3. Первый запуск — зарегистрируй двух пользователей

Открой http://localhost:5173 в **двух разных браузерах** (или вкладках инкогнито):
- Браузер 1: зарегистрируй пользователя с номером `+71111111111`
- Браузер 2: зарегистрируй пользователя с номером `+72222222222`
- В каждом добавь второго в Контакты → нажми «Написать сообщение»
- Переписка работает в реальном времени!

---

## Структура проекта

```
hey-app/
├── package.json          # воркспейсы + concurrently
│
├── server/               # Node.js + Express + SQLite + WebSocket
│   └── src/
│       ├── index.js      # точка входа, HTTP + WS сервер
│       ├── routes.js     # REST API (auth, contacts, messages, calls)
│       ├── ws.js         # WebSocket (чат, typing, presence, звонки)
│       ├── auth.js       # JWT авторизация
│       └── db/
│           └── init.js   # SQLite схема (users, messages, calls...)
│
└── web/                  # React + Vite
    └── src/
        ├── main.jsx
        ├── App.jsx           # роутинг
        ├── AuthContext.jsx   # авторизация, токен
        ├── api.js            # HTTP клиент + WebSocket клиент
        ├── index.css         # глобальные стили (лавандовый градиент)
        └── components/
            └── Screens.jsx   # все экраны приложения
```

## API эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| POST | /api/register | Регистрация |
| POST | /api/login | Вход |
| GET | /api/me | Мой профиль |
| GET | /api/contacts | Список контактов |
| POST | /api/contacts | Добавить контакт |
| GET | /api/conversations | Список диалогов |
| POST | /api/conversations | Открыть/создать диалог |
| GET | /api/conversations/:id/messages | История сообщений |
| GET | /api/calls | История звонков |

## WebSocket события

| Событие | Направление | Описание |
|---------|-------------|----------|
| message:send | клиент→сервер | Отправить сообщение |
| message:new | сервер→клиент | Новое сообщение |
| message:read | клиент→сервер | Прочитано |
| message:status | сервер→клиент | Статус (sent/delivered/read) |
| typing:start/stop | оба | Индикатор печати |
| presence:change | сервер→клиент | Онлайн/оффлайн |
| call:offer/answer/ice/end | оба | WebRTC сигналинг |
