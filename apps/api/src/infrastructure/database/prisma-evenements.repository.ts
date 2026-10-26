import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import {
  AuditEvent,
  AuditEventFilters,
  CreateAuditCorrection,
  CreateAuditEvent,
  EvenementsRepository,
  EventTargets,
} from '../../application/ports/evenements-repository.js';

export class PrismaEvenementsRepository implements EvenementsRepository {
  constructor(private readonly client: PrismaClient) {}

  async list(filters: AuditEventFilters, limit: number): Promise<AuditEvent[]> {
    const events = await this.client.evenementMetier.findMany({
      where: {
        AND: [
          ...(filters.typeEvenement ? [{ typeEvenement: filters.typeEvenement }] : []),
          ...(filters.idActeur ? [{ idActeur: filters.idActeur }] : []),
          ...(filters.idDossierCible ? [{ idDossierCible: filters.idDossierCible }] : []),
          ...(filters.idSignalementCible
            ? [{ idSignalementCible: filters.idSignalementCible }]
            : []),
          ...(filters.allowedEventTypes
            ? [{ typeEvenement: { in: filters.allowedEventTypes } }]
            : []),
        ],
      },
      orderBy: { dateEnregistrement: 'desc' },
      take: limit,
      include: {
        utilisateurEvenementMetierIdActeurToutilisateur: {
          select: { nom: true, prenom: true },
        },
      },
    });

    return events.map(({ utilisateurEvenementMetierIdActeurToutilisateur, ...event }) => ({
      ...event,
      nomActeur: utilisateurEvenementMetierIdActeurToutilisateur?.nom ?? null,
      prenomActeur: utilisateurEvenementMetierIdActeurToutilisateur?.prenom ?? null,
    }));
  }

  async getCorrectionTargets(idEvenement: string): Promise<EventTargets | null> {
    return this.client.evenementMetier.findUnique({
      where: { idEvenement },
      select: {
        idSignalementCible: true,
        idDossierCible: true,
        idRattachementCible: true,
        idAffectationCible: true,
        idInterventionCible: true,
        idVerificationCible: true,
        idUtilisateurCible: true,
        idEquipeCible: true,
        idTypeDechetCible: true,
        idCompetenceEquipeCible: true,
        idDossierContenuCible: true,
        idTypeDechetContenuCible: true,
      },
    });
  }

  async createCorrection(input: CreateAuditCorrection): Promise<string> {
    const {
      typeEvenement,
      actorId,
      originalEventId,
      donneesApres,
      motif,
      ...targets
    } = input;
    const correction = await this.client.evenementMetier.create({
      data: {
        ...targets,
        typeEvenement,
        origine: 'PORTAIL_GESTION',
        idActeur: actorId,
        idEvenementCorrige: originalEventId,
        donneesApres: donneesApres == null
          ? undefined
          : donneesApres as Prisma.InputJsonValue,
        motif,
      },
      select: { idEvenement: true },
    });
    return correction.idEvenement;
  }

  async contenuDossierExists(idDossier: string, idTypeDechet: string): Promise<boolean> {
    const record = await this.client.contenuDossier.findUnique({
      where: { idDossier_idTypeDechet: { idDossier, idTypeDechet } },
      select: { idDossier: true },
    });
    return record !== null;
  }

  async create(input: CreateAuditEvent): Promise<string> {
    const { actorId, ...event } = input;
    const created = await this.client.evenementMetier.create({
      data: {
        ...event,
        origine: 'PORTAIL_GESTION',
        idActeur: actorId,
      },
      select: { idEvenement: true },
    });
    return created.idEvenement;
  }
}
