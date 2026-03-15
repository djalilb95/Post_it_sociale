const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');

// Affiche le formulaire d'inscription
router.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});

// Traite l'inscription
router.post('/signup', async (req, res) => {
  const { login, password } = req.body;

  // Vérifie que les champs ne sont pas vides
  if (!login || !password) {
    return res.render('signup', { error: 'Tous les champs sont obligatoires.' });
  }

  // Vérifie que le login n'est pas déjà pris
  const existing = db.prepare('SELECT id FROM users WHERE login = ?').get(login);
  if (existing) {
    return res.render('signup', { error: 'Ce login est déjà pris.' });
  }

  // Hash le mot de passe puis insère l'utilisateur
  const hash = await bcrypt.hash(password, 10);
  db.prepare('INSERT INTO users (login, password) VALUES (?, ?)').run(login, hash);

  res.redirect('/');
});

// Traite la connexion
router.post('/login', async (req, res) => {
  const { login, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE login = ?').get(login);

  // Vérifie que l'utilisateur existe et que le mot de passe est correct
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.redirect('/');
  }

  // Stocke l'utilisateur dans la session
  req.session.user = { id: user.id, login: user.login };
  res.redirect('/');
});

// Déconnexion
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;