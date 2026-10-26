import {
  CreateSignalementInput,
  NearbySignalement,
  SignalementDetail,
  SignalementSummary,
} from '../../domain/signalements.js';

export interface SignalementsRepository {
  create(
    input: CreateSignalementInput,
    idSignalement: string,
    idempotency?: { key: string; requestHash: string },
  ): Promise<string>;
  listByUser(idUtilisateur: string): Promise<SignalementSummary[]>;
  findDetail(idSignalement: string): Promise<SignalementDetail | null>;
  findOwner(idSignalement: string): Promise<string | null>;
  createPhoto(input: {
    idPhoto: string;
    idSignalement: string;
    referencePhoto: string;
    description: string | null;
  }): Promise<void>;
  findPhoto(idSignalement: string, idPhoto: string): Promise<string | null>;
  findCandidates(idSignalement: string): Promise<{
    target: { latitude: number; longitude: number } | null;
    others: NearbySignalement[];
  } | null>;
}

export type PrivateImageUpload = {
  mimeType: string;
  stream: AsyncIterable<Uint8Array>;
};

export interface SignalementPhotoStorage {
  store(upload: PrivateImageUpload, idPhoto: string): Promise<string>;
  remove(referencePhoto: string): Promise<void>;
  read(referencePhoto: string): Promise<{ content: Buffer; mimeType: string }>;
}
