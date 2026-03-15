const Database = require('better-sqlite3');
const db = new Database('postits.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    texte TEXT NOT NULL,
    date TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    auteur_id INTEGER NOT NULL,
    FOREIGN KEY (auteur_id) REFERENCES users(id)
  );
`);

module.exports = db;