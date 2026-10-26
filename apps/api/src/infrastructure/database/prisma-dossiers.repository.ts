import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { EtatPriseEnCharge } from '@isieco/shared';
import { formaterQuantiteEstimee, normaliserQuantiteEstimee } from '../../domain/quantite-estimee.js';
import { recalculerStatutDossier } from './dossier-status.js';
import {
  CreateDossierCommand,
  DossierAuditEvent,
  DossierDetails,
  DossierListItem,
  AttachableReport,
  DossierCategoryCommand,
  DossierListFilters,
  DossiersRepository,
  DossiersUnitOfWork,
  ReportLocation,
} from '../../application/ports/dossiers-repository.js';

export class PrismaDossiersRepository implements DossiersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(filters: DossierListFilters): Promise<DossierListItem[]> {
    const rows = await this.prisma.dossierTraitement.findMany({
      where: {
        ...(filters.statut ? { statutDossier: filters.statut } : {}),
        ...(filters.priorite ? { priorite: filters.priorite } : {}),
      },
      orderBy: { dateCreationDossier: 'desc' },
      include: {
        utilisateur: { select: { nom: true } },
        contenuDossier: { where: { etatContenuDossier: 'INCLUSE' }, select: { idTypeDechet: true } },
        rattachementSignalement: { where: { dateFinRattachement: null }, select: { idRattachement: true } },
      },
    });
    return rows.map((dossier) => ({
      idDossier: dossier.idDossier,
      referenceDossier: dossier.referenceDossier,
      descriptionSynthese: dossier.descriptionSynthese,
      dateCreationDossier: dossier.dateCreationDossier,
      statutDossier: dossier.statutDossier,
      priorite: dossier.priorite,
      latitude: dossier.latitude === null ? null : Number(dossier.latitude),
      longitude: dossier.longitude === null ? null : Number(dossier.longitude),
      dateCloture: dossier.dateCloture,
      nomCreateur: dossier.utilisateur.nom,
      nbVoletsInclus: dossier.contenuDossier.length,
      nbSignalementsRattaches: dossier.rattachementSignalement.length,
    }));
  }

  async listAttachableReports(): Promise<AttachableReport[]> {
    const rows = await this.prisma.signalement.findMany({
      where: {
        statutSignalement: 'ACCEPTE_POUR_RATTACHEMENT',
        rattachementSignalement: { none: { dateFinRattachement: null } },
      },
      select: {
        idSignalement: true,
        description: true,
        dateSoumission: true,
        latitude: true,
        longitude: true,
        descriptionLocalisation: true,
      },
      orderBy: { dateSoumission: 'desc' },
    });
    return rows
      .filter((signalement) =>
        (signalement.latitude !== null && signalement.longitude !== null) ||
        Boolean(signalement.descriptionLocalisation?.trim())
      )
      .map((signalement) => ({
        ...signalement,
        latitude: signalement.latitude === null ? null : Number(signalement.latitude),
        longitude: signalement.longitude === null ? null : Number(signalement.longitude),
      }));
  }

  async create(input: CreateDossierCommand): Promise<void> {
    await this.prisma.$transaction(async (trx) => {
      await trx.dossierTraitement.create({
        data: {
          idDossier: input.idDossier,
          referenceDossier: input.referenceDossier,
          descriptionSynthese: input.descriptionSynthese,
          statutDossier: 'EN_ATTENTE_AFFECTATION',
          priorite: input.priorite,
          latitude: input.latitude,
          longitude: input.longitude,
          descriptionLocalisation: input.descriptionLocalisation,
          creePar: input.actorId,
          contenuDossier: {
            create: input.categories.map((category) => ({
              idTypeDechet: category.idTypeDechet,
              ...toPersistedQuantite(category.quantiteEstimee),
              volumeEstime: category.volumeEstime || null,
              niveauRisqueQualifie: category.niveauRisque || 'MOYEN',
              qualifiePar: input.actorId,
              dateQualification: new Date(),
              origineAjout: category.origineAjout,
              motifAjout: category.motifAjout?.trim() || null,
              etatContenuDossier: 'INCLUSE',
              etatPriseEnCharge: EtatPriseEnCharge.A_AFFECTER,
            })),
          },
          evenementMetier: {
            create: {
              idEvenement: input.eventId,
              typeEvenement: 'DOSSIER_CREE',
              origine: 'PORTAIL_GESTION',
              idActeur: input.actorId,
              donneesApres: {
                referenceDossier: input.referenceDossier,
                priorite: input.priorite,
                volets: input.categories.length,
              },
              motif: 'Création du dossier opérationnel',
            },
          },
        },
      });
      await trx.historiquePrioriteDossier.create({
        data: {
          idDossier: input.idDossier,
          priorite: input.priorite,
          definiePar: input.actorId,
          justification: 'Priorité initiale définie lors de la création du dossier.',
        },
      });
      await recalculerStatutDossier(trx, input.idDossier);
      if (input.latitude !== null || input.descriptionLocalisation !== null) {
        await trx.historiqueLocalisationDossier.create({
          data: {
            idDossier: input.idDossier,
            latitude: input.latitude,
            longitude: input.longitude,
            descriptionLocalisation: input.descriptionLocalisation,
            modifiePar: input.actorId,
            motif: 'Localisation initiale définie lors de la création du dossier.',
          },
        });
      }
    });
  }

  async updatePriority(input: Parameters<DossiersRepository['updatePriority']>[0]): Promise<
    'UPDATED' | 'NOT_FOUND' | 'INVALID_STATE' | 'UNCHANGED'
  > {
    return this.prisma.$transaction(async (trx) => {
      const dossier = await trx.dossierTraitement.findUnique({
        where: { idDossier: input.dossierId },
        select: { priorite: true },
      });
      if (!dossier) return 'NOT_FOUND';
      if (dossier.priorite === input.priority) return 'UNCHANGED';

      const update = await trx.dossierTraitement.updateMany({
        where: { idDossier: input.dossierId, priorite: dossier.priorite },
        data: { priorite: input.priority },
      });
      if (update.count !== 1) return 'INVALID_STATE';

      await trx.historiquePrioriteDossier.create({
        data: {
          idDossier: input.dossierId,
          priorite: input.priority,
          definiePar: input.actorId,
          justification: input.justification,
        },
      });
      await trx.evenementMetier.create({
        data: {
          idEvenement: input.eventId,
          typeEvenement: 'DOSSIER_PRIORITE_MODIFIEE',
          origine: 'PORTAIL_GESTION',
          idActeur: input.actorId,
          idDossierCible: input.dossierId,
          donneesAvant: { priorite: dossier.priorite },
          donneesApres: { priorite: input.priority },
          motif: input.justification,
        },
      });
      return 'UPDATED';
    });
  }

  async updateLocation(input: Parameters<DossiersRepository['updateLocation']>[0]): Promise<
    'UPDATED' | 'NOT_FOUND' | 'INVALID_STATE' | 'UNCHANGED'
  > {
    return this.prisma.$transaction(async (trx) => {
      const dossier = await trx.dossierTraitement.findUnique({
        where: { idDossier: input.dossierId },
        select: {
          idCommune: true,
          latitude: true,
          longitude: true,
          precisionLocalisation: true,
          descriptionLocalisation: true,
        },
      });
      if (!dossier) return 'NOT_FOUND';
      const currentLatitude = dossier.latitude === null ? null : Number(dossier.latitude);
      const currentLongitude = dossier.longitude === null ? null : Number(dossier.longitude);
      if (
        currentLatitude === input.latitude &&
        currentLongitude === input.longitude &&
        dossier.descriptionLocalisation === input.description
      ) {
        return 'UNCHANGED';
      }

      const update = await trx.dossierTraitement.updateMany({
        where: {
          idDossier: input.dossierId,
          idCommune: dossier.idCommune,
          latitude: dossier.latitude,
          longitude: dossier.longitude,
          precisionLocalisation: dossier.precisionLocalisation,
          descriptionLocalisation: dossier.descriptionLocalisation,
        },
        data: {
          latitude: input.latitude,
          longitude: input.longitude,
          descriptionLocalisation: input.description,
        },
      });
      if (update.count !== 1) return 'INVALID_STATE';

      await trx.historiqueLocalisationDossier.create({
        data: {
          idDossier: input.dossierId,
          idCommune: dossier.idCommune,
          latitude: input.latitude,
          longitude: input.longitude,
          precisionLocalisation: dossier.precisionLocalisation,
          descriptionLocalisation: input.description,
          modifiePar: input.actorId,
          motif: input.reason,
        },
      });
      await trx.evenementMetier.create({
        data: {
          idEvenement: input.eventId,
          typeEvenement: 'DOSSIER_LOCALISATION_MODIFIEE',
          origine: 'PORTAIL_GESTION',
          idActeur: input.actorId,
          idDossierCible: input.dossierId,
          donneesAvant: {
            idCommune: dossier.idCommune,
            latitude: currentLatitude,
            longitude: currentLongitude,
            precisionLocalisation: dossier.precisionLocalisation,
            descriptionLocalisation: dossier.descriptionLocalisation,
          },
          donneesApres: {
            idCommune: dossier.idCommune,
            latitude: input.latitude,
            longitude: input.longitude,
            precisionLocalisation: dossier.precisionLocalisation,
            descriptionLocalisation: input.description,
          },
          motif: input.reason,
        },
      });
      return 'UPDATED';
    });
  }

  async transaction<T>(work: (unit: DossiersUnitOfWork) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((trx) => work({
      findDossierStatus: async (dossierId) => {
        const dossier = await trx.dossierTraitement.findUnique({
          where: { idDossier: dossierId },
          select: { statutDossier: true },
        });
        return dossier?.statutDossier ?? null;
      },
      findDossierLocation: async (dossierId) => {
        const dossier = await trx.dossierTraitement.findUnique({
          where: { idDossier: dossierId },
          select: { latitude: true, longitude: true, descriptionLocalisation: true },
        });
        return dossier
          ? {
              latitude: dossier.latitude === null ? null : Number(dossier.latitude),
              longitude: dossier.longitude === null ? null : Number(dossier.longitude),
              descriptionLocalisation: dossier.descriptionLocalisation,
            }
          : null;
      },
      findReportForAttachment: (reportId) => trx.signalement.findUnique({
        where: { idSignalement: reportId },
        select: {
          idUtilisateur: true,
          statutSignalement: true,
          latitude: true,
          longitude: true,
          descriptionLocalisation: true,
        },
      }).then((report) => report ? {
        idUtilisateur: report.idUtilisateur,
        statutSignalement: report.statutSignalement,
        latitude: report.latitude === null ? null : Number(report.latitude),
        longitude: report.longitude === null ? null : Number(report.longitude),
        descriptionLocalisation: report.descriptionLocalisation,
      } : null),
      findActiveAttachment: async (reportId, dossierId) => trx.rattachementSignalement.findFirst({
        where: {
          idSignalement: reportId,
          dateFinRattachement: null,
          ...(dossierId ? { idDossier: dossierId } : {}),
        },
        select: { idRattachement: true },
      }),
      createAttachment: async (input) => {
        await trx.rattachementSignalement.create({
          data: {
            idRattachement: input.attachmentId,
            idSignalement: input.reportId,
            idDossier: input.dossierId,
            typeRattachement: input.type,
            motif: input.reason,
            idActeur: input.actorId,
          },
        });
      },
      updateDossierLocationIfEmpty: async (dossierId, expectedDescription, location) => {
        await trx.dossierTraitement.updateMany({
          where: {
            idDossier: dossierId,
            latitude: null,
            longitude: null,
            descriptionLocalisation: expectedDescription,
          },
          data: {
            latitude: location.latitude,
            longitude: location.longitude,
            descriptionLocalisation: location.descriptionLocalisation,
          },
        });
      },
      markReportAttached: async (reportId) => {
        const result = await trx.signalement.updateMany({
          where: {
            idSignalement: reportId,
            statutSignalement: 'ACCEPTE_POUR_RATTACHEMENT',
          },
          data: { statutSignalement: 'RATTACHE' },
        });
        return result.count === 1;
      },
      createCategoryProvenance: async (input) => {
        const qualifications = await trx.qualificationSignalement.findMany({
          where: {
            idSignalement: input.reportId,
            etatQualification: 'ACTIVE',
          },
          select: { idQualification: true, idTypeDechet: true },
        });
        if (qualifications.length === 0) return;
        const contenuDossier = await trx.contenuDossier.findMany({
          where: {
            idDossier: input.dossierId,
            idTypeDechet: { in: qualifications.map((qualification) => qualification.idTypeDechet) },
            etatContenuDossier: 'INCLUSE',
          },
          select: { idTypeDechet: true },
        });
        const typesInclus = new Set(contenuDossier.map((contenu) => contenu.idTypeDechet));
        const provenance = qualifications
          .filter((qualification) => typesInclus.has(qualification.idTypeDechet))
          .map((qualification) => ({
            idDossier: input.dossierId,
            idTypeDechet: qualification.idTypeDechet,
            idSignalement: input.reportId,
            idRattachement: input.attachmentId,
            idQualification: qualification.idQualification,
            ajoutePar: input.actorId,
            motif: input.reason,
          }));
        if (provenance.length > 0) {
          await trx.provenanceContenuDossier.createMany({ data: provenance });
        }
      },
      compensateDuplicateReportPoints: async (reportId, reason) => {
        const attribution = await trx.historiquePoints.findFirst({
          where: { idSignalement: reportId, typeMouvement: 'ATTRIBUTION' },
          select: { idPoint: true, idUtilisateur: true, points: true },
        });
        if (!attribution) return;
        await trx.historiquePoints.createMany({
          data: [{
            idUtilisateur: attribution.idUtilisateur,
            idSignalement: reportId,
            points: -attribution.points,
            motif: reason,
            typeMouvement: 'COMPENSATION',
            idPointOrigine: attribution.idPoint,
          }],
          skipDuplicates: true,
        });
      },
      finishAttachment: async (attachmentId, reason) => {
        const dateFin = new Date();
        await trx.rattachementSignalement.update({
          where: { idRattachement: attachmentId },
          data: { dateFinRattachement: dateFin, motif: reason },
        });
        await trx.provenanceContenuDossier.updateMany({
          where: { idRattachement: attachmentId, dateFin: null },
          data: { dateFin, motif: reason },
        });
      },
      recordEvents: async (events: DossierAuditEvent[]) => {
        await trx.evenementMetier.createMany({
          data: events.map((event) => ({
            idEvenement: event.idEvenement,
            typeEvenement: event.typeEvenement,
            origine: 'PORTAIL_GESTION',
            idActeur: event.idActeur,
            idRattachementCible: event.idRattachementCible,
            correlationId: event.correlationId,
            idDossierContenuCible: event.idDossierContenuCible,
            idTypeDechetContenuCible: event.idTypeDechetContenuCible,
            motif: event.motif,
          })),
        });
      },
      createNotification: async (input) => {
        await trx.notification.create({
          data: {
            idNotification: input.notificationId,
            idUtilisateur: input.userId,
            titre: 'Signalement pris en charge',
            message: "Votre signalement a été relié au dossier d'intervention en cours de planification.",
            lienCible: `/signalements/${input.reportId}`,
          },
        });
      },
      createCategory: async (input: DossierCategoryCommand) => {
        await trx.contenuDossier.create({
          data: {
            idDossier: input.idDossier,
            idTypeDechet: input.idTypeDechet,
            ...toPersistedQuantite(input.quantiteEstimee),
            volumeEstime: input.volumeEstime || null,
            niveauRisqueQualifie: input.niveauRisque || 'MOYEN',
            remarque: input.remarque || null,
            qualifiePar: input.actorId,
            dateQualification: new Date(),
            origineAjout: input.origineAjout,
            motifAjout: input.motifAjout,
            etatContenuDossier: 'INCLUSE',
            etatPriseEnCharge: EtatPriseEnCharge.A_AFFECTER,
          },
        });
        await recalculerStatutDossier(trx, input.idDossier);
      },
      removeCategory: async (input) => {
        await trx.contenuDossier.update({
          where: { idDossier_idTypeDechet: { idDossier: input.dossierId, idTypeDechet: input.typeId } },
          data: {
            etatContenuDossier: 'RETIRE',
            dateRetrait: new Date(),
            retirePar: input.actorId,
            motifRetrait: input.reason,
          },
        });
        await recalculerStatutDossier(trx, input.dossierId);
      },
    }));
  }

  async dossierExists(dossierId: string) {
    return Boolean(await this.prisma.dossierTraitement.findUnique({
      where: { idDossier: dossierId },
      select: { idDossier: true },
    }));
  }

  async categoryExists(dossierId: string, typeId: string) {
    return Boolean(await this.prisma.contenuDossier.findUnique({
      where: { idDossier_idTypeDechet: { idDossier: dossierId, idTypeDechet: typeId } },
      select: { idTypeDechet: true },
    }));
  }

  async hasActiveAssignment(dossierId: string, typeId: string) {
    return Boolean(await this.prisma.affectation.findFirst({
      where: {
        contenuDossier: { is: { idDossier: dossierId, idTypeDechet: typeId } },
        dateFinAffectation: null,
      },
      select: { idAffectation: true },
    }));
  }

  async recordExternalTransfer(input: Parameters<DossiersRepository['recordExternalTransfer']>[0]): Promise<void> {
    await this.prisma.evenementMetier.create({
      data: {
        idEvenement: input.eventId,
        typeEvenement: 'TRANSFERT_EXTERNE',
        origine: 'PORTAIL_GESTION',
        idActeur: input.actorId,
        idDossierCible: input.dossierId,
        destinataireExterne: input.recipient,
        motif: input.reason,
      },
    });
  }

  async getDetails(dossierId: string): Promise<DossierDetails | null> {
    const [dossier, reopenEvent] = await Promise.all([
      this.prisma.dossierTraitement.findUnique({
        where: { idDossier: dossierId },
        include: {
          utilisateur: { select: { nom: true } },
          contenuDossier: { include: { typeDechet: { select: { codeType: true, libelle: true } } } },
          historiquePrioriteDossier: { orderBy: { dateDefinition: 'asc' } },
          historiqueLocalisationDossier: { orderBy: { dateModification: 'asc' } },
          rattachementSignalement: {
            include: {
              signalement: { select: { idSignalement: true, description: true, statutSignalement: true } },
            },
          },
        },
      }),
      this.prisma.evenementMetier.findFirst({
        where: { idDossierCible: dossierId, typeEvenement: 'DOSSIER_REOUVERT' },
        orderBy: { dateEnregistrement: 'desc' },
        select: { dateEnregistrement: true },
      }),
    ]);
    if (!dossier) return null;

    const assignments = await this.prisma.affectation.findMany({
      where: { contenuDossier: { is: { idDossier: dossierId } } },
      include: {
        equipe: { select: { nomEquipe: true } },
        contenuDossier: { include: { typeDechet: { select: { codeType: true } } } },
      },
      orderBy: { dateHeureAffectation: 'desc' },
    });
    return {
      id_dossier: dossier.idDossier,
      reference_dossier: dossier.referenceDossier,
      description_synthese: dossier.descriptionSynthese,
      date_creation_dossier: dossier.dateCreationDossier,
      statut_dossier: dossier.statutDossier,
      priorite: dossier.priorite,
      date_qualification: dossier.dateQualification,
      latitude: dossier.latitude === null ? null : Number(dossier.latitude),
      longitude: dossier.longitude === null ? null : Number(dossier.longitude),
      description_localisation: dossier.descriptionLocalisation,
      date_cloture: dossier.dateCloture,
      date_reouverture: reopenEvent?.dateEnregistrement ?? null,
      nom_createur: dossier.utilisateur.nom,
      historique_priorites: dossier.historiquePrioriteDossier.map((entry) => ({
        priorite: entry.priorite,
        dateDefinition: entry.dateDefinition,
        justification: entry.justification,
        definiPar: entry.definiePar,
      })),
      historique_localisations: dossier.historiqueLocalisationDossier.map((entry) => ({
        latitude: entry.latitude === null ? null : Number(entry.latitude),
        longitude: entry.longitude === null ? null : Number(entry.longitude),
        precisionLocalisation: entry.precisionLocalisation === null
          ? null
          : Number(entry.precisionLocalisation),
        descriptionLocalisation: entry.descriptionLocalisation,
        dateModification: entry.dateModification,
        motif: entry.motif,
        modifiePar: entry.modifiePar,
      })),
      volets: dossier.contenuDossier.map((category) => ({
        idTypeDechet: category.idTypeDechet,
        codeType: category.typeDechet.codeType,
        libelle: category.typeDechet.libelle,
        quantiteEstimee: formaterQuantiteEstimee(
          category.quantiteEstimee?.toString() ?? null,
          category.uniteQuantite,
          category.quantiteEstimeeLegacy,
        ),
        volumeEstime: category.volumeEstime,
        niveauRisque: category.niveauRisqueQualifie,
        origineAjout: category.origineAjout,
        motifAjout: category.motifAjout,
        etatContenuDossier: category.etatContenuDossier,
        dateRetrait: category.dateRetrait,
        motifRetrait: category.motifRetrait,
      })),
      signalements: dossier.rattachementSignalement
        .sort((a, b) => a.dateDebutRattachement.getTime() - b.dateDebutRattachement.getTime())
        .map((attachment) => ({
          idSignalement: attachment.signalement.idSignalement,
          description: attachment.signalement.description,
          statutSignalement: attachment.signalement.statutSignalement,
          dateRattachement: attachment.dateDebutRattachement,
          typeRattachement: attachment.typeRattachement,
          dateFinRattachement: attachment.dateFinRattachement,
        })),
      affectations: assignments.map((assignment) => ({
        idAffectation: assignment.idAffectation,
        idTypeDechet: assignment.idTypeDechet,
        codeType: assignment.contenuDossier.typeDechet.codeType,
        nomEquipe: assignment.equipe.nomEquipe,
        dateAffectation: assignment.dateHeureAffectation,
        etatAffectation: assignment.etatAffectation,
        dateFinAffectation: assignment.dateFinAffectation,
      })),
    };
  }
}

function toPersistedQuantite(value?: string) {
  const normalized = normaliserQuantiteEstimee(value);
  return {
    quantiteEstimee: normalized.quantiteEstimee === null
      ? null
      : new Prisma.Decimal(normalized.quantiteEstimee),
    uniteQuantite: normalized.uniteQuantite,
    quantiteEstimeeLegacy: normalized.quantiteEstimeeLegacy,
  };
}
