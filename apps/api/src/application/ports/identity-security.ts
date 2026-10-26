export interface IdentitySecurity {
  createSessionToken(): string;
  hashSessionToken(token: string): string;
  hashPassword(password: string): string;
  verifyPassword(password: string, passwordHash: string): boolean;
}
