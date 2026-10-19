---
title: Traçabilité, journal métier et reconstitution historique
project: ISI-Eco Report
version: 2.8
status: Exigences de conception proposées
---

# Traçabilité et événements métier

## 1. Objectif

Le système doit connaître l’état courant d’un signalement, d’un dossier, d’une affectation ou d’une intervention, et pouvoir expliquer comment cet état a été obtenu. La traçabilité sert à reconstituer une chronologie, attribuer les décisions, mesurer les délais et examiner les corrections.

Un journal métier ne constitue pas à lui seul une preuve que les faits de terrain étaient vrais. Il prouve que le système a enregistré un événement décrit par un acteur ou un processus, à une date donnée. Les vérifications de résultats ont donc leur propre enregistrement.

## 2. Structure logique d’un événement

Chaque événement comprend :

| Champ | Obligatoire | Sens |
|---|---|---|
| `idEvenement` | Oui | Identifiant unique. |
| `typeEvenement` | Oui | Code stable du fait métier enregistré. |
| `dateEvenement` | Si connue | Moment effectif du fait ; peut être inconnue dans un import ou une saisie tardive. |
| `dateEnregistrement` | Oui | Moment où le système a reçu/enregistré l’événement ; ne doit pas être antidaté. |
| `origine` | Oui | Origine contrôlée : acteur, service interne, import ou système externe. |
| `idActeur` | Selon le cas | Personne responsable, si identifiable. |
| `ciblePrincipale` | Oui | Une seule cible métier typée ; pour `CONTENU_DOSSIER`, la cible est le couple dossier/catégorie. |
| `donneesAvant` / `donneesApres` | Conditionnel | Valeurs strictement nécessaires à la compréhension du changement. |
| `destinataireExterne` | Obligatoire pour un transfert externe, sinon NULL | Libellé du service destinataire hors périmètre ; aucune relation de données n’est créée vers lui. |
| `motif` | Conditionnel | Justification d’un rejet, d’une réaffectation, d’une correction, etc. |
| `correlationId` | Facultatif | Relie plusieurs événements produits par la même opération. |
| `referenceOperationUnique` | Facultatif mais recommandée pour une mutation répétable | Identifie une mutation idempotente ; `correlationId` relie plusieurs événements d’une même opération métier. |
| `versionSchema` | Oui | Version du format d’événement. |

Dans le MLD proposé, la cible est représentée par des références typées et une contrainte exige qu’une seule cible principale soit renseignée. Une référence générique textuelle `type/identifiant` est plus souple, mais ne possède pas la même garantie de clé étrangère.

## 3. Événements minimaux à enregistrer

### Signalements

- création et soumission ;
- demande de complément ;
- qualification ;
- acceptation ou rejet et motif ;
- modification de la qualification, du repère ou des catégories ;
- ajout/retrait de photographie lorsque pertinent ;
- rattachement à un dossier, fin de rattachement et correction du rapprochement.

### Dossiers

- création ;
- décision de prise en charge ;
- transfert externe : cible principale `DOSSIER_TRAITEMENT`, libellé du destinataire dans `destinataireExterne`, acteur, dates et motif requis ;
- modification de priorité ;
- changement de statut ;
- affectation, annulation, remplacement et réaffectation ;
- mise en attente ou reprise ;
- clôture, vérification négative et réouverture.

### Affectations et interventions

- affectation créée pour un dossier/catégorie, compétence retenue, activation, annulation ou remplacement ;
- début et fin d’une intervention ;
- résultat et compte rendu ;
- exception, report ou transfert ;
- ajout d’une preuve utile.

### Référentiels et droits

- changement de rôle ou de droit avec impact significatif ;
- début ou fin d’appartenance à une équipe ;
- ajout, clôture ou modification historique d’une compétence d’équipe par catégorie, avec date d’effet et acteur ;
- modification d’une catégorie, d’une priorité ou d’une règle ayant un impact sur l’exploitation.

Les lectures ordinaires, erreurs techniques à haut volume et tentatives d’accès refusées ne doivent pas être mélangées automatiquement au journal métier. Elles relèvent de notifications ou de journaux techniques/sécurité distincts.

## 4. Invariants du journal

1. Le changement d’état et son événement sont enregistrés comme une seule opération cohérente.
2. L’événement décrit un fait accompli, pas simplement une tentative qui a échoué.
3. L’acteur est déterminé par un contexte de confiance, pas par un identifiant libre transmis par l’interface.
4. Les événements historiques ne sont pas corrigés en réécrivant le passé ; une correction crée une nouvelle trace qui référence l’événement ou la décision corrigée.
5. Les données avant/après sont limitées aux champs nécessaires. Aucun mot de passe, secret ou jeton ne doit y figurer.
6. Les opérations répétables utilisent une stratégie d’idempotence afin d’éviter les doublons.
7. Les droits de consultation et d’administration du journal sont restreints ; les accès sensibles peuvent être audités séparément.
8. Les sauvegardes doivent couvrir les données métier et les événements, et la restauration doit être vérifiée.
9. Les références typées doivent exister et correspondre à la cible annoncée. Pour une cible `CONTENU_DOSSIER`, les identifiants dossier et catégorie sont renseignés ensemble. Les événements avec zéro ou plusieurs cibles principales sont invalides.
10. L’ordre historique tient compte de `dateEvenement`, `dateEnregistrement` et d’un ordre stable en cas d’égalité. Les corrections tardives ne doivent pas réécrire les dates d’origine.
11. La durée de conservation des événements n’est pas automatiquement illimitée ; elle dépend de la finalité, des obligations applicables et de la politique adoptée.

## 5. Questions historiques et données requises

| Question historique | Données/événements nécessaires |
|---|---|
| Quel était l’état du dossier à une date donnée ? | Transitions d’état datées, date effective, date d’enregistrement, ordre stable. |
| Qui a accepté ou rejeté un signalement et pourquoi ? | Décision, acteur, date, motif. |
| Quelles observations ont été rattachées au dossier ? | Historique des rattachements avec dates de début/fin, acteur et motif. |
| Quelle équipe était affectée à chaque catégorie et période ? | Créations et remplacements d’affectations, dossier/catégorie/équipe/compétence, états et dates. |
| Pourquoi l’équipe a-t-elle changé pour une catégorie ? | Affectation précédente, nouvelle affectation et motif. |
| Combien de temps entre réception, qualification et affectation ? | `dateSoumission`, qualification et affectation ; règles exactes de début/fin. |
| L’intervention a-t-elle vraiment résolu le problème ? | Compte rendu, résultat, vérification distincte et preuve si requise. |
| Pourquoi le dossier a-t-il été rouvert ? | Événement de réouverture, acteur et motif ; historique antérieur de clôture. |
| Y a-t-il eu une contribution répétée ou un double traitement ? | Identifiant d’opération, rattachements, affectations et règles de déduplication. |

## 6. Tests d’acceptation de la traçabilité

- Une modification de priorité laisse l’ancienne valeur, la nouvelle valeur, l’acteur et la date consultables.
- Une réaffectation révèle l’équipe précédente, la nouvelle équipe pour la même catégorie, le décideur, la date et le motif.
- Une correction de rattachement conserve le lien antérieur et sa période de validité.
- Une action répétée avec la même référence d’opération ne génère pas un second mouvement métier.
- Une intervention déclarée terminée mais non vérifiée n’apparaît pas comme résolution confirmée.
- Une réouverture conserve la clôture et la vérification antérieures.
- Une consultation d’historique par un compte non autorisé est refusée et ne révèle pas de données confidentielles.
- Aucun événement ne peut référencer une cible inexistante ou posséder plusieurs cibles principales. Pour une ligne `CONTENU_DOSSIER`, les identifiants dossier et catégorie doivent être fournis ensemble.
- Une reconstitution historique sur des données de test produit l’état attendu à chaque date de référence.

## 7. Ce que la traçabilité ne garantit pas

La présence d’un événement ne prouve pas à elle seule l’exactitude de la localisation, de la photo ou du résultat de terrain. La qualité des preuves, les contrôles, les rôles habilités et les vérifications physiques restent nécessaires. Aucun historique ne peut reconstituer un fait qui n’a jamais été enregistré.
