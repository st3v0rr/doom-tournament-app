require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const slotsRoutes = require('./routes/slots');
const leaderboardRoutes = require('./routes/leaderboard');
const bracketRoutes = require('./routes/bracket');
const meRoutes = require('./routes/me');
const adminRoutes = require('./routes/admin');
const scheduleRoutes = require('./routes/schedule');
const errorHandler = require('./middleware/errorHandler');

// Run migrations on startup
const fs = require('fs');
const Database = require('better-sqlite3');
const dbPath = process.env.DATABASE_PATH || './data/tournament.db';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const _db = new Database(dbPath);
_db.pragma('journal_mode = WAL');
_db.pragma('foreign_keys = ON');
const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
_db.exec(schema);
// Migrations for existing databases
try {
  _db.prepare('ALTER TABLE schedule_events ADD COLUMN time_from TEXT NOT NULL DEFAULT ""').run();
} catch (_) {
  /* column already exists */
}
try {
  _db.prepare('ALTER TABLE schedule_events ADD COLUMN time_to TEXT').run();
} catch (_) {
  /* column already exists */
}
try {
  const cols = _db
    .prepare('PRAGMA table_info(schedule_events)')
    .all()
    .map((c) => c.name);
  if (cols.includes('time')) {
    _db.prepare('UPDATE schedule_events SET time_from = time WHERE time_from = ""').run();
    _db.prepare('ALTER TABLE schedule_events DROP COLUMN time').run();
  }
} catch (_) {
  /* column may not exist yet */
}
// bracket_entries: add position/kills/deaths if missing
try {
  _db.prepare('ALTER TABLE bracket_entries ADD COLUMN position INTEGER').run();
} catch (_) {
  /* already exists */
}
try {
  _db.prepare('ALTER TABLE bracket_entries ADD COLUMN kills INTEGER').run();
} catch (_) {
  /* already exists */
}
try {
  _db.prepare('ALTER TABLE bracket_entries ADD COLUMN deaths INTEGER').run();
} catch (_) {
  /* already exists */
}
_db.close();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Trust the reverse proxy (Caddy) so rate limiting and IP detection work correctly
if (isProduction) app.set('trust proxy', 1);

// Validate critical environment variables at startup
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('[FATAL] JWT_SECRET must be set and at least 32 characters long');
  process.exit(1);
}
if (!process.env.ADMIN_USERNAME) {
  console.error('[FATAL] ADMIN_USERNAME must be set');
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD_HASH) {
  console.error('[FATAL] ADMIN_PASSWORD_HASH must be set');
  process.exit(1);
}
if (isProduction && !process.env.CORS_ORIGIN) {
  console.error('[FATAL] CORS_ORIGIN must be set in production');
  process.exit(1);
}

// Security
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    strictTransportSecurity: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// Permissions-Policy header
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '50kb' }));

// Global rate limiter: loose IP-based limit as DDoS protection only.
// Set high enough to not affect legitimate conference users sharing a NAT.
// Per-user and per-credential limits on individual routes handle abuse.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/slots', slotsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/bracket', bracketRoutes);
app.use('/api/me', meRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/schedule', scheduleRoutes);

// Serve React in production
if (isProduction) {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
