import crypto from 'node:crypto';
import {
  assertCanDelegate,
  assertTeamLeader,
  TeamDecisionType,
  TeamDelegation,
  TeamDelegationRuleError,
  TeamAvailabilityRuleError,
  TeamAvailabilityState,
} from '../../domain/team-delegation.js';
import { TeamDelegationRepository } from '../ports/team-delegation-repository.js';

export type GrantTeamDelegationInput = {
  teamId: string;
  leaderId: string;
  delegateId: string;
  decisionType: TeamDecisionType;
  endAt: Date | null;
  reason: string | null;
};

export async function grantTeamDelegation(
  repository: TeamDelegationRepository,
  input: GrantTeamDelegationInput,
  now = new Date(),
): Promise<TeamDelegation> {
  if (input.endAt && input.endAt <= now) {
    throw new TeamDelegationRuleError('INVALID_PERIOD');
  }

  return repository.transaction(async (unit) => {
    const leader = await unit.findMembership(input.teamId, input.leaderId, now);
    const delegate = await unit.findMembershipForDelegate(input.teamId, input.delegateId, now);
    const existing = await unit.findDelegationForDecision(input.teamId, input.decisionType);

    assertCanDelegate(leader, delegate, existing, input.leaderId, now, input.endAt);

    const delegation = await unit.createDelegation({
      teamId: input.teamId,
      delegateId: input.delegateId,
      membershipStartAt: delegate.startAt,
      decisionType: input.decisionType,
      delegatedBy: input.leaderId,
      startAt: now,
      endAt: input.endAt,
      reason: input.reason,
    });

    await unit.recordAuditEvent('DELEGATION_EQUIPE_ACCORDEE', input.leaderId, input.teamId, {
      delegationId: delegation.id,
      delegateId: delegation.delegateId,
      decisionType: delegation.decisionType,
      startAt: delegation.startAt.toISOString(),
      endAt: delegation.endAt?.toISOString() ?? null,
    });

    return delegation;
  });
}

export async function listTeamDelegations(
  repository: TeamDelegationRepository,
  teamId: string,
  leaderId: string,
  now = new Date(),
): Promise<TeamDelegation[]> {
  return repository.transaction(async (unit) => {
    assertTeamLeader(await unit.findMembership(teamId, leaderId, now));
    return unit.listActiveDelegations(teamId, now);
  });
}

export async function revokeTeamDelegation(
  repository: TeamDelegationRepository,
  teamId: string,
  delegationId: string,
  leaderId: string,
  now = new Date(),
): Promise<TeamDelegation> {
  return repository.transaction(async (unit) => {
    assertTeamLeader(await unit.findMembership(teamId, leaderId, now));

    const delegation = await unit.findActiveDelegation(teamId, delegationId, now);
    if (!delegation) {
      throw new TeamDelegationRuleError('DELEGATION_NOT_FOUND');
    }

    const ended = await unit.endDelegation(teamId, delegationId, now);
    if (!ended) {
      throw new TeamDelegationRuleError('DELEGATION_NOT_FOUND');
    }

    await unit.recordAuditEvent('DELEGATION_EQUIPE_RETIREE', leaderId, teamId, {
      delegationId: ended.id,
      delegateId: ended.delegateId,
      decisionType: ended.decisionType,
      startAt: ended.startAt.toISOString(),
      endAt: ended.endAt?.toISOString() ?? null,
    });

    return ended;
  });
}

export async function updateTeamAvailability(
  repository: TeamDelegationRepository,
  input: {
    teamId: string;
    actorId: string;
    status: TeamAvailabilityState;
    validUntil: Date;
    comment: string | null;
  },
  now = new Date(),
): Promise<'UPDATED' | 'UNCHANGED'> {
  if (input.validUntil <= now) {
    throw new TeamAvailabilityRuleError('INVALID_AVAILABILITY_PERIOD');
  }
  return repository.updateAvailability({
    ...input,
    comment: input.comment?.trim() || null,
    eventId: crypto.randomUUID(),
    at: now,
  });
}

export function listTeamAvailabilityHistory(
  repository: TeamDelegationRepository,
  teamId: string,
  actorId: string,
  now = new Date(),
) {
  return repository.listAvailabilityHistory(teamId, actorId, now);
}
