import {
  OrigineAjoutContenuDossier,
  PrioriteDossier,
  TypeRattachement,
} from '@isieco/shared';

export type DossierListFilters = {
  statut?: string;
  priorite?: string;
};

export type DossierListItem = {
  idDossier: string;
  referenceDossier: string;
  descriptionSynthese: string;
  dateCreationDossier: Date;
  statutDossier: string;
  priorite: string;
  latitude: number | null;
  longitude: number | null;
  dateCloture: Date | null;
  nomCreateur: string;
  nbVoletsInclus: number;
  nbSignalementsRattaches: number;
};

export type AttachableReport = {
  idSignalement: string;
  description: string | null;
  dateSoumission: Date | null;
  latitude: number | null;
  longitude: number | null;
  descriptionLocalisation: string | null;
};

export type DossierDetails = {
  id_dossier: string;
  reference_dossier: string;
  description_synthese: string;
  date_creation_dossier: Date;
  statut_dossier: string;
  priorite: string;
  date_qualification: Date | null;
  latitude: number | null;
  longitude: number | null;
  description_localisation: string | null;
  date_cloture: Date | null;
  date_reouverture: Date | null;
  nom_createur: string;
  historique_priorites: Array<{
    priorite: string;
    dateDefinition: Date;
    justification: string;
    definiPar: string;
  }>;
  historique_localisations: Array<{
    latitude: number | null;
    longitude: number | null;
    precisionLocalisation: number | null;
    descriptionLocalisation: string | null;
    dateModification: Date;
    motif: string | null;
    modifiePar: string;
  }>;
  volets: Array<{
    idTypeDechet: string;
    codeType: string;
    libelle: string;
    quantiteEstimee: string | null;
    volumeEstime: string | null;
    niveauRisque: string | null;
    origineAjout: string;
    motifAjout: string | null;
    etatContenuDossier: string;
    dateRetrait: Date | null;
    motifRetrait: string | null;
  }>;
  signalements: Array<{
    idSignalement: string;
    description: string | null;
    statutSignalement: string;
    dateRattachement: Date;
    typeRattachement: string;
    dateFinRattachement: Date | null;
  }>;
  affectations: Array<{
    idAffectation: string;
    idTypeDechet: string;
    codeType: string;
    nomEquipe: string;
    dateAffectation: Date;
    etatAffectation: string;
    dateFinAffectation: Date | null;
  }>;
};

export type CreateDossierCommand = {
  idDossier: string;
  eventId: string;
  referenceDossier: string;
  descriptionSynthese: string;
  priorite: PrioriteDossier;
  latitude: number | null;
  longitude: number | null;
  descriptionLocalisation: string | null;
  categories: Array<{
    idTypeDechet: string;
    origineAjout: OrigineAjoutContenuDossier.CREATION_DOSSIER;
    motifAjout?: string;
    quantiteEstimee?: string;
    volumeEstime?: string;
    niveauRisque?: string;
  }>;
  actorId: string;
};

export type DossierCategoryCommand = {
  idDossier: string;
  idTypeDechet: string;
  origineAjout: OrigineAjoutContenuDossier.CREATION_DOSSIER
    | OrigineAjoutContenuDossier.AJOUT_MANUEL;
  motifAjout: string;
  quantiteEstimee?: string;
  volumeEstime?: string;
  niveauRisque?: string;
  remarque?: string;
  actorId: string;
};

export type ReportLocation = {
  latitude: number | null;
  longitude: number | null;
  descriptionLocalisation: string | null;
};

export type ReportAttachmentType = TypeRattachement;

export type DossierAuditEvent = {
  idEvenement: string;
  typeEvenement: string;
  idActeur: string;
  motif: string;
  idRattachementCible?: string;
  correlationId?: string;
  idDossierContenuCible?: string;
  idTypeDechetContenuCible?: string;
};

export interface DossiersUnitOfWork {
  findDossierStatus(dossierId: string): Promise<string | null>;
  findDossierLocation(dossierId: string): Promise<ReportLocation | null>;
  findReportForAttachment(reportId: string): Promise<{
    idUtilisateur: string;
    statutSignalement: string;
    latitude: number | null;
    longitude: number | null;
    descriptionLocalisation: string | null;
  } | null>;
  findActiveAttachment(reportId: string, dossierId?: string): Promise<{ idRattachement: string } | null>;
  createAttachment(input: {
    attachmentId: string;
    reportId: string;
    dossierId: string;
    type: ReportAttachmentType;
    reason: string;
    actorId: string;
  }): Promise<void>;
  updateDossierLocationIfEmpty(
    dossierId: string,
    expectedDescription: string | null,
    location: ReportLocation,
  ): Promise<void>;
  markReportAttached(reportId: string): Promise<boolean>;
  createCategoryProvenance(input: {
    reportId: string;
    dossierId: string;
    attachmentId: string;
    actorId: string;
    reason: string;
  }): Promise<void>;
  compensateDuplicateReportPoints(reportId: string, reason: string): Promise<void>;
  finishAttachment(attachmentId: string, reason: string): Promise<void>;
  recordEvents(events: DossierAuditEvent[]): Promise<void>;
  createNotification(input: {
    notificationId: string;
    userId: string;
    reportId: string;
  }): Promise<void>;
  createCategory(input: DossierCategoryCommand): Promise<void>;
  removeCategory(input: {
    dossierId: string;
    typeId: string;
    reason: string;
    actorId: string;
  }): Promise<void>;
}

export interface DossiersRepository {
  list(filters: DossierListFilters): Promise<DossierListItem[]>;
  listAttachableReports(): Promise<AttachableReport[]>;
  create(input: CreateDossierCommand): Promise<void>;
  updatePriority(input: {
    dossierId: string;
    priority: PrioriteDossier;
    justification: string;
    actorId: string;
    eventId: string;
  }): Promise<'UPDATED' | 'NOT_FOUND' | 'INVALID_STATE' | 'UNCHANGED'>;
  updateLocation(input: {
    dossierId: string;
    latitude: number | null;
    longitude: number | null;
    description: string | null;
    reason: string;
    actorId: string;
    eventId: string;
  }): Promise<'UPDATED' | 'NOT_FOUND' | 'INVALID_STATE' | 'UNCHANGED'>;
  transaction<T>(work: (unit: DossiersUnitOfWork) => Promise<T>): Promise<T>;
  dossierExists(dossierId: string): Promise<boolean>;
  categoryExists(dossierId: string, typeId: string): Promise<boolean>;
  hasActiveAssignment(dossierId: string, typeId: string): Promise<boolean>;
  recordExternalTransfer(input: {
    dossierId: string;
    recipient: string;
    reason: string;
    actorId: string;
    eventId: string;
  }): Promise<void>;
  getDetails(dossierId: string): Promise<DossierDetails | null>;
}
