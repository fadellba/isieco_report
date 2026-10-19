import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/index.js';
import { hashPassword, verifyPassword, generateSecureToken } from '../../core/crypto.js';
import { BadRequestError, ConflictError, UnauthorizedError } from '../../core/errors.js';
import { LoginRequestSchema, ClientType, RoleCode } from '@isieco/shared';
import crypto from 'node:crypto';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
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

  const handleLogin = async (req: any, reply: any) => {
    // Normaliser payload pour accepter motDePasse ou password
    const raw = req.body || {};
    const normalizedBody = {
      email: raw.email,
      password: raw.password || raw.motDePasse,
      clientType: raw.clientType || ClientType.MOBILE,
    };

    const body = LoginRequestSchema.parse(normalizedBody);
    const db = getDb();

    // 1. Recherche de l'utilisateur par email
    const user = await db.queryOne<{
      id_utilisateur: string;
      nom: string;
      prenom: string | null;
      email: string;
      telephone: string | null;
      mot_de_passe_hash: string;
      date_inscription: string;
      etat_compte: string;
    }>(
      `SELECT id_utilisateur, nom, prenom, email, telephone, mot_de_passe_hash, date_inscription, etat_compte
       FROM utilisateur
       WHERE LOWER(email) = LOWER($1)`,
      [body.email]
    );

    if (!user) {
      throw new UnauthorizedError('Identifiants de connexion invalides.');
    }

    // 2. Vérification du mot de passe
    const passwordValid = verifyPassword(body.password, user.mot_de_passe_hash);
    if (!passwordValid) {
      throw new UnauthorizedError('Identifiants de connexion invalides.');
    }

    // 3. Contrôle de l'état du compte (Test T30 & T39)
    if (user.etat_compte !== 'ACTIF') {
      throw new UnauthorizedError(`Le compte utilisateur est ${user.etat_compte.toLowerCase()}. Connexion impossible.`);
    }

    // 4. Récupération des rôles actifs
    const rolesRows = await db.query<{ code_role: string }>(
      `SELECT r.code_role
       FROM utilisateur_role ur
       JOIN role r ON ur.id_role = r.id_role
       WHERE ur.id_utilisateur = $1
         AND (ur.date_fin IS NULL OR ur.date_fin >= CURRENT_TIMESTAMP)`,
      [user.id_utilisateur]
    );
    const roles = rolesRows.map((r) => r.code_role as RoleCode);

    // 5. Création de la session sécurisée
    const token = generateSecureToken();
    const idSession = crypto.randomUUID();
    const dateExpiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 jours

    await db.execute(
      `INSERT INTO session (id_session, id_utilisateur, token, client_type, date_expiration, est_actif, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7)`,
      [
        idSession,
        user.id_utilisateur,
        token,
        body.clientType,
        dateExpiration,
        req.ip || null,
        req.headers['user-agent'] || null,
      ]
    );

    // 6. Gestion du cookie HttpOnly pour client Web
    if (body.clientType === ClientType.WEB) {
      reply.setCookie('session_token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 jours en secondes
      });
    }

    const userData = {
      idUtilisateur: user.id_utilisateur,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      telephone: user.telephone,
      etatCompte: user.etat_compte,
      roles,
      dateInscription: user.date_inscription,
    };

    return reply.send({
      success: true,
      user: userData,
      utilisateur: userData, // Alias pratique
      token,
      clientType: body.clientType,
    });
  };

  // Endpoints de connexion
  fastify.post('/login', loginSchema, handleLogin);
  fastify.post('/connexion', loginSchema, handleLogin);

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

  const handleLogout = async (req: any, reply: any) => {
    const db = getDb();
    if (req.user?.idSession) {
      await db.execute(
        `UPDATE session SET est_actif = FALSE WHERE id_session = $1`,
        [req.user.idSession]
      );
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
    const db = getDb();
    const user = await db.queryOne<{
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
      [req.user!.idUtilisateur]
    );
    if (!user) throw new UnauthorizedError('Utilisateur associé à la session introuvable.');

    return reply.send({
      success: true,
      user: {
        ...req.user,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        telephone: user.telephone,
        etatCompte: user.etat_compte,
        dateInscription: user.date_inscription,
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
    if (!nom || nom.length > 100 || (prenom && prenom.length > 100) || (telephone && telephone.length > 50)) {
      throw new BadRequestError('Vérifiez les longueurs des champs du profil.');
    }

    const db = getDb();
    const before = await db.queryOne<{ nom: string; prenom: string | null; telephone: string | null }>(
      'SELECT nom, prenom, telephone FROM utilisateur WHERE id_utilisateur = $1',
      [req.user!.idUtilisateur]
    );
    if (!before) throw new UnauthorizedError('Utilisateur associé à la session introuvable.');

    await db.transaction(async (trx) => {
      await trx.execute(
        'UPDATE utilisateur SET nom = $1, prenom = $2, telephone = $3 WHERE id_utilisateur = $4',
        [nom, prenom, telephone, req.user!.idUtilisateur]
      );
      await trx.execute(
        `INSERT INTO evenement_metier (
          id_evenement, type_evenement, origine, id_acteur, id_utilisateur_cible, donnees_avant, donnees_apres, motif
        ) VALUES ($1, 'COMPTE_MODIFIE', 'PORTAIL_GESTION', $2, $2, $3, $4, 'Mise à jour du profil personnel')`,
        [
          crypto.randomUUID(),
          req.user!.idUtilisateur,
          JSON.stringify(before),
          JSON.stringify({ nom, prenom, telephone }),
        ]
      );
    });

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
    if (body.newPassword.length < 12 || body.newPassword.length > 128) {
      throw new BadRequestError('Le nouveau mot de passe doit contenir de 12 à 128 caractères.');
    }

    const db = getDb();
    const user = await db.queryOne<{ mot_de_passe_hash: string }>(
      'SELECT mot_de_passe_hash FROM utilisateur WHERE id_utilisateur = $1',
      [req.user!.idUtilisateur]
    );
    if (!user) throw new UnauthorizedError('Utilisateur associé à la session introuvable.');
    if (!verifyPassword(body.currentPassword, user.mot_de_passe_hash)) {
      throw new UnauthorizedError('Le mot de passe actuel est incorrect.');
    }
    if (verifyPassword(body.newPassword, user.mot_de_passe_hash)) {
      throw new BadRequestError('Choisissez un mot de passe différent de votre mot de passe actuel.');
    }

    await db.transaction(async (trx) => {
      await trx.execute(
        'UPDATE utilisateur SET mot_de_passe_hash = $1 WHERE id_utilisateur = $2',
        [hashPassword(body.newPassword), req.user!.idUtilisateur]
      );
      await trx.execute(
        `UPDATE session SET est_actif = FALSE
         WHERE id_utilisateur = $1 AND id_session <> $2 AND est_actif = TRUE`,
        [req.user!.idUtilisateur, req.user!.idSession]
      );
      await trx.execute(
        `INSERT INTO evenement_metier (
          id_evenement, type_evenement, origine, id_acteur, id_utilisateur_cible, donnees_apres, motif
        ) VALUES ($1, 'COMPTE_MODIFIE', 'PORTAIL_GESTION', $2, $2, $3, 'Changement du mot de passe personnel')`,
        [
          crypto.randomUUID(),
          req.user!.idUtilisateur,
          JSON.stringify({ motDePasseModifie: true }),
        ]
      );
    });

    return reply.send({ success: true, message: 'Mot de passe mis à jour. Vos autres sessions ont été fermées.' });
  });
};
