import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/index.js';
import { RoleCode } from '@isieco/shared';
import { BadRequestError, NotFoundError } from '../../core/errors.js';
import crypto from 'node:crypto';

export const evenementsRoutes: FastifyPluginAsync = async (fastify) => {
  const allowedAuditors = [
    RoleCode.QUALIFICATION,
    RoleCode.TRAITEMENT,
    RoleCode.AFFECTATION,
    RoleCode.VERIFICATION,
    RoleCode.ADMIN,
    RoleCode.DECISION,
  ];

  // Consultation du journal d'audit immuable (UC12 / Test T19)
  fastify.get('/audit-trail', {
    preHandler: [fastify.authorize(allowedAuditors)],
    schema: {
      tags: ['Événements & Audit'],
      summary: 'Consultation du journal d audit immuable (UC12 / Test T19)',
      description: 'Piste d audit probante et immuable filtrable par type, acteur, dossier cible, signalement cible.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          typeEvenement: { type: 'string' },
          idActeur: { type: 'string', format: 'uuid' },
          idDossierCible: { type: 'string', format: 'uuid' },
          idSignalementCible: { type: 'string', format: 'uuid' },
          limit: { type: 'number', default: 100 },
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
                  idEvenement: { type: 'string', format: 'uuid' },
                  typeEvenement: { type: 'string' },
                  dateEvenement: { type: 'string' },
                  dateEnregistrement: { type: 'string' },
                  origine: { type: 'string' },
                  idActeur: { type: 'string', format: 'uuid', nullable: true },
                  nomActeur: { type: 'string', nullable: true },
                  prenomActeur: { type: 'string', nullable: true },
                  idSignalementCible: { type: 'string', format: 'uuid', nullable: true },
                  idDossierCible: { type: 'string', format: 'uuid', nullable: true },
                  idRattachementCible: { type: 'string', format: 'uuid', nullable: true },
                  idAffectationCible: { type: 'string', format: 'uuid', nullable: true },
                  idInterventionCible: { type: 'string', format: 'uuid', nullable: true },
                  idVerificationCible: { type: 'string', format: 'uuid', nullable: true },
                  idUtilisateurCible: { type: 'string', format: 'uuid', nullable: true },
                  idEvenementCorrige: { type: 'string', format: 'uuid', nullable: true },
                  donneesAvant: { type: 'string', nullable: true },
                  donneesApres: { type: 'string', nullable: true },
                  destinataireExterne: { type: 'string', nullable: true },
                  motif: { type: 'string', nullable: true },
                  correlationId: { type: 'string', format: 'uuid', nullable: true },
                },
              },
            },
          },
        },
      },
    },
  }, async (req) => {
    const query = req.query as {
      typeEvenement?: string;
      idActeur?: string;
      idDossierCible?: string;
      idSignalementCible?: string;
      limit?: string;
    };
    const db = getDb();

    let sql = `
      SELECT em.id_evenement as "idEvenement",
             em.type_evenement as "typeEvenement",
             em.date_evenement as "dateEvenement",
             em.date_enregistrement as "dateEnregistrement",
             em.origine,
             em.id_acteur as "idActeur",
             u.nom as "nomActeur",
             u.prenom as "prenomActeur",
             em.id_signalement_cible as "idSignalementCible",
             em.id_dossier_cible as "idDossierCible",
             em.id_rattachement_cible as "idRattachementCible",
             em.id_affectation_cible as "idAffectationCible",
             em.id_intervention_cible as "idInterventionCible",
             em.id_verification_cible as "idVerificationCible",
             em.id_utilisateur_cible as "idUtilisateurCible",
             em.id_evenement_corrige as "idEvenementCorrige",
             em.donnees_avant as "donneesAvant",
             em.donnees_apres as "donneesApres",
             em.destinataire_externe as "destinataireExterne",
             em.motif,
             em.correlation_id as "correlationId"
      FROM evenement_metier em
      LEFT JOIN utilisateur u ON em.id_acteur = u.id_utilisateur
      WHERE 1=1
    `;
    const params: any[] = [];

    if (query.typeEvenement) {
      sql += ` AND em.type_evenement = $${params.length + 1}`;
      params.push(query.typeEvenement);
    }
    if (query.idActeur) {
      sql += ` AND em.id_acteur = $${params.length + 1}`;
      params.push(query.idActeur);
    }
    if (query.idDossierCible) {
      sql += ` AND em.id_dossier_cible = $${params.length + 1}`;
      params.push(query.idDossierCible);
    }
    if (query.idSignalementCible) {
      sql += ` AND em.id_signalement_cible = $${params.length + 1}`;
      params.push(query.idSignalementCible);
    }

    sql += ` ORDER BY em.date_enregistrement DESC LIMIT $${params.length + 1}`;
    params.push(Number(query.limit) || 100);

    const rows = await db.query(sql, params);
    return { success: true, count: rows.length, data: rows };
  });

  // Correction immuable d'un événement passé (Test T18)
  fastify.post('/:id/corriger', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Événements & Audit'],
      summary: 'Correction immuable d un événement passé (Test T18)',
      description: 'L événement d origine reste INCHANGÉ. Un nouvel événement rectificatif est inséré pointant vers idEvenementCorrige (append-only audit log).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'ID de l événement historique à rectifier' },
        },
      },
      body: {
        type: 'object',
        required: ['motif'],
        properties: {
          nouveauType: { type: 'string', default: 'EVENEMENT_CORRIGE' },
          motif: { type: 'string', minLength: 10, description: 'Motif explicite obligatoire (min 10 car.)' },
          donneesApres: { type: 'object', additionalProperties: true },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            idEvenement: { type: 'string', format: 'uuid' },
            idEvenementCorrige: { type: 'string', format: 'uuid' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { nouveauType, motif, donneesApres } = req.body as {
      nouveauType: string;
      motif: string;
      donneesApres?: any;
    };

    if (!motif || motif.trim().length < 10) {
      throw new BadRequestError("Un motif de rectification explicite d'au moins 10 caractères est obligatoire.");
    }

    const db = getDb();
    const original = await db.queryOne<{
      id_evenement: string;
      id_signalement_cible: string | null;
      id_dossier_cible: string | null;
      id_rattachement_cible: string | null;
      id_affectation_cible: string | null;
      id_intervention_cible: string | null;
      id_verification_cible: string | null;
      id_utilisateur_cible: string | null;
      id_equipe_cible: string | null;
      id_type_dechet_cible: string | null;
      id_competence_equipe_cible: string | null;
      id_dossier_contenu_cible: string | null;
      id_type_dechet_contenu_cible: string | null;
    }>(
      `SELECT * FROM evenement_metier WHERE id_evenement = $1`,
      [id]
    );

    if (!original) throw new NotFoundError('Événement original introuvable.');

    // Règle T18 : L'original reste INCHANGÉ. On crée un nouvel événement pointant vers idEvenementCorrige
    const idNouvelEvenement = crypto.randomUUID();

    await db.execute(
      `INSERT INTO evenement_metier (
         id_evenement, type_evenement, origine, id_acteur,
         id_signalement_cible, id_dossier_cible, id_rattachement_cible, id_affectation_cible,
         id_intervention_cible, id_verification_cible, id_utilisateur_cible, id_equipe_cible,
         id_type_dechet_cible, id_competence_equipe_cible, id_dossier_contenu_cible, id_type_dechet_contenu_cible,
         id_evenement_corrige, donnees_apres, motif
       ) VALUES ($1, $2, 'PORTAIL_GESTION', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        idNouvelEvenement,
        nouveauType || 'EVENEMENT_CORRIGE',
        req.user!.idUtilisateur,
        original.id_signalement_cible,
        original.id_dossier_cible,
        original.id_rattachement_cible,
        original.id_affectation_cible,
        original.id_intervention_cible,
        original.id_verification_cible,
        original.id_utilisateur_cible,
        original.id_equipe_cible,
        original.id_type_dechet_cible,
        original.id_competence_equipe_cible,
        original.id_dossier_contenu_cible,
        original.id_type_dechet_contenu_cible,
        id, // idEvenementCorrige
        donneesApres ? JSON.stringify(donneesApres) : null,
        `Correction tracée : ${motif.trim()}`,
      ]
    );

    return reply.status(201).send({
      success: true,
      idEvenement: idNouvelEvenement,
      idEvenementCorrige: id,
      message: "Correction enregistrée sans modification de l'événement historique (Test T18).",
    });
  });

  // Enregistrement direct d'un événement métier (Tests T17, T32, T33, T34)
  fastify.post('/', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Événements & Audit'],
      summary: 'Enregistrement direct d un événement métier avec cible exclusive (Tests T17, T32, T33, T34)',
      description: 'Garantit l invariant de cible exclusive : exactement un groupe d entité cible (signalement, dossier, volet composite, etc.).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      body: {
        type: 'object',
        required: ['typeEvenement'],
        properties: {
          typeEvenement: { type: 'string' },
          dateEvenement: { type: 'string' },
          idSignalementCible: { type: 'string', format: 'uuid' },
          idDossierCible: { type: 'string', format: 'uuid' },
          idRattachementCible: { type: 'string', format: 'uuid' },
          idAffectationCible: { type: 'string', format: 'uuid' },
          idInterventionCible: { type: 'string', format: 'uuid' },
          idVerificationCible: { type: 'string', format: 'uuid' },
          idUtilisateurCible: { type: 'string', format: 'uuid' },
          idEquipeCible: { type: 'string', format: 'uuid' },
          idTypeDechetCible: { type: 'string', format: 'uuid' },
          idCompetenceEquipeCible: { type: 'string', format: 'uuid' },
          idDossierContenuCible: { type: 'string', format: 'uuid' },
          idTypeDechetContenuCible: { type: 'string', format: 'uuid' },
          motif: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            idEvenement: { type: 'string', format: 'uuid' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const {
      typeEvenement,
      dateEvenement,
      idSignalementCible,
      idDossierCible,
      idRattachementCible,
      idAffectationCible,
      idInterventionCible,
      idVerificationCible,
      idUtilisateurCible,
      idEquipeCible,
      idTypeDechetCible,
      idCompetenceEquipeCible,
      idDossierContenuCible,
      idTypeDechetContenuCible,
      motif,
    } = req.body as any;

    if (!typeEvenement) {
      throw new BadRequestError("Le type d'événement est obligatoire.");
    }

    // Validation T33 : Cible composite incomplète
    const hasDossierContenu = idDossierContenuCible != null;
    const hasDechetContenu = idTypeDechetContenuCible != null;
    if (hasDossierContenu !== hasDechetContenu) {
      throw new BadRequestError("Cible composite incomplète : idDossierContenuCible et idTypeDechetContenuCible doivent être fournis ensemble (Test T33).");
    }

    // Validation T17 & T32 : Exactement 1 groupe cible
    const targetCount = [
      idSignalementCible,
      idDossierCible,
      idRattachementCible,
      idAffectationCible,
      idInterventionCible,
      idVerificationCible,
      idUtilisateurCible,
      idEquipeCible,
      idTypeDechetCible,
      idCompetenceEquipeCible,
      hasDossierContenu && hasDechetContenu ? true : null,
    ].filter(Boolean).length;

    if (targetCount === 0) {
      throw new BadRequestError("L'événement métier doit avoir exactement une cible principale (Test T17 / T32).");
    }
    if (targetCount > 1) {
      throw new BadRequestError("L'événement métier ne peut pas cibler simultanément plusieurs entités (Test T17 / T32).");
    }

    const db = getDb();

    // Validation T34 : Cible composite pointant vers un couple inexistant
    if (hasDossierContenu && hasDechetContenu) {
      const exists = await db.queryOne<{ id_dossier: string }>(
        `SELECT id_dossier FROM contenu_dossier WHERE id_dossier = $1 AND id_type_dechet = $2`,
        [idDossierContenuCible, idTypeDechetContenuCible]
      );
      if (!exists) {
        throw new BadRequestError("La cible composite pointe vers un couple dossier/catégorie inexistant (Test T34).");
      }
    }

    const idEvenement = crypto.randomUUID();
    await db.execute(
      `INSERT INTO evenement_metier (
         id_evenement, type_evenement, date_evenement, origine, id_acteur,
         id_signalement_cible, id_dossier_cible, id_rattachement_cible, id_affectation_cible,
         id_intervention_cible, id_verification_cible, id_utilisateur_cible, id_equipe_cible,
         id_type_dechet_cible, id_competence_equipe_cible, id_dossier_contenu_cible, id_type_dechet_contenu_cible,
         motif
       ) VALUES ($1, $2, $3, 'PORTAIL_GESTION', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        idEvenement,
        typeEvenement,
        dateEvenement ? new Date(dateEvenement).toISOString() : new Date().toISOString(),
        req.user!.idUtilisateur,
        idSignalementCible || null,
        idDossierCible || null,
        idRattachementCible || null,
        idAffectationCible || null,
        idInterventionCible || null,
        idVerificationCible || null,
        idUtilisateurCible || null,
        idEquipeCible || null,
        idTypeDechetCible || null,
        idCompetenceEquipeCible || null,
        idDossierContenuCible || null,
        idTypeDechetContenuCible || null,
        motif || null,
      ]
    );

    return reply.status(201).send({
      success: true,
      idEvenement,
      message: 'Événement métier créé avec succès.',
    });
  });
};
