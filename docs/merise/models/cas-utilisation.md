---
title: Cas d’utilisation
project: ISI-Eco Report
version: 2.10
status: Parcours cible à valider avec le terrain
---

# Cas d’utilisation — ISI-Eco Report

## 1. But

Les cas d’utilisation ci-dessous décrivent les capacités nécessaires au modèle cible. Ils séparent la création d’une observation, la formation d’un dossier opérationnel, l’intervention et la confirmation de résolution.

## 2. Acteurs

- Citoyen / déclarant
- Agent de réception et qualification
- Responsable de traitement
- Responsable d’affectation
- Agent de terrain
- Vérificateur / responsable de clôture
- Gestionnaire de référentiel
- Administrateur des comptes
- Système

Les fonctions peuvent être cumulées selon le partenaire, mais les permissions restent explicites.


## 2.1 Gestion d’un signalement multi-catégories

Un signalement peut contenir plusieurs lignes `CONTENU_SIGNALEMENT`, une par catégorie déclarée. Lors de la qualification, le responsable ne transforme pas automatiquement toutes les déclarations en tâches : il confirme le périmètre puis alimente `CONTENU_DOSSIER` avec une ligne unique pour chaque catégorie retenue. Pour un même dépôt, plusieurs signalements peuvent être rattachés au même dossier ; une catégorie déjà qualifiée n'est pas dupliquée.

L'affectation se fait ensuite **une catégorie à la fois**. Si trois catégories sont incluses, trois affectations courantes peuvent coexister, chacune avec sa propre équipe, ses interventions et sa vérification. Si une catégorie reste non résolue, le dossier complet ne peut pas être déclaré `CLOS_RESOLUTION_CONFIRMEE`. Une catégorie retirée est conservée avec motif, date et acteur, mais ne peut plus être affectée.

## 3. Cas d’utilisation principaux

### UC01 — Soumettre une observation
**Acteur :** citoyen / déclarant.  
**Précondition :** parcours authentifié actif dans le modèle de base.  
**Scénario :** décrit la situation, fournit la localisation GPS ou un repère, indique si possible la date du constat, sélectionne une ou plusieurs catégories et ajoute éventuellement des photos ; le système crée une ligne `CONTENU_SIGNALEMENT` par catégorie déclarée. Le système enregistre l’auteur et l’heure de réception.  
**Résultat :** un `SIGNALEMENT` avec l’état `RECU` ou équivalent.  
**Exceptions :** localisation insuffisante, données manquantes, photo refusée ou connexion interrompue. Le mode hors connexion n’étant pas inclus, le système doit signaler clairement que l’envoi a échoué ; il ne doit pas afficher le signalement comme reçu. L’usager peut réessayer lorsque la connexion est rétablie.

### UC02 — Consulter le suivi d’une observation
**Acteur :** déclarant.  
**Scénario :** consulte la décision sur son observation, son éventuel rattachement à un dossier et les étapes visibles du traitement. Les détails personnels d’autres déclarants et les informations opérationnelles sensibles ne sont pas exposés.

### UC03 — Qualifier une observation
**Acteur :** agent habilité.  
**Scénario :** vérifie la complétude, le repère, les catégories, les photos et le périmètre. Il peut demander un complément, accepter l’observation pour rattachement, ou la rejeter avec un motif.  
**Résultat :** décision historisée par acteur et date.

### UC04 — Rapprocher des observations
**Acteur :** agent / responsable habilité.  
**Scénario :** examine si une nouvelle observation correspond à un dossier existant, enregistre un rattachement, ou crée un nouveau dossier si le processus le demande.  
**Résultat :** l’observation initiale reste inchangée et le rattachement est historisé. Toute correction ultérieure est réversible sans effacement de l’histoire.

### UC05 — Créer et qualifier un dossier
**Acteur :** responsable de traitement.  
**Scénario :** confirme qu’un cas est à traiter, qualifie l’emplacement et le contenu, conserve une seule ligne `CONTENU_DOSSIER` par catégorie retenue, puis définit un niveau de priorité.  
**Exception :** cas hors périmètre ou nécessitant une prise en charge spécialisée ; le dossier est transféré ou mis en attente selon la procédure définie.

### UC06 — Affecter une équipe à une catégorie
**Acteur :** responsable d'affectation.  
**Préconditions :** dossier pris en charge, localisation exploitable, responsable de traitement habilité, catégorie qualifiée et priorité définie.  
**Scénario :** sélectionne une seule catégorie du dossier, puis une équipe disposant d'une compétence valide correspondante. Le système conserve la compétence utilisée, le décideur, la date et le motif pertinent. La disponibilité est prise en compte si l'information existe. Une affectation courante déjà présente sur la même catégorie doit être terminée ou remplacée avant qu'une autre équipe ne soit affectée.  
**Résultat :** une affectation correspond à un dossier, une catégorie et une équipe. Si une même équipe doit traiter plusieurs catégories, plusieurs affectations sont créées et peuvent être corrélées. 

### UC07 — Exécuter et documenter une intervention
**Acteur :** agent de terrain.  
**Scénario :** consulte la mission, démarre l’intervention, documente les opérations réalisées, sélectionne un résultat contrôlé, saisit un compte rendu et joint si nécessaire des photos. Une visite impossible ou partielle est documentée comme telle, et non assimilée à une réussite complète.

### UC08 — Vérifier la résolution
**Acteur :** vérificateur / responsable de clôture.  
**Scénario :** examine le compte rendu de l’équipe et les éléments disponibles pour une affectation donnée, puis enregistre une décision confirmant, confirmant partiellement ou ne confirmant pas le résultat. La date, l’acteur et le motif sont conservés. Chaque vérification concerne une affectation et donc une seule catégorie. Le dossier est entièrement résolu uniquement lorsque toutes les catégories à traiter sont vérifiées positivement.

### UC09 — Clôturer ou rouvrir un dossier
**Acteur :** responsable habilité.  
**Scénario :** clôture selon les critères approuvés ou rouvre le dossier avec un motif. Les décisions antérieures restent consultables et les données de la nouvelle phase sont datées.

### UC10 — Administrer les référentiels
**Acteur :** gestionnaire de référentiel.  
**Scénario :** crée ou modifie les types de déchets, les équipes, leurs compétences par catégorie et les niveaux de priorité selon les autorisations. Les changements qui influencent les analyses historiques sont tracés.

### UC11 — Consulter les indicateurs
**Acteur :** responsable / décideur autorisé.  
**Scénario :** consulte les volumes d’observations et de dossiers, les affectations, les résultats vérifiés, les délais définis, les cas en attente, les doublons rapprochés et les réouvertures. Les définitions et périodes des indicateurs sont affichées ou documentées.

### UC12 — Consulter l’historique métier
**Acteur :** utilisateur habilité.  
**Scénario :** consulte la chronologie d’un dossier ou d’une action selon ses droits. Les événements sont ordonnés selon les dates effectives, dates d’enregistrement et un ordre stable ; les corrections tardives restent identifiables.

### UC13 — Gérer les comptes et les droits
**Acteur :** administrateur des comptes.  
**Scénario :** active, désactive ou attribue des rôles selon la politique d’accès. L’action est attribuée et journalisée. Elle ne confère pas automatiquement une responsabilité opérationnelle.

### Extension future — Points citoyens (hors périmètre initial)
La gestion des points citoyens n’est pas un cas d’utilisation du prototype initial. Si elle est réintroduite ultérieurement, elle devra faire l’objet d’un cas d’utilisation distinct, d’un barème approuvé et de règles anti-abus.

## 4. Parcours global proposé

```text
Observation citoyenne
        ↓
Réception et qualification
        ↓
Rapprochement avec un dossier existant OU création d’un dossier
        ↓
Responsable habilité et localisation exploitable
        ↓
Priorité et affectation individuelle par catégorie et compétence
        ↓
Une ou plusieurs interventions
        ↓
Vérification du résultat
        ↓
Clôture, nouvelle affectation, attente ou réouverture
```

## 5. Questions à résoudre lors des entretiens

- Les observations sont-elles actuellement regroupées par dépôt, site, tournée ou intervention ?
- La décision de validation est-elle séparée de la qualification et de l’affectation ?
- Qui a l’autorité de rapprocher des signalements, et comment corriger une erreur ?
- Le suivi citoyen expose-t-il un statut de dossier, un statut d’intervention ou les deux ?
- Quelles étapes existent dans les outils ou documents déjà utilisés ?
- Quel niveau de vérification est réaliste pour une résolution ?
- Quel est le comportement prévu lorsque l’application est hors ligne ou inaccessible ?
