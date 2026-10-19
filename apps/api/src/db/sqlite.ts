import { createRequire } from 'node:module';
import { IDbAdapter } from './adapter.js';

const require = createRequire(import.meta.url);

export class SqliteDbAdapter implements IDbAdapter {
  private db: any;

  constructor(filePath: string = ':memory:') {
    const { DatabaseSync } = require('node:sqlite');
    this.db = new DatabaseSync(filePath);
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  // Convertit les placeholders PostgreSQL ($1, $2, etc.) en placeholders SQLite (?, ?) si nécessaire
  private sanitizeSql(sql: string): string {
    return sql.replace(/\$(\d+)/g, '?');
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const sanitized = this.sanitizeSql(sql);
    const stmt = this.db.prepare(sanitized);
    return stmt.all(...params) as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  async execute(sql: string, params: any[] = []): Promise<{ rowCount: number }> {
    const sanitized = this.sanitizeSql(sql);
    const stmt = this.db.prepare(sanitized);
    const result = stmt.run(...params);
    return { rowCount: Number(result.changes) };
  }

  async transaction<T>(callback: (trx: IDbAdapter) => Promise<T>): Promise<T> {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      const result = await callback(this);
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }

  // Utilitaires de migration/seed directs
  execRaw(sql: string): void {
    this.db.exec(sql);
  }
}
