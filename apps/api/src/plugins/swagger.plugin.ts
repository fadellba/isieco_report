import fp from 'fastify-plugin';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

export const swaggerPlugin = fp(async (fastify) => {
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'ISI-Eco Report API — Salubrité Urbaine Dakar',
        description: `API REST Fastify pour la plateforme municipale de salubrité, de signalement participatif et de traçabilité des déchets (Dakar-Plateau & Médina).

### Invariants et Règles d'Ingénierie Métier Intégrés :
- **Sécurité Dual-Client :** Cookie de session \`HttpOnly\` (Portail Web) et Bearer Token JWT (Application Mobile Nomade).
- **Règles RG01 à RG07 :** Déclaration citoyenne multi-catégories avec coordonnées GPS ou repère textuel obligatoire.
- **Règles RG11 à RG22 :** Détection de doublons géodésiques (< 500 m) et qualification vers un dossier commun sans perte d'auteurs.
- **Règles RG23 à RG36 :** Découpage du dossier en volets techniques et affectation aux équipes selon compétences actives.
- **Règles RG37 à RG42 :** Compte-rendu terrain certifié (>= 10 car.) et photo de preuve après intervention.
- **Règles RG43 à RG50 :** Invariant de clôture stricte : 100% de résolution confirmée exigée avant archivage.
- **Règles RG51 à RG57 :** Journal d'audit immuable avec cible exclusive (Test T17/T32) et rectification par append-only (Test T18).
- **Règles RG58 & RG59 :** Étanchéité statistique stricte des observations brutes vs dossiers et des résolutions vs réouvertures.`,
        version: '1.0.0',
        contact: {
          name: 'Cellule Technique & Support ISI-Eco Report',
          email: 'support@isieco.sn',
          url: 'https://isieco.sn',
        },
      },
      servers: [
        {
          url: '/',
          description: 'Origine de l’API, locale ou déployée',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            description: 'Jeton de session opaque transmis par en-tête Authorization: Bearer <token>.',
          },
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'session_token',
            description: 'Cookie de session HttpOnly transmis automatiquement par le navigateur',
          },
        },
      },
      tags: [
        { name: 'Authentification', description: 'Connexion, déconnexion et vérification de session active' },
        { name: 'Signalements', description: 'Création et consultation des signalements citoyens' },
        { name: 'Qualification', description: 'Recherche de doublons géodésiques et constitution des dossiers' },
        { name: 'Dossiers', description: 'Gestion des dossiers d intervention, volets techniques et transferts' },
        { name: 'Affectations', description: 'Attribution des volets techniques aux équipes habilitées' },
        { name: 'Interventions', description: 'Missions sur le terrain, prise en charge et clôture avec compte-rendu' },
        { name: 'Vérifications', description: 'Contrôle qualité de résolution et clôture finale à 100%' },
        { name: 'Événements & Audit', description: 'Piste d audit immuable et rectifications traçables' },
        { name: 'Points Citoyens', description: 'Gamification, solde et attribution de points éco-citoyens' },
        { name: 'Notifications', description: 'Notifications internes communales' },
        { name: 'Cartographie & Stats', description: 'Points cartographiques Dakar et indicateurs RG58/RG59' },
        { name: 'Utilisateurs & RBAC', description: 'Administration des comptes et attribution des rôles (Admin)' },
      ],
    },
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Alias pratique : redirection de /docs vers /documentation
  fastify.get('/docs', async (_, reply) => {
    return reply.redirect('/documentation');
  });
});
