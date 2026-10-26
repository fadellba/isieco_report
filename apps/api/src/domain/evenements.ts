export type EvenementRule =
  | 'INVALID_CORRECTION_REASON'
  | 'ORIGINAL_EVENT_NOT_FOUND'
  | 'EVENT_TYPE_REQUIRED'
  | 'INCOMPLETE_COMPOSITE_TARGET'
  | 'NO_EVENT_TARGET'
  | 'MULTIPLE_EVENT_TARGETS'
  | 'COMPOSITE_TARGET_NOT_FOUND';

export class EvenementRuleError extends Error {
  constructor(public readonly rule: EvenementRule) {
    super(rule);
    this.name = 'EvenementRuleError';
  }
}
