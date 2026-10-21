CREATE TABLE IF NOT EXISTS player_saves (
  google_sub TEXT PRIMARY KEY NOT NULL,
  save_json TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  updated_at TEXT NOT NULL
);
