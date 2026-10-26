import { FastifyPluginAsync } from 'fastify';
import { RoleCode } from '@isieco/shared';
import { randomUUID } from 'node:crypto';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import {
  decidePhotoVariant,
  decidePublication,
  listPendingPhotoVariants,
  listPendingPublications,
  listPublications,
  submitPublication,
  submitPhotoVariant,
  withdrawPhotoVariant,
} from '../../application/use-cases/publications.js';
import {
  PhotoVariantDecision,
  PublicationPhotoSource,
  PublicationDecision,
  PublicationPhoto,
  PublicationRuleError,
} from '../../domain/publications.js';
import { SignalementRuleError } from '../../domain/signalements.js';

const internalRoles = [
  RoleCode.QUALIFICATION,
  RoleCode.TRAITEMENT,
  RoleCode.AFFECTATION,
  RoleCode.TERRAIN,
  RoleCode.VERIFICATION,
  RoleCode.DECISION,
  RoleCode.ADMIN,
];

const publicationIdParams = {
  type: 'object',
  required: ['idPublication'],
  properties: { idPublication: { type: 'string', format: 'uuid' } },
} as const;

function rethrowPublicationError(error: unknown): never {
  if (!(error instanceof PublicationRuleError)) throw error;

  switch (error.rule) {
    case 'PUBLICATION_NOT_FOUND':
    case 'SOURCE_NOT_FOUND':
      throw new NotFoundError('Publication ou cible introuvable.');
    case 'SOURCE_NOT_READY':
      throw new ConflictError('La cible doit être acceptée ou résolue avant sa publication.');
    case 'DUPLICATE_PUBLICATION':
      throw new ConflictError('Une publication existe déjà pour cette cible.');
    case 'INVALID_TRANSITION':
      throw new ConflictError('Cette décision est incompatible avec l’état actuel de la publication.');
    case 'SELF_MODERATION':
      throw new ForbiddenError('Le créateur d’une publication ne peut pas la modérer.');
    case 'PHOTOS_REQUIRED':
      throw new BadRequestError('Au moins une photo approuvée et floutée est requise.');
    case 'INVALID_PHOTOS':
      throw new BadRequestError('Les photos doivent être approuvées, floutées et correspondre à la cible.');
    case 'DECISION_REASON_REQUIRED':
      throw new BadRequestError('Un motif d’au moins 10 caractères est requis pour refuser, masquer ou retirer une photo.');
    case 'PHOTO_VARIANT_NOT_FOUND':
      throw new NotFoundError('Photo introuvable.');
    case 'PHOTO_VARIANT_ALREADY_PENDING':
      throw new ConflictError('Une variante de cette photo est déjà en attente de modération.');
    case 'PHOTO_VARIANT_NOT_PENDING':
      throw new ConflictError('La variante photo n’est plus en attente de modération.');
    case 'PHOTO_VARIANT_SELF_MODERATION':
      throw new ForbiddenError('Le déposant d’une variante ne peut pas la modérer.');
    case 'PHOTO_VARIANT_NOT_APPROVED':
      throw new ConflictError('Seule une variante approuvée peut être retirée de la diffusion publique.');
    case 'INDEPENDENT_MODERATION_REQUIRED':
      throw new ForbiddenError('La validation de la variante et celle de la publication doivent être effectuées par des personnes différentes.');
  }
}

const photosSchema = {
  type: 'array',
  minItems: 1,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['idPhoto', 'role'],
    properties: {
      idPhoto: { type: 'string', format: 'uuid' },
      role: { type: 'string', enum: ['OBSERVATION', 'AVANT', 'APRES'] },
    },
  },
} as const;

const photoSourceParams = {
  type: 'object',
  required: ['source', 'photoId'],
  properties: {
    source: { type: 'string', enum: ['SIGNALEMENT', 'INTERVENTION'] },
    photoId: { type: 'string', format: 'uuid' },
  },
} as const;

function isPublicationPhotoSource(source: string): source is PublicationPhotoSource {
  return source === 'SIGNALEMENT' || source === 'INTERVENTION';
}

function parseLimit(value: string | undefined): number {
  if (value === undefined) return 25;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new BadRequestError('La limite doit être comprise entre 1 et 100.');
  }
  return limit;
}

export const publicationsRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = fastify.dependencies.publications;
  const variantStorage = fastify.dependencies.publicationPhotoStorage;

  fastify.post('/photos/:source/:photoId/variante', {
    preHandler: [fastify.authorize(internalRoles)],
    schema: {
      tags: ['Publications'],
      summary: 'Déposer une copie dérivée pour contrôle avant publication',
      description: 'Le déposant doit transmettre une copie distincte et expurgée de l’original, après contrôle des métadonnées, visages, plaques, adresses, documents et coordonnées visibles. Le fichier reste privé jusqu’à approbation.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: photoSourceParams,
      headers: {
        type: 'object',
        required: ['x-redaction-checks-confirmed'],
        properties: {
          'x-redaction-checks-confirmed': { type: 'string', enum: ['true'] },
        },
        additionalProperties: true,
      },
    },
  }, async (request, reply) => {
    const { source, photoId } = request.params as {
      source: PublicationPhotoSource;
      photoId: string;
    };
    if (!isPublicationPhotoSource(source)) {
      throw new BadRequestError('La source de la photo est invalide.');
    }
    if (request.headers['x-redaction-checks-confirmed'] !== 'true') {
      throw new BadRequestError('Confirmez le contrôle des éléments identifiants avant le dépôt.');
    }
    if (!request.isMultipart()) {
      throw new BadRequestError('Le fichier doit être transmis au format multipart/form-data.');
    }
    const part = await request.file();
    if (!part) throw new BadRequestError('Une variante photo est obligatoire.');

    let reference: string | undefined;
    try {
      reference = await variantStorage.store(
        { mimetype: part.mimetype, file: part.file },
        randomUUID(),
      );
      await submitPhotoVariant(repository, {
        source,
        photoId,
        reference,
        submittedBy: request.user!.idUtilisateur,
      });
    } catch (error) {
      if (reference) {
        try {
          await variantStorage.remove(reference);
        } catch (cleanupError) {
          request.log.error(cleanupError, 'Échec du nettoyage d’une variante photo non enregistrée');
        }
      }
      rethrowPublicationError(error);
    }
    return reply.code(202).send({ success: true, etatPublication: 'EN_ATTENTE' });
  });

  fastify.get('/moderation/photos/en-attente', {
    preHandler: [fastify.authorize([RoleCode.DECISION])],
    schema: {
      tags: ['Publications'],
      summary: 'Lister les variantes photo en attente de contrôle',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      querystring: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
      },
    },
  }, async (request) => {
    const query = request.query as { limit?: string };
    const data = await listPendingPhotoVariants(repository, parseLimit(query.limit));
    return { success: true, count: data.length, data };
  });

  fastify.get('/moderation/photos/:source/:photoId/variante', {
    preHandler: [fastify.authorize([RoleCode.DECISION])],
    schema: {
      tags: ['Publications'],
      summary: 'Consulter une variante privée en attente de contrôle',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: photoSourceParams,
    },
  }, async (request, reply) => {
    const { source, photoId } = request.params as {
      source: PublicationPhotoSource;
      photoId: string;
    };
    if (!isPublicationPhotoSource(source)) throw new BadRequestError('La source de la photo est invalide.');
    const reference = await repository.findPendingPhotoVariant(source, photoId);
    if (!reference) throw new NotFoundError('Variante en attente introuvable.');
    const image = await variantStorage.read(reference);
    if (!image) throw new NotFoundError('Fichier de la variante introuvable.');
    return reply
      .type(image.mimeType)
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .send(image.content);
  });

  fastify.get('/moderation/photos/:source/:photoId/original', {
    preHandler: [fastify.authorize([RoleCode.DECISION])],
    schema: {
      tags: ['Publications'],
      summary: 'Consulter l’original en accès restreint pour comparer la variante',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: photoSourceParams,
    },
  }, async (request, reply) => {
    const { source, photoId } = request.params as {
      source: PublicationPhotoSource;
      photoId: string;
    };
    if (!isPublicationPhotoSource(source)) throw new BadRequestError('La source de la photo est invalide.');
    const reference = await repository.findOriginalPhoto(source, photoId);
    if (!reference) throw new NotFoundError('Photo originale introuvable.');

    if (source === 'SIGNALEMENT') {
      let image: { content: Buffer; mimeType: string };
      try {
        image = await fastify.dependencies.signalementPhotoStorage.read(reference);
      } catch (error) {
        if (error instanceof SignalementRuleError && error.rule === 'PHOTO_NOT_FOUND') {
          throw new NotFoundError('Fichier de la photo originale introuvable.');
        }
        throw error;
      }
      return reply
        .type(image.mimeType)
        .header('Cache-Control', 'private, no-store')
        .header('X-Content-Type-Options', 'nosniff')
        .send(image.content);
    }
    const image = await fastify.dependencies.interventionPhotoStorage.read(reference, photoId);
    if (!image) throw new NotFoundError('Fichier de la photo originale introuvable.');
    return reply
      .type(image.mimeType)
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .send(image.content);
  });

  fastify.post('/moderation/photos/:source/:photoId/decision', {
    preHandler: [fastify.authorize([RoleCode.DECISION])],
    schema: {
      tags: ['Publications'],
      summary: 'Approuver ou refuser une variante photo après contrôle',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: photoSourceParams,
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['decision'],
        properties: {
          decision: { type: 'string', enum: ['APPROUVEE', 'REFUSEE'] },
          motif: { type: 'string', maxLength: 2000 },
        },
      },
    },
  }, async (request) => {
    const { source, photoId } = request.params as {
      source: PublicationPhotoSource;
      photoId: string;
    };
    if (!isPublicationPhotoSource(source)) throw new BadRequestError('La source de la photo est invalide.');
    const body = request.body as { decision: PhotoVariantDecision; motif?: string };
    try {
      await decidePhotoVariant(repository, {
        source,
        photoId,
        actorId: request.user!.idUtilisateur,
        decision: body.decision,
        reason: body.motif,
      });
      return { success: true, etatPublication: body.decision };
    } catch (error) {
      rethrowPublicationError(error);
    }
  });

  fastify.post('/moderation/photos/:source/:photoId/retrait', {
    preHandler: [fastify.authorize([RoleCode.DECISION])],
    schema: {
      tags: ['Publications'],
      summary: 'Retirer immédiatement une variante de la diffusion publique',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: photoSourceParams,
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['motif'],
        properties: { motif: { type: 'string', minLength: 10, maxLength: 2000 } },
      },
    },
  }, async (request) => {
    const { source, photoId } = request.params as {
      source: PublicationPhotoSource;
      photoId: string;
    };
    if (!isPublicationPhotoSource(source)) throw new BadRequestError('La source de la photo est invalide.');
    const body = request.body as { motif: string };
    try {
      await withdrawPhotoVariant(repository, {
        source,
        photoId,
        actorId: request.user!.idUtilisateur,
        reason: body.motif,
      });
      return { success: true, etatPublication: 'REFUSEE', accesPublic: false };
    } catch (error) {
      rethrowPublicationError(error);
    }
  });

  fastify.post('/signalements/:idSignalement', {
    preHandler: [fastify.authorize(internalRoles)],
    schema: {
      tags: ['Publications'],
      summary: 'Soumettre un signalement accepté à la publication',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['idSignalement'],
        properties: { idSignalement: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['photos'],
        properties: { photos: photosSchema },
      },
    },
  }, async (request, reply) => {
    const { idSignalement } = request.params as { idSignalement: string };
    const body = request.body as {
      photos: Array<{ idPhoto: string; role: PublicationPhoto['role'] }>;
    };
    try {
      const idPublication = await submitPublication(repository, {
        target: { type: 'SIGNALEMENT', id: idSignalement },
        actorId: request.user!.idUtilisateur,
        photos: body.photos.map((photo) => ({ id: photo.idPhoto, role: photo.role })),
      });
      return reply.code(201).send({ success: true, idPublication, etatPublication: 'EN_ATTENTE' });
    } catch (error) {
      rethrowPublicationError(error);
    }
  });

  fastify.post('/dossiers/:idDossier', {
    preHandler: [fastify.authorize(internalRoles)],
    schema: {
      tags: ['Publications'],
      summary: 'Soumettre un dossier résolu à la publication',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['idDossier'],
        properties: { idDossier: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['photos'],
        properties: { photos: photosSchema },
      },
    },
  }, async (request, reply) => {
    const { idDossier } = request.params as { idDossier: string };
    const body = request.body as {
      photos: Array<{ idPhoto: string; role: PublicationPhoto['role'] }>;
    };
    try {
      const idPublication = await submitPublication(repository, {
        target: { type: 'DOSSIER', id: idDossier },
        actorId: request.user!.idUtilisateur,
        photos: body.photos.map((photo) => ({ id: photo.idPhoto, role: photo.role })),
      });
      return reply.code(201).send({ success: true, idPublication, etatPublication: 'EN_ATTENTE' });
    } catch (error) {
      rethrowPublicationError(error);
    }
  });

  fastify.get('/moderation/en-attente', {
    preHandler: [fastify.authorize([RoleCode.DECISION])],
    schema: {
      tags: ['Publications'],
      summary: 'Consulter les publications en attente de modération',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      querystring: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
      },
    },
  }, async (request) => {
    const query = request.query as { limit?: string };
    const data = await listPendingPublications(repository, parseLimit(query.limit));
    return { success: true, count: data.length, data };
  });

  fastify.post('/:idPublication/decision', {
    preHandler: [fastify.authorize([RoleCode.DECISION])],
    schema: {
      tags: ['Publications'],
      summary: 'Approuver, refuser ou masquer une publication',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: publicationIdParams,
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['decision'],
        properties: {
          decision: { type: 'string', enum: ['APPROUVEE', 'REFUSEE', 'MASQUEE'] },
          motif: { type: 'string', maxLength: 2000 },
        },
      },
    },
  }, async (request) => {
    const { idPublication } = request.params as { idPublication: string };
    const body = request.body as { decision: PublicationDecision; motif?: string };
    try {
      await decidePublication(repository, {
        publicationId: idPublication,
        actorId: request.user!.idUtilisateur,
        decision: body.decision,
        reason: body.motif ?? null,
      });
      return { success: true, etatPublication: body.decision };
    } catch (error) {
      rethrowPublicationError(error);
    }
  });

  fastify.get('/public', {
    schema: {
      tags: ['Publications'],
      summary: 'Consulter les publications approuvées sans données personnelles ni coordonnées précises',
      querystring: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
      },
    },
  }, async (request) => {
    const query = request.query as { limit?: string };
    const data = await listPublications(repository, parseLimit(query.limit));
    return { success: true, count: data.length, data };
  });

  fastify.get('/public/photos/:source/:photoId', {
    schema: {
      tags: ['Publications'],
      summary: 'Consulter une photo publique uniquement si ses deux validations sont actives',
      params: photoSourceParams,
    },
  }, async (request, reply) => {
    const { source, photoId } = request.params as {
      source: PublicationPhotoSource;
      photoId: string;
    };
    if (!isPublicationPhotoSource(source)) throw new BadRequestError('La source de la photo est invalide.');
    const reference = await repository.findPublicPhoto(source, photoId);
    if (!reference) throw new NotFoundError('Photo publique introuvable.');
    const image = await variantStorage.read(reference);
    if (!image) {
      request.log.error({ source, photoId }, 'Variante approuvée absente du stockage');
      throw new NotFoundError('Fichier de la photo publique introuvable.');
    }
    return reply
      .type(image.mimeType)
      .header('Cache-Control', 'no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .send(image.content);
  });
};
