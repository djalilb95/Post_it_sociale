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
    droit_administration INTEGER DEFAULT 0
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

// Ajoute les colonnes de droits si elles n'existent pas encore (migration)
const colonnes = db.pragma('table_info(users)').map(c => c.name);
if (!colonnes.includes('droit_creation')) {
  db.exec(`
    ALTER TABLE users ADD COLUMN droit_creation INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN droit_modification INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN droit_effacement INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN droit_administration INTEGER DEFAULT 0;
  `);
  console.log('Colonnes de droits ajoutées');
}

// Crée le compte guest s'il n'existe pas déjà
const guest = db.prepare('SELECT id FROM users WHERE login = ?').get('guest');
if (!guest) {
  const hash = bcrypt.hashSync('guest', 10);
  db.prepare('INSERT INTO users (login, password) VALUES (?, ?)').run('guest', hash);
  console.log('Compte guest créé');
}

// Crée un compte admin s'il n'existe pas
const admin = db.prepare('SELECT id FROM users WHERE login = ?').get('admin');
if (!admin) {
  const hash = bcrypt.hashSync('admin', 10);
  db.prepare(`
    INSERT INTO users (login, password, droit_creation, droit_modification, droit_effacement, droit_administration)
    VALUES (?, ?, 1, 1, 1, 1)
  `).run('admin', hash);
  console.log('Compte admin créé (login: admin, mot de passe: admin)');
}

module.exports = db;