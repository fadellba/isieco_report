import crypto from 'node:crypto';
import { EtatPriseEnCharge } from '@isieco/shared';
import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import {
  InterventionMembership,
  InterventionMission,
  InterventionRuleError,
} from '../../domain/interventions.js';
import {
  InterventionPhotoInput,
  InterventionsRepository,
} from '../../application/ports/interventions-repository.js';
import { recalculerStatutDossier } from './dossier-status.js';

async function lockDossierForAffectation(
  transaction: Prisma.TransactionClient,
  idAffectation: string,
): Promise<string | null> {
  const rows = await transaction.$queryRaw<Array<{ id_dossier: string }>>`
    SELECT id_dossier
    FROM affectation
    WHERE id_affectation = ${idAffectation}::uuid
  `;
  const idDossier = rows[0]?.id_dossier;
  if (!idDossier) return null;
  await transaction.$queryRaw`
    SELECT id_dossier
    FROM dossier_traitement
    WHERE id_dossier = ${idDossier}::uuid
    FOR UPDATE
  `;
  return idDossier;
}

export class PrismaInterventionsRepository implements InterventionsRepository {
  constructor(private readonly client: PrismaClient) {}

  async listMissions(idUtilisateur: string, now: Date): Promise<InterventionMission[]> {
    const memberships = await this.client.appartenanceEquipe.findMany({
      where: {
        idUtilisateur,
        dateDebut: { lte: now },
        OR: [{ dateFin: null }, { dateFin: { gte: now } }],
      },
      select: { idEquipe: true },
    });
    if (memberships.length === 0) return [];

    const interventions = await this.client.intervention.findMany({
      where: {
        statutIntervention: { in: ['PROGRAMMEE', 'EN_COURS'] },
        affectation: {
          dateFinAffectation: null,
          idEquipe: { in: memberships.map(({ idEquipe }) => idEquipe) },
        },
      },
      include: {
        affectation: {
          include: {
            contenuDossier: { include: { dossierTraitement: true, typeDechet: true } },
            equipe: true,
          },
        },
      },
      orderBy: [
        { statutIntervention: 'asc' },
        { affectation: { contenuDossier: { dossierTraitement: { dateCreationDossier: 'asc' } } } },
      ],
    });
    return interventions.map(({ affectation, ...intervention }) => {
      const { dossierTraitement, typeDechet } = affectation.contenuDossier;
      return {
        idIntervention: intervention.idIntervention,
        statutIntervention: intervention.statutIntervention,
        dateDebut: intervention.dateHeureDebut,
        dateFin: intervention.dateHeureFin,
        idAffectation: affectation.idAffectation,
        idDossier: dossierTraitement.idDossier,
        referenceDossier: dossierTraitement.referenceDossier,
        descriptionSynthese: dossierTraitement.descriptionSynthese,
        priorite: dossierTraitement.priorite,
        latitude: dossierTraitement.latitude === null ? null : Number(dossierTraitement.latitude),
        longitude: dossierTraitement.longitude === null ? null : Number(dossierTraitement.longitude),
        descriptionLocalisation: dossierTraitement.descriptionLocalisation,
        codeTypeDechet: typeDechet.codeType,
        libelleDechet: typeDechet.libelle,
        nomEquipe: affectation.equipe.nomEquipe,
      };
    });
  }

  async findMembership(
    idIntervention: string,
    idUtilisateur: string,
    now: Date,
  ): Promise<{ intervention: InterventionMembership | null; isMember: boolean }> {
    const row = await this.client.intervention.findUnique({
      where: { idIntervention },
      select: {
        idIntervention: true,
        idAffectation: true,
        statutIntervention: true,
        dateHeureDebut: true,
        affectation: {
          select: {
            idEquipe: true,
            etatAffectation: true,
            dateFinAffectation: true,
          },
        },
      },
    });
    if (!row) return { intervention: null, isMember: false };
    const membership = await this.client.appartenanceEquipe.findFirst({
      where: {
        idUtilisateur,
        idEquipe: row.affectation.idEquipe,
        dateDebut: { lte: now },
        OR: [{ dateFin: null }, { dateFin: { gte: now } }],
      },
      select: { idEquipe: true },
    });
    return {
      intervention: {
        idIntervention: row.idIntervention,
        idAffectation: row.idAffectation,
        idEquipe: row.affectation.idEquipe,
        statutIntervention: row.statutIntervention,
        dateHeureDebut: row.dateHeureDebut,
        etatAffectation: row.affectation.etatAffectation,
        dateFinAffectation: row.affectation.dateFinAffectation,
      },
      isMember: membership !== null,
    };
  }

  async canSubmitReport(idEquipe: string, idUtilisateur: string, now: Date): Promise<boolean> {
    const leaderMembership = await this.client.appartenanceEquipe.findFirst({
      where: {
        idEquipe,
        idUtilisateur,
        fonction: { in: ['CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN'] },
        dateDebut: { lte: now },
        OR: [{ dateFin: null }, { dateFin: { gte: now } }],
      },
      select: { idUtilisateur: true },
    });
    if (leaderMembership) return true;
    const delegatedMembership = await this.client.delegationDecisionEquipe.findFirst({
      where: {
        idEquipe,
        idUtilisateurDelegue: idUtilisateur,
        typeDecision: 'SOUMISSION_COMPTE_RENDU',
        dateDebut: { lte: now },
        OR: [{ dateFin: null }, { dateFin: { gte: now } }],
        appartenanceEquipe: {
          is: {
            fonction: { notIn: ['CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN'] },
            dateDebut: { lte: now },
            OR: [{ dateFin: null }, { dateFin: { gte: now } }],
          },
        },
      },
      select: { idDelegation: true },
    });
    return delegatedMembership !== null;
  }

  async start(idIntervention: string, idUtilisateur: string, now: Date): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const intervention = await transaction.intervention.findUnique({
        where: { idIntervention },
        select: {
          affectation: { select: { idDossier: true, idTypeDechet: true } },
        },
      });
      const affectation = intervention?.affectation;
      if (!affectation) throw new InterventionRuleError('START_STATE_CHANGED');
      await transaction.$queryRaw`
        SELECT id_dossier
        FROM dossier_traitement
        WHERE id_dossier = ${affectation.idDossier}::uuid
        FOR UPDATE
      `;
      const update = await transaction.intervention.updateMany({
        where: { idIntervention, statutIntervention: 'PROGRAMMEE' },
        data: { statutIntervention: 'EN_COURS', dateHeureDebut: now },
      });
      if (update.count !== 1) throw new InterventionRuleError('START_STATE_CHANGED');
      await transaction.contenuDossier.update({
        where: {
          idDossier_idTypeDechet: {
            idDossier: affectation.idDossier,
            idTypeDechet: affectation.idTypeDechet,
          },
        },
        data: { etatPriseEnCharge: EtatPriseEnCharge.EN_COURS },
      });
      await recalculerStatutDossier(transaction, affectation.idDossier);
      await transaction.evenementMetier.create({
        data: {
          idEvenement: crypto.randomUUID(),
          typeEvenement: 'INTERVENTION_DEBUTEE',
          origine: 'APPLICATION_TERRAIN',
          idActeur: idUtilisateur,
          idInterventionCible: idIntervention,
          motif: 'Début des travaux sur le terrain',
        },
      });
    });
  }

  async finish(
    intervention: InterventionMembership,
    idUtilisateur: string,
    input: { resultatIntervention: string; compteRendu: string; motifException?: string },
    now: Date,
  ): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      await lockDossierForAffectation(transaction, intervention.idAffectation);
      const affectationCourante = await transaction.affectation.findUnique({
        where: { idAffectation: intervention.idAffectation },
        select: { idDossier: true, idTypeDechet: true },
      });
      if (!affectationCourante) throw new InterventionRuleError('FINISH_STATE_CHANGED');
      const update = await transaction.intervention.updateMany({
        where: { idIntervention: intervention.idIntervention, statutIntervention: 'EN_COURS' },
        data: {
          statutIntervention: 'TERMINEE',
          dateHeureFin: now,
          dateSoumissionCompteRendu: now,
          resultatIntervention: input.resultatIntervention,
          compteRendu: input.compteRendu,
          motifException: input.motifException || null,
          renseignePar: idUtilisateur,
        },
      });
      if (update.count !== 1) throw new InterventionRuleError('FINISH_STATE_CHANGED');

      await transaction.affectation.update({
        where: { idAffectation: intervention.idAffectation },
        data: { etatAffectation: 'A_VERIFIER' },
      });
      await transaction.contenuDossier.update({
        where: {
          idDossier_idTypeDechet: {
            idDossier: affectationCourante.idDossier,
            idTypeDechet: affectationCourante.idTypeDechet,
          },
        },
        data: { etatPriseEnCharge: EtatPriseEnCharge.A_VERIFIER },
      });
      await recalculerStatutDossier(transaction, affectationCourante.idDossier);
      await transaction.evenementMetier.create({
        data: {
          idEvenement: crypto.randomUUID(),
          typeEvenement: 'INTERVENTION_TERMINEE',
          origine: 'APPLICATION_TERRAIN',
          idActeur: idUtilisateur,
          idInterventionCible: intervention.idIntervention,
          donneesApres: { resultatIntervention: input.resultatIntervention, compteRendu: input.compteRendu },
          motif: 'Saisie du compte-rendu terrain et fin de chantier',
        },
      });
    });
  }

  async createPhoto(input: InterventionPhotoInput): Promise<void> {
    await this.client.photoIntervention.create({
      data: {
        idPhotoIntervention: input.idPhoto,
        idIntervention: input.idIntervention,
        referencePhoto: input.referencePhoto,
        contextePhoto: input.contextePhoto,
        description: input.description,
        mediaStockeeLocale: input.mediaStockeeLocale,
      },
    });
  }

  async findPhotoReference(idIntervention: string, idPhoto: string): Promise<string | null> {
    const photo = await this.client.photoIntervention.findFirst({
      where: { idPhotoIntervention: idPhoto, idIntervention, dateExpiration: { gt: new Date() } },
      select: { referencePhoto: true },
    });
    return photo?.referencePhoto ?? null;
  }
}
