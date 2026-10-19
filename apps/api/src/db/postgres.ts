import pg from 'pg';
import { IDbAdapter } from './adapter.js';

const { Pool } = pg;

export class PostgresDbAdapter implements IDbAdapter {
  private pool: pg.Pool;

  constructor(connectionStringOrConfig?: string | pg.PoolConfig) {
    if (typeof connectionStringOrConfig === 'string') {
      this.pool = new Pool({ connectionString: connectionStringOrConfig });
    } else if (connectionStringOrConfig) {
      this.pool = new Pool(connectionStringOrConfig);
    } else {
      // Paramètres par défaut pour DBngin local
      this.pool = new Pool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'isieco_dev',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    }
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const res = await this.pool.query(sql, params);
    return res.rows as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  async execute(sql: string, params: any[] = []): Promise<{ rowCount: number }> {
    const res = await this.pool.query(sql, params);
    return { rowCount: res.rowCount ?? 0 };
  }

  async transaction<T>(callback: (trx: IDbAdapter) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN;');
      
      const clientAdapter: IDbAdapter = {
        query: async <R = any>(sql: string, params: any[] = []): Promise<R[]> => {
          const res = await client.query(sql, params);
          return res.rows as R[];
        },
        queryOne: async <R = any>(sql: string, params: any[] = []): Promise<R | null> => {
          const res = await client.query(sql, params);
          return res.rows.length > 0 ? (res.rows[0] as R) : null;
        },
        execute: async (sql: string, params: any[] = []): Promise<{ rowCount: number }> => {
          const res = await client.query(sql, params);
          return { rowCount: res.rowCount ?? 0 };
        },
        transaction: async () => {
          throw new Error('Les transactions imbriquées ne sont pas supportées.');
        },
        close: async () => {
          // No-op for transaction client
        },
      };

      const result = await callback(clientAdapter);
      await client.query('COMMIT;');
      return result;
    } catch (err) {
      await client.query('ROLLBACK;');
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

