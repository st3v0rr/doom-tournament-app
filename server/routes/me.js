const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// GET /api/me
router.get('/', requireAuth, (req, res) => {
  if (req.user.role !== 'participant') {
    return res.status(403).json({ error: 'Participants only' });
  }

  const participantId = req.user.sub;

  const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(participantId);

  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  // Get all slots the participant is in, with K/D data
  const slots = db
    .prepare(
      `SELECT s.id, s.start_time, s.status, sp.kills, sp.deaths,
              CASE WHEN sp.kills IS NOT NULL
                THEN CAST(sp.kills AS REAL) / MAX(1, COALESCE(sp.deaths, 0))
                ELSE NULL END AS kd_ratio
       FROM slot_participants sp
       JOIN slots s ON sp.slot_id = s.id
       WHERE sp.participant_id = ?
       ORDER BY s.start_time ASC`
    )
    .all(participantId);

  // Compute best K/D from completed slots
  let bestKd = null;
  for (const s of slots) {
    if (s.status === 'completed' && s.kills !== null) {
      const kd = s.kd_ratio;
      if (bestKd === null || kd > bestKd) bestKd = kd;
    }
  }

  // Compute leaderboard rank
  let rank = null;
  if (bestKd !== null) {
    const higherKd = db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM (
           SELECT sp.participant_id,
                  MAX(CAST(sp.kills AS REAL) / MAX(1, COALESCE(sp.deaths, 0))) AS best_kd
           FROM slot_participants sp
           JOIN slots s ON sp.slot_id = s.id
           WHERE s.status = 'completed' AND sp.kills IS NOT NULL
           GROUP BY sp.participant_id
         ) ranked
         WHERE best_kd > ?`
      )
      .get(bestKd);
    rank = (higherKd?.cnt ?? 0) + 1;
  }

  // Bracket
  const bracketEntries = db
    .prepare(
      `SELECT be.round, be.position
       FROM bracket_entries be
       WHERE be.participant_id = ?`
    )
    .all(participantId);

  res.json({
    nick_name: participant.nick_name,
    ticket_number: participant.ticket_number,
    slots,
    rank,
    bracket: bracketEntries,
  });
});

module.exports = router;
