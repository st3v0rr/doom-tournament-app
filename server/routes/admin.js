const express = require('express');
const fs = require('fs');
const path = require('path');
const { body, param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { requireAdmin } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// All admin routes require admin auth
router.use(requireAdmin);

// --- TICKETS ---

// GET /api/admin/tickets
router.get('/tickets', (req, res) => {
  console.log('[AUDIT] admin_tickets_read', {
    ip: req.ip,
    adminId: req.user.sub,
    ts: new Date().toISOString(),
  });
  const tickets = db.prepare(`SELECT * FROM ticket_list ORDER BY nick_name ASC`).all();
  res.json(tickets);
});

// POST /api/admin/tickets — add walk-up entry
router.post(
  '/tickets',
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
      .withMessage('Ticket number must be 5 digits'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { nick_name, ticket_number } = req.body;

    const existing = db
      .prepare('SELECT id FROM ticket_list WHERE ticket_number = ?')
      .get(ticket_number);
    if (existing) {
      return res.status(409).json({ error: 'Ticket number already exists' });
    }

    const id = uuidv4();
    db.prepare(
      'INSERT INTO ticket_list (id, nick_name, ticket_number, is_walk_up, claimed) VALUES (?, ?, ?, 1, 0)'
    ).run(id, nick_name, ticket_number);

    res.status(201).json({ ok: true, id });
  }
);

// DELETE /api/admin/tickets/:id
router.delete(
  '/tickets/:id',
  [param('id').isUUID().withMessage('Invalid ticket ID')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const ticket = db.prepare('SELECT * FROM ticket_list WHERE id = ?').get(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const hasResult = db
      .prepare(
        `SELECT sp.id FROM participants p
         JOIN slot_participants sp ON sp.participant_id = p.id
         JOIN slots s ON sp.slot_id = s.id
         WHERE p.ticket_list_id = ? AND s.status = 'completed' AND sp.kills IS NOT NULL`
      )
      .get(req.params.id);
    if (hasResult) {
      return res
        .status(409)
        .json({ error: 'Teilnehmer hat ein gültiges Ergebnis und kann nicht gelöscht werden' });
    }

    db.prepare('DELETE FROM ticket_list WHERE id = ?').run(req.params.id);
    console.log('[AUDIT] admin_ticket_delete', {
      ip: req.ip,
      ticketId: req.params.id,
      ts: new Date().toISOString(),
    });
    res.json({ ok: true });
  }
);

// --- SLOTS ---

// GET /api/admin/slots
router.get('/slots', (req, res) => {
  const slots = db
    .prepare(`SELECT id, start_time, status FROM slots ORDER BY start_time ASC`)
    .all();

  const players = db
    .prepare(
      `SELECT sp.slot_id, sp.participant_id, p.nick_name, sp.kills, sp.deaths
       FROM slot_participants sp
       JOIN participants p ON sp.participant_id = p.id`
    )
    .all();

  const playersBySlot = {};
  for (const player of players) {
    if (!playersBySlot[player.slot_id]) playersBySlot[player.slot_id] = [];
    playersBySlot[player.slot_id].push({
      id: player.participant_id,
      nick_name: player.nick_name,
      kills: player.kills,
      deaths: player.deaths,
    });
  }

  const result = slots.map((slot) => ({
    ...slot,
    player_count: (playersBySlot[slot.id] || []).length,
    players: playersBySlot[slot.id] || [],
  }));

  res.json(result);
});

// PATCH /api/admin/slots/:id
router.patch(
  '/slots/:id',
  [
    param('id').isUUID().withMessage('Invalid slot ID'),
    body('status')
      .optional()
      .isIn(['available', 'full', 'completed'])
      .withMessage('Invalid status'),
    body('results').optional().isArray().withMessage('results must be an array'),
    body('results.*.participant_id')
      .optional()
      .isUUID()
      .withMessage('Invalid participant ID in results'),
    body('results.*.kills')
      .optional({ nullable: true })
      .isInt({ min: 0 })
      .withMessage('kills must be a non-negative integer'),
    body('results.*.deaths')
      .optional({ nullable: true })
      .isInt({ min: 0 })
      .withMessage('deaths must be a non-negative integer'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(req.params.id);
    if (!slot) return res.status(404).json({ error: 'Slot not found' });

    const { status, results } = req.body;

    if (status === undefined && results === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    let warning = null;

    const applyUpdates = db.transaction(() => {
      if (status !== undefined) {
        if (status === 'completed') {
          const playerCount = db
            .prepare('SELECT COUNT(*) AS c FROM slot_participants WHERE slot_id = ?')
            .get(req.params.id).c;
          if (playerCount < 2) {
            warning = `Slot has only ${playerCount} player(s). Minimum recommended is 2.`;
          }
        }
        db.prepare('UPDATE slots SET status = ? WHERE id = ?').run(status, req.params.id);
      }
      if (results !== undefined) {
        for (const r of results) {
          db.prepare(
            'UPDATE slot_participants SET kills = ?, deaths = ? WHERE slot_id = ? AND participant_id = ?'
          ).run(r.kills ?? null, r.deaths ?? null, req.params.id, r.participant_id);
        }
      }
    });

    applyUpdates();

    console.log('[AUDIT] admin_slot_update', {
      ip: req.ip,
      slotId: req.params.id,
      status,
      ts: new Date().toISOString(),
    });

    const response = { ok: true };
    if (warning) response.warning = warning;
    res.json(response);
  }
);

// --- BRACKET ---

// PATCH /api/admin/bracket
router.patch(
  '/bracket',
  [
    body('entries').isArray({ min: 1 }).withMessage('entries must be a non-empty array'),
    body('entries.*.participant_id')
      .isUUID()
      .withMessage('Each participant_id must be a valid UUID'),
    body('entries.*.round').isIn(['final']).withMessage('round must be final'),
    body('entries.*.position')
      .optional({ nullable: true })
      .isInt({ min: 1, max: 4 })
      .withMessage('position must be between 1 and 4'),
    body('entries.*.kills')
      .optional({ nullable: true })
      .isInt({ min: 0 })
      .withMessage('kills must be a non-negative integer'),
    body('entries.*.deaths')
      .optional({ nullable: true })
      .isInt({ min: 0 })
      .withMessage('deaths must be a non-negative integer'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { entries } = req.body;

    // Verify all participant IDs exist before making any changes
    for (const row of entries) {
      const exists = db.prepare('SELECT id FROM participants WHERE id = ?').get(row.participant_id);
      if (!exists) {
        return res.status(400).json({ error: `Participant not found: ${row.participant_id}` });
      }
    }

    const upsert = db.transaction((rows) => {
      for (const row of rows) {
        const existing = db
          .prepare('SELECT id FROM bracket_entries WHERE participant_id = ? AND round = ?')
          .get(row.participant_id, row.round);

        if (existing) {
          db.prepare(
            'UPDATE bracket_entries SET position = ?, kills = ?, deaths = ? WHERE id = ?'
          ).run(row.position ?? null, row.kills ?? null, row.deaths ?? null, existing.id);
        } else {
          db.prepare(
            'INSERT INTO bracket_entries (id, round, participant_id, position, kills, deaths) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(
            uuidv4(),
            row.round,
            row.participant_id,
            row.position ?? null,
            row.kills ?? null,
            row.deaths ?? null
          );
        }
      }
    });

    upsert(entries);
    console.log('[AUDIT] admin_bracket_update', {
      ip: req.ip,
      count: entries.length,
      ts: new Date().toISOString(),
    });
    res.json({ ok: true });
  }
);

// GET /api/admin/participants
router.get('/participants', (req, res) => {
  console.log('[AUDIT] admin_participants_read', {
    ip: req.ip,
    adminId: req.user.sub,
    ts: new Date().toISOString(),
  });
  const participants = db
    .prepare(
      `SELECT p.id, p.nick_name, p.ticket_number,
              (SELECT COUNT(DISTINCT slot_id) FROM slot_participants WHERE participant_id = p.id) AS slot_count,
              (SELECT MAX(CAST(sp2.kills AS REAL) / MAX(1, COALESCE(sp2.deaths, 0)))
               FROM slot_participants sp2
               JOIN slots s2 ON sp2.slot_id = s2.id
               WHERE sp2.participant_id = p.id AND s2.status = 'completed' AND sp2.kills IS NOT NULL) AS best_kd
       FROM participants p
       ORDER BY p.nick_name ASC`
    )
    .all();
  res.json(participants);
});

// --- SCHEDULE EVENTS ---

// GET /api/admin/schedule
router.get('/schedule', (req, res) => {
  const rows = db.prepare('SELECT * FROM schedule_events ORDER BY time_from ASC').all();
  res.json(rows);
});

// POST /api/admin/schedule
router.post(
  '/schedule',
  [
    body('time_from')
      .matches(/^\d{2}:\d{2}$/)
      .withMessage('time_from muss HH:MM sein'),
    body('time_to')
      .optional({ nullable: true })
      .matches(/^\d{2}:\d{2}$/)
      .withMessage('time_to muss HH:MM sein'),
    body('event').trim().notEmpty().withMessage('event darf nicht leer sein'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { time_from, time_to, event } = req.body;
    if (time_to && time_to <= time_from) {
      return res.status(400).json({ error: 'Bis-Zeit muss nach der Von-Zeit liegen' });
    }
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM schedule_events').get().m ?? -1;
    const id = uuidv4();
    db.prepare(
      'INSERT INTO schedule_events (id, time_from, time_to, event, sort_order) VALUES (?, ?, ?, ?, ?)'
    ).run(id, time_from, time_to ?? null, event.trim(), maxOrder + 1);
    res.status(201).json({ ok: true, id });
  }
);

// PATCH /api/admin/schedule/:id
router.patch(
  '/schedule/:id',
  [
    param('id').isUUID(),
    body('time_from')
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage('time_from muss HH:MM sein'),
    body('time_to')
      .optional({ nullable: true })
      .matches(/^\d{2}:\d{2}$/)
      .withMessage('time_to muss HH:MM sein'),
    body('event').optional().trim().notEmpty().withMessage('event darf nicht leer sein'),
    body('sort_order').optional().isInt({ min: 0 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const row = db.prepare('SELECT * FROM schedule_events WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Eintrag nicht gefunden' });

    const { time_from, time_to, event, sort_order } = req.body;
    const finalFrom = time_from ?? row.time_from;
    const finalTo = time_to !== undefined ? (time_to ?? null) : row.time_to;
    if (finalTo && finalTo <= finalFrom) {
      return res.status(400).json({ error: 'Bis-Zeit muss nach der Von-Zeit liegen' });
    }
    db.prepare(
      'UPDATE schedule_events SET time_from = ?, time_to = ?, event = ?, sort_order = ? WHERE id = ?'
    ).run(
      finalFrom,
      finalTo,
      event?.trim() ?? row.event,
      sort_order ?? row.sort_order,
      req.params.id
    );

    res.json({ ok: true });
  }
);

// DELETE /api/admin/schedule/:id
router.delete('/schedule/:id', [param('id').isUUID()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const row = db.prepare('SELECT id FROM schedule_events WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Eintrag nicht gefunden' });

  db.prepare('DELETE FROM schedule_events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- SETUP ---

// GET /api/admin/setup/status
router.get('/setup/status', (req, res) => {
  const slotCount = db.prepare('SELECT COUNT(*) as count FROM slots').get().count;
  const bookedCount = db
    .prepare("SELECT COUNT(*) as count FROM slots WHERE status IN ('full', 'completed')")
    .get().count;
  const nickSlot = db.prepare('SELECT start_time FROM slots ORDER BY start_time ASC LIMIT 1').get();
  const lastSlot = db
    .prepare('SELECT start_time FROM slots ORDER BY start_time DESC LIMIT 1')
    .get();

  res.json({
    slot_count: slotCount,
    booked_count: bookedCount,
    nick_slot: nickSlot?.start_time ?? null,
    last_slot: lastSlot?.start_time ?? null,
  });
});

// POST /api/admin/setup/migrate
router.post('/setup/migrate', (req, res) => {
  try {
    const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
    db.exec(schema);
    try {
      db.prepare('ALTER TABLE schedule_events ADD COLUMN time_from TEXT NOT NULL DEFAULT ""').run();
    } catch (_) {
      /* column already exists */
    }
    try {
      db.prepare('ALTER TABLE schedule_events ADD COLUMN time_to TEXT').run();
    } catch (_) {
      /* column already exists */
    }
    try {
      const cols = db
        .prepare('PRAGMA table_info(schedule_events)')
        .all()
        .map((c) => c.name);
      if (cols.includes('time')) {
        db.prepare('UPDATE schedule_events SET time_from = time WHERE time_from = ""').run();
        db.prepare('ALTER TABLE schedule_events DROP COLUMN time').run();
      }
    } catch (_) {
      /* column may not exist yet */
    }
    // bracket_entries: add position/kills/deaths if missing
    try {
      db.prepare('ALTER TABLE bracket_entries ADD COLUMN position INTEGER').run();
    } catch (_) {
      /* already exists */
    }
    try {
      db.prepare('ALTER TABLE bracket_entries ADD COLUMN kills INTEGER').run();
    } catch (_) {
      /* already exists */
    }
    try {
      db.prepare('ALTER TABLE bracket_entries ADD COLUMN deaths INTEGER').run();
    } catch (_) {
      /* already exists */
    }
    console.log('[AUDIT] admin_migrate', {
      ip: req.ip,
      adminId: req.user.sub,
      ts: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Migration error:', err);
    res.status(500).json({ error: 'Migration fehlgeschlagen' });
  }
});

// POST /api/admin/setup/seed
router.post(
  '/setup/seed',
  [
    body('date')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('date muss im Format YYYY-MM-DD sein'),
    body('start_time')
      .matches(/^\d{2}:\d{2}$/)
      .withMessage('start_time muss im Format HH:MM sein'),
    body('end_time')
      .matches(/^\d{2}:\d{2}$/)
      .withMessage('end_time muss im Format HH:MM sein'),
    body('slot_duration')
      .isInt({ min: 1, max: 60 })
      .withMessage('slot_duration muss eine Zahl zwischen 1 und 60 sein'),
    body('clear_existing')
      .optional()
      .isBoolean()
      .withMessage('clear_existing muss ein Boolean sein'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { date, start_time, end_time, slot_duration, clear_existing = false } = req.body;

    // Parse start/end minutes
    const [startH, startM] = start_time.split(':').map(Number);
    const [endH, endM] = end_time.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (endMins <= startMins) {
      return res.status(400).json({ error: 'end_time muss nach start_time liegen' });
    }

    const totalMinutes = endMins - startMins;
    const count = Math.floor(totalMinutes / slot_duration);

    if (count < 1) {
      return res.status(400).json({ error: 'Keine Slots in diesem Zeitraum möglich' });
    }

    const existingCount = db.prepare('SELECT COUNT(*) as c FROM slots').get().c;
    if (existingCount > 0 && !clear_existing) {
      return res.status(409).json({
        error: `Es existieren bereits ${existingCount} Slots. Setze clear_existing=true um sie zu ersetzen.`,
      });
    }

    if (clear_existing) {
      const booked = db
        .prepare("SELECT COUNT(*) as c FROM slots WHERE status IN ('full', 'completed')")
        .get().c;
      if (booked > 0) {
        return res.status(409).json({
          error: `Es gibt noch ${booked} gebuchte/abgeschlossene Slots. Diese können nicht gelöscht werden.`,
        });
      }
    }

    const insert = db.prepare('INSERT INTO slots (id, start_time, status) VALUES (?, ?, ?)');

    const seedSlots = db.transaction(() => {
      if (clear_existing) {
        db.prepare('DELETE FROM slots').run();
      }
      for (let i = 0; i < count; i++) {
        const totalMinsOffset = i * slot_duration;
        const slotMins = startMins + totalMinsOffset;
        const h = Math.floor(slotMins / 60);
        const m = slotMins % 60;
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const isoDate = `${date}T${timeStr}:00`;
        insert.run(uuidv4(), isoDate, 'available');
      }
      return count;
    });

    const seeded = seedSlots();
    console.log('[AUDIT] admin_seed_slots', {
      ip: req.ip,
      adminId: req.user.sub,
      date,
      start_time,
      end_time,
      slot_duration,
      count: seeded,
      cleared: clear_existing,
      ts: new Date().toISOString(),
    });
    res.json({ ok: true, seeded });
  }
);

// PATCH /api/admin/setup/reschedule — verschiebt alle Slots auf ein neues Datum
router.patch(
  '/setup/reschedule',
  [
    body('new_date')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('new_date muss im Format YYYY-MM-DD sein'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { new_date } = req.body;

    const slotCount = db.prepare('SELECT COUNT(*) as c FROM slots').get().c;
    if (slotCount === 0) {
      return res.status(409).json({ error: 'Keine Slots vorhanden' });
    }

    const result = db
      .prepare(
        'UPDATE slots SET start_time = ? || SUBSTR(start_time, 11) WHERE SUBSTR(start_time, 1, 10) != ?'
      )
      .run(new_date, new_date);

    console.log('[AUDIT] admin_reschedule', {
      ip: req.ip,
      adminId: req.user.sub,
      new_date,
      updated: result.changes,
      ts: new Date().toISOString(),
    });

    res.json({ ok: true, updated: result.changes });
  }
);

// DELETE /api/admin/setup/slots
router.delete('/setup/slots', (req, res) => {
  const booked = db
    .prepare("SELECT COUNT(*) as c FROM slots WHERE status IN ('full', 'completed')")
    .get().c;
  if (booked > 0) {
    return res.status(409).json({
      error: `Es gibt noch ${booked} gebuchte/abgeschlossene Slots. Diese können nicht gelöscht werden.`,
    });
  }
  db.prepare('DELETE FROM slots').run();
  console.log('[AUDIT] admin_clear_slots', {
    ip: req.ip,
    adminId: req.user.sub,
    ts: new Date().toISOString(),
  });
  res.json({ ok: true });
});

// DELETE /api/admin/setup/database — löscht alle Daten aus allen Tabellen
router.delete(
  '/setup/database',
  [body('confirm').equals('RESET').withMessage('confirm must be exactly "RESET"')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const reset = db.transaction(() => {
      db.prepare('DELETE FROM bracket_entries').run();
      db.prepare('DELETE FROM slot_participants').run();
      db.prepare('DELETE FROM slots').run();
      db.prepare('DELETE FROM participants').run();
      db.prepare('DELETE FROM ticket_list').run();
      db.prepare('DELETE FROM schedule_events').run();
    });
    reset();
    console.log('[AUDIT] admin_reset_database', {
      ip: req.ip,
      adminId: req.user.sub,
      ts: new Date().toISOString(),
    });
    res.json({ ok: true });
  }
);

module.exports = router;
