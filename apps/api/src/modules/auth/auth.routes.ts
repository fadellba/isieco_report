import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { BadRequestError, UnauthorizedError } from '../../core/errors.js';
import { LoginRequestSchema, ClientType } from '@isieco/shared';
import {
  changeCurrentPassword,
  getCurrentProfile,
  login,
  logout,
  updateCurrentProfile,
} from '../../application/use-cases/identity.js';
import { IdentityRuleError } from '../../domain/identity.js';
import { config } from '../../config.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = fastify.dependencies.identity;

  function rethrowIdentityError(error: unknown): never {
    if (!(error instanceof IdentityRuleError)) throw error;

    switch (error.rule) {
      case 'INVALID_CREDENTIALS':
      case 'ACCOUNT_INACTIVE':
      case 'SESSION_NOT_FOUND':
      case 'SESSION_EXPIRED':
      case 'USER_NOT_FOUND':
      case 'INVALID_CURRENT_PASSWORD':
        throw new UnauthorizedError(error.message);
      case 'INVALID_PROFILE':
      case 'UNCHANGED_PASSWORD':
      case 'INVALID_ACCOUNT_STATUS':
        throw new BadRequestError(error.message);
    }
  }

  const loginSchema = {
    schema: {
      tags: ['Authentification'],
      summary: 'Connexion utilisateur (Web & Mobile)',
      description:
        'Authentifie un citoyen ou un agent communal. Émet un cookie de session HttpOnly pour le client Web et renvoie un Bearer JWT pour le client Mobile.',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'fatou.ba@citoyen.sn' },
          password: { type: 'string', example: 'Citoyen2026!' },
          clientType: {
            type: 'string',
            enum: ['WEB', 'MOBILE'],
            default: 'WEB',
            description: 'Canal de connexion pour adapter la méthode de maintien de session.',
          },
        },
      },
      response: {
        200: {
          description: 'Authentification réussie',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            user: {
              type: 'object',
              properties: {
                idUtilisateur: { type: 'string', format: 'uuid' },
                nom: { type: 'string' },
                prenom: { type: 'string', nullable: true },
                email: { type: 'string' },
                telephone: { type: 'string', nullable: true },
                etatCompte: { type: 'string' },
                roles: { type: 'array', items: { type: 'string' } },
                dateInscription: { type: 'string' },
              },
            },
            token: { type: 'string', nullable: true, description: 'Token Bearer transmis pour les clients mobiles' },
            clientType: { type: 'string' },
          },
        },
        401: {
          description: 'Identifiants invalides ou compte inactif',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'UNAUTHORIZED' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  };

  const handleLogin = async (req: FastifyRequest, reply: FastifyReply) => {
    // Normaliser payload pour accepter motDePasse ou password
    const raw = (req.body || {}) as {
      email?: string;
      password?: string;
      motDePasse?: string;
      clientType?: ClientType;
    };
    const normalizedBody = {
      email: raw.email,
      password: raw.password || raw.motDePasse,
      clientType: raw.clientType || ClientType.MOBILE,
    };

    const body = LoginRequestSchema.parse(normalizedBody);
    let session: Awaited<ReturnType<typeof login>>;
    try {
      session = await login(repository, fastify.dependencies.identitySecurity, {
        email: body.email,
        password: body.password,
        clientType: body.clientType,
        ipAddress: req.ip || null,
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      });
    } catch (error) {
      if (
        error instanceof IdentityRuleError &&
        (error.rule === 'INVALID_CREDENTIALS' || error.rule === 'ACCOUNT_INACTIVE')
      ) {
        throw new UnauthorizedError('Identifiants de connexion invalides.');
      }
      rethrowIdentityError(error);
    }

    // 6. Gestion du cookie HttpOnly pour client Web
    if (body.clientType === ClientType.WEB) {
      reply.setCookie('session_token', session.token, {
        path: '/',
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 jours en secondes
      });
    }

    return reply.send({
      success: true,
      user: session.user,
      utilisateur: session.user, // Alias pratique
      ...(body.clientType === ClientType.MOBILE ? { token: session.token } : {}),
      clientType: body.clientType,
    });
  };

  // Endpoints de connexion
  const loginRateLimit = {
    config: {
      rateLimit: {
        max: config.env === 'test' ? 1000 : 8,
        timeWindow: '15 minutes',
        groupId: 'auth-login',
        errorResponseBuilder: () => ({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Trop de tentatives de connexion. Réessayez plus tard.',
          },
        }),
      },
    },
  };
  fastify.post('/login', { ...loginSchema, ...loginRateLimit }, handleLogin);
  fastify.post('/connexion', { ...loginSchema, ...loginRateLimit }, handleLogin);

  const logoutSchema = {
    schema: {
      tags: ['Authentification'],
      summary: 'Déconnexion et révocation de session',
      description: 'Révoque immédiatement la session active et supprime le cookie de session.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }] as Array<{ [key: string]: string[] }>,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
          },
        },
      },
    },
  };

  const handleLogout = async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.user?.idSession) {
      await logout(repository, req.user.idSession);
    }

    reply.clearCookie('session_token', { path: '/' });
    return reply.send({
      success: true,
      message: 'Déconnexion effectuée avec succès.',
    });
  };

  fastify.post('/logout', { preHandler: [fastify.authenticate], ...logoutSchema }, handleLogout);
  fastify.post('/deconnexion', { preHandler: [fastify.authenticate], ...logoutSchema }, handleLogout);

  // Profil courant (Me)
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Authentification'],
      summary: 'Profil du compte actuellement connecté',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            user: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  }, async (req, reply) => {
    let user: Awaited<ReturnType<typeof getCurrentProfile>>;
    try {
      user = await getCurrentProfile(repository, req.user!.idUtilisateur);
    } catch (error) {
      rethrowIdentityError(error);
    }

    return reply.send({
      success: true,
      user: {
        ...req.user,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        telephone: user.telephone,
        etatCompte: user.etatCompte,
        dateInscription: user.dateInscription,
      },
    });
  });

  fastify.patch('/me', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Authentification'],
      summary: 'Modifier les informations personnelles du compte courant',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      body: {
        type: 'object',
        required: ['nom', 'prenom', 'telephone'],
        properties: {
          nom: { type: 'string', minLength: 1, maxLength: 100 },
          prenom: { type: 'string', maxLength: 100, nullable: true },
          telephone: { type: 'string', maxLength: 50, nullable: true },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as { nom: string; prenom: string | null; telephone: string | null };
    const nom = body.nom.trim();
    const prenom = body.prenom?.trim() || null;
    const telephone = body.telephone?.trim() || null;
    try {
      await updateCurrentProfile(repository, {
        idUtilisateur: req.user!.idUtilisateur,
        nom,
        prenom,
        telephone,
      });
    } catch (error) {
      rethrowIdentityError(error);
    }

    return reply.send({
      success: true,
      user: {
        ...req.user,
        nom,
        prenom,
        telephone,
      },
    });
  });

  fastify.patch('/password', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Authentification'],
      summary: 'Changer le mot de passe du compte courant',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', minLength: 1 },
          newPassword: { type: 'string', minLength: 12, maxLength: 128 },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as { currentPassword: string; newPassword: string };
    try {
      await changeCurrentPassword(repository, fastify.dependencies.identitySecurity, {
        idUtilisateur: req.user!.idUtilisateur,
        currentSessionId: req.user!.idSession,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      });
    } catch (error) {
      rethrowIdentityError(error);
    }

    return reply.send({ success: true, message: 'Mot de passe mis à jour. Vos autres sessions ont été fermées.' });
  });
};
