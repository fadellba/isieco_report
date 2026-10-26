import { FastifyPluginAsync } from 'fastify';
import { RoleCode } from '@isieco/shared';
import { NotFoundError, BadRequestError } from '../../core/errors.js';
import {
  assignRole,
  listUsers,
  updateAccountStatus,
} from '../../application/use-cases/identity.js';
import { IdentityRuleError } from '../../domain/identity.js';

export const utilisateursRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = fastify.dependencies.identity;

  function rethrowIdentityError(error: unknown): never {
    if (!(error instanceof IdentityRuleError)) throw error;

    switch (error.rule) {
      case 'INVALID_ACCOUNT_STATUS':
        throw new BadRequestError(error.message);
      default:
        throw error;
    }
  }

  // Liste des utilisateurs (Réservé ADMIN)
  fastify.get('/', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Utilisateurs & RBAC'],
      summary: 'Liste des utilisateurs et rôles actifs (Admin)',
      description: 'Consultation complète de l annuaire des utilisateurs avec leurs statuts de compte et attributions de rôles en cours.',
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
                  idUtilisateur: { type: 'string', format: 'uuid' },
                  nom: { type: 'string' },
                  prenom: { type: 'string', nullable: true },
                  email: { type: 'string' },
                  telephone: { type: 'string', nullable: true },
                  etatCompte: { type: 'string' },
                  dateInscription: { type: 'string' },
                  roles: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
  }, async () => {
    const results = await listUsers(repository);

    return { success: true, count: results.length, data: results };
  });

  // Modification de l'état du compte (Activer / Désactiver)
  fastify.patch('/:id/etat', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Utilisateurs & RBAC'],
      summary: 'Activer, désactiver ou suspendre un compte utilisateur (Admin)',
      description: 'Met à jour l état du compte (ACTIF, INACTIF, SUSPENDU). Si désactivé, révoque immédiatement toutes ses sessions actives et trace l audit.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID de l utilisateur cible' },
        },
      },
      body: {
        type: 'object',
        required: ['etatCompte'],
        properties: {
          etatCompte: { type: 'string', enum: ['ACTIF', 'INACTIF', 'SUSPENDU'] },
          motif: { type: 'string', description: 'Motif de désactivation ou réactivation' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            idUtilisateur: { type: 'string', format: 'uuid' },
            etatCompte: { type: 'string' },
          },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const { etatCompte, motif } = req.body as { etatCompte: string; motif?: string };

    let updated: boolean;
    try {
      updated = await updateAccountStatus(repository, {
        idUtilisateur: id,
        actorId: req.user!.idUtilisateur,
        etatCompte,
        motif: motif ?? null,
      });
    } catch (error) {
      rethrowIdentityError(error);
    }
    if (!updated) throw new NotFoundError('Utilisateur introuvable.');

    return {
      success: true,
      message: `État du compte mis à jour avec succès : ${etatCompte}`,
      idUtilisateur: id,
      etatCompte,
    };
  });

  // Attribution d'un rôle
  fastify.post('/:id/roles', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Utilisateurs & RBAC'],
      summary: 'Attribuer un rôle à un utilisateur (Admin)',
      description: 'Assigne un nouveau rôle (CITOYEN, QUALIFICATION, TRAITEMENT, AFFECTATION, TERRAIN, VERIFICATION, DECISION, ADMIN) avec journalisation immuable.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID de l utilisateur' },
        },
      },
      body: {
        type: 'object',
        required: ['codeRole'],
        properties: {
          codeRole: { type: 'string', description: 'Code du rôle (ex: TERRAIN, QUALIFICATION, ADMIN)' },
          motif: { type: 'string' },
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
    const { codeRole, motif } = req.body as { codeRole: string; motif?: string };

    const result = await assignRole(repository, {
      idUtilisateur: id,
      actorId: req.user!.idUtilisateur,
      codeRole,
      motif: motif ?? null,
    });
    if (result === 'USER_NOT_FOUND') throw new NotFoundError('Utilisateur introuvable.');
    if (result === 'ROLE_NOT_FOUND') throw new NotFoundError(`Rôle introuvable : ${codeRole}`);

    return {
      success: true,
      message: `Rôle ${codeRole} attribué avec succès.`,
    };
  });
};
