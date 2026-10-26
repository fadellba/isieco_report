import pg from 'pg';
import { runPhotoRetentionCycle, runPhotoRetentionWorker } from '../application/use-cases/photo-retention-worker.js';
import { purgeExpiredPhotoMedia } from '../application/use-cases/photo-retention.js';
import { config } from '../config.js';
import { disconnectPrismaClient, getPrismaClient } from '../infrastructure/database/prisma-client.js';
import { PrismaPhotoRetentionRepository } from '../infrastructure/database/prisma-photo-retention.repository.js';
import { PostgresPhotoRetentionLock } from '../infrastructure/database/postgres-photo-retention-lock.js';
import { PrivateInterventionPhotoStorage } from '../infrastructure/storage/private-intervention-photo-storage.js';
import { LocalPublicationPhotoStorage } from '../infrastructure/storage/publication-photo-storage.js';
import { LocalSignalementPhotoStorage } from '../infrastructure/storage/local-signalement-photo.storage.js';

async function main(): Promise<void> {
  const client = getPrismaClient();
  const repository = new PrismaPhotoRetentionRepository(client);
  const signalementStorage = new LocalSignalementPhotoStorage();
  const interventionStorage = new PrivateInterventionPhotoStorage();
  const publicationStorage = new LocalPublicationPhotoStorage();
  const lockPool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  const lock = new PostgresPhotoRetentionLock(lockPool);
  const controller = new AbortController();
  const stop = () => controller.abort();

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    await runPhotoRetentionWorker({
      intervalMs: config.photoRetentionIntervalMs,
      signal: controller.signal,
      runCycle: () => runPhotoRetentionCycle(lock, async () => {
        let total = 0;
        for (;;) {
          const purged = await purgeExpiredPhotoMedia(
            repository,
            signalementStorage,
            interventionStorage,
            publicationStorage,
          );
          total += purged;
          if (purged < 500) return total;
        }
      }),
      log: (level, message, error) => {
        const context = error ? { error } : undefined;
        if (level === 'error') console.error(message, context);
        else console.info(message);
      },
    });
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await lockPool.end();
    await disconnectPrismaClient();
  }
}

main().catch((error: unknown) => {
  console.error('Le worker de purge photo s’est arrêté de manière inattendue.', error);
  process.exitCode = 1;
});
