export type DossierRule = 'NOT_FOUND' | 'INVALID_OPERATION' | 'INVALID_STATE';

export class DossierRuleError extends Error {
  constructor(readonly rule: DossierRule, message: string) {
    super(message);
    this.name = 'DossierRuleError';
  }
}
