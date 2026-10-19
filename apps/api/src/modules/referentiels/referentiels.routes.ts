import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/index.js';
import { RoleCode } from '@isieco/shared';
import { BadRequestError } from '../../core/errors.js';
import crypto from 'node:crypto';

export const referentielsRoutes: FastifyPluginAsync = async (fastify) => {
  // Référentiel des types de déchets (Actifs)
  fastify.get('/types-dechets', {
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Liste des catégories de déchets actives',
      description: 'Renvoie les types de déchets reconnus par le système municipal de Dakar (Plastiques, Gravats, Métaux, etc.).',
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
                  idTypeDechet: { type: 'string', format: 'uuid' },
                  codeType: { type: 'string', example: 'PLASTIQUE' },
                  libelle: { type: 'string', example: 'Déchets Plastiques' },
                  description: { type: 'string', nullable: true },
                  orientationSpecialisee: { type: 'string', nullable: true },
                  dateDebutValidite: { type: 'string' },
                  dateFinValidite: { type: 'string', nullable: true },
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
      `SELECT id_type_dechet as "idTypeDechet", 
              code_type as "codeType", 
              libelle, 
              description, 
              orientation_specialisee as "orientationSpecialisee",
              date_debut_validite as "dateDebutValidite",
              date_fin_validite as "dateFinValidite"
       FROM type_dechet
       WHERE date_fin_validite IS NULL OR date_fin_validite >= CURRENT_TIMESTAMP
       ORDER BY libelle ASC`
    );
    return { success: true, count: rows.length, data: rows };
  });

  // Référentiel des équipes actives avec leurs membres
  fastify.get('/equipes', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Liste des équipes d intervention et de leurs compétences',
      description: 'Renvoie les équipes municipales actives de Dakar-Plateau et Médina, leurs membres et leurs compétences.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    },
  }, async () => {
    const db = getDb();
    const equipes = await db.query(
      `SELECT id_equipe as "idEquipe", nom_equipe as "nomEquipe", description, etat_equipe as "etatEquipe"
       FROM equipe
       WHERE etat_equipe = 'ACTIVE'
       ORDER BY nom_equipe ASC`
    );

    const data = await Promise.all(
      equipes.map(async (eq) => {
        const membres = await db.query(
          `SELECT u.id_utilisateur as "idUtilisateur", u.nom, u.prenom, ae.fonction
           FROM appartenance_equipe ae
           JOIN utilisateur u ON ae.id_utilisateur = u.id_utilisateur
           WHERE ae.id_equipe = $1 AND (ae.date_fin IS NULL OR ae.date_fin >= CURRENT_TIMESTAMP)`,
          [eq.idEquipe]
        );
        const competences = await db.query(
          `SELECT ce.id_competence_equipe as "idCompetenceEquipe", td.id_type_dechet as "idTypeDechet", 
                  td.code_type as "codeType", td.libelle as "libelleDechet", ce.date_debut as "dateDebut", ce.date_fin as "dateFin"
           FROM competence_equipe ce
           JOIN type_dechet td ON ce.id_type_dechet = td.id_type_dechet
           WHERE ce.id_equipe = $1 AND (ce.date_fin IS NULL OR ce.date_fin >= CURRENT_TIMESTAMP)`,
          [eq.idEquipe]
        );
        return {
          ...eq,
          membres,
          competences,
        };
      })
    );

    return { success: true, count: data.length, data };
  });

  // Liste des compétences d'équipes actives (pour sélecteur d'affectation)
  fastify.get('/competences', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Compétences actives d équipes (pour affectation)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          idTypeDechet: { type: 'string', format: 'uuid', description: 'Filtrer par catégorie technique de déchet' },
        },
      },
    },
  }, async (req) => {
    const query = req.query as { idTypeDechet?: string };
    const db = getDb();
    
    let sql = `
      SELECT ce.id_competence_equipe as "idCompetenceEquipe",
             ce.id_equipe as "idEquipe",
             e.nom_equipe as "nomEquipe",
             ce.id_type_dechet as "idTypeDechet",
             td.code_type as "codeType",
             td.libelle as "libelleDechet",
             ce.date_debut as "dateDebut",
             ce.date_fin as "dateFin"
      FROM competence_equipe ce
      JOIN equipe e ON ce.id_equipe = e.id_equipe
      JOIN type_dechet td ON ce.id_type_dechet = td.id_type_dechet
      WHERE e.etat_equipe = 'ACTIVE'
        AND (ce.date_fin IS NULL OR ce.date_fin >= CURRENT_TIMESTAMP)
    `;
    const params: any[] = [];
    if (query.idTypeDechet) {
      sql += ` AND ce.id_type_dechet = $1`;
      params.push(query.idTypeDechet);
    }
    sql += ` ORDER BY e.nom_equipe ASC`;

    const rows = await db.query(sql, params);
    return { success: true, count: rows.length, data: rows };
  });

  // Déclaration ou mise à jour de compétence d'équipe (Test T22)
  fastify.post('/competences', {
    preHandler: [fastify.authorize([RoleCode.ADMIN])],
    schema: {
      tags: ['Référentiels & Compétences'],
      summary: 'Déclarer ou renouveler une compétence d équipe (Admin / Test T22)',
      description: 'Valide l intégrité de la période temporelle : la date de fin doit être >= date de début (Test T22).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      body: {
        type: 'object',
        required: ['idEquipe', 'idTypeDechet', 'dateDebut'],
        properties: {
          idEquipe: { type: 'string', format: 'uuid' },
          idTypeDechet: { type: 'string', format: 'uuid' },
          dateDebut: { type: 'string', format: 'date-time' },
          dateFin: { type: 'string', format: 'date-time', nullable: true },
          commentaire: { type: 'string', nullable: true },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            idCompetenceEquipe: { type: 'string', format: 'uuid' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { idEquipe, idTypeDechet, dateDebut, dateFin, commentaire } = req.body as {
      idEquipe: string;
      idTypeDechet: string;
      dateDebut: string;
      dateFin?: string | null;
      commentaire?: string;
    };

    if (!idEquipe || !idTypeDechet || !dateDebut) {
      throw new BadRequestError("L'équipe, le type de déchet et la date de début sont obligatoires.");
    }

    // Règle T22 : Rejet de toute période de compétence où dateFin < dateDebut
    if (dateFin && new Date(dateFin) < new Date(dateDebut)) {
      throw new BadRequestError('La date de fin de validité doit être postérieure ou égale à la date de début (Test T22).');
    }

    const db = getDb();
    const idCompetence = crypto.randomUUID();

    await db.execute(
      `INSERT INTO competence_equipe (id_competence_equipe, id_equipe, id_type_dechet, date_debut, date_fin, commentaire, validee_par)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        idCompetence,
        idEquipe,
        idTypeDechet,
        new Date(dateDebut).toISOString(),
        dateFin ? new Date(dateFin).toISOString() : null,
        commentaire || 'Habilitation technique validée',
        req.user!.idUtilisateur,
      ]
    );

    return reply.status(201).send({
      success: true,
      idCompetenceEquipe: idCompetence,
      message: 'Compétence enregistrée avec succès (Test T22).',
    });
  });
};
