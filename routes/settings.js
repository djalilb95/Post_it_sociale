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

router.post('/settings/login', verifierConnecte, async (req, res) => {
  const { nouveauLogin } = req.body;

  if (!nouveauLogin || nouveauLogin.trim() === '') {
    return res.status(400).json({ erreur: 'Le login ne peut pas être vide' });
  }

  if (nouveauLogin === 'guest' || nouveauLogin === 'admin') {
    return res.status(400).json({ erreur: 'Ce login est réservé' });
  }

  const existing = await db.get2('SELECT id FROM users WHERE login = ?', [nouveauLogin]);
  if (existing) {
    return res.status(400).json({ erreur: 'Ce login est déjà pris' });
  }

  await db.run2('UPDATE users SET login = ? WHERE id = ?', [nouveauLogin, req.session.user.id]);
  req.session.user.login = nouveauLogin;
  res.json({ succes: true, nouveauLogin });
});

router.post('/settings/password', verifierConnecte, async (req, res) => {
  const { ancienPassword, nouveauPassword } = req.body;
  const user = await db.get2('SELECT * FROM users WHERE id = ?', [req.session.user.id]);

  if (!user) return res.status(404).json({ erreur: 'Utilisateur introuvable' });

  const valide = await bcrypt.compare(ancienPassword, user.password);
  if (!valide) return res.status(400).json({ erreur: 'Ancien mot de passe incorrect' });

  if (!nouveauPassword || nouveauPassword.length < 3) {
    return res.status(400).json({ erreur: 'Le nouveau mot de passe est trop court' });
  }

  const hash = await bcrypt.hash(nouveauPassword, 10);
  await db.run2('UPDATE users SET password = ? WHERE id = ?', [hash, req.session.user.id]);
  res.json({ succes: true });
});

router.post('/settings/preferences', verifierConnecte, async (req, res) => {
  const { couleurFond, couleurPostit } = req.body;

  await db.run2(
    'UPDATE users SET couleur_fond = ?, couleur_postit = ? WHERE id = ?',
    [couleurFond, couleurPostit, req.session.user.id]
  );

  req.session.user.preferences = { couleurFond, couleurPostit };
  res.json({ succes: true });
});

module.exports = router;