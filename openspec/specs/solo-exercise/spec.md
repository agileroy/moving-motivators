# solo-exercise Specification

## Purpose
L'exercice seul en quatre étapes (découvrir, classer, évaluer, débriefer), la lecture du tableau, la séance en cours et l'affichage sur téléphone.

## Requirements

### Requirement: Découvrir et choisir le sujet
L'étape 1 SHALL présenter les dix cartes et le choix du sujet : « Mon épanouissement aujourd'hui » (par défaut : chaque motivation est-elle nourrie dans le travail actuel ?) ou « L'effet d'un changement » (le changement décrit renforce-t-il ou affaiblit-il chaque motivation ?). Un prénom facultatif SHALL pouvoir être saisi.

#### Scenario: Sujet par défaut
- **GIVEN** une nouvelle séance
- **WHEN** l'utilisateur passe à l'étape suivante sans changer le sujet
- **THEN** la séance porte sur l'épanouissement aujourd'hui

### Requirement: Classer en piochant
L'étape 2 SHALL partir d'un tableau vide et d'une pioche mélangée. L'utilisateur pose les cartes une à une, de la moins importante (à gauche) à la plus importante (à droite), en les glissant ou en touchant un emplacement « + ». Une fois posées, les cartes SHALL se déplacer par glisser-déposer (souris et tactile), par les boutons ‹ › ou au clavier. L'étape suivante SHALL n'être accessible qu'une fois toutes les cartes posées.

#### Scenario: Pioche terminée
- **GIVEN** neuf cartes posées
- **WHEN** l'utilisateur pose la dixième
- **THEN** le classement final est établi et l'évaluation devient accessible

### Requirement: Évaluer chaque carte
L'étape 3 SHALL placer chaque carte sur 5 positions autour d'une ligne centrale : de « En manque » à « Épanoui » pour l'épanouissement (En manque, Un peu en manque, Correct, Plutôt bien, Épanoui), de « Nettement affaiblie » à « Nettement renforcée » pour un changement.

#### Scenario: Carte en manque
- **GIVEN** la carte Liberté sur la ligne « Correct »
- **WHEN** l'utilisateur la descend de deux crans
- **THEN** elle est « En manque » et ne peut pas descendre plus bas

### Requirement: Lire le tableau
L'étape 4 SHALL proposer des questions de débrief, puis faire ressortir trois groupes : les **priorités** (cartes de la moitié la plus importante du classement, sous la ligne, la plus urgente d'abord), les **points d'appui** (moitié la plus importante, au-dessus de la ligne) et **à surveiller** (moitié la moins importante, sous la ligne), avec des questions pour chaque carte. L'utilisateur SHALL pouvoir noter des actions (quoi, motivation liée, qui, quand) et des notes libres.

#### Scenario: Priorité
- **GIVEN** Maîtrise classée 9e sur 10 et « En manque »
- **WHEN** l'utilisateur arrive au débrief
- **THEN** Maîtrise apparaît dans les priorités

### Requirement: Séance en cours
La séance SHALL être mémorisée dans le navigateur au fil de l'exercice. Quand une séance est entamée, l'étape 1 SHALL proposer « Continuer la séance en cours » (retour à la dernière étape atteinte) ou « Commencer une nouvelle séance » (après confirmation, en gardant le prénom et le sujet saisis, et en ouvrant directement la pioche).

#### Scenario: Retour le lendemain
- **GIVEN** une séance arrêtée à l'étape 3
- **WHEN** l'utilisateur rouvre l'outil et choisit « Continuer la séance en cours »
- **THEN** il retrouve l'étape 3 avec son classement et ses positions

### Requirement: Téléphone
Sur un écran étroit, le classement SHALL devenir une pile verticale (la plus importante en haut) et l'évaluation un curseur horizontal (à droite : épanoui), sans défilement horizontal de la page.

#### Scenario: Classer sur téléphone
- **GIVEN** un téléphone de 360 px de large
- **WHEN** l'utilisateur classe ses cartes
- **THEN** elles s'empilent verticalement, la plus importante en haut
