import { purgeExpiredPhotoMedia } from '../application/use-cases/photo-retention.js';
import { getPrismaClient, disconnectPrismaClient } from '../infrastructure/database/prisma-client.js';
import { PrismaPhotoRetentionRepository } from '../infrastructure/database/prisma-photo-retention.repository.js';
import { PrivateInterventionPhotoStorage } from '../infrastructure/storage/private-intervention-photo-storage.js';
import { LocalPublicationPhotoStorage } from '../infrastructure/storage/publication-photo-storage.js';
import { LocalSignalementPhotoStorage } from '../infrastructure/storage/local-signalement-photo.storage.js';

async function main(): Promise<void> {
  const client = getPrismaClient();
  const repository = new PrismaPhotoRetentionRepository(client);
  const storages = [
    new LocalSignalementPhotoStorage(),
    new PrivateInterventionPhotoStorage(),
    new LocalPublicationPhotoStorage(),
  ];

  let total = 0;
  try {
    for (;;) {
      const purged = await purgeExpiredPhotoMedia(
        repository,
        storages[0],
        storages[1],
        storages[2],
      );
      total += purged;
      if (purged < 500) break;
    }
    console.info(`Purge des médias expirés terminée : ${total} photo(s) traitée(s).`);
  } catch (error) {
    console.error('Échec de la purge des médias photo expirés.', error);
    process.exitCode = 1;
  } finally {
    await disconnectPrismaClient();
  }
}

await main();
