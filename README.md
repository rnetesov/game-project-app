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
