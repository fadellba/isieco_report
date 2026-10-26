import {
  TeamDecisionType,
  TeamDelegation,
  TeamAvailabilityHistoryEntry,
  TeamAvailabilityState,
  TeamMembership,
} from '../../domain/team-delegation.js';

export type DelegationAuditData = {
  delegationId: string;
  delegateId: string;
  decisionType: TeamDecisionType;
  startAt: string;
  endAt: string | null;
};

export interface TeamDelegationUnitOfWork {
  findMembership(teamId: string, userId: string, at: Date): Promise<TeamMembership | null>;
  findMembershipForDelegate(teamId: string, userId: string, at: Date): Promise<TeamMembership | null>;
  findDelegationForDecision(teamId: string, decisionType: TeamDecisionType): Promise<TeamDelegation | null>;
  findActiveDelegation(teamId: string, delegationId: string, at: Date): Promise<TeamDelegation | null>;
  listActiveDelegations(teamId: string, at: Date): Promise<TeamDelegation[]>;
  createDelegation(input: Omit<TeamDelegation, 'id'>): Promise<TeamDelegation>;
  endDelegation(teamId: string, delegationId: string, at: Date): Promise<TeamDelegation | null>;
  recordAuditEvent(
    eventType: 'DELEGATION_EQUIPE_ACCORDEE' | 'DELEGATION_EQUIPE_RETIREE',
    actorId: string,
    teamId: string,
    data: DelegationAuditData,
  ): Promise<void>;
}

export interface TeamDelegationRepository {
  transaction<T>(work: (unit: TeamDelegationUnitOfWork) => Promise<T>): Promise<T>;
  updateAvailability(input: {
    teamId: string;
    actorId: string;
    status: TeamAvailabilityState;
    validUntil: Date;
    comment: string | null;
    eventId: string;
    at: Date;
  }): Promise<'UPDATED' | 'UNCHANGED'>;
  listAvailabilityHistory(
    teamId: string,
    actorId: string,
    at: Date,
  ): Promise<TeamAvailabilityHistoryEntry[]>;
}
