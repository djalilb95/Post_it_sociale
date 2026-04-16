const bcrypt = require('bcrypt');

let db;

if (process.env.NODE_ENV === 'production') {
  // En production : Turso (SQLite dans le cloud)
  const { createClient } = require('@libsql/client');
  const client = createClient({
    url: process.env.TURSO_URL,
    authToken: process.env.TURSO_TOKEN
  });

  // On crée les tables si elles n'existent pas
  async function init() {
    await client.execute(`
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

    await client.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        texte TEXT NOT NULL,
        date TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        auteur_id INTEGER NOT NULL
      )
    `);

    // Crée guest si inexistant
    const guest = await client.execute({
      sql: 'SELECT id FROM users WHERE login = ?',
      args: ['guest']
    });
    if (guest.rows.length === 0) {
      const hash = await bcrypt.hash('guest', 10);
      await client.execute({
        sql: 'INSERT INTO users (login, password) VALUES (?, ?)',
        args: ['guest', hash]
      });
    }

    // Crée admin si inexistant
    const admin = await client.execute({
      sql: 'SELECT id FROM users WHERE login = ?',
      args: ['admin']
    });
    if (admin.rows.length === 0) {
      const hash = await bcrypt.hash('admin', 10);
      await client.execute({
        sql: 'INSERT INTO users (login, password, droit_creation, droit_modification, droit_effacement, droit_administration) VALUES (?, ?, 1, 1, 1, 1)',
        args: ['admin', hash]
      });
    }
  }

  init().catch(console.error);
  db = client;

} else {
  // En local : SQLite classique
  const Database = require('better-sqlite3');
  db = new Database('postits.db');

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

  const colonnes = db.pragma('table_info(users)').map(c => c.name);
  if (!colonnes.includes('couleur_fond')) {
    db.exec(`
      ALTER TABLE users ADD COLUMN couleur_fond TEXT DEFAULT '#f0f0f0';
      ALTER TABLE users ADD COLUMN couleur_postit TEXT DEFAULT '#fef08a';
    `);
  }

  const guest = db.prepare('SELECT id FROM users WHERE login = ?').get('guest');
  if (!guest) {
    const hash = bcrypt.hashSync('guest', 10);
    db.prepare('INSERT INTO users (login, password) VALUES (?, ?)').run('guest', hash);
  }

  const admin = db.prepare('SELECT id FROM users WHERE login = ?').get('admin');
  if (!admin) {
    const hash = bcrypt.hashSync('admin', 10);
    db.prepare(`
      INSERT INTO users (login, password, droit_creation, droit_modification, droit_effacement, droit_administration)
      VALUES (?, ?, 1, 1, 1, 1)
    `).run('admin', hash);
  }
}

module.exports = db;