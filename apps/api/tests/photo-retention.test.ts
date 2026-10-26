import { describe, expect, it } from 'vitest';
import { purgeExpiredPhotoMedia } from '../src/application/use-cases/photo-retention.js';
import type {
  ExpiredPhotoMedia,
  PhotoRetentionRepository,
  PhotoRetentionStorage,
} from '../src/application/ports/photo-retention-repository.js';

describe('Purge des médias photo expirés', () => {
  it('supprime les originaux locaux et les variantes puis marque uniquement les médias éligibles', async () => {
    const photos: ExpiredPhotoMedia[] = [
      {
        source: 'SIGNALEMENT',
        photoId: 'signalement-1',
        originalReference: 'original-1.jpg',
        derivedReference: 'public-1.jpg',
      },
      {
        source: 'INTERVENTION',
        photoId: 'intervention-1',
        originalReference: null,
        derivedReference: null,
      },
    ];
    const removed: string[] = [];
    const marked: string[] = [];
    const repository: PhotoRetentionRepository = {
      async listExpiredPhotoMedia(_at, limit) {
        return photos.slice(0, limit);
      },
      async markPhotoMediaPurged(_source, photoId) {
        marked.push(photoId);
        return photoId === 'signalement-1';
      },
    };
    const storage: PhotoRetentionStorage = {
      async remove(reference) {
        removed.push(reference);
      },
    };
    const at = new Date('2026-10-24T00:00:00.000Z');

    const count = await purgeExpiredPhotoMedia(
      repository,
      storage,
      storage,
      storage,
      at,
      2,
    );

    expect(count).toBe(1);
    expect(removed).toEqual(['original-1.jpg', 'public-1.jpg']);
    expect(marked).toEqual(['signalement-1', 'intervention-1']);
  });

  it('refuse une limite hors bornes avant d’interroger le dépôt', async () => {
    let queried = false;
    const repository: PhotoRetentionRepository = {
      async listExpiredPhotoMedia() {
        queried = true;
        return [];
      },
      async markPhotoMediaPurged() {
        return true;
      },
    };
    const storage: PhotoRetentionStorage = { async remove() {} };

    await expect(
      purgeExpiredPhotoMedia(repository, storage, storage, storage, new Date(), 5001),
    ).rejects.toThrow(RangeError);
    expect(queried).toBe(false);
  });

  it('ne marque pas un média si la suppression échoue, afin que la prochaine exécution réessaie', async () => {
    let marked = false;
    const repository: PhotoRetentionRepository = {
      async listExpiredPhotoMedia() {
        return [{
          source: 'SIGNALEMENT',
          photoId: 'signalement-2',
          originalReference: 'original-2.jpg',
          derivedReference: null,
        }];
      },
      async markPhotoMediaPurged() {
        marked = true;
        return true;
      },
    };
    const failingStorage: PhotoRetentionStorage = {
      async remove() {
        throw new Error('storage unavailable');
      },
    };

    await expect(
      purgeExpiredPhotoMedia(
        repository,
        failingStorage,
        failingStorage,
        failingStorage,
      ),
    ).rejects.toThrow('storage unavailable');
    expect(marked).toBe(false);
  });
});
