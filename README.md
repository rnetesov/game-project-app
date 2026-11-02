# GameHub
React + Express social gaming platform.

## Install
Backend: `cd server && npm install`, copy `.env.example` to `.env`, then `npm run db:generate` and `npm run db:migrate -- --name friends`.
Frontend: `cd client && npm install`.
Run backend with `npm run dev` in server; frontend with `npm run dev` in client.

## Friends API (Bearer token required)
- GET `/api/friends/search?q=username`
- GET `/api/friends`
- GET `/api/friends/requests`
- POST `/api/friends/requests` body `{ "userId": "..." }`
- PATCH `/api/friends/requests/:id` body `{ "action": "accept" | "decline" }`
- DELETE `/api/friends/:userId`
- POST `/api/friends/heartbeat`

Online status is based on lastSeenAt with a 90-second threshold. The frontend refreshes friend lists every 15 seconds.

## Демонстрационные данные

После установки зависимостей и создания `server/.env` можно одной командой подготовить базу данных и наполнить её демонстрационным контентом:

```powershell
cd server
npm.cmd run db:setup:demo
```

Команда применит все Prisma-миграции, сгенерирует Prisma Client и добавит демо-данные. Сидер можно запускать повторно: он не удаляет пользовательские данные и не создаёт повторные копии своих записей.

В демо-наборе: 16 тестовых пользователей, 32 публикации, комментарии, лайки, принятые дружеские связи и входящие заявки.

**Тестовые аккаунты**

- Логин: `pixel_ranger`, `neon_fox`, `vortex`, `luna_bytes` и любой другой демо-username из списка в `server/prisma/seed-demo-posts.js`.
- Пароль для всех демо-аккаунтов: `GameHubDemo2026!`

Это только локальные тестовые аккаунты. Не используй общий пароль на публичном или production-сайте.
