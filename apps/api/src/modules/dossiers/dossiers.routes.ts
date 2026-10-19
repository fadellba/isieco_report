import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/index.js';
import { RoleCode, PrioriteDossier, StatutDossier, StatutSignalement } from '@isieco/shared';
import { BadRequestError, NotFoundError } from '../../core/errors.js';
import crypto from 'node:crypto';

export const dossiersRoutes: FastifyPluginAsync = async (fastify) => {
  const allowedManagers = [RoleCode.TRAITEMENT, RoleCode.AFFECTATION];
  const allowedDossierReaders = [...allowedManagers, RoleCode.VERIFICATION];

  // Liste des dossiers
  fastify.get('/', {
    preHandler: [fastify.authorize(allowedDossierReaders)],
    schema: {
      tags: ['Dossiers'],
      summary: 'Liste des dossiers opérationnels de traitement (UC05)',
      description: 'Récupère la liste des dossiers avec filtrage optionnel par statut et priorité, ainsi que les compteurs de volets et signalements rattachés.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          statut: { type: 'string', description: 'Filtrer par statut de dossier (ex: EN_ATTENTE_AFFECTATION)' },
          priorite: { type: 'string', description: 'Filtrer par priorité (FAIBLE, MOYENNE, ELEVEE, URGENTE)' },
        },
      },
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
                  idDossier: { type: 'string', format: 'uuid' },
                  referenceDossier: { type: 'string' },
                  descriptionSynthese: { type: 'string' },
                  dateCreationDossier: { type: 'string' },
                  statutDossier: { type: 'string' },
                  priorite: { type: 'string' },
                  latitude: { type: 'number', nullable: true },
                  longitude: { type: 'number', nullable: true },
                  dateCloture: { type: 'string', nullable: true },
                  nomCreateur: { type: 'string' },
                  nbVoletsInclus: { type: 'number' },
                  nbSignalementsRattaches: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  }, async (req) => {
    const query = req.query as { statut?: string; priorite?: string };
    const db = getDb();

    let sql = `
      SELECT d.id_dossier as "idDossier",
             d.reference_dossier as "referenceDossier",
             d.description_synthese as "descriptionSynthese",
             d.date_creation_dossier as "dateCreationDossier",
             d.statut_dossier as "statutDossier",
             d.priorite,
             d.latitude,
             d.longitude,
             d.date_cloture as "dateCloture",
             u.nom as "nomCreateur",
             (SELECT count(*) FROM contenu_dossier cd WHERE cd.id_dossier = d.id_dossier AND cd.etat_contenu_dossier = 'INCLUSE') as "nbVoletsInclus",
             (SELECT count(*) FROM rattachement_signalement rs WHERE rs.id_dossier = d.id_dossier AND rs.date_fin_rattachement IS NULL) as "nbSignalementsRattaches"
      FROM dossier_traitement d
      JOIN utilisateur u ON d.cree_par = u.id_utilisateur
      WHERE 1=1
    `;
    const params: any[] = [];
    if (query.statut) {
      sql += ` AND d.statut_dossier = $${params.length + 1}`;
      params.push(query.statut);
    }
    if (query.priorite) {
      sql += ` AND d.priorite = $${params.length + 1}`;
      params.push(query.priorite);
    }
    sql += ` ORDER BY d.date_creation_dossier DESC`;

    const rows = await db.query(sql, params);
    return { success: true, count: rows.length, data: rows };
  });

  // Création d'un dossier opérationnel (UC05)
  fastify.post('/', {
    preHandler: [fastify.authorize(allowedManagers)],
    schema: {
      tags: ['Dossiers'],
      summary: 'Création d un nouveau dossier opérationnel (UC05)',
      description: 'Crée un dossier de traitement avec initialisation immédiate de ses volets techniques (catégories de déchets) et traçabilité immuable.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      body: {
        type: 'object',
        required: ['descriptionSynthese', 'categories'],
        properties: {
          referenceDossier: { type: 'string', description: 'Référence unique optionnelle (générée automatiquement si omise)' },
          descriptionSynthese: { type: 'string', minLength: 5, description: 'Description synthétique du périmètre d intervention' },
          priorite: { type: 'string', enum: Object.values(PrioriteDossier), default: PrioriteDossier.MOYENNE },
          latitude: { type: 'number', nullable: true },
          longitude: { type: 'number', nullable: true },
          descriptionLocalisation: { type: 'string', nullable: true },
          categories: {
            type: 'array',
            minItems: 1,
            description: 'Liste des volets techniques de déchets composant le dossier',
            items: {
              type: 'object',
              required: ['idTypeDechet'],
              properties: {
                idTypeDechet: { type: 'string', format: 'uuid' },
                quantiteEstimee: { type: 'string' },
                volumeEstime: { type: 'string' },
                niveauRisque: { type: 'string', enum: ['FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE'] },
              },
            },
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            idDossier: { type: 'string', format: 'uuid' },
            referenceDossier: { type: 'string' },
            statutDossier: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const {
      referenceDossier,
      descriptionSynthese,
      priorite,
      latitude,
      longitude,
      descriptionLocalisation,
      categories,
    } = req.body as {
      referenceDossier?: string;
      descriptionSynthese: string;
      priorite?: PrioriteDossier;
      latitude?: number | null;
      longitude?: number | null;
      descriptionLocalisation?: string | null;
      categories: Array<{ idTypeDechet: string; quantiteEstimee?: string; volumeEstime?: string; niveauRisque?: string }>;
    };

    if (!descriptionSynthese || descriptionSynthese.trim().length < 5) {
      throw new BadRequestError('La description de synthèse du dossier doit comporter au moins 5 caractères.');
    }

    if (!categories || categories.length === 0) {
      throw new BadRequestError('Un dossier opérationnel doit comporter au moins un volet technique (catégorie de déchet).');
    }
    if ((latitude == null) !== (longitude == null)) {
      throw new BadRequestError('La latitude et la longitude doivent être fournies ensemble.');
    }
    if (
      latitude != null &&
      longitude != null &&
      (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
    ) {
      throw new BadRequestError('Les coordonnées de localisation sont hors limites.');
    }

    const db = getDb();
    const idDossier = crypto.randomUUID();
    const ref = referenceDossier || `DOS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const prioriteRetenue = priorite || PrioriteDossier.MOYENNE;
    const statutInitial = StatutDossier.EN_ATTENTE_AFFECTATION;

    await db.transaction(async (trx) => {
      // 1. Insertion dans DOSSIER_TRAITEMENT
      await trx.execute(
        `INSERT INTO dossier_traitement (
           id_dossier, reference_dossier, description_synthese, date_creation_dossier,
           statut_dossier, priorite, latitude, longitude, description_localisation, cree_par
         ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8, $9)`,
        [
          idDossier,
          ref,
          descriptionSynthese.trim(),
          statutInitial,
          prioriteRetenue,
          latitude ?? null,
          longitude ?? null,
          descriptionLocalisation ? descriptionLocalisation.trim() : null,
          req.user!.idUtilisateur,
        ]
      );

      // 2. Insertion des volets techniques CONTENU_DOSSIER (unicité composite garantie)
      for (const cat of categories) {
        await trx.execute(
          `INSERT INTO contenu_dossier (
             id_dossier, id_type_dechet, quantite_estimee, volume_estime,
             niveau_risqu_qualifie, qualifie_par, date_qualification, etat_contenu_dossier
           ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, 'INCLUSE')`,
          [
            idDossier,
            cat.idTypeDechet,
            cat.quantiteEstimee || null,
            cat.volumeEstime || null,
            cat.niveauRisque || 'MOYEN',
            req.user!.idUtilisateur,
          ]
        );
      }

      // 3. Traçabilité immuable EVENEMENT_METIER (cible exclusive = id_dossier_cible)
      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur, id_dossier_cible,
           donnees_apres, motif
         ) VALUES ($1, 'DOSSIER_CREE', 'PORTAIL_GESTION', $2, $3, $4, 'Création du dossier opérationnel')`,
        [
          crypto.randomUUID(),
          req.user!.idUtilisateur,
          idDossier,
          JSON.stringify({ referenceDossier: ref, priorite: prioriteRetenue, volets: categories.length }),
        ]
      );
    });

    return reply.status(201).send({
      success: true,
      idDossier,
      referenceDossier: ref,
      statutDossier: statutInitial,
      message: 'Dossier créé et volets techniques initialisés avec succès.',
    });
  });

  // Rattachement d'un signalement à un dossier (UC04 / Test T03 / Test T04 / Test T26)
  fastify.post('/:id/rattacher', {
    preHandler: [fastify.authorize(allowedManagers)],
    schema: {
      tags: ['Dossiers'],
      summary: 'Rattacher un signalement citoyen à un dossier (UC04 / Test T03 / T04 / T26)',
      description: 'Établit le lien opérationnel immuable entre un signalement qualifié et un dossier, passant le statut du signalement à RATTACHE.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID du dossier cible' },
        },
      },
      body: {
        type: 'object',
        required: ['idSignalement'],
        properties: {
          idSignalement: { type: 'string', format: 'uuid' },
          typeRattachement: { type: 'string', enum: ['PRINCIPAL', 'CONFIRMATION', 'COMPLEMENT'], default: 'PRINCIPAL' },
          motif: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            idRattachement: { type: 'string', format: 'uuid' },
            idSignalement: { type: 'string', format: 'uuid' },
            idDossier: { type: 'string', format: 'uuid' },
            statutSignalement: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const { idSignalement, typeRattachement, motif } = req.body as {
      idSignalement: string;
      typeRattachement?: string;
      motif?: string;
    };

    const db = getDb();

    // Vérifier l'existence du dossier
    const dossier = await db.queryOne<{ id_dossier: string }>(
      `SELECT id_dossier FROM dossier_traitement WHERE id_dossier = $1`,
      [id]
    );
    if (!dossier) throw new NotFoundError('Dossier introuvable.');

    // Vérifier l'existence et l'état du signalement
    const sig = await db.queryOne<{ id_signalement: string; statut_signalement: string; id_utilisateur: string }>(
      `SELECT id_signalement, statut_signalement, id_utilisateur
       FROM signalement WHERE id_signalement = $1`,
      [idSignalement]
    );
    if (!sig) throw new NotFoundError('Signalement introuvable.');

    // Vérifier qu'il n'y a pas déjà un rattachement actif
    const rattachementActif = await db.queryOne<{ id_rattachement: string }>(
      `SELECT id_rattachement FROM rattachement_signalement WHERE id_signalement = $1 AND date_fin_rattachement IS NULL`,
      [idSignalement]
    );
    if (rattachementActif) {
      throw new BadRequestError('Ce signalement est déjà activement rattaché à un dossier. Utilisez la correction de rattachement pour modifier ce lien.');
    }

    const idRattachement = crypto.randomUUID();

    await db.transaction(async (trx) => {
      // 1. Écriture du lien dans RATTACHEMENT_SIGNALEMENT
      await trx.execute(
        `INSERT INTO rattachement_signalement (
           id_rattachement, id_signalement, id_dossier, date_debut_rattachement,
           type_rattachement, motif, id_acteur
         ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6)`,
        [
          idRattachement,
          idSignalement,
          id,
          typeRattachement || 'PRINCIPAL',
          motif || 'Rattachement opérationnel au dossier',
          req.user!.idUtilisateur,
        ]
      );

      await trx.execute(
        `UPDATE dossier_traitement
         SET latitude = COALESCE(latitude, (SELECT latitude FROM signalement WHERE id_signalement = $2)),
             longitude = COALESCE(longitude, (SELECT longitude FROM signalement WHERE id_signalement = $2)),
             description_localisation = COALESCE(
               NULLIF(TRIM(description_localisation), ''),
               (SELECT description_localisation FROM signalement WHERE id_signalement = $2)
             )
         WHERE id_dossier = $1
           AND latitude IS NULL AND longitude IS NULL
           AND NULLIF(TRIM(description_localisation), '') IS NULL`,
        [id, idSignalement]
      );

      // 2. Règle T04 : Le signalement passe à RATTACHE seulement après création du lien
      await trx.execute(
        `UPDATE signalement SET statut_signalement = 'RATTACHE' WHERE id_signalement = $1`,
        [idSignalement]
      );

      // 3. Traçabilité immuable
      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur, id_rattachement_cible, motif
         ) VALUES ($1, 'SIGNALEMENT_RATTACHE', 'PORTAIL_GESTION', $2, $3, $4)`,
        [crypto.randomUUID(), req.user!.idUtilisateur, idRattachement, motif || 'Signalement rattaché au dossier']
      );

      // 4. Notification au citoyen
      await trx.execute(
        `INSERT INTO notification (id_notification, id_utilisateur, titre, message, lien_cible)
         VALUES ($1, $2, 'Signalement pris en charge', 'Votre signalement a été relié au dossier d''intervention en cours de planification.', $3)`,
        [crypto.randomUUID(), sig.id_utilisateur, `/signalements/${idSignalement}`]
      );
    });

    return {
      success: true,
      idRattachement,
      idSignalement,
      idDossier: id,
      statutSignalement: StatutSignalement.RATTACHE,
      message: 'Signalement rattaché au dossier avec succès.',
    };
  });

  // Correction d'un rattachement erroné (Test T04)
  fastify.post('/:id/corriger-rattachement', {
    preHandler: [fastify.authorize(allowedManagers)],
    schema: {
      tags: ['Dossiers'],
      summary: 'Corriger un rattachement erroné vers un autre dossier (Test T04)',
      description: 'Clôture l ancien lien de rattachement sans suppression physique et ouvre le nouveau lien avec traçabilité d audit corrélée.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID du dossier actuel' },
        },
      },
      body: {
        type: 'object',
        required: ['idSignalement', 'nouveauIdDossier', 'motif'],
        properties: {
          idSignalement: { type: 'string', format: 'uuid' },
          nouveauIdDossier: { type: 'string', format: 'uuid' },
          motif: { type: 'string', minLength: 10, description: 'Motif explicite obligatoire (min 10 car.)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            ancienDossier: { type: 'string', format: 'uuid' },
            nouveauDossier: { type: 'string', format: 'uuid' },
            correlationId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const { idSignalement, nouveauIdDossier, motif } = req.body as {
      idSignalement: string;
      nouveauIdDossier: string;
      motif: string;
    };

    if (!motif || motif.trim().length < 10) {
      throw new BadRequestError("Un motif explicite d'au moins 10 caractères est obligatoire pour corriger un rattachement (Test T04).");
    }

    const db = getDb();
    const ancienRattachement = await db.queryOne<{ id_rattachement: string }>(
      `SELECT id_rattachement FROM rattachement_signalement 
       WHERE id_signalement = $1 AND id_dossier = $2 AND date_fin_rattachement IS NULL`,
      [idSignalement, id]
    );

    if (!ancienRattachement) {
      throw new NotFoundError('Aucun lien de rattachement actif trouvé entre ce signalement et ce dossier.');
    }

    const correlationId = crypto.randomUUID();
    const nouveauIdRattachement = crypto.randomUUID();

    await db.transaction(async (trx) => {
      // 1. Clôture de l'ancien lien sans suppression physique de l'historique
      await trx.execute(
        `UPDATE rattachement_signalement 
         SET date_fin_rattachement = CURRENT_TIMESTAMP, motif = $1
         WHERE id_rattachement = $2`,
        [`Correction vers dossier ${nouveauIdDossier} : ${motif.trim()}`, ancienRattachement.id_rattachement]
      );

      // 2. Création du nouveau lien
      await trx.execute(
        `INSERT INTO rattachement_signalement (
           id_rattachement, id_signalement, id_dossier, date_debut_rattachement,
           type_rattachement, motif, id_acteur
         ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'CONFIRMATION', $4, $5)`,
        [
          nouveauIdRattachement,
          idSignalement,
          nouveauIdDossier,
          `Réorientation depuis dossier ${id} : ${motif.trim()}`,
          req.user!.idUtilisateur,
        ]
      );

      // 3. Traçabilité corrélée
      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur, id_rattachement_cible,
           correlation_id, motif
         ) VALUES ($1, 'SIGNALEMENT_DERATTACHE', 'PORTAIL_GESTION', $2, $3, $4, $5)`,
        [
          crypto.randomUUID(),
          req.user!.idUtilisateur,
          ancienRattachement.id_rattachement,
          correlationId,
          `Dérattachement suite à erreur d'aiguillage : ${motif.trim()}`,
        ]
      );

      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur, id_rattachement_cible,
           correlation_id, motif
         ) VALUES ($1, 'SIGNALEMENT_RATTACHE', 'PORTAIL_GESTION', $2, $3, $4, $5)`,
        [
          crypto.randomUUID(),
          req.user!.idUtilisateur,
          nouveauIdRattachement,
          correlationId,
          `Nouveau rattachement rectifié : ${motif.trim()}`,
        ]
      );
    });

    return {
      success: true,
      message: "Rattachement corrigé et tracé avec succès sans suppression d'historique.",
      ancienDossier: id,
      nouveauDossier: nouveauIdDossier,
      correlationId,
    };
  });

  // Ajout d'un nouveau volet technique dans un dossier existant (Test T26)
  fastify.post('/:id/categories', {
    preHandler: [fastify.authorize(allowedManagers)],
    schema: {
      tags: ['Dossiers'],
      summary: 'Ajouter un volet technique à un dossier existant (Test T26)',
      description: 'Intègre une nouvelle catégorie de déchet dans le dossier si non présente (unicité stricte CONTENU_DOSSIER).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID du dossier' },
        },
      },
      body: {
        type: 'object',
        required: ['idTypeDechet'],
        properties: {
          idTypeDechet: { type: 'string', format: 'uuid' },
          quantiteEstimee: { type: 'string' },
          volumeEstime: { type: 'string' },
          niveauRisque: { type: 'string', enum: ['FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE'] },
          remarque: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            idDossier: { type: 'string', format: 'uuid' },
            idTypeDechet: { type: 'string', format: 'uuid' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { idTypeDechet, quantiteEstimee, volumeEstime, niveauRisque, remarque } = req.body as {
      idTypeDechet: string;
      quantiteEstimee?: string;
      volumeEstime?: string;
      niveauRisque?: string;
      remarque?: string;
    };

    if (!idTypeDechet) {
      throw new BadRequestError('Le type de déchet est obligatoire.');
    }

    const db = getDb();
    const dossier = await db.queryOne<{ id_dossier: string }>(
      `SELECT id_dossier FROM dossier_traitement WHERE id_dossier = $1`,
      [id]
    );
    if (!dossier) throw new NotFoundError('Dossier introuvable.');

    // Règle T26 : Vérifier unicité stricte du volet dans CONTENU_DOSSIER
    const existing = await db.queryOne<{ id_type_dechet: string }>(
      `SELECT id_type_dechet FROM contenu_dossier WHERE id_dossier = $1 AND id_type_dechet = $2`,
      [id, idTypeDechet]
    );
    if (existing) {
      throw new BadRequestError('Ce volet technique existe déjà dans le dossier (Test T26).');
    }

    await db.transaction(async (trx) => {
      await trx.execute(
        `INSERT INTO contenu_dossier (
           id_dossier, id_type_dechet, quantite_estimee, volume_estime,
           niveau_risqu_qualifie, remarque, qualifie_par, date_qualification, etat_contenu_dossier
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, 'INCLUSE')`,
        [
          id,
          idTypeDechet,
          quantiteEstimee || null,
          volumeEstime || null,
          niveauRisque || 'MOYEN',
          remarque || null,
          req.user!.idUtilisateur,
        ]
      );

      // Traçabilité immuable CONTENU_DOSSIER
      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur,
           id_dossier_contenu_cible, id_type_dechet_contenu_cible, motif
         ) VALUES ($1, 'VOLET_AJOUTE', 'PORTAIL_GESTION', $2, $3, $4, 'Ajout d''une catégorie au dossier')`,
        [crypto.randomUUID(), req.user!.idUtilisateur, id, idTypeDechet]
      );
    });

    return reply.status(201).send({
      success: true,
      idDossier: id,
      idTypeDechet,
      message: 'Volet technique ajouté au dossier avec succès.',
    });
  });

  // Retrait d'un volet de traitement avec motif obligatoire (Test T23)
  fastify.post('/:id/categories/:idTypeDechet/retirer', {
    preHandler: [fastify.authorize(allowedManagers)],
    schema: {
      tags: ['Dossiers'],
      summary: 'Retirer un volet technique d un dossier avec motif (Test T23)',
      description: 'Passe l état du volet à RETIRE si aucune affectation n est active, avec conservation immuable de l historique.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id', 'idTypeDechet'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID du dossier' },
          idTypeDechet: { type: 'string', format: 'uuid', description: 'ID du type de déchet' },
        },
      },
      body: {
        type: 'object',
        required: ['motif'],
        properties: {
          motif: { type: 'string', minLength: 10, description: 'Motif explicite de retrait (min 10 car.)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            idDossier: { type: 'string', format: 'uuid' },
            idTypeDechet: { type: 'string', format: 'uuid' },
            etatContenuDossier: { type: 'string', example: 'RETIRE' },
          },
        },
      },
    },
  }, async (req) => {
    const { id, idTypeDechet } = req.params as { id: string; idTypeDechet: string };
    const { motif } = req.body as { motif: string };

    if (!motif || motif.trim().length < 10) {
      throw new BadRequestError("Un motif explicite d'au moins 10 caractères est obligatoire pour retirer une catégorie (Test T23).");
    }

    const db = getDb();

    // Règle T23 : Vérifier qu'aucune affectation courante n'est active pour ce volet
    const affectationActive = await db.queryOne<{ id_affectation: string }>(
      `SELECT id_affectation FROM affectation 
       WHERE id_dossier = $1 AND id_type_dechet = $2 AND date_fin_affectation IS NULL`,
      [id, idTypeDechet]
    );

    if (affectationActive) {
      throw new BadRequestError('Impossible de retirer ce volet : une affectation active est en cours. Veuillez terminer ou réaffecter la mission au préalable.');
    }

    await db.transaction(async (trx) => {
      await trx.execute(
        `UPDATE contenu_dossier
         SET etat_contenu_dossier = 'RETIRE',
             date_retrait = CURRENT_TIMESTAMP,
             retire_par = $1,
             motif_retrait = $2
         WHERE id_dossier = $3 AND id_type_dechet = $4`,
        [req.user!.idUtilisateur, motif.trim(), id, idTypeDechet]
      );

      // Traçabilité immuable (Cible composite : id_dossier_contenu_cible + id_type_dechet_contenu_cible)
      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur,
           id_dossier_contenu_cible, id_type_dechet_contenu_cible, motif
         ) VALUES ($1, 'VOLET_RETIRE', 'PORTAIL_GESTION', $2, $3, $4, $5)`,
        [crypto.randomUUID(), req.user!.idUtilisateur, id, idTypeDechet, motif.trim()]
      );
    });

    return {
      success: true,
      message: "Catégorie retirée du dossier avec conservation de l'historique.",
      idDossier: id,
      idTypeDechet,
      etatContenuDossier: 'RETIRE',
    };
  });

  // Transfert externe hors périmètre (Test T27)
  fastify.post('/:id/transfert-externe', {
    preHandler: [fastify.authorize(allowedManagers)],
    schema: {
      tags: ['Dossiers'],
      summary: 'Tracer un transfert externe hors périmètre communal (Test T27)',
      description: 'Enregistre un événement immuable de transmission vers un organisme tiers (ex: SONAGED, Direction des Eaux & Forêts).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID du dossier' },
        },
      },
      body: {
        type: 'object',
        required: ['destinataireExterne', 'motif'],
        properties: {
          destinataireExterne: { type: 'string', minLength: 3, description: 'Organisme destinataire externe' },
          motif: { type: 'string', minLength: 10, description: 'Motif explicite du transfert (min 10 car.)' },
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
    const { destinataireExterne, motif } = req.body as { destinataireExterne: string; motif: string };

    if (!destinataireExterne || destinataireExterne.trim().length < 3) {
      throw new BadRequestError("Le libellé de l'organisme destinataire externe est obligatoire.");
    }
    if (!motif || motif.trim().length < 10) {
      throw new BadRequestError("Un motif de transfert explicite d'au moins 10 caractères est obligatoire.");
    }

    const db = getDb();
    await db.execute(
      `INSERT INTO evenement_metier (
         id_evenement, type_evenement, origine, id_acteur, id_dossier_cible,
         destinataire_externe, motif
       ) VALUES ($1, 'TRANSFERT_EXTERNE', 'PORTAIL_GESTION', $2, $3, $4, $5)`,
      [
        crypto.randomUUID(),
        req.user!.idUtilisateur,
        id,
        destinataireExterne.trim(),
        motif.trim(),
      ]
    );

    return {
      success: true,
      message: `Transfert externe vers "${destinataireExterne.trim()}" enregistré et tracé au dossier.`,
    };
  });

  // Détails complets d'un dossier
  fastify.get('/:id', {
    preHandler: [fastify.authorize(allowedDossierReaders)],
    schema: {
      tags: ['Dossiers'],
      summary: 'Consultation détaillée d un dossier opérationnel',
      description: 'Retourne la fiche complète du dossier avec ses volets techniques (catégories), signalements rattachés et affectations.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID du dossier' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id_dossier: { type: 'string', format: 'uuid' },
                reference_dossier: { type: 'string' },
                description_synthese: { type: 'string' },
                date_creation_dossier: { type: 'string' },
                statut_dossier: { type: 'string' },
                priorite: { type: 'string' },
                date_qualification: { type: 'string', nullable: true },
                latitude: { type: 'number', nullable: true },
                longitude: { type: 'number', nullable: true },
                description_localisation: { type: 'string', nullable: true },
                date_cloture: { type: 'string', nullable: true },
                nom_createur: { type: 'string' },
                volets: { type: 'array', items: { type: 'object', additionalProperties: true } },
                signalements: { type: 'array', items: { type: 'object', additionalProperties: true } },
                affectations: { type: 'array', items: { type: 'object', additionalProperties: true } },
              },
            },
          },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const db = getDb();

    const dossier = await db.queryOne<{
      id_dossier: string;
      reference_dossier: string;
      description_synthese: string;
      date_creation_dossier: string;
      statut_dossier: string;
      priorite: string;
      date_qualification: string | null;
      latitude: number | null;
      longitude: number | null;
      description_localisation: string | null;
      date_cloture: string | null;
      nom_createur: string;
    }>(
      `SELECT d.id_dossier, d.reference_dossier, d.description_synthese, d.date_creation_dossier,
              d.statut_dossier, d.priorite, d.date_qualification, d.latitude, d.longitude,
              d.description_localisation, d.date_cloture, u.nom as nom_createur
       FROM dossier_traitement d
       JOIN utilisateur u ON d.cree_par = u.id_utilisateur
       WHERE d.id_dossier = $1`,
      [id]
    );

    if (!dossier) throw new NotFoundError('Dossier introuvable.');

    // Volets techniques (CONTENU_DOSSIER)
    const volets = await db.query(
      `SELECT cd.id_type_dechet as "idTypeDechet", td.code_type as "codeType", td.libelle,
              cd.quantite_estimee as "quantiteEstimee", cd.volume_estime as "volumeEstime",
              cd.niveau_risqu_qualifie as "niveauRisque", cd.etat_contenu_dossier as "etatContenuDossier",
              cd.date_retrait as "dateRetrait", cd.motif_retrait as "motifRetrait"
       FROM contenu_dossier cd
       JOIN type_dechet td ON cd.id_type_dechet = td.id_type_dechet
       WHERE cd.id_dossier = $1`,
      [id]
    );

    // Signalements rattachés
    const signalements = await db.query(
      `SELECT s.id_signalement as "idSignalement", s.description, s.statut_signalement as "statutSignalement",
              rs.date_debut_rattachement as "dateRattachement", rs.type_rattachement as "typeRattachement",
              rs.date_fin_rattachement as "dateFinRattachement"
       FROM rattachement_signalement rs
       JOIN signalement s ON rs.id_signalement = s.id_signalement
       WHERE rs.id_dossier = $1
       ORDER BY rs.date_debut_rattachement ASC`,
      [id]
    );

    // Affectations du dossier
    const affectations = await db.query(
      `SELECT a.id_affectation as "idAffectation", a.id_type_dechet as "idTypeDechet",
              td.code_type as "codeType", e.nom_equipe as "nomEquipe", a.date_heure_affectation as "dateAffectation",
              a.etat_affectation as "etatAffectation", a.date_fin_affectation as "dateFinAffectation"
       FROM affectation a
       JOIN type_dechet td ON a.id_type_dechet = td.id_type_dechet
       JOIN equipe e ON a.id_equipe = e.id_equipe
       WHERE a.id_dossier = $1
       ORDER BY a.date_heure_affectation DESC`,
      [id]
    );

    return {
      success: true,
      data: {
        ...dossier,
        volets,
        signalements,
        affectations,
      },
    };
  });
};
