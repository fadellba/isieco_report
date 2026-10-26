export type QualificationInboxItem = {
  idSignalement: string;
  dateSoumission: Date | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  descriptionLocalisation: string | null;
  statutSignalement: string;
  nomDeclarant: string;
  prenomDeclarant: string | null;
  nbPhotos: number;
};

export class QualificationRuleError extends Error {
  constructor(
    readonly rule:
      | 'SIGNALEMENT_NOT_FOUND'
      | 'INVALID_REJECTION_REASON'
      | 'INVALID_CORRECTION_REASON'
      | 'INVALID_COMPLEMENT_REASON'
      | 'INVALID_COMPLEMENT_RESPONSE'
      | 'INVALID_STATE',
    message?: string,
  ) {
    super(message ?? rule);
    this.name = 'QualificationRuleError';
  }
}
