CREATE TABLE IF NOT EXISTS ticket_list (
  id TEXT PRIMARY KEY,
  nick_name TEXT NOT NULL UNIQUE,
  ticket_number TEXT NOT NULL UNIQUE,
  is_walk_up INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  ticket_list_id TEXT NOT NULL REFERENCES ticket_list(id),
  nick_name TEXT NOT NULL,
  ticket_number TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  start_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'full', 'completed'))
);

CREATE TABLE IF NOT EXISTS slot_participants (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  kills INTEGER,
  deaths INTEGER,
  UNIQUE(slot_id, participant_id)
);

CREATE TABLE IF NOT EXISTS bracket_entries (
  id TEXT PRIMARY KEY,
  round TEXT NOT NULL CHECK(round IN ('final')),
  participant_id TEXT NOT NULL REFERENCES participants(id),
  position INTEGER,
  kills INTEGER,
  deaths INTEGER
);

CREATE TABLE IF NOT EXISTS schedule_events (
  id TEXT PRIMARY KEY,
  time_from TEXT NOT NULL,
  time_to TEXT,
  event TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
