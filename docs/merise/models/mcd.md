---
title: Modèle Conceptuel de Données (MCD)
project: ISI-Eco Report
version: 2.11
methodology: Merise
status: Modèle conceptuel stabilisé pour le scénario académique — validation opérationnelle non réalisée
---

# Modèle Conceptuel de Données (MCD)

## 1. Décision structurante de la version 2.8

**Une affectation concerne exactement un dossier, une équipe et une catégorie de déchets.** Une équipe chargée de deux catégories dans un même dossier reçoit donc deux affectations distinctes. Ce choix permet de suivre séparément la compétence mobilisée, les interventions, les vérifications, les échecs et les réaffectations pour chaque catégorie.

Une affectation est toujours rattachée à une catégorie qualifiée du dossier (`CONTENU_DOSSIER`). Elle conserve la compétence d'équipe utilisée pour justifier la décision. Plusieurs affectations historiques peuvent concerner la même catégorie d'un dossier, mais une seule affectation courante est autorisée à la fois.

Le modèle distingue :

- `SIGNALEMENT` : observation initiale transmise par un citoyen ;
- `DOSSIER_TRAITEMENT` : situation opérationnelle acceptée pour traitement ;
- `AFFECTATION` : décision de confier une catégorie de déchets à une équipe compétente ;
- `INTERVENTION` : action ou visite exécutée dans le cadre d'une affectation ;
- `VERIFICATION_RESOLUTION` : décision historisée sur le résultat d'une affectation, donc sur une seule catégorie.

Le projet est un scénario de conception académique. La vision cible est nationale et Dakar constitue le territoire de démonstration du PFE. Les données sont fictives ; ISI-Eco Report n'est pas présenté comme un opérateur réellement mandaté pour collecter les déchets. Aucun partenaire opérationnel n'est confirmé.

Le périmètre de départ est limité à un seul contexte applicatif : la responsabilité fonctionnelle est portée par les rôles, les décisions enregistrées et les équipes du système. Aucune entité `ORGANISATION` ni table d’appartenance organisationnelle n’est modélisée. Si la plateforme doit gérer ultérieurement plusieurs organismes avec leurs propres comptes, équipes et dossiers, le modèle devra évoluer explicitement. Un transfert vers un service externe reste une trace de transfert, pas une gestion du destinataire.


### Exemple métier : un signalement comportant plusieurs catégories

Un citoyen transmet **un seul `SIGNALEMENT`** et déclare, par exemple, trois catégories : déchets plastiques, déchets organiques et déchets électroniques. Le système conserve un `CONTENU_SIGNALEMENT` distinct pour chaque catégorie. Après qualification, le responsable décide quelles catégories sont réellement à traiter et conserve une ligne `CONTENU_DOSSIER` unique par catégorie retenue. Les catégories qui ne sont pas confirmées ou qui sortent du périmètre ne sont pas ajoutées automatiquement ; toute correction est tracée.

Si les trois catégories sont incluses, le responsable d’affectation crée trois `AFFECTATION` : chacune associe le même dossier à une catégorie précise et à une équipe compétente. Les équipes peuvent être différentes ; si une seule équipe est compétente pour deux catégories, deux affectations distinctes sont tout de même créées. Les interventions et vérifications sont indépendantes pour chaque affectation. Une catégorie déjà présente dans le dossier n’est pas dupliquée lorsqu’un autre signalement est rattaché au même dossier.

Le statut global du dossier est recalculé depuis les états des catégories encore incluses : affectation à faire, traitement actif, puis vérification attendue, dans cet ordre de priorité. L’absence de catégorie incluse donne `A_QUALIFIER`. Même lorsque toutes les catégories sont `TERMINEE`, le dossier reste en attente de vérification jusqu’à la commande explicite de clôture.

## 2. Entités conceptuelles

### Identité, rôles et équipes

- **UTILISATEUR** : compte d'une personne et informations nécessaires à son usage.
- **ROLE** : rôle fonctionnel, distinct des permissions détaillées.
- **UTILISATEUR_ROLE** : période d'attribution d'un rôle à un utilisateur.
- **EQUIPE** : groupe opérationnel chargé d’exécuter des interventions dans le scénario académique.
- **APPARTENANCE_EQUIPE** : période pendant laquelle un utilisateur appartient à une équipe.

### Référentiel des déchets et compétences

- **TYPE_DECHET** : catégorie normalisée de déchet.
- **COMPETENCE_EQUIPE** : compétence d'une équipe pour une catégorie, valable sur une période donnée. La compétence n'indique pas à elle seule la disponibilité de l'équipe.

### Observation citoyenne et qualification

- **SIGNALEMENT** : contenu initial, auteur, dates et localisation déclarée.
- **PHOTO_SIGNALEMENT** : photographie facultative d'un signalement.
- **CONTENU_SIGNALEMENT** : association entre un signalement et une catégorie déclarée, avec estimations ou remarques facultatives.
- **DOSSIER_TRAITEMENT** : cas opérationnel, localisation qualifiée, priorité et état courant.
- **RATTACHEMENT_SIGNALEMENT** : lien historisé entre un signalement et un dossier. Il permet de corriger un rapprochement sans effacer le lien précédent.
- **CONTENU_DOSSIER** : catégorie de déchets qualifiée dans un dossier, avec estimation, risque, état de prise en charge (`INCLUSE` ou `RETIRE`) et provenance d’ajout. L’origine distingue les catégories venues d’un signalement, celles initiales à la création, les ajouts manuels et l’historique non déterminable. Un ajout manuel exige un motif ; une ligne est conservée par couple dossier/catégorie et un retrait conserve sa raison, sa date et son acteur.
- **QUALIFICATION_SIGNALEMENT** et **PROVENANCE_CONTENU_DOSSIER** : historique des catégories qualifiées par signalement et de leur contribution au contenu d’un dossier, relié au rattachement et à la qualification source.

### Traitement et vérification

- **AFFECTATION** : affectation historique d'une catégorie précise d'un dossier à une équipe compétente. Le dossier, la catégorie, l'équipe, la compétence de référence, le décideur, la date et l'état sont conservés.
- **INTERVENTION** : visite ou action réalisée pour une affectation. Une affectation peut entraîner plusieurs interventions.
- **PHOTO_INTERVENTION** : preuve visuelle facultative associée à une intervention et à son contexte.
- **VERIFICATION_RESOLUTION** : contrôle historisé du résultat d'une affectation. Plusieurs vérifications peuvent exister pour la même affectation ; `etatVerification` distingue la décision courante, une décision remplacée ou une décision annulée, avec au plus une décision courante par affectation.
- **DEMANDE_COMPLEMENT** et **REPONSE_COMPLEMENT** : demande d’information complémentaire et réponse append-only du déclarant.
- **DISPONIBILITE_EQUIPE** et **HISTORIQUE_DISPONIBILITE_EQUIPE** : état informatif courant de l’équipe et traces de ses mises à jour ; la disponibilité ne remplace pas les compétences.
- **HISTORIQUE_PRIORITE_DOSSIER** et **HISTORIQUE_LOCALISATION_DOSSIER** : valeurs antérieures et décisions motivées de priorité/localisation.
- **DELEGATION_DECISION_EQUIPE** : délégation bornée par l’appartenance d’équipe, le type de décision et une période.
- **IDEMPOTENCE_SIGNALEMENT** : empreinte d’une requête de création associée à une clé par utilisateur, sans stocker le contenu secret d’authentification.
- **PUBLICATION_FLUX** et **PHOTO_PUBLICATION** : publication modérée distincte des photos sources ; l’accès public passe par des variantes approuvées et expirables.
- **PREFERENCES_VISIBILITE_CITOYEN**, **BADGE**, **BADGE_UTILISATEUR** et **HISTORIQUE_POINTS** : préférences explicites de visibilité, badges et registre immuable des mouvements de points.
- **NOTIFICATION** et **SESSION** : notifications applicatives et sessions dont le jeton est conservé sous forme d’empreinte, et non en clair.
- **REGION**, **DEPARTEMENT** et **COMMUNE** : référentiel géographique hiérarchisé ; la commune est optionnelle sur le signalement et le dossier.

### Historique transversal

- **EVENEMENT_METIER** : événement de reconstitution métier avec acteur, dates, origine, motif éventuel, avant/après, cible principale typée et corrélation. Un événement correctif peut référencer l'événement qu'il corrige. Pour un transfert externe, le libellé du destinataire est conservé sur l’événement lié au dossier, sans modéliser le destinataire comme entité interne.

## 3. Associations et cardinalités proposées

Les cardinalités ci-dessous décrivent le scénario de conception, non un fonctionnement réel déjà observé.

### Utilisateurs, rôles et équipes

- Un `UTILISATEUR` peut recevoir plusieurs rôles dans le temps ; chaque enregistrement `UTILISATEUR_ROLE` relie exactement un utilisateur et un rôle pendant une période.
- Un `UTILISATEUR` peut appartenir à plusieurs équipes dans le temps ; chaque `APPARTENANCE_EQUIPE` relie exactement un utilisateur à une équipe pour une période.

### Signalement et dossier

- Un utilisateur peut soumettre zéro à plusieurs signalements ; chaque signalement conserve exactement un auteur d'origine dans le scénario initial.
- Un signalement peut avoir zéro à plusieurs photos ; chaque photo de signalement appartient à un seul signalement.
- Un signalement peut déclarer zéro à plusieurs catégories via `CONTENU_SIGNALEMENT` ; chaque ligne relie exactement un signalement à un type de déchet.
- Un signalement peut avoir zéro à plusieurs rattachements historiques et un dossier peut recevoir zéro à plusieurs rattachements historiques. Chaque rattachement relie exactement un signalement à un dossier. **Un seul rattachement peut être actif par signalement à un instant donné.**
- Un dossier est créé par un utilisateur. Les décisions de qualification, de priorité et d’affectation sont attribuées à des utilisateurs disposant des rôles appropriés ; aucune entité d’organisation n’est nécessaire dans le périmètre initial du scénario.
- Un dossier contient zéro à plusieurs lignes `CONTENU_DOSSIER` pendant la qualification ; chaque ligne relie exactement un dossier à une catégorie de déchets.

### Compétences, affectations et opérations

- Une équipe possède zéro à plusieurs compétences et une catégorie peut être couverte par plusieurs équipes ; chaque `COMPETENCE_EQUIPE` relie exactement une équipe et une catégorie pour une période.
- Une ligne `CONTENU_DOSSIER` peut recevoir zéro à plusieurs affectations historiques ; chaque affectation concerne exactement cette ligne, une équipe et la compétence historisée retenue.
- Une équipe peut recevoir zéro à plusieurs affectations au cours du temps. Une affectation doit correspondre à une compétence valide de l'équipe pour la catégorie concernée à la date de décision.
- Pour un même couple dossier/catégorie, **une seule affectation courante** est autorisée. Des catégories distinctes du même dossier peuvent être affectées simultanément à des équipes différentes, ou à la même équipe au moyen d'affectations distinctes.
- Une affectation peut produire zéro à plusieurs interventions ; chaque intervention appartient à une seule affectation.
- Une intervention peut avoir zéro à plusieurs photos ; chaque photo d'intervention appartient à une seule intervention.
- Une affectation peut faire l'objet de zéro à plusieurs vérifications historisées ; chaque vérification porte sur une seule affectation et donc une seule catégorie.

### Événements métier

Chaque `EVENEMENT_METIER` possède exactement une cible principale existante parmi les types explicitement pris en charge par le MLD. Plusieurs événements peuvent viser le même objet. Plusieurs événements relatifs à une seule opération peuvent partager un identifiant de corrélation. Un événement correctif peut référencer l'événement corrigé sans le supprimer ni le modifier silencieusement.

## 4. Invariants conceptuels

1. Le signalement initial est conservé même s'il est rejeté ou rattaché à un dossier existant.
2. Une observation n'est pas une mission : plusieurs observations peuvent alimenter un dossier unique.
3. La localisation GPS aide à situer le dépôt ; elle ne détermine pas automatiquement l’équipe à choisir. Le choix dépend de la catégorie qualifiée, des compétences valides et de la décision d’un responsable habilité.
4. La catégorie affectée doit faire partie du contenu qualifié du dossier et être à traiter, pas retirée du périmètre.
5. La compétence retenue doit appartenir à la même équipe et à la même catégorie que l'affectation, et être valide à la date d'affectation.
6. Une catégorie d'un dossier ne peut avoir qu'une seule affectation courante ; une réaffectation conserve l'affectation antérieure.
7. Une fin d'intervention n'est pas équivalente à une résolution confirmée.
8. La vérification est enregistrée catégorie par catégorie puisque chaque affectation traite une seule catégorie.
9. Le dossier ne peut être déclaré entièrement résolu que lorsque chaque catégorie à traiter satisfait les critères de vérification, sauf clôture exceptionnelle motivée explicitement autorisée.
10. Un événement métier a une seule cible principale ; le changement métier et sa trace doivent être enregistrés de manière cohérente.
11. Aucun référentiel `ZONE` n'est utilisé dans le scénario initial. L'éventuelle affectation territoriale par limites administratives est hors périmètre.

## 5. Diagramme conceptuel

Le code source de diagrammes Mermaid réutilisables figure dans `diagrammes-mcd.md`. Il sépare les liens entre acteurs et rôles, observation/dossier et affectations/interventions afin de garder le modèle lisible.

## 6. Limites

Le MCD est stabilisé pour un scénario académique mais non validé avec un opérateur de terrain. Le barème de priorité, les critères de résolution, les catégories spécialisées et les règles de conservation doivent être justifiés comme hypothèses jusqu'à obtention d'une validation métier. Une comparaison exhaustive des outils existants n'est pas présentée comme réalisée.
