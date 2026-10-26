import { PrismaClient } from '../../generated/prisma/client.js';
import { CarteStatsRepository, MapData } from '../../application/ports/carte-stats-repository.js';

export class PrismaCarteStatsRepository implements CarteStatsRepository {
  constructor(private readonly client: PrismaClient) {}

  async getMapData(): Promise<MapData> {
    const [cases, reports, interventions, nonGeolocatedReports] = await Promise.all([
      this.client.dossierTraitement.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
        select: {
          idDossier: true,
          referenceDossier: true,
          descriptionSynthese: true,
          priorite: true,
          statutDossier: true,
          latitude: true,
          longitude: true,
          dateCreationDossier: true,
        },
      }),
      this.client.signalement.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
          statutSignalement: { notIn: ['RATTACHE', 'REJETE'] },
        },
        select: {
          idSignalement: true,
          description: true,
          statutSignalement: true,
          latitude: true,
          longitude: true,
          dateSoumission: true,
        },
      }),
      this.client.intervention.findMany({
        where: {
          statutIntervention: { not: 'ANNULEE' },
          affectation: {
            etatAffectation: { notIn: ['REMPLACEE', 'ANNULEE'] },
            contenuDossier: {
              dossierTraitement: { latitude: { not: null }, longitude: { not: null } },
            },
          },
        },
        select: {
          idIntervention: true,
          dateHeureDebut: true,
          dateHeureFin: true,
          statutIntervention: true,
          resultatIntervention: true,
          affectation: {
            select: {
              idAffectation: true,
              dateHeureAffectation: true,
              equipe: { select: { nomEquipe: true } },
              contenuDossier: {
                select: {
                  dossierTraitement: {
                    select: {
                      referenceDossier: true,
                      descriptionSynthese: true,
                      priorite: true,
                      latitude: true,
                      longitude: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.client.signalement.findMany({
        where: { OR: [{ latitude: null }, { longitude: null }] },
        orderBy: { dateSoumission: 'asc' },
        select: {
          idSignalement: true,
          description: true,
          descriptionLocalisation: true,
          statutSignalement: true,
          dateSoumission: true,
        },
      }),
    ]);

    return {
      cases: cases.map((item) => ({
        id: item.idDossier,
        reference: item.referenceDossier,
        description: item.descriptionSynthese,
        priority: item.priorite,
        status: item.statutDossier,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        createdAt: item.dateCreationDossier,
      })),
      reports: reports.map((item) => ({
        id: item.idSignalement,
        description: item.description,
        status: item.statutSignalement,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        submittedAt: item.dateSoumission,
      })),
      interventions: interventions.map((item) => ({
        id: item.idIntervention,
        startedAt: item.dateHeureDebut,
        endedAt: item.dateHeureFin,
        status: item.statutIntervention,
        result: item.resultatIntervention,
        assignmentId: item.affectation.idAffectation,
        assignedAt: item.affectation.dateHeureAffectation,
        teamName: item.affectation.equipe.nomEquipe,
        caseReference: item.affectation.contenuDossier.dossierTraitement.referenceDossier,
        caseDescription: item.affectation.contenuDossier.dossierTraitement.descriptionSynthese,
        casePriority: item.affectation.contenuDossier.dossierTraitement.priorite,
        latitude: Number(item.affectation.contenuDossier.dossierTraitement.latitude),
        longitude: Number(item.affectation.contenuDossier.dossierTraitement.longitude),
      })),
      nonGeolocatedReports: nonGeolocatedReports.map((item) => ({
        id: item.idSignalement,
        description: item.description,
        locationDescription: item.descriptionLocalisation,
        status: item.statutSignalement,
        submittedAt: item.dateSoumission,
      })),
    };
  }

  countReports(): Promise<number> {
    return this.client.signalement.count();
  }

  countCases(): Promise<number> {
    return this.client.dossierTraitement.count();
  }

  countResolvedCases(): Promise<number> {
    return this.client.dossierTraitement.count({
      where: { statutDossier: 'CLOS_RESOLUTION_CONFIRMEE' },
    });
  }

  countAssignments(): Promise<number> {
    return this.client.affectation.count();
  }

  countCompletedInterventions(): Promise<number> {
    return this.client.intervention.count({ where: { statutIntervention: 'TERMINEE' } });
  }

  countVerifiedResolutions(): Promise<number> {
    return this.client.verificationResolution.count({
      where: { resultatVerification: 'CONFORME_RESOLU' },
    });
  }

  countReopenings(): Promise<number> {
    return this.client.evenementMetier.count({ where: { typeEvenement: 'DOSSIER_REOUVERT' } });
  }
}
