import fastify, { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { swaggerPlugin } from './plugins/swagger.plugin.js';
import { securityPlugin } from './plugins/security.plugin.js';
import { authPlugin } from './plugins/auth.plugin.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { utilisateursRoutes } from './modules/utilisateurs/utilisateurs.routes.js';
import { referentielsRoutes } from './modules/referentiels/referentiels.routes.js';
import { signalementsRoutes } from './modules/signalements/signalements.routes.js';
import { qualificationRoutes } from './modules/qualification/qualification.routes.js';
import { dossiersRoutes } from './modules/dossiers/dossiers.routes.js';
import { affectationsRoutes } from './modules/affectations/affectations.routes.js';
import { interventionsRoutes } from './modules/interventions/interventions.routes.js';
import { verificationsRoutes } from './modules/verifications/verifications.routes.js';
import { evenementsRoutes } from './modules/evenements/evenements.routes.js';
import { pointsRoutes } from './modules/points/points.routes.js';
import { notificationsRoutes } from './modules/notifications/notifications.routes.js';
import { carteStatsRoutes } from './modules/carte-stats/carte-stats.routes.js';
import { getDb } from './db/index.js';
import { config } from './config.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: false, // Silence Fastify logs during unit tests
    ajv: {
      customOptions: {
        keywords: ['example'],
      },
    },
  });

  // Documentation OpenAPI Swagger
  await app.register(swaggerPlugin);

  // Plugins transversaux
  await app.register(securityPlugin);
  await app.register(authPlugin);
  await app.register(multipart, {
    limits: {
      files: 1,
      fields: 0,
      fileSize: config.maxFileSize,
    },
  });

  // Health Check
  app.get('/api/health', async () => {
    try {
      const db = getDb();
      await db.query('SELECT 1');
      return { status: 'ok', timestamp: new Date().toISOString(), database: 'connected' };
    } catch (err: any) {
      return { status: 'error', timestamp: new Date().toISOString(), database: err.message };
    }
  });

  // Enregistrement modulaire des routes REST
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(utilisateursRoutes, { prefix: '/api/utilisateurs' });
  await app.register(referentielsRoutes, { prefix: '/api/referentiels' });
  await app.register(signalementsRoutes, { prefix: '/api/signalements' });
  await app.register(qualificationRoutes, { prefix: '/api/qualification' });
  await app.register(dossiersRoutes, { prefix: '/api/dossiers' });
  await app.register(affectationsRoutes, { prefix: '/api/affectations' });
  await app.register(interventionsRoutes, { prefix: '/api/interventions' });
  await app.register(verificationsRoutes, { prefix: '/api/verifications' });
  await app.register(evenementsRoutes, { prefix: '/api/evenements' });
  await app.register(pointsRoutes, { prefix: '/api/points' });
  await app.register(notificationsRoutes, { prefix: '/api/notifications' });
  await app.register(carteStatsRoutes, { prefix: '/api' });

  return app;
}
