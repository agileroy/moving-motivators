## Context

Outil existant, en service, développé sans OpenSpec. Les specs sont écrites a posteriori à partir du README et du code (`core.js`, `team-core.js`, `database.rules.json`), comme référence pour les prochains changements.

## Goals / Non-Goals

**Goals:**
- Décrire le comportement observable actuel, avec des scénarios vérifiables.
- Garder les chiffres et règles qui comptent (5 positions, moitié haute du classement, partage volontaire, clé d'animation).

**Non-Goals:**
- Corriger ou faire évoluer l'outil : tout écart constaté fera l'objet d'un changement à part.
- Décrire le détail visuel (couleurs, mise en page), hors exigences d'appareils.

## Decisions

- **Découpage par capacité visible** plutôt que par fichier : cartes, exercice seul, traces, séance d'équipe, publication.
- **Change d'adoption archivé aussitôt** : les specs de référence vivent dans `openspec/specs/`, comme dans les dépôts frères.
- **Outillage repris de `roti`** (`.claude/` et `openspec/config.yaml` du même schéma `spec-driven`).

## Risks / Trade-offs

- [Spec qui décrit mal un détail du code] → les specs restent prudentes sur les détails ; un écart découvert plus tard se corrige par un changement ciblé.

## Migration Plan

Aucune : documentation seule.

## Open Questions

_Aucune._
