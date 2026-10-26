import { IDbAdapter } from './adapter.js';
import { PostgresDbAdapter } from './postgres.js';

export * from './adapter.js';
export * from './postgres.js';

let defaultDbInstance: IDbAdapter | null = null;

/**
 * Accès SQL conservé pour les tests et les scripts de seed historiques.
 */
export function getDb(): IDbAdapter {
  if (!defaultDbInstance) {
    defaultDbInstance = new PostgresDbAdapter();
  }
  return defaultDbInstance;
}
