## ADDED Requirements

### Requirement: Dix motivations
L'outil SHALL proposer dix cartes : Curiosité, Honneur, Acceptation, Maîtrise, Pouvoir, Liberté, Relations, Ordre, But, Statut (`curiosity`, `honor`, `acceptance`, `mastery`, `power`, `freedom`, `relatedness`, `order`, `goal`, `status`). Chaque carte SHALL avoir un nom, un pictogramme, une définition et des exemples, consultables d'un clic.

#### Scenario: Détail d'une carte
- **GIVEN** une carte posée sur le tableau
- **WHEN** l'utilisateur clique dessus
- **THEN** sa définition et ses exemples s'affichent dans un panneau en bas de l'écran, sans bloquer le reste de la page

### Requirement: Contenu original
Les cartes, pictogrammes, définitions, exemples et questions SHALL être une création originale, inspirée de la pratique de Management 3.0 sans reprendre les cartes officielles. Le pied de page SHALL le rappeler, avec un lien vers la pratique.

#### Scenario: Mention des droits
- **GIVEN** une page de l'outil
- **WHEN** l'utilisateur lit le pied de page
- **THEN** il voit que les cartes sont une création originale et non les cartes officielles

### Requirement: Deux langues
Les textes de l'interface et des cartes SHALL exister en français et en anglais. La langue SHALL être le français par défaut, choisie par `?lang=en` ou par le sélecteur FR / EN, et mémorisée dans le navigateur.

#### Scenario: Lien en anglais
- **GIVEN** l'adresse `…/moving-motivators/?lang=en`
- **WHEN** la page s'ouvre
- **THEN** l'interface et les cartes sont en anglais, et le choix est retenu pour la visite suivante
