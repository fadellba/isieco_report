import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

const env = process.env.NODE_ENV || 'development';
const uploadDir = process.env.UPLOAD_DIR || 'uploads';

if (env === 'production' && !path.isAbsolute(uploadDir)) {
  throw new Error('UPLOAD_DIR doit être un chemin absolu en production.');
}

export interface AppConfig {
  env: string;
  port: number;
  host: string;
  jwtSecret: string;
  cookieSecret: string;
  databaseClient: 'postgres' | 'sqlite';
  pg: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  uploadDir: string;
  maxFileSize: number; // en octets
}

export const config: AppConfig = {
  env,
  port: Number(process.env.PORT) || 3001,
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'dev-super-secret-jwt-key-minimum-32-chars!',
  cookieSecret: process.env.COOKIE_SECRET || 'dev-super-secret-cookie-key-minimum-32-chars!',
  databaseClient: (process.env.DATABASE_CLIENT as 'postgres' | 'sqlite') || 'postgres',
  pg: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'isieco_dev',
  },
  uploadDir,
  maxFileSize: 5 * 1024 * 1024, // 5 Mo max selon RG14 / REQ-NF-006 / Test T31
};
