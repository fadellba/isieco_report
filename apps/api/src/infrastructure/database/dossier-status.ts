import type { Prisma } from '../../generated/prisma/client.js';

export async function recalculerStatutDossier(
  transaction: Prisma.TransactionClient,
  dossierId: string,
): Promise<string> {
  const rows = await transaction.$queryRaw<Array<{ statut_dossier: string | null }>>`
    SELECT recalculer_statut_dossier(${dossierId}::uuid) AS statut_dossier
  `;
  const status = rows[0]?.statut_dossier;
  if (!status) {
    throw new Error(`Impossible de recalculer le statut du dossier ${dossierId}.`);
  }
  return status;
}
