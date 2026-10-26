import { RecordVerificationInput } from '../../domain/verifications.js';

export type VerificationEvent = {
  typeEvenement: string;
  idActeur: string;
  idVerificationCible?: string;
  idDossierCible?: string;
  motif: string;
  donneesAvant?: Record<string, string>;
  donneesApres?: Record<string, string>;
};

export interface VerificationsTransaction {
  lockAffectation(idAffectation: string): Promise<void>;
  lockDossier(idDossier: string): Promise<void>;
  findAffectation(idAffectation: string): Promise<{ etatAffectation: string; dateFinAffectation: Date | null } | null>;
  findLatestCompletedIntervention(idAffectation: string): Promise<string | null>;
  hasCompletionTrace(idIntervention: string): Promise<boolean>;
  wasCompletedByVerifier(idAffectation: string, idVerificateur: string): Promise<boolean>;
  replaceCurrentVerifications(idAffectation: string): Promise<void>;
  createVerification(input: RecordVerificationInput): Promise<string>;
  setAffectationResolved(idAffectation: string, dateFin: Date): Promise<void>;
  resetAffectationForRework(idAffectation: string): Promise<void>;
  createVerificationEvent(input: VerificationEvent): Promise<void>;
  createProgrammedIntervention(idAffectation: string, idVerificateur: string): Promise<void>;
  findDossierStatus(idDossier: string): Promise<string | null>;
  listIncludedWasteTypes(idDossier: string): Promise<Array<{ idTypeDechet: string; codeType: string }>>;
  findLatestReopeningDate(idDossier: string): Promise<Date | null>;
  findLatestResolution(idDossier: string, idTypeDechet: string): Promise<{
    etatAffectation: string;
    dateHeureAffectation: Date;
    dateVerification: Date | null;
  } | null>;
  closeDossier(idDossier: string, dateCloture: Date): Promise<void>;
  listDeclarantIds(idDossier: string): Promise<string[]>;
  notifyDeclarant(idUtilisateur: string, idDossier: string): Promise<void>;
  reopenDossier(idDossier: string): Promise<void>;
}

export interface VerificationsRepository {
  transaction<T>(work: (transaction: VerificationsTransaction) => Promise<T>): Promise<T>;
}
