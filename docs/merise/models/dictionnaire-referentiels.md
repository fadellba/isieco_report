---
title: Dictionnaire des référentiels et valeurs contrôlées
project: ISI-Eco Report
version: 2.11
status: Valeurs implémentées pour le scénario académique — validation opérationnelle requise
---

# Dictionnaire des référentiels et valeurs contrôlées

Les valeurs marquées « implémentées » correspondent aux contrats partagés, à Prisma/SQL et aux routes API du scénario académique vérifiés le 24/10/2026. Elles ne constituent pas une validation d’un opérateur réel. Les codes sont stables ; les libellés affichés peuvent évoluer sans modifier le sens historique des événements.

## 1. États du signalement — contrats partagés et SQL

| Code | Sens / présence dans l'API |
|---|---|
| `BROUILLON` | Autorisé et utilisé comme valeur par défaut SQL/Prisma ; aucun endpoint de brouillon n’est exposé. |
| `SOUMIS` | Signalement reçu ; état attribué par la route de création. |
| `EN_COURS_DE_QUALIFICATION` | Examen de qualification commencé. |
| `A_COMPLETER` | Un complément a été demandé. |
| `ACCEPTE_POUR_RATTACHEMENT` | Décision positive, sans lien actif à ce stade. |
| `RATTACHE` | Un lien actif vers un dossier existe effectivement. |
| `REJETE` | Observation refusée selon la décision de qualification. |

`BROUILLON` est une valeur base de données sans parcours API correspondant, donc une limite de périmètre explicite et non un état utilisateur disponible. Aucun état `RECU`, `A_QUALIFIER` ou `QUALIFIE` n’appartient à l’énumération persistée du signalement.

## 2. États du dossier — valeurs persistées

| Code | Sens |
|---|---|
| `A_QUALIFIER` | Aucun volet inclus ne reste à traiter ; une correction de contenu est nécessaire avant de poursuivre. |
| `EN_ATTENTE_AFFECTATION` | Dossier attendant la décision d’affectation. |
| `EN_COURS_DE_TRAITEMENT` | Des interventions sont en cours. |
| `EN_ATTENTE_VERIFICATION` | Une déclaration d’intervention attend son contrôle. |
| `CLOS_RESOLUTION_CONFIRMEE` | Toutes les catégories incluses sont confirmées selon le workflow. |
| `CLOS_SANS_SUITE` | Clôture motivée sans résolution confirmée. |

« Prêt à prioriser », « priorisé », « affecté », « en attente » et « transféré » sont des descriptions de processus, pas des codes de `statutDossier` dans le contrat actuel.


Le statut de dossier ne doit pas être remplacé par celui d’une intervention. `REOUVERT` n’est pas un état durable du dossier : c’est l’événement `DOSSIER_REOUVERT`, après lequel les volets inclus repassent à `A_AFFECTER` et le statut global devient `EN_ATTENTE_AFFECTATION`. L’état fermé antérieur reste dans l’historique.

Ordre d’agrégation transactionnel : aucun volet inclus donne `A_QUALIFIER` ; un volet `A_AFFECTER` ou `EN_ATTENTE_EQUIPE` donne priorité à `EN_ATTENTE_AFFECTATION` ; sinon `AFFECTEE` ou `EN_COURS` donne `EN_COURS_DE_TRAITEMENT` ; sinon un volet `A_VERIFIER` ou des volets tous `TERMINEE` donnent `EN_ATTENTE_VERIFICATION`. La clôture confirmée reste une décision explicite et n’est jamais produite par l’agrégat.

## 3. États d’affectation

Chaque affectation ne concerne qu'une seule catégorie de déchets.

- `ACTIVE` : l'équipe prend en charge la catégorie.
- `A_VERIFIER` : l'équipe a déclaré le travail terminé ; un vérificateur doit se prononcer.
- `TERMINEE` : la résolution de cette catégorie a été confirmée.
- `REMPLACEE` : l'affectation est relayée par une nouvelle affectation pour le même couple dossier/catégorie.
- `ANNULEE` : l'affectation est annulée avec un motif lorsque requis.

Les affectations `ACTIVE` et `A_VERIFIER` sont courantes et ont une date de fin nulle. Pour un même dossier et une même catégorie, une seule affectation courante est autorisée. `TERMINEE`, `REMPLACEE` et `ANNULEE` sont des états terminaux dans la ligne correspondante et exigent une date de fin. Une affectation peut passer de `A_VERIFIER` à `ACTIVE` après une vérification partielle ou non confirmée ; cette transition est historisée.

## 4. États d’intervention — implémentés

- `PROGRAMMEE` : intervention prévue, pas encore commencée.
- `EN_COURS` : intervention commencée.
- `TERMINEE` : compte rendu et résultat requis saisis.
- `SUSPENDUE` : intervention suspendue après son démarrage.
- `ANNULEE` : intervention annulée selon la procédure.

Les résultats hors `SUCCES_TOTAL` exigent un motif non vide d’au moins 10 caractères. Une intervention terminée ne signifie pas que la résolution est vérifiée.

## 5. Résultats d’intervention — implémentés

Valeurs canoniques : `SUCCES_TOTAL`, `SUCCES_PARTIEL`, `ECHEC`, `IMPOSSIBLE`, `DEPOT_INTROUVABLE`, `ACCES_IMPOSSIBLE`, `REPORTE`, `HORS_COMPETENCE`, `ORIENTATION_SPECIALISEE`, `AUTRE`.

Seul `SUCCES_TOTAL` est un succès total déclaré. Tous les autres résultats exigent un motif d’au moins 10 caractères et ne sont pas assimilés à une résolution vérifiée.

## 6. Résultat de vérification — implémenté

- `CONFORME_RESOLU` : la résolution est confirmée ; l’affectation est terminée.
- `PARTIEL_NON_RESOLU` : une partie du problème reste à traiter.
- `NON_CONFORME` : le résultat déclaré n’est pas confirmé.
- `A_REVOIR` : la décision nécessite un contrôle complémentaire.

Tout résultat autre que `CONFORME_RESOLU` exige un motif d’au moins 10 caractères et relance une reprise tracée avec une intervention programmée. Le résultat reste distinct du statut d’intervention. Le champ `etatVerification` précise le rôle de chaque décision dans son historique :

- `COURANTE` : décision actuellement retenue pour l'affectation ; une seule par affectation.
- `REMPLACEE` : décision antérieure remplacée par une vérification ultérieure.
- `ANNULEE` : décision invalidée par une action autorisée et motivée.

Le remplacement ou l'annulation n'efface jamais la ligne ; l'opération est également consignée dans le journal métier.

## 7. Priorités

L’échelle retenue pour le scénario initial comprend quatre niveaux : `FAIBLE`, `MOYENNE`, `ELEVEE` et `URGENTE`. Les critères de classement sont une règle de simulation à documenter ; ils ne représentent pas des délais institutionnels officiels.

## 8. Type de rattachement — valeurs SQL/API

Valeurs implémentées dans le MLD, SQL, l’API et l’énumération partagée : `PRINCIPAL`, `CONFIRMATION`, `COMPLEMENT`, `DOUBLON_CONFIRME`. `DOUBLON_CONFIRME` est distinct d’une simple confirmation ; il compense le crédit de points associé s’il existe. Toute correction du rattachement historique conserve l’acteur, la date et le motif.

## 9. Points citoyens

Barème MVP : 10 points sont crédités une seule fois à l’acceptation d’un signalement ; un doublon confirmé ou une correction motivée de cette acceptation avant rattachement ajoute un mouvement compensatoire égal et opposé. Les rejets antérieurs à l’acceptation n’accordent pas de points. Les attributions administratives libres sont désactivées. Le solde correspond à la somme des mouvements conservés dans `HISTORIQUE_POINTS`.

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

## 13. État de prise en charge d’un volet

`CONTENU_DOSSIER.etatPriseEnCharge` est contraint en SQL aux valeurs `A_AFFECTER`, `EN_ATTENTE_EQUIPE`, `AFFECTEE`, `EN_COURS`, `A_VERIFIER`, `TERMINEE`. `EN_ATTENTE_EQUIPE` exige une date et un motif d’attente ; les autres états n’en portent pas. La fonction SQL `recalculer_statut_dossier` agrège les seuls volets `INCLUSE` dans le même ordre de priorité que DC-26 : affectation attendue, traitement en cours, puis vérification attendue. `AFFECTEE` signifie qu’une affectation existe mais que le travail n’est pas encore démarré ; `EN_COURS` correspond à une intervention démarrée ; `TERMINEE` à une résolution vérifiée. Si tous les volets sont terminés, le dossier reste `EN_ATTENTE_VERIFICATION` jusqu’à la commande explicite de clôture.

## 14. Valeurs et règles à confirmer avec un opérateur réel

- catégories réelles de déchets utilisées dans le territoire ;
- correspondance entre catégories de déchets et équipes spécialisées ;
- critères et seuils de priorité ;
- critères d’une localisation suffisamment exploitable ;
- conditions d’acceptation/rejet d’une observation ;
- critères de résolution vérifiée ;
- motifs autorisés de suspension, transfert, réaffectation et réouverture ;
- critères d’application et conformité des durées de conservation, dont la règle d’un an photo du scénario académique.

## 15. Provenance des catégories d’un dossier — implémentée

`CONTENU_DOSSIER.origineAjout` prend les valeurs `SIGNALEMENT`, `CREATION_DOSSIER`, `AJOUT_MANUEL` ou `HISTORIQUE_NON_DETERMINE`. Seul `AJOUT_MANUEL` porte un `motifAjout` non vide d’au moins 10 caractères ; les autres origines doivent avoir un motif nul. Les lignes provenant des données historiques gardent leur origine indéterminée lorsqu’elle ne peut pas être établie, sans inventer de provenance.

## 16. Conservation photo — choix du scénario académique

`PHOTO_SIGNALEMENT` et `PHOTO_INTERVENTION` portent `dateExpiration`, `mediaPurgeAt` et `mediaStockeeLocale`. La durée retenue est d’un an à partir de `dateAjout`. La purge retire les médias locaux et variantes dérivées, mais conserve les références métier. Cette durée n’est ni une règle légale attestée ni une validation de mise en production.


## Trace d’un transfert externe

Pour un événement de transfert, le dossier est la cible principale ; `destinataireExterne` conserve le nom ou libellé du service destinataire. Le champ est obligatoire pour ce type d’événement et ne constitue pas une référence relationnelle vers un système externe. L’acteur, les dates et le motif requis sont conservés avec l’événement.
