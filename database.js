const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Chemin de la base de données
const cheminDB = process.env.NODE_ENV === 'production'
  ? '/data/postits.db'
  : path.join(__dirname, 'postits.db');

// S'assurer que le dossier /data existe en prod (Railway Volume)
if (process.env.NODE_ENV === 'production' && !fs.existsSync('/data')) {
    console.log("Attention : Le dossier /data n'existe pas. Vérifiez votre Volume Railway.");
}

const db = new Database(cheminDB);

// On recrée tes outils pour ne pas casser tes routes
db.get2 = async (sql, params = []) => {
    return db.prepare(sql).get(params);
};

db.all2 = async (sql, params = []) => {
    return db.prepare(sql).all(params);
};

db.run2 = async (sql, params = []) => {
    const info = db.prepare(sql).run(params);
    return { lastID: info.lastInsertRowid, changes: info.changes };
};

// Initialisation (Synchrone avec better-sqlite3, c'est plus simple)
function init() {
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

    // Vérification des colonnes pour la couleur
    const info = db.pragma("table_info(users)");
    const noms = info.map(c => c.name);
    if (!noms.includes('couleur_fond')) {
        db.exec("ALTER TABLE users ADD COLUMN couleur_fond TEXT DEFAULT '#f0f0f0'");
        db.exec("ALTER TABLE users ADD COLUMN couleur_postit TEXT DEFAULT '#fef08a'");
    }
    console.log("Base de données initialisée.");
}

init();

// À ajouter à la fin de la fonction init() dans database.js
const bcrypt = require('bcrypt'); // N'oublie pas l'import en haut du fichier

const admin = db.prepare('SELECT id FROM users WHERE login = ?').get('admin');
if (!admin) {
    const hash = bcrypt.hashSync('admin', 10); // Mot de passe par défaut : admin
    db.prepare(`
        INSERT INTO users (login, password, droit_creation, droit_modification, droit_effacement, droit_administration)
        VALUES (?, ?, 1, 1, 1, 1)
    `).run('admin', hash);
    console.log('Compte admin créé sur Railway');
}

module.exports = db;