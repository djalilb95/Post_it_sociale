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

router.post('/ajouter', (req, res) => {
  // Vérifie que l'utilisateur est connecté
  if (!req.session.user) {
    return res.status(401).json({ erreur: 'Non connecté' });
  }

  const { texte, x, y } = req.body;

  // Vérifie que le texte n'est pas vide
  if (!texte || texte.trim() === '') {
    return res.status(400).json({ erreur: 'Le texte est vide' });
  }

  const date = new Date().toISOString();

  // Insère le post-it en BDD
  const resultat = db.prepare(`
    INSERT INTO messages (texte, date, x, y, auteur_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(texte.trim(), date, x, y, req.session.user.id);

  // Renvoie le post-it créé au client
  res.json({
    id: resultat.lastInsertRowid,
    texte: texte.trim(),
    date,
    x,
    y,
    auteur: req.session.user.login,
    auteur_id: req.session.user.id
  });
});

router.post('/effacer', (req, res) => {
  // Vérifie que l'utilisateur est connecté
  if (!req.session.user) {
    return res.status(401).json({ erreur: 'Non connecté' });
  }

  const { id } = req.body;

  // Vérifie que le post-it appartient bien à l'utilisateur connecté
  const postit = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);

  if (!postit) {
    return res.status(404).json({ erreur: 'Post-it introuvable' });
  }

  if (postit.auteur_id !== req.session.user.id) {
    return res.status(403).json({ erreur: 'Non autorisé' });
  }

  // Supprime le post-it
  db.prepare('DELETE FROM messages WHERE id = ?').run(id);

  res.json({ succes: true });
});

module.exports = router;