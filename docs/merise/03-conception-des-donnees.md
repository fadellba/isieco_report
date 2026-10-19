---
title: Chapitre 3 — Conception des données
project: ISI-Eco Report
chapter: 3
version: 2.8
methodology: Merise
status: Modèle proposé pour un scénario académique — limites et hypothèses explicites
---

# Chapitre 3 — Conception des données

## Introduction

La conception des données vise à représenter les informations nécessaires au fonctionnement d’ISI-Eco Report de façon compréhensible, cohérente et indépendante des choix techniques. Le modèle doit préserver la provenance des observations, organiser le traitement opérationnel et permettre de reconstituer les décisions et les résultats dans le temps.

La proposition v2.8 sépare le signalement (observation initiale), le dossier de traitement (cas opérationnel) et l’intervention (action terrain). Elle associe également les équipes aux catégories de déchets qu’elles sont compétentes à traiter. Ces choix sont des hypothèses de conception pour le scénario académique, et non des faits constatés auprès d’un service réel.


Un seul signalement peut déclarer plusieurs catégories. La qualification construit ensuite un dossier contenant une ligne par catégorie retenue, puis une affectation distincte pour chaque couple dossier/catégorie. Cette organisation permet à chaque équipe spécialisée de traiter sa catégorie sans multiplier artificiellement les signalements citoyens. Les résultats des différentes catégories sont suivis et vérifiés séparément ; la clôture globale dépend de leur état cumulé.

## 3.1 Démarche de modélisation

La conception suit les étapes suivantes :

1. recenser les données et leur finalité ;
2. décrire les entités et les associations dans le dictionnaire ;
3. définir les cardinalités et contraintes du MCD ;
4. traduire le modèle en relations logiques dans le MLD ;
5. vérifier la cohérence avec les règles métier, les cycles de vie, les autorisations et les événements historiques ;
6. tester le modèle avec des cas normaux et exceptionnels du terrain.

## 3.2 Dictionnaire de données — synthèse des entités

| Entité | Rôle métier | Données majeures | Points de vigilance |
|---|---|---|---|
| `UTILISATEUR` | Compte d’une personne | Identité minimale, contact nécessaire, état du compte, date d’inscription | Ne pas rendre l’adresse postale obligatoire sans besoin prouvé. |
| `ROLE` | Profil fonctionnel | Code et libellé | Ne remplace pas une matrice de permissions. |
| `UTILISATEUR_ROLE` | Attribution historisée d’un rôle | Utilisateur, rôle, dates, auteur d’attribution | Cumul de rôles à valider. |
| `TYPE_DECHET` | Catégorie normalisée | Code, libellé, description, indicateur d’orientation spécialisée | Définir les catégories et les circuits de transfert. |
| `EQUIPE` | Unité d’intervention | Nom, description, état | Une équipe n’est pas présumée disponible ou habilitée à tout traiter. |
| `APPARTENANCE_EQUIPE` | Historique de la composition | Agent, équipe, début, fin, fonction | Conserver les mouvements d’équipe. |
| `COMPETENCE_EQUIPE` | Compétences spécialisées de l’équipe | Équipe, type de déchet, dates de validité, validateur éventuel | Une compétence est distincte de la disponibilité effective. |
| `SIGNALEMENT` | Observation citoyenne originale | Auteur, date du constat, date de soumission, description, localisation déclarée, état de qualification | Préserver auteur et provenance. |
| `PHOTO_SIGNALEMENT` | Pièce jointe à une observation | Référence, date, description | Politique de conservation et de visibilité à fixer. |
| `CONTENU_SIGNALEMENT` | Catégorie déclarée d’un signalement | Type, estimations, remarque | Ne pas confondre l’estimation du citoyen et la qualification opérationnelle ; une seule ligne par type dans un signalement, plusieurs catégories sont possibles. |
| `DOSSIER_TRAITEMENT` | Cas opérationnel à traiter | Référence, état, priorité, localisation qualifiée, état, priorité, dates | Peut regrouper plusieurs observations. |
| `RATTACHEMENT_SIGNALEMENT` | Historique d’association observation/dossier | Signalement, dossier, période, type, acteur, motif | Une seule liaison active par observation. |
| `CONTENU_DOSSIER` | Qualification d’une catégorie dans un dossier | Type, quantités estimées, risque, état `INCLUSE` ou `RETIRE`, dates et acteurs | Une catégorie retirée est conservée si elle porte un historique et ne peut plus être affectée. |
| `AFFECTATION` | Décision de confier une catégorie précise d’un dossier à une équipe | Dossier, catégorie, équipe, compétence retenue, date, décideur, état, motif | Une affectation par couple dossier/catégorie ; vérification et réaffectation indépendantes. |
| `INTERVENTION` | Visite ou action terrain | Affectation, début, fin, état, résultat, compte rendu, exception | Plusieurs visites possibles pour une affectation. |
| `PHOTO_INTERVENTION` | Preuve facultative de l’action | Intervention, référence, contexte, date | Photo seule ne prouve pas la résolution. |
| `VERIFICATION_RESOLUTION` | Décision sur le résultat d’une affectation | Affectation, vérificateur, date, résultat, motif, référence de preuve | Séparer déclaration de l’équipe et confirmation pour chaque catégorie attribuée. |
| `EVENEMENT_METIER` | Journal des changements significatifs | Type, dates, origine, acteur, cible typée, valeurs utiles, motif, corrélation | Pas de cible orpheline ni de secret dans les valeurs. |

Les types, tailles exactes et valeurs contrôlées doivent être définis au niveau du dictionnaire métier, puis adaptés à la technologie retenue dans une documentation séparée. Ce document ne prescrit aucun type physique propre à un produit.

## 3.3 Modèle Conceptuel de Données (MCD)

Le MCD complet et ses cardinalités sont présentés dans `models/mcd.md`. Les associations centrales sont :

- un utilisateur peut émettre plusieurs signalements, chaque signalement conservant un auteur d’origine ;
- un signalement peut être rattaché à aucun ou à un dossier actif, et un dossier peut recevoir plusieurs observations ; l’historique des rattachements est conservé ;
- un dossier conserve des coordonnées GPS ou une description de localisation ; les responsabilités sont exprimées par les décisions attribuées aux utilisateurs habilités, sans entité `ORGANISATION` dans le périmètre initial ;
- une ou plusieurs équipes peuvent être affectées à un dossier pour des catégories distinctes ; chaque affectation concerne exactement une catégorie et une même catégorie ne peut avoir qu’une seule affectation courante à la fois ;
- une affectation peut produire plusieurs interventions ;
- chaque affectation traite une seule catégorie et peut faire l’objet de plusieurs vérifications historisées ;
- les événements métier se rapportent à une cible principale typée et existante.

### Justification de la séparation observation/dossier

Un signalement correspond à l’information initialement transmise par une personne. Le dossier représente la prise en charge opérationnelle. Lorsqu’un même dépôt est signalé plusieurs fois, les contributions initiales peuvent être rattachées au même dossier au lieu de créer mécaniquement plusieurs missions. Si l’enquête démontre que le processus réel ne nécessite pas cette séparation, le modèle pourra être simplifié, mais le traitement des doublons restera obligatoire.

### Distinction des cycles

Le statut du signalement indique où en est l’observation dans la réception et la qualification. Le statut du dossier indique où en est le traitement dans le scénario. Le statut de l’intervention décrit l’action de terrain. La vérification décrit le niveau de confirmation du résultat. Ces notions ne doivent pas être regroupées dans un même champ de statut.

## 3.4 Modèle Logique de Données (MLD)

Le schéma relationnel logique complet figure dans `models/mld.md`. Il décrit les clés primaires, les clés étrangères, les valeurs facultatives et les contraintes nécessaires, dont :

- conservation des périodes historiques de rôles, d’appartenance et de rattachement ;
- interdiction de plusieurs rattachements actifs pour une même observation ;
- interdiction de plusieurs affectations actives pour une même catégorie d’un dossier ;
- vérification que l’équipe et la compétence historisée correspondent à la catégorie unique de l’affectation ;
- cohérence de la date de début et de fin ;
- compte rendu requis avant de déclarer une intervention terminée ;
- enregistrement séparé de la fin d’intervention et de la vérification de résolution ;
- référence typée vers exactement une cible principale d’un événement, avec lien éventuel vers l’événement corrigé ;
- enregistrement cohérent du changement métier et de son événement ;
- exclusion des fonctionnalités de récompense du flux opérationnel initial.

Le MLD reste logique. Le choix d’un stockage, d’un format de pièce jointe ou d’un mécanisme physique de journal doit être documenté séparément et ne peut annuler silencieusement les contraintes métier. Le scénario initial ne modélise pas un référentiel `ZONE` : les coordonnées servent à la localisation sur carte, pas au calcul automatique d’une compétence territoriale. Les points citoyens sont hors du modèle initial.

## 3.5 Protection des données et gouvernance

La conception distingue les données nécessaires au traitement des éléments facultatifs. L’adresse postale complète du citoyen n’est pas exigée sans besoin démontré ; les informations de contact doivent être limitées au nécessaire. Les photographies et coordonnées de lieu peuvent être sensibles selon ce qu’elles révèlent. Il faut définir les finalités, les catégories d’utilisateurs autorisés, les durées de conservation, les règles de masquage, les procédures de correction et les réponses aux demandes des personnes.

La politique d’historique ne signifie pas conservation illimitée de toutes les données. Les durées et formalités applicables doivent être vérifiées auprès des personnes compétentes avant un pilote réel.

## 3.6 Critères de validation

Le modèle est acceptable pour la suite du projet lorsque :

- chaque entité est rattachée à un besoin métier réel ;
- chaque cardinalité est justifiée par une règle de gestion ;
- les signalements en doublon n’entraînent pas automatiquement plusieurs missions ;
- les transitions, exceptions et réouvertures sont définies ;
- les questions historiques prioritaires peuvent être répondues à partir des événements conservés ;
- les références des événements sont intègres et vérifiables ;
- les données personnelles et les durées de conservation sont gouvernées ;
- les scénarios de test sont validés avec un acteur métier.

## Conclusion du chapitre

La conception proposée fournit une base cohérente pour organiser l’observation citoyenne, les dossiers opérationnels, les affectations, les interventions et l’historique. Elle doit néanmoins être confrontée à des cas réels avant de devenir le modèle définitif. La qualité du système dépendra autant de la validation des règles métier et de la gouvernance que de la structure des données.

## Diagrammes UML associés

Les fichiers `uml-diagrams/context-diagram.md`, `uml-diagrams/uc-diagram.md` et `uml-diagrams/class-diagram.md` décrivent la frontière du système, les cas d’utilisation par acteur et les classes métier. Ils complètent les vues MCD/MLD sans remplacer les définitions relationnelles du modèle de données.
