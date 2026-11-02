# AGENTS.md — GameHub

This file records verified project context and working rules for agents. It is not a substitute for the source code: inspect the relevant files before making changes, and update this snapshot when the repository changes.

Last repository audit: 2026-11-03.

## 1. Project architecture

- Product: GameHub, a browser-based social gaming platform.
- Frontend: React, Vite, React Router, plain CSS, and `lucide-react` icons. Routes are in `client/src/App.jsx`; shared authentication state is in `client/src/context/AuthContext.jsx`; HTTP calls are in `client/src/services/api.js`.
- Backend: Express 4 API using ES modules. `server/src/app.js` mounts route modules; controllers hold application logic; Zod validates most request bodies and query parameters.
- Data: Prisma 6.19.0 and SQLite. The schema is `server/prisma/schema.prisma`; migrations are in `server/prisma/migrations`.
- The client stores its JWT in `localStorage` and sends it as a Bearer token.
- There is no root `package.json` with workspace scripts. Run npm commands from `client` or `server` and use the corresponding lockfile.
- CI uses Node.js 22. The client package declares some dependencies as `latest`, while its lockfile pins the resolved versions; preserve and review lockfile changes.

Request flow:

```text
React page → client/src/services/api.js → Express route → middleware/controller
           → Prisma Client → SQLite
```

## 2. API areas and verified functionality

All `/api/posts`, `/api/friends`, `/api/notifications`, `/api/conversations`, and `/api/games` routes require authentication. Registration and login are public; health is public. Public profile lookup is `GET /api/profiles/:username`; profile editing requires authentication.

- **Authentication:** register, login by email or username, and current-user lookup. Passwords use bcrypt; access tokens are JWTs.
- **Profiles:** public username, avatar URL, bio, level/XP, and registration date; the owner can update username, bio, and an external avatar URL.
- **Friends:** username search, requests, accept/decline, removal, and online status based on a 90-second `lastSeenAt` window. The client sends a heartbeat about every 30 seconds and refreshes friend lists about every 15 seconds.
- **Activity feed:** create, edit, and delete own posts; rich text; up to four JPG/PNG/WEBP/GIF images; all/friends/popular filters; text/author search; five reactions; comments, threaded replies, and `@username` mentions.
- **Messages:** direct conversations with any registered user; cursor-based message history; unread counts and read receipts; up to five attachments per message, with a 10 MB per-file and 25 MB aggregate limit. The client polls conversations and active messages instead of using WebSockets.
- **Notifications:** reaction, comment, reply, mention, friend, and message events; unread counts; read actions; in-app toasts and browser notifications while the site is open. Web Push after the site/browser closes is not implemented.
- **Games:** searchable genre-filtered catalog; community game submission with an optional cover; a user's library with `PLAYING`, `WANT_TO_PLAY`, and `COMPLETED` states; read-only viewing of another user's library.

The Prisma schema includes users, friend requests, posts/images/likes/reactions, comments, notifications, conversations/members/messages/attachments, games, and user-game library entries.

## 3. Known product gaps from the audit

Re-check these before changing them; this is a snapshot, not a promise that the code has stayed unchanged.

- Achievements are not implemented as a data model or feature; there is no achievements route or sidebar link. The home page now uses library and friend data, shows recent library entries, and links into the catalog when the library is empty. The top-bar game search opens the catalog with the query applied. Profile pages show online presence and allow sending or accepting friend requests.
- The home page still has no playtime metric because the library stores statuses but no session duration. It also has no achievements summary until achievements are implemented.
- Game catalog pages do not include game details, ratings, reviews, playtime, or game discussions. The user library tracks only one of the three statuses per game.
- Notification retrieval is capped at 50 items and has no history pagination. Conversations are capped at 100; the game catalog is capped at 200. These limits may need pagination if the product grows.
- The demo seed writes legacy `PostLike` rows, while the current feed uses `PostReaction`; seeded likes do not populate the reaction UI.
- Profile images are external URLs; there is no avatar upload. Password reset and email verification are not implemented.

## 4. Database, environment, and file storage

Prisma uses:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

The server template sets `DATABASE_URL="file:./dev.db"`. SQLite paths are relative to `server/prisma/schema.prisma`, so the development database is under `server/prisma`. The server uses dotenv and expects these values from `server/.env`:

- `PORT` (default 4000)
- `CLIENT_URL` (default `http://localhost:5173`)
- `NODE_ENV` (default `development`)
- `DATABASE_URL` (read by Prisma from the schema)
- `JWT_SECRET` (token creation checks for at least 32 characters)
- `JWT_EXPIRES_IN` (default `7d`)

The client template sets `VITE_API_URL`, defaulting in code to `http://localhost:4000/api`.

Set a unique random JWT secret before starting the server. `server/src/config/env.js` validates required settings at startup and rejects the blank/example secret. Never read, print, commit, or overwrite `.env` files or secrets.

Public post images and game covers are stored under `server/uploads` and served at `/uploads`. Message attachments are stored under `server/private-uploads/message-attachments`; they are served through a membership-checked API endpoint, not the static file mount. Both storage areas need persistent storage and backups when deployed.

`.gitignore` excludes both `server/uploads` and `server/private-uploads`. Preserve existing user files; do not stage or commit private attachments. Do not delete or rewrite existing uploaded files as part of unrelated work.

## 5. Development and database commands

Run commands from the indicated package directory. In PowerShell, use `npm.cmd` if `npm` resolves to a restricted script.

Backend first setup and development:

```powershell
cd server
npm install
Copy-Item .env.example .env
# Set a unique random JWT_SECRET in server/.env.
npm run db:setup:demo
npm run dev
```

`db:setup:demo` runs `prisma migrate deploy`, generates Prisma Client, and seeds local demo users/content. The seed uses a shared demo password; use this command only for local/demo databases, never as a production deployment step.

Frontend in a second terminal:

```powershell
cd client
npm install
Copy-Item .env.example .env
npm run dev
```

Verified package scripts:

- Server: `npm run dev`, `npm start`, `npm run db:generate`, `npm run db:migrate`, `npm run db:studio`, `npm run db:seed:demo`, `npm run db:setup:demo`.
- Client: `npm run dev`, `npm run build`, `npm run preview`.
- `db:migrate` is `prisma migrate dev` and is for development migration creation/application. CI applies checked-in migrations with `prisma migrate deploy`.
- There is no configured test, lint, or typecheck script, and no test suite was found in the audit. Do not claim tests pass if they were not run. Do not run tests/builds unless the user asks for verification.

## 6. CI and verification

`.github/workflows/ci.yml` runs on pushes to `dev`, `main`, and `feature/**`, and pull requests to `dev`/`main`. With Node 22 it:

1. Installs client/server dependencies with `npm ci`.
2. Runs the client production build.
3. Runs `node --check` on a selected subset of server files.
4. Runs `prisma validate`, applies SQLite migrations to a CI database, and generates Prisma Client.

This workflow does not currently run automated behavior, API, or browser tests; the source syntax check is not exhaustive.

## 7. Current technical issues to account for

- Conversation listing calculates unread counts per conversation, and the client polls frequently. Revisit query count and polling together if optimizing load.
- Multipart upload handlers buffer each complete request in memory before writing files. Existing per-file and aggregate size limits must be preserved if changing upload code.
- `PostLike` and `PostReaction` coexist; check callers, migrations, and seed behavior before changing/removing either model.
- No admin/moderation flow for community game submissions was found. Any moderation feature needs explicit product behavior and server-side authorization.

Express 4 async route controllers are wrapped with `server/src/utils/async-handler.js` so rejected handler promises reach the error middleware. Keep this wrapper on new async handlers; authentication middleware and multipart middleware handle their own errors.

## 8. Working rules

- Before a non-trivial task, inspect `git status`, the relevant routes/controllers/components, Prisma schema/migrations, package scripts, and existing user changes.
- Follow the existing React/Express/Prisma patterns unless a task calls for a deliberate architecture change. Keep UI aligned with the existing light, minimal style.
- Validate inputs on the server and enforce ownership/membership there; client-only checks are not authorization.
- For schema changes, update Prisma schema, add a migration, and update affected queries and UI. Do not reset, delete, or overwrite user data.
- Preserve user files, `.env`, uploads, and untracked work. Avoid broad staging or cleanup commands.
- Do not add dependencies or change public API contracts without a task need. Do not send messages, publish, deploy, or create commits/PRs unless explicitly asked.
- Make the requested changes directly when authorized. Report what changed and what was actually checked; state clearly when a check was not run.
