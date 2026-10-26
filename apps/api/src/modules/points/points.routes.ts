import { FastifyPluginAsync } from 'fastify';
import { RoleCode } from '@isieco/shared';
import { getUserPoints } from '../../application/use-cases/points.js';

export const pointsRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = fastify.dependencies.points;

  // Consultation du solde et de l'historique des points citoyen
  fastify.get('/mes-points', {
    preHandler: [fastify.authorize([RoleCode.CITOYEN])],
    schema: {
      tags: ['Points Citoyens'],
      summary: 'Consulter le solde et l historique des points éco-citoyens (Gamification)',
      description: 'Retourne le solde cumulé et le détail des attributions reçues pour les signalements confirmés.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            idUtilisateur: { type: 'string', format: 'uuid' },
            soldeTotal: { type: 'number' },
            historique: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  idPoint: { type: 'string', format: 'uuid' },
                  points: { type: 'number' },
                  dateAttribution: { type: 'string' },
                  motif: { type: 'string' },
                  idSignalement: { type: 'string', format: 'uuid', nullable: true },
                },
              },
            },
          },
        },
      },
    },
  }, async (req) => {
    const summary = await getUserPoints(repository, req.user!.idUtilisateur);
    return { success: true, idUtilisateur: req.user!.idUtilisateur, ...summary };
  });
};
