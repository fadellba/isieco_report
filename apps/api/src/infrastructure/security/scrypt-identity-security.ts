import {
  hashSessionToken,
  generateSecureToken,
  hashPassword,
  verifyPassword,
} from '../../core/crypto.js';
import { IdentitySecurity } from '../../application/ports/identity-security.js';

export class ScryptIdentitySecurity implements IdentitySecurity {
  createSessionToken(): string {
    return generateSecureToken();
  }

  hashSessionToken(token: string): string {
    return hashSessionToken(token);
  }

  hashPassword(password: string): string {
    return hashPassword(password);
  }

  verifyPassword(password: string, passwordHash: string): boolean {
    return verifyPassword(password, passwordHash);
  }
}
