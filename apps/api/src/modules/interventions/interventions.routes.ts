import { FastifyPluginAsync } from 'fastify';
import { RoleCode, StatutIntervention, ResultatIntervention, ContextePhoto, EtatAffectation, StatutDossier } from '@isieco/shared';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { InterventionRuleError } from '../../domain/interventions.js';
import {
  addInterventionPhoto,
  finishIntervention,
  getPrivateInterventionPhoto,
  listInterventionMissions,
  startIntervention,
  uploadPrivateInterventionPhoto,
} from '../../application/use-cases/interventions.js';

export const interventionsRoutes: FastifyPluginAsync = async (fastify) => {
  const allowedTerrainAgents = [RoleCode.TERRAIN];
  const repository = fastify.dependencies.interventions;
  const photoStorage = fastify.dependencies.interventionPhotoStorage;

  function rethrowInterventionError(error: unknown): never {
    if (!(error instanceof InterventionRuleError)) throw error;
    switch (error.rule) {
      case 'INTERVENTION_NOT_FOUND':
        throw new NotFoundError('Intervention introuvable.');
      case 'TEAM_MEMBERSHIP_REQUIRED':
        throw new ForbiddenError("Cette intervention est réservée aux agents de l'équipe affectée.");
      case 'REPORT_SUBMISSION_FORBIDDEN':
        throw new ForbiddenError('Seul le chef d’équipe ou un membre délégué peut soumettre le compte-rendu.');
      case 'PHOTO_NOT_FOUND':
        throw new NotFoundError('Photo introuvable.');
      case 'ASSIGNMENT_INACTIVE_FOR_START':
        throw new BadRequestError("L'affectation n'est plus active; cette intervention ne peut pas démarrer.");
      case 'ASSIGNMENT_INACTIVE_FOR_FINISH':
        throw new BadRequestError("L'affectation n'est plus active; cette intervention ne peut pas être terminée.");
      case 'INTERVENTION_NOT_SCHEDULED':
        throw new BadRequestError('Seule une intervention programmée peut démarrer.');
      case 'INTERVENTION_NOT_STARTED':
        throw new BadRequestError("L'intervention doit être démarrée avant l'enregistrement du compte-rendu.");
      case 'REPORT_REQUIRED':
        throw new BadRequestError("Le résultat de l'intervention est obligatoire pour clôturer la mission (Test T11 / RG37).");
      case 'REPORT_TOO_SHORT':
        throw new BadRequestError("Un compte-rendu d'au moins 10 caractères est obligatoire pour terminer l'intervention (Test T11 / RG37).");
      case 'EXCEPTION_REASON_REQUIRED':
        throw new BadRequestError('Un motif d’au moins 10 caractères est obligatoire pour tout résultat autre qu’un succès total.');
      case 'START_STATE_CHANGED':
        throw new BadRequestError("L'intervention a changé d'état et ne peut plus démarrer.");
      case 'FINISH_STATE_CHANGED':
        throw new BadRequestError("L'intervention a changé d'état et ne peut plus être terminée.");
      case 'PHOTO_REFERENCE_REQUIRED':
        throw new BadRequestError('La référence de photo est obligatoire.');
    }
  }

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
    const rows = await listInterventionMissions(repository, req.user!.idUtilisateur);
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
    try {
      await startIntervention(repository, id, req.user!.idUtilisateur);
      return { success: true, message: 'Intervention démarrée sur le terrain.' };
    } catch (error) {
      rethrowInterventionError(error);
    }
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
            enum: Object.values(ResultatIntervention),
            description: 'Résultat technique de la mission',
          },
          compteRendu: { type: 'string', description: 'Compte-rendu d intervention obligatoire (min 10 car.)' },
          motifException: { type: 'string', minLength: 10, description: 'Motif obligatoire pour tout résultat autre qu’un succès total' },
        },
        if: {
          properties: {
            resultatIntervention: { const: ResultatIntervention.SUCCES_TOTAL },
          },
        },
        then: {},
        else: { required: ['motifException'] },
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

    try {
      await finishIntervention(repository, id, req.user!.idUtilisateur, {
        resultatIntervention,
        compteRendu,
        motifException,
      });
    } catch (error) {
      rethrowInterventionError(error);
    }

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

    let photo: { idPhoto: string; referencePhoto: string };
    try {
      photo = await addInterventionPhoto(repository, id, req.user!.idUtilisateur, {
        referencePhoto,
        contextePhoto,
        description,
      });
    } catch (error) {
      rethrowInterventionError(error);
    }

    return reply.status(201).send({
      success: true,
      idPhoto: photo.idPhoto,
      referencePhoto: photo.referencePhoto,
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
    if (!req.isMultipart()) {
      throw new BadRequestError('Le fichier doit être transmis au format multipart/form-data.');
    }

    const part = await req.file();
    if (!part) throw new BadRequestError('Une photo est obligatoire.');

    let uploaded: { idPhoto: string };
    try {
      uploaded = await uploadPrivateInterventionPhoto(
        repository,
        photoStorage,
        id,
        req.user!.idUtilisateur,
        part,
        (error) => req.log.error(error, 'Échec du nettoyage après une erreur de sauvegarde de photo'),
      );
    } catch (error) {
      rethrowInterventionError(error);
    }

    return reply.status(201).send({
      success: true,
      idPhoto: uploaded.idPhoto,
      referencePhoto: `/api/interventions/${id}/photos/${uploaded.idPhoto}/contenu`,
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
    let image: { mimeType: string; content: Buffer };
    try {
      image = await getPrivateInterventionPhoto(
        repository,
        photoStorage,
        id,
        photoId,
        req.user!.idUtilisateur,
        req.user!.roles.includes(RoleCode.TERRAIN),
      );
    } catch (error) {
      rethrowInterventionError(error);
    }

    return reply
      .type(image.mimeType)
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .send(image.content);
  });
};
