const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/leaderboard — public
router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.nick_name,
              MAX(CAST(sp.kills AS REAL) / MAX(1, COALESCE(sp.deaths, 0))) AS best_kd,
              SUM(sp.kills) AS total_kills,
              SUM(sp.deaths) AS total_deaths
       FROM slot_participants sp
       JOIN participants p ON sp.participant_id = p.id
       JOIN slots s ON sp.slot_id = s.id
       WHERE s.status = 'completed' AND sp.kills IS NOT NULL
       GROUP BY sp.participant_id
       ORDER BY best_kd DESC
       ${req.query.all === 'true' ? '' : 'LIMIT 10'}`
    )
    .all();

  res.json(rows);
});

module.exports = router;
