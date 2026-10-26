import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from '../../config.js';

let prismaClient: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    const pool = new pg.Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    prismaClient = new PrismaClient({
      adapter: new PrismaPg(pool, { disposeExternalPool: true }),
    });
  }

  return prismaClient;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (!prismaClient) {
    return;
  }

  const client = prismaClient;
  prismaClient = undefined;
  await client.$disconnect();
}
