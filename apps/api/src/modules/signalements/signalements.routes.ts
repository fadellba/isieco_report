import { FastifyPluginAsync } from 'fastify';
import { RoleCode, StatutSignalement } from '@isieco/shared';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import {
  addSignalementPhoto,
  createSignalement,
  getSignalementDetail,
  getSignalementPhoto,
  listMySignalements,
  uploadSignalementPhoto,
  validateSignalementPhoto,
} from '../../application/use-cases/signalements.js';
import { respondToSignalementComplement } from '../../application/use-cases/qualification.js';
import { QualificationRuleError } from '../../domain/qualification.js';
import {
  SignalementIdempotencyConflictError,
  SignalementRuleError,
} from '../../domain/signalements.js';

function rethrowSignalementError(error: unknown): never {
  if (error instanceof SignalementIdempotencyConflictError) {
    throw new ConflictError(error.message);
  }
  if (!(error instanceof SignalementRuleError)) throw error;
  switch (error.rule) {
    case 'INVALID_DESCRIPTION':
    case 'LOCATION_REQUIRED':
    case 'CATEGORY_REQUIRED':
    case 'DUPLICATE_CATEGORY':
    case 'INVALID_PHOTO_TYPE':
    case 'PHOTO_TOO_LARGE':
      throw new BadRequestError(error.message);
    case 'FORBIDDEN':
      throw new ForbiddenError(error.message);
    case 'SIGNALEMENT_NOT_FOUND':
    case 'PHOTO_NOT_FOUND':
      throw new NotFoundError(error.message);
  }
}

export const signalementsRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = fastify.dependencies.signalements;
  const photoStorage = fastify.dependencies.signalementPhotoStorage;
  // Création d'un signalement citoyen (UC01 / Test T01 / Test T02)
  fastify.post('/', {
    preHandler: [fastify.authorize([RoleCode.CITOYEN, RoleCode.ADMIN])],
    schema: {
      tags: ['Signalements'],
      summary: 'Créer un signalement de dépôt sauvage (UC01 / T01 / T02)',
      description:
        'Permet à un citoyen de soumettre un signalement d anomalie de salubrité urbaine à Dakar. Exige soit des coordonnées GPS exploitables, soit un repère textuel précis (RG06/RG07). Les clients mobiles peuvent fournir Idempotency-Key pour éviter une création en double lors d une reprise réseau.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      headers: {
        type: 'object',
        properties: {
          'idempotency-key': {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            pattern: '^[A-Za-z0-9._:-]{1,100}$',
          },
        },
        additionalProperties: true,
      },
      body: {
        type: 'object',
        required: ['description', 'categories'],
        properties: {
          description: { type: 'string', minLength: 5, example: 'Dépôt sauvage de gravats et sachets plastiques obstruant la chaussée' },
          dateConstat: { type: 'string', format: 'date-time', nullable: true },
          latitude: { type: 'number', nullable: true, example: 14.6728 },
          longitude: { type: 'number', nullable: true, example: -17.4334 },
          precisionLocalisation: { type: 'number', nullable: true, example: 10 },
          descriptionLocalisation: { type: 'string', nullable: true, example: 'Marché Sandaga, angle Rue Carnot et Avenue Lamine Guèye' },
          categories: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['idTypeDechet'],
              properties: {
                idTypeDechet: { type: 'string', format: 'uuid', example: '10000000-0000-0000-0000-000000000001' },
                quantiteEstimee: { type: 'string', example: '5 sacs' },
                volumeEstime: { type: 'string', example: '2 m³' },
                remarque: { type: 'string', example: 'Présence de débris tranchants' },
              },
            },
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            idSignalement: { type: 'string', format: 'uuid' },
            statut: { type: 'string', example: 'SOUMIS' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const idempotencyHeader = req.headers['idempotency-key'];
    if (
      idempotencyHeader !== undefined &&
      (typeof idempotencyHeader !== 'string' ||
        !/^[A-Za-z0-9._:-]{1,100}$/.test(idempotencyHeader))
    ) {
      throw new BadRequestError('La clé Idempotency-Key est invalide.');
    }
    const input = req.body as {
      description: string;
      dateConstat?: string;
      latitude?: number | null;
      longitude?: number | null;
      precisionLocalisation?: number | null;
      descriptionLocalisation?: string | null;
      categories: Array<{ idTypeDechet: string; quantiteEstimee?: string; volumeEstime?: string; remarque?: string }>;
    };
    let idSignalement: string;
    try {
      idSignalement = await createSignalement(repository, {
        ...input,
        idUtilisateur: req.user!.idUtilisateur,
        clientType: req.user!.clientType,
      }, idempotencyHeader);
    } catch (error) {
      rethrowSignalementError(error);
    }

    return reply.status(201).send({
      success: true,
      idSignalement,
      statut: StatutSignalement.SOUMIS,
      message: 'Signalement créé avec succès.',
    });
  });

  // Suivi des signalements de l'utilisateur connecté (Isolation IDOR - Test T29)
  fastify.get('/mes-signalements', {
    preHandler: [fastify.authorize([RoleCode.CITOYEN])],
    schema: {
      tags: ['Signalements'],
      summary: 'Consulter mes signalements soumis (Test T29)',
      description: 'Renvoie exclusivement la liste des signalements créés par le citoyen authentifié (isolation IDOR stricte).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
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
                  idSignalement: { type: 'string', format: 'uuid' },
                  dateConstat: { type: 'string', nullable: true },
                  dateSoumission: { type: 'string' },
                  description: { type: 'string' },
                  latitude: { type: 'number', nullable: true },
                  longitude: { type: 'number', nullable: true },
                  descriptionLocalisation: { type: 'string', nullable: true },
                  statutSignalement: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (req) => {
    const data = await listMySignalements(repository, req.user!.idUtilisateur);
    return { success: true, count: data.length, data };
  });

  // Consultation d'un signalement par son ID (Protection IDOR stricte - Test T29)
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Signalements'],
      summary: 'Détail d un signalement avec ses volets et photos (Test T29)',
      description: 'Consulte un signalement spécifique. Les citoyens ne peuvent accéder qu à leurs propres signalements.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Identifiant UUID du signalement' },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    try {
      return {
        success: true,
        data: await getSignalementDetail(repository, id, req.user!.idUtilisateur, req.user!.roles),
      };
    } catch (error) {
      rethrowSignalementError(error);
    }
  });

  fastify.post('/:id/complements/:idDemande/reponse', {
    preHandler: [fastify.authorize([RoleCode.CITOYEN])],
    schema: {
      tags: ['Signalements'],
      summary: 'Répondre à une demande de complément',
      description: 'Le déclarant authentifié ajoute une réponse immuable à la demande en attente ; le signalement revient en examen.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id', 'idDemande'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          idDemande: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['contenu'],
        properties: { contenu: { type: 'string', minLength: 1, maxLength: 5000 } },
      },
    },
  }, async (req) => {
    const { id, idDemande } = req.params as { id: string; idDemande: string };
    const { contenu } = req.body as { contenu: string };
    try {
      await respondToSignalementComplement(fastify.dependencies.qualification, {
        idSignalement: id,
        idDemande,
        idActeur: req.user!.idUtilisateur,
        contenu,
      });
    } catch (error) {
      if (error instanceof QualificationRuleError) {
        if (error.rule === 'INVALID_COMPLEMENT_RESPONSE') {
          throw new BadRequestError(error.message);
        }
        if (error.rule === 'INVALID_STATE') {
          throw new ConflictError(error.message);
        }
        if (error.rule === 'SIGNALEMENT_NOT_FOUND') {
          throw new NotFoundError(error.message);
        }
      }
      throw error;
    }
    return {
      success: true,
      statut: StatutSignalement.EN_COURS_DE_QUALIFICATION,
      message: 'Votre réponse a été transmise à l’équipe de qualification.',
    };
  });

  // Ajout de photo de signalement (Validation MIME et taille <= 5 Mo - Test T31)
  fastify.post('/:id/photos', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Signalements'],
      summary: 'Ajouter une photo de preuve à un signalement (Test T31)',
      description: 'Valide le type MIME (JPEG, PNG, WebP) et la taille maximale de 5 Mo (RG14).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['referencePhoto', 'mimeType', 'fileSizeBytes'],
        properties: {
          referencePhoto: { type: 'string', example: 'https://storage.isieco.sn/photos/sig-01.jpg' },
          description: { type: 'string', nullable: true, example: 'Vue rapprochée des déchets plastiques' },
          mimeType: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'], example: 'image/jpeg' },
          fileSizeBytes: { type: 'number', example: 1048576, description: 'Taille en octets (maximum 5 Mo)' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            idPhoto: { type: 'string', format: 'uuid' },
            referencePhoto: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { referencePhoto, description, mimeType, fileSizeBytes } = req.body as {
      referencePhoto: string;
      description?: string;
      mimeType: string;
      fileSizeBytes: number;
    };

    try {
      validateSignalementPhoto(mimeType, fileSizeBytes);
    } catch (error) {
      rethrowSignalementError(error);
    }
    let idPhoto: string;
    try {
      idPhoto = await addSignalementPhoto(
        repository,
        id,
        req.user!.idUtilisateur,
        req.user!.roles,
        referencePhoto,
        description || null,
      );
    } catch (error) {
      rethrowSignalementError(error);
    }

    return reply.status(201).send({
      success: true,
      idPhoto,
      referencePhoto,
      message: 'Photo enregistrée avec succès.',
    });
  });

  fastify.post('/:id/photos/contenu', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Signalements'],
      summary: 'Téléverser une photo de preuve privée',
      description: 'Champ multipart "file", images JPEG, PNG ou WebP de 5 Mo maximum. Le contenu est conservé dans le stockage privé de l’API.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!req.isMultipart()) {
      throw new BadRequestError('Le fichier doit être transmis au format multipart/form-data.');
    }

    const part = await req.file();
    if (!part) {
      throw new BadRequestError('Une photo est obligatoire.');
    }

    let idPhoto: string;
    try {
      idPhoto = await uploadSignalementPhoto(repository, photoStorage, {
        idSignalement: id,
        idUtilisateur: req.user!.idUtilisateur,
        roles: req.user!.roles,
        upload: { mimeType: part.mimetype, stream: part.file },
        onCleanupError: (error) => req.log.error(error, 'Échec du nettoyage après une erreur de sauvegarde de photo'),
      });
    } catch (error) {
      rethrowSignalementError(error);
    }

    return reply.status(201).send({
      success: true,
      idPhoto,
      referencePhoto: `/api/signalements/${id}/photos/${idPhoto}/contenu`,
      message: 'Photo enregistrée avec succès.',
    });
  });

  fastify.get('/:id/photos/:photoId/contenu', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Signalements'],
      summary: 'Consulter une photo de signalement privée',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id', 'photoId'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          photoId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (req, reply) => {
    const { id, photoId } = req.params as { id: string; photoId: string };
    let image: { content: Buffer; mimeType: string };
    try {
      image = await getSignalementPhoto(repository, photoStorage, {
        idSignalement: id,
        idPhoto: photoId,
        idUtilisateur: req.user!.idUtilisateur,
        roles: req.user!.roles,
      });
    } catch (error) {
      rethrowSignalementError(error);
    }

    return reply
      .type(image.mimeType)
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .send(image.content);
  });
};
