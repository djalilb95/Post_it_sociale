const express = require('express');
const router = express.Router();
const db = require('../database');

// Liste de tous les clients SSE connectés
const clients = [];

// Route SSE — le navigateur s'abonne aux événements
router.get('/events', (req, res) => {
  // Headers nécessaires pour les SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Ajoute ce client à la liste
  clients.push(res);
  console.log(`Client connecté. Total : ${clients.length}`);

  // Quand le navigateur ferme la connexion, on retire le client de la liste
  req.on('close', () => {
    const index = clients.indexOf(res);
    if (index !== -1) clients.splice(index, 1);
    console.log(`Client déconnecté. Total : ${clients.length}`);
  });
});

// Fonction utilitaire pour envoyer un événement à tous les clients connectés
function diffuser(type, donnees) {
  const message = `data: ${JSON.stringify({ type, ...donnees })}\n\n`;
  clients.forEach(client => client.write(message));
}

// Page principale
router.get('/', (req, res) => {
  const postits = db.prepare(`
    SELECT messages.*, users.login as auteur
    FROM messages
    JOIN users ON messages.auteur_id = users.id
    ORDER BY messages.date ASC
  `).all();

  const postitsAvecZIndex = postits.map((p, index) => ({
    ...p,
    zIndex: index + 1
  }));

  res.render('index', { postits: postitsAvecZIndex });
});

// Ajout d'un post-it
router.post('/ajouter', (req, res) => {
  if (!req.session.user || req.session.user.login === 'guest') {
    return res.status(401).json({ erreur: 'Vous devez être connecté pour créer un post-it' });
  }

  const { texte, x, y } = req.body;

  if (!texte || texte.trim() === '') {
    return res.status(400).json({ erreur: 'Le texte est vide' });
  }

  const date = new Date().toISOString();
  const resultat = db.prepare(`
    INSERT INTO messages (texte, date, x, y, auteur_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(texte.trim(), date, x, y, req.session.user.id);

  const nouveauPostit = {
    id: resultat.lastInsertRowid,
    texte: texte.trim(),
    date,
    x,
    y,
    auteur: req.session.user.login,
    auteur_id: req.session.user.id
  };

  // Diffuse le nouveau post-it à tous les navigateurs connectés
  diffuser('ajout', nouveauPostit);

  res.json(nouveauPostit);
});

// Suppression d'un post-it
router.post('/effacer', (req, res) => {
  if (!req.session.user || req.session.user.login === 'guest') {
    return res.status(401).json({ erreur: 'Vous devez être connecté pour supprimer un post-it' });
  }

  const { id } = req.body;
  const postit = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);

  if (!postit) return res.status(404).json({ erreur: 'Post-it introuvable' });
  if (postit.auteur_id !== req.session.user.id) return res.status(403).json({ erreur: 'Non autorisé' });

  db.prepare('DELETE FROM messages WHERE id = ?').run(id);

  // Diffuse la suppression à tous les navigateurs connectés
  diffuser('suppression', { id });

  res.json({ succes: true });
});

// Modification d'un post-it
router.post('/modifier', (req, res) => {
  if (!req.session.user || req.session.user.login === 'guest') {
    return res.status(401).json({ erreur: 'Vous devez être connecté pour modifier un post-it' });
  }

  const { id, texte } = req.body;

  if (!texte || texte.trim() === '') return res.status(400).json({ erreur: 'Le texte est vide' });

  const postit = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);

  if (!postit) return res.status(404).json({ erreur: 'Post-it introuvable' });
  if (postit.auteur_id !== req.session.user.id) return res.status(403).json({ erreur: 'Non autorisé' });

  db.prepare('UPDATE messages SET texte = ? WHERE id = ?').run(texte.trim(), id);

  // Diffuse la modification à tous les navigateurs connectés
  diffuser('modification', { id, texte: texte.trim() });

  res.json({ succes: true, texte: texte.trim() });
});

router.post('/modifier', (req, res) => {
  // Vérifie que l'utilisateur est connecté
  if (!req.session.user) {
    return res.status(401).json({ erreur: 'Non connecté' });
  }

  const { id, texte } = req.body;

  if (!texte || texte.trim() === '') {
    return res.status(400).json({ erreur: 'Le texte est vide' });
  }

  // Vérifie que le post-it appartient bien à l'utilisateur connecté
  const postit = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);

  if (!postit) {
    return res.status(404).json({ erreur: 'Post-it introuvable' });
  }

  if (postit.auteur_id !== req.session.user.id) {
    return res.status(403).json({ erreur: 'Non autorisé' });
  }

  // Met à jour le texte en BDD
  db.prepare('UPDATE messages SET texte = ? WHERE id = ?').run(texte.trim(), id);

  res.json({ succes: true, texte: texte.trim() });
});

module.exports = router;

