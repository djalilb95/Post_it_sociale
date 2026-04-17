const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');

router.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});

router.post('/signup', async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.render('signup', { error: 'Tous les champs sont obligatoires.' });
  }

  if (login === 'guest' || login === 'admin') {
    return res.render('signup', { error: 'Ce login est réservé.' });
  }

  const existing = await db.get2('SELECT id FROM users WHERE login = ?', [login]);
  if (existing) {
    return res.render('signup', { error: 'Ce login est déjà pris.' });
  }

  const hash = await bcrypt.hash(password, 10);
  await db.run2(
    'INSERT INTO users (login, password, droit_creation) VALUES (?, ?, 1)',
    [login, hash]
  );

  res.redirect('/');
});

router.post('/login', async (req, res) => {
  const { login, password } = req.body;
  const user = await db.get2('SELECT * FROM users WHERE login = ?', [login]);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.redirect('/');
  }

  req.session.user = {
    id: user.id,
    login: user.login,
    droits: {
      creation: !!user.droit_creation,
      modification: !!user.droit_modification,
      effacement: !!user.droit_effacement,
      administration: !!user.droit_administration
    }
  };

  res.redirect('/');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;