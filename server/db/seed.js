require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const db = require('./index');

const existing = db.prepare('SELECT COUNT(*) as count FROM slots').get();
if (existing.count > 0) {
  console.log('Slots already seeded, skipping.');
  process.exit(0);
}

const insert = db.prepare('INSERT INTO slots (id, start_time, status) VALUES (?, ?, ?)');

const seedSlots = db.transaction(() => {
  const startHour = 10;
  const endHour = 17;
  const totalMinutes = (endHour - startHour) * 60;
  const slotDuration = 15;
  const count = Math.floor(totalMinutes / slotDuration);

  const tournamentDate = process.env.TOURNAMENT_DATE || new Date().toISOString().slice(0, 10);

  for (let i = 0; i < count; i++) {
    const totalMins = i * slotDuration;
    const hour = startHour + Math.floor(totalMins / 60);
    const minute = totalMins % 60;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const isoDate = `${tournamentDate}T${timeStr}:00`;
    insert.run(uuidv4(), isoDate, 'available');
  }
  return count;
});

const seeded = seedSlots();
console.log(`Seeded ${seeded} slots (10:00–17:00, every 15 minutes).`);
