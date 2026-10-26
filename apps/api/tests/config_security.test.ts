import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('Production configuration validation', () => {
  it('refuses startup when production secrets are missing', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', "import('./src/config.ts')"],
      {
        cwd: apiRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          COOKIE_SECRET: '',
          DATABASE_URL: 'postgresql://service:secret@localhost:5432/isieco',
          CORS_ORIGINS: 'https://portal.example.org',
          UPLOAD_DIR: 'C:\\isieco\\uploads',
        },
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('COOKIE_SECRET');
  });

  it('rejects non-HTTPS production origins', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', "import('./src/config.ts')"],
      {
        cwd: apiRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          COOKIE_SECRET: 'b'.repeat(48),
          DATABASE_URL: 'postgresql://service:secret@localhost:5432/isieco',
          CORS_ORIGINS: 'http://portal.example.org',
          UPLOAD_DIR: 'C:\\isieco\\uploads',
        },
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Origine CORS non autorisée');
  });
});
