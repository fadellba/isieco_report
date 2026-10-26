import { FastifyPluginAsync } from 'fastify';
import { RoleCode } from '@isieco/shared';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors.js';
import {
  addTeamMember,
  archiveTeam,
  archiveTeamCompetence,
  archiveWasteType,
  reactivateWasteType,
  createTeamCompetence,
  createTeam,
  createWasteType,
  endTeamMember,
  reactivateTeam,
  listActiveCompetences,
  listActiveTeams,
  listActiveWasteTypes,
} from '../../application/use-cases/referentials.js';
import { ReferentialRuleError } from '../../domain/referentials.js';

const teamIdParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

export const referentielsRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = fastify.dependencies.referentials;

  function rethrowReferentialError(error: unknown): never {
    if (!(error instanceof ReferentialRuleError)) {
      throw error;
    }

    switch (error.rule) {
      case 'INVALID_COMPETENCE_PERIOD':
        throw new BadRequestError('La date de fin de validité doit être postérieure ou égale à la date de début (Test T22).');
      case 'TEAM_NOT_FOUND':
        throw new NotFoundError("L'équipe indiquée est introuvable.");
      case 'WASTE_TYPE_NOT_FOUND':
        throw new NotFoundError('Le type de déchet indiqué est introuvable.');
      case 'USER_NOT_FOUND':
        throw new NotFoundError("L'utilisateur indiqué est introuvable.");
      case 'COMPETENCE_NOT_FOUND':
        throw new NotFoundError('La compétence indiquée est introuvable.');
      case 'TEAM_NOT_ACTIVE':
        throw new ConflictError("L'équipe n'est pas active.");
      case 'USER_NOT_ACTIVE':
        throw new ConflictError("Le compte de l'utilisateur n'est pas actif.");
      case 'USER_MUST_HAVE_TERRAIN_ROLE':
        throw new BadRequestError("Un membre d'équipe doit posséder le rôle TERRAIN.");
      case 'MEMBERSHIP_NOT_FOUND':
        throw new NotFoundError("L'appartenance active est introuvable.");
      case 'MEMBERSHIP_ALREADY_ACTIVE':
        throw new ConflictError("L'utilisateur est déjà membre actif de cette équipe.");
      case 'COMPETENCE_NOT_STARTED':
        throw new ConflictError("Une compétence future ne peut pas être archivée avant son début.");
      case 'TEAM_HAS_ACTIVE_ASSIGNMENTS':
        throw new ConflictError("L'équipe possède des affectations en cours ou à vérifier.");
      case 'WASTE_TYPE_CODE_ALREADY_EXISTS':
        throw new ConflictError('Ce code de type de déchet est déjà utilisé.');
      case 'COMPETENCE_ALREADY_EXISTS':
        throw new ConflictError('Cette compétence existe déjà pour cette période.');
      case 'WASTE_TYPE_ALREADY_ACTIVE':
        throw new ConflictError('Ce type de déchet est déjà actif.');
      case 'TEAM_ALREADY_ACTIVE':
        throw new ConflictError("L'équipe est déjà active.");
      case 'INVALID_REACTIVATION_REASON':
        throw new BadRequestError('Un motif de réactivation d’au moins 10 caractères est obligatoire.');
    }
  }

  function rethrowMutationError(error: unknown): never {
    if (error instanceof ReferentialRuleError) rethrowReferentialError(error);
    throw error;
  }

  // Référentiel des types de déchets (Actifs)
  fastify.get('/types-dechets', {
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Liste des catégories de déchets actives',
      description: 'Renvoie les types de déchets reconnus par le système municipal de Dakar (Plastiques, Gravats, Métaux, etc.).',
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
                  idTypeDechet: { type: 'string', format: 'uuid' },
                  codeType: { type: 'string', example: 'PLASTIQUE' },
                  libelle: { type: 'string', example: 'Déchets Plastiques' },
                  description: { type: 'string', nullable: true },
                  orientationSpecialisee: { type: 'boolean' },
                  dateDebutValidite: { type: 'string' },
                  dateFinValidite: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
  }, async () => {
    const rows = await listActiveWasteTypes(repository);
    return { success: true, count: rows.length, data: rows };
  });

  fastify.post('/types-dechets', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Créer un type de déchet',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['codeType', 'libelle'],
        properties: {
          codeType: { type: 'string', minLength: 1, maxLength: 50 },
          libelle: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', nullable: true },
          orientationSpecialisee: { type: 'boolean', default: false },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      codeType: string;
      libelle: string;
      description?: string | null;
      orientationSpecialisee?: boolean;
    };
    try {
      const idTypeDechet = await createWasteType(repository, {
        codeType: body.codeType,
        libelle: body.libelle,
        description: body.description ?? null,
        orientationSpecialisee: body.orientationSpecialisee ?? false,
      });
      return reply.code(201).send({ success: true, idTypeDechet });
    } catch (error) {
      rethrowMutationError(error);
    }
  });

  fastify.post('/types-dechets/:id/archiver', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Archiver un type de déchet sans supprimer son historique',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: teamIdParams,
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    try {
      await archiveWasteType(repository, id);
      return { success: true, archived: true };
    } catch (error) {
      rethrowMutationError(error);
    }
  });

  fastify.post('/types-dechets/:id/reactiver', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Réactiver un type de déchet et tracer la nouvelle décision',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: teamIdParams,
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['motif'],
        properties: { motif: { type: 'string', minLength: 10 } },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { motif } = request.body as { motif: string };
    try {
      await reactivateWasteType(repository, id, request.user!.idUtilisateur, motif);
      return { success: true, reactivated: true };
    } catch (error) {
      rethrowMutationError(error);
    }
  });

  fastify.post('/equipes', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Créer une équipe opérationnelle',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['nomEquipe'],
        properties: {
          nomEquipe: { type: 'string', minLength: 1, maxLength: 150 },
          description: { type: 'string', nullable: true },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { nomEquipe: string; description?: string | null };
    const idEquipe = await createTeam(repository, {
      nomEquipe: body.nomEquipe,
      description: body.description ?? null,
    });
    return reply.code(201).send({ success: true, idEquipe });
  });

  fastify.post('/equipes/:id/archiver', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Dissoudre une équipe en préservant son historique',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: teamIdParams,
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    try {
      await archiveTeam(repository, id);
      return { success: true, archived: true };
    } catch (error) {
      rethrowMutationError(error);
    }
  });

  fastify.post('/equipes/:id/reactiver', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Réactiver une équipe sans restaurer ses anciennes appartenances',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: teamIdParams,
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['motif'],
        properties: { motif: { type: 'string', minLength: 10 } },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { motif } = request.body as { motif: string };
    try {
      await reactivateTeam(repository, id, request.user!.idUtilisateur, motif);
      return { success: true, reactivated: true };
    } catch (error) {
      rethrowMutationError(error);
    }
  });

  fastify.post('/equipes/:id/membres', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Ajouter un membre actif à une équipe',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: teamIdParams,
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['idUtilisateur', 'fonction'],
        properties: {
          idUtilisateur: { type: 'string', format: 'uuid' },
          fonction: {
            type: 'string',
            enum: ['AGENT_TERRAIN', 'CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN'],
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      idUtilisateur: string;
      fonction: 'AGENT_TERRAIN' | 'CHEF_EQUIPE' | 'CHEF_EQUIPE_TERRAIN';
    };
    try {
      await addTeamMember(repository, {
        idEquipe: id,
        idUtilisateur: body.idUtilisateur,
        fonction: body.fonction,
      });
      return reply.code(201).send({ success: true });
    } catch (error) {
      rethrowMutationError(error);
    }
  });

  fastify.post('/equipes/:id/membres/:idUtilisateur/archiver', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Clôturer l’appartenance d’un membre à une équipe',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id', 'idUtilisateur'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          idUtilisateur: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request) => {
    const { id, idUtilisateur } = request.params as { id: string; idUtilisateur: string };
    try {
      await endTeamMember(repository, { idEquipe: id, idUtilisateur });
      return { success: true, archived: true };
    } catch (error) {
      rethrowMutationError(error);
    }
  });

  // Référentiel des équipes actives avec leurs membres
  fastify.get('/equipes', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Liste des équipes d intervention et de leurs compétences',
      description: 'Renvoie les équipes municipales actives de Dakar-Plateau et Médina, leurs membres et leurs compétences.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    },
  }, async () => {
    const data = await listActiveTeams(repository);
    return { success: true, count: data.length, data };
  });

  // Liste des compétences d'équipes actives (pour sélecteur d'affectation)
  fastify.get('/competences', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Compétences actives d équipes (pour affectation)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          idTypeDechet: { type: 'string', format: 'uuid', description: 'Filtrer par catégorie technique de déchet' },
        },
      },
    },
  }, async (req) => {
    const query = req.query as { idTypeDechet?: string };
    const rows = await listActiveCompetences(repository, new Date(), query.idTypeDechet);
    return { success: true, count: rows.length, data: rows };
  });

  // Déclaration ou mise à jour de compétence d'équipe (Test T22)
  fastify.post('/competences', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Déclarer ou renouveler une compétence d équipe (Admin / Test T22)',
      description: 'Valide l intégrité de la période temporelle : la date de fin doit être >= date de début (Test T22).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      body: {
        type: 'object',
        required: ['idEquipe', 'idTypeDechet', 'dateDebut'],
        properties: {
          idEquipe: { type: 'string', format: 'uuid' },
          idTypeDechet: { type: 'string', format: 'uuid' },
          dateDebut: { type: 'string', format: 'date-time' },
          dateFin: { type: 'string', format: 'date-time', nullable: true },
          commentaire: { type: 'string', nullable: true },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            idCompetenceEquipe: { type: 'string', format: 'uuid' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { idEquipe, idTypeDechet, dateDebut, dateFin, commentaire } = req.body as {
      idEquipe: string;
      idTypeDechet: string;
      dateDebut: string;
      dateFin?: string | null;
      commentaire?: string;
    };

    if (!idEquipe || !idTypeDechet || !dateDebut) {
      throw new BadRequestError("L'équipe, le type de déchet et la date de début sont obligatoires.");
    }

    let idCompetence: string;
    try {
      idCompetence = await createTeamCompetence(repository, {
        idEquipe,
        idTypeDechet,
        dateDebut: new Date(dateDebut),
        dateFin: dateFin ? new Date(dateFin) : null,
        commentaire: commentaire || 'Habilitation technique validée',
        valideePar: req.user!.idUtilisateur,
      });
    } catch (error) {
      rethrowMutationError(error);
    }

    return reply.status(201).send({
      success: true,
      idCompetenceEquipe: idCompetence,
      message: 'Compétence enregistrée avec succès (Test T22).',
    });
  });

  fastify.post('/competences/:id/archiver', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Archiver une compétence d’équipe sans supprimer son historique',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: teamIdParams,
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    try {
      await archiveTeamCompetence(repository, id);
      return { success: true, archived: true };
    } catch (error) {
      rethrowMutationError(error);
    }
  });
};
