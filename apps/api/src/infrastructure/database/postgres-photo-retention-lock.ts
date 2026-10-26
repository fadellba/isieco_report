import type { Pool, PoolClient } from 'pg';
import type { PhotoRetentionLock } from '../../application/ports/photo-retention-worker.js';

const LOCK_NAMESPACE = 1229868626;
const LOCK_RESOURCE = 1;

export class PostgresPhotoRetentionLock implements PhotoRetentionLock {
  private client: PoolClient | null = null;

  constructor(private readonly pool: Pool) {}

  async tryAcquire(): Promise<boolean> {
    if (this.client) throw new Error('Le verrou de purge photo est déjà détenu par cette instance.');

    const client = await this.pool.connect();
    try {
      const result = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock($1, $2) AS acquired',
        [LOCK_NAMESPACE, LOCK_RESOURCE],
      );
      if (!result.rows[0]?.acquired) {
        client.release();
        return false;
      }
      this.client = client;
      return true;
    } catch (error) {
      client.release(error instanceof Error ? error : new Error('Échec de l’acquisition du verrou PostgreSQL.'));
      throw error;
    }
  }

  async release(): Promise<void> {
    const client = this.client;
    if (!client) throw new Error('Aucun verrou de purge photo ne peut être libéré.');
    this.client = null;

    try {
      const result = await client.query<{ released: boolean }>(
        'SELECT pg_advisory_unlock($1, $2) AS released',
        [LOCK_NAMESPACE, LOCK_RESOURCE],
      );
      if (!result.rows[0]?.released) {
        throw new Error('PostgreSQL indique que le verrou de purge photo n’était pas détenu.');
      }
      client.release();
    } catch (error) {
      client.release(error instanceof Error ? error : new Error('Échec de la libération du verrou PostgreSQL.'));
      throw error;
    }
  }
}
