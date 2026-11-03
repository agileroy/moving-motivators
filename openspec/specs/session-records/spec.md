# session-records Specification

## Purpose
Les traces d'une séance seule : compte rendu, impression, enregistrement et réouverture d'un fichier.

## Requirements

### Requirement: Compte rendu et impression
Au débrief, l'utilisateur SHALL pouvoir copier un compte rendu texte (sujet, classement avec les positions, priorités, points d'appui, à surveiller, actions, notes) et imprimer la séance ou l'enregistrer en PDF par l'impression du navigateur.

#### Scenario: Copier le compte rendu
- **GIVEN** une séance au débrief avec deux actions
- **WHEN** l'utilisateur copie le compte rendu
- **THEN** le texte contient le classement de la plus à la moins importante, les trois groupes et les deux actions

### Requirement: Enregistrer et reprendre une séance
« Enregistrer la séance » SHALL télécharger un fichier `.json` (format `moving-motivators`) contenant le sujet, le classement, les positions, les actions et les notes. Le lien « Reprendre une séance enregistrée », sous l'introduction de l'étape 1, SHALL rouvrir ce fichier. Un fichier invalide (autre format, classement incomplet) SHALL être refusé avec un message ; les textes trop longs et les valeurs hors bornes SHALL être ramenés à des valeurs acceptables.

#### Scenario: Comparer quelques mois plus tard
- **GIVEN** un fichier enregistré en juin
- **WHEN** l'utilisateur le rouvre en novembre
- **THEN** il retrouve le classement, les positions, les actions et les notes de juin

#### Scenario: Mauvais fichier
- **GIVEN** un fichier JSON qui n'a pas été produit par l'outil
- **WHEN** l'utilisateur tente de le rouvrir
- **THEN** l'outil refuse le fichier et garde la séance en cours intacte
