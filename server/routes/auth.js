const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// Rate limit for self-registration: per IP+nick_name so shared NAT (conference WiFi)
// doesn't block legitimate users — each nickname gets its own bucket per IP.
const registerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => `${req.ip}:${req.body?.nick_name || ''}`,
  message: { error: 'Zu viele Registrierungsversuche, bitte warte kurz.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit per IP+ticket_number so shared NAT (conference WiFi) doesn't
// block legitimate users: each credential gets its own bucket per IP.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip}:${req.body?.ticket_number || ''}`,
  message: { error: 'Too many login attempts for this ticket, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin login: rate limit per IP (only one admin account exists)
const adminAuthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many admin login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000,
};

// POST /api/auth/register — Self-registration
router.post(
  '/register',
  registerLimiter,
  [
    body('nick_name')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Nickname muss zwischen 3 und 30 Zeichen lang sein')
      .matches(/^[a-zA-Z0-9_\-.]+$/)
      .withMessage(
        'Nickname darf nur Buchstaben, Zahlen, Unterstrich (_), Bindestrich (-) und Punkt (.) enthalten'
      ),
    body('nick_name_confirm')
      .trim()
      .notEmpty()
      .withMessage('Nickname-Bestätigung ist erforderlich'),
    body('ticket_number')
      .trim()
      .matches(/^\d{5}$/)
      .withMessage('Ticket-Nummer muss genau 5 Ziffern haben'),
    body('ticket_number_confirm')
      .trim()
      .matches(/^\d{5}$/)
      .withMessage('Ticket-Nummer-Bestätigung muss genau 5 Ziffern haben'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { nick_name, nick_name_confirm, ticket_number, ticket_number_confirm } = req.body;

    if (nick_name.trim().toLowerCase() !== nick_name_confirm.trim().toLowerCase()) {
      return res.status(400).json({ error: 'Die Nicknames stimmen nicht überein' });
    }
    if (ticket_number.trim() !== ticket_number_confirm.trim()) {
      return res.status(400).json({ error: 'Die Ticket-Nummern stimmen nicht überein' });
    }

    const existingName = db
      .prepare('SELECT id FROM ticket_list WHERE LOWER(nick_name) = LOWER(?)')
      .get(nick_name);
    if (existingName) {
      return res.status(409).json({ error: 'Dieser Nickname ist bereits vergeben' });
    }

    const existingTicket = db
      .prepare('SELECT id FROM ticket_list WHERE ticket_number = ?')
      .get(ticket_number);
    if (existingTicket) {
      return res.status(409).json({ error: 'Diese Ticket-Nummer ist bereits vergeben' });
    }

    const ticketId = uuidv4();
    const participantId = uuidv4();
    const trimmedName = nick_name.trim();
    const trimmedTicket = ticket_number.trim();

    db.transaction(() => {
      db.prepare(
        'INSERT INTO ticket_list (id, nick_name, ticket_number, is_walk_up, claimed) VALUES (?, ?, ?, 0, 1)'
      ).run(ticketId, trimmedName, trimmedTicket);
      db.prepare(
        'INSERT INTO participants (id, ticket_list_id, nick_name, ticket_number) VALUES (?, ?, ?, ?)'
      ).run(participantId, ticketId, trimmedName, trimmedTicket);
    })();

    const token = jwt.sign(
      { sub: participantId, role: 'participant', name: trimmedName },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, cookieOpts);
    console.log('[AUDIT] participant_register', { ip: req.ip, ts: new Date().toISOString() });
    res.status(201).json({ ok: true, name: trimmedName, role: 'participant' });
  }
);

// POST /api/auth/login — Participant login
router.post(
  '/login',
  authLimiter,
  [
    body('nick_name')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Nickname muss zwischen 3 und 30 Zeichen lang sein')
      .matches(/^[a-zA-Z0-9_\-.]+$/)
      .withMessage(
        'Nickname darf nur Buchstaben, Zahlen, Unterstrich (_), Bindestrich (-) und Punkt (.) enthalten'
      ),
    body('ticket_number')
      .trim()
      .matches(/^\d{5}$/)
      .withMessage('Ticket-Nummer muss genau 5 Ziffern haben'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { nick_name, ticket_number } = req.body;

    const entry = db
      .prepare('SELECT * FROM ticket_list WHERE ticket_number = ? AND LOWER(nick_name) = LOWER(?)')
      .get(ticket_number, nick_name);

    if (!entry) {
      console.log('[AUDIT] participant_login_failed', { ip: req.ip, ts: new Date().toISOString() });
      return res.status(401).json({ error: 'Invalid name or ticket number' });
    }

    // Mark claimed
    db.prepare('UPDATE ticket_list SET claimed = 1 WHERE id = ?').run(entry.id);

    // Create participant if not yet exists
    let participant = db
      .prepare('SELECT * FROM participants WHERE ticket_list_id = ?')
      .get(entry.id);

    if (!participant) {
      const newId = uuidv4();
      db.prepare(
        'INSERT INTO participants (id, ticket_list_id, nick_name, ticket_number) VALUES (?, ?, ?, ?)'
      ).run(newId, entry.id, entry.nick_name, entry.ticket_number);
      participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(newId);
    }

    const token = jwt.sign(
      { sub: participant.id, role: 'participant', name: participant.nick_name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, cookieOpts);
    res.json({ ok: true, name: participant.nick_name, role: 'participant' });
  }
);

// POST /api/auth/admin/login
router.post(
  '/admin/login',
  adminAuthLimiter,
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username, password } = req.body;

    const expectedUsername = process.env.ADMIN_USERNAME;
    const expectedHash = process.env.ADMIN_PASSWORD_HASH || '';

    // Always run bcrypt to prevent timing-based username enumeration
    const usernameMatch = username === expectedUsername;
    const valid = await bcrypt.compare(password, expectedHash);

    if (!usernameMatch || !valid) {
      console.log('[AUDIT] admin_login_failed', { ip: req.ip, ts: new Date().toISOString() });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('[AUDIT] admin_login_success', {
      ip: req.ip,
      username,
      ts: new Date().toISOString(),
    });

    const token = jwt.sign({ sub: 'admin', role: 'admin' }, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    res.cookie('token', token, cookieOpts);
    res.json({ ok: true, role: 'admin' });
  }
);

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.json({ authenticated: false });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    res.json({ authenticated: true, role: payload.role, sub: payload.sub, name: payload.name });
  } catch {
    res.json({ authenticated: false });
  }
});

module.exports = router;
