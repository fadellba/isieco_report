export type CompetenceValidity = { dateDebut: Date; dateFin: Date | null };
export type DossierLocation = {
  latitude: number | null;
  longitude: number | null;
  descriptionLocalisation: string | null;
};

export type AffectationRule =
  | 'COMPETENCE_NOT_FOUND'
  | 'COMPETENCE_NOT_YET_VALID'
  | 'COMPETENCE_EXPIRED'
  | 'DOSSIER_LOCATION_REQUIRED'
  | 'CATEGORY_NOT_FOUND'
  | 'CATEGORY_REMOVED'
  | 'DOSSIER_CLOSED'
  | 'ACTIVE_ASSIGNMENT_EXISTS'
  | 'ACTIVE_ASSIGNMENT_NOT_FOUND'
  | 'INVALID_REASON'
  | 'ASSIGNMENT_CHANGED';

export class AffectationRuleError extends Error {
  constructor(readonly rule: AffectationRule, message: string) {
    super(message);
    this.name = 'AffectationRuleError';
  }
}

export function assertCompetenceIsCurrent(
  competence: CompetenceValidity | null,
  at: Date,
  messages: { missing: string; notYetValid: string; expired: string },
) {
  if (!competence) {
    throw new AffectationRuleError('COMPETENCE_NOT_FOUND', messages.missing);
  }
  if (competence.dateDebut > at) {
    throw new AffectationRuleError('COMPETENCE_NOT_YET_VALID', messages.notYetValid);
  }
  if (competence.dateFin && competence.dateFin < at) {
    throw new AffectationRuleError('COMPETENCE_EXPIRED', messages.expired);
  }
}

export function assertDossierHasLocation(location: DossierLocation | null, message: string) {
  const hasCoordinates = location?.latitude != null && location.longitude != null;
  const hasDescription = Boolean(location?.descriptionLocalisation?.trim());
  if (!hasCoordinates && !hasDescription) {
    throw new AffectationRuleError('DOSSIER_LOCATION_REQUIRED', message);
  }
}
