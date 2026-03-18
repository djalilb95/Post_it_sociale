const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
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

// Crée le compte guest s'il n'existe pas déjà
const guest = db.prepare('SELECT id FROM users WHERE login = ?').get('guest');
if (!guest) {
  const hash = bcrypt.hashSync('guest', 10);
  db.prepare('INSERT INTO users (login, password) VALUES (?, ?)').run('guest', hash);
  console.log('Compte guest créé');
}

module.exports = db;