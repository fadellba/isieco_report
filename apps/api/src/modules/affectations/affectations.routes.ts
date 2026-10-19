import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/index.js';
import { RoleCode, EtatAffectation, StatutDossier } from '@isieco/shared';
import { BadRequestError, NotFoundError } from '../../core/errors.js';
import crypto from 'node:crypto';

export const affectationsRoutes: FastifyPluginAsync = async (fastify) => {
  const allowedAssigners = [RoleCode.AFFECTATION];
  const allowedAssignmentReaders = [RoleCode.AFFECTATION, RoleCode.ADMIN];

  // Liste des volets en attente d'affectation
  fastify.get('/en-attente', {
    preHandler: [fastify.authorize(allowedAssignmentReaders)],
    schema: {
      tags: ['Affectations'],
      summary: 'Volets techniques en attente d affectation aux équipes (UC06)',
      description: 'Liste les catégories de déchets incluses dans un dossier non clôturé qui n ont aucune affectation active.',
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
                  idDossier: { type: 'string', format: 'uuid' },
                  referenceDossier: { type: 'string' },
                  priorite: { type: 'string' },
                  dateCreationDossier: { type: 'string' },
                  idTypeDechet: { type: 'string', format: 'uuid' },
                  codeType: { type: 'string' },
                  libelleDechet: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async () => {
    const db = getDb();
    const rows = await db.query(
      `SELECT cd.id_dossier as "idDossier",
              d.reference_dossier as "referenceDossier",
              d.priorite,
              d.date_creation_dossier as "dateCreationDossier",
              cd.id_type_dechet as "idTypeDechet",
              td.code_type as "codeType",
              td.libelle as "libelleDechet"
       FROM contenu_dossier cd
       JOIN dossier_traitement d ON cd.id_dossier = d.id_dossier
       JOIN type_dechet td ON cd.id_type_dechet = td.id_type_dechet
       LEFT JOIN affectation a ON a.id_dossier = cd.id_dossier 
                              AND a.id_type_dechet = cd.id_type_dechet 
                              AND a.date_fin_affectation IS NULL
       WHERE cd.etat_contenu_dossier = 'INCLUSE'
         AND a.id_affectation IS NULL
         AND d.statut_dossier NOT IN ('CLOS_RESOLUTION_CONFIRMEE', 'CLOS_SANS_SUITE')
       ORDER BY 
         CASE d.priorite 
           WHEN 'URGENTE' THEN 1 
           WHEN 'ELEVEE' THEN 2 
           WHEN 'MOYENNE' THEN 3 
           ELSE 4 
         END, d.date_creation_dossier ASC`
    );

    return { success: true, count: rows.length, data: rows };
  });

  // Création d'une affectation spécialisée par volet (UC06 / T05 / T06 / T07 / T08 / T16)
  fastify.post('/', {
    preHandler: [fastify.authorize(allowedAssigners)],
    schema: {
      tags: ['Affectations'],
      summary: 'Créer une affectation spécialisée par volet technique (UC06 / T05-T08 / T16)',
      description: 'Affecte une équipe habilitée (compétence active valide) à une catégorie de déchet incluse dans le dossier. Opération idempotente via referenceOperationUnique.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      body: {
        type: 'object',
        required: ['idDossier', 'idTypeDechet', 'idEquipe', 'idCompetenceEquipe'],
        properties: {
          idDossier: { type: 'string', format: 'uuid' },
          idTypeDechet: { type: 'string', format: 'uuid' },
          idEquipe: { type: 'string', format: 'uuid' },
          idCompetenceEquipe: { type: 'string', format: 'uuid' },
          motif: { type: 'string' },
          observation: { type: 'string' },
          referenceOperationUnique: { type: 'string', description: 'Clé d idempotence unique pour éviter les doubles soumissions' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            idAffectation: { type: 'string', format: 'uuid' },
            etatAffectation: { type: 'string' },
            message: { type: 'string' },
          },
        },
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            idAffectation: { type: 'string', format: 'uuid' },
            etatAffectation: { type: 'string' },
            idempotent: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const {
      idDossier,
      idTypeDechet,
      idEquipe,
      idCompetenceEquipe,
      motif,
      observation,
      referenceOperationUnique,
    } = req.body as {
      idDossier: string;
      idTypeDechet: string;
      idEquipe: string;
      idCompetenceEquipe: string;
      motif?: string;
      observation?: string;
      referenceOperationUnique?: string;
    };

    const db = getDb();

    // Règle T16 : Idempotence stricte par referenceOperationUnique
    if (referenceOperationUnique) {
      const existing = await db.queryOne<{ id_affectation: string; etat_affectation: string }>(
        `SELECT id_affectation, etat_affectation FROM affectation WHERE reference_operation_unique = $1`,
        [referenceOperationUnique]
      );
      if (existing) {
        return reply.status(200).send({
          success: true,
          idAffectation: existing.id_affectation,
          etatAffectation: existing.etat_affectation,
          idempotent: true,
          message: 'Affectation existante retournée (opération idempotente).',
        });
      }
    }

    // Règle T05 : Le type de déchet doit exister dans CONTENU_DOSSIER à l'état INCLUSE
    const contenu = await db.queryOne<{ id_dossier: string; etat_contenu_dossier: string }>(
      `SELECT id_dossier, etat_contenu_dossier FROM contenu_dossier 
       WHERE id_dossier = $1 AND id_type_dechet = $2`,
      [idDossier, idTypeDechet]
    );

    if (!contenu) {
      throw new BadRequestError('Échec de la contrainte : le type de déchet visé est absent du contenu de ce dossier (Test T05).');
    }
    if (contenu.etat_contenu_dossier === 'RETIRE') {
      throw new BadRequestError("Impossible d'affecter une catégorie retirée du dossier (Test T23).");
    }

    // Règle T06 & T07 : Concordance équipe / compétence et validité temporelle
    const comp = await db.queryOne<{ id_competence_equipe: string; date_debut: string; date_fin: string | null }>(
      `SELECT id_competence_equipe, date_debut, date_fin FROM competence_equipe
       WHERE id_competence_equipe = $1 AND id_equipe = $2 AND id_type_dechet = $3`,
      [idCompetenceEquipe, idEquipe, idTypeDechet]
    );

    if (!comp) {
      throw new BadRequestError("L'équipe sélectionnée ne possède pas la compétence requise pour ce type de déchet (Test T06).");
    }

    const decisionDate = new Date();
    if (new Date(comp.date_debut) > decisionDate) {
      throw new BadRequestError("La compétence de l'équipe n'est pas encore valide à la date d'affectation.");
    }
    if (comp.date_fin && new Date(comp.date_fin) < decisionDate) {
      throw new BadRequestError("La compétence de l'équipe pour ce type de déchet a expiré à la date d'affectation (Test T07).");
    }

    const dossierLocalisation = await db.queryOne<{
      latitude: number | null;
      longitude: number | null;
      description_localisation: string | null;
    }>(
      `SELECT latitude, longitude, description_localisation
       FROM dossier_traitement WHERE id_dossier = $1`,
      [idDossier]
    );
    const hasCoordinates = dossierLocalisation?.latitude != null && dossierLocalisation.longitude != null;
    const hasDescription = Boolean(dossierLocalisation?.description_localisation?.trim());
    if (!hasCoordinates && !hasDescription) {
      throw new BadRequestError("Le dossier doit avoir une localisation exploitable avant son affectation (RG30).");
    }

    // Règle T08 : Unicité de l'affectation active par volet
    const activeAffectation = await db.queryOne<{ id_affectation: string }>(
      `SELECT id_affectation FROM affectation 
       WHERE id_dossier = $1 AND id_type_dechet = $2 AND date_fin_affectation IS NULL`,
      [idDossier, idTypeDechet]
    );

    if (activeAffectation) {
      throw new BadRequestError('Une affectation active existe déjà pour ce couple dossier/catégorie. Utilisez la réaffectation pour la remplacer (Test T08).');
    }

    const idAffectation = crypto.randomUUID();

    await db.transaction(async (trx) => {
      // 1. Insertion AFFECTATION
      await trx.execute(
        `INSERT INTO affectation (
           id_affectation, id_dossier, id_type_dechet, id_equipe, id_competence_equipe,
           date_heure_affectation, id_decideur, etat_affectation, motif, observation,
           reference_operation_unique
         ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, 'ACTIVE', $7, $8, $9)`,
        [
          idAffectation,
          idDossier,
          idTypeDechet,
          idEquipe,
          idCompetenceEquipe,
          req.user!.idUtilisateur,
          motif || null,
          observation || null,
          referenceOperationUnique || null,
        ]
      );

      // 2. Mise à jour du statut global du dossier
      await trx.execute(
        `UPDATE dossier_traitement 
         SET statut_dossier = 'EN_COURS_DE_TRAITEMENT' 
         WHERE id_dossier = $1 AND statut_dossier = 'EN_ATTENTE_AFFECTATION'`,
        [idDossier]
      );

      // 3. Traçabilité immuable EVENEMENT_METIER (cible exclusive = id_affectation_cible)
      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur, id_affectation_cible,
           reference_operation_unique, motif
         ) VALUES ($1, 'AFFECTATION_CREEE', 'PORTAIL_GESTION', $2, $3, $4, $5)`,
        [
          crypto.randomUUID(),
          req.user!.idUtilisateur,
          idAffectation,
          referenceOperationUnique || null,
          motif || "Affectation de l'équipe au volet de traitement",
        ]
      );

      // 4. Création automatique de la fiche d'intervention en attente (PROGRAMMEE)
      await trx.execute(
        `INSERT INTO intervention (id_intervention, id_affectation, statut_intervention, renseigne_par)
         VALUES ($1, $2, 'PROGRAMMEE', $3)`,
        [crypto.randomUUID(), idAffectation, req.user!.idUtilisateur]
      );
    });

    return reply.status(201).send({
      success: true,
      idAffectation,
      etatAffectation: EtatAffectation.ACTIVE,
      message: 'Affectation créée avec succès et intervention programmée.',
    });
  });

  // Réaffectation d'un volet vers une autre équipe dans la même transaction (Test T08)
  fastify.post('/:id/reaffecter', {
    preHandler: [fastify.authorize(allowedAssigners)],
    schema: {
      tags: ['Affectations'],
      summary: 'Réaffecter un volet vers une autre équipe dans une transaction atomique (Test T08)',
      description: 'Clôture l affectation active actuelle en REMPLACEE et crée la nouvelle affectation avec nouvelle intervention programmée.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID de l affectation courante à remplacer' },
        },
      },
      body: {
        type: 'object',
        required: ['nouvelleEquipeId', 'nouvelleCompetenceId', 'motif'],
        properties: {
          nouvelleEquipeId: { type: 'string', format: 'uuid' },
          nouvelleCompetenceId: { type: 'string', format: 'uuid' },
          motif: { type: 'string', minLength: 10, description: 'Motif explicite obligatoire (min 10 car.)' },
          referenceOperationUnique: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            ancienneAffectation: { type: 'string', format: 'uuid' },
            nouvelleAffectation: { type: 'string', format: 'uuid' },
            correlationId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const {
      nouvelleEquipeId,
      nouvelleCompetenceId,
      motif,
      referenceOperationUnique,
    } = req.body as {
      nouvelleEquipeId: string;
      nouvelleCompetenceId: string;
      motif: string;
      referenceOperationUnique?: string;
    };

    if (!motif || motif.trim().length < 10) {
      throw new BadRequestError("Un motif explicite d'au moins 10 caractères est obligatoire pour une réaffectation.");
    }

    const db = getDb();
    const ancienne = await db.queryOne<{
      id_affectation: string;
      id_dossier: string;
      id_type_dechet: string;
    }>(
      `SELECT id_affectation, id_dossier, id_type_dechet FROM affectation 
       WHERE id_affectation = $1 AND date_fin_affectation IS NULL`,
      [id]
    );

    if (!ancienne) {
      throw new NotFoundError('Affectation active introuvable ou déjà terminée.');
    }

    // Vérifier les compétences de la nouvelle équipe
    const comp = await db.queryOne<{ id_competence_equipe: string; date_debut: string; date_fin: string | null }>(
      `SELECT id_competence_equipe, date_debut, date_fin FROM competence_equipe
       WHERE id_competence_equipe = $1 AND id_equipe = $2 AND id_type_dechet = $3`,
      [nouvelleCompetenceId, nouvelleEquipeId, ancienne.id_type_dechet]
    );

    if (!comp) {
      throw new BadRequestError('La nouvelle équipe ne dispose pas de la compétence requise pour ce volet.');
    }
    const decisionDate = new Date();
    if (new Date(comp.date_debut) > decisionDate) {
      throw new BadRequestError("La compétence de la nouvelle équipe n'est pas encore valide.");
    }
    if (comp.date_fin && new Date(comp.date_fin) < decisionDate) {
      throw new BadRequestError('La compétence de la nouvelle équipe a expiré.');
    }

    const dossierLocalisation = await db.queryOne<{
      latitude: number | null;
      longitude: number | null;
      description_localisation: string | null;
    }>(
      `SELECT latitude, longitude, description_localisation
       FROM dossier_traitement WHERE id_dossier = $1`,
      [ancienne.id_dossier]
    );
    const hasCoordinates = dossierLocalisation?.latitude != null && dossierLocalisation.longitude != null;
    const hasDescription = Boolean(dossierLocalisation?.description_localisation?.trim());
    if (!hasCoordinates && !hasDescription) {
      throw new BadRequestError("Le dossier doit avoir une localisation exploitable avant sa réaffectation (RG30).");
    }
    const nouvelleIdAffectation = crypto.randomUUID();
    const correlationId = crypto.randomUUID();

    await db.transaction(async (trx) => {
      // 1. Clôture de l'ancienne affectation
      await trx.execute(
        `UPDATE affectation 
         SET etat_affectation = 'REMPLACEE',
             date_fin_affectation = CURRENT_TIMESTAMP,
             motif = $1
         WHERE id_affectation = $2`,
        [`Réaffectation vers nouvelle équipe : ${motif.trim()}`, id]
      );

      // 2. Création de la nouvelle affectation
      await trx.execute(
        `INSERT INTO affectation (
           id_affectation, id_dossier, id_type_dechet, id_equipe, id_competence_equipe,
           date_heure_affectation, id_decideur, etat_affectation, motif, reference_operation_unique
         ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, 'ACTIVE', $7, $8)`,
        [
          nouvelleIdAffectation,
          ancienne.id_dossier,
          ancienne.id_type_dechet,
          nouvelleEquipeId,
          nouvelleCompetenceId,
          req.user!.idUtilisateur,
          motif.trim(),
          referenceOperationUnique || null,
        ]
      );

      // 3. Traçabilité corrélée
      await trx.execute(
        `INSERT INTO evenement_metier (
           id_evenement, type_evenement, origine, id_acteur, id_affectation_cible,
           correlation_id, motif
         ) VALUES ($1, 'AFFECTATION_REMPLACEE', 'PORTAIL_GESTION', $2, $3, $4, $5)`,
        [
          crypto.randomUUID(),
          req.user!.idUtilisateur,
          nouvelleIdAffectation,
          correlationId,
          motif.trim(),
        ]
      );

      // 4. Nouvelle intervention programmée pour la nouvelle équipe
      await trx.execute(
        `INSERT INTO intervention (id_intervention, id_affectation, statut_intervention, renseigne_par)
         VALUES ($1, $2, 'PROGRAMMEE', $3)`,
        [crypto.randomUUID(), nouvelleIdAffectation, req.user!.idUtilisateur]
      );
    });

    return {
      success: true,
      message: 'Réaffectation effectuée avec succès dans une transaction atomique.',
      ancienneAffectation: id,
      nouvelleAffectation: nouvelleIdAffectation,
      correlationId,
    };
  });
};
