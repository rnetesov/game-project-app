# GameHub

GameHub is a React and Express social gaming platform. The frontend uses Vite; the backend uses Prisma 6 and SQLite.

## Local development

Use two terminals. The server commands below are run from `server`; client commands are run from `client`.

### Backend

```powershell
cd server
npm install
Copy-Item .env.example .env
```

Edit `server/.env` and set `JWT_SECRET` to a unique random value with at least 32 characters. The other template values point to the local SQLite database and Vite development server.

```powershell
npm run db:setup:demo
npm run dev
```

The API listens on `http://localhost:4000` by default.

### Frontend

In a second terminal:

```powershell
cd client
npm install
Copy-Item .env.example .env
npm run dev
```

Vite listens on `http://localhost:5173` by default. Set `VITE_API_URL` in `client/.env` to change the API base URL.

## Database commands

From `server`:

- `npm run db:generate` — generate Prisma Client.
- `npm run db:migrate` — run `prisma migrate dev` for development schema changes.
- `npx prisma migrate deploy` — apply checked-in migrations without creating a new migration.
- `npm run db:studio` — open Prisma Studio.
- `npm run db:seed:demo` — add demo content to the current database.
- `npm run db:setup:demo` — apply migrations, generate Prisma Client, and seed demo content.

`db:setup:demo` and the demo seed are for local/demo databases. Demo accounts share a password defined in `server/prisma/seed-demo-posts.js`; never use those accounts or that password on a public or production instance. The seed is designed to be rerunnable without deleting user data.

The database provider is SQLite. `DATABASE_URL` is read by Prisma from `server/prisma/schema.prisma`; the example value `file:./dev.db` resolves beside that schema.

## Project commands

From `client`:

- `npm run dev` — start Vite.
- `npm run build` — create a production frontend build.
- `npm run preview` — preview the production build locally.

From `server`:

- `npm run dev` — start the API with nodemon.
- `npm start` — start the API with Node.js.

There is no configured test, lint, or typecheck script at present. GitHub Actions uses Node.js 22, builds the client, checks syntax for selected server files, validates Prisma, applies migrations to a CI database, and generates Prisma Client.

## Features

- Account registration and login, public profiles, profile editing, and JWT authentication.
- Friend search, requests, online status, and friend-only feed filtering.
- Activity feed with rich text, image attachments, reactions, comments, threaded replies, mentions, search, and post editing/deletion.
- Direct messages with message history, read state, and private file attachments.
- In-app and browser notifications while GameHub is open. Web Push after closing the site or browser is not implemented.
- Searchable game catalog, community game submissions, and personal libraries with playing, wanted, and completed statuses.

## API overview

Authenticated endpoints use `Authorization: Bearer <token>`.

- `GET /api/health` — API health.
- `/api/auth` — register, login, and current-user lookup.
- `/api/profiles` — public profile lookup and authenticated profile editing.
- `/api/friends` — search, friend requests, friend list, and heartbeat.
- `/api/posts` — feed, post CRUD, reactions, and comments.
- `/api/notifications` — notification list and read actions.
- `/api/conversations` — direct messages, read state, and attachment downloads.
- `/api/games` — catalog and personal game libraries.

## File storage and deployment

Post images and game covers are stored in `server/uploads` and served from `/uploads`. Message attachments are stored in `server/private-uploads/message-attachments` and downloaded through an authenticated, conversation-membership-checked endpoint. Both directories need persistent storage and backups in a deployed environment. Do not commit `.env` files, private attachments, or uploaded user files.

SQLite and local filesystem storage are configured for the current project setup. A multi-instance deployment needs shared persistent storage and a database/storage plan appropriate for that deployment.
