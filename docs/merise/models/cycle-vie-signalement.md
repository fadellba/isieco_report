---
title: Cycles de vie du signalement, du dossier, de l'affectation et de l'intervention
project: ISI-Eco Report
version: 2.10
status: Cycles cibles proposés — scénario académique à tester
---

# Cycles de vie — version 2.10

Quatre cycles sont distincts : le signalement, le dossier opérationnel, l'affectation d'une catégorie à une équipe, et l'intervention. La vérification est historisée séparément. Le statut du dossier est une synthèse du travail sur toutes ses catégories ; ce n'est pas un remplacement des cycles détaillés.

## 1. Cycle du signalement

États proposés :

- `RECU` : l'observation a été reçue par le système.
- `A_QUALIFIER` : complétude, localisation ou catégories à examiner.
- `A_COMPLETER` : une information supplémentaire a été demandée.
- `QUALIFIE` : les informations permettent une décision.
- `ACCEPTE_POUR_RATTACHEMENT` : le signalement est recevable pour un dossier.
- `RATTACHE` : un rattachement actif à un dossier existe.
- `REJETE` : observation refusée pour le traitement, avec motif selon la règle.

`ACCEPTE_POUR_RATTACHEMENT` et `RATTACHE` sont deux états distincts et ne sont pas synonymes :

- `ACCEPTE_POUR_RATTACHEMENT` signifie que la qualification a abouti à une décision positive, mais qu'aucune relation active `RATTACHEMENT_SIGNALEMENT` n'est encore enregistrée.
- `RATTACHE` signifie qu'une relation active vers un `DOSSIER_TRAITEMENT` existe effectivement et que le signalement en conserve l'historique.

La transition vers `RATTACHE` n'est validée qu'après l'écriture cohérente de la relation et de l'événement métier associé. Si une relation active est retirée sans remplacement, le signalement revient à `ACCEPTE_POUR_RATTACHEMENT` ou à `QUALIFIE` selon la décision motivée ; la correction d'un rattachement vers un autre dossier termine l'ancien lien et crée le nouveau dans une même opération logique. Un rejet ne détruit ni l'observation ni ses pièces.

## 2. Cycle du dossier opérationnel

États proposés :

- `A_QUALIFIER` : informations ou contenu à compléter.
- `PRET_A_PRIORISER` : responsable de traitement habilité et localisation exploitable identifiés.
- `PRIORISE` : priorité décidée.
- `A_AFFECTER` : au moins une catégorie qualifiée ne possède pas d'affectation courante.
- `AFFECTE` : toutes les catégories prêtes à traiter ont une affectation courante et aucune intervention n'a encore commencé.
- `EN_COURS` : au moins une intervention est en cours.
- `A_VERIFIER` : une affectation attend une décision de vérification et aucune intervention n'est en cours.
- `EN_ATTENTE` : progression suspendue pour un motif connu.
- `TRANSFERE` : le cas a été orienté vers un service extérieur ; sa gestion ultérieure n'est pas couverte par le scénario initial.
- `CLOS_RESOLUTION_CONFIRMEE` : toutes les catégories à traiter satisfont les critères de résolution vérifiée.
- `CLOS_AUTRE_MOTIF` : fermeture sans résolution confirmée, seulement si cette décision est explicitement autorisée et motivée.

La réouverture n’est pas un état durable : la commande de réouverture émet `DOSSIER_REOUVERT`, conserve l’état de clôture antérieur dans l’historique, puis replace le dossier à `A_QUALIFIER`. Les vérifications positives et affectations terminées antérieures restent consultables. Toute reprise d’une catégorie déjà résolue crée une nouvelle affectation après qualification, jamais la réactivation silencieuse de l’ancienne.

Les priorités de calcul d'état sont définies comme une règle de synthèse à appliquer de manière déterministe et transactionnelle. Une modification du contenu après affectation nécessite une trace et, si de nouvelles catégories apparaissent, une remise en traitement du dossier. Si une catégorie est retirée après correction, son état passe à `RETIRE` avec acteur, date et motif ; elle est conservée si un historique la référence, et aucune affectation courante ne peut subsister pour cette catégorie.

### Règle de calcul du statut global du dossier

`statutDossier` est conservé comme synthèse matérialisée pour les lectures, mais il doit être recalculé à partir des états détaillés et mis à jour dans la même transaction que la commande métier et son événement. Le système ne doit jamais valider la mutation des catégories/affectations tout en laissant un ancien statut global.

Ordre de décision proposé (le premier critère applicable gagne) :

1. Si le dossier est valablement clôturé, conserver `CLOS_RESOLUTION_CONFIRMEE` ou `CLOS_AUTRE_MOTIF` jusqu’à une commande de réouverture autorisée.
2. Si une intervention est en cours pour au moins une catégorie, `EN_COURS`.
3. Si le dossier est explicitement suspendu et qu’aucune intervention n’est en cours, `EN_ATTENTE` avec motif historisé.
4. Si une affectation attend la vérification et qu’aucune intervention n’est en cours, `A_VERIFIER`.
5. S’il n’existe aucune catégorie `INCLUSE`, `A_QUALIFIER`.
6. Si le dossier est suffisamment qualifié mais que la priorité manque, `PRET_A_PRIORISER`.
7. Si la priorité est renseignée et qu’aucune affectation courante n’existe, `PRIORISE`.
8. Si au moins une affectation courante existe mais qu’une ou plusieurs catégories incluses n’ont pas encore d’affectation courante, `A_AFFECTER`.
9. Si toutes les catégories incluses ont une affectation courante et qu’aucune intervention n’a commencé, `AFFECTE`.
10. Dans les autres cas, `A_QUALIFIER`.

Les catégories `RETIRE` sont exclues de cette synthèse. Une clôture résolue exige au moins une catégorie `INCLUSE` et la confirmation positive de toutes les catégories incluses. Toute divergence entre le statut stocké et le résultat du calcul doit être détectée par un contrôle de cohérence et corrigée par une opération tracée. Cette règle est un choix du scénario académique ; elle devra être révisée si un acteur opérationnel valide un autre processus.

## 3. Cycle d'une affectation — une catégorie par ligne

Une affectation lie exactement : un dossier, un type de déchet, une équipe et la compétence valide retenue pour justifier l'affectation. L'identifiant de compétence est conservé pour savoir quelle compétence autorisait l'équipe à la date de décision.

États proposés :

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

États proposés : `PLANIFIEE`, `EN_COURS`, `TERMINEE`, `INTERROMPUE`, `ANNULEE`.

Résultats candidats : `TRAITEMENT_COMPLET_DECLARE`, `TRAITEMENT_PARTIEL`, `DEPOT_INTROUVABLE`, `ACCES_IMPOSSIBLE`, `REPORTE`, `HORS_COMPETENCE`, `ORIENTATION_SPECIALISEE`, `AUTRE`. Le résultat décrit ce qui s'est passé ; l'état décrit l'avancement de l'intervention. `AUTRE` nécessite une description.

Une affectation peut produire plusieurs visites. Une visite impossible ou partielle ne constitue pas une résolution confirmée. Les photos sont facultatives ou conditionnelles selon la règle de preuve ; elles ne remplacent pas le compte rendu et la vérification.

## 5. Vérification de la résolution

Chaque vérification concerne une affectation, donc une seule catégorie de déchets. Plusieurs vérifications peuvent s'accumuler dans le temps : on conserve l'historique au lieu de remplacer le résultat précédent.

Résultats proposés :

- `CONFIRMEE` : le critère de résolution de cette catégorie est satisfait.
- `PARTIELLE` : une partie du traitement reste à faire.
- `NON_CONFIRMEE` : le résultat déclaré n'est pas confirmé.
- `A_REVOIR` : les éléments disponibles ne permettent pas de conclure.

Une résolution confirmée clôture l'affectation de cette catégorie. Les résultats partiels ou non confirmés exigent une reprise, une réaffectation ou une mise en attente selon les règles du scénario. Si un traitement doit reprendre après une résolution confirmée, une nouvelle affectation est créée plutôt que de rouvrir silencieusement l’affectation terminée.

## 6. Transitions principales et traces attendues

| Objet | Action | Résultat possible | Trace métier attendue |
|---|---|---|---|
| Signalement | Soumettre | `RECU` | `SIGNALEMENT_SOUMIS`, auteur et date de réception |
| Signalement | Demander un complément | `A_COMPLETER` | `COMPLEMENT_DEMANDE`, acteur, date et motif |
| Signalement | Accepter ou rejeter | `ACCEPTE_POUR_RATTACHEMENT` ou `REJETE` | Décision, acteur, date et motif s'il est requis |
| Signalement | Enregistrer un rattachement actif | `RATTACHE` | `RATTACHEMENT_SIGNALEMENT` actif, dossier cible et événement corrélé |
| Signalement | Retirer un rattachement sans remplacement | `ACCEPTE_POUR_RATTACHEMENT` ou `QUALIFIE` selon décision tracée | Fin du lien actif, acteur, date, motif et événement |
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
| Dossier | Réouvrir depuis un état clôturé | `A_QUALIFIER` | `DOSSIER_REOUVERT`, état précédent, acteur, date et motif |

## 7. Invariants

- Un signalement rejeté ne peut être rattaché à un dossier actif, sauf nouvelle décision tracée.
- Un signalement conserve son auteur, sa date de soumission et son contenu initial.
- Une catégorie qualifiée d'un dossier à l'état `INCLUSE` a au plus une affectation courante ; une catégorie `RETIRE` ne peut pas être affectée. D'autres catégories du même dossier peuvent être traitées en parallèle.
- Chaque affectation correspond à une seule catégorie et à une compétence valide de l'équipe à la date d'affectation.
- Une intervention appartient à une affectation précise ; l'équipe et la catégorie historiques restent connues.
- La fin d'une intervention ne vaut pas résolution confirmée.
- Le dossier n'est entièrement résolu que lorsque toutes les catégories à traiter sont vérifiées positivement, sauf clôture autre explicitement autorisée.
- Une réouverture conserve la clôture antérieure et ses vérifications ; la commande émet `DOSSIER_REOUVERT` puis fixe le statut courant du dossier à `A_QUALIFIER`. Si une catégorie doit à nouveau être traitée, une nouvelle affectation est créée.
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
