const express = require('express');
const router = express.Router();
const db = require('../database');

const clients = [];

router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.push(res);
  req.on('close', () => {
    const index = clients.indexOf(res);
    if (index !== -1) clients.splice(index, 1);
  });
});

function diffuser(type, donnees) {
  const message = `data: ${JSON.stringify({ type, ...donnees })}\n\n`;
  clients.forEach(client => client.write(message));
}

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

router.post('/ajouter', (req, res) => {
  if (!req.session.user?.droits?.creation) {
    return res.status(401).json({ erreur: 'Vous n\'avez pas le droit de créer un post-it' });
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

  diffuser('ajout', nouveauPostit);
  res.json(nouveauPostit);
});

router.post('/effacer', (req, res) => {
  if (!req.session.user?.droits?.effacement) {
    return res.status(401).json({ erreur: 'Vous n\'avez pas le droit de supprimer un post-it' });
  }

  const { id } = req.body;
  const postit = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);

  if (!postit) return res.status(404).json({ erreur: 'Post-it introuvable' });

  // Les admins peuvent supprimer n'importe quel post-it
  if (postit.auteur_id !== req.session.user.id && !req.session.user.droits.administration) {
    return res.status(403).json({ erreur: 'Non autorisé' });
  }

  db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  diffuser('suppression', { id });
  res.json({ succes: true });
});

router.post('/modifier', (req, res) => {
  if (!req.session.user?.droits?.modification) {
    return res.status(401).json({ erreur: 'Vous n\'avez pas le droit de modifier un post-it' });
  }

  const { id, texte } = req.body;
  if (!texte || texte.trim() === '') return res.status(400).json({ erreur: 'Le texte est vide' });

  const postit = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);

  if (!postit) return res.status(404).json({ erreur: 'Post-it introuvable' });

  // Les admins peuvent modifier n'importe quel post-it
  if (postit.auteur_id !== req.session.user.id && !req.session.user.droits.administration) {
    return res.status(403).json({ erreur: 'Non autorisé' });
  }

  db.prepare('UPDATE messages SET texte = ? WHERE id = ?').run(texte.trim(), id);
  diffuser('modification', { id, texte: texte.trim() });
  res.json({ succes: true, texte: texte.trim() });
});

router.post('/deplacer', (req, res) => {
  if (!req.session.user?.droits?.modification) {
    return res.status(401).json({ erreur: 'Non autorisé' });
  }

  const { id, x, y } = req.body;
  const postit = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);

  if (!postit) return res.status(404).json({ erreur: 'Post-it introuvable' });

  // Les admins peuvent déplacer n'importe quel post-it
  if (postit.auteur_id !== req.session.user.id && !req.session.user.droits.administration) {
    return res.status(403).json({ erreur: 'Non autorisé' });
  }

  db.prepare('UPDATE messages SET x = ?, y = ? WHERE id = ?').run(x, y, id);

  // Diffuse la nouvelle position à tous les navigateurs
  diffuser('deplacement', { id, x, y });

  res.json({ succes: true });
});

module.exports = router;
