---
title: Matrice de tests d'acceptation du MCD et du MLD
project: ISI-Eco Report
version: 2.10
status: Tests de cohérence du scénario académique — à exécuter avant validation finale
---

# Matrice de tests d'acceptation du MCD/MLD

Ces tests démontrent la cohérence interne du scénario de conception. Ils ne prouvent ni l'efficacité d'un service réel, ni la supériorité d'ISI-Eco Report sur les outils existants. Les valeurs de jeu d'essai doivent être fictives ou anonymisées.

## 1. Tests prioritaires

| ID | Situation / action | Résultat attendu | Données ou traces à vérifier |
|---|---|---|---|
| T01 | Un citoyen soumet un signalement avec coordonnées GPS valides. | Le signalement est créé avec l'auteur et la date de réception. | `SIGNALEMENT`, `SIGNALEMENT_SOUMIS`, paire latitude/longitude. |
| T02 | Le citoyen ne fournit pas de coordonnées mais décrit un repère. | La réception est possible si les données minimales sont présentes ; l'affectation reste interdite tant que le lieu n'est pas exploitable. | `descriptionLocalisation`, état, absence d'affectation prématurée. |
| T03 | Deux citoyens signalent le même dépôt ; un agent confirme qu'il s'agit du même cas. | Deux signalements sont conservés ; chacun passe à `RATTACHE` seulement lorsque sa relation active vers le dossier commun est effectivement créée. | Deux `SIGNALEMENT`, deux `RATTACHEMENT_SIGNALEMENT` actifs/historisés, un `DOSSIER_TRAITEMENT`, statuts cohérents. |
| T04 | Un signalement accepté est en attente de rattachement ; puis un lien erroné est corrigé. | Avant l'écriture du lien, le statut reste `ACCEPTE_POUR_RATTACHEMENT`. Après création d'un lien actif, il devient `RATTACHE`. La correction termine l'ancien lien et crée le nouveau sans supprimer l'observation. | `RATTACHEMENT_SIGNALEMENT`, statut avant/après, acteur, dates, motif et événements corrélés. |
| T05 | L'affectation vise un type absent de `CONTENU_DOSSIER`. | L'opération est refusée. | Échec de la clé étrangère composée `(idDossier, idTypeDechet)`. |
| T06 | L'équipe sélectionnée n'a pas la compétence adéquate. | L'opération est refusée. | Correspondance équipe/type/compétence et période de validité. |
| T07 | La compétence existe mais était expirée à la date de l'affectation. | L'opération est refusée. | Date d'affectation comparée aux bornes de `COMPETENCE_EQUIPE`. |
| T08 | Une affectation courante existe déjà pour le même couple dossier/catégorie ; une deuxième équipe est choisie. | La création directe est refusée ; l'ancienne affectation doit être remplacée ou terminée dans la même opération logique. | Unicité conditionnelle par dossier/catégorie, date de fin, événements. |
| T09 | Un dossier contient deux catégories et chacune est confiée à une équipe différente. | Deux affectations courantes distinctes sont permises. | Deux couples `(idDossier, idTypeDechet)` différents, compétence valide pour chacun. |
| T10 | La même équipe prend en charge deux catégories d'un dossier. | Deux affectations sont créées ; elles peuvent partager un identifiant de corrélation. | Une affectation par type, même équipe, compétences cohérentes. |
| T11 | Une intervention est déclarée terminée sans compte rendu ni résultat. | Le système refuse la transition. | Contrainte d'état, compte rendu et résultat requis. |
| T12 | Une intervention est complète selon l'équipe, mais la vérification est partielle. | La catégorie n'est pas déclarée résolue ; l'affectation est réactivée ou remplacée selon la décision tracée. | `INTERVENTION`, `VERIFICATION_RESOLUTION`, statut et motif. |
| T13 | La vérification confirme la résolution d'une catégorie, mais une autre catégorie du dossier reste non résolue. | Le dossier ne passe pas à `CLOS_RESOLUTION_CONFIRMEE`. | Vérifications par affectation ; toutes les lignes de contenu du dossier sont prises en compte. |
| T14 | Toutes les catégories à traiter sont positivement vérifiées. | La clôture résolue est autorisée. | Affectations terminées, vérifications positives, événement de clôture. |
| T15 | Un dépôt réapparaît après une clôture confirmée. | Une réouverture ou la création d’un nouveau dossier est décidée et historisée. Si l’ancien dossier est rouvert, `DOSSIER_REOUVERT` conserve la clôture précédente et fixe le statut courant à `A_QUALIFIER` ; une nouvelle affectation est créée pour toute catégorie à reprendre et l’affectation terminée reste historique. | Clôture précédente, nouvel événement, acteur et motif. |
| T16 | Une opération de création d'affectation est envoyée deux fois avec la même référence d'opération. | Une seule affectation et un seul résultat métier sont conservés. | Unicité de la référence, atomicité et événement métier. |
| T17 | Un événement métier est créé sans cible ou avec deux cibles principales. | L'opération est refusée. | Contrainte « exactement une cible principale ». |
| T18 | Une correction est apportée à un événement passé. | L'événement original reste inchangé ; une nouvelle trace référence l'événement corrigé. | `idEvenementCorrige`, absence de cycle, date d'enregistrement. |
| T19 | Une opération est saisie après avoir été réalisée en différé. | La date effective et la date d'enregistrement restent distinctes. | `dateEvenement` et `dateEnregistrement`. |
| T20 | Un compte non autorisé tente de qualifier, affecter ou vérifier. | L'action est refusée côté système et l'accès sensible est journalisé selon la politique définie. | Matrice de permissions et journal de sécurité séparé du journal métier. |
| T21 | Une photo est ajoutée à une intervention. | Elle est associée à une intervention existante et à son contexte. | `PHOTO_INTERVENTION`, référence, contexte et date. |
| T22 | Une période de compétence ou d'appartenance se termine avant son début. | L'enregistrement est refusé. | Contraintes de période et tests de non-chevauchement. |
| T23 | Une catégorie est retirée après avoir été qualifiée ; elle possède des traces historiques. | La ligne est conservée comme `RETIRE`, la date/l'acteur/le motif sont enregistrés et aucune nouvelle affectation ne peut être créée. | `CONTENU_DOSSIER`, événement de retrait, absence d'affectation courante. |
| T24 | Un événement cible une ligne de `CONTENU_DOSSIER`. | Les clés du dossier et de la catégorie sont présentes ensemble et la cible composite existe. | Contrainte de paire et clé étrangère composée. |
| T25 | Une affectation reçoit plusieurs vérifications successives. | Une seule vérification reste `COURANTE` ; la précédente passe à `REMPLACEE` ou `ANNULEE` avec une trace explicite. | `VERIFICATION_RESOLUTION.etatVerification`, événements de remplacement/annulation. |
| T26 | Un signalement déclare trois catégories ; un second signalement relatif au même dépôt apporte une catégorie déjà présente et une nouvelle catégorie. | Les deux signalements sont conservés ; après qualification, le dossier possède une seule ligne par catégorie distincte retenue ; chaque catégorie incluse peut recevoir son affectation spécialisée, sans doubler la catégorie commune. | `CONTENU_SIGNALEMENT`, rattachements historisés, unicité `(idDossier, idTypeDechet)`, une affectation courante au maximum par catégorie, interventions et vérifications par affectation. |
| T27 | Un dossier est transféré vers un service extérieur hors périmètre. | L’événement cible le dossier et conserve le libellé du destinataire, l’acteur, la date et le motif ; aucune relation ou clé étrangère vers un organisme externe n’est créée. | `EVENEMENT_METIER.idDossierCible`, `destinataireExterne`, `dateEvenement`, `dateEnregistrement`, `idActeur`, motif. |

## 2. Critères d'acceptation du modèle

Le MCD/MLD est prêt à servir de base au développement lorsque :

1. chaque entité correspond à un besoin métier identifié et documenté ;
2. chaque cardinalité est cohérente avec les règles de gestion ;
3. aucune affectation ne peut viser une catégorie absente du dossier ou une compétence non concordante ;
4. une catégorie ne peut pas avoir deux affectations courantes simultanées dans le même dossier ;
5. la résolution est vérifiée indépendamment pour chaque catégorie ;
6. les décisions historiques, les réaffectations et les corrections sont conservées ;
7. les scénarios T01 à T27 passent avec les jeux d'essai convenus ;
8. toute limite non démontrée sur le terrain reste clairement présentée comme hypothèse du scénario académique.

## 3. Limite des tests

Les tests valident la cohérence de la spécification et de son implémentation. Ils ne valident pas la réalité du barème de priorité, la pertinence des catégories spécialisées, les procédures d'un opérateur réel ni la qualité des preuves de terrain. Ces sujets nécessitent une validation opérationnelle distincte.

## 4. Tests complémentaires de cohérence du MVP et des exigences non fonctionnelles (T28–T39)

Les scénarios ci-dessous complètent T01–T27. Ils sont spécifiés pour guider l’implémentation et la recette ; **ils ne sont pas considérés comme exécutés** avant d’être lancés sur une application déployée dans un environnement de test.

| ID | Situation / action | Résultat attendu | Données ou traces à vérifier |
|---|---|---|---|
| T28 | Parcours nominal : un citoyen soumet un signalement à une catégorie ; un agent le qualifie ; une équipe est affectée ; l’intervention est documentée ; un vérificateur confirme ; le citoyen consulte l’état final. | Le parcours complet aboutit à `CLOS_RESOLUTION_CONFIRMEE` et le citoyen voit un état cohérent sans accès aux champs internes non autorisés. | `SIGNALEMENT`, `DOSSIER_TRAITEMENT`, `AFFECTATION`, `INTERVENTION`, `VERIFICATION_RESOLUTION`, `EVENEMENT_METIER`, affichage citoyen. |
| T29 | Un citoyen tente de consulter un signalement ou une pièce jointe appartenant à un autre compte. | L’accès est refusé côté serveur ; aucune donnée ou URL de pièce jointe protégée n’est divulguée. | Contrôle propriétaire/permission, réponse d’accès refusé, journal de sécurité séparé. |
| T30 | Un compte désactivé ou un rôle sans autorisation tente une opération de qualification, d’affectation, de vérification ou d’administration. | L’opération est refusée côté serveur même si l’interface est contournée. | État du compte, matrice de permissions, absence de mutation métier, journal de sécurité. |
| T31 | L’utilisateur téléverse un type de fichier non autorisé, un fichier trop volumineux ou soumet sans connexion. | Le fichier est refusé selon les limites configurées ; l’échec réseau n’est pas présenté comme une réception réussie ; l’utilisateur peut réessayer. | Validation MIME/extension/taille côté serveur, état de soumission, absence de faux accusé de réception. |
| T32 | Un événement métier est créé sans cible principale ou avec deux groupes cibles simples renseignés. | L’opération est rejetée. | Contrainte `nombreDeGroupesCibleNonNuls = 1`, aucun événement orphelin. |
| T33 | Un événement renseigne un seul des deux identifiants de la cible `CONTENU_DOSSIER`. | L’opération est rejetée avant persistance. | Les deux colonnes cible composées sont toutes deux NULL ou toutes deux non NULL. |
| T34 | Un événement vise un groupe cible composé complet mais le couple dossier/catégorie n’existe pas. | L’opération est rejetée par l’intégrité référentielle. | Clé étrangère composée vers `CONTENU_DOSSIER`. |
| T35 | Une mutation change les états d’affectations dans un dossier à plusieurs catégories. | Le statut global est recalculé de manière déterministe et persisté dans la même transaction que la mutation et son événement. | États par catégorie, statut du dossier, événement ; absence de divergence après rollback/commit. |
| T36 | Un dossier clôturé est rouvert par un acteur habilité avec motif. | Un événement `DOSSIER_REOUVERT` est ajouté ; le statut courant devient `A_QUALIFIER`; le statut de clôture antérieur, les anciennes vérifications et affectations restent historisés. | Événement, état avant/après, acteur, motif, affectations et vérifications antérieures inchangées. |
| T37 | Un utilisateur autorisé consulte la carte dans le périmètre de démonstration Dakar. | Les objets sont filtrés selon ses droits ; les signalements sans coordonnées restent consultables dans une liste adaptée ; aucune autorité n’est déduite automatiquement des coordonnées. | Filtrage d’accès, latitude/longitude valides, gestion des objets non géolocalisés. |
| T38 | Un décideur consulte les indicateurs de base sur une période. | Les observations, dossiers, affectations, interventions, résolutions confirmées et réouvertures sont comptés séparément selon les définitions documentées. | Définitions RG58/RG59, période, exclusions et événements de référence. |
| T39 | Un utilisateur s'authentifie avec un compte actif et des éléments valides, puis tente l'accès avec des éléments invalides ou un compte désactivé. | Un compte actif et valide obtient une session ; aucun échec ou compte inactif n'obtient de session ; les fonctions protégées restent refusées sans session/permis adéquats. | État du compte, résultat d'authentification, session émise ou absente, contrôle d'accès. |
