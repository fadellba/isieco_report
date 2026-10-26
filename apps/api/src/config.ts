import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

const env = process.env.NODE_ENV || 'development';
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const photoRetentionIntervalHours = Number(process.env.PHOTO_RETENTION_INTERVAL_HOURS || 24);

if (
  !Number.isInteger(photoRetentionIntervalHours)
  || photoRetentionIntervalHours < 1
  || photoRetentionIntervalHours > 168
) {
  throw new Error('PHOTO_RETENTION_INTERVAL_HOURS doit être un entier entre 1 et 168.');
}

function requireProductionSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`${name} doit contenir au moins 32 caractères en production.`);
  }
  return value;
}

function getCorsOrigins(): string[] {
  const configuredOrigins = process.env.CORS_ORIGINS;
  if (env === 'production' && !configuredOrigins) {
    throw new Error('CORS_ORIGINS doit être défini en production.');
  }

  const origins = (configuredOrigins || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081,http://127.0.0.1:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (env === 'production' && origins.length === 0) {
    throw new Error('CORS_ORIGINS doit contenir au moins une origine HTTPS en production.');
  }

  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Origine CORS invalide : ${origin}`);
    }
    if (parsed.origin !== origin || (env === 'production' && parsed.protocol !== 'https:')) {
      throw new Error(`Origine CORS non autorisée pour cet environnement : ${origin}`);
    }
  }

  return [...new Set(origins)];
}

if (env === 'production' && !path.isAbsolute(uploadDir)) {
  throw new Error('UPLOAD_DIR doit être un chemin absolu en production.');
}

const databaseUrlFromEnvironment = process.env.DATABASE_URL;
if (env === 'production' && !databaseUrlFromEnvironment) {
  throw new Error('DATABASE_URL doit être défini en production.');
}
if (databaseUrlFromEnvironment && !/^postgres(?:ql)?:\/\//i.test(databaseUrlFromEnvironment)) {
  throw new Error('DATABASE_URL doit utiliser PostgreSQL.');
}

const cookieSecret = env === 'production'
  ? requireProductionSecret('COOKIE_SECRET')
  : process.env.COOKIE_SECRET || 'dev-super-secret-cookie-key-minimum-32-chars!';

export interface AppConfig {
  env: string;
  port: number;
  host: string;
  cookieSecret: string;
  corsOrigins: string[];
  databaseUrl: string;
  pg: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  uploadDir: string;
  maxFileSize: number; // en octets
  photoRetentionIntervalMs: number;
}

const pg = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'isieco_dev',
};

const databaseUrl =
  databaseUrlFromEnvironment ||
  (() => {
    const url = new URL('postgresql://localhost');
    url.hostname = pg.host;
    url.port = String(pg.port);
    url.username = pg.user;
    url.password = pg.password;
    url.pathname = `/${pg.database}`;
    url.searchParams.set('schema', 'public');
    return url.toString();
  })();

export const config: AppConfig = {
  env,
  port: Number(process.env.PORT) || 3001,
  host: process.env.HOST || '0.0.0.0',
  cookieSecret,
  corsOrigins: getCorsOrigins(),
  databaseUrl,
  pg,
  uploadDir,
  maxFileSize: 5 * 1024 * 1024, // 5 Mo max selon RG14 / REQ-NF-006 / Test T31
  photoRetentionIntervalMs: photoRetentionIntervalHours * 60 * 60 * 1000,
};
