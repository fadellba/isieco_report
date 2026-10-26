import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import {
  TeamAvailabilityHistoryEntry,
  TeamAvailabilityRuleError,
  TeamAvailabilityState,
  TeamDecisionType,
  TeamDelegation,
  TeamDelegationRuleError,
  TeamMembership,
} from '../../domain/team-delegation.js';
import {
  DelegationAuditData,
  TeamDelegationRepository,
  TeamDelegationUnitOfWork,
} from '../../application/ports/team-delegation-repository.js';

function mapDelegation(record: {
  idDelegation: string;
  idEquipe: string;
  idUtilisateurDelegue: string;
  dateDebutAppartenance: Date;
  typeDecision: string;
  deleguePar: string;
  dateDebut: Date;
  dateFin: Date | null;
  motif: string | null;
}): TeamDelegation {
  return {
    id: record.idDelegation,
    teamId: record.idEquipe,
    delegateId: record.idUtilisateurDelegue,
    membershipStartAt: record.dateDebutAppartenance,
    decisionType: record.typeDecision as TeamDecisionType,
    delegatedBy: record.deleguePar,
    startAt: record.dateDebut,
    endAt: record.dateFin,
    reason: record.motif,
  };
}

export class PrismaTeamDelegationRepository implements TeamDelegationRepository {
  constructor(private readonly client: PrismaClient) {}

  async transaction<T>(work: (unit: TeamDelegationUnitOfWork) => Promise<T>): Promise<T> {
    try {
      return await this.client.$transaction((transaction) =>
        work({
          findMembership: async (teamId, userId, at) => {
            const membership = await transaction.appartenanceEquipe.findFirst({
              where: {
                idEquipe: teamId,
                idUtilisateur: userId,
                dateDebut: { lte: at },
                OR: [{ dateFin: null }, { dateFin: { gte: at } }],
                fonction: { in: ['CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN'] },
              },
              select: {
                idUtilisateur: true,
                dateDebut: true,
                fonction: true,
                utilisateur: { select: { etatCompte: true } },
              },
            });

            return membership
              ? {
                  userId: membership.idUtilisateur,
                  startAt: membership.dateDebut,
                  function: membership.fonction,
                  accountActive: membership.utilisateur.etatCompte === 'ACTIF',
                }
              : null;
          },
          findMembershipForDelegate: async (teamId, userId, at) => {
            const membership = await transaction.appartenanceEquipe.findFirst({
              where: {
                idEquipe: teamId,
                idUtilisateur: userId,
                dateDebut: { lte: at },
                OR: [{ dateFin: null }, { dateFin: { gte: at } }],
                fonction: 'AGENT_TERRAIN',
              },
              select: {
                idUtilisateur: true,
                dateDebut: true,
                fonction: true,
                utilisateur: { select: { etatCompte: true } },
              },
            });

            return membership
              ? {
                  userId: membership.idUtilisateur,
                  startAt: membership.dateDebut,
                  function: membership.fonction,
                  accountActive: membership.utilisateur.etatCompte === 'ACTIF',
                }
              : null;
          },
          findDelegationForDecision: async (teamId, decisionType) => {
            const delegation = await transaction.delegationDecisionEquipe.findFirst({
              where: {
                idEquipe: teamId,
                typeDecision: decisionType,
                dateFin: null,
              },
            });

            return delegation ? mapDelegation(delegation) : null;
          },
          findActiveDelegation: async (teamId, delegationId, at) => {
            const delegation = await transaction.delegationDecisionEquipe.findFirst({
              where: {
                idDelegation: delegationId,
                idEquipe: teamId,
                dateDebut: { lte: at },
                OR: [{ dateFin: null }, { dateFin: { gte: at } }],
              },
            });

            return delegation ? mapDelegation(delegation) : null;
          },
          listActiveDelegations: async (teamId, at) => {
            const delegations = await transaction.delegationDecisionEquipe.findMany({
              where: {
                idEquipe: teamId,
                dateDebut: { lte: at },
                OR: [{ dateFin: null }, { dateFin: { gte: at } }],
              },
              orderBy: [{ typeDecision: 'asc' }, { dateDebut: 'desc' }],
            });

            return delegations.map(mapDelegation);
          },
          createDelegation: async (input) => {
            const delegation = await transaction.delegationDecisionEquipe.create({
              data: {
                idEquipe: input.teamId,
                idUtilisateurDelegue: input.delegateId,
                dateDebutAppartenance: input.membershipStartAt,
                typeDecision: input.decisionType,
                deleguePar: input.delegatedBy,
                dateDebut: input.startAt,
                dateFin: input.endAt,
                motif: input.reason,
              },
            });

            return mapDelegation(delegation);
          },
          endDelegation: async (teamId, delegationId, at) => {
            const result = await transaction.delegationDecisionEquipe.updateMany({
              where: {
                idDelegation: delegationId,
                idEquipe: teamId,
                dateFin: null,
              },
              data: { dateFin: at },
            });

            if (result.count !== 1) {
              return null;
            }

            const delegation = await transaction.delegationDecisionEquipe.findUnique({
              where: { idDelegation: delegationId },
            });

            return delegation ? mapDelegation(delegation) : null;
          },
          recordAuditEvent: async (eventType, actorId, teamId, data: DelegationAuditData) => {
            await transaction.evenementMetier.create({
              data: {
                typeEvenement: eventType,
                origine: 'PORTAIL_GESTION',
                idActeur: actorId,
                idEquipeCible: teamId,
                donneesApres: {
                  idDelegation: data.delegationId,
                  idUtilisateurDelegue: data.delegateId,
                  typeDecision: data.decisionType,
                  dateDebut: data.startAt,
                  dateFin: data.endAt,
                } satisfies Prisma.InputJsonObject,
              },
            });
          },
        }),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new TeamDelegationRuleError('DELEGATION_ALREADY_ACTIVE');
      }

      throw error;
    }
  }

  private async assertCanUpdateAvailability(
    transaction: Prisma.TransactionClient,
    teamId: string,
    actorId: string,
    at: Date,
  ): Promise<void> {
    const team = await transaction.equipe.findUnique({
      where: { idEquipe: teamId },
      select: { etatEquipe: true },
    });
    if (!team) throw new TeamAvailabilityRuleError('TEAM_NOT_FOUND');
    if (team.etatEquipe !== 'ACTIVE') {
      throw new TeamAvailabilityRuleError('AVAILABILITY_UPDATE_FORBIDDEN');
    }

    const leader = await transaction.appartenanceEquipe.findFirst({
      where: {
        idEquipe: teamId,
        idUtilisateur: actorId,
        dateDebut: { lte: at },
        OR: [{ dateFin: null }, { dateFin: { gte: at } }],
        fonction: { in: ['CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN'] },
        utilisateur: { is: { etatCompte: 'ACTIF' } },
      },
      select: { idUtilisateur: true },
    });
    if (leader) return;

    const delegation = await transaction.delegationDecisionEquipe.findFirst({
      where: {
        idEquipe: teamId,
        idUtilisateurDelegue: actorId,
        typeDecision: 'MISE_A_JOUR_DISPONIBILITE',
        dateDebut: { lte: at },
        OR: [{ dateFin: null }, { dateFin: { gte: at } }],
        appartenanceEquipe: {
          is: {
            dateDebut: { lte: at },
            OR: [{ dateFin: null }, { dateFin: { gte: at } }],
            utilisateur: { is: { etatCompte: 'ACTIF' } },
          },
        },
      },
      select: { idDelegation: true },
    });
    if (!delegation) {
      throw new TeamAvailabilityRuleError('AVAILABILITY_UPDATE_FORBIDDEN');
    }
  }

  async updateAvailability(input: {
    teamId: string;
    actorId: string;
    status: TeamAvailabilityState;
    validUntil: Date;
    comment: string | null;
    eventId: string;
    at: Date;
  }): Promise<'UPDATED' | 'UNCHANGED'> {
    return this.client.$transaction(async (transaction) => {
      await this.assertCanUpdateAvailability(
        transaction,
        input.teamId,
        input.actorId,
        input.at,
      );
      const current = await transaction.disponibiliteEquipe.findUnique({
        where: { idEquipe: input.teamId },
      });
      if (
        current?.etatDisponibilite === input.status &&
        current.valideJusqua.getTime() === input.validUntil.getTime() &&
        current.commentaire === input.comment
      ) {
        return 'UNCHANGED';
      }

      await transaction.disponibiliteEquipe.upsert({
        where: { idEquipe: input.teamId },
        create: {
          idEquipe: input.teamId,
          etatDisponibilite: input.status,
          miseAJourPar: input.actorId,
          dateMiseAJour: input.at,
          valideJusqua: input.validUntil,
          commentaire: input.comment,
        },
        update: {
          etatDisponibilite: input.status,
          miseAJourPar: input.actorId,
          dateMiseAJour: input.at,
          valideJusqua: input.validUntil,
          commentaire: input.comment,
        },
      });
      await transaction.evenementMetier.create({
        data: {
          idEvenement: input.eventId,
          typeEvenement: 'EQUIPE_DISPONIBILITE_MISE_A_JOUR',
          origine: 'PORTAIL_GESTION',
          idActeur: input.actorId,
          idEquipeCible: input.teamId,
          ...(current
            ? {
                donneesAvant: {
                  etatDisponibilite: current.etatDisponibilite,
                  valideJusqua: current.valideJusqua.toISOString(),
                  commentaire: current.commentaire,
                },
              }
            : {}),
          donneesApres: {
            etatDisponibilite: input.status,
            valideJusqua: input.validUntil.toISOString(),
            commentaire: input.comment,
          },
        },
      });
      return 'UPDATED';
    });
  }

  async listAvailabilityHistory(
    teamId: string,
    actorId: string,
    at: Date,
  ): Promise<TeamAvailabilityHistoryEntry[]> {
    return this.client.$transaction(async (transaction) => {
      await this.assertCanUpdateAvailability(transaction, teamId, actorId, at);
      const rows = await transaction.historiqueDisponibiliteEquipe.findMany({
        where: { idEquipe: teamId },
        orderBy: { dateMiseAJour: 'asc' },
        select: {
          etatDisponibilite: true,
          miseAJourPar: true,
          dateMiseAJour: true,
          valideJusqua: true,
          commentaire: true,
        },
      });
      return rows.map((row) => ({
        status: row.etatDisponibilite as TeamAvailabilityState,
        updatedBy: row.miseAJourPar,
        updatedAt: row.dateMiseAJour,
        validUntil: row.valideJusqua,
        comment: row.commentaire,
      }));
    });
  }
}
