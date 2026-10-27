# Moving Motivators

Atelier individuel inspiré de la pratique **Moving Motivators** de [Management 3.0](https://management30.com/practice/moving-motivators/) : découvrir dix motivations, les classer, les évaluer, puis en tirer des actions.

**Ouvrir l'outil :** https://vinchou59.github.io/moving-motivators/ (anglais : `?lang=en`)

## Déroulé

1. **Découvrir** : les dix cartes, avec une définition et trois exemples chacune. On choisit aussi le sujet de la séance :
   - *Mon épanouissement aujourd'hui* (par défaut) : chaque motivation est-elle nourrie dans le travail actuel ?
   - *L'effet d'un changement* : la variante d'origine de Management 3.0, où l'on regarde si un changement renforce ou affaiblit chaque motivation.
2. **Classer** : de la moins importante (à gauche) à la plus importante (à droite), par glisser-déposer, par les boutons ‹ › ou au clavier.
3. **Évaluer** : chaque carte monte ou descend par rapport à la ligne « Correct » (5 positions, de « En manque » à « Épanoui »).
4. **Débriefer** : l'outil fait ressortir les priorités (importantes et en manque), les points d'appui et ce qui est à surveiller, avec des questions pour chaque carte. On note des actions (quoi, qui, quand) et des notes, puis on garde une trace : compte rendu copié, impression / PDF, ou fichier `.json` à rouvrir plus tard pour comparer.

Sur mobile, le classement devient une pile verticale (la plus importante en haut) et l'évaluation un curseur horizontal (à droite : épanoui).

## Confidentialité

Aucune donnée ne quitte le navigateur : la séance est gardée dans le stockage local et n'est exportée que si on le demande.

## Architecture

Site statique (HTML, CSS, JavaScript en modules, sans build), publié sur GitHub Pages.

- `site/js/core.js` : logique pure (classement, positions, analyse, compte rendu, validation des fichiers), testée avec Node.js ;
- `site/js/i18n.js` : textes FR / EN et contenu des cartes ;
- `site/js/icons.js` : pictogrammes des cartes ;
- `site/js/app.js` : interface, glisser-déposer (pointeur : souris et tactile), clavier, thème, export.

Le thème clair / sombre est mémorisé avec la même clé que la boîte à outils, donc partagé avec elle.

## Développer

```sh
npm test        # tests du cœur métier
npm run serve   # http://localhost:8080
```

Chaque push sur `main` lance les tests puis publie `site/` sur GitHub Pages ; un test en échec bloque la publication.

## Droits

Moving Motivators est une pratique de Management 3.0. Les cartes, pictogrammes, définitions, exemples et questions de cet outil sont une création originale : ce ne sont pas les cartes officielles.
