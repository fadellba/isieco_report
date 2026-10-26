import { PrismaClient } from '../../generated/prisma/client.js';
import { DatabaseHealthCheck } from '../../application/ports/database-health-check.js';

export class PrismaDatabaseHealthCheck implements DatabaseHealthCheck {
  constructor(private readonly client: PrismaClient) {}

  async ping(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`;
  }
}
