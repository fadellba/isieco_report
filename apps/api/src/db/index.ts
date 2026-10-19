import { IDbAdapter } from './adapter.js';
import { PostgresDbAdapter } from './postgres.js';
import { SqliteDbAdapter } from './sqlite.js';

export * from './adapter.js';
export * from './postgres.js';
export * from './sqlite.js';

let defaultDbInstance: IDbAdapter | null = null;

/**
 * Obtient ou initialise l'instance de base de données courante
 * Selon DATABASE_CLIENT ('postgres' | 'sqlite')
 */
export function getDb(): IDbAdapter {
  if (!defaultDbInstance) {
    const clientType = process.env.DATABASE_CLIENT || 'postgres';
    if (clientType === 'sqlite') {
      defaultDbInstance = new SqliteDbAdapter(process.env.SQLITE_PATH || ':memory:');
    } else {
      defaultDbInstance = new PostgresDbAdapter();
    }
  }
  return defaultDbInstance;
}

export function setDb(adapter: IDbAdapter): void {
  defaultDbInstance = adapter;
}

