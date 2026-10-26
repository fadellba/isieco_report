/**
 * Adaptateur SQL PostgreSQL conservé pour les tests et scripts de seed historiques.
 */
export interface IDbAdapter {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<{ rowCount: number }>;
  transaction<T>(callback: (trx: IDbAdapter) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
