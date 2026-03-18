const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  // Récupère tous les post-its avec le login de leur auteur, du plus ancien au plus récent
  const postits = db.prepare(`
    SELECT messages.*, users.login as auteur
    FROM messages
    JOIN users ON messages.auteur_id = users.id
    ORDER BY messages.date ASC
  `).all();

  // Ajoute un z-index à chaque post-it selon son ordre (le plus récent = z-index le plus haut)
  const postitsAvecZIndex = postits.map((p, index) => ({
    ...p,
    zIndex: index + 1
  }));

  res.render('index', { postits: postitsAvecZIndex });
});

module.exports = router;