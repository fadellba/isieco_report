export type AuditEvent = {
  idEvenement: string;
  typeEvenement: string;
  dateEvenement: Date | null;
  dateEnregistrement: Date;
  origine: string;
  idActeur: string | null;
  idSignalementCible: string | null;
  idDossierCible: string | null;
  idRattachementCible: string | null;
  idAffectationCible: string | null;
  idInterventionCible: string | null;
  idVerificationCible: string | null;
  idUtilisateurCible: string | null;
  idEquipeCible: string | null;
  idTypeDechetCible: string | null;
  idCompetenceEquipeCible: string | null;
  idDossierContenuCible: string | null;
  idTypeDechetContenuCible: string | null;
  idEvenementCorrige: string | null;
  donneesAvant: unknown;
  donneesApres: unknown;
  destinataireExterne: string | null;
  motif: string | null;
  correlationId: string | null;
  referenceOperationUnique: string | null;
  versionSchema: string;
  nomActeur: string | null;
  prenomActeur: string | null;
};

export type AuditEventFilters = {
  typeEvenement?: string;
  idActeur?: string;
  idDossierCible?: string;
  idSignalementCible?: string;
  allowedEventTypes?: string[];
};

export type EventTargets = {
  idSignalementCible?: string | null;
  idDossierCible?: string | null;
  idRattachementCible?: string | null;
  idAffectationCible?: string | null;
  idInterventionCible?: string | null;
  idVerificationCible?: string | null;
  idUtilisateurCible?: string | null;
  idEquipeCible?: string | null;
  idTypeDechetCible?: string | null;
  idCompetenceEquipeCible?: string | null;
  idDossierContenuCible?: string | null;
  idTypeDechetContenuCible?: string | null;
};

export type CreateAuditEvent = EventTargets & {
  typeEvenement: string;
  dateEvenement: Date;
  actorId: string;
  motif: string | null;
};

export type CreateAuditCorrection = EventTargets & {
  typeEvenement: string;
  actorId: string;
  originalEventId: string;
  donneesApres?: unknown;
  motif: string;
};

export interface EvenementsRepository {
  list(filters: AuditEventFilters, limit: number): Promise<AuditEvent[]>;
  getCorrectionTargets(idEvenement: string): Promise<EventTargets | null>;
  createCorrection(input: CreateAuditCorrection): Promise<string>;
  contenuDossierExists(idDossier: string, idTypeDechet: string): Promise<boolean>;
  create(input: CreateAuditEvent): Promise<string>;
}
