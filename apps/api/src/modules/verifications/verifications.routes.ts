import { FastifyPluginAsync } from 'fastify';
import { RoleCode, ResultatVerification, EtatVerification, StatutDossier } from '@isieco/shared';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { VerificationRuleError } from '../../domain/verifications.js';
import {
  closeVerifiedDossier,
  recordResolutionVerification,
  reopenClosedDossier,
} from '../../application/use-cases/verifications.js';

export const verificationsRoutes: FastifyPluginAsync = async (fastify) => {
  const allowedVerifiers = [RoleCode.VERIFICATION];
  const repository = fastify.dependencies.verifications;

  function rethrowVerificationError(error: unknown): never {
    if (!(error instanceof VerificationRuleError)) throw error;
    if (error.rule === 'AFFECTATION_NOT_FOUND' || error.rule === 'DOSSIER_NOT_FOUND') {
      throw new NotFoundError(error.message);
    }
    if (error.rule === 'SEPARATION_OF_DUTIES') {
      throw new ForbiddenError(error.message);
    }
    throw new BadRequestError(error.message);
  }

  // Enregistrement d'une vérification de résolution par volet (UC08 / T12 / T25)
  fastify.post('/', {
    preHandler: [fastify.authorize(allowedVerifiers)],
    schema: {
      tags: ['Vérifications'],
      summary: 'Enregistrer une vérification qualité de résolution par volet (UC08 / T12 / T25)',
      description: 'Enregistre le constat d un vérificateur indépendant. Si CONFORME_RESOLU, l affectation passe à TERMINEE. Si non conforme, l affectation repasse à ACTIVE pour reprise.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      body: {
        type: 'object',
        required: ['idAffectation', 'resultatVerification'],
        properties: {
          idAffectation: { type: 'string', format: 'uuid', description: 'ID de l affectation à vérifier' },
          resultatVerification: { type: 'string', enum: Object.values(ResultatVerification) },
          motif: { type: 'string', minLength: 10 },
          referencePreuve: { type: 'string', description: 'Référence photo ou document de contre-visite' },
        },
        if: {
          properties: {
            resultatVerification: { const: ResultatVerification.CONFORME_RESOLU },
          },
        },
        then: {},
        else: { required: ['motif'] },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            idVerification: { type: 'string', format: 'uuid' },
            resultatVerification: { type: 'string' },
            etatVerification: { type: 'string', example: 'COURANTE' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const {
      idAffectation,
      resultatVerification,
      motif,
      referencePreuve,
    } = req.body as {
      idAffectation: string;
      resultatVerification: ResultatVerification;
      motif?: string;
      referencePreuve?: string;
    };

    let idVerification: string;
    try {
      idVerification = await recordResolutionVerification(repository, {
        idAffectation,
        idVerificateur: req.user!.idUtilisateur,
        resultatVerification,
        motif,
        referencePreuve,
      });
    } catch (error) {
      rethrowVerificationError(error);
    }

    return reply.status(201).send({
      success: true,
      idVerification,
      resultatVerification,
      etatVerification: EtatVerification.COURANTE,
      message: resultatVerification === ResultatVerification.CONFORME_RESOLU
        ? 'Résolution confirmée par une vérification indépendante.'
        : 'Vérification enregistrée ; le volet est remis en reprise avec une nouvelle intervention tracée.',
    });
  });

  // Clôture globale d'un dossier avec règle stricte à 100% (UC09 / T13 / T14)
  fastify.post('/dossiers/:id/cloturer', {
    preHandler: [fastify.authorize(allowedVerifiers)],
    schema: {
      tags: ['Vérifications'],
      summary: 'Clôture globale d un dossier à 100% de résolution confirmée (UC09 / T13 / T14)',
      description: 'Vérifie que 100% des volets inclus ont une affectation TERMINEE avec vérification COURANTE = CONFORME_RESOLU. Après réouverture, chaque affectation et vérification doit être postérieure à la dernière réouverture. Notifie ensuite tous les citoyens rattachés.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID du dossier à clôturer' },
        },
      },
      body: {
        type: 'object',
        properties: {
          motif: { type: 'string', description: 'Motif ou observation finale de clôture' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            statutDossier: { type: 'string', example: 'CLOS_RESOLUTION_CONFIRMEE' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const { motif } = req.body as { motif?: string };
    try {
      await closeVerifiedDossier(repository, id, req.user!.idUtilisateur, motif);
    } catch (error) {
      rethrowVerificationError(error);
    }

    return {
      success: true,
      statutDossier: StatutDossier.CLOS_RESOLUTION_CONFIRMEE,
      message: 'Dossier clôturé avec succès après vérification complète à 100% (Test T14).',
    };
  });

  // Réouverture d'un dossier clôturé avec motif obligatoire (UC09 / T15 / T36)
  fastify.post('/dossiers/:id/reouvrir', {
    preHandler: [fastify.authorize(allowedVerifiers)],
    schema: {
      tags: ['Vérifications'],
      summary: 'Réouverture motivée d un dossier préalablement clôturé (UC09 / T15 / T36)',
      description: 'Repasse le dossier clôturé à l état A_QUALIFIER sans écraser ni supprimer l historique passé des interventions et vérifications.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID du dossier à rouvrir' },
        },
      },
      body: {
        type: 'object',
        required: ['motif'],
        properties: {
          motif: { type: 'string', minLength: 10, description: 'Motif explicite obligatoire de réouverture (min 10 car.)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            statutDossier: { type: 'string', example: 'A_QUALIFIER' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const { motif } = req.body as { motif: string };

    try {
      await reopenClosedDossier(repository, id, req.user!.idUtilisateur, motif);
    } catch (error) {
      rethrowVerificationError(error);
    }

    return {
      success: true,
      statutDossier: StatutDossier.EN_ATTENTE_AFFECTATION,
      message: "Dossier rouvert avec succès et conservé dans l'historique (Test T15 / T36).",
    };
  });
};
