import {
  ExpiredPhotoMedia,
  PhotoRetentionRepository,
  PhotoRetentionStorage,
} from '../ports/photo-retention-repository.js';

export async function purgeExpiredPhotoMedia(
  repository: PhotoRetentionRepository,
  signalementStorage: PhotoRetentionStorage,
  interventionStorage: PhotoRetentionStorage,
  publicationStorage: PhotoRetentionStorage,
  at = new Date(),
  limit = 500,
): Promise<number> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
    throw new RangeError('La limite de purge doit être comprise entre 1 et 5000.');
  }

  const expired = await repository.listExpiredPhotoMedia(at, limit);
  let purged = 0;
  for (const photo of expired) {
    const originalStorage = photo.source === 'SIGNALEMENT'
      ? signalementStorage
      : interventionStorage;
    if (photo.originalReference) {
      await originalStorage.remove(photo.originalReference);
    }
    if (photo.derivedReference) {
      await publicationStorage.remove(photo.derivedReference);
    }
    if (await repository.markPhotoMediaPurged(photo.source, photo.photoId, at)) {
      purged += 1;
    }
  }
  return purged;
}
