import {
  PendingPublication,
  PendingPhotoVariant,
  PhotoVariantDecision,
  PublicationDecision,
  PublicationPhoto,
  PublicationPhotoSource,
  PublicationTarget,
  PublicPublication,
} from '../../domain/publications.js';

export interface PublicationsRepository {
  submit(input: {
    target: PublicationTarget;
    actorId: string;
    photos: PublicationPhoto[];
  }): Promise<string>;
  decide(input: {
    publicationId: string;
    actorId: string;
    decision: PublicationDecision;
    reason: string | null;
    at: Date;
  }): Promise<void>;
  listPending(limit: number): Promise<PendingPublication[]>;
  listPublic(limit: number): Promise<PublicPublication[]>;
  submitPhotoVariant(input: {
    source: PublicationPhotoSource;
    photoId: string;
    reference: string;
    submittedBy: string;
    at: Date;
  }): Promise<void>;
  decidePhotoVariant(input: {
    source: PublicationPhotoSource;
    photoId: string;
    actorId: string;
    decision: PhotoVariantDecision;
    reason: string | null;
    at: Date;
  }): Promise<void>;
  listPendingPhotoVariants(limit: number): Promise<PendingPhotoVariant[]>;
  withdrawPhotoVariant(input: {
    source: PublicationPhotoSource;
    photoId: string;
    actorId: string;
    reason: string;
    at: Date;
  }): Promise<void>;
  findPendingPhotoVariant(source: PublicationPhotoSource, photoId: string): Promise<string | null>;
  findOriginalPhoto(source: PublicationPhotoSource, photoId: string): Promise<string | null>;
  findPublicPhoto(source: PublicationPhotoSource, photoId: string): Promise<string | null>;
}

export interface PublicationPhotoStorage {
  store(upload: { mimetype: string; file: AsyncIterable<Uint8Array> }, id: string): Promise<string>;
  read(reference: string): Promise<{ mimeType: string; content: Buffer } | null>;
  remove(reference: string): Promise<void>;
}
