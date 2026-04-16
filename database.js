const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const db = new Database('postits.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    droit_creation INTEGER DEFAULT 0,
    droit_modification INTEGER DEFAULT 0,
    droit_effacement INTEGER DEFAULT 0,
    droit_administration INTEGER DEFAULT 0,
    couleur_fond TEXT DEFAULT '#f0f0f0',
    couleur_postit TEXT DEFAULT '#fef08a'
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

// Migration douce — ajoute les colonnes si elles n'existent pas
const colonnes = db.pragma('table_info(users)').map(c => c.name);

if (!colonnes.includes('droit_creation')) {
  db.exec(`
    ALTER TABLE users ADD COLUMN droit_creation INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN droit_modification INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN droit_effacement INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN droit_administration INTEGER DEFAULT 0;
  `);
}

if (!colonnes.includes('couleur_fond')) {
  db.exec(`
    ALTER TABLE users ADD COLUMN couleur_fond TEXT DEFAULT '#f0f0f0';
    ALTER TABLE users ADD COLUMN couleur_postit TEXT DEFAULT '#fef08a';
  `);
}

// Crée le compte guest s'il n'existe pas
const guest = db.prepare('SELECT id FROM users WHERE login = ?').get('guest');
if (!guest) {
  const hash = bcrypt.hashSync('guest', 10);
  db.prepare('INSERT INTO users (login, password) VALUES (?, ?)').run('guest', hash);
  console.log('Compte guest créé');
}

// Crée le compte admin s'il n'existe pas
const admin = db.prepare('SELECT id FROM users WHERE login = ?').get('admin');
if (!admin) {
  const hash = bcrypt.hashSync('admin', 10);
  db.prepare(`
    INSERT INTO users (login, password, droit_creation, droit_modification, droit_effacement, droit_administration)
    VALUES (?, ?, 1, 1, 1, 1)
  `).run('admin', hash);
  console.log('Compte admin créé');
}

module.exports = db;