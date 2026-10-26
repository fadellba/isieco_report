import { PrismaClient } from '../../generated/prisma/client.js';
import { QualificationInboxItem } from '../../domain/qualification.js';
import { QualificationRepository } from '../../application/ports/qualification-repository.js';

class InvalidComplementTransitionError extends Error {}

export class PrismaQualificationRepository implements QualificationRepository {
  constructor(private readonly client: PrismaClient) {}

  async listInbox(): Promise<QualificationInboxItem[]> {
    const rows = await this.client.signalement.findMany({
      where: { statutSignalement: { in: ['SOUMIS', 'EN_COURS_DE_QUALIFICATION'] } },
      orderBy: { dateSoumission: 'asc' },
      select: {
        idSignalement: true,
        dateSoumission: true,
        description: true,
        latitude: true,
        longitude: true,
        descriptionLocalisation: true,
        statutSignalement: true,
        utilisateurSignalementIdUtilisateurToutilisateur: { select: { nom: true, prenom: true } },
        _count: { select: { photoSignalement: true } },
      },
    });
    return rows.map((row) => ({
      idSignalement: row.idSignalement,
      dateSoumission: row.dateSoumission,
      description: row.description,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      descriptionLocalisation: row.descriptionLocalisation,
      statutSignalement: row.statutSignalement,
      nomDeclarant: row.utilisateurSignalementIdUtilisateurToutilisateur.nom,
      prenomDeclarant: row.utilisateurSignalementIdUtilisateurToutilisateur.prenom,
      nbPhotos: row._count.photoSignalement,
    }));
  }

  async startExamination(idSignalement: string, idActeur: string): Promise<'UPDATED' | 'NOT_FOUND' | 'INVALID_STATE'> {
    return this.client.$transaction(async (trx) => {
      const result = await trx.signalement.updateMany({
        where: { idSignalement, statutSignalement: 'SOUMIS' },
        data: { statutSignalement: 'EN_COURS_DE_QUALIFICATION' },
      });
      if (result.count === 0) {
        const existing = await trx.signalement.findUnique({
          where: { idSignalement },
          select: { idSignalement: true },
        });
        return existing ? 'INVALID_STATE' : 'NOT_FOUND';
      }
      await trx.evenementMetier.create({
        data: {
          typeEvenement: 'SIGNALEMENT_EN_QUALIFICATION',
          origine: 'PORTAIL_GESTION',
          idActeur,
          idSignalementCible: idSignalement,
          motif: "Prise en charge par l'agent de qualification",
        },
      });
      return 'UPDATED';
    });
  }

  async accept(input: { idSignalement: string; idActeur: string; motif?: string }): Promise<'UPDATED' | 'NOT_FOUND' | 'INVALID_STATE'> {
    return this.client.$transaction(async (trx) => {
      const result = await trx.signalement.updateMany({
        where: {
          idSignalement: input.idSignalement,
          statutSignalement: { in: ['SOUMIS', 'EN_COURS_DE_QUALIFICATION'] },
        },
        data: {
          statutSignalement: 'ACCEPTE_POUR_RATTACHEMENT',
          decisionPar: input.idActeur,
          dateDecision: new Date(),
          motifDecision: input.motif || 'Signalement recevable et conforme',
        },
      });
      if (result.count === 0) {
        const existing = await trx.signalement.findUnique({
          where: { idSignalement: input.idSignalement },
          select: { idSignalement: true },
        });
        return existing ? 'INVALID_STATE' : 'NOT_FOUND';
      }
      const signalement = await trx.signalement.findUniqueOrThrow({
        where: { idSignalement: input.idSignalement },
        select: {
          idUtilisateur: true,
          contenuSignalement: { select: { idTypeDechet: true } },
          qualificationSignalement: {
            where: { etatQualification: 'ACTIVE' },
            select: { idTypeDechet: true },
          },
        },
      });
      const motifDecision = input.motif || 'Signalement recevable et conforme';
      const qualificationsExistantes = new Set(
        signalement.qualificationSignalement.map((qualification) => qualification.idTypeDechet),
      );
      const qualificationsAcreer = signalement.contenuSignalement
        .filter((contenu) => !qualificationsExistantes.has(contenu.idTypeDechet))
        .map((contenu) => ({
          idSignalement: input.idSignalement,
          idTypeDechet: contenu.idTypeDechet,
          qualifiePar: input.idActeur,
        }));
      if (qualificationsAcreer.length > 0) {
        await trx.qualificationSignalement.createMany({ data: qualificationsAcreer });
      }
      await trx.evenementMetier.create({
        data: {
          typeEvenement: 'SIGNALEMENT_ACCEPTE',
          origine: 'PORTAIL_GESTION',
          idActeur: input.idActeur,
          idSignalementCible: input.idSignalement,
          motif: input.motif || 'Signalement recevable pour traitement',
        },
      });
      await trx.historiquePoints.create({
        data: {
          idUtilisateur: signalement.idUtilisateur,
          idSignalement: input.idSignalement,
          points: 10,
          motif: 'Attribution pour signalement recevable',
          typeMouvement: 'ATTRIBUTION',
        },
      });
      await trx.notification.create({
        data: {
          idUtilisateur: signalement.idUtilisateur,
          titre: 'Signalement accepté (+10 points)',
          message: "Votre signalement a été validé par les services et orienté vers un dossier d'intervention.",
          lienCible: `/signalements/${input.idSignalement}`,
        },
      });
      return 'UPDATED';
    });
  }

  async reject(input: { idSignalement: string; idActeur: string; motif: string }): Promise<'UPDATED' | 'NOT_FOUND' | 'INVALID_STATE'> {
    return this.client.$transaction(async (trx) => {
      const result = await trx.signalement.updateMany({
        where: {
        idSignalement: input.idSignalement,
        statutSignalement: { in: ['SOUMIS', 'EN_COURS_DE_QUALIFICATION'] },
        },
        data: {
        statutSignalement: 'REJETE',
        decisionPar: input.idActeur,
        dateDecision: new Date(),
        motifDecision: input.motif,
        },
      });
      if (result.count === 0) {
        const existing = await trx.signalement.findUnique({
        where: { idSignalement: input.idSignalement },
        select: { idSignalement: true },
        });
        return existing ? 'INVALID_STATE' : 'NOT_FOUND';
      }
      const signalement = await trx.signalement.findUniqueOrThrow({
        where: { idSignalement: input.idSignalement },
        select: { idUtilisateur: true },
      });
      await trx.evenementMetier.create({
        data: {
          typeEvenement: 'SIGNALEMENT_REJETE',
          origine: 'PORTAIL_GESTION',
          idActeur: input.idActeur,
          idSignalementCible: input.idSignalement,
          motif: input.motif,
        },
      });
      await trx.notification.create({
        data: {
          idUtilisateur: signalement.idUtilisateur,
          titre: 'Signalement non retenu',
          message: `Votre signalement n'a pas pu être retenu. Motif : ${input.motif}`,
          lienCible: `/signalements/${input.idSignalement}`,
        },
      });
      return 'UPDATED';
    });
  }

  async correctAcceptance(input: {
    idSignalement: string;
    idActeur: string;
    motif: string;
  }): Promise<'UPDATED' | 'NOT_FOUND' | 'INVALID_STATE'> {
    return this.client.$transaction(async (trx) => {
      const result = await trx.signalement.updateMany({
        where: {
          idSignalement: input.idSignalement,
          statutSignalement: 'ACCEPTE_POUR_RATTACHEMENT',
        },
        data: {
          statutSignalement: 'REJETE',
          decisionPar: input.idActeur,
          dateDecision: new Date(),
          motifDecision: input.motif,
        },
      });
      if (result.count === 0) {
        const existing = await trx.signalement.findUnique({
          where: { idSignalement: input.idSignalement },
          select: { idSignalement: true },
        });
        return existing ? 'INVALID_STATE' : 'NOT_FOUND';
      }

      const attribution = await trx.historiquePoints.findFirst({
        where: {
          idSignalement: input.idSignalement,
          typeMouvement: 'ATTRIBUTION',
        },
        select: { idPoint: true, idUtilisateur: true, points: true },
      });
      if (attribution) {
        await trx.historiquePoints.createMany({
          data: [{
            idUtilisateur: attribution.idUtilisateur,
            idSignalement: input.idSignalement,
            points: -attribution.points,
            motif: `Compensation de l'acceptation corrigée : ${input.motif}`,
            typeMouvement: 'COMPENSATION',
            idPointOrigine: attribution.idPoint,
          }],
          skipDuplicates: true,
        });
      }

      const signalement = await trx.signalement.findUniqueOrThrow({
        where: { idSignalement: input.idSignalement },
        select: { idUtilisateur: true },
      });
      await trx.evenementMetier.create({
        data: {
          typeEvenement: 'SIGNALEMENT_ACCEPTATION_CORRIGEE',
          origine: 'PORTAIL_GESTION',
          idActeur: input.idActeur,
          idSignalementCible: input.idSignalement,
          motif: input.motif,
        },
      });
      await trx.notification.create({
        data: {
          idUtilisateur: signalement.idUtilisateur,
          titre: 'Décision concernant votre signalement corrigée',
          message: `L'acceptation de votre signalement a été corrigée. Motif : ${input.motif}`,
          lienCible: `/signalements/${input.idSignalement}`,
        },
      });
      return 'UPDATED';
    });
  }

  async requestComplement(input: {
    idSignalement: string;
    idActeur: string;
    motif: string;
    idDemande: string;
  }): Promise<'UPDATED' | 'NOT_FOUND' | 'INVALID_STATE'> {
    return this.client.$transaction(async (trx) => {
      const update = await trx.signalement.updateMany({
        where: {
          idSignalement: input.idSignalement,
          statutSignalement: 'EN_COURS_DE_QUALIFICATION',
        },
        data: { statutSignalement: 'A_COMPLETER' },
      });
      if (update.count !== 1) {
        const existing = await trx.signalement.findUnique({
          where: { idSignalement: input.idSignalement },
          select: { idSignalement: true },
        });
        return existing ? 'INVALID_STATE' : 'NOT_FOUND';
      }

      const signalement = await trx.signalement.findUniqueOrThrow({
        where: { idSignalement: input.idSignalement },
        select: { idUtilisateur: true },
      });
      await trx.demandeComplement.create({
        data: {
          idDemande: input.idDemande,
          idSignalement: input.idSignalement,
          demandePar: input.idActeur,
          motif: input.motif,
        },
      });
      await trx.evenementMetier.create({
        data: {
          typeEvenement: 'COMPLEMENT_DEMANDE',
          origine: 'PORTAIL_GESTION',
          idActeur: input.idActeur,
          idSignalementCible: input.idSignalement,
          donneesApres: { idDemande: input.idDemande },
          motif: input.motif,
        },
      });
      await trx.notification.create({
        data: {
          idUtilisateur: signalement.idUtilisateur,
          titre: 'Complément demandé',
          message: input.motif,
          lienCible: `/signalements/${input.idSignalement}`,
        },
      });
      return 'UPDATED';
    });
  }

  async respondToComplement(input: {
    idSignalement: string;
    idDemande: string;
    idActeur: string;
    contenu: string;
    idReponse: string;
  }): Promise<'UPDATED' | 'NOT_FOUND' | 'INVALID_STATE'> {
    try {
      return await this.client.$transaction(async (trx) => {
        const demande = await trx.demandeComplement.findUnique({
          where: { idDemande: input.idDemande },
          select: {
            idSignalement: true,
            demandePar: true,
            etatDemande: true,
            signalement: { select: { idUtilisateur: true, statutSignalement: true } },
          },
        });
        if (
          !demande ||
          demande.idSignalement !== input.idSignalement ||
          demande.signalement.idUtilisateur !== input.idActeur
        ) {
          return 'NOT_FOUND';
        }
        if (
          demande.etatDemande !== 'EN_ATTENTE' ||
          demande.signalement.statutSignalement !== 'A_COMPLETER'
        ) {
          return 'INVALID_STATE';
        }

        const demandeUpdated = await trx.demandeComplement.updateMany({
          where: { idDemande: input.idDemande, etatDemande: 'EN_ATTENTE' },
          data: { etatDemande: 'REPONDUE' },
        });
        if (demandeUpdated.count !== 1) return 'INVALID_STATE';

        const signalementUpdated = await trx.signalement.updateMany({
          where: {
            idSignalement: input.idSignalement,
            idUtilisateur: input.idActeur,
            statutSignalement: 'A_COMPLETER',
          },
          data: { statutSignalement: 'EN_COURS_DE_QUALIFICATION' },
        });
        if (signalementUpdated.count !== 1) {
          throw new InvalidComplementTransitionError();
        }

        await trx.reponseComplement.create({
          data: {
            idReponse: input.idReponse,
            idDemande: input.idDemande,
            reponduPar: input.idActeur,
            contenu: input.contenu,
          },
        });
        await trx.evenementMetier.create({
          data: {
            typeEvenement: 'COMPLEMENT_REPONSE',
            origine: 'INTERFACE_CITOYEN',
            idActeur: input.idActeur,
            idSignalementCible: input.idSignalement,
            donneesApres: { idDemande: input.idDemande, idReponse: input.idReponse },
            motif: 'Réponse du déclarant à la demande de complément',
          },
        });
        await trx.notification.create({
          data: {
            idUtilisateur: demande.demandePar,
            titre: 'Complément transmis',
            message: 'Le déclarant a répondu à votre demande de complément.',
            lienCible: `/signalements/${input.idSignalement}`,
          },
        });
        return 'UPDATED';
      });
    } catch (error) {
      if (error instanceof InvalidComplementTransitionError) return 'INVALID_STATE';
      throw error;
    }
  }
}
