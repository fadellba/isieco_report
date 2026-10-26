import { describe, expect, it } from 'vitest';
import {
  TeamDelegation,
  TeamMembership,
} from '../src/domain/team-delegation.js';
import {
  DelegationAuditData,
  TeamDelegationRepository,
  TeamDelegationUnitOfWork,
} from '../src/application/ports/team-delegation-repository.js';
import {
  grantTeamDelegation,
  listTeamDelegations,
  revokeTeamDelegation,
} from '../src/application/use-cases/team-delegations.js';

const now = new Date('2026-10-22T12:00:00.000Z');
const leader: TeamMembership = {
  userId: 'leader-1',
  startAt: new Date('2026-01-01T00:00:00.000Z'),
  function: 'CHEF_EQUIPE',
  accountActive: true,
};
const member: TeamMembership = {
  userId: 'member-1',
  startAt: new Date('2026-02-01T00:00:00.000Z'),
  function: 'AGENT_TERRAIN',
  accountActive: true,
};

class InMemoryTeamDelegationRepository implements TeamDelegationRepository {
  delegations: TeamDelegation[] = [];
  auditEvents: string[] = [];
  leaderMembership: TeamMembership | null = leader;
  delegateMembership: TeamMembership | null = member;

  transaction<T>(work: (unit: TeamDelegationUnitOfWork) => Promise<T>): Promise<T> {
    return work({
      findMembership: async (_teamId, userId) =>
        userId === leader.userId ? this.leaderMembership : null,
      findMembershipForDelegate: async (_teamId, userId) =>
        userId === member.userId ? this.delegateMembership : null,
      findDelegationForDecision: async (_teamId, decisionType) =>
        this.delegations.find(
          (delegation) => delegation.decisionType === decisionType && delegation.endAt === null,
        ) ?? null,
      findActiveDelegation: async (_teamId, delegationId) =>
        this.delegations.find(
          (delegation) => delegation.id === delegationId && delegation.endAt === null,
        ) ?? null,
      listActiveDelegations: async () =>
        this.delegations.filter((delegation) => delegation.endAt === null),
      createDelegation: async (input) => {
        const delegation = { ...input, id: `delegation-${this.delegations.length + 1}` };
        this.delegations.push(delegation);
        return delegation;
      },
      endDelegation: async (_teamId, delegationId, at) => {
        const delegation = this.delegations.find((item) => item.id === delegationId);
        if (!delegation) return null;
        delegation.endAt = at;
        return delegation;
      },
      recordAuditEvent: async (
        type: 'DELEGATION_EQUIPE_ACCORDEE' | 'DELEGATION_EQUIPE_RETIREE',
        _actorId,
        _teamId,
        _data: DelegationAuditData,
      ) => {
        this.auditEvents.push(type);
      },
    });
  }
}

describe('Délégations des responsabilités d’équipe', () => {
  it('autorise le chef actif à déléguer une responsabilité distincte à un membre actif', async () => {
    const repository = new InMemoryTeamDelegationRepository();
    const delegation = await grantTeamDelegation(repository, {
      teamId: 'team-1',
      leaderId: leader.userId,
      delegateId: member.userId,
      decisionType: 'SOUMISSION_COMPTE_RENDU',
      endAt: null,
      reason: 'Absence temporaire du chef',
    }, now);

    expect(delegation.membershipStartAt).toEqual(member.startAt);
    expect(repository.auditEvents).toEqual(['DELEGATION_EQUIPE_ACCORDEE']);
  });

  it('refuse la création par un non-chef', async () => {
    const repository = new InMemoryTeamDelegationRepository();
    await expect(grantTeamDelegation(repository, {
      teamId: 'team-1',
      leaderId: member.userId,
      delegateId: 'another-member',
      decisionType: 'REPONSE_AFFECTATION',
      endAt: null,
      reason: null,
    }, now)).rejects.toMatchObject({ rule: 'LEADER_REQUIRED' });
  });

  it('refuse un compte inactif ou un membre absent de l’équipe', async () => {
    const repository = new InMemoryTeamDelegationRepository();
    repository.delegateMembership = { ...member, accountActive: false };

    await expect(grantTeamDelegation(repository, {
      teamId: 'team-1',
      leaderId: leader.userId,
      delegateId: member.userId,
      decisionType: 'REPONSE_AFFECTATION',
      endAt: null,
      reason: null,
    }, now)).rejects.toMatchObject({ rule: 'ACTIVE_MEMBER_REQUIRED' });
  });

  it('refuse une date de fin qui précède ou égale au début', async () => {
    const repository = new InMemoryTeamDelegationRepository();
    await expect(grantTeamDelegation(repository, {
      teamId: 'team-1',
      leaderId: leader.userId,
      delegateId: member.userId,
      decisionType: 'MISE_A_JOUR_DISPONIBILITE',
      endAt: now,
      reason: null,
    }, now)).rejects.toMatchObject({ rule: 'INVALID_PERIOD' });
  });

  it('interdit deux délégations actives pour la même responsabilité', async () => {
    const repository = new InMemoryTeamDelegationRepository();
    const input = {
      teamId: 'team-1',
      leaderId: leader.userId,
      delegateId: member.userId,
      decisionType: 'REPONSE_AFFECTATION' as const,
      endAt: null,
      reason: null,
    };
    await grantTeamDelegation(repository, input, now);

    await expect(grantTeamDelegation(repository, input, now))
      .rejects.toMatchObject({ rule: 'DELEGATION_ALREADY_ACTIVE' });
  });

  it('permet au chef de consulter et retirer une délégation, avec audit', async () => {
    const repository = new InMemoryTeamDelegationRepository();
    const delegation = await grantTeamDelegation(repository, {
      teamId: 'team-1',
      leaderId: leader.userId,
      delegateId: member.userId,
      decisionType: 'SOUMISSION_COMPTE_RENDU',
      endAt: null,
      reason: null,
    }, now);

    expect(await listTeamDelegations(repository, 'team-1', leader.userId, now))
      .toHaveLength(1);
    await revokeTeamDelegation(repository, 'team-1', delegation.id, leader.userId, now);
    expect(await listTeamDelegations(repository, 'team-1', leader.userId, now))
      .toHaveLength(0);
    expect(repository.auditEvents).toEqual([
      'DELEGATION_EQUIPE_ACCORDEE',
      'DELEGATION_EQUIPE_RETIREE',
    ]);
  });
});
