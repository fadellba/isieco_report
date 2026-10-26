export interface ApiListResponse<T> {
  success: boolean;
  count: number;
  data: T[];
}

export interface ApiDataResponse<T> {
  success: boolean;
  data: T;
}

export interface DossierListItem {
  idDossier: string;
  referenceDossier: string;
  descriptionSynthese: string;
  dateCreationDossier: string;
  statutDossier: string;
  priorite: string;
  latitude: number | null;
  longitude: number | null;
  dateCloture: string | null;
  nomCreateur: string;
  nbVoletsInclus: number | string;
  nbSignalementsRattaches: number | string;
}

export interface DossierVolet {
  idTypeDechet: string;
  codeType: string;
  libelle: string;
  quantiteEstimee: string | null;
  volumeEstime: string | null;
  niveauRisque: string | null;
  etatContenuDossier: string;
  dateRetrait: string | null;
  motifRetrait: string | null;
}

export interface DossierSignalement {
  idSignalement: string;
  description: string;
  statutSignalement: string;
  dateRattachement: string;
  typeRattachement: string;
  dateFinRattachement: string | null;
}

export interface DossierAffectation {
  idAffectation: string;
  idTypeDechet: string;
  codeType: string;
  nomEquipe: string;
  dateAffectation: string;
  etatAffectation: string;
  dateFinAffectation: string | null;
}

export interface DossierDetail {
  id_dossier: string;
  reference_dossier: string;
  description_synthese: string;
  date_creation_dossier: string;
  statut_dossier: string;
  priorite: string;
  date_qualification: string | null;
  latitude: number | null;
  longitude: number | null;
  description_localisation: string | null;
  date_cloture: string | null;
  date_reouverture: string | null;
  nom_createur: string;
  volets: DossierVolet[];
  signalements: DossierSignalement[];
  affectations: DossierAffectation[];
}

export interface TypeDechetItem {
  idTypeDechet: string;
  codeType: string;
  libelle: string;
  description: string | null;
  orientationSpecialisee: string | null;
  dateDebutValidite: string;
  dateFinValidite: string | null;
}

export interface AffectationEnAttente {
  idDossier: string;
  referenceDossier: string;
  priorite: string;
  dateCreationDossier: string;
  idTypeDechet: string;
  codeType: string;
  libelleDechet: string;
}

export interface CompetenceEquipeItem {
  idCompetenceEquipe: string;
  idEquipe: string;
  nomEquipe: string;
  idTypeDechet: string;
  codeType: string;
  libelleDechet: string;
  dateDebut: string;
  dateFin: string | null;
}

export interface EquipeReferentiel {
  idEquipe: string;
  nomEquipe: string;
  description: string | null;
  etatEquipe: string;
  membres: Array<{
    idUtilisateur: string;
    nom: string;
    prenom: string | null;
    fonction: string | null;
  }>;
  competences: Array<{
    idCompetenceEquipe: string;
    idTypeDechet: string;
    codeType: string;
    libelleDechet: string;
    dateDebut: string;
    dateFin: string | null;
  }>;
}

export interface SignalementQualification {
  idSignalement: string;
  dateSoumission: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  descriptionLocalisation: string | null;
  statutSignalement: string;
  nomDeclarant: string;
  prenomDeclarant: string | null;
  nbPhotos: number | string;
}

export interface SignalementDoublonCandidat {
  idSignalement: string;
  description: string;
  dateSoumission: string;
  statutSignalement: string;
  latitude: number;
  longitude: number;
  distanceMetres: number;
}

export interface SignalementPhotoItem {
  idPhoto: string;
  referencePhoto: string;
  description: string | null;
  dateAjout: string;
}

export interface CartePoint {
  id: string;
  typeObjet: 'DOSSIER' | 'SIGNALEMENT' | 'INTERVENTION';
  reference: string;
  description: string;
  priorite: string;
  statut: string;
  latitude: number | string;
  longitude: number | string;
  dateCreation: string;
  idAffectation?: string | null;
  referenceDossier?: string | null;
  nomEquipe?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  resultatIntervention?: string | null;
}

export interface SignalementSansCoordonnees {
  idSignalement: string;
  description: string;
  descriptionLocalisation: string | null;
  statutSignalement: string;
  dateSoumission: string;
}

export interface CartePointsResponse {
  success: boolean;
  totalPoints: number;
  pointsGeolocalises: CartePoint[];
  totalSansCoordonnees: number;
  sansCoordonnees: SignalementSansCoordonnees[];
}

export interface NotificationItem {
  idNotification: string;
  titre: string;
  message: string;
  lu: boolean;
  dateCreation: string;
  lienCible: string | null;
}

export interface NotificationsResponse extends ApiListResponse<NotificationItem> {
  nonLues: number;
}
