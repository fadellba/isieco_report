import { FastifyPluginAsync } from 'fastify';
import { RoleCode } from '@isieco/shared';
import { getMapPoints, getSanitationIndicators } from '../../application/use-cases/carte-stats.js';

export const carteStatsRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = fastify.dependencies.carteStats;
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
  }, async () => getMapPoints(repository));

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
                periode: { type: 'string' },
                observationsRecues: { type: 'string' },
                dossiersCrees: { type: 'string' },
                dossiersCloturesResolus: { type: 'string' },
                tauxResolutionGlobalPct: { type: 'string' },
                affectationsAttribuees: { type: 'string' },
                interventionsTerminees: { type: 'string' },
                resolutionsVerifieesConformes: { type: 'string' },
                reouverturesTracees: { type: 'string' },
                rg58: { type: 'string' },
                rg59: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async () => getSanitationIndicators(repository));
};
