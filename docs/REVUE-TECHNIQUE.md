# Revue technique complète — ISI-Eco Report

**Date de revue :** 21 octobre 2026  
**Périmètre :** code, configuration, tests, modèles et documentation textuels présents dans le dépôt, hors dépendances et sorties générées.  
**Nature :** revue de conception et inspection statique ; il ne s’agit ni d’un test d’intrusion ni d’une validation en production.

> **Mise à jour au 23 octobre 2026 :** cette revue décrit l’état observé le 21 octobre.
> Plusieurs points ont depuis été corrigés dans le code ; le tableau « État des corrections »
> plus bas fait foi pour leur statut actuel. Les risques liés au déploiement, aux sauvegardes
> et à la validation métier ne sont pas considérés comme résolus.

## 1. Synthèse exécutive

ISI-Eco Report est un monorepo de projet de fin d’études qui met en œuvre une plateforme de signalement et de suivi de dépôts de déchets. Il comprend une API Fastify, un portail React, une application Expo/React Native et un package TypeScript partagé. Le parcours métier est cohérent dans son intention : séparer l’observation citoyenne du dossier opérationnel, affecter les catégories à des équipes compétentes, consigner l’intervention et faire vérifier le résultat avant la clôture.

Les fondations sont solides pour un prototype académique : contrôle des rôles côté serveur, transactions autour de plusieurs opérations métier, contraintes relationnelles dans les schémas SQL, déduplication idempotente de certaines commandes, traitement des photos et tests d’acceptation API. La documentation distingue explicitement les hypothèses du scénario des faits qui nécessiteraient une validation auprès d’un organisme opérationnel.

Le dépôt n’est toutefois **pas prêt à être traité comme un service de production** sans durcissement et clarification. Les points les plus importants relevés sont :

1. des secrets de développement sont utilisés par défaut sans refus explicite en production ;
2. les valeurs d’API mobile sont configurées en HTTP par défaut, tandis que les sessions utilisent des jetons porteurs ;
3. la politique CORS accepte les origines sur une comparaison par sous-chaîne plutôt que par liste exacte ;
4. les sessions et l’offline mobile exigent une meilleure protection des secrets et des actions en attente ;
5. le logger Fastify est désactivé alors que le gestionnaire d’erreurs appelle `req.log` ;
6. certaines descriptions, scripts et chemins documentaires ne correspondent pas aux fichiers ou comportements constatés.

Ces éléments sont des constats d’inspection. Leur exploitabilité et leur impact en environnement réel dépendent de la configuration de déploiement et n’ont pas été vérifiés par test.

## 2. Périmètre et méthode

L’inventaire de travail a compté **294 fichiers** dans le périmètre retenu : **254 fichiers textuels (1 558 466 octets)** et **40 fichiers binaires**. Les textes couvrent les applications API/Web/Mobile, le package partagé, les configurations racine, le lockfile, les tests et les documents Merise. Le lockfile a été lu sur ses 11 712 lignes et ses 855 entrées de paquets ont été vérifiées. Les binaires (images, icônes, diagrammes, wrapper JAR et keystore) ont été inventoriés mais non interprétés. Les dépendances et sorties générées ont été exclues.

Le répertoire présent contenait déjà des modifications locales et 18 chemins `.tmp.driveupload` signalés comme supprimés par Git ; ils n’ont pas été restaurés. Aucun code applicatif n’a été modifié pour cette revue.

Les références ci-dessous pointent vers les sources du dépôt. Les formulations « observé » ou « vérifié par lecture » ne signifient pas qu’un comportement a été exécuté. Aucun build, test, scan de dépendances, contrôle de configuration déployée ou test d’intrusion n’a été lancé dans le cadre de la revue.

## 3. Vue d’ensemble de l’architecture

```text
┌────────────────────────┐       ┌──────────────────────────┐
│ Portail Web React      │       │ App mobile Expo / RN     │
│ cookie de session      │       │ jeton Bearer + stockage  │
│ rôles et vues métier   │       │ citoyen / terrain        │
└───────────┬────────────┘       └────────────┬─────────────┘
            └──────────────┬─────────────────┘
                           │ HTTP / JSON / multipart
                           ▼
                ┌───────────────────────────┐
                │ API Fastify               │
                │ auth, RBAC, validation,   │
                │ routes métier, Swagger   │
                └───────┬───────────┬───────┘
                        │           │
             SQL / transaction      │ fichiers images privés
                        ▼           ▼
                ┌────────────┐  ┌───────────────────┐
                │ PostgreSQL │  │ UPLOAD_DIR         │
                │ par défaut │  │ stockage persistant│
                └────────────┘  └───────────────────┘

                ┌───────────────────────────┐
                │ @isieco/shared            │
                │ enums, schémas Zod, DTO   │
                └───────────────────────────┘
```

### 3.1 Racine et espaces de travail

Le dépôt est géré par npm workspaces : `apps/*` et `packages/*`. Les scripts racine centralisent démarrage, test, build et vérification TypeScript. La configuration commune TypeScript active le mode strict et cible ES2022/NodeNext. Voir [package.json](../package.json), [tsconfig.base.json](../tsconfig.base.json) et [package-lock.json](../package-lock.json).

### 3.2 API

L’API est construite dans [app.ts](../apps/api/src/app.ts) et lance le serveur via [server.ts](../apps/api/src/server.ts). Elle enregistre Swagger, les plugins de sécurité et d’authentification, la gestion multipart, un endpoint de santé, puis les modules d’authentification, utilisateurs, référentiels, signalements, qualification, dossiers, affectations, interventions, vérifications, événements, points, notifications et statistiques/cartographie.

Les routes HTTP délèguent aux cas d’usage ; les ports applicatifs sont implémentés dans l’infrastructure Prisma assemblée par le point de composition. PostgreSQL est le moteur runtime. L’ancien adaptateur SQL ne sert plus qu’aux tests et aux seeds historiques. Voir [composition-root.ts](../apps/api/src/composition-root.ts), [application](../apps/api/src/application), [infrastructure](../apps/api/src/infrastructure) et [schéma Prisma](../apps/api/prisma/schema.prisma).

### 3.3 Portail Web

Le portail React/Vite utilise React Router, Tailwind/PostCSS, Leaflet, Three.js et Lucide. [App.tsx](../apps/web/src/App.tsx) définit les routes protégées et les listes de rôles attendues ; [AuthContext.tsx](../apps/web/src/context/AuthContext.tsx) gère la session côté interface ; [client.ts](../apps/web/src/api/client.ts) appelle l’API avec les cookies.

Les vues couvrent le tableau de bord et la carte, la qualification, les dossiers, les affectations, les vérifications, les statistiques, l’audit, les comptes, les référentiels et le profil. Le tableau de bord peut montrer une carte Leaflet ou une scène 3D schématique. Cette scène n’est pas une carte géographique réelle ; la documentation du projet le précise. Les contrôles d’accès du navigateur améliorent l’expérience, mais la sécurité repose sur les gardes des routes API.

### 3.4 Application mobile

L’application Expo/React Native comprend deux parcours principaux : citoyen (création et suivi de signalements, points, notifications, profil) et terrain (missions, démarrage d’intervention, compte rendu et photo facultative). Le routage par rôle est dans [RootNavigator.tsx](../apps/mobile/src/navigation/RootNavigator.tsx) ; les appels serveur et l’authentification mobile sont dans [api.ts](../apps/mobile/src/services/api.ts) et [AuthContext.tsx](../apps/mobile/src/context/AuthContext.tsx).

Une file locale AsyncStorage permet de mettre en attente la création d’un signalement et la fin d’une intervention. Sur iOS/Android, les contenus sont chiffrés en AES-GCM avec une clé du coffre sécurisé du système ; sur Web, AsyncStorage reste en clair et ne doit pas être considéré comme un stockage confidentiel. Les files natives sont séparées par compte et migrées sans suppression avant écriture vérifiée. Les créations de signalement transmettent une clé idempotente persistée dans PostgreSQL avec le signalement. La capacité reste une synchronisation partielle : l’état en ligne est simulé manuellement et la synchronisation est déclenchée par l’utilisateur. Voir [offlineQueue.ts](../apps/mobile/src/services/offlineQueue.ts) et [OfflineContext.tsx](../apps/mobile/src/context/OfflineContext.tsx).

### 3.5 Package partagé

[@isieco/shared](../packages/shared/src/index.ts) centralise les enums, schémas Zod et types utilisés par les applications. Cela réduit les divergences de contrat, même si la couverture des réponses API et la validation à chaque frontière restent inégales.

## 4. Flux de données métier

### 4.1 Déclaration et qualification

1. Le citoyen envoie une description, une ou plusieurs catégories de déchets et une localisation GPS ou textuelle ; une photo peut être ajoutée.
2. L’API valide les données et conserve le signalement sous son auteur, ainsi que son contenu et ses métadonnées.
3. Une personne habilitée examine le signalement, peut rechercher des doublons candidats, puis l’accepte, demande une suite ou le rejette avec historique.
4. Une observation acceptée peut être rattachée à un dossier existant ou contribuer à la création d’un dossier. Les observations initiales ne sont pas censées être effacées lors d’un rapprochement.

Le parcours est visible notamment dans [signalements.routes.ts](../apps/api/src/modules/signalements/signalements.routes.ts) et [qualification.routes.ts](../apps/api/src/modules/qualification/qualification.routes.ts).

### 4.2 Dossier, catégories et affectation

1. Le responsable de traitement qualifie le cas et ses catégories, confirme que le lieu est exploitable et détermine une priorité.
2. Chaque catégorie incluse constitue un volet de traitement du dossier.
3. Un responsable affecte chaque volet à une équipe dont la compétence correspondante est valide ; une clé d’idempotence est utilisée pour prévenir la répétition de certaines commandes.
4. Les dates, décisions et changements d’affectation sont historisés.

Les opérations de dossier et d’affectation se trouvent dans [dossiers.routes.ts](../apps/api/src/modules/dossiers/dossiers.routes.ts) et [affectations.routes.ts](../apps/api/src/modules/affectations/affectations.routes.ts).

### 4.3 Intervention, vérification et clôture

1. L’équipe démarre l’intervention et produit un compte rendu avec un résultat contrôlé.
2. Le compte rendu de l’équipe ne vaut pas, à lui seul, preuve de résolution.
3. Une vérification distincte est enregistrée par affectation/catégorie.
4. La clôture résolue dépend de la confirmation des catégories incluses ; une réouverture réintroduit un traitement à suivre et préserve les décisions antérieures.

Les modules correspondants sont [interventions.routes.ts](../apps/api/src/modules/interventions/interventions.routes.ts) et [verifications.routes.ts](../apps/api/src/modules/verifications/verifications.routes.ts).

### 4.4 Événements, indicateurs et cartes

Les événements métier enregistrent les décisions et changements avec acteur, origine, cible, dates, motif et données de contexte. Les corrections sont conçues comme de nouvelles traces. La carte assemble des points issus des dossiers, signalements et interventions ; les statistiques séparent observations reçues, dossiers, affectations, interventions, résolutions vérifiées et réouvertures. Voir [evenements.routes.ts](../apps/api/src/modules/evenements/evenements.routes.ts) et [carte-stats.routes.ts](../apps/api/src/modules/carte-stats/carte-stats.routes.ts).

## 5. Sécurité et données sensibles

### 5.1 Actifs et frontières de confiance

| Actif | Frontière / acteur | Risques principaux à maîtriser |
|---|---|---|
| Comptes, mots de passe et sessions | Web/mobile ↔ API ↔ base | Vol de jeton, brute force, session trop longue ou révocation incomplète. |
| Rôles et commandes métier | API ↔ base | Escalade de privilèges, contrôle d’accès uniquement côté interface, autorisation non liée à l’équipe/ressource. |
| Coordonnées et descriptions | Citoyen/mobile ↔ API ↔ carte | Exposition de données personnelles ou localisation trop précise. |
| Photos et pièces jointes | Multipart ↔ traitement image ↔ stockage privé | Fichier malveillant, accès non autorisé, conservation excessive, perte lors d’un déploiement. |
| Historique et audit | Routes métier ↔ base | Effacement ou correction non traçable, accès trop large à l’historique. |
| File hors ligne | Appareil mobile ↔ AsyncStorage ↔ API | Perte de la clé locale, données Web en clair, reprise incomplète d’autres opérations. |
| Dépendances d’interface | Navigateur ↔ CDN / fournisseurs de tuiles | Disponibilité, confidentialité des requêtes réseau, chaîne d’approvisionnement. |

### 5.2 Contrôles déjà présents

- La session API est vérifiée côté serveur : présence, activité, expiration, état du compte et rôles actifs ; les routes métier appliquent des rôles autorisés.
- Les requêtes SQL utilisent des paramètres dans les adaptateurs et les modules consultés.
- Plusieurs opérations métier sont transactionnelles et les migrations définissent des clés, contraintes `CHECK` et index uniques, notamment pour les affectations/vérifications courantes.
- Les mots de passe sont hachés avec scrypt et un sel aléatoire ; les mots de passe ne sont pas réversibles.
- Les photos sont limitées en taille, validées par type déclaré, signature et décodage, puis ré-encodées avec Sharp. Les routes de consultation protégées vérifient les droits d’accès.
- Le portail utilise un cookie HttpOnly, et les parcours mobile utilisent un en-tête Bearer.
- Les règles métier documentent minimisation des données, séparation des rôles et distinction entre intervention déclarée et résolution vérifiée.

Sources : [auth.plugin.ts](../apps/api/src/plugins/auth.plugin.ts), [crypto.ts](../apps/api/src/core/crypto.ts), [private-image-storage.ts](../apps/api/src/core/private-image-storage.ts), [security.plugin.ts](../apps/api/src/plugins/security.plugin.ts) et les migrations SQL.

### 5.3 Constats sécurité et risques

Les priorités sont estimées à partir du code lu, non d’une exploitation. **P1** signifie à traiter avant toute mise en production ; **P2** signifie important à corriger ou à décider avant une exposition réelle ; **P3** est une amélioration de qualité/continuité.

| ID | Priorité | Constat vérifié par lecture | Risque / recommandation |
|---|---|---|---|
| SEC-01 | **P1 — Élevée** | [config.ts](../apps/api/src/config.ts) utilise des valeurs de repli fixes pour `JWT_SECRET` et `COOKIE_SECRET`. Seul le chemin `UPLOAD_DIR` est explicitement validé en production. | Un déploiement omettant les variables peut conserver des secrets connus. Exiger des secrets aléatoires forts en production, valider longueur/présence au démarrage et supprimer les secrets fictifs en mode production. |
| SEC-02 | **P1 — Élevée** | [app.json](../apps/mobile/app.json) configure `http://10.0.2.2:3001` et `http://localhost:3001` ; [api.ts](../apps/mobile/src/services/api.ts) prévoit aussi HTTP par défaut. L’application transporte un jeton Bearer. Le manifeste debug autorise explicitement le trafic en clair. | HTTP ne protège pas les identifiants, jetons ni données contre l’observation/modification sur le réseau. Imposer HTTPS pour les builds distribués, séparer explicitement les configurations développement/production et vérifier le manifeste du build de release. Le présent constat porte sur les valeurs par défaut ; les builds de production n’ont pas été examinés. |
| SEC-03 | **P2 — Moyenne** | [security.plugin.ts](../apps/api/src/plugins/security.plugin.ts) autorise une origine si sa chaîne contient `localhost` ou `127.0.0.1`, avec `credentials: true`. | Une vérification par sous-chaîne n’est pas une allowlist d’origines. Comparer des origines normalisées à une liste exacte configurée par environnement ; refuser les origines non prévues. |
| SEC-04 | **P2 — Moyenne** | [auth.routes.ts](../apps/api/src/modules/auth/auth.routes.ts) met le jeton dans le cookie Web et le renvoie également dans le corps de réponse ; [auth.plugin.ts](../apps/api/src/plugins/auth.plugin.ts) compare la valeur du jeton fournie à la valeur stockée en base. | Pour le Web, le corps rend le secret accessible au JavaScript appelant et augmente l’impact d’une injection côté client. Ne retourner le jeton qu’au client mobile et, en défense en profondeur, ne stocker qu’un hash du jeton de session côté serveur. |
| SEC-05 | **P2 — Moyenne** | Aucun middleware de limitation de débit ou de tentative n’a été trouvé dans la composition API consultée ; le login effectue une vérification de mot de passe. | Le point de connexion peut être soumis à des tentatives répétées. Ajouter des limites proportionnées par compte/IP, temporisation progressive, métriques et alertes, sans permettre un déni de service facile contre un compte ciblé. |
| SEC-06 | **P2 — Moyenne** | [offlineQueue.ts](../apps/mobile/src/services/offlineQueue.ts) stocke les actions dans une clé globale non liée à un utilisateur. Le logout dans [AuthContext.tsx](../apps/mobile/src/context/AuthContext.tsx) ne purge ni ne partitionne cette file. | Une action créée hors ligne sous un compte peut être synchronisée après connexion d’un autre compte sur le même appareil. Associer chaque élément à l’identifiant du propriétaire, vérifier l’identité avant synchronisation et définir un comportement explicite au logout (conserver chiffré, demander confirmation ou effacer). |
| SEC-07 | **P2 — Moyenne** | `getPendingActions()` dans [offlineQueue.ts](../apps/mobile/src/services/offlineQueue.ts) intercepte toute erreur de lecture/parsing et renvoie `[]`. | Une file corrompue ou une erreur de stockage ressemble à une file vide ; un ajout ultérieur peut remplacer les éléments en attente et masquer une perte de données. Valider le schéma, distinguer erreur de stockage et file vide, conserver les données brutes récupérables et afficher une erreur claire. |
| SEC-08 | **P2 — Moyenne** | [app.ts](../apps/api/src/app.ts) configure `logger: false`, tandis que [security.plugin.ts](../apps/api/src/plugins/security.plugin.ts) appelle `req.log.warn/error`. | Les journaux d’accès refusé et d’erreurs inattendues peuvent être absents ou inexploitables dans cette configuration. Vérifier le comportement concret de Fastify, puis activer un logger structuré en dehors des tests, avec filtrage des secrets et identifiants de corrélation. |
| SEC-09 | **P2 — Moyenne** | Le endpoint de santé dans [app.ts](../apps/api/src/app.ts) renvoie `err.message` de la base dans la réponse en cas d’échec. | Une route non authentifiée peut révéler des détails internes de connexion ou de base. Renvoyer une réponse générique et garder le détail dans un journal serveur protégé. |
| SEC-10 | **P2 — Moyenne** | [AuthContext mobile](../apps/mobile/src/context/AuthContext.tsx) charge token et utilisateur via `loadStoredAuth`; la persistance est dans AsyncStorage, non un coffre sécurisé du système d’exploitation. | Un appareil compromis ou sauvegardé peut exposer des jetons porteurs. Utiliser le stockage sécurisé Keychain/Keystore pour le secret et minimiser les données personnelles persistées. |
| SEC-11 | **P2 — Moyenne** | Le schéma de session contient un `token` unique et les routes utilisent sa valeur en clair pour retrouver la session ([migration PostgreSQL](../apps/api/src/db/migrations/001_full_system_schema.sql), [auth.plugin.ts](../apps/api/src/plugins/auth.plugin.ts)). | Une lecture de la table peut immédiatement révéler des sessions actives. Stocker un condensat à sens unique du jeton, invalider les sessions existantes à la migration et tester la révocation. |

Le contrôle des cookies, de la protection CSRF, des en-têtes de sécurité, des règles réseau, des permissions de fichiers en production et des droits SQL a été inspecté statiquement mais **pas testé de bout en bout**. La stratégie de rétention et de suppression des photos et données personnelles reste à formaliser avec le responsable métier.

### État des corrections au 23 octobre 2026

| Constats antérieurs | État actuel |
|---|---|
| SEC-01 / Q-01 — secrets de développement utilisables en production | Corrigé dans le code : production exige `COOKIE_SECRET`, URL PostgreSQL, URL d’upload absolue et origines CORS. L’ancien `JWT_SECRET` inutilisé a été retiré. Le déploiement réel reste à configurer et vérifier. |
| SEC-02 — API mobile en HTTP | Les builds déclarés production exigent `EXPO_PUBLIC_API_URL` en HTTPS ; aucun build de release n’a encore été contrôlé. |
| SEC-03 — CORS par sous-chaîne | Corrigé : liste d’origines exactes, paramétrée par `CORS_ORIGINS` en production. |
| SEC-04 / SEC-11 — jeton de session exposé ou stocké en clair | Corrigé dans le code : réponse Web sans jeton, empreinte SHA-256 en base. Les trois migrations ont été appliquées sur la base locale de staging réinitialisée, qui ne contenait plus de session ; la production n’a pas été migrée. |
| SEC-05 — essais répétés de connexion | Limite de 8 tentatives par IP sur 15 minutes ajoutée. Le stockage est en mémoire par processus ; un déploiement multi-instance doit fournir un magasin partagé. |
| SEC-08 / SEC-09 — journaux et endpoint de santé | Corrigé dans le code : journalisation hors tests avec champs sensibles masqués, santé en erreur générique `503`, détails d’erreur non renvoyés au client. |
| SEC-10 — jeton mobile dans AsyncStorage | Corrigé sur iOS/Android avec SecureStore et migration à la lecture de l’ancien stockage. Le build natif n’a pas été exécuté. |
| SEC-06 / SEC-07 — file offline globale, erreurs masquées | Partiellement corrigé : files natives chiffrées et partitionnées par compte, validation/migration prudente des données, erreurs visibles et archive chiffrée des actions anciennes sans propriétaire. Le stockage Web reste en clair et doit faire l’objet d’une décision dédiée avant de promettre une protection équivalente ; la synchronisation mobile reste limitée à certains types d’action. |
| Réponse réseau perdue après création mobile | Corrigé dans le code pour la création d’un signalement : clé idempotente liée au compte et empreinte canonique du contenu, avec conflit explicite si la même clé est réutilisée pour un autre contenu. La migration PostgreSQL correspondante n’est pas encore appliquée à une base. Les opérations photo et clôture d’intervention n’ont pas de clé idempotente persistée. |
| Dépendances — avis npm de sévérité élevée | Prisma a été migré vers 7.10.1 ; l’audit npm ne signale plus d’avis Prisma. `npm audit --audit-level=high` signale encore quatre avis élevés transitifs liés à `node-forge` (version affectée jusqu’à 1.4.0) dans la chaîne Expo CLI / certificats de signature ; aucune version corrigée compatible n’est publiée dans cette chaîne au moment du contrôle. npm ne propose qu’un retour majeur à Expo 44, qui n’a pas été appliqué. Les migrations restent exécutées dans un job isolé avec les dépendances de développement. |
| Q-03 / Q-06 — migration/seed inexistants et SQLite annoncé | Prisma 7, la génération du client, la validation du schéma, le build et la suite de tests sont vérifiés ; SQLite a été retiré. Les trois migrations Prisma ont été appliquées sur `isieco_dev` (PostgreSQL local DBngin), après autorisation explicite de réinitialiser son schéma `public`. La base contient maintenant les 37 tables applicatives attendues et l’historique Prisma ; la production n’a pas été migrée. |
| Q-04 — documentation du jeton et du rayon de doublon | Partiellement corrigé : les éléments de schéma OpenAPI et le rayon annoncé ont été réalignés ; la description narrative détaillée doit encore être contrôlée. |

Les résultats de tests de développement ne prouvent ni une couverture à 100 % des exigences métier ni la gestion de toutes les exceptions possibles. Une matrice exhaustive exige une validation des règles et scénarios par les responsables métier.

## 6. Points forts

1. **Modèle métier intelligible.** Les documents distinguent observation, dossier, rattachement, affectation, intervention, vérification et événement ; cela évite de confondre un signalement citoyen avec une mission ou une résolution. Voir [architecture métier](merise/architecture.md) et [modèle logique](merise/models/mld.md).
2. **Traçabilité pensée dès la conception.** Les décisions ont un acteur, des dates, une cible typée et un motif ; la correction est conçue comme une trace supplémentaire plutôt qu’un effacement silencieux.
3. **Séparation de la résolution et du compte rendu.** La clôture attend la vérification des volets inclus ; plusieurs catégories peuvent être traitées indépendamment.
4. **Contrôles de données au bon niveau.** Le modèle SQL utilise des clés étrangères, contraintes de dates et unicités pour plusieurs invariants métier, plutôt que de tout laisser à l’interface.
5. **Autorisations côté serveur.** L’API expose `authenticate`/`authorize` et les routes contrôlent les rôles. Les protections d’interface sont donc complémentaires, non seules garantes de l’accès.
6. **Prévention de certaines répétitions.** Les opérations d’affectation prennent en compte l’idempotence et plusieurs flux associent la modification métier à l’événement correspondant dans une transaction.
7. **Traitement raisonnable des images.** Taille maximale, vérification de format, ré-encodage, suppression des métadonnées par traitement et stockage privé réduisent les risques liés aux uploads.
8. **Types et contrats partagés.** Enums et schémas Zod constituent une base commune aux applications.
9. **Scénarios d’acceptation utiles.** Les tests API couvrent auth/RBAC, signalements, qualification, affectations, interventions/clôture, audit/idempotence, statistiques/transferts, profil et documentation Swagger.
10. **Prudence documentaire.** La documentation indique que le partenaire et les processus réels ne sont pas confirmés, ne revendique pas de supériorité sur SetalMa et identifie les hypothèses à vérifier.

## 7. Problèmes, écarts et dette technique

| ID | Priorité | Constat | Conséquence |
|---|---|---|---|
| Q-01 | **P1 avant déploiement** | Les valeurs de secrets et d’URL HTTP décrites plus haut ne donnent pas une configuration de production sûre par défaut. | Risque d’exposition de sessions/données si les variables ou profils de build sont mal configurés. |
| Q-02 | **P2** | Le README décrit des répertoires `docs/architecture`, `docs/product`, `docs/specs-pfe` et lie plusieurs fichiers absents de l’arborescence actuelle ; le contenu documentaire réel est sous `docs/merise`. | Un nouveau contributeur suit des liens morts et ne sait pas quel document fait autorité. Voir [README](../README.md). |
| Q-03 | **P2** | `@isieco/api` déclare `migrate:pg` vers `src/db/migrator.ts` et `seed:pg` vers `src/db/seeds/seed_personas.ts`, mais ces fichiers n’étaient pas présents dans l’inventaire. | Ces scripts ne peuvent pas fonctionner tels que référencés ; le chemin de création de base et de données initiales n’est pas reproductible. Voir [package.json API](../apps/api/package.json). |
| Q-04 | **P2** | La documentation Swagger annonce un JWT mobile et une recherche de doublon `< 50 m`, alors que l’implémentation crée un jeton de session opaque stocké en base et filtre des candidats jusqu’à 500 m. | Contrats et attentes des opérateurs sont trompeurs ; une incohérence de seuil peut modifier le nombre de candidats présentés. Voir [Swagger](../apps/api/src/plugins/swagger.plugin.ts) et [qualification](../apps/api/src/modules/qualification/qualification.routes.ts). |
| Q-05 | **P2** | Le mode hors connexion est limité à deux types d’action, avec état réseau simulé, synchronisation manuelle et retours d’échec réduits à un compteur. Les brouillons en attente ne sont pas fusionnés dans la liste serveur. | Cela ne répond pas encore à une promesse de fonctionnement mobile hors connexion robuste ; il faut préciser le périmètre UX et garantir récupération, propriété, reprise et déduplication. |
| Q-06 | **P2** | L’API revendique un adaptateur PostgreSQL/SQLite, mais les tests Vitest configurent PostgreSQL et les routes contiennent du SQL PostgreSQL-spécifique, par exemple des casts `NULL::uuid`. | La compatibilité SQLite de l’ensemble des routes n’est pas démontrée ; l’adaptateur peut donner une fausse impression de parité. Choisir une seule cible de test ou ajouter une suite de compatibilité ciblée. |
| Q-07 | **P2** | Le traitement de dossier concentre une grande quantité de règles dans un module de routes (près de 900 lignes). Plusieurs endpoints de référentiels/utilisateurs chargent des détails par utilisateur/équipe. | Maintenance difficile, risques de duplication/régression et potentiel N+1 à mesure que le volume croît. Déplacer seulement la logique transactionnelle réutilisée vers des services testables et mesurer les requêtes avant optimisation. |
| Q-08 | **P2** | Les tests observés sont principalement côté API ; aucun fichier de test Web ou Mobile ni workflow `.github` de CI n’a été trouvé dans l’inventaire. Le typecheck API inclut `src`, pas le dossier `tests`. | Les régressions de navigation, formulaires, stockage local, accessibilité et synchronisation peuvent échapper aux contrôles automatisés. |
| Q-09 | **P3** | Le portail charge Inter et Leaflet depuis des CDN ; certaines icônes de marqueurs utilisent des URLs distantes. Le HTML fait référence à `/vite.svg`, absent des assets inventoriés. | Disponibilité et apparence dépendent de tiers ; la référence au favicon est cassée et les requêtes réseau externes doivent être assumées/documentées. |
| Q-10 | **P2** | Des documents Merise font référence à des chemins non présents, notamment une matrice de traçabilité et des sources UML Markdown ; les deux diagrammes présents sont des PNG binaires. | Traçabilité exigences → conception → tests incomplète et navigation documentaire fragile. |

Les écarts ci-dessus sont des anomalies de cohérence ou des risques de conception, pas tous des défauts immédiatement exploitables. La présence exacte et l’impact des lacunes ont été confirmés par inventaire et inspection du code ; aucune commande n’a été exécutée pour confirmer le comportement d’un script manquant ou d’un build particulier.

## 8. Recommandations priorisées

### Avant toute exposition en production — priorité P1

1. **Rendre la configuration fail-closed.** Valider au démarrage les secrets requis, leur entropie minimale, le type de base attendu, l’URL publique et les répertoires de stockage. Refuser les secrets `dev-*` en `NODE_ENV=production`.
2. **Sécuriser le transport.** Exiger HTTPS côté API et application mobile distribuée ; créer des profils d’environnement distincts plutôt que modifier les URL manuellement ; contrôler le manifeste Android et la configuration iOS de release.
3. **Remplacer CORS par une allowlist exacte.** Configurer les origines de développement et production séparément ; ajouter des tests qui couvrent les origines permises, refusées et les cas d’origines similaires.
4. **Renforcer la gestion de session.** Ne pas renvoyer le jeton dans la réponse Web ; stocker une empreinte du jeton côté serveur ; vérifier expiration, révocation, rotation et fermeture au changement de mot de passe.
5. **Protéger l’authentification contre les essais massifs.** Ajouter un rate limit et une observation des tentatives sans exposer si une adresse existe.
6. **Vérifier l’autorisation de chaque ressource.** Conserver les gardes API et ajouter des tests négatifs systématiques pour propriété d’un signalement, appartenance à une équipe, consultation d’image, audit, rôle Admin et accès entre comptes.

### Fiabilité et intégrité des données — priorité P2

1. **Finaliser la file mobile avant de promettre l’offline.** Le chiffrement natif, le partitionnement utilisateur, la validation et l’idempotence des créations de signalement sont en place. Il reste à décider si la file Web doit être désactivée ou chiffrée via un coffre IndexedDB, ajouter une idempotence aux autres mutations reprises et tester des scénarios de panne sur appareil.
2. **Rendre la persistance reproductible.** Fournir un runner de migration réellement présent, une séquence de seed démonstration idempotente et des instructions de restauration/sauvegarde cohérentes. Tester les migrations depuis une base vide et une version précédente.
3. **Décider la stratégie de base.** Si PostgreSQL est la cible, réduire l’illusion de support SQLite ou documenter précisément sa portée ; si les deux sont requis, tester les mêmes contrats métier sur les deux moteurs.
4. **Vérifier la cohérence atomique des événements.** Les commandes, transitions, événements et statuts calculés doivent réussir ou échouer ensemble ; ajouter des contrôles DB là où une règle doit résister aux écritures concurrentes.
5. **Protéger les files et photos contre les pertes.** Définir conservation, sauvegarde, chiffrement au repos, permissions du volume, suppression et restauration testée de la base et des images ensemble.

### Observabilité et exploitation — priorité P2

1. Activer un logger structuré hors test avec politique de masquage pour mot de passe, cookies, jetons, corps de photo et données personnelles.
2. Remplacer la réponse de santé détaillée par un statut générique ; journaliser côté serveur avec identifiant de corrélation.
3. Distinguer les vérifications de vie et de disponibilité dépendante de la base ; documenter la signification des codes HTTP et des alertes.
4. Définir métriques utiles : taux d’échec de synchronisation mobile, délai de traitement, erreurs d’upload, taille de file, échecs de clôture et latence API.

### Qualité produit, tests et maintenance — priorité P2/P3

1. Ajouter une CI reproductible : installation lockfile, typecheck, tests API, build Web et contrôles de configuration ; conserver les journaux de diagnostic.
2. Ajouter des tests de composant/navigation Web et mobile, puis des tests E2E ciblés des parcours de bout en bout et de leurs erreurs.
3. Valider les contrats partagés à l’entrée de l’API et à la sortie client ; éviter les formes `any` dans la file offline et les réponses non typées.
4. Aligner README, Swagger, règles métier, seeds et comportement code (JWT/session, seuil de doublon, scripts disponibles, chemin de documents).
5. Découper progressivement les routes trop volumineuses quand une logique transactionnelle partagée ou difficile à tester le justifie ; ne pas faire de refonte générale sans besoin mesuré.
6. Héberger localement les ressources UI essentielles ou prévoir une dégradation acceptable sans CDN ; corriger la référence de favicon.

## 9. Feuille de route suggérée

| Étape | Résultat attendu | Critère de sortie |
|---|---|---|
| A. Clarification des contrats | Référentiel unique des rôles, statuts, distances, scripts, endpoints et exigences de rétention. | README, Swagger, règles et code ne se contredisent plus sur le parcours livré. |
| B. Baseline sécurité | Configuration production fail-closed, HTTPS, CORS strict, contrôle de débit, gestion durcie des jetons et journaux utiles. | Tests de configuration et tests d’accès négatifs passent ; aucune valeur de développement n’est utilisable en production. |
| C. Reproductibilité | Migrations et seeds documentés, installation et build automatisables. | Un environnement propre peut être construit et initialisé avec les commandes documentées. |
| D. Intégrité mobile | File hors ligne partitionnée et validée ; protection locale des données, reprise/idempotence et feedback d’échec à compléter. | Scénarios de changement de compte, perte réseau, échec partiel et reprise testés. |
| E. Qualité continue | CI, tests Web/Mobile et parcours E2E ciblés ; contrôle contractuel du modèle. | Les régressions critiques sont détectées automatiquement sur chaque changement. |
| F. Exploitation | Politique de sauvegarde, rétention, observabilité et procédures de restauration. | Restauration DB + fichiers vérifiée et incidents diagnostiquables sans fuite de données. |

## 10. Conclusion et limites

Le projet a une **bonne base de démonstration fonctionnelle** et une modélisation métier étonnamment explicite pour un prototype. Sa meilleure qualité est la séparation entre observation, dossier, affectation, intervention et vérification, appuyée par des contraintes SQL et des tests métier.

La principale faiblesse n’est pas l’absence de fonctionnalités, mais l’écart entre le niveau de discipline décrit par les documents et les garanties réellement visibles pour la configuration, les déploiements, l’offline mobile, les journaux et les contrats documentaires. Les recommandations prioritaires visent donc à rendre les comportements sûrs par défaut, reproductibles et vérifiables plutôt qu’à ajouter davantage de fonctionnalités.

**Vérifié dans la dernière reprise :** génération du client Prisma 7.10.1, validation du schéma Prisma, build TypeScript API, suite API complète (69 tests), statut des migrations « up to date » et présence des trois migrations appliquées sur `isieco_dev`, 37 tables applicatives, aucun compte/session pré-seedé, tests mobiles (5 tests après retrait du changement hors périmètre), typecheck mobile et export du bundle JavaScript Android avec URL HTTPS. Un build Web avait également réussi lors d’une vérification antérieure ; il n’a pas été relancé dans cette reprise.

**Non vérifié / restant :** migrations sur une base de production, build natif (Java/Android SDK absents de cet environnement), configuration réelle de production, scénarios réseau sur appareils, sécurité dynamique, charge, sauvegardes et conformité juridique. L’audit npm a été exécuté : quatre avis élevés transitifs liés à `node-forge` restent sans correctif compatible identifié et ne doivent pas être masqués par une mise à niveau majeure non compatible. Les choix de finalité, base légale, durée de conservation, personnes habilitées et fonctionnement terrain doivent être confirmés avec les parties responsables avant tout pilote réel.
