export type SignalementCategoryInput = {
  idTypeDechet: string;
  quantiteEstimee?: string;
  volumeEstime?: string;
  remarque?: string;
};

export type CreateSignalementInput = {
  idUtilisateur: string;
  clientType: string;
  description: string;
  dateConstat?: string;
  latitude?: number | null;
  longitude?: number | null;
  precisionLocalisation?: number | null;
  descriptionLocalisation?: string | null;
  categories: SignalementCategoryInput[];
};

export type SignalementSummary = {
  idSignalement: string;
  dateConstat: Date | null;
  dateSoumission: Date | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  descriptionLocalisation: string | null;
  statutSignalement: string;
};

export type SignalementDetail = {
  idSignalement: string;
  idUtilisateur: string;
  declarant: string;
  dateConstat: Date | null;
  dateSoumission: Date | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  precisionLocalisation: number | null;
  descriptionLocalisation: string | null;
  statutSignalement: string;
  categories: Array<{
    idTypeDechet: string;
    codeType: string;
    libelle: string;
    quantiteEstimee: string | null;
    volumeEstime: string | null;
    remarque: string | null;
  }>;
  photos: Array<{
    idPhoto: string;
    referencePhoto: string;
    description: string | null;
    dateAjout: Date;
  }>;
  complements: Array<{
    idDemande: string;
    motif: string;
    dateDemande: Date;
    etatDemande: string;
    reponse: {
      contenu: string;
      dateReponse: Date;
    } | null;
  }>;
};

export type QualificationCandidate = {
  idSignalement: string;
  description: string | null;
  dateSoumission: Date | null;
  statutSignalement: string;
  latitude: number;
  longitude: number;
  distanceMetres: number;
};

export type NearbySignalement = Omit<QualificationCandidate, 'distanceMetres'>;

export class SignalementRuleError extends Error {
  constructor(
    readonly rule:
      | 'INVALID_DESCRIPTION'
      | 'LOCATION_REQUIRED'
      | 'CATEGORY_REQUIRED'
      | 'DUPLICATE_CATEGORY'
      | 'INVALID_PHOTO_TYPE'
      | 'PHOTO_TOO_LARGE'
      | 'SIGNALEMENT_NOT_FOUND'
      | 'FORBIDDEN'
      | 'PHOTO_NOT_FOUND',
    message?: string,
  ) {
    super(message ?? rule);
    this.name = 'SignalementRuleError';
  }
}

export class SignalementIdempotencyConflictError extends Error {
  constructor() {
    super('Cette clé de transmission est déjà associée à un autre contenu.');
    this.name = 'SignalementIdempotencyConflictError';
  }
}

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusMeters = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
