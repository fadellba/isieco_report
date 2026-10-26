export type PendingAssignmentRow = {
  idDossier: string;
  referenceDossier: string;
  priorite: string;
  dateCreationDossier: Date;
  idTypeDechet: string;
  codeType: string;
  libelleDechet: string;
};

export type AssignmentCompetence = { dateDebut: Date; dateFin: Date | null };
export type AssignmentLocation = {
  latitude: number | null;
  longitude: number | null;
  descriptionLocalisation: string | null;
};

export type CreateAssignmentInput = {
  idAffectation: string;
  idDossier: string;
  idTypeDechet: string;
  idEquipe: string;
  idCompetenceEquipe: string;
  actorId: string;
  motif?: string;
  observation?: string;
  referenceOperationUnique?: string;
};

export type ExistingAssignment = {
  idAffectation: string;
  etatAffectation: string;
};

export interface AffectationsRepository {
  listPending(): Promise<PendingAssignmentRow[]>;
  findIdempotent(reference: string): Promise<ExistingAssignment | null>;
  findDossierCategory(dossierId: string, typeId: string): Promise<string | null>;
  findDossierStatus(dossierId: string): Promise<string | null>;
  findCompetence(competenceId: string, teamId: string, typeId: string): Promise<AssignmentCompetence | null>;
  findDossierLocation(dossierId: string): Promise<AssignmentLocation | null>;
  hasActiveAssignment(dossierId: string, typeId: string): Promise<boolean>;
  create(input: CreateAssignmentInput): Promise<ExistingAssignment | null>;
  findActiveAssignment(assignmentId: string): Promise<{ idDossier: string; idTypeDechet: string } | null>;
  replace(input: {
    oldAssignmentId: string;
    dossierId: string;
    typeId: string;
    teamId: string;
    competenceId: string;
    actorId: string;
    reason: string;
    newAssignmentId: string;
    correlationId: string;
    referenceOperationUnique?: string;
  }): Promise<boolean>;
}
