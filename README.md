# Doom Tournament App

A full-stack web application for running Doom deathmatch tournaments at conferences and events. Attendees log in with their ticket number, book a 15-minute deathmatch slot, and compete for the best K/D ratio on the leaderboard. The top 4 players advance to the final, where each faces John Romero 1-on-1. The admin manages tickets, slots, results, the bracket, and the schedule.

## Features

- **Ticket-based login** — participants authenticate with their nickname and a 5-digit ticket number
- **Slot booking** — view available deathmatch slots and book or cancel (up to 2 slots per player, 4 players per slot)
- **Leaderboard** — live K/D ranking of completed deathmatch sessions
- **Final bracket** — top 4 players each face John Romero 1-on-1, managed by the admin
- **Schedule** — event timetable displayed to all attendees
- **Display view** — presenter-friendly TV screen showing leaderboard, bracket, and schedule
- **Admin panel** — full management of tickets, slots, kill/death results, bracket entries, and schedule events
- **Self-registration** — participants can register themselves with a nickname and ticket number
- **Audit logging** — all sensitive admin actions are logged to the console

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | React 18, Vite, React Router v6, react-i18next |
| Backend   | Node.js, Express                                |
| Database  | SQLite via `better-sqlite3`                     |
| Auth      | JWT (httpOnly cookies), bcryptjs                |
| Security  | Helmet (CSP, HSTS), CORS, express-rate-limit, express-validator |
| Container | Docker (multi-stage build, non-root user)       |

## Prerequisites

- Node.js 22+
- npm

## Getting Started

### 1. Install dependencies

```bash
# Install server dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set the required values:

| Variable              | Description                                                  |
|-----------------------|--------------------------------------------------------------|
| `JWT_SECRET`          | At least 32-character random string for signing JWTs         |
| `ADMIN_USERNAME`      | Admin login username                                         |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password (see below)                |
| `DATABASE_PATH`       | Path to the SQLite database file (default: `./data/tournament.db`) |
| `PORT`                | Server port (default: `3000`)                                |
| `NODE_ENV`            | `development` or `production`                                |
| `CORS_ORIGIN`         | Allowed frontend origin (required in production)             |

**Generate a bcrypt password hash:**

```bash
node -e "const b=require('bcryptjs'); b.hash('yourpassword',12).then(console.log)"
```

### 3. Run in development

```bash
npm run dev
```

This starts the Express server (port 3000) and the Vite dev server (port 5173) concurrently.

### 4. Set up the tournament

Log in to the admin panel at `/admin/login`, then go to **Setup** to:

1. Run the database migration (initializes the schema and applies any pending column changes)
2. Generate deathmatch slots by specifying a date, start time, end time, and slot duration (default: 15 min)

## Tournament Flow

1. Participants register and book up to 2 deathmatch slots
2. Each slot holds up to 4 players for a 15-minute free-for-all
3. Admin enters kills/deaths per player after each completed slot
4. Leaderboard ranks players by their best single-slot K/D ratio
5. Admin assigns the top 4 players to the final bracket
6. Each finalist plays 1-on-1 against John Romero — admin enters the result
7. The bracket view shows all final matches ordered from rank #4 to rank #1

## Scripts

| Command                | Description                              |
|------------------------|------------------------------------------|
| `npm run dev`          | Start server + client in watch mode      |
| `npm run dev:server`   | Start only the Express server            |
| `npm run dev:client`   | Start only the Vite dev server           |
| `npm start`            | Start server in production mode          |
| `npm run build`        | Build the React frontend                 |
| `npm run lint`         | Lint server code                         |
| `npm run lint:all`     | Lint server + client                     |
| `npm run format`       | Format server code with Prettier         |

## Docker

Build and run a production-ready container:

```bash
docker build -t doom-tournament .

docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e JWT_SECRET=your-secret-here \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD_HASH='$2b$12$...' \
  -e NODE_ENV=production \
  -e CORS_ORIGIN=https://yourdomain.com \
  doom-tournament
```

The SQLite database is stored in `/app/data` inside the container — mount a volume there to persist data across restarts.

## API Overview

All API routes are prefixed with `/api`.

| Route                      | Auth        | Description                                      |
|----------------------------|-------------|--------------------------------------------------|
| `POST /auth/login`         | Public      | Participant login (returns JWT cookie)           |
| `POST /auth/admin/login`   | Public      | Admin login                                      |
| `POST /auth/logout`        | Any         | Clear session cookie                             |
| `GET  /slots`              | Public      | List all deathmatch slots with player counts     |
| `POST /slots/:id/book`     | Participant | Book a slot (max 2 per player, max 4 per slot)   |
| `DELETE /slots/:id/book`   | Participant | Cancel a booking                                 |
| `GET  /leaderboard`        | Public      | Players ranked by best K/D ratio                 |
| `GET  /bracket`            | Public      | Final bracket entries                            |
| `GET  /schedule`           | Public      | Event schedule                                   |
| `GET  /me`                 | Auth        | Current user info, booked slots, and rank        |
| `GET  /admin/*`            | Admin       | All admin management endpoints                   |

## Project Structure

```
├── server/
│   ├── index.js          # Express app entry point + startup migrations
│   ├── db/               # Database setup, schema, seed
│   ├── routes/           # API route handlers
│   └── middleware/       # Auth, error handler
├── client/
│   └── src/
│       ├── pages/        # React page components
│       ├── components/   # Shared components (LangSwitcher, Nav)
│       ├── context/      # Auth context
│       ├── locales/      # i18n translations (en, de)
│       └── utils/        # Locale helpers
├── Dockerfile
├── .env.example
└── package.json
```

## Security Notes

- Passwords are hashed with bcrypt (cost factor 12)
- JWTs are stored in httpOnly, Secure, SameSite=Strict cookies
- Content Security Policy and HSTS are enforced via Helmet
- All inputs are validated with express-validator
- Rate limiting protects both global and per-user booking endpoints
- The Docker image runs as a non-root user
