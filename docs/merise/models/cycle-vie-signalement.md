---
title: Cycles de vie du signalement, du dossier, de l'affectation et de l'intervention
project: ISI-Eco Report
version: 2.11
status: Cycles implémentés pour le scénario académique — validation opérationnelle requise
---

# Cycles de vie — version 2.11

Quatre cycles sont distincts : le signalement, le dossier opérationnel, l'affectation d'une catégorie à une équipe, et l'intervention. La vérification est historisée séparément. Le statut du dossier est une synthèse du travail sur toutes ses catégories ; ce n'est pas un remplacement des cycles détaillés.

## 1. Cycle du signalement

États persistés (valeurs partagées/SQL) :

- `BROUILLON` : état admis en base pour un signalement incomplet ; aucun parcours API de brouillon n’est exposé.
- `SOUMIS` : l'observation a été reçue par le système.
- `EN_COURS_DE_QUALIFICATION` : l'examen métier a commencé.
- `A_COMPLETER` : une information supplémentaire a été demandée.
- `ACCEPTE_POUR_RATTACHEMENT` : le signalement est recevable pour un dossier.
- `RATTACHE` : un rattachement actif à un dossier existe.
- `REJETE` : observation refusée pour le traitement, avec motif selon la règle.

`ACCEPTE_POUR_RATTACHEMENT` et `RATTACHE` sont deux états distincts et ne sont pas synonymes :

- `ACCEPTE_POUR_RATTACHEMENT` signifie que la qualification a abouti à une décision positive, mais qu'aucune relation active `RATTACHEMENT_SIGNALEMENT` n'est encore enregistrée.
- `RATTACHE` signifie qu'une relation active vers un `DOSSIER_TRAITEMENT` existe effectivement et que le signalement en conserve l'historique.

La transition vers `RATTACHE` n'est validée qu'après l'écriture cohérente de la relation et de l'événement métier associé. Si une relation active est retirée sans remplacement, le signalement revient à `ACCEPTE_POUR_RATTACHEMENT` après décision motivée ; la correction d'un rattachement vers un autre dossier termine l'ancien lien et crée le nouveau dans une même opération logique. Un rejet ne détruit ni l'observation ni ses pièces.

## 2. Cycle du dossier opérationnel

États persistés (enum partagé et contrainte SQL) :

- `A_QUALIFIER` : aucun volet inclus ne reste à traiter ; le dossier nécessite une correction de contenu avant de poursuivre.
- `EN_ATTENTE_AFFECTATION` : le dossier attend ses affectations.
- `EN_COURS_DE_TRAITEMENT` : le dossier comporte un traitement en cours.
- `EN_ATTENTE_VERIFICATION` : le traitement déclaré attend une vérification.
- `CLOS_RESOLUTION_CONFIRMEE` : toutes les catégories à traiter satisfont les critères de résolution vérifiée.
- `CLOS_SANS_SUITE` : fermeture sans résolution confirmée, selon une décision autorisée et motivée.

Les expressions « prêt à prioriser », « priorisé », « affecté », « en attente » et « transféré » décrivent des étapes ou décisions, mais ne sont pas des valeurs persistées de `statutDossier`.

La réouverture n’est pas un état durable : la commande émet `DOSSIER_REOUVERT`, conserve l’état de clôture antérieur dans l’historique, remet chaque volet inclus à `A_AFFECTER` et recalcule le dossier à `EN_ATTENTE_AFFECTATION`. Les vérifications positives et affectations terminées antérieures restent consultables, mais ne permettent pas une nouvelle clôture. Après réouverture, chaque volet inclus doit recevoir une nouvelle affectation et une vérification positive postérieures à la dernière réouverture.

Le statut global est une synthèse des états détaillés et ses valeurs sont bornées par le vocabulaire ci-dessus. Une modification du contenu après affectation nécessite une trace et, si de nouvelles catégories apparaissent, une remise en traitement du dossier. Si une catégorie est retirée après correction, son état passe à `RETIRE` avec acteur, date et motif ; elle est conservée si un historique la référence, et aucune affectation courante ne peut subsister pour cette catégorie.

### Règle de calcul du statut global du dossier

`statutDossier` est recalculé par la fonction SQL `recalculer_statut_dossier` dans la transaction de chaque mutation de volet, d’affectation, d’intervention ou de vérification. Les volets `RETIRE` sont exclus. La priorité déterministe est : aucun volet inclus → `A_QUALIFIER` ; au moins un `A_AFFECTER` ou `EN_ATTENTE_EQUIPE` → `EN_ATTENTE_AFFECTATION` ; sinon au moins un `AFFECTEE` ou `EN_COURS` → `EN_COURS_DE_TRAITEMENT` ; sinon au moins un `A_VERIFIER` ou tous les volets `TERMINEE` → `EN_ATTENTE_VERIFICATION`. Les états fermés ne sont définis que par leur commande explicite ; une réouverture remet les volets inclus à `A_AFFECTER`. `EN_ATTENTE_EQUIPE` est une valeur de modèle contrôlée, mais la disponibilité des équipes reste informative dans le MVP.

La clôture résolue exige au moins un volet `INCLUSE` et sa confirmation positive pour chaque volet inclus. Le statut `EN_ATTENTE_VERIFICATION` signifie soit qu’une vérification est encore attendue, soit que toutes les vérifications sont positives et que la commande de clôture reste à effectuer.

## 3. Cycle d'une affectation — une catégorie par ligne

Une affectation lie exactement : un dossier, un type de déchet, une équipe et la compétence valide retenue pour justifier l'affectation. L'identifiant de compétence est conservé pour savoir quelle compétence autorisait l'équipe à la date de décision.

États implémentés :

- `ACTIVE` : l'équipe est responsable du traitement de cette catégorie.
- `A_VERIFIER` : l'équipe a déclaré son travail terminé ; le résultat attend une vérification.
- `TERMINEE` : la résolution de cette catégorie a été confirmée.
- `REMPLACEE` : une nouvelle affectation prend le relais.
- `ANNULEE` : l'affectation a été annulée avec la justification requise.

Transitions principales :

- `ACTIVE` → `A_VERIFIER` après une déclaration de fin d'intervention accompagnée des éléments requis.
- `A_VERIFIER` → `TERMINEE` si la vérification confirme la résolution.
- `A_VERIFIER` → `ACTIVE` si la vérification révèle un traitement partiel ou non confirmé et que la même équipe doit poursuivre. Cette transition est historisée.
- `ACTIVE` ou `A_VERIFIER` → `REMPLACEE` lorsqu'une réaffectation est décidée.
- `ACTIVE` ou `A_VERIFIER` → `ANNULEE` si une annulation autorisée est nécessaire.

Les états `ACTIVE` et `A_VERIFIER` sont considérés comme affectations courantes ; pour un couple dossier/catégorie, une seule affectation de ces états est autorisée à un instant donné. Une affectation terminée, remplacée ou annulée possède une date de fin.

Si la même équipe doit traiter plusieurs catégories, elle reçoit une affectation distincte par catégorie. Les affectations peuvent partager une référence de corrélation lorsqu'elles résultent d'une même décision opérationnelle.

## 4. Cycle d'une intervention

États implémentés : `PROGRAMMEE`, `EN_COURS`, `TERMINEE`, `SUSPENDUE`, `ANNULEE`.

Résultats implémentés : `SUCCES_TOTAL`, `SUCCES_PARTIEL`, `ECHEC`, `IMPOSSIBLE`, `DEPOT_INTROUVABLE`, `ACCES_IMPOSSIBLE`, `REPORTE`, `HORS_COMPETENCE`, `ORIENTATION_SPECIALISEE`, `AUTRE`. Le résultat décrit ce qui s'est passé ; l'état décrit l'avancement de l'intervention. Tout résultat autre que `SUCCES_TOTAL` exige un motif d’au moins 10 caractères. Aucun de ces résultats ne remplace la vérification indépendante.

Une affectation peut produire plusieurs visites. Une visite impossible ou partielle ne constitue pas une résolution confirmée. Les photos sont facultatives ou conditionnelles selon la règle de preuve ; elles ne remplacent pas le compte rendu et la vérification.

## 5. Vérification de la résolution

Chaque vérification concerne une affectation, donc une seule catégorie de déchets. Plusieurs vérifications peuvent s'accumuler dans le temps : on conserve l'historique au lieu de remplacer le résultat précédent.

Résultats implémentés :

- `CONFORME_RESOLU` : le critère de résolution de cette catégorie est satisfait.
- `PARTIEL_NON_RESOLU` : une partie du traitement reste à faire.
- `NON_CONFORME` : le résultat déclaré n'est pas confirmé.
- `A_REVOIR` : les éléments disponibles ne permettent pas de conclure.

Tout résultat sauf `CONFORME_RESOLU` exige un motif d’au moins 10 caractères et déclenche une reprise tracée, avec affectation remise à `ACTIVE` et nouvelle intervention `PROGRAMMEE`. Une résolution confirmée clôture l'affectation de cette catégorie. Si un traitement doit reprendre après une résolution confirmée, une nouvelle affectation est créée plutôt que de rouvrir silencieusement l’affectation terminée.

## 6. Transitions principales et traces attendues

| Objet | Action | Résultat possible | Trace métier attendue |
|---|---|---|---|
| Signalement | Soumettre | `RECU` | `SIGNALEMENT_SOUMIS`, auteur et date de réception |
| Signalement | Demander un complément | `A_COMPLETER` | `COMPLEMENT_DEMANDE`, acteur, date et motif |
| Signalement | Accepter ou rejeter | `ACCEPTE_POUR_RATTACHEMENT` ou `REJETE` | Décision, acteur, date et motif s'il est requis |
| Signalement | Enregistrer un rattachement actif | `RATTACHE` | `RATTACHEMENT_SIGNALEMENT` actif, dossier cible et événement corrélé |
| Signalement | Retirer un rattachement sans remplacement | `ACCEPTE_POUR_RATTACHEMENT` | Fin du lien actif, acteur, date, motif et événement |
| Signalement | Rattacher | `RATTACHE` | `RATTACHEMENT_SIGNALEMENT` et événement corrélé |
| Dossier | Définir/modifier la priorité | `PRIORISE` | Valeurs avant/après, acteur, date et motif le cas échéant |
| Affectation | Créer | `ACTIVE` | Dossier, catégorie, équipe, compétence retenue, décideur et date |
| Affectation | Remplacer | Ancienne `REMPLACEE`, nouvelle `ACTIVE` | Deux événements corrélés ; motif et équipe précédente conservés |
| Intervention | Démarrer | `EN_COURS` | `INTERVENTION_DEMARREE` avec acteur et date |
| Intervention | Déclarer la fin | `TERMINEE` | Compte rendu et résultat requis |
| Affectation | Demander vérification | `A_VERIFIER` | `AFFECTATION_EN_ATTENTE_VERIFICATION` |
| Vérification | Confirmer | Affectation `TERMINEE` | `RESOLUTION_VERIFIEE` avec catégorie, acteur et date |
| Vérification | Ne pas confirmer | Affectation réactivée ou remplacée selon décision | Résultat, motif, acteur et date ; trace précédente conservée |
| Dossier | Clôturer | État de clôture autorisé | `DOSSIER_CLOTURE` avec base de décision |
| Dossier | Réouvrir depuis un état clôturé | `EN_ATTENTE_AFFECTATION` | `DOSSIER_REOUVERT`, état précédent, acteur, date et motif |

## 7. Invariants

- Un signalement rejeté ne peut être rattaché à un dossier actif, sauf nouvelle décision tracée.
- Un signalement conserve son auteur, sa date de soumission et son contenu initial.
- Une catégorie qualifiée d'un dossier à l'état `INCLUSE` a au plus une affectation courante ; une catégorie `RETIRE` ne peut pas être affectée. D'autres catégories du même dossier peuvent être traitées en parallèle.
- Chaque affectation correspond à une seule catégorie et à une compétence valide de l'équipe à la date d'affectation.
- Une intervention appartient à une affectation précise ; l'équipe et la catégorie historiques restent connues.
- La fin d'une intervention ne vaut pas résolution confirmée.
- Le dossier n'est entièrement résolu que lorsque toutes les catégories à traiter sont vérifiées positivement, sauf clôture autre explicitement autorisée.
- Tant qu'un dossier reste clôturé, aucune catégorie ne peut y être ajoutée et aucune affectation ou réaffectation ne peut y être créée ; une réouverture tracée est requise.
- Une réouverture conserve la clôture antérieure et ses vérifications ; la commande émet `DOSSIER_REOUVERT`, remet les volets inclus à `A_AFFECTER` et recalcule le statut à `EN_ATTENTE_AFFECTATION`. Avant toute re-clôture, chaque volet inclus doit recevoir une nouvelle affectation et une vérification positive datées après la dernière réouverture.
- Les dates effectives et les dates d'enregistrement permettent d'identifier les saisies différées.

## 8. Scénarios d'acceptation

1. Deux citoyens signalent le même dépôt : les deux signalements sont conservés et peuvent être liés à un dossier commun.
2. Un rattachement erroné est corrigé : l'ancien lien est terminé, le nouveau est créé et les deux sont consultables.
3. Une affectation vise une catégorie absente du contenu du dossier : l'opération est rejetée.
4. L'équipe n'a pas de compétence valide à la date de l'affectation : l'opération est rejetée.
5. Deux équipes sont proposées pour une même catégorie alors qu'une affectation courante existe : une réaffectation doit d'abord terminer/remplacer la précédente.
6. Deux catégories d'un même dossier sont affectées à des équipes différentes : les deux affectations peuvent être courantes simultanément.
7. Une vérification confirme une catégorie mais une autre reste non confirmée : le dossier ne peut pas être entièrement résolu.
8. Une résolution est rejetée : la reprise ou la réaffectation conserve l'historique précédent.
9. Un dépôt réapparaît après clôture : une décision de réouverture ou un nouveau dossier est tracé.
10. La même opération est reçue deux fois : les contraintes d'idempotence empêchent les affectations et événements en double.

## Cas multi-catégories

Un même signalement peut déclarer plusieurs types de déchets. Après qualification, chaque catégorie incluse suit son propre cycle d’affectation, d’intervention et de vérification. Le dossier global ne peut être déclaré résolu que lorsque toutes les catégories encore incluses sont vérifiées positivement, sous réserve d’une clôture exceptionnelle motivée et autorisée.
