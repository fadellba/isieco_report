import { QualificationInboxItem } from '../../domain/qualification.js';

export type QualificationMutationResult = 'UPDATED' | 'NOT_FOUND' | 'INVALID_STATE';

export interface QualificationRepository {
  listInbox(): Promise<QualificationInboxItem[]>;
  startExamination(idSignalement: string, idActeur: string): Promise<QualificationMutationResult>;
  accept(input: { idSignalement: string; idActeur: string; motif?: string }): Promise<QualificationMutationResult>;
  reject(input: { idSignalement: string; idActeur: string; motif: string }): Promise<QualificationMutationResult>;
  correctAcceptance(input: {
    idSignalement: string;
    idActeur: string;
    motif: string;
  }): Promise<QualificationMutationResult>;
  requestComplement(input: {
    idSignalement: string;
    idActeur: string;
    motif: string;
    idDemande: string;
  }): Promise<QualificationMutationResult>;
  respondToComplement(input: {
    idSignalement: string;
    idDemande: string;
    idActeur: string;
    contenu: string;
    idReponse: string;
  }): Promise<QualificationMutationResult>;
}
