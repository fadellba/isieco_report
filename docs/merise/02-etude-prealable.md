---
title: Chapitre 2 — Étude préalable
project: ISI-Eco Report
chapter: 2
version: 2.10
methodology: Merise
status: Étude documentaire et hypothèses à valider sur le terrain
---

# Chapitre 2 — Étude préalable

## Introduction

L’étude préalable rassemble les informations publiques disponibles et définit les hypothèses métier nécessaires à une conception académique. La vision cible couvre le Sénégal et Dakar est le territoire de démonstration du PFE, décision confirmée le 14 octobre 2026. ISI-Eco Report est fictif ; aucun partenaire opérationnel n’est identifié. Le scénario utilise des données de démonstration clairement fictives. L’étude terrain approfondie et la comparaison opérationnelle détaillée ne sont pas considérées comme réalisées.

## 2.1 Analyse de l’existant

### 2.1.1 Éléments publics connus

Le cadre sénégalais attribue des responsabilités à différents acteurs. Le Code de l’environnement (loi n° 2023-15) prévoit notamment que les collectivités territoriales et leurs groupements assurent la gestion des déchets ménagers et assimilés, éventuellement avec des services de l’État ou des organismes agréés (article 85), et qu’elles veillent à enrayer les dépôts sauvages (article 92). Cette base juridique ne suffit toutefois pas à identifier l’organisme opérationnel précis du territoire choisi.

La SONAGED présente publiquement SetalMa comme une plateforme d’alerte citoyenne pour des situations liées aux déchets, avec prise en charge annoncée par des équipes habilitées. Sa fiche publique ne permet pas à elle seule de mesurer son taux d’usage local, ses délais réels, sa couverture, son processus interne ni ses résultats. Ces éléments exigent des tests, des entretiens et, si possible, des exemples anonymisés.

Selon l’ANSD, 62,3 % des personnes de 10 ans ou plus avaient accès à Internet en 2024 ; le taux publié diffère selon le milieu, avec 79,4 % en milieu urbain et 41,3 % en milieu rural. Ces données nationales soulignent le besoin d’évaluer l’accès réel, mais ne décrivent pas automatiquement le territoire pilote.

### 2.1.2 Points à vérifier ultérieurement dans un contexte réel

| Domaine | Questions d’enquête | Preuves utiles |
|---|---|---|
| Canaux d’alerte | Qui reçoit les alertes et par quels canaux ? | Procédures, formulaire, registre ou exemples anonymisés. |
| Responsabilités opérationnelles | Quel service reçoit et traite les signalements dans le périmètre choisi ? | Procédures publiques, entretiens ou accord avec l’acteur concerné. |
| Qualification | Quelles données sont requises avant d’accepter l’alerte ? | Formulaires, décisions réelles et cas incomplets. |
| Doublons | Comment plusieurs alertes d’un même dépôt sont-elles rapprochées ? | Exemples de cas répétés ou de missions dupliquées. |
| Priorité | Quels critères déterminent l’urgence ? | Guide, grille ou règles utilisées par les agents. |
| Affectation | Qui choisit l’équipe et en fonction de quoi ? | Registre de missions, entretiens avec le responsable. |
| Intervention | Quels résultats et exceptions sont enregistrés ? | Compte rendu, tournée, preuves ou procédure. |
| Vérification | Qui confirme qu’un dépôt a été traité ? | Critères, contrôle terrain ou décision de clôture. |
| Outils existants | Quels outils sont réellement utilisés et quelles étapes du parcours sont visibles ? | Sources publiques, test accessible ou démonstration si elle peut être obtenue. |
| Accès numérique | Quelle connexion et quel équipement ont les usagers ? | Tests sur place et retours de profils différents. |
| Données personnelles | Quels champs sont indispensables, qui les voit et combien de temps ? | Notice, procédure interne et validation des responsables. |

### 2.1.3 Hypothèses à ne pas traiter comme des faits

Il n’est pas établi que tous les signalements actuels soient dispersés, que les agents n’aient aucun outil, que chaque dépôt puisse être résolu par une équipe ordinaire ou que tous les citoyens disposent d’un smartphone et d’une connexion fiable. Ces idées sont des hypothèses à examiner dans le cadre du projet.

### 2.1.4 Besoin cible proposé

Sous réserve de confirmation, le système pourrait apporter une vue structurée sur les observations citoyennes, le rapprochement de doublons, la décision de prise en charge, les affectations, le résultat des interventions et l’historique. Le choix final doit tenir compte de ce qui existe déjà et éviter une duplication inutile.

## 2.2 Identification des acteurs

Les fonctions nécessaires au modèle cible sont :

| Fonction | Apport / responsabilité | Point à confirmer |
|---|---|---|
| Citoyen / déclarant | Transmet une observation et consulte son suivi autorisé. | Compte obligatoire ou parcours sans compte. |
| Réception/qualification | Contrôle les informations et décide ou prépare leur traitement. | Poste et mandat réellement existants. |
| Responsable de traitement | Décide de l’acceptation opérationnelle et de la priorité. | Critères et autorité décisionnelle. |
| Responsable d’affectation | Confie le dossier à une équipe et gère les réaffectations. | Ressources disponibles et procédure. |
| Agent de terrain | Exécute et documente les interventions. | Résultats et preuves réellement exigés. |
| Vérificateur / clôture | Confirme le résultat ou décide d’une suite. | Vérification distincte ou combinée à la fin d’intervention. |
| Gestionnaire des référentiels | Maintient les types de déchets, les équipes, leurs compétences par catégorie et les priorités. | Propriétaire de chaque référentiel. |
| Administrateur des comptes | Gère les comptes et droits. | Séparation des fonctions. |
| Système | Enregistre, contrôle et analyse les données. | Automatisations permises par les règles. |

Une fonction peut être assumée par la même personne dans un petit pilote si cette organisation est approuvée. La matrice des permissions reste explicite.

## 2.3 Processus métier cible proposé

### Processus 1 — Réception et qualification

1. Le déclarant transmet une observation.
2. Le système conserve la date de réception, l’auteur et les informations reçues.
3. Une personne habilitée vérifie la complétude, le repère et la catégorie.
4. L’observation est acceptée pour rattachement, renvoyée pour complément ou rejetée avec motif selon la procédure.

### Processus 2 — Rapprochement et création d’un dossier

1. L’agent cherche si une observation décrit une situation déjà connue.
2. Si oui, il crée un rattachement historisé au dossier existant.
3. Sinon, un nouveau dossier est créé si le cas relève du service.
4. Un rapprochement incorrect peut être terminé et corrigé sans effacer les observations initiales.

### Processus 3 — Qualification opérationnelle et affectation

1. Le responsable confirme que la situation relève du périmètre du scénario et que la localisation est exploitable.
2. Il qualifie les déchets et les risques selon un référentiel défini.
3. Il définit une priorité explicable.
4. Il sélectionne une équipe possédant une compétence valide pour chaque catégorie qui lui est confiée, en tenant compte de sa disponibilité lorsque cette information est connue.
5. Si la situation exige un service spécialisé situé hors du périmètre, le dossier est mis en attente ou marqué comme transféré. L’événement conserve le nom du destinataire, la date, l’acteur et le motif ; le modèle ne gère pas le destinataire comme une entité ni son traitement interne.
6. Une réaffectation termine ou remplace l’affectation courante d’une catégorie et conserve les deux décisions. Si plusieurs catégories changent d’équipe, une affectation distincte est créée pour chacune.

### Processus 4 — Intervention et vérification

1. L’équipe démarre et documente l’intervention.
2. Elle saisit un compte rendu et le résultat : complet, partiel, impossible, reporté ou autre valeur approuvée.
3. Une vérification distincte confirme ou ne confirme pas la résolution selon les critères du partenaire.
4. Le dossier est clôturé, maintenu ouvert, réorienté ou rouvert avec trace.

### Processus 5 — Analyse et historique

Les indicateurs sont produits à partir de dates et événements définis. Les observations reçues, les dossiers créés, les affectations, les interventions et les résolutions confirmées sont comptés séparément.

## 2.4 Documents et données manipulés

| Donnée / document | Producteur principal | Utilisation |
|---|---|---|
| Observation de signalement | Citoyen / déclarant | Décrire un fait observé. |
| Décision de qualification | Agent ou responsable habilité | Établir la recevabilité et les corrections. |
| Rattachement à un dossier | Agent habilité | Regrouper les observations du même cas. |
| Dossier opérationnel | Responsable de traitement | Centraliser la prise en charge d’une situation. |
| Affectation | Responsable d’affectation | Formaliser l’équipe chargée du dossier. |
| Compte rendu d’intervention | Agent de terrain | Décrire l’action et ses résultats. |
| Photo d’observation / intervention | Déclarant / agent | Illustration éventuelle, soumise à la politique de conservation. |
| Vérification de résolution | Vérificateur autorisé | Confirmer ou non le résultat déclaré. |
| Événement métier | Système au moment de l’action | Reconstituer le changement et son auteur. |
| Indicateur statistique | Système | Piloter les délais et résultats selon une définition publiée. |

## 2.5 Événements déclencheurs

Les événements déclencheurs les plus importants sont la réception d’une observation, une demande de complément, une décision de qualification, un rattachement ou sa correction, la création d’un dossier, la modification de priorité, l’affectation, le démarrage/achèvement d’une intervention, la vérification du résultat, la clôture ou réouverture et le transfert vers un autre service.

Chaque événement doit être distingué de la notification qui peut être envoyée à la suite. L’envoi d’une notification ne prouve pas que son destinataire l’a lue ou qu’une action terrain a eu lieu.

## 2.6 Règles de gestion

Les règles cibles détaillées sont rassemblées dans `models/regles-gestion.md`. Elles couvrent les comptes et rôles, les observations, les doublons, les dossiers, les catégories de déchets, les compétences d’équipes, les affectations individuelles par catégorie, les interventions, les vérifications, la traçabilité et la minimisation des données.

## 2.7 Règles d’organisation

Les responsabilités proposées et les contrôles de séparation sont détaillés dans `models/regles-organisation.md`. L’organisation réelle devra préciser le responsable du territoire, les personnes habilitées, les ressources opérationnelles, les circuits spécialisés et les délais cibles.

## 2.8 Modèle Conceptuel de la Communication (MCC) — résumé

| Flux | Source | Destination | Contenu | Contrôle |
|---|---|---|---|---|
| F1 | Citoyen | Système | Observation, localisation, photos facultatives | Données minimales et confirmation de réception. |
| F2 | Système | Citoyen | Confirmation, demande de complément, statut visible | Ne pas exposer les données d’autres utilisateurs. |
| F3 | Système / responsable | Équipe | Dossier, emplacement, priorité, consignes | Accès seulement à l’équipe autorisée. |
| F4 | Équipe | Système | Début/fin, compte rendu, résultat, preuve éventuelle | Acteur et horodatage fiables. |
| F5 | Vérificateur | Système | Résultat de vérification, motif, décision | Habilitation et historique. |
| F6 | Système | Responsable | Indicateurs et listes de dossiers | Formules, périodes et exclusions définies. |
| F7 | Système / gestionnaire habilité | Service ou équipe concernée | Transfert d’un dossier hors périmètre | Destinataire, date et suite conservés. |

## 2.9 Modèle Conceptuel des Traitements (MCT) — résumé

### MCT 1 — Recevoir et qualifier l’observation

**Déclencheur :** soumission d’une observation.  
**Opération :** enregistrer, vérifier la complétude et le lieu, classifier puis décider.  
**Résultats :** acceptée pour rattachement, demande de complément ou rejet tracé.

### MCT 2 — Rattacher ou créer le dossier

**Déclencheur :** observation qualifiée.  
**Opération :** rechercher un dossier existant, évaluer le rapprochement et créer un lien historisé ou un nouveau dossier.  
**Résultats :** observation rattachée, dossier créé, ou dossier en attente de qualification.

### MCT 3 — Prioriser et affecter

**Déclencheur :** dossier exploitable et relevant du périmètre de prise en charge.  
**Opération :** appliquer les critères de priorité, sélectionner une équipe compétente et créer l’affectation.  
**Résultats :** affectation active, attente motivée ou transfert.

### MCT 4 — Exécuter et vérifier

**Déclencheur :** équipe affectée.  
**Opération :** réaliser une ou plusieurs interventions, documenter les exceptions, vérifier le résultat et décider de la suite.  
**Résultats :** résolution confirmée, traitement partiel, intervention à reprendre, dossier clôturé selon règle ou réouvert.

## 2.10 Indicateurs proposés

Avant usage dans un mémoire ou un tableau de bord, chaque indicateur doit avoir une définition.

- Délai de première prise en compte : réception jusqu’à première prise en charge définie.
- Délai de qualification : réception jusqu’à qualification complète.
- Délai d’affectation : dossier éligible jusqu’à création d’affectation.
- Délai de résolution vérifiée : création de dossier jusqu’à première vérification confirmée.
- Taux d’observations rapprochées : observations reliées à un dossier existant sur la population qualifiée définie.
- Taux de réouverture : dossiers rouverts parmi les dossiers clôturés sur une période définie.
- Taux de résultats non confirmés : interventions terminées dont la vérification est partielle ou négative.
- Nombre de dossiers en attente, transférés ou sans suite, avec motifs contrôlés.

Le nombre de signalements ne doit pas être utilisé seul comme indicateur de réussite ou d’échec d’un service.

## Conclusion du chapitre

L’étude préalable établit un modèle cible pour un projet académique. Faute d’une étude comparative approfondie, le mémoire doit se limiter à des constats documentaires : des outils de signalement existent, mais leurs processus internes, leurs résultats réels et leurs limites ne sont pas établis ici. Cette limite doit être explicitée ; elle n’empêche pas de présenter une conception hypothétique cohérente. Les décisions opérationnelles devront être validées avant toute mise en service réelle.
