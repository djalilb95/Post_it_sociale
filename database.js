const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const cheminDB = process.env.NODE_ENV === 'production'
  ? '/data/postits.db'
  : 'postits.db';

const db = new sqlite3.Database(cheminDB);

// Fonction utilitaire pour les requêtes SELECT (retourne plusieurs lignes)
db.all2 = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

// Fonction utilitaire pour les requêtes SELECT (retourne une seule ligne)
db.get2 = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

// Fonction utilitaire pour INSERT, UPDATE, DELETE
db.run2 = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});

// Initialisation des tables
async function init() {
  await db.run2(`
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
    )
  `);

  await db.run2(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      texte TEXT NOT NULL,
      date TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      auteur_id INTEGER NOT NULL,
      FOREIGN KEY (auteur_id) REFERENCES users(id)
    )
  `);

  // Migration douce
  const colonnes = await db.all2(`PRAGMA table_info(users)`);
  const noms = colonnes.map(c => c.name);

  if (!noms.includes('couleur_fond')) {
    await db.run2(`ALTER TABLE users ADD COLUMN couleur_fond TEXT DEFAULT '#f0f0f0'`);
    await db.run2(`ALTER TABLE users ADD COLUMN couleur_postit TEXT DEFAULT '#fef08a'`);
  }

  // Crée guest si inexistant
  const guest = await db.get2('SELECT id FROM users WHERE login = ?', ['guest']);
  if (!guest) {
    const hash = await bcrypt.hash('guest', 10);
    await db.run2('INSERT INTO users (login, password) VALUES (?, ?)', ['guest', hash]);
    console.log('Compte guest créé');
  }

  // Crée admin si inexistant
  const admin = await db.get2('SELECT id FROM users WHERE login = ?', ['admin']);
  if (!admin) {
    const hash = await bcrypt.hash('admin', 10);
    await db.run2(
      'INSERT INTO users (login, password, droit_creation, droit_modification, droit_effacement, droit_administration) VALUES (?, ?, 1, 1, 1, 1)',
      ['admin', hash]
    );
    console.log('Compte admin créé');
  }
}

init().catch(console.error);

module.exports = db;