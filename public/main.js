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
  // Calcule le z-index le plus élevé parmi les post-its existants
  const tousLesPostits = document.querySelectorAll('.postit');
  const maxZIndex = tousLesPostits.length;

  const div = document.createElement('div');
  div.classList.add('postit');
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
