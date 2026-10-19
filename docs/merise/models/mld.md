---
title: Modèle Logique de Données (MLD)
project: ISI-Eco Report
version: 2.10
methodology: Merise
status: Modèle logique consolidé pour le scénario académique — hypothèses à signaler
---

# Modèle Logique de Données (MLD)

## 1. Convention

`PK` : clé primaire ; `FK` : clé étrangère ; `UQ` : unicité ; `NN` : obligatoire ; `NULL` : facultatif. `BOOLEAN` et les valeurs contrôlées sont des notations logiques sans prescription d'une technologie physique.

La règle structurante de la version 2.8 est : **une affectation couvre un seul dossier et un seul type de déchet**. Une équipe affectée à deux catégories dans le même dossier reçoit deux enregistrements `AFFECTATION`. Cette forme rend la réaffectation et la vérification indépendantes par catégorie.


### Exemple de données pour un signalement multi-catégories

Supposons qu’un même `SIGNALEMENT` déclare les catégories `PLASTIQUE`, `ORGANIQUE` et `ELECTRONIQUE` :

- `SIGNALEMENT` contient une seule ligne ; `CONTENU_SIGNALEMENT` contient trois lignes ayant le même `idSignalement` et des `idTypeDechet` différents.
- Après qualification, `DOSSIER_TRAITEMENT` contient une ligne de dossier, tandis que `CONTENU_DOSSIER` contient une ligne par catégorie retenue et incluse. La clé `(idDossier, idTypeDechet)` interdit de dupliquer la même catégorie dans ce dossier.
- `AFFECTATION` contient jusqu’à trois lignes courantes, une par catégorie. Chaque ligne pointe vers le même `idDossier`, mais vers un `idTypeDechet` et une équipe spécialisée correspondants. La contrainte d’unicité porte sur le couple dossier/catégorie courant, et non sur l’ensemble du dossier.
- `INTERVENTION` et `VERIFICATION_RESOLUTION` sont rattachées à `idAffectation`, ce qui sépare les résultats par catégorie. Le dossier n’est résolu que lorsque toutes ses catégories `INCLUSE` satisfont les critères de résolution vérifiée.

Cet exemple illustre une règle de conception : les catégories signalées sont des déclarations initiales, et non des décisions automatiques d’affectation. Elles doivent être qualifiées avant la prise en charge.

## 2. Schéma relationnel logique

```text
ROLE(
  idRole PK,
  codeRole UQ NN,
  libelleRole NN,
  description NULL
)

UTILISATEUR(
  idUtilisateur PK,
  nom NN,
  prenom NULL,
  email UQ NN,
  telephone NULL,
  dateInscription NN,
  etatCompte NN
)

UTILISATEUR_ROLE(
  idUtilisateur PK/FK -> UTILISATEUR,
  idRole PK/FK -> ROLE,
  dateDebut PK,
  dateFin NULL,
  attribuePar FK NULL -> UTILISATEUR,
  motif NULL
)


TYPE_DECHET(
  idTypeDechet PK,
  codeType UQ NN,
  libelle NN,
  description NULL,
  orientationSpecialisee BOOLEAN NN
)

EQUIPE(
  idEquipe PK,
  nomEquipe NN,
  description NULL,
  etatEquipe NN
)

APPARTENANCE_EQUIPE(
  idUtilisateur PK/FK -> UTILISATEUR,
  idEquipe PK/FK -> EQUIPE,
  dateDebut PK,
  dateFin NULL,
  fonction NN
)

COMPETENCE_EQUIPE(
  idCompetenceEquipe PK,
  idEquipe FK NN -> EQUIPE,
  idTypeDechet FK NN -> TYPE_DECHET,
  dateDebut NN,
  dateFin NULL,
  commentaire NULL,
  valideePar FK NULL -> UTILISATEUR,
  UQ(idEquipe, idTypeDechet, dateDebut),
  UQ(idCompetenceEquipe, idEquipe, idTypeDechet)
)

SIGNALEMENT(
  idSignalement PK,
  idUtilisateur FK NN -> UTILISATEUR,
  dateConstat NULL,
  dateSoumission NN,
  description NN,
  latitude NULL,
  longitude NULL,
  precisionLocalisation NULL,
  descriptionLocalisation NULL,
  statutSignalement NN,
  decisionPar FK NULL -> UTILISATEUR,
  dateDecision NULL,
  motifDecision NULL
)

PHOTO_SIGNALEMENT(
  idPhotoSignalement PK,
  referencePhoto NN,
  description NULL,
  dateAjout NN,
  idSignalement FK NN -> SIGNALEMENT
)

CONTENU_SIGNALEMENT(
  idSignalement PK/FK -> SIGNALEMENT,
  idTypeDechet PK/FK -> TYPE_DECHET,
  quantiteEstimee NULL,
  volumeEstime NULL,
  remarque NULL
)

DOSSIER_TRAITEMENT(
  idDossier PK,
  referenceDossier UQ NN,
  descriptionSynthese NN,
  dateCreationDossier NN,
  statutDossier NN,
  priorite NN,
  dateQualification NULL,
  latitude NULL,
  longitude NULL,
  precisionLocalisation NULL,
  descriptionLocalisation NULL,
  dateCloture NULL,
  creePar FK NN -> UTILISATEUR
)

RATTACHEMENT_SIGNALEMENT(
  idRattachement PK,
  idSignalement FK NN -> SIGNALEMENT,
  idDossier FK NN -> DOSSIER_TRAITEMENT,
  dateDebutRattachement NN,
  dateFinRattachement NULL,
  typeRattachement NN,
  motif NULL,
  idActeur FK NN -> UTILISATEUR
)

CONTENU_DOSSIER(
  idDossier PK/FK -> DOSSIER_TRAITEMENT,
  idTypeDechet PK/FK -> TYPE_DECHET,
  quantiteEstimee NULL,
  volumeEstime NULL,
  niveauRisqueQualifie NULL,
  remarque NULL,
  qualifiePar FK NULL -> UTILISATEUR,
  dateQualification NULL,
  etatContenuDossier NN,
  dateRetrait NULL,
  retirePar FK NULL -> UTILISATEUR,
  motifRetrait NULL
)

AFFECTATION(
  idAffectation PK,
  idDossier NN,
  idTypeDechet NN,
  idEquipe FK NN -> EQUIPE,
  idCompetenceEquipe NN,
  dateHeureAffectation NN,
  idDecideur FK NN -> UTILISATEUR,
  etatAffectation NN,
  motif NULL,
  observation NULL,
  dateFinAffectation NULL,
  referenceOperationUnique UQ NULL,
  FK(idDossier, idTypeDechet) -> CONTENU_DOSSIER(idDossier, idTypeDechet),
  FK(idCompetenceEquipe, idEquipe, idTypeDechet) -> COMPETENCE_EQUIPE(idCompetenceEquipe, idEquipe, idTypeDechet)
)

INTERVENTION(
  idIntervention PK,
  idAffectation FK NN -> AFFECTATION,
  dateHeureDebut NULL,
  dateHeureFin NULL,
  statutIntervention NN,
  resultatIntervention NULL,
  compteRendu NULL,
  motifException NULL,
  renseignePar FK NN -> UTILISATEUR
)

PHOTO_INTERVENTION(
  idPhotoIntervention PK,
  idIntervention FK NN -> INTERVENTION,
  referencePhoto NN,
  contextePhoto NN,
  description NULL,
  dateAjout NN
)

VERIFICATION_RESOLUTION(
  idVerification PK,
  idAffectation FK NN -> AFFECTATION,
  idVerificateur FK NN -> UTILISATEUR,
  dateVerification NN,
  resultatVerification NN,
  etatVerification NN,
  motif NULL,
  referencePreuve NULL
)

EVENEMENT_METIER(
  idEvenement PK,
  typeEvenement NN,
  dateEvenement NULL,
  dateEnregistrement NN,
  origine NN,
  idActeur FK NULL -> UTILISATEUR,
  idSignalementCible FK NULL -> SIGNALEMENT,
  idDossierCible FK NULL -> DOSSIER_TRAITEMENT,
  idRattachementCible FK NULL -> RATTACHEMENT_SIGNALEMENT,
  idAffectationCible FK NULL -> AFFECTATION,
  idInterventionCible FK NULL -> INTERVENTION,
  idVerificationCible FK NULL -> VERIFICATION_RESOLUTION,
  idUtilisateurCible FK NULL -> UTILISATEUR,
  idEquipeCible FK NULL -> EQUIPE,
  idTypeDechetCible FK NULL -> TYPE_DECHET,
  idCompetenceEquipeCible FK NULL -> COMPETENCE_EQUIPE,
  idDossierContenuCible NULL,
  idTypeDechetContenuCible NULL,
  idEvenementCorrige FK NULL -> EVENEMENT_METIER,
  donneesAvant NULL,
  donneesApres NULL,
  destinataireExterne NULL,
  motif NULL,
  correlationId NULL,
  referenceOperationUnique UQ NULL,
  versionSchema NN,
  FK(idDossierContenuCible, idTypeDechetContenuCible) -> CONTENU_DOSSIER(idDossier, idTypeDechet)
)
```

## 3. Contraintes d'intégrité complémentaires

Les clés seules ne suffisent pas à exprimer toutes les règles métier. Les contraintes suivantes font partie de la spécification logique ; leur mise en œuvre technique sera précisée après le choix de l'architecture.

1. **Périodes valides.** Dans `UTILISATEUR_ROLE`, `APPARTENANCE_EQUIPE` et `COMPETENCE_EQUIPE`, la date de fin ne précède pas la date de début. Les périodes incompatibles ne se chevauchent pas.
2. **Coordonnées.** `latitude` et `longitude` sont renseignées ensemble et dans des plages valides. Si elles sont absentes, une description ou un repère exploitable est requis avant affectation.
3. **Rattachement.** Un signalement ne possède qu'un seul rattachement actif à un instant donné. Les rattachements terminés restent consultables.
4. **Contenu de dossier.** Chaque catégorie affectée doit exister dans `CONTENU_DOSSIER` pour le même dossier et avoir `etatContenuDossier = INCLUSE`. La clé étrangère composée `(idDossier, idTypeDechet)` de `AFFECTATION` impose l’existence du couple, tandis qu’une règle métier interdit l’affectation d’une catégorie retirée. Une catégorie retirée reste conservée et porte un motif, une date et un acteur.
5. **Compétence retenue.** La clé étrangère composée vers `COMPETENCE_EQUIPE` garantit que l'équipe et la catégorie concordent avec la compétence sélectionnée. La date de l'affectation doit être comprise dans sa période de validité.
6. **Une catégorie par affectation.** Chaque ligne `AFFECTATION` contient exactement un `idDossier`, un `idTypeDechet` et un `idEquipe`. Si la même équipe traite deux catégories, deux affectations sont créées.
7. **Une affectation courante par catégorie.** Pour chaque couple `(idDossier, idTypeDechet)`, une seule affectation dont `dateFinAffectation` est NULL peut exister. Les états courants permis sont `ACTIVE` et `A_VERIFIER`. Une réaffectation termine l'ancienne affectation et crée la nouvelle dans une opération cohérente.
8. **Cohérence état/date de fin.** `ACTIVE` et `A_VERIFIER` ont `dateFinAffectation` NULL. `TERMINEE`, `REMPLACEE` et `ANNULEE` ont une date de fin renseignée. Une vérification positive clôt la catégorie ; une vérification partielle ou négative laisse la catégorie à traiter et nécessite la réactivation de l'affectation ou une nouvelle affectation selon la procédure.
9. **Intervention terminée.** Une intervention ne peut être `TERMINEE` sans le compte rendu et le résultat requis. Sa fin ne prouve pas à elle seule la résolution.
10. **Vérification par catégorie.** Puisqu'une affectation vise une seule catégorie, chaque `VERIFICATION_RESOLUTION` porte sur une seule catégorie. Les vérifications successives sont conservées au lieu d'être écrasées. `etatVerification` vaut `COURANTE`, `REMPLACEE` ou `ANNULEE` ; une seule vérification `COURANTE` est permise par affectation. Tout remplacement ou toute annulation est historisé.
11. **Clôture complète.** Le dossier ne peut être `CLOS_RESOLUTION_CONFIRMEE` que s’il reste au moins une catégorie `INCLUSE` et que toutes ces catégories disposent d’une affectation `TERMINEE` après vérification positive. Les catégories `RETIRE` sont exclues du calcul mais restent historisées. Si aucune catégorie ne demeure à traiter, la clôture ne peut pas être présentée comme une résolution confirmée ; une autre clôture doit être motivée et autorisée.
12. **Cible d’événement — contrainte exclusive.** Exactement un groupe de cible principale est renseigné. Les groupes simples sont `idSignalementCible`, `idDossierCible`, `idRattachementCible`, `idAffectationCible`, `idInterventionCible`, `idVerificationCible`, `idUtilisateurCible`, `idEquipeCible`, `idTypeDechetCible` et `idCompetenceEquipeCible`. Le groupe composé `CONTENU_DOSSIER` compte comme une seule cible et exige que `idDossierContenuCible` et `idTypeDechetContenuCible` soient tous deux renseignés ou tous deux NULL. La règle logique est : `nombreDeGroupesCibleNonNuls = 1` ET `((idDossierContenuCible IS NULL) = (idTypeDechetContenuCible IS NULL))`. Les références doivent pointer vers une cible existante et de type correct. L’implémentation doit traduire cette règle en contrainte native si possible, ou en validation transactionnelle sans intervalle de course.
13. **Correction d'événement.** `idEvenementCorrige` ne peut désigner le même événement ; les relations de correction ne doivent pas créer de cycle. La correction ajoute un événement et ne modifie pas l'événement historique d'origine.
14. **Acteur fiable.** L'acteur humain d'un événement est issu du contexte authentifié de confiance ; il ne peut pas être défini uniquement par un champ transmis par l'interface. Les événements automatiques indiquent une origine adaptée.
15. **Opérations idempotentes.** Une répétition de commande avec la même clé d'opération ne crée pas de deuxième affectation ni un deuxième événement équivalent. La clé, la modification métier et son événement doivent être traités atomiquement.
16. **Minimisation.** `donneesAvant` et `donneesApres` ne contiennent ni secrets d'authentification ni informations personnelles non nécessaires. La politique de conservation demeure limitée par la finalité et les obligations applicables.
17. **État de la catégorie dans le dossier.** `INCLUSE` exige `dateRetrait`, `retirePar` et `motifRetrait` NULL. `RETIRE` exige ces trois valeurs renseignées et aucune affectation courante associée. La transition de retrait ou de réactivation est historisée.
18. **Transfert externe hors périmètre.** Un transfert vers un service externe est enregistré par un événement qui cible le dossier (`idDossierCible`) et conserve un libellé de destinataire dans `destinataireExterne`, avec la date, l’acteur et le motif requis. Le système ne crée pas de dossier organisationnel ni de référence étrangère pour le destinataire et ne prétend pas suivre son traitement interne.
19. **Référentiels.** Les états, priorités, catégories, niveaux de risque, résultats d'intervention, résultats de vérification, types de rattachement et origines d'événement ont des définitions contrôlées.

## 4. Notes de conception

### Pourquoi ne pas conserver une table séparée de catégories d'affectation ?

Une ligne d'affectation par catégorie évite qu'une seule affectation ait plusieurs cycles de vie indépendants. Elle simplifie les réaffectations partielles, la contrainte d'unicité des affectations courantes et la vérification catégorie par catégorie. Le coût est qu'une même équipe prenant plusieurs catégories possède plusieurs affectations, qui peuvent être reliées par le même `correlationId` ou une référence d'opération commune dans le journal métier.

### Journal d'événements à cibles typées

Les références `...Cible` assurent l'intégrité référentielle vers les objets principaux suivis. Une contrainte d'intégrité garantit qu'exactement un groupe cible est renseigné. Le groupe `CONTENU_DOSSIER` est composé des identifiants de dossier et de catégorie ; ces deux valeurs doivent être renseignées ensemble. Les événements de création d'une association telle que l'appartenance d'équipe peuvent cibler l'utilisateur ou l'équipe et détailler les valeurs pertinentes dans les données avant/après ; une même opération peut générer plusieurs événements corrélés si nécessaire.

### État courant et historique

Les champs de statut représentent l'état courant. `EVENEMENT_METIER` conserve les transitions significatives et leurs raisons. Si une transition est corrigée, une nouvelle trace référence l'événement corrigé ; l'historique n'est pas réécrit silencieusement. Les périodes de rôle, de compétence et de rattachement ont leurs propres bornes effectives.

## 5. Limites

Le MLD est logique et ne choisit aucune technologie particulière. Les points citoyens sont hors du schéma initial. Aucune table `ZONE` ni `ORGANISATION` n’est modélisée dans le périmètre initial : la localisation cartographique ne détermine pas automatiquement l’équipe à affecter, et les rôles/événements portent les décisions de traitement. Un transfert externe est tracé par événement sans modéliser le destinataire comme entité interne. Les durées de conservation et les obligations réglementaires doivent être validées avant toute mise en service réelle.
