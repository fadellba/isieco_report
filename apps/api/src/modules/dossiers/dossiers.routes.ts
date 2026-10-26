import { FastifyPluginAsync } from 'fastify';
import { RoleCode, PrioriteDossier, StatutSignalement, TypeRattachement } from '@isieco/shared';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors.js';
import { DossierRuleError } from '../../domain/dossiers.js';
import {
  addDossierCategory,
  attachReport,
  correctReportAttachment,
  createDossier,
  getDossierDetails,
  listAttachableReports,
  listDossiers,
  recordExternalTransfer,
  removeDossierCategory,
  updateDossierLocation,
  updateDossierPriority,
} from '../../application/use-cases/dossiers.js';

export const dossiersRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = fastify.dependencies.dossiers;
  const allowedManagers = [RoleCode.TRAITEMENT, RoleCode.AFFECTATION];
  const allowedDossierReaders = [...allowedManagers, RoleCode.VERIFICATION];

  async function runDossierUseCase<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    } catch (error) {
      if (!(error instanceof DossierRuleError)) throw error;
      if (error.rule === 'NOT_FOUND') throw new NotFoundError(error.message);
      if (error.rule === 'INVALID_STATE') throw new ConflictError(error.message);
      throw new BadRequestError(error.message);
    }
  }

  function dossierMutationResponse(
    result: 'UPDATED' | 'NOT_FOUND' | 'INVALID_STATE' | 'UNCHANGED',
    message: string,
  ) {
    if (result === 'NOT_FOUND') throw new NotFoundError('Dossier introuvable.');
    if (result === 'INVALID_STATE') {
      throw new ConflictError('Le dossier a été modifié simultanément ; recommencez après vérification.');
    }
    return { success: true, changed: result === 'UPDATED', message };
  }

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
    const data = await runDossierUseCase(listDossiers(repository, query));
    return { success: true, count: data.length, data };
  });

  fastify.get('/signalements-rattachables', {
    preHandler: [fastify.authorize(allowedManagers)],
    schema: {
      tags: ['Dossiers'],
      summary: 'Liste les signalements acceptés et localisés pouvant être rattachés',
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
                  idSignalement: { type: 'string', format: 'uuid' },
                  description: { type: 'string' },
                  dateSoumission: { type: 'string' },
                  latitude: { type: 'number', nullable: true },
                  longitude: { type: 'number', nullable: true },
                  descriptionLocalisation: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
  }, async () => {
    const data = await runDossierUseCase(listAttachableReports(repository));
    return { success: true, count: data.length, data };
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
                motifAjout: { type: 'string', minLength: 10 },
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
    const input = req.body as {
      referenceDossier?: string;
      descriptionSynthese: string;
      priorite?: PrioriteDossier;
      latitude?: number | null;
      longitude?: number | null;
      descriptionLocalisation?: string | null;
      categories: Array<{ idTypeDechet: string; motifAjout: string; quantiteEstimee?: string; volumeEstime?: string; niveauRisque?: string }>;
    };
    const result = await runDossierUseCase(createDossier(repository, { ...input, actorId: req.user!.idUtilisateur }));
    return reply.status(201).send({
      success: true,
      ...result,
      message: 'Dossier créé et volets techniques initialisés avec succès.',
    });
  });

  fastify.patch('/:id/priorite', {
    preHandler: [fastify.authorize(allowedManagers)],
    schema: {
      tags: ['Dossiers'],
      summary: 'Modifier la priorité d’un dossier avec justification',
      description: 'Enregistre atomiquement la nouvelle priorité, son historique et l’événement métier correspondant.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['priorite', 'justification'],
        properties: {
          priorite: { type: 'string', enum: Object.values(PrioriteDossier) },
          justification: { type: 'string', minLength: 10 },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const input = req.body as { priorite: PrioriteDossier; justification: string };
    const result = await runDossierUseCase(updateDossierPriority(repository, {
      dossierId: id,
      priority: input.priorite,
      justification: input.justification,
      actorId: req.user!.idUtilisateur,
    }));
    return dossierMutationResponse(result, 'La priorité du dossier a été mise à jour.');
  });

  fastify.patch('/:id/localisation', {
    preHandler: [fastify.authorize(allowedManagers)],
    schema: {
      tags: ['Dossiers'],
      summary: 'Corriger la localisation d’un dossier avec motif',
      description: 'Remplace la localisation, conserve son historique et enregistre les valeurs avant/après dans le journal métier.',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['latitude', 'longitude', 'descriptionLocalisation', 'motif'],
        properties: {
          latitude: { type: 'number', minimum: -90, maximum: 90, nullable: true },
          longitude: { type: 'number', minimum: -180, maximum: 180, nullable: true },
          descriptionLocalisation: { type: 'string', nullable: true },
          motif: { type: 'string', minLength: 10 },
        },
      },
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const input = req.body as {
      latitude: number | null;
      longitude: number | null;
      descriptionLocalisation: string | null;
      motif: string;
    };
    const result = await runDossierUseCase(updateDossierLocation(repository, {
      dossierId: id,
      latitude: input.latitude,
      longitude: input.longitude,
      description: input.descriptionLocalisation,
      reason: input.motif,
      actorId: req.user!.idUtilisateur,
    }));
    return dossierMutationResponse(result, 'La localisation du dossier a été mise à jour.');
  });

  // Rattachement d'un signalement à un dossier (UC04 / Test T03 / Test T04 / Test T26)
  fastify.post('/:id/rattacher', {
    preHandler: [fastify.authorize(allowedManagers)],
    schema: {
      tags: ['Dossiers'],
      summary: 'Rattacher un signalement citoyen à un dossier (UC04 / Test T03 / T04 / T26)',
      description: 'Rattache un signalement accepté au dossier, passe son statut à RATTACHE et conserve la provenance de ses catégories qualifiées concordantes.',
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
          typeRattachement: { type: 'string', enum: Object.values(TypeRattachement), default: TypeRattachement.PRINCIPAL },
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
    const body = req.body as {
      idSignalement: string;
      typeRattachement?: TypeRattachement;
      motif?: string;
    };
    const result = await runDossierUseCase(attachReport(repository, {
      dossierId: id,
      reportId: body.idSignalement,
      type: body.typeRattachement,
      reason: body.motif,
      actorId: req.user!.idUtilisateur,
    }));
    return {
      success: true,
      idRattachement: result.attachmentId,
      idSignalement: result.reportId,
      idDossier: result.dossierId,
      statutSignalement: StatutSignalement.RATTACHE,
      message: 'Signalement rattach? au dossier avec succ?s.',
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
    const body = req.body as { idSignalement: string; nouveauIdDossier: string; motif: string };
    const result = await runDossierUseCase(correctReportAttachment(repository, {
      dossierId: id,
      reportId: body.idSignalement,
      newDossierId: body.nouveauIdDossier,
      reason: body.motif,
      actorId: req.user!.idUtilisateur,
    }));
    return {
      success: true,
      message: "Rattachement corrigé et tracé avec succès sans suppression d'historique.",
      ancienDossier: id,
      nouveauDossier: body.nouveauIdDossier,
      correlationId: result.correlationId,
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
          motifAjout: { type: 'string', minLength: 10 },
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
    const body = req.body as {
      idTypeDechet: string;
      motifAjout: string;
      quantiteEstimee?: string;
      volumeEstime?: string;
      niveauRisque?: string;
      remarque?: string;
    };
    await runDossierUseCase(addDossierCategory(repository, {
      dossierId: id,
      typeId: body.idTypeDechet,
      motifAjout: body.motifAjout,
      quantiteEstimee: body.quantiteEstimee,
      volumeEstime: body.volumeEstime,
      niveauRisque: body.niveauRisque,
      remarque: body.remarque,
      actorId: req.user!.idUtilisateur,
    }));
    return reply.status(201).send({
      success: true,
      idDossier: id,
      idTypeDechet: body.idTypeDechet,
      message: 'Volet technique ajout? au dossier avec succ?s.',
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
    await runDossierUseCase(removeDossierCategory(repository, {
      dossierId: id,
      typeId: idTypeDechet,
      reason: motif,
      actorId: req.user!.idUtilisateur,
    }));
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
    await runDossierUseCase(recordExternalTransfer(repository, {
      dossierId: id,
      recipient: destinataireExterne,
      reason: motif,
      actorId: req.user!.idUtilisateur,
    }));
    return {
      success: true,
      message: 'Transfert externe vers "' + destinataireExterne.trim() + '" enregistr? et trac? au dossier.',
    };
  });

  // Détails complets d'un dossier
  fastify.get('/:id', {
    preHandler: [fastify.authorize(allowedDossierReaders)],
    schema: {
      tags: ['Dossiers'],
      summary: 'Consultation détaillée d un dossier opérationnel',
      description: 'Retourne la fiche complète du dossier, ses affectations et les historiques de priorité et de localisation.',
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
                date_reouverture: { type: 'string', nullable: true },
                nom_createur: { type: 'string' },
                historique_priorites: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      priorite: { type: 'string' },
                      dateDefinition: { type: 'string' },
                      justification: { type: 'string' },
                      definiPar: { type: 'string', format: 'uuid' },
                    },
                  },
                },
                historique_localisations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      latitude: { type: 'number', nullable: true },
                      longitude: { type: 'number', nullable: true },
                      precisionLocalisation: { type: 'number', nullable: true },
                      descriptionLocalisation: { type: 'string', nullable: true },
                      dateModification: { type: 'string' },
                      motif: { type: 'string', nullable: true },
                      modifiePar: { type: 'string', format: 'uuid' },
                    },
                  },
                },
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
    return { success: true, data: await runDossierUseCase(getDossierDetails(repository, id)) };
  });
};
