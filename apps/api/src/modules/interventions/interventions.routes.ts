import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/index.js';
import { RoleCode, StatutIntervention, ResultatIntervention, ContextePhoto, EtatAffectation, StatutDossier } from '@isieco/shared';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import crypto from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config.js';
import { IMAGE_TYPES, storePrivateImage } from '../../core/private-image-storage.js';

export const interventionsRoutes: FastifyPluginAsync = async (fastify) => {
  const allowedTerrainAgents = [RoleCode.TERRAIN];

  const assertTeamMembership = async (idIntervention: string, idUtilisateur: string) => {
    const db = getDb();
    const intervention = await db.queryOne<{
      id_intervention: string;
      id_affectation: string;
      id_equipe: string;
      statut_intervention: string;
      date_heure_debut: string | null;
      etat_affectation: string;
      date_fin_affectation: string | null;
    }>(
      `SELECT i.id_intervention, i.id_affectation, i.statut_intervention, i.date_heure_debut,
              a.id_equipe, a.etat_affectation, a.date_fin_affectation
       FROM intervention i
       JOIN affectation a ON a.id_affectation = i.id_affectation
       WHERE i.id_intervention = $1`,
      [idIntervention]
    );

    if (!intervention) throw new NotFoundError('Intervention introuvable.');

    const membership = await db.queryOne<{ id_equipe: string }>(
      `SELECT id_equipe FROM appartenance_equipe
       WHERE id_utilisateur = $1 AND id_equipe = $2
         AND date_debut <= CURRENT_TIMESTAMP
         AND (date_fin IS NULL OR date_fin >= CURRENT_TIMESTAMP)`,
      [idUtilisateur, intervention.id_equipe]
    );
    if (!membership) {
      throw new ForbiddenError("Cette intervention est réservée aux agents de l'équipe affectée.");
    }

    return intervention;
  };

  // Liste des missions terrain de l'agent connecté (UC07)
  fastify.get('/mes-missions', {
    preHandler: [fastify.authorize(allowedTerrainAgents)],
    schema: {
      tags: ['Interventions'],
      summary: 'Missions d intervention de l agent connecté (UC07)',
      description: 'Retourne la liste des interventions programmées ou en cours assignées aux équipes dont fait partie l agent de terrain.',
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
                  idIntervention: { type: 'string', format: 'uuid' },
                  statutIntervention: { type: 'string' },
                  dateDebut: { type: 'string', nullable: true },
                  dateFin: { type: 'string', nullable: true },
                  idAffectation: { type: 'string', format: 'uuid' },
                  idDossier: { type: 'string', format: 'uuid' },
                  referenceDossier: { type: 'string' },
                  descriptionSynthese: { type: 'string' },
                  priorite: { type: 'string' },
                  latitude: { type: 'number', nullable: true },
                  longitude: { type: 'number', nullable: true },
                  descriptionLocalisation: { type: 'string', nullable: true },
                  codeTypeDechet: { type: 'string' },
                  libelleDechet: { type: 'string' },
                  nomEquipe: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (req) => {
    const db = getDb();
    
    // Trouver les équipes dont l'agent est membre actif
    const equipes = await db.query<{ id_equipe: string }>(
      `SELECT id_equipe FROM appartenance_equipe 
       WHERE id_utilisateur = $1 AND date_debut <= CURRENT_TIMESTAMP
         AND (date_fin IS NULL OR date_fin >= CURRENT_TIMESTAMP)`,
      [req.user!.idUtilisateur]
    );

    if (equipes.length === 0) {
      return { success: true, count: 0, data: [] };
    }

    const equipeIds = equipes.map((e) => e.id_equipe);
    const sql = `
      SELECT i.id_intervention as "idIntervention",
             i.statut_intervention as "statutIntervention",
             i.date_heure_debut as "dateDebut",
             i.date_heure_fin as "dateFin",
             a.id_affectation as "idAffectation",
             a.id_dossier as "idDossier",
             d.reference_dossier as "referenceDossier",
             d.description_synthese as "descriptionSynthese",
             d.priorite,
             d.latitude,
             d.longitude,
             d.description_localisation as "descriptionLocalisation",
             td.code_type as "codeTypeDechet",
             td.libelle as "libelleDechet",
             e.nom_equipe as "nomEquipe"
      FROM intervention i
      JOIN affectation a ON i.id_affectation = a.id_affectation
      JOIN dossier_traitement d ON a.id_dossier = d.id_dossier
      JOIN type_dechet td ON a.id_type_dechet = td.id_type_dechet
      JOIN equipe e ON a.id_equipe = e.id_equipe
      WHERE a.date_fin_affectation IS NULL
        AND a.id_equipe = ANY($1)
      ORDER BY i.statut_intervention ASC, d.date_creation_dossier ASC
    `;

    const rows = await db.query(sql, [equipeIds]);

    return { success: true, count: rows.length, data: rows };
  });

  // Démarrage d'une intervention sur site
  fastify.post('/:id/demarrer', {
    preHandler: [fastify.authorize(allowedTerrainAgents)],
    schema: {
      tags: ['Interventions'],
      summary: 'Démarrer une intervention sur le terrain (UC07)',
      description: 'Horodate le début réel des opérations et passe le statut à EN_COURS.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID de l intervention' },
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
    const db = getDb();
    const intervention = await assertTeamMembership(id, req.user!.idUtilisateur);
    if (intervention.date_fin_affectation || intervention.etat_affectation !== 'ACTIVE') {
      throw new BadRequestError("L'affectation n'est plus active; cette intervention ne peut pas démarrer.");
    }
    if (intervention.statut_intervention !== 'PROGRAMMEE') {
      throw new BadRequestError("Seule une intervention programmée peut démarrer.");
    }

    await db.transaction(async (trx) => {
      const update = await trx.execute(
        `UPDATE intervention 
         SET statut_intervention = 'EN_COURS', date_heure_debut = CURRENT_TIMESTAMP
         WHERE id_intervention = $1 AND statut_intervention = 'PROGRAMMEE'`,
        [id]
      );
      if (update.rowCount !== 1) {
        throw new BadRequestError("L'intervention a changé d'état et ne peut plus démarrer.");
      }

      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur, id_intervention_cible, motif
         ) VALUES ($1, 'INTERVENTION_DEBUTEE', 'APPLICATION_TERRAIN', $2, $3, 'Début des travaux sur le terrain')`,
        [crypto.randomUUID(), req.user!.idUtilisateur, id]
      );
    });

    return { success: true, message: 'Intervention démarrée sur le terrain.' };
  });

  // Déclaration de fin d'intervention (Test T11 / RG37 / RG40)
  fastify.post('/:id/terminer', {
    preHandler: [fastify.authorize(allowedTerrainAgents)],
    schema: {
      tags: ['Interventions'],
      summary: 'Déclarer la fin d une intervention avec compte-rendu (Test T11 / RG37 / RG40)',
      description: 'Enregistre le compte-rendu (min 10 car.) et le résultat technique. L affectation passe à A_VERIFIER et le dossier à EN_ATTENTE_VERIFICATION (ne clôture pas le dossier).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID de l intervention' },
        },
      },
      body: {
        type: 'object',
        properties: {
          resultatIntervention: {
            type: 'string',
            enum: ['SUCCES_TOTAL', 'SUCCES_PARTIEL', 'ECHEC', 'IMPOSSIBLE'],
            description: 'Résultat technique de la mission',
          },
          compteRendu: { type: 'string', description: 'Compte-rendu d intervention obligatoire (min 10 car.)' },
          motifException: { type: 'string', description: 'Précisions en cas de résultat partiel ou impossible' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            statutIntervention: { type: 'string' },
            etatAffectation: { type: 'string' },
            statutDossier: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const { resultatIntervention, compteRendu, motifException } = req.body as {
      resultatIntervention?: ResultatIntervention;
      compteRendu?: string;
      motifException?: string;
    };

    // Règle T11 & RG37 : Rejet de toute fin d'intervention sans compte-rendu (>= 10 car.) et résultat
    if (!resultatIntervention) {
      throw new BadRequestError("Le résultat de l'intervention est obligatoire pour clôturer la mission (Test T11 / RG37).");
    }
    if (!compteRendu || compteRendu.trim().length < 10) {
      throw new BadRequestError("Un compte-rendu d'au moins 10 caractères est obligatoire pour terminer l'intervention (Test T11 / RG37).");
    }

    const db = getDb();
    const interv = await assertTeamMembership(id, req.user!.idUtilisateur);
    if (interv.date_fin_affectation || interv.etat_affectation !== 'ACTIVE') {
      throw new BadRequestError("L'affectation n'est plus active; cette intervention ne peut pas être terminée.");
    }
    if (interv.statut_intervention !== 'EN_COURS' || !interv.date_heure_debut) {
      throw new BadRequestError("L'intervention doit être démarrée avant l'enregistrement du compte-rendu.");
    }

    const affectation = await db.queryOne<{ id_dossier: string }>(
      `SELECT id_dossier FROM affectation WHERE id_affectation = $1`,
      [interv.id_affectation]
    );

    await db.transaction(async (trx) => {
      // 1. Mise à jour de l'intervention
      const update = await trx.execute(
        `UPDATE intervention 
         SET statut_intervention = 'TERMINEE',
             date_heure_fin = CURRENT_TIMESTAMP,
             resultat_intervention = $1,
             compte_rendu = $2,
             motif_exception = $3
         WHERE id_intervention = $4 AND statut_intervention = 'EN_COURS'`,
        [resultatIntervention, compteRendu.trim(), motifException || null, id]
      );
      if (update.rowCount !== 1) {
        throw new BadRequestError("L'intervention a changé d'état et ne peut plus être terminée.");
      }

      // 2. Passage de l'affectation à l'état A_VERIFIER
      await trx.execute(
        `UPDATE affectation 
         SET etat_affectation = 'A_VERIFIER'
         WHERE id_affectation = $1`,
        [interv.id_affectation]
      );

      // 3. Règle RG40 / T11 : La fin d'intervention NE clôture PAS le dossier, il passe à EN_ATTENTE_VERIFICATION
      if (affectation) {
        await trx.execute(
          `UPDATE dossier_traitement 
           SET statut_dossier = 'EN_ATTENTE_VERIFICATION'
           WHERE id_dossier = $1 AND statut_dossier NOT IN ('CLOS_RESOLUTION_CONFIRMEE', 'CLOS_SANS_SUITE')`,
          [affectation.id_dossier]
        );
      }

      // 4. Traçabilité immuable EVENEMENT_METIER
      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur, id_intervention_cible,
           donnees_apres, motif
         ) VALUES ($1, 'INTERVENTION_TERMINEE', 'APPLICATION_TERRAIN', $2, $3, $4, $5)`,
        [
          crypto.randomUUID(),
          req.user!.idUtilisateur,
          id,
          JSON.stringify({ resultatIntervention, compteRendu }),
          'Saisie du compte-rendu terrain et fin de chantier',
        ]
      );
    });

    return {
      success: true,
      statutIntervention: StatutIntervention.TERMINEE,
      etatAffectation: EtatAffectation.A_VERIFIER,
      statutDossier: StatutDossier.EN_ATTENTE_VERIFICATION,
      message: 'Intervention déclarée terminée. Le volet est transmis en attente de vérification indépendante (RG40).',
    };
  });

  // Ajout de photo d'intervention (Test T21)
  fastify.post('/:id/photos', {
    preHandler: [fastify.authorize(allowedTerrainAgents)],
    schema: {
      tags: ['Interventions'],
      summary: 'Ajouter une photo de preuve d intervention (Test T21)',
      description: 'Lie une photo horodatée (avant, pendant ou après) à l intervention de terrain.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID de l intervention' },
        },
      },
      body: {
        type: 'object',
        required: ['referencePhoto'],
        properties: {
          referencePhoto: { type: 'string', description: 'URL ou chemin de l image enregistrée' },
          contextePhoto: { type: 'string', enum: [ContextePhoto.DEBUT_INTERVENTION, ContextePhoto.FIN_INTERVENTION], default: ContextePhoto.FIN_INTERVENTION },
          description: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            idPhoto: { type: 'string', format: 'uuid' },
            referencePhoto: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { referencePhoto, contextePhoto, description } = req.body as {
      referencePhoto: string;
      contextePhoto?: ContextePhoto;
      description?: string;
    };

    if (!referencePhoto) {
      throw new BadRequestError('La référence de photo est obligatoire.');
    }

    await assertTeamMembership(id, req.user!.idUtilisateur);

    const db = getDb();
    const idPhoto = crypto.randomUUID();

    await db.execute(
      `INSERT INTO photo_intervention (id_photo_intervention, id_intervention, reference_photo, contexte_photo, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [idPhoto, id, referencePhoto, contextePhoto || 'FIN_INTERVENTION', description || null]
    );

    return reply.status(201).send({
      success: true,
      idPhoto,
      referencePhoto,
      message: "Photo d'intervention enregistrée avec succès (Test T21).",
    });
  });

  fastify.post('/:id/photos/contenu', {
    preHandler: [fastify.authorize(allowedTerrainAgents)],
    schema: {
      tags: ['Interventions'],
      summary: 'Téléverser une photo de preuve privée pour une intervention',
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
    await assertTeamMembership(id, req.user!.idUtilisateur);
    if (!req.isMultipart()) {
      throw new BadRequestError('Le fichier doit être transmis au format multipart/form-data.');
    }

    const part = await req.file();
    if (!part) throw new BadRequestError('Une photo est obligatoire.');

    const idPhoto = crypto.randomUUID();
    const { filename } = await storePrivateImage(part, idPhoto);
    const filePath = path.join(path.resolve(config.uploadDir), filename);
    try {
      await getDb().execute(
        `INSERT INTO photo_intervention (
           id_photo_intervention, id_intervention, reference_photo, contexte_photo, description
         ) VALUES ($1, $2, $3, $4, $5)`,
        [idPhoto, id, filename, ContextePhoto.FIN_INTERVENTION, 'Preuve photo transmise par l’application mobile']
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
      referencePhoto: `/api/interventions/${id}/photos/${idPhoto}/contenu`,
      message: 'Photo de preuve enregistrée avec succès.',
    });
  });

  fastify.get('/:id/photos/:photoId/contenu', {
    preHandler: [
      fastify.authorize([
        RoleCode.TERRAIN,
        RoleCode.VERIFICATION,
        RoleCode.QUALIFICATION,
        RoleCode.TRAITEMENT,
        RoleCode.AFFECTATION,
        RoleCode.DECISION,
        RoleCode.ADMIN,
      ]),
    ],
    schema: {
      tags: ['Interventions'],
      summary: 'Consulter une photo de preuve privée',
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
    if (req.user!.roles.includes(RoleCode.TERRAIN)) {
      await assertTeamMembership(id, req.user!.idUtilisateur);
    }

    const photo = await getDb().queryOne<{ reference_photo: string }>(
      `SELECT reference_photo FROM photo_intervention
       WHERE id_photo_intervention = $1 AND id_intervention = $2`,
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
