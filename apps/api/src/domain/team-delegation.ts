export const teamDecisionTypes = [
  'REPONSE_AFFECTATION',
  'MISE_A_JOUR_DISPONIBILITE',
  'SOUMISSION_COMPTE_RENDU',
] as const;

export type TeamDecisionType = (typeof teamDecisionTypes)[number];

export type TeamMembership = {
  userId: string;
  startAt: Date;
  function: string;
  accountActive: boolean;
};

export type TeamDelegation = {
  id: string;
  teamId: string;
  delegateId: string;
  membershipStartAt: Date;
  decisionType: TeamDecisionType;
  delegatedBy: string;
  startAt: Date;
  endAt: Date | null;
  reason: string | null;
};

export type TeamAvailabilityState = 'DISPONIBLE' | 'INDISPONIBLE';

export type TeamAvailabilityHistoryEntry = {
  status: TeamAvailabilityState;
  updatedBy: string;
  updatedAt: Date;
  validUntil: Date;
  comment: string | null;
};

export class TeamDelegationRuleError extends Error {
  constructor(
    readonly rule:
      | 'LEADER_REQUIRED'
      | 'ACTIVE_MEMBER_REQUIRED'
      | 'DELEGATION_ALREADY_ACTIVE'
      | 'INVALID_PERIOD'
      | 'DELEGATION_NOT_FOUND',
  ) {
    super(rule);
    this.name = 'TeamDelegationRuleError';
  }
}

export class TeamAvailabilityRuleError extends Error {
  constructor(
    readonly rule:
      | 'TEAM_NOT_FOUND'
      | 'AVAILABILITY_UPDATE_FORBIDDEN'
      | 'INVALID_AVAILABILITY_PERIOD',
  ) {
    super(rule);
    this.name = 'TeamAvailabilityRuleError';
  }
}

const leaderFunctions = new Set(['CHEF_EQUIPE', 'CHEF_EQUIPE_TERRAIN']);

export function assertTeamLeader(membership: TeamMembership | null): asserts membership is TeamMembership {
  if (
    !membership ||
    !membership.accountActive ||
    !leaderFunctions.has(membership.function)
  ) {
    throw new TeamDelegationRuleError('LEADER_REQUIRED');
  }
}

export function assertCanDelegate(
  leader: TeamMembership | null,
  delegate: TeamMembership | null,
  existingDelegation: TeamDelegation | null,
  leaderId: string,
  startAt: Date,
  endAt: Date | null,
): asserts delegate is TeamMembership {
  assertTeamLeader(leader);

  if (
    !delegate ||
    !delegate.accountActive ||
    delegate.userId === leaderId ||
    leaderFunctions.has(delegate.function)
  ) {
    throw new TeamDelegationRuleError('ACTIVE_MEMBER_REQUIRED');
  }

  if (endAt && endAt <= startAt) {
    throw new TeamDelegationRuleError('INVALID_PERIOD');
  }

  if (existingDelegation) {
    throw new TeamDelegationRuleError('DELEGATION_ALREADY_ACTIVE');
  }
}
