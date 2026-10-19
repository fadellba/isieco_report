/**
 * Interface d'abstraction universelle de base de données
 * Permet l'exécution transparente sur PostgreSQL 17 (DBngin / Production)
 * et sur SQLite 3 in-memory (node:sqlite) pour la suite de tests instantanés.
 */
export interface IDbAdapter {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<{ rowCount: number }>;
  transaction<T>(callback: (trx: IDbAdapter) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

