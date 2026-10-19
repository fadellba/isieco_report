import crypto from 'node:crypto';

const KEY_LENGTH = 64;

/**
 * Hache un mot de passe en clair avec scrypt (sel aléatoire cryptographique de 16 octets).
 * Format retourné : scrypt$<saltHex>$<hashHex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Vérifie un mot de passe en clair contre un hash stocké.
 * Utilise timingSafeEqual pour se prémunir contre les attaques temporelles (timing attacks).
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false;
    }
    const salt = parts[1];
    const originalHash = Buffer.from(parts[2], 'hex');
    const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH);
    return crypto.timingSafeEqual(originalHash, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Génère un jeton sécurisé aléatoire (64 caractères hexadécimaux / 256 bits d'entropie).
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

