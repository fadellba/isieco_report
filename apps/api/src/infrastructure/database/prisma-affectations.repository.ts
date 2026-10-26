import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { EtatPriseEnCharge, StatutDossier } from '@isieco/shared';
import { AffectationRuleError } from '../../domain/affectations.js';
import {
  AffectationsRepository,
  CreateAssignmentInput,
} from '../../application/ports/affectations-repository.js';
import { recalculerStatutDossier } from './dossier-status.js';

export class PrismaAffectationsRepository implements AffectationsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listPending() {
    const rows = await this.prisma.contenuDossier.findMany({
      where: {
        etatContenuDossier: 'INCLUSE',
        affectation: { none: { dateFinAffectation: null } },
        dossierTraitement: {
          statutDossier: { notIn: ['CLOS_RESOLUTION_CONFIRMEE', 'CLOS_SANS_SUITE'] },
        },
      },
      select: {
        idDossier: true,
        idTypeDechet: true,
        dossierTraitement: {
          select: { referenceDossier: true, priorite: true, dateCreationDossier: true },
        },
        typeDechet: { select: { codeType: true, libelle: true } },
      },
    });
    return rows.map((row) => ({
      idDossier: row.idDossier,
      referenceDossier: row.dossierTraitement.referenceDossier,
      priorite: row.dossierTraitement.priorite,
      dateCreationDossier: row.dossierTraitement.dateCreationDossier,
      idTypeDechet: row.idTypeDechet,
      codeType: row.typeDechet.codeType,
      libelleDechet: row.typeDechet.libelle,
    }));
  }

  findIdempotent(reference: string) {
    return this.prisma.affectation.findUnique({
      where: { referenceOperationUnique: reference },
      select: { idAffectation: true, etatAffectation: true },
    });
  }

  async findDossierCategory(dossierId: string, typeId: string) {
    const category = await this.prisma.contenuDossier.findUnique({
      where: { idDossier_idTypeDechet: { idDossier: dossierId, idTypeDechet: typeId } },
      select: { etatContenuDossier: true },
    });
    return category?.etatContenuDossier ?? null;
  }

  async findDossierStatus(dossierId: string) {
    const dossier = await this.prisma.dossierTraitement.findUnique({
      where: { idDossier: dossierId },
      select: { statutDossier: true },
    });
    return dossier?.statutDossier ?? null;
  }

  findCompetence(competenceId: string, teamId: string, typeId: string) {
    return this.prisma.competenceEquipe.findUnique({
      where: {
        idCompetenceEquipe_idEquipe_idTypeDechet: {
          idCompetenceEquipe: competenceId,
          idEquipe: teamId,
          idTypeDechet: typeId,
        },
      },
      select: { dateDebut: true, dateFin: true },
    });
  }

  async findDossierLocation(dossierId: string) {
    const location = await this.prisma.dossierTraitement.findUnique({
      where: { idDossier: dossierId },
      select: { latitude: true, longitude: true, descriptionLocalisation: true },
    });
    return location
      ? {
          ...location,
          latitude: location.latitude === null ? null : Number(location.latitude),
          longitude: location.longitude === null ? null : Number(location.longitude),
        }
      : null;
  }

  async hasActiveAssignment(dossierId: string, typeId: string) {
    const active = await this.prisma.affectation.findFirst({
      where: { idDossier: dossierId, idTypeDechet: typeId, dateFinAffectation: null },
      select: { idAffectation: true },
    });
    return Boolean(active);
  }

  async create(input: CreateAssignmentInput) {
    return this.prisma.$transaction(async (trx) => {
      await this.lockOpenDossier(trx, input.idDossier);
      if (input.referenceOperationUnique) {
        const existing = await trx.affectation.findUnique({
          where: { referenceOperationUnique: input.referenceOperationUnique },
          select: { idAffectation: true, etatAffectation: true },
        });
        if (existing) return existing;
      }

      const category = await trx.contenuDossier.findUnique({
        where: {
          idDossier_idTypeDechet: {
            idDossier: input.idDossier,
            idTypeDechet: input.idTypeDechet,
          },
        },
        select: { etatContenuDossier: true },
      });
      if (!category) {
        throw new AffectationRuleError(
          'CATEGORY_NOT_FOUND',
          'Le volet technique visé est absent du contenu de ce dossier.',
        );
      }
      if (category.etatContenuDossier !== 'INCLUSE') {
        throw new AffectationRuleError(
          'CATEGORY_REMOVED',
          'Impossible d’affecter une catégorie retirée du dossier.',
        );
      }

      const active = await trx.affectation.findFirst({
        where: {
          idDossier: input.idDossier,
          idTypeDechet: input.idTypeDechet,
          dateFinAffectation: null,
        },
        select: { idAffectation: true },
      });
      if (active) {
        throw new AffectationRuleError(
          'ACTIVE_ASSIGNMENT_EXISTS',
          'Une affectation active existe déjà pour ce couple dossier/catégorie. Utilisez la réaffectation pour la remplacer.',
        );
      }

      await trx.affectation.create({
        data: {
          idAffectation: input.idAffectation,
          idDossier: input.idDossier,
          idTypeDechet: input.idTypeDechet,
          idEquipe: input.idEquipe,
          idCompetenceEquipe: input.idCompetenceEquipe,
          idDecideur: input.actorId,
          etatAffectation: 'ACTIVE',
          motif: input.motif || null,
          observation: input.observation || null,
          referenceOperationUnique: input.referenceOperationUnique || null,
        },
      });
      await trx.contenuDossier.update({
        where: {
          idDossier_idTypeDechet: {
            idDossier: input.idDossier,
            idTypeDechet: input.idTypeDechet,
          },
        },
        data: {
          etatPriseEnCharge: EtatPriseEnCharge.AFFECTEE,
          dateAttenteEquipe: null,
          motifAttenteEquipe: null,
        },
      });
      await recalculerStatutDossier(trx, input.idDossier);
      await trx.evenementMetier.create({
        data: {
          typeEvenement: 'AFFECTATION_CREEE',
          origine: 'PORTAIL_GESTION',
          idActeur: input.actorId,
          idAffectationCible: input.idAffectation,
          referenceOperationUnique: input.referenceOperationUnique || null,
          motif: input.motif || "Affectation de l'équipe au volet de traitement",
        },
      });
      await trx.intervention.create({
        data: {
          idAffectation: input.idAffectation,
          statutIntervention: 'PROGRAMMEE',
          renseignePar: input.actorId,
        },
      });
      return null;
    });
  }

  findActiveAssignment(assignmentId: string) {
    return this.prisma.affectation.findFirst({
      where: { idAffectation: assignmentId, dateFinAffectation: null },
      select: { idDossier: true, idTypeDechet: true },
    });
  }

  async replace(input: Parameters<AffectationsRepository['replace']>[0]): Promise<boolean> {
    return this.prisma.$transaction(async (trx) => {
      await this.lockOpenDossier(trx, input.dossierId);
      const oldAssignment = await trx.affectation.updateMany({
        where: { idAffectation: input.oldAssignmentId, dateFinAffectation: null },
        data: {
          etatAffectation: 'REMPLACEE',
          dateFinAffectation: new Date(),
          motif: `Réaffectation vers nouvelle équipe : ${input.reason}`,
        },
      });
      if (oldAssignment.count !== 1) return false;
      await trx.affectation.create({
        data: {
          idAffectation: input.newAssignmentId,
          idDossier: input.dossierId,
          idTypeDechet: input.typeId,
          idEquipe: input.teamId,
          idCompetenceEquipe: input.competenceId,
          idDecideur: input.actorId,
          etatAffectation: 'ACTIVE',
          motif: input.reason,
          referenceOperationUnique: input.referenceOperationUnique || null,
        },
      });
      await trx.evenementMetier.create({
        data: {
          typeEvenement: 'AFFECTATION_REMPLACEE',
          origine: 'PORTAIL_GESTION',
          idActeur: input.actorId,
          idAffectationCible: input.newAssignmentId,
          correlationId: input.correlationId,
          motif: input.reason,
        },
      });
      await trx.intervention.create({
        data: {
          idAffectation: input.newAssignmentId,
          statutIntervention: 'PROGRAMMEE',
          renseignePar: input.actorId,
        },
      });
      await trx.contenuDossier.update({
        where: {
          idDossier_idTypeDechet: {
            idDossier: input.dossierId,
            idTypeDechet: input.typeId,
          },
        },
        data: {
          etatPriseEnCharge: EtatPriseEnCharge.AFFECTEE,
          dateAttenteEquipe: null,
          motifAttenteEquipe: null,
        },
      });
      await recalculerStatutDossier(trx, input.dossierId);
      return true;
    });
  }

  private async lockOpenDossier(transaction: Prisma.TransactionClient, dossierId: string): Promise<void> {
    const rows = await transaction.$queryRaw<Array<{ statut_dossier: string }>>`
      SELECT statut_dossier
      FROM dossier_traitement
      WHERE id_dossier = ${dossierId}::uuid
      FOR UPDATE
    `;
    const status = rows[0]?.statut_dossier;
    if (
      status === StatutDossier.CLOS_RESOLUTION_CONFIRMEE ||
      status === StatutDossier.CLOS_SANS_SUITE
    ) {
      throw new AffectationRuleError(
        'DOSSIER_CLOSED',
        'Un dossier clôturé doit être réouvert avant toute nouvelle affectation.',
      );
    }
    if (!status) {
      throw new AffectationRuleError('CATEGORY_NOT_FOUND', 'Dossier introuvable.');
    }
  }
}
