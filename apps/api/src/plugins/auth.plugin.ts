import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { UserContext, requireAnyRole } from '../core/rbac.js';
import { UnauthorizedError } from '../core/errors.js';
import { RoleCode } from '@isieco/shared';
import { getAuthenticatedContext } from '../application/use-cases/identity.js';
import { ApiDependencies } from '../application/ports/api-dependencies.js';
import { IdentityRuleError } from '../domain/identity.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserContext;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (allowedRoles: RoleCode[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    dependencies: ApiDependencies;
  }
}

const authPluginCallback: FastifyPluginAsync = async (fastify) => {
  const identityRepository = fastify.dependencies.identity;
  const identitySecurity = fastify.dependencies.identitySecurity;

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

    try {
      const context = await getAuthenticatedContext(identityRepository, identitySecurity, token);
      req.user = {
        idUtilisateur: context.idUtilisateur,
        email: context.email,
        nom: context.nom,
        prenom: context.prenom,
        etatCompte: context.etatCompte,
        roles: context.roles as RoleCode[],
        idSession: context.idSession,
        clientType: context.clientType as 'WEB' | 'MOBILE',
        telephone: context.telephone,
        dateInscription: context.dateInscription.toISOString(),
      };
    } catch (error) {
      if (error instanceof IdentityRuleError) {
        throw new UnauthorizedError(error.message);
      }
      throw error;
    }
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
