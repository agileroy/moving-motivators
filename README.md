# Moving Motivators

Atelier individuel inspiré de la pratique **Moving Motivators** de [Management 3.0](https://management30.com/practice/moving-motivators/) : découvrir dix motivations, les classer, les évaluer, puis en tirer des actions.

**Ouvrir l'outil :** https://vinchou59.github.io/moving-motivators/ (anglais : `?lang=en`)

## Déroulé

1. **Découvrir** : un aperçu des dix cartes (le détail de chacune se lit en la piochant, ou d'un clic), puis le choix du sujet de la séance :
   - *Mon épanouissement aujourd'hui* (par défaut) : chaque motivation est-elle nourrie dans le travail actuel ?
   - *L'effet d'un changement* : la variante d'origine de Management 3.0, où l'on regarde si un changement renforce ou affaiblit chaque motivation.
2. **Classer** : le tableau part vide. On pioche les cartes une à une (pioche mélangée) et on pose chacune à sa place, de la moins importante (à gauche) à la plus importante (à droite), en la glissant ou en touchant un emplacement « + ». Une fois posées, les cartes se déplacent par glisser-déposer, par les boutons ‹ › ou au clavier.

À partir de l'étape 2, un clic sur une carte ouvre son détail (définition et exemples) dans un panneau en bas de l'écran, sans bloquer le reste de la page.
3. **Évaluer** : chaque carte monte ou descend par rapport à la ligne « Correct » (5 positions, de « En manque » à « Épanoui »).
4. **Débriefer** : sous le tableau, les questions pour lancer la discussion ; puis l'outil fait ressortir les priorités (importantes et en manque), les points d'appui et ce qui est à surveiller, avec des questions pour chaque carte. On note des actions (quoi, qui, quand) et des notes, puis on garde une trace : compte rendu copié, impression / PDF, ou fichier `.json` (« Enregistrer la séance »). Ce fichier se rouvre depuis le lien « Reprendre une séance enregistrée », sous l'introduction de l'étape 1, par exemple pour comparer avec une nouvelle séance quelques mois plus tard.

Quand une séance est déjà entamée dans le navigateur, l'étape 1 propose « Continuer la séance en cours » (retour à la dernière étape atteinte) ou « Commencer une nouvelle séance » (après confirmation : garde le prénom et le sujet saisis sur la page et ouvre directement la pioche) à la place de « Piocher les cartes ».

Sur mobile, le classement devient une pile verticale (la plus importante en haut) et l'évaluation un curseur horizontal (à droite : épanoui).

## Séance d'équipe

`…/moving-motivators/equipe.html` (lien « Animer une séance d'équipe » en pied de page).

1. L'animateur crée une séance : nom, sujet (épanouissement ou effet d'un changement), **nominative** ou **anonyme**.
2. Il partage le lien participant (ou le QR code). Chacun fait l'exercice sur son appareil ; le sujet est imposé par l'animateur.
3. À l'étape 4, chaque participant choisit de **partager son tableau** (prénom, classement et positions ; jamais ses actions ni ses notes). Il peut le **retirer** à tout moment ; tant qu'il est partagé, il se met à jour quand il déplace une carte.
4. L'animateur voit en direct le **tableau d'équipe** (une colonne par carte, rangées par importance moyenne, un point par personne et la position moyenne), ce qui compte le plus, les tensions (cartes importantes et en manque, avec le nombre de personnes concernées), les points forts et, en séance nominative, chaque tableau individuel. Il peut fermer la séance (plus de nouveaux partages), copier une synthèse, retirer un tableau ou supprimer la séance.

Le lien d'animation porte une clé (`equipe.html?seance=…#cle=…`), gardée dans le navigateur de l'animateur : elle permet de rouvrir la séance depuis un autre appareil. Ne pas la partager.

Comme pour le poker planning, le VPN de l'entreprise (proxy Zscaler) bloque Firebase : ouvrir la séance hors VPN, ou depuis un téléphone.

## Confidentialité

- **Exercice seul** : aucune donnée ne quitte le navigateur (Firebase n'est même pas chargé).
- **Séance d'équipe** : seuls les tableaux partagés volontairement vont dans Firebase. Les règles de sécurité garantissent que chaque participant ne lit et n'écrit que son propre tableau, et que seuls les navigateurs qui présentent la clé d'animation lisent tous les tableaux. En séance anonyme, la base refuse tout prénom. Les tableaux restent jusqu'à la suppression de la séance : la supprimer après le débrief.

## Architecture

Site statique (HTML, CSS, JavaScript en modules, sans build), publié sur GitHub Pages. Les séances d'équipe utilisent Firebase Realtime Database (connexion anonyme), branche `movingMotivators` de la base du projet `poker-planning-vleroy`, partagée avec le poker planning, la matrice de compétences et la roue de la chance.

- `site/js/core.js` : logique pure (classement, positions, analyse, compte rendu, validation des fichiers), testée avec Node.js ;
- `site/js/i18n.js` : textes FR / EN et contenu des cartes ;
- `site/js/icons.js` : pictogrammes des cartes ;
- `site/js/app.js` : interface, glisser-déposer (pointeur : souris et tactile), clavier, thème, export ;
- `site/js/shared.js` : briques communes aux deux pages (cartes, tableau, langue, thème, QR code) ;
- `site/js/team-core.js` : séances d'équipe, logique pure (données échangées, vue d'équipe), testée avec Node.js ;
- `site/js/team-store.js` : seul module qui parle à Firebase ;
- `site/js/team-participant.js` : côté participant (bandeau, partage, retrait) ;
- `site/js/facilitator.js` : page d'animation (`equipe.html`) ;
- `database.rules.json` : règles de sécurité de **toute** la base. La console Firebase n'accepte qu'un fichier de règles par base : garder ce fichier identique à celui de `poker-planning`, `matrice-competences` et `wheel-of-chance`, et le publier dans la console après chaque modification.

### Données (branche `movingMotivators`)

```
movingMotivators/
  keys/<séance>                      clé d'animation (jamais lisible)
  sessions/<séance>/
    meta                             title, mode, change, named, closed, createdAt (lisible par tout navigateur connecté)
    owners/<uid>                     clé présentée par chaque animateur
    participants/<uid>               name, order, levels, updatedAt (lisible par son auteur et les animateurs)
```

Le thème clair / sombre est mémorisé avec la même clé que la boîte à outils, donc partagé avec elle.

## Développer

```sh
npm test        # tests du cœur métier
npm run serve   # http://localhost:8080
```

Chaque push sur `main` lance les tests puis publie `site/` sur GitHub Pages ; un test en échec bloque la publication.

## Droits

Moving Motivators est une pratique de Management 3.0. Les cartes, pictogrammes, définitions, exemples et questions de cet outil sont une création originale : ce ne sont pas les cartes officielles.
