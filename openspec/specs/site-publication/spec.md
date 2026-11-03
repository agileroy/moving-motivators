# site-publication Specification

## Purpose
Publication sur GitHub Pages, confidentialité de l'exercice seul, thème et projet Firebase dédié aux séances d'équipe.

## Requirements

### Requirement: Publication automatique
Le site SHALL être publié sur GitHub Pages (https://agileroy.github.io/moving-motivators/) à chaque push sur `main`, après les tests ; un test en échec MUST empêcher la publication.

#### Scenario: Test en échec
- **GIVEN** un push sur `main` qui casse un test
- **WHEN** le workflow s'exécute
- **THEN** ni les règles ni le site ne sont publiés

### Requirement: Confidentialité de l'exercice seul
L'exercice seul MUST NOT charger Firebase ni envoyer de donnée hors du navigateur. Seule la séance d'équipe SHALL utiliser Firebase Realtime Database, avec une connexion anonyme.

#### Scenario: Exercice seul
- **GIVEN** la page d'accueil, sans lien de séance d'équipe
- **WHEN** l'utilisateur fait l'exercice complet
- **THEN** aucune requête ne vise Firebase

### Requirement: Thème clair ou sombre
Le site SHALL fonctionner en thème clair et sombre, avec un bouton de bascule. Le choix SHALL être mémorisé sous la même clé que la boîte à outils, et donc partagé avec elle ; sans choix, le thème suit le réglage du système.

#### Scenario: Thème partagé
- **GIVEN** le thème sombre choisi dans la boîte à outils
- **WHEN** l'utilisateur ouvre Moving Motivators
- **THEN** l'outil s'affiche en thème sombre

### Requirement: Projet Firebase dédié
La séance d'équipe SHALL utiliser un projet Firebase propre à l'outil (`moving-motivators-vleroy`). `database.rules.json` SHALL ne contenir que la branche `movingMotivators`, tout le reste de la base étant fermé, et SHALL être publié automatiquement par GitHub Actions après les tests, avec le compte de service du secret `FIREBASE_SERVICE_ACCOUNT`, avant la publication du site.

#### Scenario: Fichier d'un autre outil recopié par erreur
- **GIVEN** un `database.rules.json` qui contient la branche d'un autre outil
- **WHEN** les tests s'exécutent
- **THEN** un test échoue et ni les règles ni le site ne sont publiés
