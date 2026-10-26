import { FastifyPluginAsync } from 'fastify';
import { RoleCode, StatutSignalement } from '@isieco/shared';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors.js';
import {
  acceptSignalement,
  correctSignalementAcceptance,
  findQualificationDuplicates,
  getQualificationInbox,
  rejectSignalement,
  requestSignalementComplement,
  startSignalementExamination,
} from '../../application/use-cases/qualification.js';
import { QualificationRuleError } from '../../domain/qualification.js';
import { SignalementRuleError } from '../../domain/signalements.js';

function rethrowQualificationError(error: unknown): never {
  if (error instanceof QualificationRuleError) {
    switch (error.rule) {
      case 'INVALID_REJECTION_REASON':
      case 'INVALID_CORRECTION_REASON':
      case 'INVALID_COMPLEMENT_REASON':
      case 'INVALID_COMPLEMENT_RESPONSE':
        throw new BadRequestError(error.message);
      case 'INVALID_STATE':
        throw new ConflictError(error.message);
      case 'SIGNALEMENT_NOT_FOUND':
        throw new NotFoundError(error.message);
    }
  }
  if (error instanceof SignalementRuleError && error.rule === 'SIGNALEMENT_NOT_FOUND') {
    throw new NotFoundError(error.message);
  }
  throw error;
}

export const qualificationRoutes: FastifyPluginAsync = async (fastify) => {
  const allowedAgents = [RoleCode.QUALIFICATION, RoleCode.TRAITEMENT];
  const qualificationRepository = fastify.dependencies.qualification;
  const signalementsRepository = fastify.dependencies.signalements;

  // Boîte de réception pour examen (UC03)
  fastify.get('/boite-reception', {
    preHandler: [fastify.authorize(allowedAgents)],
    schema: {
      tags: ['Qualification'],
      summary: 'Boîte de réception des signalements à qualifier (UC03)',
      description: 'Renvoie la liste des signalements en attente ou en cours d examen par la cellule communale.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            count: { type: 'number' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  idSignalement: { type: 'string', format: 'uuid' },
                  dateSoumission: { type: 'string' },
                  description: { type: 'string' },
                  latitude: { type: 'number', nullable: true },
                  longitude: { type: 'number', nullable: true },
                  descriptionLocalisation: { type: 'string', nullable: true },
                  statutSignalement: { type: 'string' },
                  nomDeclarant: { type: 'string' },
                  prenomDeclarant: { type: 'string', nullable: true },
                  nbPhotos: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  }, async () => {
    const result = await getQualificationInbox(qualificationRepository);
    return { success: true, ...result };
  });

  // Début d'examen d'un signalement
  fastify.post('/signalements/:id/examiner', {
    preHandler: [fastify.authorize(allowedAgents)],
    schema: {
      tags: ['Qualification'],
      summary: 'Prendre en charge un signalement en qualification',
      description: 'Passe le signalement à l état EN_COURS_DE_QUALIFICATION et trace l événement.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    try {
      await startSignalementExamination(qualificationRepository, id, req.user!.idUtilisateur);
    } catch (error) {
      rethrowQualificationError(error);
    }

    return { success: true, message: 'Signalement pris en cours de qualification.' };
  });

  // Acceptation pour rattachement (Test T04)
  fastify.post('/signalements/:id/qualifier', {
    preHandler: [fastify.authorize(allowedAgents)],
    schema: {
      tags: ['Qualification'],
      summary: 'Accepter le signalement pour traitement (+10 points citoyen) (Test T04)',
      description: 'Accepte le signalement pour rattachement, qualifie toutes ses catégories déclarées, notifie le citoyen et crédite 10 points éco-citoyens.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        properties: {
          motif: { type: 'string', example: 'Signalement recevable et conforme pour orientation vers dossier' },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const { motif } = req.body as { motif?: string };
    try {
      await acceptSignalement(qualificationRepository, id, req.user!.idUtilisateur, motif);
    } catch (error) {
      rethrowQualificationError(error);
    }

    return {
      success: true,
      statut: StatutSignalement.ACCEPTE_POUR_RATTACHEMENT,
      message: 'Signalement accepté pour rattachement avec attribution de 10 points.',
    };
  });

  // Rejet d'un signalement avec motif obligatoire (RG17)
  fastify.post('/signalements/:id/rejeter', {
    preHandler: [fastify.authorize(allowedAgents)],
    schema: {
      tags: ['Qualification'],
      summary: 'Rejeter un signalement avec motif obligatoire (RG17)',
      description: 'Rejette un signalement non recevable ou hors périmètre avec obligation de motif (>= 10 car.).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['motif'],
        properties: {
          motif: { type: 'string', minLength: 10, example: 'Dépôt situé sur domaine privé hors compétences de la voirie communale' },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const { motif } = req.body as { motif: string };

    try {
      await rejectSignalement(qualificationRepository, id, req.user!.idUtilisateur, motif);
    } catch (error) {
      rethrowQualificationError(error);
    }

    return {
      success: true,
      statut: StatutSignalement.REJETE,
      message: 'Signalement rejeté avec motif enregistré.',
    };
  });

  fastify.post('/signalements/:id/complements', {
    preHandler: [fastify.authorize(allowedAgents)],
    schema: {
      tags: ['Qualification'],
      summary: 'Demander un complément au déclarant',
      description: 'Passe un signalement en examen à A_COMPLETER. Une seule demande peut rester en attente ; aucune expiration automatique n’est appliquée.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['motif'],
        properties: { motif: { type: 'string', minLength: 10, maxLength: 5000 } },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            statut: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { motif } = req.body as { motif: string };
    try {
      await requestSignalementComplement(
        qualificationRepository,
        id,
        req.user!.idUtilisateur,
        motif,
      );
    } catch (error) {
      rethrowQualificationError(error);
    }
    return reply.code(201).send({
      success: true,
      statut: StatutSignalement.A_COMPLETER,
      message: 'Demande de complément envoyée au déclarant.',
    });
  });

  fastify.post('/signalements/:id/corriger-acceptation', {
    preHandler: [fastify.authorize(allowedAgents)],
    schema: {
      tags: ['Qualification'],
      summary: 'Corriger une acceptation avant rattachement',
      description: 'Remplace une acceptation erronée par un rejet motivé et compense les points attribués, sans effacer les mouvements historiques. Impossible après rattachement.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['motif'],
        properties: {
          motif: {
            type: 'string',
            minLength: 10,
            example: 'Vérification complémentaire : le signalement ne relève pas du périmètre communal',
          },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const { motif } = req.body as { motif: string };
    try {
      await correctSignalementAcceptance(qualificationRepository, id, req.user!.idUtilisateur, motif);
    } catch (error) {
      rethrowQualificationError(error);
    }
    return {
      success: true,
      statut: StatutSignalement.REJETE,
      message: 'Acceptation corrigée avant rattachement ; les points attribués ont été compensés.',
    };
  });

  // Détection de doublons candidats par calcul de distance géodésique (Support Split-View)
  fastify.get('/doublons-candidats/:id', {
    preHandler: [fastify.authorize(allowedAgents)],
    schema: {
      tags: ['Qualification'],
      summary: 'Détecter les doublons candidats par distance géodésique < 500m (UC02)',
      description: 'Recherche les signalements à proximité géographique pour affichage split-view et fusion sans suppression d auteurs.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    let candidates;
    try {
      candidates = await findQualificationDuplicates(signalementsRepository, id);
    } catch (error) {
      rethrowQualificationError(error);
    }
    return { success: true, count: candidates.length, candidates };
  });
};
