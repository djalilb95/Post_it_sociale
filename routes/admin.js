const express = require('express');
const router = express.Router();
const db = require('../database');

// Middleware qui bloque les non-admins
function verifierAdmin(req, res, next) {
  if (!req.session.user?.droits?.administration) {
    return res.status(403).send('Accès interdit');
  }
  next();
}

// Page d'administration
router.get('/admin', verifierAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT id, login, droit_creation, droit_modification, droit_effacement, droit_administration
    FROM users
    WHERE login != 'guest'
    ORDER BY login ASC
  `).all();

  res.render('admin', { users });
});

// Mise à jour des droits d'un utilisateur
router.post('/admin/droits', verifierAdmin, (req, res) => {
  const { userId, droit_creation, droit_modification, droit_effacement, droit_administration } = req.body;

  // Empêche un admin de se retirer ses propres droits d'administration
  if (parseInt(userId) === req.session.user.id && !droit_administration) {
    return res.redirect('/admin?erreur=Vous ne pouvez pas vous retirer vos droits d\'administration');
  }

  db.prepare(`
    UPDATE users
    SET droit_creation = ?, droit_modification = ?, droit_effacement = ?, droit_administration = ?
    WHERE id = ?
  `).run(
    droit_creation ? 1 : 0,
    droit_modification ? 1 : 0,
    droit_effacement ? 1 : 0,
    droit_administration ? 1 : 0,
    userId
  );

  res.redirect('/admin');
});

module.exports = router;