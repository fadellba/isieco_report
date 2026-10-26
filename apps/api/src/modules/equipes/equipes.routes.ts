import { FastifyPluginAsync } from 'fastify';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../core/errors.js';
import {
  teamDecisionTypes,
  TeamAvailabilityRuleError,
  TeamDelegationRuleError,
} from '../../domain/team-delegation.js';
import {
  grantTeamDelegation,
  listTeamAvailabilityHistory,
  listTeamDelegations,
  revokeTeamDelegation,
  updateTeamAvailability,
} from '../../application/use-cases/team-delegations.js';

const decisionLabels: Record<(typeof teamDecisionTypes)[number], string> = {
  REPONSE_AFFECTATION: 'répondre à une affectation',
  MISE_A_JOUR_DISPONIBILITE: 'mettre à jour la disponibilité',
  SOUMISSION_COMPTE_RENDU: 'soumettre un compte rendu',
};

function rethrowDomainError(error: unknown): never {
  if (error instanceof TeamAvailabilityRuleError) {
    switch (error.rule) {
      case 'TEAM_NOT_FOUND':
        throw new NotFoundError("L'équipe est introuvable.");
      case 'AVAILABILITY_UPDATE_FORBIDDEN':
        throw new ForbiddenError('Seul le chef actif ou son délégataire peut consulter/modifier la disponibilité.');
      case 'INVALID_AVAILABILITY_PERIOD':
        throw new BadRequestError('La date de validité doit être future.');
    }
  }
  if (!(error instanceof TeamDelegationRuleError)) {
    throw error;
  }

  switch (error.rule) {
    case 'LEADER_REQUIRED':
      throw new ForbiddenError('Seul le chef actif de cette équipe peut gérer ses délégations.');
    case 'ACTIVE_MEMBER_REQUIRED':
      throw new BadRequestError('Le délégataire doit être un membre actif de cette équipe.');
    case 'DELEGATION_ALREADY_ACTIVE':
      throw new ConflictError('Une délégation active existe déjà pour cette responsabilité.');
    case 'INVALID_PERIOD':
      throw new BadRequestError('La date de fin doit être postérieure à la date de début.');
    case 'DELEGATION_NOT_FOUND':
      throw new NotFoundError('Délégation active introuvable pour cette équipe.');
  }
}

const teamIdParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

export const equipesRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = fastify.dependencies.teamDelegations;

  fastify.put('/:id/disponibilite', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Équipes'],
      summary: 'Mettre à jour la disponibilité d’une équipe',
      description: 'Le chef actif ou un délégataire MISE_A_JOUR_DISPONIBILITE peut renseigner une disponibilité à durée limitée. Elle informe l’affectation sans la bloquer.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: teamIdParams,
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['etatDisponibilite', 'valideJusqua'],
        properties: {
          etatDisponibilite: { type: 'string', enum: ['DISPONIBLE', 'INDISPONIBLE'] },
          valideJusqua: { type: 'string', format: 'date-time' },
          commentaire: { type: 'string', maxLength: 2000, nullable: true },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      etatDisponibilite: 'DISPONIBLE' | 'INDISPONIBLE';
      valideJusqua: string;
      commentaire?: string | null;
    };
    try {
      const result = await updateTeamAvailability(repository, {
        teamId: id,
        actorId: request.user!.idUtilisateur,
        status: body.etatDisponibilite,
        validUntil: new Date(body.valideJusqua),
        comment: body.commentaire ?? null,
      });
      return {
        success: true,
        changed: result === 'UPDATED',
        message: 'Disponibilité de l’équipe enregistrée.',
      };
    } catch (error) {
      rethrowDomainError(error);
    }
  });

  fastify.get('/:id/disponibilite/historique', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Équipes'],
      summary: 'Consulter l’historique de disponibilité d’une équipe',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: teamIdParams,
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    try {
      const data = await listTeamAvailabilityHistory(
        repository,
        id,
        request.user!.idUtilisateur,
      );
      return { success: true, count: data.length, data };
    } catch (error) {
      rethrowDomainError(error);
    }
  });

  fastify.get('/:id/delegations', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Équipes'],
      summary: 'Lister les responsabilités actuellement déléguées par le chef',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: teamIdParams,
    },
  }, async (request) => {
    const { id } = request.params as { id: string };

    try {
      const data = await listTeamDelegations(repository, id, request.user!.idUtilisateur);
      return { success: true, count: data.length, data };
    } catch (error) {
      rethrowDomainError(error);
    }
  });

  fastify.post('/:id/delegations', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Équipes'],
      summary: 'Déléguer une responsabilité précise à un membre actif',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: teamIdParams,
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['idUtilisateurDelegue', 'typeDecision'],
        properties: {
          idUtilisateurDelegue: { type: 'string', format: 'uuid' },
          typeDecision: { type: 'string', enum: [...teamDecisionTypes] },
          dateFin: { type: 'string', format: 'date-time' },
          motif: { type: 'string', maxLength: 2000 },
        },
      },
      response: {
        201: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      idUtilisateurDelegue: string;
      typeDecision: (typeof teamDecisionTypes)[number];
      dateFin?: string;
      motif?: string;
    };

    try {
      const delegation = await grantTeamDelegation(repository, {
        teamId: id,
        leaderId: request.user!.idUtilisateur,
        delegateId: body.idUtilisateurDelegue,
        decisionType: body.typeDecision,
        endAt: body.dateFin ? new Date(body.dateFin) : null,
        reason: body.motif?.trim() || null,
      });

      return reply.code(201).send({ success: true, data: delegation });
    } catch (error) {
      rethrowDomainError(error);
    }
  });

  fastify.delete('/:id/delegations/:idDelegation', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Équipes'],
      summary: 'Retirer une délégation active',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id', 'idDelegation'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          idDelegation: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request) => {
    const { id, idDelegation } = request.params as {
      id: string;
      idDelegation: string;
    };

    try {
      const delegation = await revokeTeamDelegation(
        repository,
        id,
        idDelegation,
        request.user!.idUtilisateur,
      );

      return { success: true, data: delegation };
    } catch (error) {
      rethrowDomainError(error);
    }
  });
};
