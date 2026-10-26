import {
  InterventionMembership,
  InterventionMission,
} from '../../domain/interventions.js';

export type InterventionPhotoInput = {
  idPhoto: string;
  idIntervention: string;
  referencePhoto: string;
  contextePhoto: string;
  description: string | null;
  mediaStockeeLocale: boolean;
}

export interface InterventionsRepository {
  listMissions(idUtilisateur: string, now: Date): Promise<InterventionMission[]>;
  findMembership(
    idIntervention: string,
    idUtilisateur: string,
    now: Date,
  ): Promise<{ intervention: InterventionMembership | null; isMember: boolean }>;
  canSubmitReport(idEquipe: string, idUtilisateur: string, now: Date): Promise<boolean>;
  start(idIntervention: string, idUtilisateur: string, now: Date): Promise<void>;
  finish(
    intervention: InterventionMembership,
    idUtilisateur: string,
    input: { resultatIntervention: string; compteRendu: string; motifException?: string },
    now: Date,
  ): Promise<void>;
  createPhoto(input: InterventionPhotoInput): Promise<void>;
  findPhotoReference(idIntervention: string, idPhoto: string): Promise<string | null>;
}

export interface InterventionPhotoStorage {
  store(
    upload: { mimetype: string; file: AsyncIterable<Uint8Array> },
    idPhoto: string,
  ): Promise<{ filename: string }>;
  remove(filename: string): Promise<void>;
  read(filename: string, idPhoto: string): Promise<{ mimeType: string; content: Buffer } | null>;
}
