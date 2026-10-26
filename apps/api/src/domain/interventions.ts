export type InterventionRule =
  | 'INTERVENTION_NOT_FOUND'
  | 'TEAM_MEMBERSHIP_REQUIRED'
  | 'ASSIGNMENT_INACTIVE_FOR_START'
  | 'ASSIGNMENT_INACTIVE_FOR_FINISH'
  | 'INTERVENTION_NOT_SCHEDULED'
  | 'INTERVENTION_NOT_STARTED'
  | 'REPORT_REQUIRED'
  | 'REPORT_TOO_SHORT'
  | 'EXCEPTION_REASON_REQUIRED'
  | 'REPORT_SUBMISSION_FORBIDDEN'
  | 'START_STATE_CHANGED'
  | 'FINISH_STATE_CHANGED'
  | 'PHOTO_REFERENCE_REQUIRED'
  | 'PHOTO_NOT_FOUND';

export class InterventionRuleError extends Error {
  constructor(readonly rule: InterventionRule) {
    super(rule);
    this.name = 'InterventionRuleError';
  }
}

export type InterventionMembership = {
  idIntervention: string;
  idAffectation: string;
  idEquipe: string;
  statutIntervention: string;
  dateHeureDebut: Date | null;
  etatAffectation: string;
  dateFinAffectation: Date | null;
};

export type InterventionMission = {
  idIntervention: string;
  statutIntervention: string;
  dateDebut: Date | null;
  dateFin: Date | null;
  idAffectation: string;
  idDossier: string;
  referenceDossier: string;
  descriptionSynthese: string;
  priorite: string;
  latitude: number | null;
  longitude: number | null;
  descriptionLocalisation: string | null;
  codeTypeDechet: string;
  libelleDechet: string;
  nomEquipe: string;
};

export type InterventionPhoto = {
  idPhoto: string;
  referencePhoto: string;
};
