const express = require('express');
const router = express.Router();
const db = require('../database');

function verifierAdmin(req, res, next) {
  if (!req.session.user?.droits?.administration) {
    return res.status(403).send('Accès interdit');
  }
  next();
}

router.get('/admin', verifierAdmin, (req, res) => {
  const users = db.prepare(
    "SELECT * FROM users WHERE login != 'guest' ORDER BY login ASC"
  ).all();
  res.render('admin', { users });
});

router.post('/admin/droits', verifierAdmin, (req, res) => {
  const { userId, droit_creation, droit_modification, droit_effacement, droit_administration } = req.body;

  if (parseInt(userId) === req.session.user.id && !droit_administration) {
    return res.redirect('/admin');
  }

  db.prepare(`
    UPDATE users
    SET droit_creation=?, droit_modification=?, droit_effacement=?, droit_administration=?
    WHERE id=?
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