# Mario Kart Tournament App

A full-stack web application for running Mario Kart tournaments at conferences and events. Attendees log in with their ticket number, book a time slot to race, and compete for the best lap time on the leaderboard. The admin can manage tickets, slots, the bracket, and the schedule.

## Features

- **Ticket-based login** — participants authenticate with their nick name and a 5-digit ticket number
- **Slot booking** — view available time slots and book or cancel your own race slot (cancellation requires > 10 minutes notice)
- **Leaderboard** — live ranking of completed race times
- **Tournament bracket** — semifinal and final bracket managed by the admin
- **Schedule** — event timetable displayed to all attendees
- **Display view** — a presenter-friendly page showing leaderboard and schedule
- **Admin panel** — full management of tickets, slots, race results, bracket entries, and schedule events
- **Self-registration** — participants can register themselves with a nickname
- **Audit logging** — all sensitive admin actions are logged to the console

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | React 18, Vite, React Router v6                |
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

### 4. Set up time slots (nick run)

Log in to the admin panel at `/admin/login`, then go to **Setup** to:

1. Run the database migration
2. Generate time slots by specifying a date, start time, end time, and slot duration

## Scripts

| Command           | Description                              |
|-------------------|------------------------------------------|
| `npm run dev`     | Start server + client in watch mode      |
| `npm run dev:server` | Start only the Express server         |
| `npm run dev:client` | Start only the Vite dev server        |
| `npm start`       | Start server in production mode          |
| `npm run build`   | Build the React frontend                 |
| `npm run db:migrate` | Apply database schema                 |

## Docker

Build and run a production-ready container:

```bash
docker build -t mario-kart-tournament .

docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e JWT_SECRET=your-secret-here \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD_HASH='$2b$12$...' \
  -e NODE_ENV=production \
  -e CORS_ORIGIN=https://yourdomain.com \
  mario-kart-tournament
```

The SQLite database is stored in `/app/data` inside the container — mount a volume there to persist data across restarts.

## API Overview

All API routes are prefixed with `/api`.

| Route                      | Auth       | Description                              |
|----------------------------|------------|------------------------------------------|
| `POST /auth/login`         | Public     | Participant login (returns JWT cookie)   |
| `POST /auth/admin/login`   | Public     | Admin login                              |
| `POST /auth/logout`        | Any        | Clear session cookie                     |
| `GET  /slots`              | Public     | List all time slots                      |
| `POST /slots/:id/book`     | Participant| Book a slot                              |
| `DELETE /slots/:id/book`   | Participant| Cancel a booking                         |
| `GET  /leaderboard`        | Public     | Ranked list of completed race times      |
| `GET  /bracket`            | Public     | Tournament bracket entries               |
| `GET  /schedule`           | Public     | Event schedule                           |
| `GET  /me`                 | Auth       | Current user info and booking            |
| `GET  /admin/*`            | Admin      | All admin management endpoints           |

## Project Structure

```
├── server/
│   ├── index.js          # Express app entry point
│   ├── db/               # Database setup, schema, migrations
│   ├── routes/           # API route handlers
│   └── middleware/       # Auth, error handler
├── client/
│   └── src/
│       ├── pages/        # React page components
│       └── context/      # Auth context
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
