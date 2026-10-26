import fastify, { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
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
import { publicationsRoutes } from './modules/publications/publications.routes.js';
import { notificationsRoutes } from './modules/notifications/notifications.routes.js';
import { carteStatsRoutes } from './modules/carte-stats/carte-stats.routes.js';
import { equipesRoutes } from './modules/equipes/equipes.routes.js';
import { config } from './config.js';
import { disconnectPrismaClient, getPrismaClient } from './infrastructure/database/prisma-client.js';
import { createApiDependencies } from './composition-root.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: config.env === 'test'
      ? false
      : {
          redact: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            'req.body.password',
            'req.body.motDePasse',
            'req.body.currentPassword',
            'req.body.newPassword',
            '*.token',
            '*.motDePasseHash',
          ],
        },
    ajv: {
      customOptions: {
        keywords: ['example'],
      },
    },
  });
  app.decorate('dependencies', createApiDependencies());
  app.addHook('onClose', async () => {
    await disconnectPrismaClient();
  });

  // Documentation OpenAPI Swagger
  await app.register(swaggerPlugin);

  // Plugins transversaux
  await app.register(securityPlugin);
  await app.register(authPlugin);
  await app.register(rateLimit, { global: false });
  await app.register(multipart, {
    limits: {
      files: 1,
      fields: 0,
      fileSize: config.maxFileSize,
    },
  });

  // Health Check
  app.get('/api/health', async (_request, reply) => {
    try {
      await app.dependencies.databaseHealthCheck.ping();
      return { status: 'ok', timestamp: new Date().toISOString(), database: 'connected' };
    } catch (error) {
      app.log.error({
        requestId: _request.id,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      }, 'Database health check failed');
      return reply.status(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        message: 'Service temporairement indisponible.',
      });
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
  await app.register(publicationsRoutes, { prefix: '/api/publications' });
  await app.register(notificationsRoutes, { prefix: '/api/notifications' });
  await app.register(carteStatsRoutes, { prefix: '/api' });
  await app.register(equipesRoutes, { prefix: '/api/equipes' });

  return app;
}
