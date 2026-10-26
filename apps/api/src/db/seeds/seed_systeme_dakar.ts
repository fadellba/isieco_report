import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { config } from '../../config.js';

export async function seedSystemeDakar(): Promise<void> {
  const seedSql = await readFile(new URL('./seed_systeme_dakar.sql', import.meta.url), 'utf8');
  const client = new pg.Client({ connectionString: config.databaseUrl });

  await client.connect();
  try {
    await client.query(seedSql);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seedSystemeDakar().catch((error: unknown) => {
    console.error('Échec du chargement des données système de démonstration.', error);
    process.exitCode = 1;
  });
}
