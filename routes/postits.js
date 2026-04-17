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

router.get('/', async (req, res) => {
  const postits = await db.all2(`
    SELECT messages.*, users.login as auteur
    FROM messages
    JOIN users ON messages.auteur_id = users.id
    ORDER BY messages.date ASC
  `);

  const postitsAvecZIndex = postits.map((p, index) => ({
    ...p,
    zIndex: index + 1
  }));

  let preferences = { couleurFond: '#f0f0f0', couleurPostit: '#fef08a' };
  if (req.session.user) {
    const userDoc = await db.get2(
      'SELECT couleur_fond, couleur_postit FROM users WHERE id = ?',
      [req.session.user.id]
    );
    if (userDoc) {
      preferences = {
        couleurFond: userDoc.couleur_fond || '#f0f0f0',
        couleurPostit: userDoc.couleur_postit || '#fef08a'
      };
    }
  }

  res.render('index', { postits: postitsAvecZIndex, preferences });
});

router.post('/ajouter', async (req, res) => {
  if (!req.session.user?.droits?.creation) {
    return res.status(401).json({ erreur: 'Vous n\'avez pas le droit de créer un post-it' });
  }

  const { texte, x, y } = req.body;
  if (!texte || texte.trim() === '') {
    return res.status(400).json({ erreur: 'Le texte est vide' });
  }

  const date = new Date().toISOString();
  const resultat = await db.run2(
    'INSERT INTO messages (texte, date, x, y, auteur_id) VALUES (?, ?, ?, ?, ?)',
    [texte.trim(), date, x, y, req.session.user.id]
  );

  const nouveauPostit = {
    id: resultat.lastID,
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

router.post('/effacer', async (req, res) => {
  if (!req.session.user?.droits?.effacement) {
    return res.status(401).json({ erreur: 'Vous n\'avez pas le droit de supprimer un post-it' });
  }

  const { id } = req.body;
  const postit = await db.get2('SELECT * FROM messages WHERE id = ?', [id]);

  if (!postit) return res.status(404).json({ erreur: 'Post-it introuvable' });

  if (postit.auteur_id !== req.session.user.id && !req.session.user.droits.administration) {
    return res.status(403).json({ erreur: 'Non autorisé' });
  }

  await db.run2('DELETE FROM messages WHERE id = ?', [id]);
  diffuser('suppression', { id });
  res.json({ succes: true });
});

router.post('/modifier', async (req, res) => {
  if (!req.session.user?.droits?.modification) {
    return res.status(401).json({ erreur: 'Vous n\'avez pas le droit de modifier un post-it' });
  }

  const { id, texte } = req.body;
  if (!texte || texte.trim() === '') return res.status(400).json({ erreur: 'Le texte est vide' });

  const postit = await db.get2('SELECT * FROM messages WHERE id = ?', [id]);
  if (!postit) return res.status(404).json({ erreur: 'Post-it introuvable' });

  if (postit.auteur_id !== req.session.user.id && !req.session.user.droits.administration) {
    return res.status(403).json({ erreur: 'Non autorisé' });
  }

  await db.run2('UPDATE messages SET texte = ? WHERE id = ?', [texte.trim(), id]);
  diffuser('modification', { id, texte: texte.trim() });
  res.json({ succes: true, texte: texte.trim() });
});

router.post('/deplacer', async (req, res) => {

  console.log("--- TENTATIVE DE DÉPLACEMENT ---");
  console.log("Session complète :", req.session);
  console.log("Utilisateur en session :", req.session.user);

  if (!req.session.user) {
      console.log("ERREUR : Aucun utilisateur trouvé en session !");
      return res.status(401).json({ erreur: "Non autorisé" });
  }
  
  if (!req.session.user?.droits?.modification) {
    return res.status(401).json({ erreur: 'Non autorisé' });
  }

  const { id, x, y } = req.body;
  const postit = await db.get2('SELECT * FROM messages WHERE id = ?', [id]);

  if (!postit) return res.status(404).json({ erreur: 'Post-it introuvable' });

  if (postit.auteur_id !== req.session.user.id && !req.session.user.droits.administration) {
    return res.status(403).json({ erreur: 'Non autorisé' });
  }

  await db.run2('UPDATE messages SET x = ?, y = ? WHERE id = ?', [x, y, id]);
  diffuser('deplacement', { id, x, y });
  res.json({ succes: true });
});

module.exports = router;
