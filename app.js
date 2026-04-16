const express = require('express');
const session = require('express-session');
const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.use(session({
  secret: process.env.SECRET || 'postit-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use(async (req, res, next) => {
  if (!req.session.user) {
    const db = require('./database');
    const guest = db.prepare('SELECT * FROM users WHERE login = ?').get('guest');
    if (guest) {
      req.session.user = {
        id: guest.id,
        login: 'guest',
        droits: {
          creation: !!guest.droit_creation,
          modification: !!guest.droit_modification,
          effacement: !!guest.droit_effacement,
          administration: !!guest.droit_administration
        }
      };
    }
  }
  next();
});

app.use('/', require('./routes/postits'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/admin'));
app.use('/', require('./routes/settings'));


// On exporte l'app pour que Vercel la gère
module.exports = app;

// En local on garde le serveur HTTPS
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
}