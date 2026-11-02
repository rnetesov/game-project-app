# GameHub
React + Express social gaming platform.

## Install
Backend: cd server && npm install, copy .env.example to .env, then npm run db:generate and npm run db:migrate -- --name friends.
Frontend: cd client && npm install.
Run backend with npm run dev in server; frontend with npm run dev in client.

## Friends API (Bearer token required)
- GET /api/friends/search?q=username
- GET /api/friends
- GET /api/friends/requests
- POST /api/friends/requests body { "userId": "..." }
- PATCH /api/friends/requests/:id body { "action": "accept" | "decline" }
- DELETE /api/friends/:userId
- POST /api/friends/heartbeat

Online status is based on lastSeenAt with a 90-second threshold. The frontend refreshes friend lists every 15 seconds.

## Демонстрационные данные

После установки зависимостей и создания server/.env можно одной командой подготовить базу данных и наполнить её демонстрационным контентом:

powershell
cd server
npm.cmd run db:setup:demo

Команда применит все Prisma-миграции, сгенерирует Prisma Client и добавит демо-данные. Сидер можно запускать повторно: он не удаляет пользовательские данные и не создаёт повторные копии своих записей.

В демо-наборе: 16 тестовых пользователей, 32 публикации, комментарии, лайки, принятые дружеские связи и входящие заявки.

Тестовые аккаунты:
- Логин: pixel_ranger, neon_fox, vortex, luna_bytes и любой другой демо-username из списка в server/prisma/seed-demo-posts.js.
- Пароль для всех демо-аккаунтов: GameHubDemo2026!

Это только локальные тестовые аккаунты. Не используй общий пароль на публичном или production-сайте.

## Визуальные уведомления

- Новые события показываются всплывающими карточками внутри GameHub, если вкладка активна.
- Если вкладка GameHub скрыта, браузер может показать системное уведомление на рабочем столе.
- Чтобы разрешить системные уведомления, открой колокольчик и нажми «Включить уведомления браузера».
- При наличии непрочитанных событий в заголовке вкладки появляется счётчик.
- Проверка новых событий выполняется примерно каждые 15 секунд; при возвращении к вкладке выполняется дополнительная проверка.
- Системные уведомления работают, пока GameHub открыт в браузере. Уведомления после закрытия сайта или браузера (Web Push) в этой версии не реализованы.
- Если разрешение было заблокировано, измени его в настройках сайта браузера.

## Личные сообщения v0.7

- Личные диалоги доступны только между пользователями, которые приняли заявки друг друга в друзья.
- В разделе «Сообщения» можно открыть существующий диалог или начать новый через список друзей.
- История загружается страницами, а новые сообщения и список диалогов обновляются автоматически.
- Непрочитанные сообщения учитываются отдельно для каждого участника диалога.

API (требуется Bearer token):
- GET /api/conversations — список диалогов и счётчики непрочитанного.
- POST /api/conversations body { "userId": "..." } — открыть или создать диалог с другом.
- GET /api/conversations/:id/messages?limit=30&before=... — история сообщений.
- POST /api/conversations/:id/messages body { "content": "..." } — отправить сообщение (до 2000 символов).
- PATCH /api/conversations/:id/read — отметить сообщения диалога прочитанными.

После получения обновлений из dev в папке server выполни npm.cmd run db:setup:demo, чтобы применить миграцию и обновить Prisma Client.
