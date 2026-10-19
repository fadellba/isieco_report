---
title: Diagrammes du MCD — ISI-Eco Report
project: ISI-Eco Report
version: 2.8
status: Sources Mermaid des vues conceptuelles
---

# Diagrammes conceptuels

Ces diagrammes représentent les associations principales et leurs cardinalités dans le scénario académique. Ils sont complémentaires au texte détaillé de `mcd.md`. Le modèle logique avec les clés est décrit dans `mld.md`.

## 1. Observation, dossier et traitement

```mermaid
erDiagram
    UTILISATEUR ||--o{ SIGNALEMENT : soumet
    SIGNALEMENT ||--o{ PHOTO_SIGNALEMENT : comporte
    SIGNALEMENT ||--o{ CONTENU_SIGNALEMENT : declare
    TYPE_DECHET ||--o{ CONTENU_SIGNALEMENT : categorise
    SIGNALEMENT ||--o{ RATTACHEMENT_SIGNALEMENT : historise
    DOSSIER_TRAITEMENT ||--o{ RATTACHEMENT_SIGNALEMENT : reçoit
    UTILISATEUR ||--o{ DOSSIER_TRAITEMENT : cree
    DOSSIER_TRAITEMENT ||--o{ CONTENU_DOSSIER : qualifie
    TYPE_DECHET ||--o{ CONTENU_DOSSIER : classe
    CONTENU_DOSSIER ||--o{ AFFECTATION : reçoit
    AFFECTATION ||--o{ INTERVENTION : donne_lieu
    INTERVENTION ||--o{ PHOTO_INTERVENTION : comporte
    AFFECTATION ||--o{ VERIFICATION_RESOLUTION : est_verifiee
```

**Lecture :** une même observation peut avoir plusieurs rattachements successifs dans l'historique, mais un seul rattachement actif à la fois. Un dossier contient des catégories qualifiées. Chaque ligne `AFFECTATION` porte sur une seule ligne dossier/catégorie encore à traiter ; une catégorie retirée est conservée pour l’historique et n’accepte plus d’affectation courante. Plusieurs affectations historiques sont possibles pour une même catégorie, mais une seule est courante.

## 2. Rôles, équipes et compétences spécialisées

```mermaid
erDiagram
    UTILISATEUR ||--o{ UTILISATEUR_ROLE : reçoit
    ROLE ||--o{ UTILISATEUR_ROLE : est_attribue
    UTILISATEUR ||--o{ APPARTENANCE_EQUIPE : a_historique
    EQUIPE ||--o{ APPARTENANCE_EQUIPE : comprend
    EQUIPE ||--o{ COMPETENCE_EQUIPE : possede
    TYPE_DECHET ||--o{ COMPETENCE_EQUIPE : fait_objet
    COMPETENCE_EQUIPE ||--o{ AFFECTATION : justifie
    EQUIPE ||--o{ AFFECTATION : reçoit
```

**Lecture :** la relation `COMPETENCE_EQUIPE` est historisée. Une affectation référence la compétence exacte utilisée ; la validité de cette compétence à la date de l'affectation doit être vérifiée.

## 3. Journal de traçabilité

```mermaid
flowchart LR
    ACTEUR[Acteur ou origine système] --> EVENEMENT[EVENEMENT_METIER]
    EVENEMENT --> CIBLE[Une cible principale typée]
    EVENEMENT --> TEMPS[Date effective et date d'enregistrement]
    EVENEMENT --> AVANTAPRES[Valeurs avant/après et motif si utiles]
    EVENEMENT --> CORRELATION[Identifiant de corrélation]
    EVENEMENT --> CORRECTION[Référence éventuelle vers l'événement corrigé]
```

La cible principale est l'un des objets référencés par les colonnes typées de `EVENEMENT_METIER`. Exactement une cible doit être renseignée, la cible catégorie-dossier étant représentée par une paire de clés étrangères composée. Une correction crée une nouvelle trace ; elle ne réécrit pas l'événement original.

## 4. Règles qui ne se lisent pas uniquement sur le diagramme

- Un signalement n'est pas une intervention ; le lien entre le signalement et le dossier est historisé.
- Une affectation porte sur une seule catégorie et conserve la compétence d'équipe retenue.
- Une même catégorie d'un dossier ne peut avoir qu'une affectation courante à un instant donné.
- L'état `TERMINEE` d'une affectation suppose une vérification positive de sa catégorie.
- La clôture résolue du dossier dépend de toutes les catégories à traiter, non de la seule fin d'une intervention.
- Les contraintes de période, l'unicité conditionnelle des affectations courantes, la cible unique d'un événement et les contrôles de cohérence multi-tables sont précisées dans `mld.md`.
