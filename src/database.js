const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'links.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    -- Main links table
    CREATE TABLE IF NOT EXISTS links (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      shortCode     TEXT UNIQUE NOT NULL,
      originalUrl   TEXT NOT NULL,
      title         TEXT DEFAULT 'Untitled',
      baselineHash  TEXT NOT NULL,
      contentLength INTEGER DEFAULT 0,
      createdAt     TEXT NOT NULL,
      clickCount    INTEGER DEFAULT 0,
      modificationCount INTEGER DEFAULT 0,
      lastModifiedAt TEXT DEFAULT NULL,
      lastCheckedAt TEXT DEFAULT NULL
    );

    -- Modification history: every detected change is logged
    CREATE TABLE IF NOT EXISTS modifications (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      shortCode    TEXT NOT NULL,
      detectedAt   TEXT NOT NULL,
      previousHash TEXT NOT NULL,
      newHash      TEXT NOT NULL,
      FOREIGN KEY (shortCode) REFERENCES links(shortCode)
    );

    -- Click log for analytics
    CREATE TABLE IF NOT EXISTS clicks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      shortCode    TEXT NOT NULL,
      clickedAt    TEXT NOT NULL,
      integrityStatus TEXT NOT NULL,
      FOREIGN KEY (shortCode) REFERENCES links(shortCode)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_links_shortCode ON links(shortCode);
    CREATE INDEX IF NOT EXISTS idx_modifications_shortCode ON modifications(shortCode);
    CREATE INDEX IF NOT EXISTS idx_clicks_shortCode ON clicks(shortCode);
  `);

  console.log('✅ Database initialized');
}

module.exports = { db, initDB };
