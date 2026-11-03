# team-session Specification

## Purpose
La séance d'équipe animée : création, clé d'animation, partage volontaire des tableaux, vue d'équipe, conclusion et relecture d'un fichier.

## Requirements

### Requirement: Créer une séance d'équipe
Depuis `equipe.html` (lien « Animer une séance d'équipe » en pied de page), l'animateur SHALL créer une séance avec un nom, un sujet (épanouissement ou effet d'un changement) et un mode **nominatif** ou **anonyme**. Il obtient un lien participant et un QR code ; le sujet est imposé aux participants.

#### Scenario: Séance créée
- **GIVEN** la page d'animation
- **WHEN** l'animateur crée la séance « Rétro d'équipe », anonyme
- **THEN** la page affiche le lien participant, le QR code et un tableau d'équipe vide

### Requirement: Clé d'animation
Le lien d'animation SHALL porter une clé (`equipe.html?seance=…#cle=…`), gardée dans le navigateur de l'animateur, qui permet de rouvrir la séance depuis un autre appareil. Seuls les navigateurs qui présentent cette clé SHALL lire l'ensemble des tableaux ; la clé elle-même MUST NOT être lisible dans la base. L'animateur SHALL retrouver dans son navigateur la liste des séances qu'il anime.

#### Scenario: Lien participant transmis
- **GIVEN** un participant qui n'a que le lien participant
- **WHEN** son navigateur tente de lire les tableaux des autres
- **THEN** la base refuse la lecture

### Requirement: Partage volontaire
Un participant fait l'exercice sur son appareil ; à l'étape 4, il SHALL pouvoir **partager son tableau** (prénom en séance nominative, classement et positions), puis le **retirer** à tout moment. Tant qu'il est partagé, le tableau SHALL se mettre à jour quand il déplace une carte. Les actions et les notes du participant MUST NOT quitter son navigateur. En séance anonyme, la base MUST refuser tout prénom. Une séance fermée MUST refuser les nouveaux partages.

#### Scenario: Séance anonyme
- **GIVEN** une séance anonyme
- **WHEN** un participant partage son tableau
- **THEN** son classement et ses positions sont partagés sans aucun prénom

### Requirement: Tableau d'équipe
L'animateur SHALL voir en direct le tableau d'équipe : une colonne par carte, rangées par importance moyenne, un point par personne et la position moyenne. En séance nominative, il SHALL voir aussi chaque tableau individuel. Les moyennes SHALL être affichées à une décimale.

#### Scenario: Nouveau tableau partagé
- **GIVEN** la vue d'équipe ouverte avec deux tableaux partagés
- **WHEN** un troisième participant partage le sien
- **THEN** un point de plus apparaît dans chaque colonne et les moyennes sont recalculées

### Requirement: Lecture de l'équipe
La vue d'équipe SHALL proposer les questions de débrief d'équipe et faire ressortir ce qui compte le plus (les trois cartes les plus importantes en moyenne), les points d'attention (cartes classées par des participants dans leur moitié la plus importante et sous la ligne, avec le nombre de personnes concernées) et les points forts (cartes importantes en moyenne et plutôt nourries).

#### Scenario: Point d'attention
- **GIVEN** trois participants qui classent Liberté parmi leurs cinq cartes les plus importantes et sous la ligne
- **WHEN** l'animateur regarde la vue d'équipe
- **THEN** Liberté apparaît dans les points d'attention, avec trois personnes concernées

### Requirement: Animer et conclure
L'animateur SHALL pouvoir noter les actions et les notes du débrief d'équipe (gardées dans son navigateur, jamais dans la base), fermer la séance, copier une synthèse, imprimer le rapport, retirer un tableau et supprimer la séance. Les tableaux SHALL rester dans la base jusqu'à la suppression de la séance.

#### Scenario: Suppression après le débrief
- **GIVEN** une séance terminée
- **WHEN** l'animateur la supprime et confirme
- **THEN** la séance et tous les tableaux partagés sont effacés de la base

### Requirement: Enregistrer et relire une séance d'équipe
« Enregistrer la séance d'équipe » SHALL télécharger un fichier `.json` (format `moving-motivators-team` : fiche de la séance, tableaux partagés sans prénom en séance anonyme, actions et notes). Le lien « La revoir à partir du fichier » SHALL le rouvrir en lecture (vue d'équipe, lecture, tableaux individuels, actions et notes modifiables, impression, nouvel enregistrement) sans se connecter à Firebase.

#### Scenario: Relecture derrière le VPN
- **GIVEN** un fichier de séance d'équipe et un réseau qui bloque Firebase
- **WHEN** l'animateur rouvre le fichier
- **THEN** la vue d'équipe s'affiche, même si la séance a été supprimée de la base
