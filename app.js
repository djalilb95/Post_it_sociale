const express = require('express');
const session = require('express-session');
const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.use(session({
  secret: 'postit-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Rendre l'utilisateur connecté disponible dans toutes les vues
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use('/', require('./routes/postits'));
app.use('/', require('./routes/auth'));

app.listen(3000, () => console.log('Serveur démarré sur http://localhost:3000'));