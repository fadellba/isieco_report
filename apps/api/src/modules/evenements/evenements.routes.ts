import { FastifyPluginAsync } from 'fastify';
import { RoleCode } from '@isieco/shared';
import { BadRequestError, NotFoundError } from '../../core/errors.js';
import { EvenementRuleError } from '../../domain/evenements.js';
import {
  correctAuditEvent,
  createAuditEvent,
  listAuditEvents,
} from '../../application/use-cases/evenements.js';
import type { EventTargets } from '../../application/ports/evenements-repository.js';

function rethrowEvenementError(error: unknown): never {
  if (!(error instanceof EvenementRuleError)) {
    throw error;
  }

  switch (error.rule) {
    case 'INVALID_CORRECTION_REASON':
      throw new BadRequestError("Un motif de rectification explicite d'au moins 10 caractères est obligatoire.");
    case 'ORIGINAL_EVENT_NOT_FOUND':
      throw new NotFoundError('Événement original introuvable.');
    case 'EVENT_TYPE_REQUIRED':
      throw new BadRequestError("Le type d'événement est obligatoire.");
    case 'INCOMPLETE_COMPOSITE_TARGET':
      throw new BadRequestError("Cible composite incomplète : idDossierContenuCible et idTypeDechetContenuCible doivent être fournis ensemble (Test T33).");
    case 'NO_EVENT_TARGET':
      throw new BadRequestError("L'événement métier doit avoir exactement une cible principale (Test T17 / T32).");
    case 'MULTIPLE_EVENT_TARGETS':
      throw new BadRequestError("L'événement métier ne peut pas cibler simultanément plusieurs entités (Test T17 / T32).");
    case 'COMPOSITE_TARGET_NOT_FOUND':
      throw new BadRequestError("La cible composite pointe vers un couple dossier/catégorie inexistant (Test T34).");
  }
}

export const evenementsRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = fastify.dependencies.evenements;
  const allowedAuditors = [
    RoleCode.QUALIFICATION,
    RoleCode.TRAITEMENT,
    RoleCode.AFFECTATION,
    RoleCode.VERIFICATION,
    RoleCode.ADMIN,
    RoleCode.DECISION,
  ];
  const auditEventTypesByRole: Partial<Record<RoleCode, string[]>> = {
    [RoleCode.QUALIFICATION]: [
      'SIGNALEMENT_RECU',
      'SIGNALEMENT_EN_QUALIFICATION',
      'SIGNALEMENT_ACCEPTE',
      'SIGNALEMENT_REJETE',
      'SIGNALEMENT_ACCEPTATION_CORRIGEE',
      'COMPLEMENT_DEMANDE',
      'COMPLEMENT_REPONSE',
    ],
    [RoleCode.TRAITEMENT]: [
      'DOSSIER_CREE',
      'DOSSIER_QUALIFIE',
      'SIGNALEMENT_RATTACHE',
      'SIGNALEMENT_DERATTACHE',
      'VOLET_AJOUTE',
      'VOLET_RETIRE',
      'DOSSIER_PRIORITE_MODIFIEE',
      'DOSSIER_LOCALISATION_MODIFIEE',
      'TRANSFERT_EXTERNE',
      'DOSSIER_REOUVERT',
    ],
    [RoleCode.AFFECTATION]: [
      'DOSSIER_CREE',
      'DOSSIER_QUALIFIE',
      'SIGNALEMENT_RATTACHE',
      'SIGNALEMENT_DERATTACHE',
      'VOLET_AJOUTE',
      'VOLET_RETIRE',
      'DOSSIER_PRIORITE_MODIFIEE',
      'DOSSIER_LOCALISATION_MODIFIEE',
      'AFFECTATION_CREEE',
      'AFFECTATION_REMPLACEE',
      'AFFECTATION_ANNULEE',
      'DOSSIER_REOUVERT',
    ],
    [RoleCode.VERIFICATION]: [
      'INTERVENTION_DEBUTEE',
      'INTERVENTION_TERMINEE',
      'VERIFICATION_ENREGISTREE',
      'RESOLUTION_CONFIRMEE',
      'DOSSIER_CLOS',
      'DOSSIER_REOUVERT',
    ],
    [RoleCode.DECISION]: [
      'PUBLICATION_REMISE_EN_MODERATION',
      'PUBLICATION_APPROUVEE',
      'PUBLICATION_REFUSEE',
      'PUBLICATION_MASQUEE',
      'VARIANTE_PHOTO_SOUMISE',
      'VARIANTE_PHOTO_APPROUVEE',
      'VARIANTE_PHOTO_REFUSEE',
      'VARIANTE_PHOTO_RETIRE',
    ],
  };

  // Consultation du journal d'audit immuable (UC12 / Test T19)
  fastify.get('/audit-trail', {
    preHandler: [fastify.authorize(allowedAuditors)],
    schema: {
      tags: ['Événements & Audit'],
      summary: 'Consultation du journal d audit immuable (UC12 / Test T19)',
      description: 'Piste d audit probante et immuable filtrable par type, acteur, dossier cible, signalement cible.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          typeEvenement: { type: 'string' },
          idActeur: { type: 'string', format: 'uuid' },
          idDossierCible: { type: 'string', format: 'uuid' },
          idSignalementCible: { type: 'string', format: 'uuid' },
          limit: { type: 'number', default: 100 },
        },
      },
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
                  idEvenement: { type: 'string', format: 'uuid' },
                  typeEvenement: { type: 'string' },
                  dateEvenement: { type: 'string' },
                  dateEnregistrement: { type: 'string' },
                  origine: { type: 'string' },
                  idActeur: { type: 'string', format: 'uuid', nullable: true },
                  nomActeur: { type: 'string', nullable: true },
                  prenomActeur: { type: 'string', nullable: true },
                  idSignalementCible: { type: 'string', format: 'uuid', nullable: true },
                  idDossierCible: { type: 'string', format: 'uuid', nullable: true },
                  idRattachementCible: { type: 'string', format: 'uuid', nullable: true },
                  idAffectationCible: { type: 'string', format: 'uuid', nullable: true },
                  idInterventionCible: { type: 'string', format: 'uuid', nullable: true },
                  idVerificationCible: { type: 'string', format: 'uuid', nullable: true },
                  idUtilisateurCible: { type: 'string', format: 'uuid', nullable: true },
                  idEvenementCorrige: { type: 'string', format: 'uuid', nullable: true },
                  donneesAvant: { type: 'string', nullable: true },
                  donneesApres: { type: 'string', nullable: true },
                  destinataireExterne: { type: 'string', nullable: true },
                  motif: { type: 'string', nullable: true },
                  correlationId: { type: 'string', format: 'uuid', nullable: true },
                },
              },
            },
          },
        },
      },
    },
  }, async (req) => {
    const roles = req.user!.roles;
    const allowedEventTypes = roles.includes(RoleCode.ADMIN)
      ? undefined
      : [...new Set(roles.flatMap((role) => auditEventTypesByRole[role] ?? []))];
    const events = await listAuditEvents(repository, {
      ...(req.query as {
      typeEvenement?: string;
      idActeur?: string;
      idDossierCible?: string;
      idSignalementCible?: string;
      limit?: string | number;
      }),
      allowedEventTypes,
    });
    return { success: true, count: events.length, data: events };
  });

  // Correction immuable d'un événement passé (Test T18)
  fastify.post('/:id/corriger', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Événements & Audit'],
      summary: 'Correction immuable d un événement passé (Test T18)',
      description: 'L événement d origine reste INCHANGÉ. Un nouvel événement rectificatif est inséré pointant vers idEvenementCorrige (append-only audit log).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID de l événement historique à rectifier' },
        },
      },
      body: {
        type: 'object',
        required: ['motif'],
        properties: {
          nouveauType: { type: 'string', default: 'EVENEMENT_CORRIGE' },
          motif: { type: 'string', minLength: 10, description: 'Motif explicite obligatoire (min 10 car.)' },
          donneesApres: { type: 'object', additionalProperties: true },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            idEvenement: { type: 'string', format: 'uuid' },
            idEvenementCorrige: { type: 'string', format: 'uuid' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      nouveauType?: string;
      motif: string;
      donneesApres?: unknown;
    };

    try {
      const correction = await correctAuditEvent(repository, {
        eventId: id,
        actorId: req.user!.idUtilisateur,
        newType: body.nouveauType,
        reason: body.motif,
        dataAfter: body.donneesApres,
      });

      return reply.status(201).send({
        success: true,
        ...correction,
        message: "Correction enregistrée sans modification de l'événement historique (Test T18).",
      });
    } catch (error) {
      rethrowEvenementError(error);
    }
  });

  // Enregistrement direct d'un événement métier (Tests T17, T32, T33, T34)
  fastify.post('/', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Événements & Audit'],
      summary: 'Enregistrement direct d un événement métier avec cible exclusive (Tests T17, T32, T33, T34)',
      description: 'Garantit l invariant de cible exclusive : exactement un groupe d entité cible (signalement, dossier, volet composite, etc.).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      body: {
        type: 'object',
        required: ['typeEvenement'],
        properties: {
          typeEvenement: { type: 'string' },
          dateEvenement: { type: 'string' },
          idSignalementCible: { type: 'string', format: 'uuid' },
          idDossierCible: { type: 'string', format: 'uuid' },
          idRattachementCible: { type: 'string', format: 'uuid' },
          idAffectationCible: { type: 'string', format: 'uuid' },
          idInterventionCible: { type: 'string', format: 'uuid' },
          idVerificationCible: { type: 'string', format: 'uuid' },
          idUtilisateurCible: { type: 'string', format: 'uuid' },
          idEquipeCible: { type: 'string', format: 'uuid' },
          idTypeDechetCible: { type: 'string', format: 'uuid' },
          idCompetenceEquipeCible: { type: 'string', format: 'uuid' },
          idDossierContenuCible: { type: 'string', format: 'uuid' },
          idTypeDechetContenuCible: { type: 'string', format: 'uuid' },
          motif: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            idEvenement: { type: 'string', format: 'uuid' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as {
      typeEvenement?: string;
      dateEvenement?: string;
      motif?: string;
    } & EventTargets;
    const { typeEvenement, dateEvenement, motif, ...targets } = body;

    try {
      const idEvenement = await createAuditEvent(repository, {
        typeEvenement,
        dateEvenement,
        actorId: req.user!.idUtilisateur,
        targets,
        motif,
      });

      return reply.status(201).send({
        success: true,
        idEvenement,
        message: 'Événement métier créé avec succès.',
      });
    } catch (error) {
      rethrowEvenementError(error);
    }
  });
};
