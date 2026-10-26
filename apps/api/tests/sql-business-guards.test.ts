import { describe, expect, it } from 'vitest';
import { getDb } from '../src/db/index.js';

describe('Invariants SQL non représentables par Prisma', () => {
  it('confirme que les triggers de protection des dossiers clôturés sont installés et actifs', async () => {
    const triggers = await getDb().query<{
      trigger_name: string;
      table_name: string;
      enabled: string;
      function_name: string;
    }>(
      `SELECT
         t.tgname AS trigger_name,
         r.relname AS table_name,
         t.tgenabled AS enabled,
         p.proname AS function_name
       FROM pg_trigger AS t
       JOIN pg_class AS r ON r.oid = t.tgrelid
       JOIN pg_proc AS p ON p.oid = t.tgfoid
       JOIN pg_namespace AS n ON n.oid = r.relnamespace
       WHERE NOT t.tgisinternal
         AND n.nspname = current_schema()
         AND t.tgname IN (
           'contenu_dossier_open_parent_before_write',
           'affectation_open_parent_before_insert'
         )
       ORDER BY t.tgname`,
    );

    expect(triggers).toEqual([
      {
        trigger_name: 'affectation_open_parent_before_insert',
        table_name: 'affectation',
        enabled: 'O',
        function_name: 'verifier_affectation_dossier_ouvert',
      },
      {
        trigger_name: 'contenu_dossier_open_parent_before_write',
        table_name: 'contenu_dossier',
        enabled: 'O',
        function_name: 'verifier_contenu_dossier_ouvert',
      },
    ]);
  });
});
