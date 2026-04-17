const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// CRUCIAL pour Railway : Faire confiance au proxy pour le HTTPS
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.set('trust proxy', 1);

app.use(session({
  secret: 'postit-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // true seulement en prod
    maxAge: 1000 * 60 * 60 * 24 // 24 heures
  }
}));

// Rendre l'utilisateur disponible dans les vues
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Middleware Guest (Corrected pour sqlite3 async)
app.use(async (req, res, next) => {
  if (!req.session.user) {
    const db = require('./database');
    try {
      const guest = await db.get2('SELECT * FROM users WHERE login = ?', ['guest']);
      if (guest) {
        req.session.user = { 
          id: guest.id, 
          login: 'guest',
          droits: { creation: !!guest.droit_creation, modification: !!guest.droit_modification, effacement: !!guest.droit_effacement, administration: !!guest.droit_administration }
        };
      }
    } catch (e) { console.error(e); }
  }
  next();
});

app.use('/', require('./routes/postits'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/admin'));
app.use('/', require('./routes/settings'));

// GESTION DU DÉMARRAGE (Local HTTPS vs Prod HTTP)
if (process.env.NODE_ENV !== 'production') {
  const https = require('https');
  const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
  };
  https.createServer(options, app).listen(3000, () => {
    console.log('🚀 Serveur HTTPS local: https://localhost:3000');
  });
} else {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`🚀 Serveur Production démarré sur le port ${port}`);
  });
}