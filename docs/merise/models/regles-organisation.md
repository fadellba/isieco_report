---
title: Règles d’organisation
project: ISI-Eco Report
version: 2.10
status: Répartition fonctionnelle proposée — à valider avec un acteur métier
---

# Règles d’organisation

Ces règles décrivent une répartition fonctionnelle possible dans le scénario académique. Elles ne décrivent pas l’organisation réelle d’un service avant enquête. Les intitulés de fonctions doivent être remplacés par les fonctions qui existent effectivement dans le territoire pilote. Le modèle de départ ne contient pas d’entité `ORGANISATION` ; les utilisateurs, rôles et équipes sont gérés directement dans ISI-Eco Report.

## 1. Principe

Les responsabilités doivent être réparties par tâche et non présumées à partir d’un seul rôle générique « Administrateur ». Une même personne peut cumuler plusieurs tâches dans un pilote limité si le partenaire l’autorise, mais chacune des actions reste attribuable et contrôlée.

## 2. Responsabilités fonctionnelles proposées

| Fonction | Responsabilités principales | Limites / contrôle |
|---|---|---|
| Déclarant citoyen | Soumettre une observation, joindre des preuves, consulter le suivi autorisé. | Ne modifie pas les décisions internes ni les rapports d’intervention. |
| Agent de réception/qualification | Vérifier la complétude, classifier, demander un complément, proposer ou effectuer un rattachement si autorisé. | Ne peut pas déclarer arbitrairement une intervention réalisée. |
| Responsable de traitement | Décider de l’acceptation opérationnelle, de la priorité et du circuit de prise en charge. | Décisions datées ; motifs exigés selon les règles approuvées. |
| Responsable d’affectation | Choisir une équipe compétente pour une catégorie précise, annuler ou réaffecter une affectation. | Une seule affectation courante par couple dossier/catégorie ; chaque affectation porte sur une seule catégorie. |
| Agent de terrain | Prendre en charge l’affectation, effectuer la visite, rédiger le résultat et joindre les preuves pertinentes. | N’accède qu’aux dossiers et informations nécessaires à la mission. |
| Vérificateur / responsable de clôture | Examiner le résultat, confirmer ou refuser la résolution, décider de la clôture ou de la réouverture selon son mandat. | Le compte rendu de l’équipe ne se transforme pas automatiquement en résolution confirmée. |
| Gestionnaire du référentiel | Maintenir les catégories de déchets, les équipes, les compétences par catégorie et les règles de priorité. | Les changements sont tracés ; les catégories sensibles nécessitent une validation métier. |
| Administrateur des comptes | Gérer les comptes et les droits d’accès. | La gestion des comptes ne donne pas automatiquement le droit de prendre les décisions opérationnelles. |
| Système | Enregistrer les transitions, assurer les contrôles de cohérence, calculer les indicateurs définis et envoyer les notifications prévues. | N’invente pas une décision métier manquante ; les automatisations sont auditées. |

## 3. Processus organisationnel cible

1. **Réception** : le système enregistre l’observation, l’auteur, la date de réception et les éléments disponibles.
2. **Qualification** : une personne habilitée vérifie la localisation, les catégories, la complétude et le périmètre de compétence.
3. **Rapprochement** : l’observation est rapprochée d’un dossier existant, rattachée à un dossier approprié, ou transmise pour décision. Une fusion erronée doit être corrigeable.
4. **Décision** : l’observation est acceptée pour traitement, rejetée ou renvoyée pour complément selon les états retenus.
5. **Priorisation et affectation** : un responsable habilité décide de la priorité, sélectionne une équipe compétente, puis crée l’affectation.
6. **Exécution** : l’équipe enregistre le départ, les opérations réalisées, les exceptions et la fin effective de chaque visite.
7. **Vérification** : le résultat est confirmé, partiellement confirmé ou non confirmé selon la règle approuvée.
8. **Clôture ou suite** : le dossier est clôturé, réaffecté, maintenu ouvert ou rouvert. La décision et son motif restent consultables.
9. **Analyse** : les indicateurs sont calculés à partir des événements et des définitions approuvées, sans assimiler nombre de signalements et nombre de problèmes résolus.

## 4. Contrôles de séparation des responsabilités

- La personne qui soumet une observation ne peut pas modifier la décision opérationnelle au seul motif qu’elle en est l’auteur.
- Un agent de terrain peut documenter le résultat de l’intervention, mais la confirmation finale reste soumise au processus de vérification adopté pour le service.
- Une personne habilitée à gérer les utilisateurs n’acquiert pas automatiquement le droit de modifier les résultats métier.
- Toute modification manuelle de priorité, d’équipe, de rattachement ou de clôture est associée à un acteur et à une raison lorsque cela affecte la décision.
- La consultation des données personnelles et de l’historique sensible doit être limitée au besoin fonctionnel.

## 5. Règles de localisation, de compétence et d’affectation

- Le modèle ne représente qu’un seul périmètre applicatif ; les utilisateurs, rôles et équipes sont gérés dans ISI-Eco Report sans entité d’organisation. Avant un déploiement réel, il faudra identifier les responsables et services compétents.
- La sélection d’une équipe prend en compte les catégories du dossier, les compétences valides et la disponibilité connue.
- Les coordonnées GPS aident à localiser le dépôt, mais elles ne déterminent pas automatiquement l’équipe ni la compétence institutionnelle.
- Les cas nécessitant une compétence non disponible sont mis en attente ou orientés selon une procédure de simulation explicite. Un transfert externe est tracé sur le dossier avec un événement et un libellé de destinataire ; aucune donnée interne du destinataire n’est gérée.
- L’affectation automatique n’est pas une exigence du pilote. Une affectation manuelle explicable est acceptable tant que les critères ne sont pas validés par des données d’exploitation.

## 6. Indicateurs à définir avant utilisation

| Indicateur proposé | Début | Fin | Précaution |
|---|---|---|---|
| Délai de première prise en charge | `dateSoumission` | Première décision/prise en compte validée | Définir si une simple consultation compte. |
| Délai de qualification | `dateSoumission` | Qualification complète | Les observations sans localisation peuvent rester en attente. |
| Délai d’affectation | Dossier éligible à l’affectation | Création de l’affectation | Ne pas démarrer avant que le dossier soit opérationnel. |
| Délai jusqu’à début d’intervention | Affectation | Première intervention commencée | Les annulations et réaffectations doivent être traitées explicitement. |
| Délai de résolution vérifiée | Création du dossier | Première vérification confirmée | Distinguer résolution partielle et confirmée. |
| Taux de doublons rapprochés | Observations qualifiées | Observations rattachées à un dossier existant | Définir la population de référence. |
| Taux de réouverture | Dossiers clôturés | Dossiers rouverts selon un motif défini | Une réapparition peut être un nouveau cas, pas toujours une erreur. |
| Taux de résultat non confirmé | Interventions déclarées terminées | Vérifications négatives ou partielles | Ne pas l’assimiler automatiquement à une faute de l’équipe. |

## 7. Questions à confirmer sur le terrain

1. Qui reçoit réellement les alertes et par quels canaux ?
2. Qui est habilité à qualifier, prioriser, affecter, vérifier et clôturer ?
3. Existe-t-il déjà des tournées ou missions planifiées auxquelles rattacher les dépôts ?
4. Quelles équipes sont compétentes pour chaque catégorie de déchets et comment leur disponibilité est-elle connue ?
5. Comment les cas incomplets, hors périmètre, non accessibles ou dangereux sont-ils orientés ?
6. Le citoyen est-il averti du rejet, du rattachement à un dossier et du résultat vérifié ?
7. Quelles informations peut-il voir sans exposer les données personnelles des équipes ou des autres citoyens ?
8. Quels indicateurs sont effectivement utilisés et quelles sources de dates permettent de les calculer ?

## Traitement d’un signalement multi-catégories

Une soumission citoyenne demeure un seul signalement, même si elle comporte plusieurs catégories. La qualification crée un périmètre opérationnel avec une ligne unique par catégorie retenue. Une affectation est créée séparément pour chaque catégorie, vers une équipe compétente ; une catégorie commune apportée par plusieurs signalements n’est pas dupliquée dans le dossier.
