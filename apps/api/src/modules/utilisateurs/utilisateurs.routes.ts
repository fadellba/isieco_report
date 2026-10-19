import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/index.js';
import { RoleCode } from '@isieco/shared';
import { NotFoundError, BadRequestError } from '../../core/errors.js';
import crypto from 'node:crypto';

export const utilisateursRoutes: FastifyPluginAsync = async (fastify) => {
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
    const db = getDb();
    const users = await db.query<{
      id_utilisateur: string;
      nom: string;
      prenom: string | null;
      email: string;
      telephone: string | null;
      etat_compte: string;
      date_inscription: string;
    }>(
      `SELECT id_utilisateur, nom, prenom, email, telephone, etat_compte, date_inscription
       FROM utilisateur
       ORDER BY nom ASC`
    );

    // Charger les rôles de chaque utilisateur
    const results = await Promise.all(
      users.map(async (u) => {
        const roles = await db.query<{ code_role: string }>(
          `SELECT r.code_role
           FROM utilisateur_role ur
           JOIN role r ON ur.id_role = r.id_role
           WHERE ur.id_utilisateur = $1 AND (ur.date_fin IS NULL OR ur.date_fin >= CURRENT_TIMESTAMP)`,
          [u.id_utilisateur]
        );
        return {
          idUtilisateur: u.id_utilisateur,
          nom: u.nom,
          prenom: u.prenom,
          email: u.email,
          telephone: u.telephone,
          etatCompte: u.etat_compte,
          dateInscription: u.date_inscription,
          roles: roles.map((r) => r.code_role),
        };
      })
    );

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

    if (!['ACTIF', 'INACTIF', 'SUSPENDU'].includes(etatCompte)) {
      throw new BadRequestError("L'état du compte doit être ACTIF, INACTIF ou SUSPENDU.");
    }

    const db = getDb();
    const user = await db.queryOne<{ id_utilisateur: string; etat_compte: string }>(
      `SELECT id_utilisateur, etat_compte FROM utilisateur WHERE id_utilisateur = $1`,
      [id]
    );

    if (!user) {
      throw new NotFoundError('Utilisateur introuvable.');
    }

    const etatAvant = user.etat_compte;

    // Mise à jour et journalisation atomique
    await db.transaction(async (trx) => {
      await trx.execute(
        `UPDATE utilisateur SET etat_compte = $1 WHERE id_utilisateur = $2`,
        [etatCompte, id]
      );

      // Si le compte est désactivé, révoquer immédiatement toutes ses sessions actives
      if (etatCompte !== 'ACTIF') {
        await trx.execute(
          `UPDATE session SET est_actif = FALSE WHERE id_utilisateur = $1`,
          [id]
        );
      }

      // Traçabilité événementielle immuable
      const typeEv = etatCompte === 'INACTIF' ? 'COMPTE_DESACTIVE' : 'COMPTE_MODIFIE';
      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur, id_utilisateur_cible,
           donnees_avant, donnees_apres, motif
         ) VALUES ($1, $2, 'PORTAIL_GESTION', $3, $4, $5, $6, $7)`,
        [
          crypto.randomUUID(),
          typeEv,
          req.user!.idUtilisateur,
          id,
          JSON.stringify({ etatCompte: etatAvant }),
          JSON.stringify({ etatCompte }),
          motif || `Modification de l'état du compte par l'administrateur`,
        ]
      );
    });

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

    const db = getDb();
    const role = await db.queryOne<{ id_role: string; code_role: string }>(
      `SELECT id_role, code_role FROM role WHERE code_role = $1`,
      [codeRole]
    );

    if (!role) {
      throw new NotFoundError(`Rôle introuvable : ${codeRole}`);
    }

    await db.transaction(async (trx) => {
      await trx.execute(
        `INSERT INTO utilisateur_role (id_utilisateur, id_role, date_debut, attribue_par, motif)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)`,
        [id, role.id_role, req.user!.idUtilisateur, motif || null]
      );

      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur, id_utilisateur_cible,
           donnees_apres, motif
         ) VALUES ($1, 'ROLE_ATTRIBUE', 'PORTAIL_GESTION', $2, $3, $4, $5)`,
        [
          crypto.randomUUID(),
          req.user!.idUtilisateur,
          id,
          JSON.stringify({ codeRole }),
          motif || `Attribution du rôle ${codeRole}`,
        ]
      );
    });

    return {
      success: true,
      message: `Rôle ${codeRole} attribué avec succès.`,
    };
  });
};

