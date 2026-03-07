const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/bracket — public
router.get('/', (req, res) => {
  const entries = db
    .prepare(
      `SELECT be.id, be.round, be.kills, be.deaths,
              p.nick_name, p.id AS participant_id
       FROM bracket_entries be
       JOIN participants p ON be.participant_id = p.id
       ORDER BY be.position DESC NULLS LAST, be.kills DESC`
    )
    .all();

  res.json(entries);
});

module.exports = router;
