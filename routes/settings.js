const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');

function verifierConnecte(req, res, next) {
  if (!req.session.user || req.session.user.login === 'guest') {
    return res.status(401).json({ erreur: 'Non connecté' });
  }
  next();
}

// Changer le login
router.post('/settings/login', verifierConnecte, async (req, res) => {
  const { nouveauLogin } = req.body;

  if (!nouveauLogin || nouveauLogin.trim() === '') {
    return res.status(400).json({ erreur: 'Le login ne peut pas être vide' });
  }

  if (nouveauLogin === 'guest' || nouveauLogin === 'admin') {
    return res.status(400).json({ erreur: 'Ce login est réservé' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE login = ?').get(nouveauLogin);
  if (existing) {
    return res.status(400).json({ erreur: 'Ce login est déjà pris' });
  }

  db.prepare('UPDATE users SET login = ? WHERE id = ?').run(nouveauLogin, req.session.user.id);

  // Met à jour la session
  req.session.user.login = nouveauLogin;

  res.json({ succes: true, nouveauLogin });
});

// Changer le mot de passe
router.post('/settings/password', verifierConnecte, async (req, res) => {
  const { ancienPassword, nouveauPassword } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
  if (!user) return res.status(404).json({ erreur: 'Utilisateur introuvable' });

  const valide = await bcrypt.compare(ancienPassword, user.password);
  if (!valide) {
    return res.status(400).json({ erreur: 'Ancien mot de passe incorrect' });
  }

  if (!nouveauPassword || nouveauPassword.length < 3) {
    return res.status(400).json({ erreur: 'Le nouveau mot de passe est trop court' });
  }

  const hash = await bcrypt.hash(nouveauPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.session.user.id);

  res.json({ succes: true });
});

// Sauvegarder les préférences de couleur
router.post('/settings/preferences', verifierConnecte, (req, res) => {
  const { couleurFond, couleurPostit } = req.body;

  db.prepare('UPDATE users SET couleur_fond = ?, couleur_postit = ? WHERE id = ?')
    .run(couleurFond, couleurPostit, req.session.user.id);

  // Met à jour la session
  req.session.user.preferences = { couleurFond, couleurPostit };

  res.json({ succes: true });
});

module.exports = router;