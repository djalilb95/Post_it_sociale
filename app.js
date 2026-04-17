const express = require('express');
const https = require('https');
const fs = require('fs');
const session = require('express-session');
const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.use(session({
  secret: 'postit-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true }
}));

// Rendre l'utilisateur connecté disponible dans toutes les vues
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});
// Connecte automatiquement les visiteurs non connectés en tant que guest
app.use(async (req, res, next) => {
  if (!req.session.user) {
    const db = require('./database');
    const guest = db.prepare('SELECT * FROM users WHERE login = ?').get('guest');
    if (guest) {
      req.session.user = { id: guest.id, login: 'guest' };
    }
  }
  next();
});

app.use('/', require('./routes/postits'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/admin'));
app.use('/', require('./routes/settings'));

// Charge le certificat et la clé privée
const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  const https = require('https');
  const fs = require('fs');
  const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
  };
  https.createServer(options, app).listen(3000, () => {
    console.log('Serveur HTTPS démarré sur https://localhost:3000');
  });
} else {
  app.listen(process.env.PORT || 3000, () => {
    console.log('Serveur démarré en production');
  });
}