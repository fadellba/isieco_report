---
title: Matrice de tests d'acceptation du MCD et du MLD
project: ISI-Eco Report
version: 2.11
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
| T15 | Un dépôt réapparaît après une clôture confirmée. | Une réouverture ou la création d’un nouveau dossier est décidée et historisée. Si l’ancien dossier est rouvert, `DOSSIER_REOUVERT` conserve la clôture précédente, remet les volets inclus à `A_AFFECTER` et recalcule le statut à `EN_ATTENTE_AFFECTATION`; chaque volet inclus exige une nouvelle affectation et une vérification positive postérieures avant re-clôture. Les anciennes affectations et vérifications restent historiques. | Clôture précédente, nouvel événement, acteur, motif, dates et résultats des nouvelles affectations/vérifications. |
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
| T35 | Plusieurs catégories d’un dossier avancent en parallèle (affectation manquante, traitement actif, vérification, résolution). | Le statut global respecte DC-26 dans cet ordre de priorité : attente d’affectation, traitement, vérification ; aucun volet inclus donne `A_QUALIFIER`. Tous les volets `TERMINEE` restent à `EN_ATTENTE_VERIFICATION` jusqu’à clôture explicite. | États par catégorie, résultat SQL/API, statut du dossier et événements dans la même transaction. |
| T36 | Un dossier clôturé est rouvert par un acteur habilité avec motif. | Un événement `DOSSIER_REOUVERT` est ajouté ; les volets inclus reviennent à `A_AFFECTER` et le statut courant devient `EN_ATTENTE_AFFECTATION`; le statut de clôture antérieur, les anciennes vérifications et affectations restent historisés. Une re-clôture est refusée jusqu’à la nouvelle affectation et la vérification positive de chaque volet inclus. | Événement, état avant/après, acteur, motif, affectations et vérifications antérieures inchangées, refus de re-clôture sans nouveau cycle. |
| T37 | Un utilisateur autorisé consulte la carte dans le périmètre de démonstration Dakar. | Les objets sont filtrés selon ses droits ; les signalements sans coordonnées restent consultables dans une liste adaptée ; aucune autorité n’est déduite automatiquement des coordonnées. | Filtrage d’accès, latitude/longitude valides, gestion des objets non géolocalisés. |
| T38 | Un décideur consulte les indicateurs de base sur une période. | Les observations, dossiers, affectations, interventions, résolutions confirmées et réouvertures sont comptés séparément selon les définitions documentées. | Définitions RG58/RG59, période, exclusions et événements de référence. |
| T39 | Un utilisateur s'authentifie avec un compte actif et des éléments valides, puis tente l'accès avec des éléments invalides ou un compte désactivé. | Un compte actif et valide obtient une session ; aucun échec ou compte inactif n'obtient de session ; les fonctions protégées restent refusées sans session/permis adéquats. | État du compte, résultat d'authentification, session émise ou absente, contrôle d'accès. |

## 5. Transactions concurrentes, décisions et exploitation

Ces cas complètent T01–T44. Ils sont exécutés sur PostgreSQL, pas uniquement sur des dépôts simulés.

| ID | Situation / action | Résultat attendu | Données ou traces à vérifier |
|---|---|---|---|
| T45 | Deux demandes simultanées créent une affectation pour le même volet sans clé d’idempotence. | Une seule est créée ; l’autre reçoit un refus métier, sans erreur interne ni intervention en double. | Une affectation courante et une intervention ; états du volet et du dossier cohérents. |
| T46 | Deux demandes simultanées portent la même référence d’idempotence. | Une création et une réponse idempotente retournent le même identifiant. | Une affectation, une intervention, un événement et une référence d’opération. |
| T47 | Deux décisions de vérification arrivent simultanément pour la même affectation `A_VERIFIER`. | Une décision gagne ; la seconde constate le nouvel état et est refusée. | Une seule vérification courante, état de l’affectation/du volet correspondant au résultat retenu. |
| T48 | Deux commandes de clôture arrivent simultanément après résolution de tous les volets. | Une seule clôture est enregistrée ; la seconde est refusée comme répétition. | Un état de clôture et un événement de clôture. |
| T49 | La création d’affectation échoue pendant l’écriture de l’événement métier, après les premières écritures de la transaction. | La transaction entière est annulée. | Aucune affectation, intervention ou trace partielle ; état du volet inchangé. |
| T50 | Un worker acquiert le verrou de purge pendant qu’un second worker tente de démarrer. | Un seul cycle détient le verrou ; le second attend le prochain intervalle. | Verrou advisory PostgreSQL détenu par une seule session et libéré après le cycle. |
| T51 | Une erreur ponctuelle survient pendant un cycle de purge. | L’erreur est journalisée ; le worker ne prétend pas que la purge a réussi et tente un cycle ultérieur. | Log d’échec, libération du verrou, cycle ultérieur et arrêt propre sur signal. |
| T52 | Les migrations de protection d’un dossier clôturé sont déployées. | Les triggers non modélisables par Prisma sont installés et actifs ; une écriture SQL interdite échoue. | Catalogue `pg_trigger`, état actif et tests directs des écritures. |
| T53 | Chaque valeur canonique de `ResultatVerification` est envoyée sur une affectation terminée. | `CONFORME_RESOLU` termine le volet ; les trois autres résultats remettent l’affectation en reprise avec une intervention programmée. | Résultat persistant, état d’affectation, état du volet, statut agrégé du dossier. |
| T54 | Pour chacune des quatre valeurs d’état de publication (`EN_ATTENTE`, `APPROUVEE`, `REFUSEE`, `MASQUEE`), tenter chacune des trois décisions (`APPROUVEE`, `REFUSEE`, `MASQUEE`). | Seules `EN_ATTENTE → APPROUVEE`, `EN_ATTENTE → REFUSEE` et `APPROUVEE → MASQUEE` réussissent ; toute autre paire est refusée sans modifier l’état. | 12 paires état/décision exercées via l’API et état PostgreSQL vérifié après chaque décision. |
| T55 | Injecter une panne sur une écriture terminale ou la trace finale de transactions de signalement, qualification/dossier, affectation, intervention/vérification, publication/photo, profil/mot de passe, délégation/disponibilité et référentiels. | Les écritures antérieures à la panne sont annulées ; après retrait de l’injection, la commande peut être exécutée normalement. Les fichiers dérivés non enregistrés sont nettoyés par le flux photo. | Tables d’état, relations, événements, notifications, clés d’idempotence et états des fichiers vérifiés selon la transaction. Il s’agit de points de panne injectés déterminés, pas de toutes les pannes physiques imaginables. |
| T56 | Croiser chaque commande métier recensée avec chacun des rôles, puis avec des comptes `INACTIF` et `SUSPENDU`. | Le rôle prévu franchit le contrôle de permission ; les rôles non habilités reçoivent `403` et tout compte non actif reçoit `401`. Les refus d’état/payload après autorisation ne sont pas confondus avec un refus RBAC. | Matrice F-06 : 27 commandes recensées, huit rôles et contrôle des états de compte ; la précondition métier est exercée dans les tests de parcours dédiés. |

### Matrice d’acteurs pour les commandes opérationnelles

Cette matrice porte sur les commandes exposées du parcours de traitement ; les combinaisons de rôles ne sont pas testées comme un produit cartésien aveugle. Chaque cas correspond à une permission ou une transition définie.

| Commande | Acteur autorisé et préconditions | Refus/contrôle vérifié |
|---|---|---|
| Soumettre un signalement | Citoyen authentifié ; données conformes au contrat. | Propriétaire, compte inactif, rôles et validation serveur : T29–T31, T39. |
| Qualifier / accepter / rejeter | Agent de qualification ; état du signalement compatible avec la transition. | Rôle interdit, transition répétée ou contradictoire : T20, F-01 et tests M3/RBAC. |
| Créer ou compléter un dossier | Agent traitement ; signalement admissible et catégorie cohérente. | Catégorie ajoutée après clôture sans réouverture : T36 et test M3 dédié. |
| Affecter / réaffecter | Agent d’affectation ; volet inclus, compétence valide, localisation exploitable, absence d’affectation courante. | Équipe incompétente, compétence invalide, volet retiré, dossier clôturé, doublon concurrent : T05–T10, T22–T23, T42, T44–T46. |
| Démarrer / terminer une intervention | Membre terrain actif de l’équipe ; affectation active et intervention dans le bon état ; chef ou délégataire habilité pour le compte-rendu. | Membre d’une autre équipe, auteur distinct du vérificateur, champs requis et résultats canoniques : T11, T21, T30, T40–T41 et tests M5 paramétrés. |
| Vérifier une résolution | Vérificateur distinct de l’auteur du compte-rendu ; affectation `A_VERIFIER`. | Séparation des tâches, état non vérifiable, motif requis, résultats et répétition concurrente : T12, T25, T47, T53. |
| Clôturer / rouvrir | Vérificateur autorisé ; tous les volets inclus positivement vérifiés pour clôturer ; dossier clôturé et motif pour rouvrir. | Clôture incomplète, clôture simultanée, réouverture depuis état non clôturé : T13–T15, T36, T48. |
| Modérer une publication ou une variante photo | Décideur distinct du créateur/déposant ; la variante doit être en attente et la publication dans un état autorisant la décision. | Matrice des 12 paires état/décision, séparation des modérations, retrait et rollback après échec d’audit : T54–T55 et tests publications. |

Une décision de permission dépend aussi de l’état du compte, de l’appartenance ou de la délégation au moment de l’action. Les tests documentés doivent rester adossés aux règles des routes et du domaine ; un acteur ou un état impossible métier ne constitue pas une case à créer artificiellement.
