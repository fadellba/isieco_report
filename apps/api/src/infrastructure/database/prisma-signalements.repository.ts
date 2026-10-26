import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import {
  CreateSignalementInput,
  SignalementIdempotencyConflictError,
  SignalementDetail,
  SignalementSummary,
} from '../../domain/signalements.js';
import { SignalementsRepository } from '../../application/ports/signalements-repository.js';

export class PrismaSignalementsRepository implements SignalementsRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(
    input: CreateSignalementInput,
    idSignalement: string,
    idempotency?: { key: string; requestHash: string },
  ): Promise<string> {
    try {
      return await this.client.$transaction(async (trx) => {
        if (idempotency) {
          const existing = await trx.idempotenceSignalement.findUnique({
            where: {
              idUtilisateur_cleIdempotence: {
                idUtilisateur: input.idUtilisateur,
                cleIdempotence: idempotency.key,
              },
            },
            select: { empreinteRequete: true, idSignalement: true },
          });
          if (existing) {
            if (existing.empreinteRequete !== idempotency.requestHash) {
              throw new SignalementIdempotencyConflictError();
            }
            return existing.idSignalement;
          }
        }

        await trx.signalement.create({
          data: {
            idSignalement,
            idUtilisateur: input.idUtilisateur,
            dateConstat: input.dateConstat ? new Date(input.dateConstat) : null,
            description: input.description,
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            precisionLocalisation: input.precisionLocalisation ?? null,
            descriptionLocalisation: input.descriptionLocalisation,
            statutSignalement: 'SOUMIS',
            contenuSignalement: {
              create: input.categories.map((category) => ({
                idTypeDechet: category.idTypeDechet,
                quantiteEstimee: category.quantiteEstimee || null,
                volumeEstime: category.volumeEstime || null,
                remarque: category.remarque || null,
              })),
            },
          },
        });
        await trx.evenementMetier.create({
          data: {
            typeEvenement: 'SIGNALEMENT_RECU',
            dateEvenement: new Date(),
            origine: input.clientType === 'MOBILE' ? 'INTERFACE_CITOYEN' : 'PORTAIL_GESTION',
            idActeur: input.idUtilisateur,
            idSignalementCible: idSignalement,
            donneesApres: {
              description: input.description,
              latitude: input.latitude,
              longitude: input.longitude,
              categoriesCount: input.categories.length,
            },
            motif: 'Soumission initiale par le citoyen',
          },
        });
        await trx.notification.create({
          data: {
            idUtilisateur: input.idUtilisateur,
            titre: 'Signalement enregistré',
            message: "Votre signalement a bien été reçu et sera examiné par l'équipe de qualification.",
            lienCible: `/signalements/${idSignalement}`,
          },
        });
        if (idempotency) {
          await trx.idempotenceSignalement.create({
            data: {
              idUtilisateur: input.idUtilisateur,
              cleIdempotence: idempotency.key,
              empreinteRequete: idempotency.requestHash,
              idSignalement,
            },
          });
        }
        return idSignalement;
      });
    } catch (error) {
      if (
        !idempotency ||
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }

      const existing = await this.client.idempotenceSignalement.findUnique({
        where: {
          idUtilisateur_cleIdempotence: {
            idUtilisateur: input.idUtilisateur,
            cleIdempotence: idempotency.key,
          },
        },
        select: { empreinteRequete: true, idSignalement: true },
      });
      if (!existing) throw error;
      if (existing.empreinteRequete !== idempotency.requestHash) {
        throw new SignalementIdempotencyConflictError();
      }
      return existing.idSignalement;
    }
  }

  async listByUser(idUtilisateur: string): Promise<SignalementSummary[]> {
    const rows = await this.client.signalement.findMany({
      where: { idUtilisateur },
      orderBy: { dateSoumission: 'desc' },
      select: {
        idSignalement: true,
        dateConstat: true,
        dateSoumission: true,
        description: true,
        latitude: true,
        longitude: true,
        descriptionLocalisation: true,
        statutSignalement: true,
      },
    });
    return rows.map((row) => ({
      ...row,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
    }));
  }

  async findDetail(idSignalement: string): Promise<SignalementDetail | null> {
    const row = await this.client.signalement.findUnique({
      where: { idSignalement },
      select: {
        idSignalement: true,
        idUtilisateur: true,
        dateConstat: true,
        dateSoumission: true,
        description: true,
        latitude: true,
        longitude: true,
        precisionLocalisation: true,
        descriptionLocalisation: true,
        statutSignalement: true,
        utilisateurSignalementIdUtilisateurToutilisateur: { select: { nom: true, prenom: true } },
        contenuSignalement: {
          select: {
            idTypeDechet: true,
            quantiteEstimee: true,
            volumeEstime: true,
            remarque: true,
            typeDechet: { select: { codeType: true, libelle: true } },
          },
        },
        photoSignalement: {
          select: {
            idPhotoSignalement: true,
            referencePhoto: true,
            description: true,
            dateAjout: true,
          },
        },
        demandeComplement: {
          orderBy: { dateDemande: 'asc' },
          select: {
            idDemande: true,
            motif: true,
            dateDemande: true,
            etatDemande: true,
            reponse: {
              select: {
                contenu: true,
                dateReponse: true,
              },
            },
          },
        },
      },
    });
    if (!row) return null;
    return {
      idSignalement: row.idSignalement,
      idUtilisateur: row.idUtilisateur,
      declarant: `${row.utilisateurSignalementIdUtilisateurToutilisateur.prenom || ''} ${row.utilisateurSignalementIdUtilisateurToutilisateur.nom}`.trim(),
      dateConstat: row.dateConstat,
      dateSoumission: row.dateSoumission,
      description: row.description,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      precisionLocalisation: row.precisionLocalisation === null ? null : Number(row.precisionLocalisation),
      descriptionLocalisation: row.descriptionLocalisation,
      statutSignalement: row.statutSignalement,
      categories: row.contenuSignalement.map((category) => ({
        idTypeDechet: category.idTypeDechet,
        codeType: category.typeDechet.codeType,
        libelle: category.typeDechet.libelle,
        quantiteEstimee: category.quantiteEstimee,
        volumeEstime: category.volumeEstime,
        remarque: category.remarque,
      })),
      photos: row.photoSignalement.map((photo) => ({
        idPhoto: photo.idPhotoSignalement,
        referencePhoto: photo.referencePhoto,
        description: photo.description,
        dateAjout: photo.dateAjout,
      })),
      complements: row.demandeComplement.map((demande) => ({
        idDemande: demande.idDemande,
        motif: demande.motif,
        dateDemande: demande.dateDemande,
        etatDemande: demande.etatDemande,
        reponse: demande.reponse
          ? {
              contenu: demande.reponse.contenu,
              dateReponse: demande.reponse.dateReponse,
            }
          : null,
      })),
    };
  }

  async findOwner(idSignalement: string): Promise<string | null> {
    const row = await this.client.signalement.findUnique({
      where: { idSignalement },
      select: { idUtilisateur: true },
    });
    return row?.idUtilisateur ?? null;
  }

  async createPhoto(input: {
    idPhoto: string;
    idSignalement: string;
    referencePhoto: string;
    description: string | null;
  }): Promise<void> {
    await this.client.photoSignalement.create({
      data: {
        idPhotoSignalement: input.idPhoto,
        idSignalement: input.idSignalement,
        referencePhoto: input.referencePhoto,
        description: input.description,
        mediaStockeeLocale: true,
      },
    });
  }

  async findPhoto(idSignalement: string, idPhoto: string): Promise<string | null> {
    const row = await this.client.photoSignalement.findFirst({
      where: { idPhotoSignalement: idPhoto, idSignalement, dateExpiration: { gt: new Date() } },
      select: { referencePhoto: true },
    });
    return row?.referencePhoto ?? null;
  }

  async findCandidates(
    idSignalement: string,
  ): Promise<{
    target: { latitude: number; longitude: number } | null;
    others: Array<{
      idSignalement: string;
      description: string | null;
      dateSoumission: Date | null;
      statutSignalement: string;
      latitude: number;
      longitude: number;
    }>;
  } | null> {
    const target = await this.client.signalement.findUnique({
      where: { idSignalement },
      select: { latitude: true, longitude: true },
    });
    if (!target) return null;
    if (target.latitude == null || target.longitude == null) return { target: null, others: [] };
    const others = await this.client.signalement.findMany({
      where: {
        idSignalement: { not: idSignalement },
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        idSignalement: true,
        description: true,
        dateSoumission: true,
        statutSignalement: true,
        latitude: true,
        longitude: true,
      },
    });
    return {
      target: { latitude: Number(target.latitude), longitude: Number(target.longitude) },
      others: others.map((row) => ({
        idSignalement: row.idSignalement,
        description: row.description,
        dateSoumission: row.dateSoumission,
        statutSignalement: row.statutSignalement,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      })),
    };
  }
}
