const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/schedule — public
router.get('/', (req, res) => {
  const rows = db
    .prepare(
      'SELECT id, time_from, time_to, event, sort_order FROM schedule_events ORDER BY time_from ASC'
    )
    .all();
  res.json(rows);
});

module.exports = router;
