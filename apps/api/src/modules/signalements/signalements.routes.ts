import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/index.js';
import { RoleCode, StatutSignalement } from '@isieco/shared';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import crypto from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config.js';
import { IMAGE_TYPES, storePrivateImage } from '../../core/private-image-storage.js';

async function assertSignalementPhotoAccess(
  signalementId: string,
  userId: string,
  roles: RoleCode[]
) {
  const db = getDb();
  const signalement = await db.queryOne<{ id_utilisateur: string }>(
    'SELECT id_utilisateur FROM signalement WHERE id_signalement = $1',
    [signalementId]
  );

  if (!signalement) {
    throw new NotFoundError('Signalement introuvable.');
  }

  const isCitizenOnly = roles.length === 1 && roles[0] === RoleCode.CITOYEN;
  if (isCitizenOnly && signalement.id_utilisateur !== userId) {
    throw new ForbiddenError("Accès interdit : vous ne pouvez pas accéder aux photos d'un tiers.");
  }
}

export const signalementsRoutes: FastifyPluginAsync = async (fastify) => {
  // Création d'un signalement citoyen (UC01 / Test T01 / Test T02)
  fastify.post('/', {
    preHandler: [fastify.authorize([RoleCode.CITOYEN, RoleCode.ADMIN])],
    schema: {
      tags: ['Signalements'],
      summary: 'Créer un signalement de dépôt sauvage (UC01 / T01 / T02)',
      description:
        'Permet à un citoyen de soumettre un signalement d anomalie de salubrité urbaine à Dakar. Exige soit des coordonnées GPS exploitables, soit un repère textuel précis (RG06/RG07).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
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
    const {
      description,
      dateConstat,
      latitude,
      longitude,
      precisionLocalisation,
      descriptionLocalisation,
      categories,
    } = req.body as {
      description: string;
      dateConstat?: string;
      latitude?: number | null;
      longitude?: number | null;
      precisionLocalisation?: number | null;
      descriptionLocalisation?: string | null;
      categories: Array<{ idTypeDechet: string; quantiteEstimee?: string; volumeEstime?: string; remarque?: string }>;
    };

    if (!description || description.trim().length < 5) {
      throw new BadRequestError('La description doit comporter au moins 5 caractères.');
    }

    // RG06 / RG07 : Coordonnées GPS ou repère textuel obligatoire
    const hasGps = latitude != null && longitude != null;
    const hasText = descriptionLocalisation != null && descriptionLocalisation.trim().length > 0;
    if (!hasGps && !hasText) {
      throw new BadRequestError('Des coordonnées GPS valides ou un repère textuel de lieu sont obligatoires (RG06 / RG07 / Test T02).');
    }

    if (!categories || categories.length === 0) {
      throw new BadRequestError('Au moins une catégorie de déchet doit être déclarée.');
    }

    // Vérifier l'absence de doublons de catégories dans la déclaration initiale
    const typeIds = categories.map((c) => c.idTypeDechet);
    const uniqueTypeIds = new Set(typeIds);
    if (uniqueTypeIds.size !== typeIds.length) {
      throw new BadRequestError('Une catégorie de déchet ne peut pas être déclarée deux fois dans le même signalement.');
    }

    const db = getDb();
    const idSignalement = crypto.randomUUID();
    const idActeur = req.user!.idUtilisateur;
    const clientType = req.user!.clientType;

    await db.transaction(async (trx) => {
      // 1. Insertion dans SIGNALEMENT
      await trx.execute(
        `INSERT INTO signalement (
           id_signalement, id_utilisateur, date_constat, date_soumission, description,
           latitude, longitude, precision_localisation, description_localisation, statut_signalement
         ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8, 'SOUMIS')`,
        [
          idSignalement,
          idActeur,
          dateConstat ? new Date(dateConstat).toISOString() : null,
          description.trim(),
          latitude ?? null,
          longitude ?? null,
          precisionLocalisation ?? null,
          descriptionLocalisation ? descriptionLocalisation.trim() : null,
        ]
      );

      // 2. Insertion dans CONTENU_SIGNALEMENT
      for (const cat of categories) {
        await trx.execute(
          `INSERT INTO contenu_signalement (id_signalement, id_type_dechet, quantite_estimee, volume_estime, remarque)
           VALUES ($1, $2, $3, $4, $5)`,
          [idSignalement, cat.idTypeDechet, cat.quantiteEstimee || null, cat.volumeEstime || null, cat.remarque || null]
        );
      }

      // 3. Traçabilité atomique dans EVENEMENT_METIER (cible exclusive = id_signalement_cible)
      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, date_evenement, origine, id_acteur, id_signalement_cible,
           donnees_apres, motif
         ) VALUES ($1, 'SIGNALEMENT_RECU', CURRENT_TIMESTAMP, $2, $3, $4, $5, 'Soumission initiale par le citoyen')`,
        [
          crypto.randomUUID(),
          clientType === 'MOBILE' ? 'INTERFACE_CITOYEN' : 'PORTAIL_GESTION',
          idActeur,
          idSignalement,
          JSON.stringify({ description, latitude, longitude, categoriesCount: categories.length }),
        ]
      );

      // 4. Notification citoyenne d'accusé de réception
      await trx.execute(
        `INSERT INTO notification (id_notification, id_utilisateur, titre, message, lien_cible)
         VALUES ($1, $2, 'Signalement enregistré', 'Votre signalement a bien été reçu et sera examiné par l''équipe de qualification.', $3)`,
        [crypto.randomUUID(), idActeur, `/signalements/${idSignalement}`]
      );
    });

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
    const db = getDb();
    const rows = await db.query(
      `SELECT s.id_signalement as "idSignalement",
              s.date_constat as "dateConstat",
              s.date_soumission as "dateSoumission",
              s.description,
              s.latitude,
              s.longitude,
              s.description_localisation as "descriptionLocalisation",
              s.statut_signalement as "statutSignalement"
       FROM signalement s
       WHERE s.id_utilisateur = $1
       ORDER BY s.date_soumission DESC`,
      [req.user!.idUtilisateur]
    );

    return { success: true, count: rows.length, data: rows };
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
    const db = getDb();

    const signalement = await db.queryOne<{
      id_signalement: string;
      id_utilisateur: string;
      date_constat: string | null;
      date_soumission: string;
      description: string;
      latitude: number | null;
      longitude: number | null;
      precision_localisation: number | null;
      description_localisation: string | null;
      statut_signalement: string;
      nom_declarant: string;
      prenom_declarant: string | null;
    }>(
      `SELECT s.id_signalement, s.id_utilisateur, s.date_constat, s.date_soumission, s.description,
              s.latitude, s.longitude, s.precision_localisation, s.description_localisation, s.statut_signalement,
              u.nom as nom_declarant, u.prenom as prenom_declarant
       FROM signalement s
       JOIN utilisateur u ON s.id_utilisateur = u.id_utilisateur
       WHERE s.id_signalement = $1`,
      [id]
    );

    if (!signalement) {
      throw new NotFoundError('Signalement introuvable.');
    }

    // Contrôle d'accès IDOR : Un citoyen ne peut pas consulter le signalement d'un autre (Test T29)
    const isCitizenOnly = req.user!.roles.length === 1 && req.user!.roles[0] === RoleCode.CITOYEN;
    if (isCitizenOnly && signalement.id_utilisateur !== req.user!.idUtilisateur) {
      throw new ForbiddenError("Accès interdit : vous ne pouvez pas consulter le signalement d'un tiers (RG04 / Test T29).");
    }

    // Récupérer le contenu déclaratif
    const categories = await db.query(
      `SELECT cs.id_type_dechet as "idTypeDechet", td.code_type as "codeType", td.libelle, 
              cs.quantite_estimee as "quantiteEstimee", cs.volume_estime as "volumeEstime", cs.remarque
       FROM contenu_signalement cs
       JOIN type_dechet td ON cs.id_type_dechet = td.id_type_dechet
       WHERE cs.id_signalement = $1`,
      [id]
    );

    // Récupérer les photos
    const photos = await db.query(
      `SELECT id_photo_signalement as "idPhoto", reference_photo as "referencePhoto", description, date_ajout as "dateAjout"
       FROM photo_signalement
       WHERE id_signalement = $1`,
      [id]
    );
    const photosAvecAccesPrive = photos.map((photo: {
      idPhoto: string;
      referencePhoto: string;
      description: string | null;
      dateAjout: string;
    }) => ({
      ...photo,
      referencePhoto: new RegExp(`^${photo.idPhoto}\\.(jpg|png|webp)$`).test(photo.referencePhoto)
        ? `/api/signalements/${id}/photos/${photo.idPhoto}/contenu`
        : photo.referencePhoto,
    }));

    return {
      success: true,
      data: {
        idSignalement: signalement.id_signalement,
        idUtilisateur: signalement.id_utilisateur,
        declarant: `${signalement.prenom_declarant || ''} ${signalement.nom_declarant}`.trim(),
        dateConstat: signalement.date_constat,
        dateSoumission: signalement.date_soumission,
        description: signalement.description,
        latitude: signalement.latitude,
        longitude: signalement.longitude,
        precisionLocalisation: signalement.precision_localisation,
        descriptionLocalisation: signalement.description_localisation,
        statutSignalement: signalement.statut_signalement,
        categories,
        photos: photosAvecAccesPrive,
      },
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

    // Validation des limites (Test T31 / RG14)
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    if (!mimeType || !allowedMime.includes(mimeType)) {
      throw new BadRequestError(`Type de fichier non autorisé : ${mimeType}. Seules les images JPEG, PNG et WebP sont acceptées (Test T31).`);
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo
    if (fileSizeBytes > MAX_SIZE) {
      throw new BadRequestError(`Fichier trop volumineux (${(fileSizeBytes / 1024 / 1024).toFixed(2)} Mo). Limite maximale : 5 Mo (Test T31).`);
    }

    const db = getDb();
    await assertSignalementPhotoAccess(id, req.user!.idUtilisateur, req.user!.roles);
    const idPhoto = crypto.randomUUID();

    await db.execute(
      `INSERT INTO photo_signalement (id_photo_signalement, id_signalement, reference_photo, description)
       VALUES ($1, $2, $3, $4)`,
      [idPhoto, id, referencePhoto, description || null]
    );

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
    await assertSignalementPhotoAccess(id, req.user!.idUtilisateur, req.user!.roles);

    if (!req.isMultipart()) {
      throw new BadRequestError('Le fichier doit être transmis au format multipart/form-data.');
    }

    const part = await req.file();
    if (!part) {
      throw new BadRequestError('Une photo est obligatoire.');
    }

    const idPhoto = crypto.randomUUID();
    const { filename } = await storePrivateImage(part, idPhoto);
    const filePath = path.join(path.resolve(config.uploadDir), filename);

    try {
      await getDb().execute(
        `INSERT INTO photo_signalement (id_photo_signalement, id_signalement, reference_photo, description)
         VALUES ($1, $2, $3, $4)`,
        [idPhoto, id, filename, 'Photo transmise par l’application mobile']
      );
    } catch (error) {
      try {
        await unlink(filePath);
      } catch (cleanupError) {
        req.log.error(cleanupError, 'Échec du nettoyage après une erreur de sauvegarde de photo');
      }
      throw error;
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
    await assertSignalementPhotoAccess(id, req.user!.idUtilisateur, req.user!.roles);

    const photo = await getDb().queryOne<{ reference_photo: string }>(
      `SELECT reference_photo FROM photo_signalement
       WHERE id_photo_signalement = $1 AND id_signalement = $2`,
      [photoId, id]
    );
    if (!photo || path.basename(photo.reference_photo) !== photo.reference_photo) {
      throw new NotFoundError('Photo introuvable.');
    }

    const extension = path.extname(photo.reference_photo).slice(1);
    const mimeType = Object.entries(IMAGE_TYPES).find(([, value]) => value.extension === extension)?.[0];
    if (!mimeType || photo.reference_photo !== `${photoId}.${extension}`) {
      throw new NotFoundError('Photo introuvable.');
    }

    let image: Buffer;
    try {
      image = await readFile(path.join(path.resolve(config.uploadDir), photo.reference_photo));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundError('Fichier photo introuvable.');
      }
      throw error;
    }

    return reply
      .type(mimeType)
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .send(image);
  });
};
