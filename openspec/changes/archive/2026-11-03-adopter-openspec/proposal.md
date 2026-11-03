## Why

Moving Motivators est le seul outil de la boîte à outils sans spécifications OpenSpec : son comportement n'est décrit que par le README et le code. Les évolutions des autres outils partent de leurs specs (`/opsx:propose`) ; celui-ci doit pouvoir faire de même.

## What Changes

- Configuration OpenSpec (`openspec/config.yaml`, contexte du projet) et commandes Claude Code `/opsx:*` dans `.claude/`, reprises des outils frères.
- Specs de référence décrivant le comportement **actuel** de l'outil, sans le modifier : cartes, exercice seul, traces de séance, séance d'équipe, publication.
- README : section « Méthode » sur OpenSpec.

Aucun changement de comportement ni de code applicatif.

## Capabilities

### New Capabilities

- `motivator-cards` : les dix cartes, leur contenu original et leurs deux langues.
- `solo-exercise` : l'exercice seul en quatre étapes (découvrir, classer, évaluer, débriefer), la lecture du tableau et la reprise d'une séance en cours.
- `session-records` : compte rendu, impression, enregistrement et réouverture d'une séance.
- `team-session` : séance d'équipe animée (création, partage volontaire des tableaux, vue d'équipe, fermeture, suppression, relecture d'un fichier).
- `site-publication` : publication, langues, thème, appareils, confidentialité et règles de la base.

### Modified Capabilities

_Aucune._

## Impact

- Ajoutés : `openspec/`, `.claude/` ; modifié : `README.md` (section « Méthode »).
