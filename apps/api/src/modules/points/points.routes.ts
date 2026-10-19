import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/index.js';
import { RoleCode } from '@isieco/shared';
import { BadRequestError } from '../../core/errors.js';
import crypto from 'node:crypto';

export const pointsRoutes: FastifyPluginAsync = async (fastify) => {
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
    const db = getDb();
    const rows = await db.query(
      `SELECT id_point as "idPoint", points, date_attribution as "dateAttribution", motif, id_signalement as "idSignalement"
       FROM historique_points
       WHERE id_utilisateur = $1
       ORDER BY date_attribution DESC`,
      [req.user!.idUtilisateur]
    );

    const soldeTotal = rows.reduce((acc, curr) => acc + Number(curr.points), 0);

    return {
      success: true,
      idUtilisateur: req.user!.idUtilisateur,
      soldeTotal,
      historique: rows,
    };
  });

  // Attribution administrative de points
  fastify.post('/attribuer', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Points Citoyens'],
      summary: 'Attribution manuelle ou administrative de points à un citoyen',
      description: 'Permet à un administrateur d attribuer des points éco-citoyens avec motif explicite obligatoire.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      body: {
        type: 'object',
        required: ['idUtilisateur', 'points', 'motif'],
        properties: {
          idUtilisateur: { type: 'string', format: 'uuid' },
          points: { type: 'number', minimum: 1 },
          motif: { type: 'string', minLength: 3 },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            idPoint: { type: 'string', format: 'uuid' },
            points: { type: 'number' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { idUtilisateur, points, motif } = req.body as {
      idUtilisateur: string;
      points: number;
      motif: string;
    };

    if (!points || points <= 0) {
      throw new BadRequestError('Le montant de points doit être strictement supérieur à zéro.');
    }
    if (!motif || motif.trim().length < 3) {
      throw new BadRequestError("Le motif d'attribution est obligatoire.");
    }

    const db = getDb();
    const idPoint = crypto.randomUUID();

    await db.execute(
      `INSERT INTO historique_points (id_point, id_utilisateur, points, motif)
       VALUES ($1, $2, $3, $4)`,
      [idPoint, idUtilisateur, points, motif.trim()]
    );

    return reply.status(201).send({
      success: true,
      idPoint,
      points,
      message: `${points} points attribués avec succès.`,
    });
  });
};
