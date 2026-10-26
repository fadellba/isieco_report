import { PrismaClient } from '../src/generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';
import { PrismaSignalementsRepository } from '../src/infrastructure/database/prisma-signalements.repository.js';
import { SignalementIdempotencyConflictError } from '../src/domain/signalements.js';

function createRepositoryHarness() {
  const records = new Map<string, { empreinteRequete: string; idSignalement: string }>();
  const created = {
    signalements: vi.fn(),
    evenements: vi.fn(),
    notifications: vi.fn(),
  };
  const keyFor = (idUtilisateur: string, cleIdempotence: string) =>
    `${idUtilisateur}:${cleIdempotence}`;
  const idempotenceSignalement = {
    findUnique: vi.fn(async ({ where }: {
      where: { idUtilisateur_cleIdempotence: { idUtilisateur: string; cleIdempotence: string } };
    }) => records.get(keyFor(
      where.idUtilisateur_cleIdempotence.idUtilisateur,
      where.idUtilisateur_cleIdempotence.cleIdempotence,
    )) ?? null),
    create: vi.fn(async ({ data }: {
      data: {
        idUtilisateur: string;
        cleIdempotence: string;
        empreinteRequete: string;
        idSignalement: string;
      };
    }) => {
      records.set(keyFor(data.idUtilisateur, data.cleIdempotence), {
        empreinteRequete: data.empreinteRequete,
        idSignalement: data.idSignalement,
      });
    }),
  };
  const transaction = {
    idempotenceSignalement,
    signalement: { create: vi.fn(async () => { created.signalements(); }) },
    evenementMetier: { create: vi.fn(async () => { created.evenements(); }) },
    notification: { create: vi.fn(async () => { created.notifications(); }) },
  };
  const client = {
    $transaction: async <T>(callback: (trx: typeof transaction) => Promise<T>) =>
      callback(transaction),
    idempotenceSignalement,
  } as unknown as PrismaClient;

  return {
    repository: new PrismaSignalementsRepository(client),
    created,
  };
}

const input = {
  idUtilisateur: '00000000-0000-0000-0000-000000000001',
  clientType: 'MOBILE',
  description: 'Dépôt de déchets près du marché',
  latitude: 14.67,
  longitude: -17.43,
  categories: [{ idTypeDechet: 'type-a', quantiteEstimee: '2 sacs' }],
};

describe('signalement creation idempotency', () => {
  it('returns the original resource and does not repeat side effects for a matching retry', async () => {
    const { repository, created } = createRepositoryHarness();
    const firstId = await repository.create(input, 'signalement-a', {
      key: 'mobile-action-1',
      requestHash: 'a'.repeat(64),
    });
    const retryId = await repository.create(input, 'signalement-b', {
      key: 'mobile-action-1',
      requestHash: 'a'.repeat(64),
    });

    expect(retryId).toBe(firstId);
    expect(created.signalements).toHaveBeenCalledTimes(1);
    expect(created.evenements).toHaveBeenCalledTimes(1);
    expect(created.notifications).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of a key with a different request fingerprint', async () => {
    const { repository, created } = createRepositoryHarness();
    await repository.create(input, 'signalement-a', {
      key: 'mobile-action-1',
      requestHash: 'a'.repeat(64),
    });

    await expect(repository.create(input, 'signalement-b', {
      key: 'mobile-action-1',
      requestHash: 'b'.repeat(64),
    })).rejects.toBeInstanceOf(SignalementIdempotencyConflictError);
    expect(created.signalements).toHaveBeenCalledTimes(1);
  });
});
