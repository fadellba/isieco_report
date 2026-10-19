---
title: Dictionnaire des référentiels et valeurs contrôlées
project: ISI-Eco Report
version: 2.10
status: Valeurs indicatives à confirmer avec l’organisme pilote
---

# Dictionnaire des référentiels et valeurs contrôlées

Les valeurs ci-dessous sont une proposition pour assurer un vocabulaire homogène. Elles doivent être confirmées par les acteurs du territoire. Les codes sont stables ; les libellés affichés peuvent évoluer sans modifier le sens historique des événements.

## 1. États du signalement

| Code proposé | Sens | Suite possible |
|---|---|---|
| `RECU` | Observation enregistrée. | Qualification. |
| `A_QUALIFIER` | Des informations doivent être contrôlées. | Qualification ou complément. |
| `A_COMPLETER` | Un complément a été demandé. | Retour d’information ou rejet selon règle. |
| `QUALIFIE` | Les informations permettent une décision. | Acceptation pour rattachement ou rejet. |
| `ACCEPTE_POUR_RATTACHEMENT` | La qualification est positive, mais aucun lien actif vers un dossier n’est encore enregistré. | Reste dans cet état en attente d’un rattachement ; passe à `RATTACHE` uniquement après création effective du lien actif. |
| `RATTACHE` | Le signalement possède un lien actif vers un dossier de traitement. | Retour à `ACCEPTE_POUR_RATTACHEMENT` ou `QUALIFIE` seulement après retrait motivé du lien ; toute correction conserve l’historique. |
| `RATTACHE` | Observation reliée à un dossier. | Reste visible avec le dossier dans les limites autorisées. |
| `REJETE` | Observation refusée pour le traitement. | Réouverture de décision seulement si la procédure le permet. |

## 2. États du dossier de traitement

| Code proposé | Sens |
|---|---|
| `A_QUALIFIER` | Dossier encore incomplet ou en vérification. |
| `PRET_A_PRIORISER` | Compétence et localisation suffisamment définies. |
| `PRIORISE` | Priorité définie, affectation non encore active. |
| `A_AFFECTER` | Le dossier est éligible à une affectation. |
| `AFFECTE` | Les catégories à traiter sont couvertes par des affectations actives, et aucune intervention n’est commencée. |
| `EN_COURS` | Au moins une intervention relative au dossier est commencée. |
| `A_VERIFIER` | Au moins une affectation terminée attend sa vérification, sans autre état plus prioritaire imposant le maintien du traitement en cours. |
| `EN_ATTENTE` | La progression est suspendue pour un motif connu. |
| `TRANSFERE` | Le cas a été orienté vers un service extérieur ou spécialisé. Le destinataire est conservé comme libellé dans l’événement de transfert. |
| `CLOS_RESOLUTION_CONFIRMEE` | Le résultat a été confirmé selon la procédure adoptée. |
| `CLOS_AUTRE_MOTIF` | Une clôture sans résolution confirmée est explicitement autorisée et motivée. |


Le statut de dossier ne doit pas être remplacé par celui d’une intervention. `REOUVERT` n’est pas un état durable du dossier : c’est l’événement `DOSSIER_REOUVERT`, après lequel le statut courant redevient `A_QUALIFIER`. L’état fermé antérieur reste dans l’historique.

## 3. États d’affectation

Chaque affectation ne concerne qu'une seule catégorie de déchets.

- `ACTIVE` : l'équipe prend en charge la catégorie.
- `A_VERIFIER` : l'équipe a déclaré le travail terminé ; un vérificateur doit se prononcer.
- `TERMINEE` : la résolution de cette catégorie a été confirmée.
- `REMPLACEE` : l'affectation est relayée par une nouvelle affectation pour le même couple dossier/catégorie.
- `ANNULEE` : l'affectation est annulée avec un motif lorsque requis.

Les affectations `ACTIVE` et `A_VERIFIER` sont courantes et ont une date de fin nulle. Pour un même dossier et une même catégorie, une seule affectation courante est autorisée. `TERMINEE`, `REMPLACEE` et `ANNULEE` sont des états terminaux dans la ligne correspondante et exigent une date de fin. Une affectation peut passer de `A_VERIFIER` à `ACTIVE` après une vérification partielle ou non confirmée ; cette transition est historisée.

## 4. États d’intervention

- `PLANIFIEE` : intervention prévue, pas encore commencée.
- `EN_COURS` : intervention commencée.
- `TERMINEE` : compte rendu et résultat requis saisis.
- `INTERROMPUE` : intervention suspendue après son démarrage.
- `ANNULEE` : intervention annulée selon la procédure.

La liste peut être réduite ou enrichie si le partenaire la justifie. Toute modification de vocabulaire doit être propagée dans les règles et les tests.

## 5. Résultats d’intervention

Valeurs candidates : `TRAITEMENT_COMPLET_DECLARE`, `TRAITEMENT_PARTIEL`, `DEPOT_INTROUVABLE`, `ACCES_IMPOSSIBLE`, `REPORTE`, `HORS_COMPETENCE`, `ORIENTATION_SPECIALISEE`, `AUTRE`.

`AUTRE` exige une description. Les valeurs qui indiquent un résultat partiel, une impossibilité ou un transfert ne sont pas assimilées à une réussite.

## 6. Résultat de vérification

- `CONFIRMEE` : la résolution respecte les critères de vérification définis.
- `PARTIELLE` : une partie du problème reste à traiter ou la preuve est incomplète.
- `NON_CONFIRMEE` : le résultat déclaré n’est pas confirmé.
- `A_REVOIR` : la décision nécessite un contrôle complémentaire.

Le résultat de vérification doit rester distinct du statut d’intervention. Le champ `etatVerification` précise le rôle de chaque décision dans son historique :

- `COURANTE` : décision actuellement retenue pour l'affectation ; une seule par affectation.
- `REMPLACEE` : décision antérieure remplacée par une vérification ultérieure.
- `ANNULEE` : décision invalidée par une action autorisée et motivée.

Le remplacement ou l'annulation n'efface jamais la ligne ; l'opération est également consignée dans le journal métier.

## 7. Priorités

L’échelle retenue pour le scénario initial comprend trois niveaux : `FAIBLE`, `NORMALE` et `ELEVEE`. Les critères de classement sont une règle de simulation à documenter ; ils ne représentent pas des délais institutionnels officiels.

## 8. Type de rattachement

Valeurs candidates : `OBSERVATION_INITIALE`, `DOUBLON_CONFIRME`, `COMPLEMENT`, `REAPPARITION_LIEE`, `AUTRE_LIEN`. Toute correction du rattachement historique doit inclure l’acteur, la date et un motif adapté.

## 9. Points citoyens

Les points et récompenses sont hors périmètre du modèle initial. Si cette fonctionnalité est ajoutée ultérieurement, elle nécessitera un registre de mouvements, un barème publié, des corrections historisées et des mécanismes de prévention des abus.

## 10. Origine d’un événement

Valeurs candidates : `UTILISATEUR`, `SYSTEME`, `IMPORT`, `SYSTEME_EXTERNE`, `CORRECTION_ADMINISTRATIVE`. La valeur doit représenter l’origine réelle et non un texte arbitraire fourni par l’utilisateur.

## 11. Compétences des équipes et affectations

`COMPETENCE_EQUIPE` relie une équipe à une catégorie de déchet, avec une période de validité. La compétence est distincte de la disponibilité effective.

Chaque ligne `AFFECTATION` concerne exactement un dossier, une catégorie, une équipe et la compétence historisée qui justifie cette affectation. Le couple dossier/catégorie doit exister dans `CONTENU_DOSSIER`, et la compétence sélectionnée doit correspondre à la même équipe et à la même catégorie et être valide à la date de décision. Si une équipe traite deux catégories, deux affectations distinctes sont enregistrées.

Une catégorie ne peut avoir qu'une affectation courante par dossier. Les vérifications sont liées à l'affectation et portent ainsi sur une seule catégorie. Une vérification positive termine l'affectation ; un résultat partiel ou non confirmé exige une reprise, une réaffectation ou une attente tracée.


## 12. État de la catégorie dans un dossier

- `INCLUSE` : la catégorie fait partie du périmètre opérationnel et peut être affectée si les autres préconditions sont remplies.
- `RETIRE` : la catégorie a été retirée de la prise en charge après une décision de qualification ou de correction. Elle reste dans `CONTENU_DOSSIER` pour préserver les liens historiques, ne peut recevoir d'affectation courante et doit conserver la date, l'acteur et le motif du retrait.

Une catégorie ne peut être retirée si une affectation courante existe ; celle-ci doit d'abord être terminée, remplacée ou annulée de façon tracée. La clôture `CLOS_RESOLUTION_CONFIRMEE` considère uniquement les catégories encore `INCLUSE` et nécessite une vérification positive pour chacune. Si aucune catégorie ne reste à traiter, une clôture de résolution confirmée ne peut pas être utilisée pour masquer une correction de qualification ; la clôture appropriée doit être motivée.

## 13. Valeurs qui restent à définir

- catégories réelles de déchets utilisées dans le territoire ;
- correspondance entre catégories de déchets et équipes spécialisées ;
- critères et seuils de priorité ;
- critères d’une localisation suffisamment exploitable ;
- conditions d’acceptation/rejet d’une observation ;
- critères de résolution vérifiée ;
- motifs autorisés de suspension, transfert, réaffectation et réouverture ;
- durées de conservation par catégorie de données.


## Trace d’un transfert externe

Pour un événement de transfert, le dossier est la cible principale ; `destinataireExterne` conserve le nom ou libellé du service destinataire. Le champ est obligatoire pour ce type d’événement et ne constitue pas une référence relationnelle vers un système externe. L’acteur, les dates et le motif requis sont conservés avec l’événement.
