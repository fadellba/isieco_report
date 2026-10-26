import { PrismaClient } from '../../generated/prisma/client.js';
import {
  PointHistoryEntry,
} from '../../domain/points.js';
import {
  PointsRepository,
} from '../../application/ports/points-repository.js';

function mapPointHistory(record: {
  idPoint: string;
  points: number;
  dateAttribution: Date;
  motif: string;
  idSignalement: string | null;
}): PointHistoryEntry {
  return {
    idPoint: record.idPoint,
    points: record.points,
    dateAttribution: record.dateAttribution,
    motif: record.motif,
    idSignalement: record.idSignalement,
  };
}

export class PrismaPointsRepository implements PointsRepository {
  constructor(private readonly client: PrismaClient) {}

  async listByUser(idUtilisateur: string): Promise<PointHistoryEntry[]> {
    const entries = await this.client.historiquePoints.findMany({
      where: { idUtilisateur },
      orderBy: { dateAttribution: 'desc' },
      select: {
        idPoint: true,
        points: true,
        dateAttribution: true,
        motif: true,
        idSignalement: true,
      },
    });

    return entries.map(mapPointHistory);
  }

}
