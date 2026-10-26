import type { PhotoRetentionLock } from '../ports/photo-retention-worker.js';

export type PhotoRetentionCycleResult =
  | { status: 'skipped' }
  | { status: 'completed'; purged: number };

export async function runPhotoRetentionCycle(
  lock: PhotoRetentionLock,
  purge: () => Promise<number>,
): Promise<PhotoRetentionCycleResult> {
  if (!(await lock.tryAcquire())) return { status: 'skipped' };

  let result: PhotoRetentionCycleResult | undefined;
  let purgeError: unknown;
  try {
    result = { status: 'completed', purged: await purge() };
  } catch (error) {
    purgeError = error;
  }

  let releaseError: unknown;
  try {
    await lock.release();
  } catch (error) {
    releaseError = error;
  }

  if (purgeError !== undefined && releaseError !== undefined) {
    throw new AggregateError(
      [purgeError, releaseError],
      'La purge photo et la libération de son verrou ont échoué.',
    );
  }
  if (purgeError !== undefined) throw purgeError;
  if (releaseError !== undefined) throw releaseError;
  if (!result) throw new Error('Le cycle de purge n’a produit aucun résultat.');
  return result;
}

export async function runPhotoRetentionWorker(input: {
  intervalMs: number;
  signal: AbortSignal;
  runCycle: () => Promise<PhotoRetentionCycleResult>;
  log: (level: 'info' | 'error', message: string, error?: unknown) => void;
}): Promise<void> {
  if (!Number.isInteger(input.intervalMs) || input.intervalMs < 1) {
    throw new RangeError('L’intervalle du worker de purge doit être un entier positif.');
  }

  while (!input.signal.aborted) {
    try {
      const result = await input.runCycle();
      if (result.status === 'skipped') {
        input.log('info', 'Purge photo ignorée : un autre worker détient le verrou PostgreSQL.');
      } else {
        input.log('info', `Cycle de purge photo terminé : ${result.purged} média(s) marqué(s).`);
      }
    } catch (error) {
      input.log('error', 'Échec du cycle de purge photo ; une nouvelle tentative aura lieu au prochain intervalle.', error);
    }

    await waitForInterval(input.intervalMs, input.signal);
  }
}

function waitForInterval(intervalMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, intervalMs);
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      resolve();
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}
