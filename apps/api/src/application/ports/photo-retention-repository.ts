export type ExpiredPhotoMedia = {
  source: 'SIGNALEMENT' | 'INTERVENTION';
  photoId: string;
  originalReference: string | null;
  derivedReference: string | null;
};

export interface PhotoRetentionRepository {
  listExpiredPhotoMedia(at: Date, limit: number): Promise<ExpiredPhotoMedia[]>;
  markPhotoMediaPurged(source: ExpiredPhotoMedia['source'], photoId: string, at: Date): Promise<boolean>;
}

export interface PhotoRetentionStorage {
  remove(reference: string): Promise<void>;
}
