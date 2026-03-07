const express = require('express');
const { param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// Per-user rate limit on booking/cancellation to prevent abuse
const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.sub || req.ip,
  message: { error: 'Too many booking attempts, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/slots — public
router.get('/', (req, res) => {
  const slots = db
    .prepare(
      `SELECT s.id, s.start_time, s.status,
              COUNT(sp.participant_id) AS player_count,
              GROUP_CONCAT(p.nick_name) AS player_names
       FROM slots s
       LEFT JOIN slot_participants sp ON sp.slot_id = s.id
       LEFT JOIN participants p ON sp.participant_id = p.id
       GROUP BY s.id
       ORDER BY s.start_time ASC`
    )
    .all();

  const result = slots.map((slot) => ({
    ...slot,
    player_names: slot.player_names ? slot.player_names.split(',') : [],
  }));

  res.json(result);
});

// POST /api/slots/:id/book
router.post(
  '/:id/book',
  requireAuth,
  bookingLimiter,
  [param('id').isUUID().withMessage('Invalid slot ID')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    if (req.user.role !== 'participant') {
      return res.status(403).json({ error: 'Only participants can book slots' });
    }

    const participantId = req.user.sub;
    const slotId = req.params.id;

    const bookSlot = db.transaction(() => {
      // Check 2-booking limit
      const bookingCount = db
        .prepare('SELECT COUNT(*) AS c FROM slot_participants WHERE participant_id = ?')
        .get(participantId).c;
      if (bookingCount >= 2) {
        return { error: 'You can only book up to 2 slots', status: 409 };
      }

      // Check already in this slot
      const alreadyInSlot = db
        .prepare('SELECT id FROM slot_participants WHERE slot_id = ? AND participant_id = ?')
        .get(slotId, participantId);
      if (alreadyInSlot) {
        return { error: 'You are already in this slot', status: 409 };
      }

      // Check slot availability
      const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(slotId);
      if (!slot) return { error: 'Slot not found', status: 404 };
      if (slot.status === 'completed') {
        return { error: 'Slot is not available', status: 409 };
      }

      // Check player count
      const playerCount = db
        .prepare('SELECT COUNT(*) AS c FROM slot_participants WHERE slot_id = ?')
        .get(slotId).c;
      if (playerCount >= 4) {
        return { error: 'Slot is full', status: 409 };
      }

      // Check time constraint
      const slotTime = new Date(slot.start_time);
      const minBookingTime = new Date(Date.now() + 10 * 60 * 1000);
      if (slotTime <= minBookingTime) {
        return { error: 'Slot starts too soon or has already passed', status: 409 };
      }

      db.prepare(
        'INSERT INTO slot_participants (id, slot_id, participant_id) VALUES (?, ?, ?)'
      ).run(uuidv4(), slotId, participantId);

      const newPlayerCount = db
        .prepare('SELECT COUNT(*) AS c FROM slot_participants WHERE slot_id = ?')
        .get(slotId).c;
      if (newPlayerCount >= 4) {
        db.prepare("UPDATE slots SET status = 'full' WHERE id = ?").run(slotId);
      }

      return { ok: true };
    });

    const result = bookSlot();
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  }
);

// DELETE /api/slots/:id/book
router.delete(
  '/:id/book',
  requireAuth,
  bookingLimiter,
  [param('id').isUUID().withMessage('Invalid slot ID')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    if (req.user.role !== 'participant') {
      return res.status(403).json({ error: 'Only participants can cancel slots' });
    }

    const participantId = req.user.sub;
    const slotId = req.params.id;

    const cancelSlot = db.transaction(() => {
      const participation = db
        .prepare('SELECT * FROM slot_participants WHERE slot_id = ? AND participant_id = ?')
        .get(slotId, participantId);
      if (!participation) {
        return { error: 'You are not in this slot', status: 403 };
      }

      const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(slotId);
      if (!slot) return { error: 'Slot not found', status: 404 };
      if (slot.status === 'completed') {
        return { error: 'Slot cannot be cancelled', status: 409 };
      }

      const slotTime = new Date(slot.start_time);
      const minCancelTime = new Date(Date.now() + 10 * 60 * 1000);
      if (slotTime <= minCancelTime) {
        return { error: 'Cannot cancel less than 10 minutes before start', status: 409 };
      }

      db.prepare('DELETE FROM slot_participants WHERE slot_id = ? AND participant_id = ?').run(
        slotId,
        participantId
      );

      if (slot.status === 'full') {
        db.prepare("UPDATE slots SET status = 'available' WHERE id = ?").run(slotId);
      }

      return { ok: true };
    });

    const result = cancelSlot();
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  }
);

module.exports = router;
