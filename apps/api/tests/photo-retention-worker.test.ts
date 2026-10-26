import { describe, expect, it, vi } from 'vitest';
import pg from 'pg';
import {
  runPhotoRetentionCycle,
  runPhotoRetentionWorker,
} from '../src/application/use-cases/photo-retention-worker.js';
import type { PhotoRetentionLock } from '../src/application/ports/photo-retention-worker.js';
import { config } from '../src/config.js';
import { PostgresPhotoRetentionLock } from '../src/infrastructure/database/postgres-photo-retention-lock.js';

describe('Worker périodique de purge des photos', () => {
  it('ne lance pas de purge si un autre worker détient le verrou', async () => {
    const purge = vi.fn(async () => 0);
    const lock: PhotoRetentionLock = {
      tryAcquire: async () => false,
      release: vi.fn(async () => {}),
    };

    await expect(runPhotoRetentionCycle(lock, purge)).resolves.toEqual({ status: 'skipped' });
    expect(purge).not.toHaveBeenCalled();
    expect(lock.release).not.toHaveBeenCalled();
  });

  it('libère le verrou après une purge réussie', async () => {
    const order: string[] = [];
    const lock: PhotoRetentionLock = {
      tryAcquire: async () => true,
      release: async () => { order.push('release'); },
    };

    await expect(runPhotoRetentionCycle(lock, async () => {
      order.push('purge');
      return 12;
    })).resolves.toEqual({ status: 'completed', purged: 12 });
    expect(order).toEqual(['purge', 'release']);
  });

  it('libère le verrou même si la purge échoue', async () => {
    const release = vi.fn(async () => {});
    const lock: PhotoRetentionLock = {
      tryAcquire: async () => true,
      release,
    };

    await expect(
      runPhotoRetentionCycle(lock, async () => { throw new Error('stockage indisponible'); }),
    ).rejects.toThrow('stockage indisponible');
    expect(release).toHaveBeenCalledOnce();
  });

  it('continue au cycle suivant après une erreur et s’arrête proprement sur signal', async () => {
    const controller = new AbortController();
    const log = vi.fn();
    let cycles = 0;

    await runPhotoRetentionWorker({
      intervalMs: 1,
      signal: controller.signal,
      runCycle: async () => {
        cycles += 1;
        if (cycles === 1) throw new Error('erreur ponctuelle');
        controller.abort();
        return { status: 'completed', purged: 0 };
      },
      log,
    });

    expect(cycles).toBe(2);
    expect(log).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('nouvelle tentative'),
      expect.any(Error),
    );
    expect(log).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('0 média(s) marqué(s).'),
    );
  });

  it('refuse un intervalle invalide', async () => {
    await expect(runPhotoRetentionWorker({
      intervalMs: 0,
      signal: new AbortController().signal,
      runCycle: async () => ({ status: 'skipped' }),
      log: () => {},
    })).rejects.toThrow(RangeError);
  });

  it('empêche deux processus PostgreSQL de détenir simultanément le verrou de purge', async () => {
    const firstPool = new pg.Pool({ connectionString: config.databaseUrl, max: 1 });
    const secondPool = new pg.Pool({ connectionString: config.databaseUrl, max: 1 });
    const firstLock = new PostgresPhotoRetentionLock(firstPool);
    const secondLock = new PostgresPhotoRetentionLock(secondPool);
    let firstHeld = false;
    let secondHeld = false;

    try {
      const [firstAcquired, secondAcquired] = await Promise.all([
        firstLock.tryAcquire(),
        secondLock.tryAcquire(),
      ]);
      firstHeld = firstAcquired;
      secondHeld = secondAcquired;
      expect([firstAcquired, secondAcquired].sort()).toEqual([false, true]);
      const holder = firstAcquired ? firstLock : secondLock;
      const waiting = firstAcquired ? secondLock : firstLock;
      await expect(waiting.tryAcquire()).resolves.toBe(false);
      await holder.release();
      if (firstAcquired) firstHeld = false;
      else secondHeld = false;
      await expect(waiting.tryAcquire()).resolves.toBe(true);
      if (firstAcquired) secondHeld = true;
      else firstHeld = true;
      await waiting.release();
      if (firstAcquired) secondHeld = false;
      else firstHeld = false;
    } finally {
      if (firstHeld) await firstLock.release();
      if (secondHeld) await secondLock.release();
      await firstPool.end();
      await secondPool.end();
    }
  });
});
