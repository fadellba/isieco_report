export type VerificationRule =
  | 'AFFECTATION_NOT_FOUND'
  | 'AFFECTATION_NOT_PENDING'
  | 'COMPLETED_INTERVENTION_NOT_FOUND'
  | 'COMPLETION_TRACE_NOT_FOUND'
  | 'SEPARATION_OF_DUTIES'
  | 'INVALID_VERIFICATION_RESULT'
  | 'VERIFICATION_REASON_REQUIRED'
  | 'DOSSIER_NOT_FOUND'
  | 'DOSSIER_NOT_PENDING'
  | 'DOSSIER_HAS_NO_ACTIVE_CONTENT'
  | 'DOSSIER_NOT_FULLY_RESOLVED'
  | 'DOSSIER_NOT_CLOSED'
  | 'REOPEN_REASON_REQUIRED';

export class VerificationRuleError extends Error {
  constructor(readonly rule: VerificationRule, message?: string) {
    super(message ?? rule);
    this.name = 'VerificationRuleError';
  }
}

export type RecordVerificationInput = {
  idAffectation: string;
  idVerificateur: string;
  resultatVerification: string;
  motif?: string;
  referencePreuve?: string;
};
