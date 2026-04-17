// Connexion au flux SSE du serveur
const source = new EventSource('/events');

source.onmessage = (e) => {
  const data = JSON.parse(e.data);

  if (data.type === 'ajout') {
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

      const tousLesPostits = document.querySelectorAll('.postit');
      const maxZIndex = Math.max(...[...tousLesPostits].map(p => parseInt(p.style.zIndex) || 0));
      div.style.zIndex = maxZIndex + 1;
    }
  }
};

source.onerror = () => {
  console.log('Connexion SSE perdue, reconnexion automatique...');
};

let coordX = 0;
let coordY = 0;

const popup = document.getElementById('popup');
const popupTexte = document.getElementById('popup-texte');

document.querySelector('.board').addEventListener('dblclick', (e) => {
  if (e.target.closest('.postit') || e.target.closest('.popup')) return;

  coordX = e.clientX;
  coordY = e.clientY;

  popup.style.left = coordX + 'px';
  popup.style.top = coordY + 'px';
  popup.classList.remove('hidden');
  popupTexte.focus();
});

document.getElementById('popup-annuler').addEventListener('click', () => {
  fermerPopup();
});

document.getElementById('popup-valider').addEventListener('click', () => {
  ajouterPostit();
});

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
    afficherPostit(postit);
    fermerPopup();

  } catch (err) {
    alert('Erreur lors de l\'ajout du post-it');
  }
}

/**
 * CORRECTION SÉCURITÉ (XSS) : 
 * Utilisation de document.createElement et textContent à la place de innerHTML.
 */
/**
 * Affiche un post-it sur le board.
 * Gère les droits d'affichage des contrôles (Admin / Auteur) de manière sécurisée.
 */
function afficherPostit(postit) {
  const tousLesPostits = document.querySelectorAll('.postit');
  const maxZIndex = Math.max(...[...tousLesPostits].map(p => parseInt(p.style.zIndex) || 0));

  const div = document.createElement('div');
  div.dataset.id = postit.id;
  div.style.left = postit.x + 'px';
  div.style.top = postit.y + 'px';
  div.style.zIndex = maxZIndex + 1;
  div.classList.add('postit');

  // VÉRIFICATION DES DROITS (Utilise l'objet window.currentUser défini dans index.ejs)
  const estAuteur = window.currentUser && window.currentUser.id === postit.auteur_id;
  const estAdmin = window.currentUser && window.currentUser.isAdmin;
  const peutModifier = estAuteur || estAdmin;

  if (peutModifier) {
    div.classList.add('modifiable');
  }

  // Création sécurisée du contenu (Protection XSS)
  const pTexte = document.createElement('p');
  pTexte.classList.add('postit-texte');
  pTexte.textContent = postit.texte;

  const pMeta = document.createElement('p');
  pMeta.classList.add('postit-meta');
  const dateFormatee = new Date(postit.date).toLocaleString('fr-FR');
  pMeta.textContent = `${postit.auteur} — ${dateFormatee}`;

  div.appendChild(pTexte);
  div.appendChild(pMeta);

  // AJOUT DU BOUTON SUPPRIMER SI ADMIN OU AUTEUR
  if (peutModifier) {
    const btnSuppr = document.createElement('button');
    btnSuppr.classList.add('supprimer');
    btnSuppr.dataset.id = postit.id;
    btnSuppr.textContent = '×';
    div.appendChild(btnSuppr);
  }

  document.querySelector('.board').appendChild(div);
  
  // Activation des interactions si autorisé
  if (peutModifier) {
    ecouterBoutonSupprimer(div);
    ecouterDoubleClicModification(div);
    ecouterDrag(div); 
  }
}

document.querySelectorAll('.supprimer').forEach(bouton => {
  bouton.addEventListener('click', (e) => {
    const id = e.target.dataset.id;
    supprimerPostit(id);
  });
});

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

    const div = document.querySelector(`.postit[data-id="${id}"]`);
    if (div) div.remove();

  } catch (err) {
    alert('Erreur lors de la suppression');
  }
}

document.querySelectorAll('.postit.modifiable').forEach(div => {
  ecouterDoubleClicModification(div);
});

function ecouterDoubleClicModification(div) {
  div.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    if (div.querySelector('.edit-texte')) return;

    const paragraphe = div.querySelector('.postit-texte');
    const texteActuel = paragraphe.textContent;

    const textarea = document.createElement('textarea');
    textarea.classList.add('edit-texte');
    textarea.value = texteActuel;
    paragraphe.replaceWith(textarea);
    textarea.focus();

    const boutonValider = document.createElement('button');
    boutonValider.textContent = '✓';
    boutonValider.classList.add('btn', 'btn-valider-edit');
    div.appendChild(boutonValider);

    boutonValider.addEventListener('click', () => {
      modifierPostit(div, textarea, boutonValider, texteActuel);
    });

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

let postitEnCours = null;
let offsetX = 0;
let offsetY = 0;

document.querySelectorAll('.postit.modifiable').forEach(div => {
  ecouterDrag(div);
});

function ecouterDrag(div) {
  div.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('supprimer')) return;
    if (div.querySelector('.edit-texte')) return;

    postitEnCours = div;
    offsetX = e.clientX - div.getBoundingClientRect().left;
    offsetY = e.clientY - div.getBoundingClientRect().top;

    const tousLesPostits = document.querySelectorAll('.postit');
    const maxZIndex = Math.max(...[...tousLesPostits].map(p => parseInt(p.style.zIndex) || 0));
    div.style.zIndex = maxZIndex + 1;

    e.preventDefault();
  });
}

document.addEventListener('mousemove', (e) => {
  if (!postitEnCours) return;

  const board = document.querySelector('.board');
  const boardRect = board.getBoundingClientRect();

  let newX = e.clientX - boardRect.left - offsetX;
  let newY = e.clientY - boardRect.top - offsetY;

  newX = Math.max(0, Math.min(newX, boardRect.width - postitEnCours.offsetWidth));
  newY = Math.max(0, Math.min(newY, boardRect.height - postitEnCours.offsetHeight));

  postitEnCours.style.left = newX + 'px';
  postitEnCours.style.top = newY + 'px';
});

document.addEventListener('mouseup', async (e) => {
  if (!postitEnCours) return;

  const id = postitEnCours.dataset.id;
  const x = parseFloat(postitEnCours.style.left);
  const y = parseFloat(postitEnCours.style.top);

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