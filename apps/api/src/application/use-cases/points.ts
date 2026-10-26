import { PointsRepository } from '../ports/points-repository.js';
import { PointHistoryEntry } from '../../domain/points.js';

export type UserPointsSummary = {
  soldeTotal: number;
  historique: PointHistoryEntry[];
};

export async function getUserPoints(
  repository: PointsRepository,
  idUtilisateur: string,
): Promise<UserPointsSummary> {
  const historique = await repository.listByUser(idUtilisateur);

  return {
    soldeTotal: historique.reduce((total, entry) => total + entry.points, 0),
    historique,
  };
}
