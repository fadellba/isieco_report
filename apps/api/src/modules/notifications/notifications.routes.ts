import { FastifyPluginAsync } from 'fastify';
import {
  getUserNotifications,
  markUserNotificationAsRead,
} from '../../application/use-cases/notifications.js';

export const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = fastify.dependencies.notifications;
  const listNotifications = async (idUtilisateur: string) => ({
    success: true,
    ...await getUserNotifications(repository, idUtilisateur),
  });

  // Liste des notifications du compte connecté
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Notifications'],
      summary: 'Notifications reçues par l utilisateur connecté',
      description: 'Retourne la liste des 50 dernières notifications (prises en charge, résolutions, alertes) avec le décompte des messages non lus.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            count: { type: 'number' },
            nonLues: { type: 'number' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  idNotification: { type: 'string', format: 'uuid' },
                  titre: { type: 'string' },
                  message: { type: 'string' },
                  lu: { type: 'boolean' },
                  dateCreation: { type: 'string' },
                  lienCible: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
  }, async (req) => {
    return listNotifications(req.user!.idUtilisateur);
  });

  fastify.get('/mes-notifications', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Notifications'],
      summary: 'Notifications citoyennes du compte mobile connecté',
      description: 'Alias de consultation des notifications avec format optimisé pour l application mobile.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            count: { type: 'number' },
            nonLues: { type: 'number' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  idNotification: { type: 'string', format: 'uuid' },
                  titre: { type: 'string' },
                  message: { type: 'string' },
                  lu: { type: 'boolean' },
                  dateCreation: { type: 'string' },
                  lienCible: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
  }, async (req) => {
    return listNotifications(req.user!.idUtilisateur);
  });

  // Marquer une notification comme lue
  fastify.patch('/:id/lu', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Notifications'],
      summary: 'Marquer une notification comme lue',
      description: 'Met à jour l état de lecture d une notification appartenant à l utilisateur connecté.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID de la notification' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    await markUserNotificationAsRead(repository, id, req.user!.idUtilisateur);

    return { success: true, message: 'Notification marquée comme lue.' };
  });
};
