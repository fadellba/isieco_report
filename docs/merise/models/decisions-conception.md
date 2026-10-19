---
title: Décisions de conception et points à arbitrer
project: ISI-Eco Report
version: 2.10
status: Modèle de travail pour un projet académique — hypothèses explicites, non validation terrain
---

# Décisions de conception

Ce document sépare les choix retenus pour cadrer le projet académique des faits qui ne sont pas établis. Le modèle cible peut être conçu sans étude terrain complète, à condition de présenter les choix opérationnels comme des hypothèses de simulation et de ne pas prétendre décrire une organisation réelle.

## 1. Décisions retenues pour le scénario académique

| ID | Décision retenue | Conséquence | Statut |
|---|---|---|---|
| DC-01 | La vision cible confirmée par le porteur couvre tout le Sénégal ; le périmètre de démonstration du PFE est Dakar. Aucun partenaire opérationnel n'est identifié. | Le mémoire distingue la vision nationale, le scénario de démonstration à Dakar et tout futur déploiement. Les données de démonstration sont fictives ; aucun organisme réel ni flux opérationnel réel n'est présumé. Le modèle reste mono-contexte et ne prouve pas une capacité opérationnelle nationale multi-organismes. | Validé par le porteur le 14/10/2026 ; niveau commune/quartier et jeu de données restent à préciser |
| DC-02 | ISI-Eco Report est une organisation fictive pour la conception et la simulation. | Le modèle ne doit pas affirmer qu'ISI-Eco Report dispose d'un mandat institutionnel réel. | Validé par le porteur du projet |
| DC-03 | `SIGNALEMENT` représente une observation citoyenne ; `DOSSIER_TRAITEMENT` représente le cas opérationnel pris en charge. | Préserve la provenance et évite de créer plusieurs missions pour des observations relatives au même dépôt. | Choix de conception retenu |
| DC-04 | Un signalement peut être rattaché à un dossier existant après vérification ; le rapprochement est historisé et corrigeable. | Les coordonnées similaires ne déclenchent jamais une fusion automatique. | Choix de conception retenu |
| DC-05 | Les coordonnées GPS constituent le moyen privilégié de localiser le dépôt, avec une description complémentaire si nécessaire. | Les coordonnées peuvent être absentes lors de la soumission mais une localisation exploitable est requise avant affectation. | Choix de conception retenu |
| DC-06 | Le modèle initial ne contient pas d'entité `ZONE`, de couverture de zone d'équipe ni de calcul automatique de compétence territoriale. | La localisation est consultée sur carte ; la sélection de l'équipe demeure une décision opérationnelle contrôlée. Ajouter un référentiel territorial seulement si un besoin démontré l'exige. | Choix de conception retenu |
| DC-07 | Une équipe possède une ou plusieurs compétences par catégorie de déchet ; une catégorie peut correspondre à plusieurs équipes compétentes. | Une association plusieurs-à-plusieurs historisée `COMPETENCE_EQUIPE` relie `EQUIPE` et `TYPE_DECHET`. | Choix de conception retenu |
| DC-08 | Une affectation concerne une seule catégorie d’un dossier et une seule équipe. | `AFFECTATION` référence le couple dossier/catégorie qualifié et conserve l’identifiant de compétence utilisé pour justifier l’affectation. Une équipe traitant deux catégories reçoit deux affectations. | Choix de conception retenu en v2.8 |
| DC-09 | Plusieurs affectations courantes peuvent coexister sur un dossier si elles concernent des catégories différentes. | Pour un couple dossier/catégorie, une seule affectation courante est permise. La vérification et la réaffectation sont ainsi suivies séparément pour chaque catégorie. | Choix de conception retenu en v2.8 |
| DC-10 | La fin d’une intervention ne clôture pas automatiquement le dossier. | Chaque affectation porte une seule catégorie ; la vérification est historisée par affectation et le dossier n’est résolu que si toutes les catégories à traiter sont vérifiées positivement. | Choix de conception retenu |
| DC-11 | Les statuts du signalement, du dossier, de l'affectation et de l'intervention sont séparés. | Une décision relative à une observation n'est pas l'avancement d'une opération ni la preuve de résolution. | Choix de conception retenu |
| DC-12 | Le journal d'événements utilise des références typées vers l'objet principal. | Renforce l'intégrité par rapport à une simple paire texte/identifiant, au prix d'un modèle explicite. | Choix de conception retenu |
| DC-13 | Le rôle Administrateur gère les comptes et les paramètres autorisés ; il ne reçoit pas automatiquement toutes les décisions opérationnelles. | La qualification, l'affectation, l'intervention et la vérification relèvent de fonctions distinctes, cumulables seulement si cela est explicitement autorisé dans le scénario. | Choix de conception retenu |
| DC-14 | Le prototype académique prévoit un compte citoyen. | Un parcours sans compte n'est pas inclus dans le premier périmètre ; ce choix ne constitue pas une recommandation universelle pour un déploiement réel. | Choix de périmètre retenu |
| DC-15 | Trois niveaux de priorité sont proposés : faible, normale et élevée. | Les critères de classement sont décrits comme règles du scénario, pas comme délais institutionnels officiels. | Choix de périmètre retenu |
| DC-16 | Le modèle initial ne contient pas d’entité `ORGANISATION` ni de rattachement organisationnel des comptes/équipes. | Le périmètre applicatif est unique par hypothèse ; l’identité des responsables réels est une validation de déploiement, et les transferts externes sont enregistrés par événement avec un libellé de destinataire. | Validé en v2.8 |
| DC-17 | Les points citoyens/récompenses sont hors périmètre initial. | La traçabilité des signalements ne dépend pas de la gamification. | Choix de périmètre retenu |
| DC-18 | Un mode hors connexion complet n'est pas inclus dans le périmètre initial. | Le parcours doit indiquer clairement l'échec d'envoi et éviter de prétendre qu'un signalement a été reçu s'il ne l'a pas été. | Choix de périmètre retenu |
| DC-19 | Une comparaison exhaustive de SetalMa et des autres pratiques ne sera pas présentée comme réalisée. | Le mémoire peut s'appuyer sur les informations publiques consultées et signaler que le fonctionnement interne et les résultats opérationnels n'ont pas été vérifiés. Aucune supériorité d'ISI-Eco Report ne doit être affirmée sans preuve. | Limite méthodologique acceptée |
| DC-20 | Les données personnelles sont limitées au nécessaire et les durées de conservation doivent être justifiées. | Les règles de protection et les formalités applicables doivent être vérifiées avant toute expérimentation réelle. | Principe retenu ; conformité à vérifier |
| DC-21 | Une catégorie qualifiée peut être retirée du périmètre sans effacer ses liens historiques. | `CONTENU_DOSSIER` conserve l’état `RETIRE`, le motif, la date et l’acteur ; la catégorie ne peut plus recevoir d’affectation courante. | Choix logique retenu en v2.8 |

## 1.1 Décisions de cadrage et de périmètre v2.10

| ID | Décision | Conséquence | Statut |
|---|---|---|---|
| DC-22 | Le parcours complet, du signalement jusqu’à l’intervention et à la vérification de résolution, est le cœur du MVP. | Le scénario principal doit être démontrable de bout en bout ; les fonctions secondaires passent après la validation de ce parcours. | Validé par le porteur |
| DC-23 | Le transfert à un organisme externe n’est pas un cas d’utilisation actif du MVP. | Le contexte UML ne présente pas de flux externe comme s’il était intégré ; la trace de transfert du modèle reste une capacité future documentée et non une intégration opérationnelle. | Décision de cadrage v2.10 |
| DC-24 | Le cas principal de démonstration utilise un signalement et une catégorie ; la conception conserve les scénarios avancés multi-signalements/multi-catégories comme cas de complexité élargie. | Le parcours vertical est prioritaire. Les fonctions avancées doivent garder leurs exigences et tests, mais ne bloquent pas la démonstration minimale si elles ne sont pas implémentées. | Décision de cadrage proposée v2.10 |
| DC-25 | Le statut `REOUVERT` est traité comme un événement/une commande, pas comme un état durable du dossier. Après réouverture, le dossier revient à `A_QUALIFIER`. | L’état fermé antérieur reste dans l’historique ; une reprise de catégorie exige une nouvelle affectation, sans réactiver silencieusement une affectation terminée. | Décision de modèle v2.10 |
| DC-26 | `statutDossier` est une synthèse matérialisée recalculée et enregistrée dans la même transaction que le changement métier et son événement. | L’état détaillé par catégorie/intervention alimente un calcul déterministe ; les opérations ne doivent pas laisser un statut global obsolète. | Décision de modèle v2.10 |
| DC-27 | La carte de signalements et les indicateurs élémentaires sont des fonctionnalités P2, à livrer après le parcours de bout en bout si le temps le permet. | Une carte opérationnelle de base et des indicateurs définis restent traçables au chapitre initial ; analyses avancées hors périmètre. | Cadrage MVP v2.10 |
| DC-28 | Les points/récompenses, le mode complètement hors connexion et l’intégration technique à des systèmes externes sont hors MVP. | Le signalement ne dépend pas d’une récompense ; l’échec d’envoi doit être explicite ; aucune synchronisation externe n’est simulée comme réelle. | Périmètre retenu |

## 2. Questions restantes pour un déploiement réel

Ces questions ne bloquent pas la conception académique si les hypothèses ci-dessus sont clairement annoncées. Elles devraient être confirmées avant de prétendre que le modèle reflète une pratique réelle ou avant toute mise en service.

| ID | Question ouverte | Preuve utile | Conséquence si non résolue |
|---|---|---|---|
| AR-01 | Quel niveau géographique précis à Dakar (commune/quartier), quels scénarios et quel jeu de données fictif utiliseront la démonstration ? | Découpage et scénario de démonstration consignés ; données de test identifiées comme fictives. | Dakar est validé comme périmètre de démonstration ; la sous-zone et les données restent à préciser. |
| AR-02 | Quel service réel pourrait recevoir, décider et exécuter les demandes ? | Entretien, accord ou procédure documentée. | ISI-Eco Report reste une simulation et ne peut revendiquer un destinataire opérationnel réel. |
| AR-03 | Quelles fonctions et limites présentent les solutions existantes dans la pratique ? | Étude plus approfondie ou démonstration par un acteur du domaine, si accessible. | La différenciation fonctionnelle ne peut pas être démontrée ; il faut présenter le projet comme une proposition de conception complémentaire. |
| AR-04 | Les équipes réelles traitent-elles des alertes, des sites, des dépôts ou des missions ? | Exemples anonymisés, entretien ou procédure. | La séparation signalement/dossier demeure une hypothèse de conception. |
| AR-05 | Quels critères permettent de reconnaître deux observations portant sur le même dépôt ? | Règle de rapprochement, acteur habilité et procédure de correction. | Le traitement proposé des doublons demeure une règle cible. |
| AR-06 | Qui est autorisé à qualifier, prioriser, affecter, exécuter et vérifier ? | Matrice des responsabilités approuvée par l'organisation réelle. | Les rôles demeurent ceux du scénario académique. |
| AR-07 | Les statuts et transitions retenus correspondent-ils au processus réel ? | Glossaire métier et cas d'exception validés. | Les statuts ne doivent pas être présentés comme standards institutionnels. |
| AR-08 | Quels éléments suffisent à confirmer la résolution ? | Procédure de contrôle et exigences de preuve d'un acteur compétent. | Les critères de clôture restent ceux du scénario proposé. |
| AR-09 | Quelles catégories de déchets exigent une équipe spécialisée ou une orientation externe ? | Référentiel de catégories et circuit de transfert validés. | La liste des catégories et des compétences d'équipe demeure illustrative. |
| AR-10 | Faut-il offrir un signalement sans compte ? | Test d'usage et décision d'un futur responsable de service. | Le prototype reste limité au compte citoyen. |
| AR-11 | Quelles données personnelles sont nécessaires et pendant combien de temps ? | Analyse des finalités, règles de conservation et vérification des obligations applicables. | Pas de mise en service réelle avant clarification. |
| AR-12 | Quels critères détaillés déterminent les trois niveaux de priorité ? | Règles écrites et validées par les responsables concernés. | Le barème doit être présenté comme une hypothèse académique. |
| AR-13 | Une future version doit-elle gérer plusieurs organismes indépendants ? | Besoin de gérer plusieurs organismes indépendants démontré, règles d’accès entre organismes et accords opérationnels. | Hors périmètre initial ; l’entité `ORGANISATION` n’est pas modélisée et pourra être réintroduite seulement si ce besoin est confirmé. |
| AR-14 | Les récompenses citoyennes ont-elles une utilité démontrée ? | Besoin établi, barème, garde-fous et recours. | La gamification demeure exclue du périmètre initial. |
| AR-15 | Quel niveau de service est nécessaire en cas de connexion instable ? | Essais avec des utilisateurs dans le territoire ciblé. | Seul un message d'échec d'envoi est prévu dans le premier périmètre. |
| AR-16 | Comment coordonner physiquement une équipe qui doit traiter plusieurs catégories lors d’une même tournée ? | Scénarios d’intervention validés et retour métier, si un opérateur devient accessible. | Le modèle de données retient une affectation par catégorie ; le regroupement logistique des interventions n’est pas modélisé dans le périmètre initial. |

## 3. Étude documentaire de l'existant : ce qu'on peut et ne peut pas dire

La base retient que SetalMa est publiquement présenté par la SONAGED comme une plateforme d'alerte citoyenne liée aux déchets. Cette information suffit à écarter une affirmation du type « aucune solution numérique n'existe au Sénégal ». Elle ne suffit pas à établir les fonctions internes, la couverture réelle, les délais, le taux de résolution ou les limites du dispositif.

Faute de temps et d'accès à une étude approfondie, la comparaison est limitée aux informations publiques consultables. La formulation recommandée dans le mémoire est donc :

> « L'examen documentaire préliminaire montre qu'il existe déjà des initiatives numériques de signalement, dont SetalMa. Le présent projet ne prétend ni remplacer ces dispositifs ni démontrer une supériorité fonctionnelle. Il propose un modèle de système d'information centré sur la qualification des observations, l'affectation par compétence, la traçabilité et la vérification des résultats. La pertinence de ce modèle en complément de l'existant devra être évaluée dans un contexte opérationnel réel. »

Cette formulation décrit honnêtement la portée du travail sans fabriquer un manque fonctionnel chez les solutions existantes.

## 4. Cohérence à maintenir

Toute modification doit être répercutée dans le MCD, le MLD, les règles de gestion, les acteurs, les cas d'utilisation, le cycle de vie, le dictionnaire de référentiels, les événements attendus et les tests. Les catégories affectées, les compétences historiques et les résultats de vérification doivent rester traçables.

## 5. Critères d'acceptation du modèle académique

- Le territoire, le caractère fictif de l'organisation et la limite de l'étude comparative sont explicitement présentés.
- Le sens de « signalement », « dossier », « compétence d'équipe », « affectation », « intervention » et « résolution vérifiée » est défini.
- Les cas de doublon, de catégorie inconnue, de compétence manquante, d'affectations spécialisées simultanées, d'échec, d'intervention partielle et de réouverture sont testés.
- Chaque transition possède un acteur autorisé, une date, un résultat et un motif si requis.
- Chaque affectation concerne une seule catégorie ; les vérifications sont liées à cette affectation et restent indépendantes entre catégories.
- Une catégorie retirée de la prise en charge reste conservée si elle possède un historique ; son retrait est daté, attribué et motivé.
- Les données personnelles et leur durée de conservation sont abordées comme exigences, même si la conformité complète n'est pas prétendue sans vérification.


| DC-29 | `ACCEPTE_POUR_RATTACHEMENT` et `RATTACHE` restent deux états distincts : décision positive sans lien actif, puis existence effective du lien. | Les statuts et la relation historisée restent cohérents ; test T03/T04 vérifie la différence. | Choix de conception retenu v2.10 |
