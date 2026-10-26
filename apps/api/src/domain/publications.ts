export type PublicationTarget =
  | { type: 'SIGNALEMENT'; id: string }
  | { type: 'DOSSIER'; id: string };

export type PublicationPhoto = {
  id: string;
  role: 'OBSERVATION' | 'AVANT' | 'APRES';
};

export type PublicationDecision = 'APPROUVEE' | 'REFUSEE' | 'MASQUEE';
export type PublicationPhotoSource = 'SIGNALEMENT' | 'INTERVENTION';
export type PhotoVariantDecision = 'APPROUVEE' | 'REFUSEE';

export type PendingPhotoVariant = {
  source: PublicationPhotoSource;
  photoId: string;
  submittedBy: string;
  submittedAt: Date;
};

export class PublicationRuleError extends Error {
  constructor(
    public readonly rule:
      | 'PUBLICATION_NOT_FOUND'
      | 'SOURCE_NOT_FOUND'
      | 'SOURCE_NOT_READY'
      | 'PHOTOS_REQUIRED'
      | 'INVALID_PHOTOS'
      | 'DUPLICATE_PUBLICATION'
      | 'INVALID_TRANSITION'
      | 'SELF_MODERATION'
      | 'DECISION_REASON_REQUIRED'
      | 'PHOTO_VARIANT_NOT_FOUND'
      | 'PHOTO_VARIANT_ALREADY_PENDING'
      | 'PHOTO_VARIANT_NOT_PENDING'
      | 'PHOTO_VARIANT_SELF_MODERATION'
      | 'PHOTO_VARIANT_NOT_APPROVED'
      | 'INDEPENDENT_MODERATION_REQUIRED',
  ) {
    super(rule);
    this.name = 'PublicationRuleError';
  }
}

export type PublicPublication = {
  idPublication: string;
  datePublication: Date;
  commune: string | null;
  typesDechets: Array<{ code: string; libelle: string }>;
  photos: Array<{
    role: 'OBSERVATION' | 'AVANT' | 'APRES';
    reference: string;
  }>;
};

export type PendingPublication = {
  idPublication: string;
  idSignalement: string | null;
  idDossier: string | null;
  creePar: string;
  dateCreation: Date;
};
