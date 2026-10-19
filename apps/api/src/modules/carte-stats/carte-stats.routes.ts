import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/index.js';
import { RoleCode } from '@isieco/shared';

export const carteStatsRoutes: FastifyPluginAsync = async (fastify) => {
  const allowedOfficials = [
    RoleCode.QUALIFICATION,
    RoleCode.TRAITEMENT,
    RoleCode.AFFECTATION,
    RoleCode.VERIFICATION,
    RoleCode.ADMIN,
    RoleCode.DECISION,
  ];

  // Points cartographiques Dakar & liste séparée des non-géolocalisés (UC14 / Test T37)
  fastify.get('/carte/points', {
    preHandler: [fastify.authorize(allowedOfficials)],
    schema: {
      tags: ['Cartographie & Stats'],
      summary: 'Points cartographiques Dakar et liste séparée sans GPS (UC14 / Test T37)',
      description: 'Renvoie les objets géolocalisés (dossiers, signalements et interventions) pour affichage Leaflet, et la liste d attente séparée des signalements repérés par texte (Test T37).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            totalPoints: { type: 'number' },
            pointsGeolocalises: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  typeObjet: { type: 'string', enum: ['DOSSIER', 'SIGNALEMENT', 'INTERVENTION'] },
                  reference: { type: 'string' },
                  description: { type: 'string' },
                  priorite: { type: 'string' },
                  statut: { type: 'string' },
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  dateCreation: { type: 'string' },
                  idAffectation: { type: 'string', format: 'uuid', nullable: true },
                  referenceDossier: { type: 'string', nullable: true },
                  nomEquipe: { type: 'string', nullable: true },
                  dateDebut: { type: 'string', nullable: true },
                  dateFin: { type: 'string', nullable: true },
                  resultatIntervention: { type: 'string', nullable: true },
                },
              },
            },
            totalSansCoordonnees: { type: 'number' },
            sansCoordonnees: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  idSignalement: { type: 'string', format: 'uuid' },
                  description: { type: 'string' },
                  descriptionLocalisation: { type: 'string', nullable: true },
                  statutSignalement: { type: 'string' },
                  dateSoumission: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async () => {
    const db = getDb();

    // 1. Objets géolocalisés (Dossiers, Signalements et Interventions)
    const points = await db.query(
      `SELECT d.id_dossier as "id",
              'DOSSIER' as "typeObjet",
              d.reference_dossier as "reference",
              d.description_synthese as "description",
              d.priorite,
              d.statut_dossier as "statut",
              d.latitude,
              d.longitude,
              d.date_creation_dossier as "dateCreation",
              NULL::uuid as "idAffectation",
              NULL::text as "referenceDossier",
              NULL::text as "nomEquipe",
              NULL::timestamptz as "dateDebut",
              NULL::timestamptz as "dateFin",
              NULL::text as "resultatIntervention"
       FROM dossier_traitement d
       WHERE d.latitude IS NOT NULL AND d.longitude IS NOT NULL
       UNION ALL
       SELECT s.id_signalement as "id",
              'SIGNALEMENT' as "typeObjet",
              CONCAT(
                'SIG-',
                SUBSTRING(s.id_signalement::text, 1, 8),
                '-',
                SUBSTRING(s.id_signalement::text, 33, 4)
              ) as "reference",
              s.description,
              'MOYENNE' as "priorite",
              s.statut_signalement as "statut",
              s.latitude,
              s.longitude,
              s.date_soumission as "dateCreation",
              NULL::uuid as "idAffectation",
              NULL::text as "referenceDossier",
              NULL::text as "nomEquipe",
              NULL::timestamptz as "dateDebut",
              NULL::timestamptz as "dateFin",
              NULL::text as "resultatIntervention"
       FROM signalement s
       WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
         AND s.statut_signalement NOT IN ('RATTACHE', 'REJETE')`
      + ` UNION ALL
       SELECT i.id_intervention as "id",
              'INTERVENTION' as "typeObjet",
              CONCAT('INT-', SUBSTRING(i.id_intervention::text, 1, 8)) as "reference",
              d.description_synthese as "description",
              d.priorite,
              i.statut_intervention as "statut",
              d.latitude,
              d.longitude,
              COALESCE(i.date_heure_debut, a.date_heure_affectation) as "dateCreation",
              a.id_affectation as "idAffectation",
              d.reference_dossier as "referenceDossier",
              e.nom_equipe as "nomEquipe",
              i.date_heure_debut as "dateDebut",
              i.date_heure_fin as "dateFin",
              i.resultat_intervention as "resultatIntervention"
       FROM intervention i
       JOIN affectation a ON a.id_affectation = i.id_affectation
       JOIN dossier_traitement d ON d.id_dossier = a.id_dossier
       JOIN equipe e ON e.id_equipe = a.id_equipe
       WHERE d.latitude IS NOT NULL AND d.longitude IS NOT NULL
         AND i.statut_intervention <> 'ANNULEE'
         AND a.etat_affectation NOT IN ('REMPLACEE', 'ANNULEE')`
    );

    // 2. Objets sans coordonnées GPS exploitables (Liste d'attente repère textuel - Test T37)
    const sansCoordonnees = await db.query(
      `SELECT s.id_signalement as "idSignalement",
              s.description,
              s.description_localisation as "descriptionLocalisation",
              s.statut_signalement as "statutSignalement",
              s.date_soumission as "dateSoumission"
       FROM signalement s
       WHERE s.latitude IS NULL OR s.longitude IS NULL
       ORDER BY s.date_soumission ASC`
    );

    return {
      success: true,
      pointsGeolocalises: points,
      totalPoints: points.length,
      sansCoordonnees,
      totalSansCoordonnees: sansCoordonnees.length,
    };
  });

  // Indicateurs statistiques de salubrité (UC11 / Test T38 / RG58 / RG59)
  fastify.get('/statistiques/indicateurs', {
    preHandler: [fastify.authorize([RoleCode.ADMIN, RoleCode.DECISION, RoleCode.TRAITEMENT])],
    schema: {
      tags: ['Cartographie & Stats'],
      summary: 'Indicateurs de salubrité urbaine RG58 / RG59 (UC11 / Test T38)',
      description: 'Renvoie les grandeurs d salubrité en respectant l étanchéité stricte : les observations et dossiers sont comptabilisés séparément (RG58), de même que les résolutions et réouvertures (RG59).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            indicateurs: {
              type: 'object',
              properties: {
                observationsRecues: { type: 'number', example: 120 },
                dossiersCrees: { type: 'number', example: 45 },
                dossiersCloturesResolus: { type: 'number', example: 38 },
                tauxResolutionGlobalPct: { type: 'number', example: 84 },
                affectationsAttribuees: { type: 'number', example: 52 },
                interventionsTerminees: { type: 'number', example: 50 },
                resolutionsVerifieesConformes: { type: 'number', example: 38 },
                reouverturesTracees: { type: 'number', example: 3 },
              },
            },
            definitions: {
              type: 'object',
              properties: {
                rg58: { type: 'string' },
                rg59: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async () => {
    const db = getDb();

    // Règle RG58 / RG59 / Test T38 : Comptage séparé et étanche
    const [obs] = await db.query<{ count: string | number }>(`SELECT count(*) as count FROM signalement`);
    const [dossiers] = await db.query<{ count: string | number }>(`SELECT count(*) as count FROM dossier_traitement`);
    const [dossiersClos] = await db.query<{ count: string | number }>(`SELECT count(*) as count FROM dossier_traitement WHERE statut_dossier = 'CLOS_RESOLUTION_CONFIRMEE'`);
    const [affectations] = await db.query<{ count: string | number }>(`SELECT count(*) as count FROM affectation`);
    const [interventions] = await db.query<{ count: string | number }>(`SELECT count(*) as count FROM intervention WHERE statut_intervention = 'TERMINEE'`);
    const [resolutions] = await db.query<{ count: string | number }>(`SELECT count(*) as count FROM verification_resolution WHERE resultat_verification = 'CONFORME_RESOLU'`);
    const [reouvertures] = await db.query<{ count: string | number }>(`SELECT count(*) as count FROM evenement_metier WHERE type_evenement = 'DOSSIER_REOUVERT'`);

    const nbObs = Number(obs?.count || 0);
    const nbDossiers = Number(dossiers?.count || 0);
    const nbClos = Number(dossiersClos?.count || 0);
    const nbAffectations = Number(affectations?.count || 0);
    const nbInterventions = Number(interventions?.count || 0);
    const nbResolutions = Number(resolutions?.count || 0);
    const nbReouvertures = Number(reouvertures?.count || 0);

    const tauxResolutionPct = nbDossiers > 0 ? Math.round((nbClos / nbDossiers) * 100) : 0;

    return {
      success: true,
      indicateurs: {
        observationsRecues: nbObs,
        dossiersCrees: nbDossiers,
        dossiersCloturesResolus: nbClos,
        tauxResolutionGlobalPct: tauxResolutionPct,
        affectationsAttribuees: nbAffectations,
        interventionsTerminees: nbInterventions,
        resolutionsVerifieesConformes: nbResolutions,
        reouverturesTracees: nbReouvertures,
      },
      definitions: {
        rg58: 'Observations reçues et dossiers créés comptés séparément.',
        rg59: 'Résolutions vérifiées et réouvertures comptabilisées comme grandeurs distinctes.',
      },
    };
  });
};
