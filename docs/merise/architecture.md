---
title: Architecture métier d’ISI-Eco Report
project: ISI-Eco Report
version: 2.10
type: Domain model
status: Proposition métier à valider
---

# Architecture métier d’ISI-Eco Report

## 1. Finalité

ISI-Eco Report vise à structurer l’information relative aux dépôts de déchets : réception d’observations, qualification, rapprochement, traitement opérationnel, interventions, vérification des résultats et exploitation des données. Le modèle est indépendant de toute technologie.

Le projet ne doit pas être présenté comme la première solution numérique de signalement au Sénégal. SetalMa, opérée par la SONAGED, est publiquement annoncée comme plateforme d’alerte citoyenne. Une comparaison opérationnelle approfondie n’étant pas réalisée, ISI-Eco Report est présenté comme une proposition de conception centrée sur le traitement structuré, l’affectation par compétence et la traçabilité, sans prétendre à une supériorité fonctionnelle démontrée.

## 2. Objets métier

- **Observation / signalement** : ce qu’une personne a déclaré voir à un moment donné.
- **Dossier de traitement** : cas opérationnel qu’un responsable habilité décide de prendre en charge dans le périmètre fonctionnel du système.
- **Rattachement** : relation historisée permettant de relier une ou plusieurs observations à un dossier.
- **Affectation** : décision de confier une catégorie précise d’un dossier à une équipe et de conserver la compétence qui justifie la décision.
- **Intervention** : visite ou action effectivement réalisée dans le cadre d’une affectation.
- **Vérification de résolution** : décision distincte sur la réalité du résultat annoncé.
- **Événement métier** : trace d’une création, décision ou transition significative.

Ces distinctions constituent la proposition de conception v2.8 pour une simulation académique ; elles ne doivent pas être présentées comme le processus observé d’un organisme réel.

## 3. Acteurs fonctionnels

Le modèle distingue les fonctions de déclarant, de qualification, de décision de traitement, d’affectation, d’exécution terrain, de vérification, de gestion des référentiels et d’administration des comptes. Ces fonctions peuvent être cumulées par une même personne dans un petit pilote si l’organisme le permet, mais les droits sont définis séparément.

## 4. Processus principal

```text
Citoyen transmet une observation
             ↓
Réception et qualification
             ↓
Rapprocher de dossier existant OU créer un dossier
             ↓
Valider la prise en charge et localiser le cas
             ↓
Définir la priorité puis affecter une équipe
             ↓
Exécuter une ou plusieurs interventions
             ↓
Vérifier le résultat
             ↓
Clôturer, maintenir ouvert, transférer ou réouvrir
```

Le processus n’est pas nécessairement linéaire : une information peut être demandée, une mission peut échouer, une affectation peut être remplacée et un dossier peut être rouvert. Chaque exception produit une trace justifiée.

## 5. Principes de fonctionnement

### 5.1 L’observation ne vaut pas mission

La soumission d’un signalement ne crée pas automatiquement une affectation. Il doit d’abord être qualifié et rapproché ou transformé en dossier selon les règles de gestion du scénario.

### 5.2 Les doublons sont rapprochés, pas effacés

Plusieurs citoyens peuvent signaler le même dépôt. Le système doit conserver chaque observation d’origine tout en permettant de regrouper les observations liées au même cas. Les rapprochements erronés sont corrigibles avec historique.

### 5.3 L’affectation est un acte de décision

L’affectation indique qui est responsable de la mission pour une période. Elle doit conserver l’auteur de la décision, l’équipe, l’horodatage, le motif pertinent et l’historique des remplacements.

### 5.4 Le résultat déclaré n’est pas une preuve suffisante

Une équipe renseigne ce qu’elle a fait et le résultat constaté. La vérification de résolution se déroule selon les critères autorisés par le partenaire. Une photo peut aider mais ne suffit pas, à elle seule, à prouver que le dépôt a disparu.

### 5.5 L’historique est utile et gouverné

Le journal métier rend les décisions reconstituables, mais il ne peut reconstituer que les faits enregistrés. Le journal métier est distinct des notifications et des journaux techniques/sécurité. La conservation des données personnelles n’est pas automatiquement illimitée.

## 6. Capacités métier

| Domaine | Capacités prévues |
|---|---|
| Réception | Soumission, horodatage, localisation flexible, pièces facultatives. |
| Qualification | Contrôle de complétude, classification, complément, décision. |
| Rapprochement | Détection assistée, rattachement à un dossier, correction historisée. |
| Traitement | Décision de prise en charge, priorité, suivi du dossier. |
| Affectation | Choix d’équipe compétente, annulation, réaffectation. |
| Intervention | Démarrage, compte rendu, résultat, exception, photos selon la règle. |
| Vérification | Résolution confirmée, partielle ou non confirmée. |
| Analyse | Volumes et délais définis, réaffectations, doublons, résultats, réouvertures. |
| Traçabilité | Événements typés, acteur, date effective, date d’enregistrement et motif. |
| Gouvernance | Droits, finalités, durée de conservation et contrôle d’accès. |

## 7. Principes du modèle de données

- Les entités représentent des notions métier stables.
- Les statuts appartiennent à l’objet dont ils décrivent le cycle : signalement, dossier, affectation ou intervention.
- Les catégories et statuts sont des référentiels définis, et non des textes libres non maîtrisés.
- Les associations temporelles possèdent des dates de début/fin et conservent le passé.
- Le journal d’événements est ajouté de manière cohérente avec les opérations métier.
- Les données personnelles et photos sont minimisées selon leur finalité.

Le MCD, le MLD et les règles détaillées constituent les documents de référence. Tout changement doit être répercuté sur l’ensemble de la base.

## 8. Limites et dépendances organisationnelles

La plateforme ne garantit pas, par elle-même, la présence d’équipes, de véhicules, de financements ou de moyens pour intervenir. Le périmètre initial est limité à un seul contexte applicatif ; aucune entité `ORGANISATION` n’est modélisée. Les responsabilités sont attribuées aux utilisateurs par rôle et les équipes sont gérées directement. L’affectation reste manuelle et contrôlée ; les points citoyens suivent le barème DC-29, tandis que le mode complet hors connexion reste hors périmètre initial. Le fonctionnement réel des services et l’existence d’une coopération institutionnelle ne sont pas présumés.
