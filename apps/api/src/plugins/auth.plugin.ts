import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { getDb } from '../db/index.js';
import { UserContext, requireAnyRole } from '../core/rbac.js';
import { UnauthorizedError } from '../core/errors.js';
import { RoleCode } from '@isieco/shared';

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserContext;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (allowedRoles: RoleCode[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPluginCallback: FastifyPluginAsync = async (fastify) => {
  // Décorateur d'authentification
  fastify.decorate('authenticate', async (req: FastifyRequest, _reply: FastifyReply) => {
    let token: string | undefined;
    let clientType: 'WEB' | 'MOBILE' = 'WEB';

    // 1. Priorité au header Bearer (Client Mobile ou API directe)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
      clientType = 'MOBILE';
    } 
    // 2. Sinon cookie de session (Client Web)
    else if (req.cookies && req.cookies.session_token) {
      token = req.cookies.session_token;
      clientType = 'WEB';
    }

    if (!token) {
      throw new UnauthorizedError('Session non fournie. Veuillez vous connecter.');
    }

    const db = getDb();

    // Recherche de la session active non expirée
    const sessionRow = await db.queryOne<{
      id_session: string;
      id_utilisateur: string;
      token: string;
      client_type: string;
      date_expiration: string;
      est_actif: boolean | number;
    }>(
      `SELECT id_session, id_utilisateur, token, client_type, date_expiration, est_actif
       FROM session
       WHERE token = $1 AND est_actif = TRUE`,
      [token]
    );

    if (!sessionRow) {
      throw new UnauthorizedError('Session invalide ou expirée.');
    }

    // Vérifier l'expiration
    const now = new Date();
    const expiry = new Date(sessionRow.date_expiration);
    if (expiry < now) {
      throw new UnauthorizedError('Session expirée. Veuillez vous reconnecter.');
    }

    // Récupérer l'utilisateur et ses rôles actifs
    const userRow = await db.queryOne<{
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
       WHERE id_utilisateur = $1`,
      [sessionRow.id_utilisateur]
    );

    if (!userRow) {
      throw new UnauthorizedError('Utilisateur associé à la session introuvable.');
    }

    // Règle T30 & T39 : Un compte inactif/suspendu ne peut effectuer AUCUNE action authentifiée
    if (userRow.etat_compte !== 'ACTIF') {
      throw new UnauthorizedError(`Compte utilisateur ${userRow.etat_compte.toLowerCase()}. Accès refusé.`);
    }

    // Récupérer les rôles actifs de l'utilisateur
    const rolesRows = await db.query<{ code_role: string }>(
      `SELECT r.code_role
       FROM utilisateur_role ur
       JOIN role r ON ur.id_role = r.id_role
       WHERE ur.id_utilisateur = $1
         AND (ur.date_fin IS NULL OR ur.date_fin >= CURRENT_TIMESTAMP)`,
      [userRow.id_utilisateur]
    );

    const activeRoles = rolesRows.map((r) => r.code_role as RoleCode);

    req.user = {
      idUtilisateur: userRow.id_utilisateur,
      email: userRow.email,
      nom: userRow.nom,
      prenom: userRow.prenom,
      etatCompte: userRow.etat_compte,
      roles: activeRoles,
      idSession: sessionRow.id_session,
      clientType: sessionRow.client_type as 'WEB' | 'MOBILE',
      telephone: userRow.telephone,
      dateInscription: userRow.date_inscription,
    };
  });

  // Décorateur d'autorisation RBAC
  fastify.decorate('authorize', (allowedRoles: RoleCode[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      // S'assurer que la requête est authentifiée au préalable
      if (!req.user) {
        await fastify.authenticate(req, reply);
      }
      requireAnyRole(req.user!, allowedRoles);
    };
  });
};

export const authPlugin = fp(authPluginCallback, {
  name: 'auth-plugin',
});
