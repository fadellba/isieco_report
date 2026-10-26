import { PrismaClient } from '../../generated/prisma/client.js';
import {
  ExpiredPhotoMedia,
  PhotoRetentionRepository,
} from '../../application/ports/photo-retention-repository.js';

export class PrismaPhotoRetentionRepository implements PhotoRetentionRepository {
  constructor(private readonly client: PrismaClient) {}

  async listExpiredPhotoMedia(at: Date, limit: number): Promise<ExpiredPhotoMedia[]> {
    const [signalementPhotos, interventionPhotos] = await Promise.all([
      this.client.photoSignalement.findMany({
        where: { dateExpiration: { lte: at }, mediaPurgeAt: null },
        orderBy: { dateExpiration: 'asc' },
        take: limit,
        select: {
          idPhotoSignalement: true,
          referencePhoto: true,
          referencePhotoPublique: true,
          mediaStockeeLocale: true,
        },
      }),
      this.client.photoIntervention.findMany({
        where: { dateExpiration: { lte: at }, mediaPurgeAt: null },
        orderBy: { dateExpiration: 'asc' },
        take: limit,
        select: {
          idPhotoIntervention: true,
          referencePhoto: true,
          referencePhotoPublique: true,
          mediaStockeeLocale: true,
        },
      }),
    ]);

    return [
      ...signalementPhotos.map((photo) => ({
        source: 'SIGNALEMENT' as const,
        photoId: photo.idPhotoSignalement,
        originalReference: photo.mediaStockeeLocale ? photo.referencePhoto : null,
        derivedReference: photo.referencePhotoPublique,
      })),
      ...interventionPhotos.map((photo) => ({
        source: 'INTERVENTION' as const,
        photoId: photo.idPhotoIntervention,
        originalReference: photo.mediaStockeeLocale ? photo.referencePhoto : null,
        derivedReference: photo.referencePhotoPublique,
      })),
    ].sort((left, right) => left.photoId.localeCompare(right.photoId)).slice(0, limit);
  }

  async markPhotoMediaPurged(
    source: ExpiredPhotoMedia['source'],
    photoId: string,
    at: Date,
  ): Promise<boolean> {
    const result = source === 'SIGNALEMENT'
      ? await this.client.photoSignalement.updateMany({
          where: {
            idPhotoSignalement: photoId,
            dateExpiration: { lte: at },
            mediaPurgeAt: null,
          },
          data: { mediaPurgeAt: at },
        })
      : await this.client.photoIntervention.updateMany({
          where: {
            idPhotoIntervention: photoId,
            dateExpiration: { lte: at },
            mediaPurgeAt: null,
          },
          data: { mediaPurgeAt: at },
        });
    return result.count === 1;
  }
}
