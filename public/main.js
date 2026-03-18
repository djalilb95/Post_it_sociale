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

