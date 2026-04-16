// Connexion au flux SSE du serveur
const source = new EventSource('/events');

source.onmessage = (e) => {
  const data = JSON.parse(e.data);

  if (data.type === 'ajout') {
    // Ne pas afficher le post-it si c'est nous qui venons de le créer
    // (on l'a déjà affiché localement via afficherPostit)
    const dejaPresent = document.querySelector(`.postit[data-id="${data.id}"]`);
    if (!dejaPresent) {
      afficherPostit(data);
    }
  }

  if (data.type === 'suppression') {
    const div = document.querySelector(`.postit[data-id="${data.id}"]`);
    if (div) div.remove();
  }

  if (data.type === 'modification') {
    const div = document.querySelector(`.postit[data-id="${data.id}"]`);
    if (div) {
      const paragraphe = div.querySelector('.postit-texte');
      if (paragraphe) paragraphe.textContent = data.texte;
    }
  }

  if (data.type === 'deplacement') {
    const div = document.querySelector(`.postit[data-id="${data.id}"]`);
    if (div && div !== postitEnCours) {
      div.style.left = data.x + 'px';
      div.style.top = data.y + 'px';

      // Met le post-it déplacé au premier plan chez les autres navigateurs
      const tousLesPostits = document.querySelectorAll('.postit');
      const maxZIndex = Math.max(...[...tousLesPostits].map(p => parseInt(p.style.zIndex) || 0));
      div.style.zIndex = maxZIndex + 1;
    }
  }
};

source.onerror = () => {
  console.log('Connexion SSE perdue, reconnexion automatique...');
};

// Coordonnées du double-clic, gardées en mémoire pour créer le post-it au bon endroit
let coordX = 0;
let coordY = 0;

const popup = document.getElementById('popup');
const popupTexte = document.getElementById('popup-texte');

// Double-clic sur le tableau
document.querySelector('.board').addEventListener('dblclick', (e) => {
  // Ignore le double-clic sur un post-it existant ou le popup
  if (e.target.closest('.postit') || e.target.closest('.popup')) return;

  // Sauvegarde les coordonnées du clic
  coordX = e.clientX;
  coordY = e.clientY;

  // Positionne et affiche le popup à l'endroit du clic
  popup.style.left = coordX + 'px';
  popup.style.top = coordY + 'px';
  popup.classList.remove('hidden');
  popupTexte.focus();
});

// Bouton Annuler
document.getElementById('popup-annuler').addEventListener('click', () => {
  fermerPopup();
});

// Bouton Valider
document.getElementById('popup-valider').addEventListener('click', () => {
  ajouterPostit();
});

// Valider aussi avec Entrée (sans Shift)
popupTexte.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    ajouterPostit();
  }
});

function fermerPopup() {
  popup.classList.add('hidden');
  popupTexte.value = '';
}

async function ajouterPostit() {
  const texte = popupTexte.value.trim();
  if (!texte) return;

  try {
    // Envoie les données au serveur en AJAX
    const reponse = await fetch('/ajouter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texte, x: coordX, y: coordY })
    });

    if (!reponse.ok) {
      const erreur = await reponse.json();
      alert(erreur.erreur);
      return;
    }

    const postit = await reponse.json();

    // Ajoute le post-it dans le DOM sans recharger la page
    afficherPostit(postit);
    fermerPopup();

  } catch (err) {
    alert('Erreur lors de l\'ajout du post-it');
  }
}

function afficherPostit(postit) {
  const tousLesPostits = document.querySelectorAll('.postit');
  const maxZIndex = Math.max(...[...tousLesPostits].map(p => parseInt(p.style.zIndex) || 0));

  const div = document.createElement('div');
  div.classList.add('postit', 'modifiable'); // modifiable car c'est forcément notre post-it
  div.dataset.id = postit.id;
  div.style.left = postit.x + 'px';
  div.style.top = postit.y + 'px';
  div.style.zIndex = maxZIndex + 1;

  div.innerHTML = `
    <p class="postit-texte">${postit.texte}</p>
    <p class="postit-meta">${postit.auteur} — ${new Date(postit.date).toLocaleString('fr-FR')}</p>
    <button class="supprimer" data-id="${postit.id}">×</button>
  `;

  document.querySelector('.board').appendChild(div);
  ecouterBoutonSupprimer(div);
  ecouterDoubleClicModification(div);
  ecouterDrag(div); 
}

// Écoute les clics sur les boutons supprimer (présents au chargement de la page)
document.querySelectorAll('.supprimer').forEach(bouton => {
  bouton.addEventListener('click', (e) => {
    const id = e.target.dataset.id;
    supprimerPostit(id);
  });
});

// Fonction pour écouter le bouton supprimer d'un post-it qu'on vient de créer en AJAX
function ecouterBoutonSupprimer(div) {
  const bouton = div.querySelector('.supprimer');
  if (bouton) {
    bouton.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      supprimerPostit(id);
    });
  }
}

async function supprimerPostit(id) {
  // Demande confirmation avant de supprimer
  const confirmation = confirm('Voulez-vous vraiment supprimer ce post-it ?');
  if (!confirmation) return;

  try {
    const reponse = await fetch('/effacer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });

    if (!reponse.ok) {
      const erreur = await reponse.json();
      alert(erreur.erreur);
      return;
    }

    // Retire le post-it du DOM
    const div = document.querySelector(`.postit[data-id="${id}"]`);
    if (div) div.remove();

  } catch (err) {
    alert('Erreur lors de la suppression');
  }
}

// Écoute le double-clic sur les post-its présents au chargement
document.querySelectorAll('.postit.modifiable').forEach(div => {
  ecouterDoubleClicModification(div);
});

function ecouterDoubleClicModification(div) {
  div.addEventListener('dblclick', (e) => {
    // Empêche le double-clic de se propager au board et de créer un nouveau post-it
    e.stopPropagation();

    // Si déjà en mode édition on ne fait rien
    if (div.querySelector('.edit-texte')) return;

    const paragraphe = div.querySelector('.postit-texte');
    const texteActuel = paragraphe.textContent;

    // Remplace le paragraphe par un textarea avec le texte actuel
    const textarea = document.createElement('textarea');
    textarea.classList.add('edit-texte');
    textarea.value = texteActuel;
    paragraphe.replaceWith(textarea);
    textarea.focus();

    // Bouton valider la modification
    const boutonValider = document.createElement('button');
    boutonValider.textContent = '✓';
    boutonValider.classList.add('btn', 'btn-valider-edit');
    div.appendChild(boutonValider);

    // Valider au clic sur le bouton
    boutonValider.addEventListener('click', () => {
      modifierPostit(div, textarea, boutonValider, texteActuel);
    });

    // Valider avec Entrée, annuler avec Echap
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        modifierPostit(div, textarea, boutonValider, texteActuel);
      }
      if (e.key === 'Escape') {
        annulerModification(div, textarea, boutonValider, texteActuel);
      }
    });
  });
}

async function modifierPostit(div, textarea, boutonValider, texteOriginal) {
  const nouveauTexte = textarea.value.trim();

  if (!nouveauTexte) return;

  // Si le texte n'a pas changé on annule juste l'édition
  if (nouveauTexte === texteOriginal) {
    annulerModification(div, textarea, boutonValider, texteOriginal);
    return;
  }

  try {
    const reponse = await fetch('/modifier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: div.dataset.id, texte: nouveauTexte })
    });

    if (!reponse.ok) {
      const erreur = await reponse.json();
      alert(erreur.erreur);
      return;
    }

    // Remet un paragraphe avec le nouveau texte
    const paragraphe = document.createElement('p');
    paragraphe.classList.add('postit-texte');
    paragraphe.textContent = nouveauTexte;
    textarea.replaceWith(paragraphe);
    boutonValider.remove();

  } catch (err) {
    alert('Erreur lors de la modification');
  }
}

function annulerModification(div, textarea, boutonValider, texteOriginal) {
  const paragraphe = document.createElement('p');
  paragraphe.classList.add('postit-texte');
  paragraphe.textContent = texteOriginal;
  textarea.replaceWith(paragraphe);
  boutonValider.remove();
}

// Drag and drop — état global
let postitEnCours = null;  // Le post-it qu'on est en train de déplacer
let offsetX = 0;           // Décalage entre le curseur et le coin du post-it
let offsetY = 0;

// Branche le drag sur les post-its déplaçables présents au chargement
document.querySelectorAll('.postit.modifiable').forEach(div => {
  ecouterDrag(div);
});

function ecouterDrag(div) {
  div.addEventListener('mousedown', (e) => {
    // Ignore le clic sur le bouton supprimer ou en mode édition
    if (e.target.classList.contains('supprimer')) return;
    if (div.querySelector('.edit-texte')) return;

    postitEnCours = div;

    // Calcule le décalage entre le curseur et le coin haut-gauche du post-it
    offsetX = e.clientX - div.getBoundingClientRect().left;
    offsetY = e.clientY - div.getBoundingClientRect().top;

    // Met le post-it au premier plan
    const tousLesPostits = document.querySelectorAll('.postit');
    const maxZIndex = Math.max(...[...tousLesPostits].map(p => parseInt(p.style.zIndex) || 0));
    div.style.zIndex = maxZIndex + 1;

    e.preventDefault(); // Empêche la sélection de texte pendant le drag
  });
}

// Déplacement de la souris sur toute la page
document.addEventListener('mousemove', (e) => {
  if (!postitEnCours) return;

  const board = document.querySelector('.board');
  const boardRect = board.getBoundingClientRect();

  // Calcule la nouvelle position relative au board
  let newX = e.clientX - boardRect.left - offsetX;
  let newY = e.clientY - boardRect.top - offsetY;

  // Empêche le post-it de sortir du board
  newX = Math.max(0, Math.min(newX, boardRect.width - postitEnCours.offsetWidth));
  newY = Math.max(0, Math.min(newY, boardRect.height - postitEnCours.offsetHeight));

  postitEnCours.style.left = newX + 'px';
  postitEnCours.style.top = newY + 'px';
});

// Relâchement de la souris — on envoie la nouvelle position au serveur
document.addEventListener('mouseup', async (e) => {
  if (!postitEnCours) return;

  const id = postitEnCours.dataset.id;
  const x = parseFloat(postitEnCours.style.left);
  const y = parseFloat(postitEnCours.style.top);

  // Remet la variable à null avant le fetch pour éviter les doublons
  const divDeplacee = postitEnCours;
  postitEnCours = null;

  try {
    await fetch('/deplacer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, x, y })
    });
  } catch (err) {
    console.error('Erreur lors du déplacement', err);
  }
});

function toggleReglages() {
  const panel = document.getElementById('panel-reglages');
  const overlay = document.getElementById('overlay-reglages');
  panel.classList.toggle('hidden');
  overlay.classList.toggle('hidden');
}

async function changerLogin() {
  const nouveauLogin = document.getElementById('nouveau-login').value.trim();
  const feedback = document.getElementById('feedback-login');

  try {
    const reponse = await fetch('/settings/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nouveauLogin })
    });

    const data = await reponse.json();

    if (!reponse.ok) {
      feedback.textContent = data.erreur;
      feedback.className = 'feedback erreur';
      return;
    }

    // Met à jour le login affiché dans la topbar
    document.getElementById('span-login').textContent = data.nouveauLogin;
    feedback.textContent = 'Login modifié avec succès !';
    feedback.className = 'feedback succes';
    document.getElementById('nouveau-login').value = '';

  } catch (err) {
    feedback.textContent = 'Erreur lors de la modification';
    feedback.className = 'feedback erreur';
  }
}

async function changerPassword() {
  const ancienPassword = document.getElementById('ancien-password').value;
  const nouveauPassword = document.getElementById('nouveau-password').value;
  const feedback = document.getElementById('feedback-password');

  try {
    const reponse = await fetch('/settings/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ancienPassword, nouveauPassword })
    });

    const data = await reponse.json();

    if (!reponse.ok) {
      feedback.textContent = data.erreur;
      feedback.className = 'feedback erreur';
      return;
    }

    feedback.textContent = 'Mot de passe modifié avec succès !';
    feedback.className = 'feedback succes';
    document.getElementById('ancien-password').value = '';
    document.getElementById('nouveau-password').value = '';

  } catch (err) {
    feedback.textContent = 'Erreur lors de la modification';
    feedback.className = 'feedback erreur';
  }
}

async function sauvegarderCouleurs() {
  const couleurFond = document.getElementById('couleur-fond').value;
  const couleurPostit = document.getElementById('couleur-postit').value;
  const feedback = document.getElementById('feedback-couleurs');

  try {
    const reponse = await fetch('/settings/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ couleurFond, couleurPostit })
    });

    const data = await reponse.json();

    if (!reponse.ok) {
      feedback.textContent = data.erreur;
      feedback.className = 'feedback erreur';
      return;
    }

    // Applique les couleurs immédiatement sans recharger
    document.querySelector('.board').style.background = couleurFond;
    document.querySelectorAll('.postit').forEach(p => {
      p.style.background = couleurPostit;
    });

    feedback.textContent = 'Couleurs sauvegardées !';
    feedback.className = 'feedback succes';

  } catch (err) {
    feedback.textContent = 'Erreur lors de la sauvegarde';
    feedback.className = 'feedback erreur';
  }
}