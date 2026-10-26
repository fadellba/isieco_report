import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import {
  PendingPhotoVariant,
  PendingPublication,
  PublicationPhotoSource,
  PublicationRuleError,
  PublicPublication,
} from '../../domain/publications.js';
import { PublicationsRepository } from '../../application/ports/publications-repository.js';

export class PrismaPublicationsRepository implements PublicationsRepository {
  constructor(private readonly client: PrismaClient) {}

  async submit(input: Parameters<PublicationsRepository['submit']>[0]): Promise<string> {
    try {
      return await this.client.$transaction(async (transaction) => {
        if (input.target.type === 'SIGNALEMENT') {
          const signalement = await transaction.signalement.findUnique({
            where: { idSignalement: input.target.id },
            select: { statutSignalement: true },
          });
          if (!signalement) throw new PublicationRuleError('SOURCE_NOT_FOUND');
          if (!['ACCEPTE_POUR_RATTACHEMENT', 'RATTACHE'].includes(signalement.statutSignalement)) {
            throw new PublicationRuleError('SOURCE_NOT_READY');
          }

          const photos = await transaction.photoSignalement.findMany({
            where: {
              idPhotoSignalement: { in: input.photos.map((photo) => photo.id) },
              idSignalement: input.target.id,
              dateExpiration: { gt: new Date() },
              etatPublication: 'APPROUVEE',
              floutageConfirme: true,
              referencePhotoPublique: { not: null },
            },
            select: { idPhotoSignalement: true, approuvePar: true },
          });
          if (photos.length !== input.photos.length) {
            throw new PublicationRuleError('INVALID_PHOTOS');
          }
          if (photos.some((photo) => photo.approuvePar === input.actorId)) {
            throw new PublicationRuleError('INDEPENDENT_MODERATION_REQUIRED');
          }

          const publication = await transaction.publicationFlux.create({
            data: {
              idSignalement: input.target.id,
              creePar: input.actorId,
              photoPublication: {
                create: input.photos.map((photo) => ({
                  idPhotoSignalement: photo.id,
                  rolePhoto: photo.role,
                })),
              },
            },
            select: { idPublication: true },
          });
          return publication.idPublication;
        }

        const dossier = await transaction.dossierTraitement.findUnique({
          where: { idDossier: input.target.id },
          select: { statutDossier: true },
        });
        if (!dossier) throw new PublicationRuleError('SOURCE_NOT_FOUND');
        if (dossier.statutDossier !== 'CLOS_RESOLUTION_CONFIRMEE') {
          throw new PublicationRuleError('SOURCE_NOT_READY');
        }

        const sourcePhotos = await transaction.photoIntervention.findMany({
          where: {
            idPhotoIntervention: { in: input.photos.map((photo) => photo.id) },
            dateExpiration: { gt: new Date() },
            etatPublication: 'APPROUVEE',
            floutageConfirme: true,
            referencePhotoPublique: { not: null },
            intervention: {
              affectation: { idDossier: input.target.id },
            },
          },
          select: { idPhotoIntervention: true, contextePhoto: true, approuvePar: true },
        });
        if (
          sourcePhotos.length !== input.photos.length ||
          input.photos.some((photo) => {
            const source = sourcePhotos.find((row) => row.idPhotoIntervention === photo.id);
            return !source || (
              photo.role === 'AVANT'
                ? !['CONSTAT_INITIAL', 'DEBUT_INTERVENTION'].includes(source.contextePhoto)
                : source.contextePhoto !== 'FIN_INTERVENTION'
            );
          }) ||
          !input.photos.some((photo) => photo.role === 'AVANT') ||
          !input.photos.some((photo) => photo.role === 'APRES')
        ) {
          throw new PublicationRuleError('INVALID_PHOTOS');
        }
        if (sourcePhotos.some((photo) => photo.approuvePar === input.actorId)) {
          throw new PublicationRuleError('INDEPENDENT_MODERATION_REQUIRED');
        }

        const publication = await transaction.publicationFlux.create({
          data: {
            idDossier: input.target.id,
            creePar: input.actorId,
            photoPublication: {
              create: input.photos.map((photo) => ({
                idPhotoIntervention: photo.id,
                rolePhoto: photo.role,
              })),
            },
          },
          select: { idPublication: true },
        });
        return publication.idPublication;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new PublicationRuleError('DUPLICATE_PUBLICATION');
      }
      throw error;
    }
  }

  async decide(input: Parameters<PublicationsRepository['decide']>[0]): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const current = await transaction.publicationFlux.findUnique({
        where: { idPublication: input.publicationId },
        select: {
          creePar: true,
          etatPublication: true,
          photoPublication: {
            select: {
              photoSignalement: {
                select: {
                  etatPublication: true,
                  floutageConfirme: true,
                  referencePhotoPublique: true,
                  approuvePar: true,
                },
              },
              photoIntervention: {
                select: {
                  etatPublication: true,
                  floutageConfirme: true,
                  referencePhotoPublique: true,
                  approuvePar: true,
                },
              },
            },
          },
        },
      });
      if (!current) throw new PublicationRuleError('PUBLICATION_NOT_FOUND');
      if (current.creePar === input.actorId) {
        throw new PublicationRuleError('SELF_MODERATION');
      }
      if (input.decision === 'APPROUVEE') {
        if (
          current.photoPublication.length === 0 ||
          current.photoPublication.some((photo) => {
            const source = photo.photoSignalement ?? photo.photoIntervention;
            return !source ||
              source.etatPublication !== 'APPROUVEE' ||
              !source.floutageConfirme ||
              !source.referencePhotoPublique;
          })
        ) {
          throw new PublicationRuleError('INVALID_PHOTOS');
        }
        if (
          current.photoPublication.some((photo) =>
            photo.photoSignalement?.approuvePar === input.actorId ||
            photo.photoIntervention?.approuvePar === input.actorId,
          )
        ) {
          throw new PublicationRuleError('INDEPENDENT_MODERATION_REQUIRED');
        }
      }

      const allowed =
        (current.etatPublication === 'EN_ATTENTE' &&
          ['APPROUVEE', 'REFUSEE'].includes(input.decision)) ||
        (current.etatPublication === 'APPROUVEE' && input.decision === 'MASQUEE');
      if (!allowed) throw new PublicationRuleError('INVALID_TRANSITION');

      const result = await transaction.publicationFlux.updateMany({
        where: {
          idPublication: input.publicationId,
          etatPublication: current.etatPublication,
          creePar: { not: input.actorId },
        },
        data: {
          etatPublication: input.decision,
          approuvePar:
            input.decision === 'APPROUVEE'
              ? input.actorId
              : input.decision === 'REFUSEE'
                ? null
                : undefined,
          dateApprobation:
            input.decision === 'APPROUVEE'
              ? input.at
              : input.decision === 'REFUSEE'
                ? null
                : undefined,
          datePublication: input.decision === 'APPROUVEE' ? input.at : undefined,
          motifDecision: input.reason,
        },
      });
      if (result.count !== 1) throw new PublicationRuleError('INVALID_TRANSITION');
    });
  }

  async submitPhotoVariant(
    input: Parameters<PublicationsRepository['submitPhotoVariant']>[0],
  ): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const current = await this.findPhotoVariantContext(transaction, input.source, input.photoId);
      if (!current) throw new PublicationRuleError('PHOTO_VARIANT_NOT_FOUND');
      if (current.state === 'EN_ATTENTE') {
        throw new PublicationRuleError('PHOTO_VARIANT_ALREADY_PENDING');
      }
      if (current.state === 'APPROUVEE') {
        throw new PublicationRuleError('INVALID_TRANSITION');
      }

      const result = await this.updatePhotoVariant(transaction, input.source, input.photoId, {
        etatPublication: 'EN_ATTENTE',
        referencePhotoPublique: input.reference,
        floutageConfirme: false,
        varianteSoumisePar: input.submittedBy,
        dateSoumissionVariante: input.at,
        approuvePar: null,
        dateApprobation: null,
      }, current.state);
      if (result.count !== 1) throw new PublicationRuleError('INVALID_TRANSITION');

      await this.recordPhotoVariantEvent(transaction, {
        type: 'VARIANTE_PHOTO_SOUMISE',
        source: input.source,
        photoId: input.photoId,
        actorId: input.submittedBy,
        target: current.target,
        before: {
          etatPublication: current.state,
          referencePhotoPublique: current.reference,
        },
        after: {
          etatPublication: 'EN_ATTENTE',
          referencePhotoPublique: input.reference,
          controlesVisuelsAttestes: true,
        },
        reason: 'Soumission manuelle d’une copie publique dérivée.',
        at: input.at,
      });
      await this.requeueApprovedPublications(
        transaction,
        input.source,
        input.photoId,
        input.submittedBy,
        input.at,
      );
    });
  }

  async decidePhotoVariant(
    input: Parameters<PublicationsRepository['decidePhotoVariant']>[0],
  ): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const current = await this.findPhotoVariantContext(transaction, input.source, input.photoId);
      if (!current) throw new PublicationRuleError('PHOTO_VARIANT_NOT_FOUND');
      if (current.state !== 'EN_ATTENTE') {
        throw new PublicationRuleError('PHOTO_VARIANT_NOT_PENDING');
      }
      if (current.submittedBy === input.actorId) {
        throw new PublicationRuleError('PHOTO_VARIANT_SELF_MODERATION');
      }

      const result = await this.updatePhotoVariant(transaction, input.source, input.photoId, {
        etatPublication: input.decision,
        floutageConfirme: input.decision === 'APPROUVEE',
        approuvePar: input.decision === 'APPROUVEE' ? input.actorId : null,
        dateApprobation: input.decision === 'APPROUVEE' ? input.at : null,
      }, 'EN_ATTENTE', input.actorId);
      if (result.count !== 1) {
        throw new PublicationRuleError('PHOTO_VARIANT_NOT_PENDING');
      }

      await this.recordPhotoVariantEvent(transaction, {
        type: input.decision === 'APPROUVEE'
          ? 'VARIANTE_PHOTO_APPROUVEE'
          : 'VARIANTE_PHOTO_REFUSEE',
        source: input.source,
        photoId: input.photoId,
        actorId: input.actorId,
        target: current.target,
        before: {
          etatPublication: current.state,
          referencePhotoPublique: current.reference,
          soumisePar: current.submittedBy,
        },
        after: {
          etatPublication: input.decision,
          referencePhotoPublique: current.reference,
        },
        reason: input.reason ?? 'Contrôle visuel indépendant de la variante.',
        at: input.at,
      });
    });
  }

  async listPendingPhotoVariants(limit: number): Promise<PendingPhotoVariant[]> {
    const [signalementPhotos, interventionPhotos] = await Promise.all([
      this.client.photoSignalement.findMany({
        where: {
          etatPublication: 'EN_ATTENTE',
          dateExpiration: { gt: new Date() },
          varianteSoumisePar: { not: null },
          dateSoumissionVariante: { not: null },
        },
        orderBy: { dateSoumissionVariante: 'asc' },
        take: limit,
        select: {
          idPhotoSignalement: true,
          varianteSoumisePar: true,
          dateSoumissionVariante: true,
        },
      }),
      this.client.photoIntervention.findMany({
        where: {
          etatPublication: 'EN_ATTENTE',
          dateExpiration: { gt: new Date() },
          varianteSoumisePar: { not: null },
          dateSoumissionVariante: { not: null },
        },
        orderBy: { dateSoumissionVariante: 'asc' },
        take: limit,
        select: {
          idPhotoIntervention: true,
          varianteSoumisePar: true,
          dateSoumissionVariante: true,
        },
      }),
    ]);

    return [
      ...signalementPhotos.flatMap((photo) =>
        photo.varianteSoumisePar && photo.dateSoumissionVariante
          ? [{
              source: 'SIGNALEMENT' as const,
              photoId: photo.idPhotoSignalement,
              submittedBy: photo.varianteSoumisePar,
              submittedAt: photo.dateSoumissionVariante,
            }]
          : [],
      ),
      ...interventionPhotos.flatMap((photo) =>
        photo.varianteSoumisePar && photo.dateSoumissionVariante
          ? [{
              source: 'INTERVENTION' as const,
              photoId: photo.idPhotoIntervention,
              submittedBy: photo.varianteSoumisePar,
              submittedAt: photo.dateSoumissionVariante,
            }]
          : [],
      ),
    ]
      .sort((left, right) => left.submittedAt.getTime() - right.submittedAt.getTime())
      .slice(0, limit);
  }

  async withdrawPhotoVariant(
    input: Parameters<PublicationsRepository['withdrawPhotoVariant']>[0],
  ): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const current = await this.findPhotoVariantContext(transaction, input.source, input.photoId);
      if (!current) throw new PublicationRuleError('PHOTO_VARIANT_NOT_FOUND');
      if (current.state !== 'APPROUVEE') {
        throw new PublicationRuleError('PHOTO_VARIANT_NOT_APPROVED');
      }

      const result = await this.updatePhotoVariant(transaction, input.source, input.photoId, {
        etatPublication: 'REFUSEE',
        floutageConfirme: false,
        approuvePar: null,
        dateApprobation: null,
      }, 'APPROUVEE');
      if (result.count !== 1) throw new PublicationRuleError('PHOTO_VARIANT_NOT_APPROVED');

      await this.recordPhotoVariantEvent(transaction, {
        type: 'VARIANTE_PHOTO_RETIRE',
        source: input.source,
        photoId: input.photoId,
        actorId: input.actorId,
        target: current.target,
        before: {
          etatPublication: current.state,
          referencePhotoPublique: current.reference,
        },
        after: {
          etatPublication: 'REFUSEE',
          accesPublicRetire: true,
        },
        reason: input.reason,
        at: input.at,
      });
    });
  }

  async findPendingPhotoVariant(
    source: PublicationPhotoSource,
    photoId: string,
  ): Promise<string | null> {
    const photo = source === 'SIGNALEMENT'
      ? await this.client.photoSignalement.findFirst({
          where: { idPhotoSignalement: photoId, etatPublication: 'EN_ATTENTE', dateExpiration: { gt: new Date() } },
          select: { referencePhotoPublique: true },
        })
      : await this.client.photoIntervention.findFirst({
          where: { idPhotoIntervention: photoId, etatPublication: 'EN_ATTENTE', dateExpiration: { gt: new Date() } },
          select: { referencePhotoPublique: true },
        });
    return photo?.referencePhotoPublique ?? null;
  }

  async findPublicPhoto(
    source: PublicationPhotoSource,
    photoId: string,
  ): Promise<string | null> {
    const where = {
      etatPublication: 'APPROUVEE',
      dateExpiration: { gt: new Date() },
      floutageConfirme: true,
      referencePhotoPublique: { not: null },
      photoPublication: {
        some: {
          publicationFlux: {
            etatPublication: 'APPROUVEE',
            datePublication: { not: null },
          },
        },
      },
    };
    const photo = source === 'SIGNALEMENT'
      ? await this.client.photoSignalement.findFirst({
          where: { ...where, idPhotoSignalement: photoId },
          select: { referencePhotoPublique: true },
        })
      : await this.client.photoIntervention.findFirst({
          where: { ...where, idPhotoIntervention: photoId },
          select: { referencePhotoPublique: true },
        });
    return photo?.referencePhotoPublique ?? null;
  }

  async findOriginalPhoto(
    source: PublicationPhotoSource,
    photoId: string,
  ): Promise<string | null> {
    const photo = source === 'SIGNALEMENT'
      ? await this.client.photoSignalement.findFirst({
          where: { idPhotoSignalement: photoId, etatPublication: 'EN_ATTENTE', dateExpiration: { gt: new Date() } },
          select: { referencePhoto: true },
        })
      : await this.client.photoIntervention.findFirst({
          where: { idPhotoIntervention: photoId, etatPublication: 'EN_ATTENTE', dateExpiration: { gt: new Date() } },
          select: { referencePhoto: true },
        });
    return photo?.referencePhoto ?? null;
  }

  async listPending(limit: number): Promise<PendingPublication[]> {
    return this.client.publicationFlux.findMany({
      where: { etatPublication: 'EN_ATTENTE' },
      orderBy: { dateCreation: 'asc' },
      take: limit,
      select: {
        idPublication: true,
        idSignalement: true,
        idDossier: true,
        creePar: true,
        dateCreation: true,
      },
    });
  }

  async listPublic(limit: number): Promise<PublicPublication[]> {
    const now = new Date();
    const records = await this.client.publicationFlux.findMany({
      where: {
        etatPublication: 'APPROUVEE',
        datePublication: { not: null },
        photoPublication: {
          some: {
            OR: [
              {
                photoSignalement: {
                  is: {
                    etatPublication: 'APPROUVEE',
                    floutageConfirme: true,
                    referencePhotoPublique: { not: null },
                    dateExpiration: { gt: new Date() },
                  },
                },
              },
              {
                photoIntervention: {
                  is: {
                    etatPublication: 'APPROUVEE',
                    floutageConfirme: true,
                    referencePhotoPublique: { not: null },
                    dateExpiration: { gt: new Date() },
                  },
                },
              },
            ],
          },
        },
      },
      orderBy: { datePublication: 'desc' },
      take: limit,
      select: {
        idPublication: true,
        datePublication: true,
        signalement: {
          select: {
            commune: { select: { nomCommune: true } },
            qualificationSignalement: {
              where: { etatQualification: 'ACTIVE' },
              select: { typeDechet: { select: { codeType: true, libelle: true } } },
            },
          },
        },
        dossierTraitement: {
          select: {
            commune: { select: { nomCommune: true } },
            contenuDossier: {
              where: { etatContenuDossier: 'INCLUSE' },
              select: { typeDechet: { select: { codeType: true, libelle: true } } },
            },
          },
        },
        photoPublication: {
          select: {
            idPhotoSignalement: true,
            idPhotoIntervention: true,
            rolePhoto: true,
            photoSignalement: {
              select: {
                referencePhotoPublique: true,
                etatPublication: true,
                floutageConfirme: true,
                dateExpiration: true,
              },
            },
            photoIntervention: {
              select: {
                referencePhotoPublique: true,
                etatPublication: true,
                floutageConfirme: true,
                dateExpiration: true,
              },
            },
          },
        },
      },
    });

    return records.map((record) => ({
      idPublication: record.idPublication,
      datePublication: record.datePublication!,
      commune:
        record.signalement?.commune?.nomCommune ??
        record.dossierTraitement?.commune?.nomCommune ??
        null,
      typesDechets:
        record.signalement?.qualificationSignalement.map((item) => ({
          code: item.typeDechet.codeType,
          libelle: item.typeDechet.libelle,
        })) ??
        record.dossierTraitement?.contenuDossier.map((item) => ({
          code: item.typeDechet.codeType,
          libelle: item.typeDechet.libelle,
        })) ??
        [],
      photos: record.photoPublication.flatMap((photo) => {
        const source = photo.photoSignalement ?? photo.photoIntervention;
        return source?.etatPublication === 'APPROUVEE' &&
          source.floutageConfirme &&
          source.dateExpiration > now &&
          source.referencePhotoPublique
          ? [{
              role: photo.rolePhoto as PublicPublication['photos'][number]['role'],
              reference: photo.idPhotoSignalement
                ? `/api/publications/public/photos/SIGNALEMENT/${photo.idPhotoSignalement}`
                : `/api/publications/public/photos/INTERVENTION/${photo.idPhotoIntervention}`,
            }]
          : [];
      }),
    })).filter((record) => record.photos.length > 0);
  }

  private async findPhotoVariantContext(
    transaction: Prisma.TransactionClient,
    source: PublicationPhotoSource,
    photoId: string,
  ): Promise<{
    state: string;
    submittedBy: string | null;
    reference: string | null;
    target: { type: 'SIGNALEMENT' | 'DOSSIER'; id: string };
  } | null> {
    if (source === 'SIGNALEMENT') {
      const photo = await transaction.photoSignalement.findFirst({
        where: { idPhotoSignalement: photoId, dateExpiration: { gt: new Date() } },
        select: {
          idSignalement: true,
          etatPublication: true,
          varianteSoumisePar: true,
          referencePhotoPublique: true,
        },
      });
      return photo ? {
        state: photo.etatPublication,
        submittedBy: photo.varianteSoumisePar,
        reference: photo.referencePhotoPublique,
        target: { type: 'SIGNALEMENT', id: photo.idSignalement },
      } : null;
    }

    const photo = await transaction.photoIntervention.findFirst({
      where: { idPhotoIntervention: photoId, dateExpiration: { gt: new Date() } },
      select: {
        etatPublication: true,
        varianteSoumisePar: true,
        referencePhotoPublique: true,
        intervention: {
          select: { affectation: { select: { idDossier: true } } },
        },
      },
    });
    return photo ? {
      state: photo.etatPublication,
      submittedBy: photo.varianteSoumisePar,
      reference: photo.referencePhotoPublique,
      target: { type: 'DOSSIER', id: photo.intervention.affectation.idDossier },
    } : null;
  }

  private async updatePhotoVariant(
    transaction: Prisma.TransactionClient,
    source: PublicationPhotoSource,
    photoId: string,
    data: {
      etatPublication: string;
      referencePhotoPublique?: string;
      floutageConfirme?: boolean;
      varianteSoumisePar?: string;
      dateSoumissionVariante?: Date;
      approuvePar?: string | null;
      dateApprobation?: Date | null;
    },
    expectedState: string,
    actorId?: string,
  ): Promise<{ count: number }> {
    const where = {
      etatPublication: expectedState,
      dateExpiration: { gt: new Date() },
      ...(actorId ? { varianteSoumisePar: { not: actorId } } : {}),
    };
    return source === 'SIGNALEMENT'
      ? transaction.photoSignalement.updateMany({
          where: { ...where, idPhotoSignalement: photoId },
          data,
        })
      : transaction.photoIntervention.updateMany({
          where: { ...where, idPhotoIntervention: photoId },
          data,
        });
  }

  private async recordPhotoVariantEvent(
    transaction: Prisma.TransactionClient,
    input: {
      type: string;
      source: PublicationPhotoSource;
      photoId: string;
      actorId: string;
      target: { type: 'SIGNALEMENT' | 'DOSSIER'; id: string };
      before: Prisma.InputJsonObject;
      after: Prisma.InputJsonObject;
      reason: string;
      at: Date;
    },
  ): Promise<void> {
    await transaction.evenementMetier.create({
      data: {
        typeEvenement: input.type,
        dateEvenement: input.at,
        origine: 'PORTAIL_GESTION',
        idActeur: input.actorId,
        ...(input.target.type === 'SIGNALEMENT'
          ? { idSignalementCible: input.target.id }
          : { idDossierCible: input.target.id }),
        donneesAvant: input.before,
        donneesApres: {
          ...input.after,
          source: input.source,
          photoId: input.photoId,
        },
        motif: input.reason,
      },
    });
  }

  private async requeueApprovedPublications(
    transaction: Prisma.TransactionClient,
    source: PublicationPhotoSource,
    photoId: string,
    actorId: string,
    at: Date,
  ): Promise<void> {
    const publications = source === 'SIGNALEMENT'
      ? await transaction.publicationFlux.findMany({
          where: {
            etatPublication: 'APPROUVEE',
            photoPublication: { some: { idPhotoSignalement: photoId } },
          },
          select: {
            idPublication: true,
            idSignalement: true,
            idDossier: true,
            approuvePar: true,
          },
        })
      : await transaction.publicationFlux.findMany({
          where: {
            etatPublication: 'APPROUVEE',
            photoPublication: { some: { idPhotoIntervention: photoId } },
          },
          select: {
            idPublication: true,
            idSignalement: true,
            idDossier: true,
            approuvePar: true,
          },
        });

    for (const publication of publications) {
      const updated = await transaction.publicationFlux.updateMany({
        where: { idPublication: publication.idPublication, etatPublication: 'APPROUVEE' },
        data: {
          etatPublication: 'EN_ATTENTE',
          approuvePar: null,
          dateApprobation: null,
          datePublication: null,
          motifDecision: 'Variante photo remplacée ; nouvelle validation requise.',
        },
      });
      if (updated.count !== 1) continue;
      const target = publication.idSignalement
        ? { type: 'SIGNALEMENT' as const, id: publication.idSignalement }
        : publication.idDossier
          ? { type: 'DOSSIER' as const, id: publication.idDossier }
          : null;
      if (!target) throw new Error(`Publication ${publication.idPublication} sans cible métier.`);
      await this.recordPhotoVariantEvent(transaction, {
        type: 'PUBLICATION_REMISE_EN_MODERATION',
        source,
        photoId,
        actorId,
        target,
        before: {
          etatPublication: 'APPROUVEE',
          idPublication: publication.idPublication,
        },
        after: {
          etatPublication: 'EN_ATTENTE',
          idPublication: publication.idPublication,
          motif: 'Variante photo remplacée ; nouvelle validation requise.',
        },
        reason: 'La nouvelle variante nécessite une nouvelle validation de la publication.',
        at,
      });
    }
  }
}
