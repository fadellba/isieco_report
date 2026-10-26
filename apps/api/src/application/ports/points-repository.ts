import { PointHistoryEntry } from '../../domain/points.js';

export interface PointsRepository {
  listByUser(idUtilisateur: string): Promise<PointHistoryEntry[]>;
}
