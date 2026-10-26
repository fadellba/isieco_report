import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { AppError } from '../core/errors.js';
import { ZodError } from 'zod';
import { config } from '../config.js';

const securityPluginCallback: FastifyPluginAsync = async (fastify) => {
  // CORS
  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin || config.corsOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Requested-With'],
  });

  // Cookies
  await fastify.register(cookie, {
    secret: config.cookieSecret,
    hook: 'onRequest',
  });

  // Gestionnaire global d'erreurs
  fastify.setErrorHandler((error, req, reply) => {
    const statusCode =
      error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    // 1. Erreurs métier ou HTTP contrôlées (AppError)
    if (error instanceof AppError) {
      if (error.statusCode === 401 || error.statusCode === 403) {
        // Journalisation de sécurité dédiée (Test T20)
        req.log.warn({
          event: 'SECURITY_ACCESS_DENIED',
          url: req.url,
          method: req.method,
          user: req.user?.idUtilisateur || 'ANONYMOUS',
          ip: req.ip,
          code: error.code,
        });
      }

      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    // 2. Erreurs de validation Zod
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Les données transmises sont invalides.',
          details: error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
      });
    }

    // 3. Erreur native Fastify de validation ou syntaxe
    if (error instanceof Error && 'validation' in error && error.validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
      });
    }

    // 4. Erreurs inattendues (500)
    req.log.error({
      requestId: req.id,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      statusCode,
    }, 'Unhandled request error');
    return reply.status(statusCode).send({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Une erreur interne est survenue sur le serveur.',
      },
    });
  });
};

export const securityPlugin = fp(securityPluginCallback, {
  name: 'security-plugin',
});
