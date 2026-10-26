# ISI-Eco Report — Plateforme Municipale de Salubrité Urbaine (Dakar)

> **Territoire Pilote :** Ville de Dakar (Dakar-Plateau & Médina)  
> **Projet de Fin d'Études (PFE) — Institut Supérieur d'Informatique (ISI Dakar)**  
> **Stack Technologique :** PostgreSQL 17 (DBngin) • Fastify REST • React 19 (Vite + Tailwind CSS 4 + Leaflet + Three.js) • React Native 0.88 (Expo SDK 58)

---

## 1. Vue d'Ensemble du Système

**ISI-Eco Report** est un système d'information complet horizontal conçu pour moderniser, tracer et fiabiliser la gestion des déchets et des dépôts sauvages à Dakar.

Le système met en relation directe les **citoyens**, les **cellules communales de qualification et d'ordonnancement**, et les **équipes techniques de nettoiement sur le terrain**, avec une traçabilité immuable de chaque étape (règles RG01 à RG59).

---

## 2. Structure du Monorepo

```text
isieco-repport/
├── apps/
│   ├── api/                  # API REST Fastify (Auth Dual-Client, RBAC, 34 tests Vitest)
│   ├── web/                  # Back-Office Web (React 19, Leaflet, Three.js, Tailwind CSS 4)
│   └── mobile/               # App Mobile Nomade (Expo SDK 58, React Native 0.88, Offline-First)
│
├── packages/
│   └── shared/               # Enums MLD v2.13, schémas Zod, types TypeScript canoniques
│
├── docs/                     # Documentation et spécifications d'ingénierie
│   ├── architecture/         # Décisions d'architecture, MLD, structure, rapport de reprise
│   ├── product/              # Vision produit, design system, roadmap, plan d'implémentation
│   └── specs-pfe/            # Base de connaissances Merise/UML, diagrammes SVG/PNG, archives
│
├── AGENTS.md                 # Contrat de gouvernance et discipline d'ingénierie logicielle
├── package.json              # Configuration racine et scripts unifiés monorepo
├── tsconfig.base.json        # Configuration TypeScript partagée
└── README.md                 # Guide d'accueil et documentation de démarrage
```

### Architecture du backend API

Le backend Fastify sépare les responsabilités selon le sens des dépendances :

```text
modules/*                 Adaptateurs HTTP Fastify
        ↓
application/use-cases     Orchestration des cas d’usage
application/ports         Contrats des dépôts et services
domain                    Règles et erreurs métier
        ↑
infrastructure/*          Adaptateurs Prisma, stockage et sécurité

composition-root.ts       Assemblage des implémentations et injection
```

Les routes ne construisent pas de dépôts Prisma et ne contiennent pas de SQL ; elles traduisent les requêtes/réponses HTTP et délèguent aux cas d’usage. Les cas d’usage dépendent des ports, et l’infrastructure fournit leurs implémentations. Un modèle de domaine explicite est ajouté lorsque des règles ou invariants le justifient, plutôt que de créer des entités artificielles pour les simples lectures.

L’adaptateur SQL historique reste disponible pour le seed de démonstration ; il n’est plus utilisé par les routes runtime de l’API. Le schéma de données et les migrations Prisma restent séparés du code métier.

---

## 3. Prérequis Système

- **Node.js :** `^22.13.0`, `^24.3.0` ou `>= 26.0.0` (requis par Expo SDK 58)
- **Gestionnaire de paquets :** `npm` `>= 10.0.0`
- **Base de données :** PostgreSQL 17 (géré localement via DBngin ou service local sur le port `5432`)
  - Base de développement : `isieco_dev`
  - Base de test d'acceptation : `isieco_test`

---

## 4. Démarrage Rapide (Quick Start)

### Installation des dépendances

```bash
npm install
```

### Lancement des applications

| Composant | Commande Racine | Port / URL | Rôle Principal |
| :--- | :--- | :--- | :--- |
| **API REST** | `npm run dev:api` | `http://localhost:3001` | Backend Fastify & PostgreSQL |
| **Back-Office Web** | `npm run dev:web` | `http://localhost:5173` | Portail de gestion communale |
| **App Mobile** | `npm run dev:mobile` | `npx expo start` | App nomade citoyens & terrain |

Le tableau de bord Web propose une scène 3D schématique interactive des objets géolocalisés.
Elle visualise leurs positions relatives, mais ne représente pas le relief ni le bâti réels de Dakar ;
utilisez **Carte exacte** pour vérifier leur emplacement sur OpenStreetMap.

Les photos de signalement sont stockées dans le répertoire privé `uploads/` de l'API par défaut.
En production, `UPLOAD_DIR` doit désigner un chemin absolu vers un volume persistant, chiffré,
sauvegardé et accessible en lecture/écriture uniquement par le compte système de l'API. Placez-le
hors des répertoires servis par le web ou le proxy ; l'API ne sert les images qu'après authentification
et vérification des droits. Le démarrage en production échoue si `UPLOAD_DIR` n'est pas absolu.
Les photos sont re-encodées côté serveur pour retirer les métadonnées EXIF et l'orientation est
appliquée avant stockage. Définissez une politique de rétention et vérifiez régulièrement la
restauration conjointe de la base de données et des fichiers.

En production, configurez `DATABASE_URL`, `COOKIE_SECRET` (secret aléatoire d'au moins 32 caractères),
`CORS_ORIGINS` (liste exacte d'origines HTTPS séparées par des virgules)
et `UPLOAD_DIR` (chemin absolu). L'API refuse de démarrer si ces paramètres obligatoires sont
absents ou invalides. Terminez le TLS au niveau du reverse proxy et n'exposez pas le serveur
Fastify directement sur Internet sans cette terminaison HTTPS. La limitation des connexions est
en mémoire par processus ; un déploiement multi-instance nécessite un magasin partagé.
Pour un build mobile de production, définissez également `EXPO_PUBLIC_API_URL` sur l’URL HTTPS
publique de l’API. Cette URL est intégrée au build et les changements manuels d’URL sont réservés
aux builds de développement.

La purge des photos expirées est exécutée par un worker séparé de l’API. En production,
lancez `npm --workspace=@isieco/api run build`, puis `npm --workspace=@isieco/api run retention:photos:worker` sous un gestionnaire de processus
qui le redémarre après un arrêt ; fournissez-lui les mêmes `DATABASE_URL` et `UPLOAD_DIR` que l’API.
Le worker lance un cycle au démarrage puis toutes les 24 heures par défaut ; définissez
`PHOTO_RETENTION_INTERVAL_HOURS` à un entier de 1 à 168 pour modifier cette fréquence. Un verrou
advisory PostgreSQL empêche plusieurs workers de purger simultanément. Les journaux du processus
signalent les cycles réussis, les verrous détenus ailleurs et les erreurs ; surveillez les erreurs
dans votre système d’exploitation. En déploiement multi-instance, le worker et toutes les instances
qui accèdent aux photos locales doivent partager le même volume persistant `UPLOAD_DIR`.

Pour peupler une base de développement avec trois signalements illustrés sur la carte, lancez
`npm --workspace=@isieco/api run seed:demo` depuis la racine du dépôt. Ce seed est idempotent;
les photos sont des illustrations hors de Dakar et leurs licences sont documentées dans
[l'attribution des images de démonstration](docs/product/ATTRIBUTIONS-IMAGES-DEMO.md).
Le menu **Missions terrain** présente également les interventions non annulées liées à un dossier
géolocalisé; la position de la mission provient des coordonnées de ce dossier.
Les raccourcis de connexion et identifiants de démonstration ne sont affichés que dans le build
Web de développement.

---

## 5. Validation & Tests Automatisés

Le système intègre une suite de tests d'acceptation automatisés sur PostgreSQL pour les parcours
nominaux, les principales exceptions métier et les invariants de base de données. La matrice
T01–T39 documente aussi des scénarios qui ne sont pas tous automatisés ; voir
[l’audit de couverture métier](docs/audit-couverture-metier-api.md) pour les limites et les tests
effectivement exécutés :

```bash
# Exécuter les tests d'acceptation (Fastify + PostgreSQL isieco_test)
npm run test:api

# Vérification du typage strict TypeScript sur tous les modules
npm run typecheck

# Construction du bundle de production Web
npm run build:web
```

---

## 6. Comptes de démonstration Back-Office

Le seed Dakar crée les deux comptes de test affichés sur l’écran de connexion Web :

| Profil | Email | Mot de passe |
| :--- | :--- | :--- |
| **Administrateur système** | `admin@isieco.sn` | `Password@123` |
| **Équipe métier complète** (qualification, traitement, affectation, terrain, vérification et décision) | `operations@isieco.sn` | `Password@123` |

Le compte opérationnel cumule les six rôles métier pour faciliter les tests locaux; il n’a pas le rôle `ADMIN`. Ces identifiants sont réservés aux environnements de démonstration et ne doivent pas être réutilisés en production.

---

## 7. Centre Documentaire (`docs/`)

- 📐 [Décisions d'Architecture](docs/architecture/DECISIONS-ARCHITECTURE.md)
- 🗄️ [Matrice de Transition Modèle & DDL](docs/architecture/MATRICE-DIFFS-MODELE.md)
- 🎨 [Design System & Charte Graphique Dakar](docs/product/DESIGN-SYSTEM.md)
- 🎯 [Vision Produit & Cadrage Métier](docs/product/VISION-PRODUIT.md)
- 🗺️ [Roadmap de Développement](docs/product/ROADMAP-DEVELOPPEMENT.md)
- 📊 [Spécifications Initiales & Diagrammes UML](docs/specs-pfe/)
