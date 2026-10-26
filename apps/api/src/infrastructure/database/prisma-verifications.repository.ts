import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { EtatPriseEnCharge } from '@isieco/shared';
import { RecordVerificationInput } from '../../domain/verifications.js';
import {
  VerificationEvent,
  VerificationsRepository,
  VerificationsTransaction,
} from '../../application/ports/verifications-repository.js';
import { recalculerStatutDossier } from './dossier-status.js';

class PrismaVerificationsTransaction implements VerificationsTransaction {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  async lockAffectation(idAffectation: string): Promise<void> {
    const rows = await this.transaction.$queryRaw<Array<{ id_dossier: string }>>`
      SELECT id_dossier
      FROM affectation
      WHERE id_affectation = ${idAffectation}::uuid
    `;
    const idDossier = rows[0]?.id_dossier;
    if (!idDossier) return;
    await this.lockDossier(idDossier);
    await this.transaction.$queryRaw`
      SELECT id_affectation
      FROM affectation
      WHERE id_affectation = ${idAffectation}::uuid
      FOR UPDATE
    `;
  }

  async lockDossier(idDossier: string): Promise<void> {
    await this.transaction.$queryRaw`
      SELECT id_dossier
      FROM dossier_traitement
      WHERE id_dossier = ${idDossier}::uuid
      FOR UPDATE
    `;
  }

  async findAffectation(idAffectation: string) {
    return this.transaction.affectation.findUnique({
      where: { idAffectation },
      select: { etatAffectation: true, dateFinAffectation: true },
    });
  }

  async findLatestCompletedIntervention(idAffectation: string): Promise<string | null> {
    const intervention = await this.transaction.intervention.findFirst({
      where: { idAffectation, statutIntervention: 'TERMINEE' },
      orderBy: { dateHeureFin: 'desc' },
      select: { idIntervention: true },
    });
    return intervention?.idIntervention ?? null;
  }

  async hasCompletionTrace(idIntervention: string): Promise<boolean> {
    const event = await this.transaction.evenementMetier.findFirst({
      where: {
        idInterventionCible: idIntervention,
        typeEvenement: 'INTERVENTION_TERMINEE',
      },
      orderBy: { dateEnregistrement: 'desc' },
      select: { idActeur: true },
    });
    return Boolean(event?.idActeur);
  }

  async wasCompletedByVerifier(idAffectation: string, idVerificateur: string): Promise<boolean> {
    const event = await this.transaction.evenementMetier.findFirst({
      where: {
        idActeur: idVerificateur,
        typeEvenement: 'INTERVENTION_TERMINEE',
        intervention: {
          is: { idAffectation, statutIntervention: 'TERMINEE' },
        },
      },
      select: { idEvenement: true },
    });
    return event !== null;
  }

  async replaceCurrentVerifications(idAffectation: string): Promise<void> {
    await this.transaction.verificationResolution.updateMany({
      where: { idAffectation, etatVerification: 'COURANTE' },
      data: { etatVerification: 'REMPLACEE' },
    });
  }

  async createVerification(input: RecordVerificationInput): Promise<string> {
    const verification = await this.transaction.verificationResolution.create({
      data: {
        idAffectation: input.idAffectation,
        idVerificateur: input.idVerificateur,
        resultatVerification: input.resultatVerification,
        etatVerification: 'COURANTE',
        motif: input.motif || null,
        referencePreuve: input.referencePreuve || null,
      },
      select: { idVerification: true },
    });
    return verification.idVerification;
  }

  async setAffectationResolved(idAffectation: string, dateFin: Date): Promise<void> {
    const affectation = await this.transaction.affectation.findUnique({
      where: { idAffectation },
      select: { idDossier: true, idTypeDechet: true },
    });
    if (!affectation) throw new Error(`Affectation introuvable : ${idAffectation}`);
    await this.transaction.affectation.update({
      where: { idAffectation },
      data: { etatAffectation: 'TERMINEE', dateFinAffectation: dateFin },
    });
    await this.transaction.contenuDossier.update({
      where: {
        idDossier_idTypeDechet: {
          idDossier: affectation.idDossier,
          idTypeDechet: affectation.idTypeDechet,
        },
      },
      data: { etatPriseEnCharge: EtatPriseEnCharge.TERMINEE },
    });
    await recalculerStatutDossier(this.transaction, affectation.idDossier);
  }

  async resetAffectationForRework(idAffectation: string): Promise<void> {
    const affectation = await this.transaction.affectation.findUnique({
      where: { idAffectation },
      select: { idDossier: true, idTypeDechet: true },
    });
    if (!affectation) throw new Error(`Affectation introuvable : ${idAffectation}`);
    await this.transaction.affectation.update({
      where: { idAffectation },
      data: { etatAffectation: 'ACTIVE' },
    });
    await this.transaction.contenuDossier.update({
      where: {
        idDossier_idTypeDechet: {
          idDossier: affectation.idDossier,
          idTypeDechet: affectation.idTypeDechet,
        },
      },
      data: { etatPriseEnCharge: EtatPriseEnCharge.AFFECTEE },
    });
    await recalculerStatutDossier(this.transaction, affectation.idDossier);
  }

  async createVerificationEvent(input: VerificationEvent): Promise<void> {
    await this.transaction.evenementMetier.create({
      data: {
        typeEvenement: input.typeEvenement,
        origine: 'PORTAIL_GESTION',
        idActeur: input.idActeur,
        idVerificationCible: input.idVerificationCible,
        idDossierCible: input.idDossierCible,
        motif: input.motif,
        donneesAvant: input.donneesAvant,
        donneesApres: input.donneesApres,
      },
    });
  }

  async createProgrammedIntervention(idAffectation: string, idVerificateur: string): Promise<void> {
    await this.transaction.intervention.create({
      data: {
        idAffectation,
        statutIntervention: 'PROGRAMMEE',
        renseignePar: idVerificateur,
      },
    });
  }

  async findDossierStatus(idDossier: string): Promise<string | null> {
    const dossier = await this.transaction.dossierTraitement.findUnique({
      where: { idDossier },
      select: { statutDossier: true },
    });
    return dossier?.statutDossier ?? null;
  }

  async listIncludedWasteTypes(idDossier: string) {
    const contents = await this.transaction.contenuDossier.findMany({
      where: { idDossier, etatContenuDossier: 'INCLUSE' },
      select: { idTypeDechet: true, typeDechet: { select: { codeType: true } } },
    });
    return contents.map(({ idTypeDechet, typeDechet }) => ({
      idTypeDechet,
      codeType: typeDechet.codeType,
    }));
  }

  async findLatestReopeningDate(idDossier: string): Promise<Date | null> {
    const event = await this.transaction.evenementMetier.findFirst({
      where: { idDossierCible: idDossier, typeEvenement: 'DOSSIER_REOUVERT' },
      orderBy: { dateEnregistrement: 'desc' },
      select: { dateEnregistrement: true },
    });
    return event?.dateEnregistrement ?? null;
  }

  async findLatestResolution(idDossier: string, idTypeDechet: string) {
    const affectation = await this.transaction.affectation.findFirst({
      where: { idDossier, idTypeDechet },
      orderBy: { dateHeureAffectation: 'desc' },
      select: {
        etatAffectation: true,
        dateHeureAffectation: true,
        verificationResolution: {
          where: {
            etatVerification: 'COURANTE',
            resultatVerification: 'CONFORME_RESOLU',
          },
          orderBy: { dateVerification: 'desc' },
          take: 1,
          select: { dateVerification: true },
        },
      },
    });
    if (!affectation) return null;
    return {
      etatAffectation: affectation.etatAffectation,
      dateHeureAffectation: affectation.dateHeureAffectation,
      dateVerification: affectation.verificationResolution[0]?.dateVerification ?? null,
    };
  }

  async closeDossier(idDossier: string, dateCloture: Date): Promise<void> {
    await this.transaction.dossierTraitement.update({
      where: { idDossier },
      data: { statutDossier: 'CLOS_RESOLUTION_CONFIRMEE', dateCloture },
    });
  }

  async listDeclarantIds(idDossier: string): Promise<string[]> {
    const rattachements = await this.transaction.rattachementSignalement.findMany({
      where: { idDossier, dateFinRattachement: null },
      select: { signalement: { select: { idUtilisateur: true } } },
    });
    return rattachements.map(({ signalement }) => signalement.idUtilisateur);
  }

  async notifyDeclarant(idUtilisateur: string, idDossier: string): Promise<void> {
    await this.transaction.notification.create({
      data: {
        idUtilisateur,
        titre: 'Dépôt résolu et nettoyé',
        message: 'Le dépôt de déchets que vous avez signalé a été entièrement traité et sa propreté vérifiée par nos services. Merci pour votre contribution citoyenne !',
        lienCible: `/dossiers/${idDossier}`,
      },
    });
  }

  async reopenDossier(idDossier: string): Promise<void> {
    await this.transaction.dossierTraitement.update({
      where: { idDossier },
      data: { statutDossier: 'A_QUALIFIER' },
    });
    await this.transaction.contenuDossier.updateMany({
      where: { idDossier, etatContenuDossier: 'INCLUSE' },
      data: {
        etatPriseEnCharge: EtatPriseEnCharge.A_AFFECTER,
        dateAttenteEquipe: null,
        motifAttenteEquipe: null,
      },
    });
    await recalculerStatutDossier(this.transaction, idDossier);
  }
}

export class PrismaVerificationsRepository implements VerificationsRepository {
  constructor(private readonly client: PrismaClient) {}

  transaction<T>(work: (transaction: VerificationsTransaction) => Promise<T>): Promise<T> {
    return this.client.$transaction((transaction) =>
      work(new PrismaVerificationsTransaction(transaction)),
    );
  }
}
