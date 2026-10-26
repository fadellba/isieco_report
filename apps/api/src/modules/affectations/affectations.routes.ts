import { FastifyPluginAsync } from 'fastify';
import { RoleCode, EtatAffectation } from '@isieco/shared';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors.js';
import { createAssignment, listPendingAssignments, reassign } from '../../application/use-cases/affectations.js';
import { AffectationRuleError } from '../../domain/affectations.js';

const closedDossierConflictResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'CONFLICT' },
        message: { type: 'string' },
      },
    },
  },
};

export const affectationsRoutes: FastifyPluginAsync = async (fastify) => {
  const allowedAssigners = [RoleCode.AFFECTATION];
  const repository = fastify.dependencies.affectations;

  async function runAffectationUseCase<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    } catch (error) {
      if (!(error instanceof AffectationRuleError)) throw error;
      if (error.rule === 'ACTIVE_ASSIGNMENT_NOT_FOUND') throw new NotFoundError(error.message);
      if (error.rule === 'DOSSIER_CLOSED') throw new ConflictError(error.message);
      throw new BadRequestError(error.message);
    }
  }

  // Liste des volets en attente d'affectation
  fastify.get('/en-attente', {
    preHandler: [fastify.authorize(allowedAssigners)],
    schema: {
      tags: ['Affectations'],
      summary: 'Volets techniques en attente d affectation aux équipes (UC06)',
      description: 'Liste les catégories de déchets incluses dans un dossier non clôturé qui n ont aucune affectation active.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            count: { type: 'number' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  idDossier: { type: 'string', format: 'uuid' },
                  referenceDossier: { type: 'string' },
                  priorite: { type: 'string' },
                  dateCreationDossier: { type: 'string' },
                  idTypeDechet: { type: 'string', format: 'uuid' },
                  codeType: { type: 'string' },
                  libelleDechet: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async () => {
    const data = await listPendingAssignments(repository);
    return { success: true, count: data.length, data };
  });

  // Création d'une affectation spécialisée par volet (UC06 / T05 / T06 / T07 / T08 / T16)
  fastify.post('/', {
    preHandler: [fastify.authorize(allowedAssigners)],
    schema: {
      tags: ['Affectations'],
      summary: 'Créer une affectation spécialisée par volet technique (UC06 / T05-T08 / T16)',
      description: 'Affecte une équipe habilitée (compétence active valide) à une catégorie de déchet incluse dans le dossier. Opération idempotente via referenceOperationUnique. Un dossier clôturé doit être réouvert avant toute affectation.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      body: {
        type: 'object',
        required: ['idDossier', 'idTypeDechet', 'idEquipe', 'idCompetenceEquipe'],
        properties: {
          idDossier: { type: 'string', format: 'uuid' },
          idTypeDechet: { type: 'string', format: 'uuid' },
          idEquipe: { type: 'string', format: 'uuid' },
          idCompetenceEquipe: { type: 'string', format: 'uuid' },
          motif: { type: 'string' },
          observation: { type: 'string' },
          referenceOperationUnique: { type: 'string', description: 'Clé d idempotence unique pour éviter les doubles soumissions' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            idAffectation: { type: 'string', format: 'uuid' },
            etatAffectation: { type: 'string' },
            message: { type: 'string' },
          },
        },
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            idAffectation: { type: 'string', format: 'uuid' },
            etatAffectation: { type: 'string' },
            idempotent: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        409: {
          description: 'Le dossier est clôturé et doit être réouvert avant affectation.',
          ...closedDossierConflictResponse,
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as {
      idDossier: string;
      idTypeDechet: string;
      idEquipe: string;
      idCompetenceEquipe: string;
      motif?: string;
      observation?: string;
      referenceOperationUnique?: string;
    };
    const result = await runAffectationUseCase(createAssignment(repository, {
      ...body,
      actorId: req.user!.idUtilisateur,
    }));
    if (result.idempotent) {
      return reply.status(200).send({
        success: true,
        idAffectation: result.existing.idAffectation,
        etatAffectation: result.existing.etatAffectation,
        idempotent: true,
        message: 'Affectation existante retournée (opération idempotente).',
      });
    }
    return reply.status(201).send({
      success: true,
      idAffectation: result.idAffectation,
      etatAffectation: EtatAffectation.ACTIVE,
      message: 'Affectation créée avec succès et intervention programmée.',
    });
  });

  // Réaffectation d'un volet vers une autre équipe dans la même transaction (Test T08)
  fastify.post('/:id/reaffecter', {
    preHandler: [fastify.authorize(allowedAssigners)],
    schema: {
      tags: ['Affectations'],
      summary: 'Réaffecter un volet vers une autre équipe dans une transaction atomique (Test T08)',
      description: 'Clôture l affectation active actuelle en REMPLACEE et crée la nouvelle affectation avec nouvelle intervention programmée. Un dossier clôturé doit être réouvert avant toute réaffectation.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID de l affectation courante à remplacer' },
        },
      },
      body: {
        type: 'object',
        required: ['nouvelleEquipeId', 'nouvelleCompetenceId', 'motif'],
        properties: {
          nouvelleEquipeId: { type: 'string', format: 'uuid' },
          nouvelleCompetenceId: { type: 'string', format: 'uuid' },
          motif: { type: 'string', minLength: 10, description: 'Motif explicite obligatoire (min 10 car.)' },
          referenceOperationUnique: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            ancienneAffectation: { type: 'string', format: 'uuid' },
            nouvelleAffectation: { type: 'string', format: 'uuid' },
            correlationId: { type: 'string', format: 'uuid' },
          },
        },
        409: {
          description: 'Le dossier est clôturé et doit être réouvert avant réaffectation.',
          ...closedDossierConflictResponse,
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      nouvelleEquipeId: string;
      nouvelleCompetenceId: string;
      motif: string;
      referenceOperationUnique?: string;
    };
    const result = await runAffectationUseCase(reassign(repository, {
      assignmentId: id,
      teamId: body.nouvelleEquipeId,
      competenceId: body.nouvelleCompetenceId,
      reason: body.motif,
      referenceOperationUnique: body.referenceOperationUnique,
      actorId: req.user!.idUtilisateur,
    }));
    return {
      success: true,
      message: 'Réaffectation effectuée avec succès dans une transaction atomique.',
      ancienneAffectation: id,
      nouvelleAffectation: result.newAssignmentId,
      correlationId: result.correlationId,
    };
  });
};
