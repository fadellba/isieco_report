export type IdentityRule =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_INACTIVE'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'USER_NOT_FOUND'
  | 'INVALID_PROFILE'
  | 'INVALID_CURRENT_PASSWORD'
  | 'UNCHANGED_PASSWORD'
  | 'INVALID_ACCOUNT_STATUS';

export class IdentityRuleError extends Error {
  constructor(readonly rule: IdentityRule, message: string) {
    super(message);
    this.name = 'IdentityRuleError';
  }
}
