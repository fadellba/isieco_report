import {
  OrigineAjoutContenuDossier,
  PrioriteDossier,
  StatutDossier,
  TypeRattachement,
} from '@isieco/shared';
import crypto from 'node:crypto';
import { DossierRuleError } from '../../domain/dossiers.js';
import { DossiersRepository, DossierListFilters } from '../ports/dossiers-repository.js';
import { ReportAttachmentType } from '../ports/dossiers-repository.js';

export function listDossiers(repository: DossiersRepository, filters: DossierListFilters) {
  return repository.list(filters);
}

export function listAttachableReports(repository: DossiersRepository) {
  return repository.listAttachableReports();
}

export async function createDossier(
  repository: DossiersRepository,
  input: {
    referenceDossier?: string;
    descriptionSynthese: string;
    priorite?: PrioriteDossier;
    latitude?: number | null;
    longitude?: number | null;
    descriptionLocalisation?: string | null;
    categories: Array<{
      idTypeDechet: string;
      origineAjout?: OrigineAjoutContenuDossier.CREATION_DOSSIER;
      motifAjout?: string;
      quantiteEstimee?: string;
      volumeEstime?: string;
      niveauRisque?: string;
    }>;
    actorId: string;
  },
  now = new Date(),
) {
  if (!input.descriptionSynthese || input.descriptionSynthese.trim().length < 5) {
    throw new DossierRuleError('INVALID_OPERATION', 'La description de synthèse du dossier doit comporter au moins 5 caractères.');
  }
  if (!input.categories?.length) {
    throw new DossierRuleError('INVALID_OPERATION', 'Un dossier opérationnel doit comporter au moins un volet technique (catégorie de déchet).');
  }
  if ((input.latitude == null) !== (input.longitude == null)) {
    throw new DossierRuleError('INVALID_OPERATION', 'La latitude et la longitude doivent être fournies ensemble.');
  }
  if (input.latitude != null && input.longitude != null &&
    (input.latitude < -90 || input.latitude > 90 || input.longitude < -180 || input.longitude > 180)) {
    throw new DossierRuleError('INVALID_OPERATION', 'Les coordonnées de localisation sont hors limites.');
  }

  const idDossier = crypto.randomUUID();
  const referenceDossier = input.referenceDossier ||
    `DOS-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const statutDossier = 'EN_ATTENTE_AFFECTATION';
  await repository.create({
    ...input,
    categories: input.categories.map((category) => ({
      ...category,
      origineAjout: OrigineAjoutContenuDossier.CREATION_DOSSIER,
      motifAjout: category.motifAjout?.trim() || undefined,
    })),
    idDossier,
    eventId: crypto.randomUUID(),
    referenceDossier,
    descriptionSynthese: input.descriptionSynthese.trim(),
    priorite: input.priorite || PrioriteDossier.MOYENNE,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    descriptionLocalisation: input.descriptionLocalisation ? input.descriptionLocalisation.trim() : null,
  });
  return { idDossier, referenceDossier, statutDossier };
}

export async function updateDossierPriority(
  repository: DossiersRepository,
  input: {
    dossierId: string;
    priority: PrioriteDossier;
    justification: string;
    actorId: string;
  },
) {
  if (!Object.values(PrioriteDossier).includes(input.priority)) {
    throw new DossierRuleError('INVALID_OPERATION', 'Le niveau de priorité est invalide.');
  }
  if (!input.justification || input.justification.trim().length < 10) {
    throw new DossierRuleError(
      'INVALID_OPERATION',
      'Une justification d’au moins 10 caractères est obligatoire pour modifier la priorité.',
    );
  }
  return repository.updatePriority({
    ...input,
    justification: input.justification.trim(),
    eventId: crypto.randomUUID(),
  });
}

export async function updateDossierLocation(
  repository: DossiersRepository,
  input: {
    dossierId: string;
    latitude: number | null;
    longitude: number | null;
    description: string | null;
    reason: string;
    actorId: string;
  },
) {
  if ((input.latitude === null) !== (input.longitude === null)) {
    throw new DossierRuleError(
      'INVALID_OPERATION',
      'La latitude et la longitude doivent être fournies ensemble.',
    );
  }
  if (input.latitude !== null && input.longitude !== null &&
    (input.latitude < -90 || input.latitude > 90 || input.longitude < -180 || input.longitude > 180)) {
    throw new DossierRuleError('INVALID_OPERATION', 'Les coordonnées de localisation sont hors limites.');
  }
  if (input.latitude === null && !input.description?.trim()) {
    throw new DossierRuleError(
      'INVALID_OPERATION',
      'Une localisation textuelle ou des coordonnées doivent être conservées.',
    );
  }
  if (!input.reason || input.reason.trim().length < 10) {
    throw new DossierRuleError(
      'INVALID_OPERATION',
      'Un motif d’au moins 10 caractères est obligatoire pour modifier la localisation.',
    );
  }
  return repository.updateLocation({
    ...input,
    description: input.description?.trim() || null,
    reason: input.reason.trim(),
    eventId: crypto.randomUUID(),
  });
}

export async function attachReport(repository: DossiersRepository, input: {
  dossierId: string;
  reportId: string;
  type?: ReportAttachmentType;
  reason?: string;
  actorId: string;
}) {
  const attachmentId = crypto.randomUUID();
  if (input.type === 'DOUBLON_CONFIRME' && (!input.reason || input.reason.trim().length < 10)) {
    throw new DossierRuleError(
      'INVALID_OPERATION',
      'Un motif explicite d’au moins 10 caractères est obligatoire pour confirmer un doublon.',
    );
  }
  await repository.transaction(async (unit) => {
    const dossier = await unit.findDossierLocation(input.dossierId);
    if (!dossier) throw new DossierRuleError('NOT_FOUND', 'Dossier introuvable.');
    const report = await unit.findReportForAttachment(input.reportId);
    if (!report) throw new DossierRuleError('NOT_FOUND', 'Signalement introuvable.');
    if (report.statutSignalement !== 'ACCEPTE_POUR_RATTACHEMENT') {
      throw new DossierRuleError(
        'INVALID_STATE',
        'Seul un signalement accepté pour rattachement peut être rattaché à un dossier.',
      );
    }
    if (await unit.findActiveAttachment(input.reportId)) {
      throw new DossierRuleError('INVALID_OPERATION', 'Ce signalement est déjà activement rattaché à un dossier. Utilisez la correction de rattachement pour modifier ce lien.');
    }

    const reason = input.reason || 'Rattachement opérationnel au dossier';
    await unit.createAttachment({
      attachmentId,
      reportId: input.reportId,
      dossierId: input.dossierId,
      type: input.type || TypeRattachement.PRINCIPAL,
      reason,
      actorId: input.actorId,
    });
    if (!(await unit.markReportAttached(input.reportId))) {
      throw new DossierRuleError(
        'INVALID_STATE',
        'Le signalement a changé d’état ; le rattachement doit être recommencé après vérification.',
      );
    }
    await unit.createCategoryProvenance({
      reportId: input.reportId,
      dossierId: input.dossierId,
      attachmentId,
      actorId: input.actorId,
      reason,
    });
    if (input.type === 'DOUBLON_CONFIRME') {
      await unit.compensateDuplicateReportPoints(
        input.reportId,
        `Signalement confirmé comme doublon : ${reason}`,
      );
    }
    if (dossier.latitude === null && dossier.longitude === null && !dossier.descriptionLocalisation?.trim()) {
      await unit.updateDossierLocationIfEmpty(
        input.dossierId,
        dossier.descriptionLocalisation,
        {
          latitude: report.latitude,
          longitude: report.longitude,
          descriptionLocalisation: report.descriptionLocalisation,
        },
      );
    }
    await unit.recordEvents([{
      idEvenement: crypto.randomUUID(),
      typeEvenement: 'SIGNALEMENT_RATTACHE',
      idActeur: input.actorId,
      idRattachementCible: attachmentId,
      motif: input.reason || 'Signalement rattaché au dossier',
    }]);
    await unit.createNotification({
      notificationId: crypto.randomUUID(),
      userId: report.idUtilisateur,
      reportId: input.reportId,
    });
  });
  return { attachmentId, reportId: input.reportId, dossierId: input.dossierId };
}

export async function correctReportAttachment(repository: DossiersRepository, input: {
  dossierId: string;
  reportId: string;
  newDossierId: string;
  reason: string;
  actorId: string;
}) {
  if (!input.reason || input.reason.trim().length < 10) {
    throw new DossierRuleError('INVALID_OPERATION', "Un motif explicite d'au moins 10 caractères est obligatoire pour corriger un rattachement (Test T04).");
  }
  const correlationId = crypto.randomUUID();
  const reason = input.reason.trim();
  const newAttachmentId = crypto.randomUUID();
  await repository.transaction(async (unit) => {
    const oldAttachment = await unit.findActiveAttachment(input.reportId, input.dossierId);
    if (!oldAttachment) {
      throw new DossierRuleError('NOT_FOUND', 'Aucun lien de rattachement actif trouvé entre ce signalement et ce dossier.');
    }
    await unit.finishAttachment(
      oldAttachment.idRattachement,
      `Correction vers dossier ${input.newDossierId} : ${reason}`,
    );
    await unit.createAttachment({
      attachmentId: newAttachmentId,
      reportId: input.reportId,
      dossierId: input.newDossierId,
      type: TypeRattachement.CONFIRMATION,
      reason: `Réorientation depuis dossier ${input.dossierId} : ${reason}`,
      actorId: input.actorId,
    });
    await unit.createCategoryProvenance({
      reportId: input.reportId,
      dossierId: input.newDossierId,
      attachmentId: newAttachmentId,
      actorId: input.actorId,
      reason: `Réorientation depuis dossier ${input.dossierId} : ${reason}`,
    });
    await unit.recordEvents([
      {
        idEvenement: crypto.randomUUID(),
        typeEvenement: 'SIGNALEMENT_DERATTACHE',
        idActeur: input.actorId,
        idRattachementCible: oldAttachment.idRattachement,
        correlationId,
        motif: `Dérattachement suite à erreur d'aiguillage : ${reason}`,
      },
      {
        idEvenement: crypto.randomUUID(),
        typeEvenement: 'SIGNALEMENT_RATTACHE',
        idActeur: input.actorId,
        idRattachementCible: newAttachmentId,
        correlationId,
        motif: `Nouveau rattachement rectifié : ${reason}`,
      },
    ]);
  });
  return { correlationId };
}

export async function addDossierCategory(repository: DossiersRepository, input: {
  dossierId: string;
  typeId: string;
  motifAjout: string;
  quantiteEstimee?: string;
  volumeEstime?: string;
  niveauRisque?: string;
  remarque?: string;
  actorId: string;
}) {
  if (!input.typeId) throw new DossierRuleError('INVALID_OPERATION', 'Le type de déchet est obligatoire.');
  if (!input.motifAjout || input.motifAjout.trim().length < 10) {
    throw new DossierRuleError(
      'INVALID_OPERATION',
      'Un motif d’ajout d’au moins 10 caractères est obligatoire.',
    );
  }
  if (!(await repository.dossierExists(input.dossierId))) {
    throw new DossierRuleError('NOT_FOUND', 'Dossier introuvable.');
  }
  if (await repository.categoryExists(input.dossierId, input.typeId)) {
    throw new DossierRuleError('INVALID_OPERATION', 'Ce volet technique existe déjà dans le dossier (Test T26).');
  }
  await repository.transaction(async (unit) => {
    const statutDossier = await unit.findDossierStatus(input.dossierId);
    if (!statutDossier) {
      throw new DossierRuleError('NOT_FOUND', 'Dossier introuvable.');
    }
    if (
      statutDossier === StatutDossier.CLOS_RESOLUTION_CONFIRMEE ||
      statutDossier === StatutDossier.CLOS_SANS_SUITE
    ) {
      throw new DossierRuleError(
        'INVALID_STATE',
        'Un dossier clôturé doit être réouvert avant l’ajout d’un volet technique.',
      );
    }
    await unit.createCategory({
      ...input,
      motifAjout: input.motifAjout.trim(),
      origineAjout: OrigineAjoutContenuDossier.AJOUT_MANUEL,
      idDossier: input.dossierId,
      idTypeDechet: input.typeId,
    });
    await unit.recordEvents([{
      idEvenement: crypto.randomUUID(),
      typeEvenement: 'VOLET_AJOUTE',
      idActeur: input.actorId,
      idDossierContenuCible: input.dossierId,
      idTypeDechetContenuCible: input.typeId,
      motif: input.motifAjout.trim(),
    }]);
  });
}

export async function removeDossierCategory(repository: DossiersRepository, input: {
  dossierId: string;
  typeId: string;
  reason: string;
  actorId: string;
}) {
  if (!input.reason || input.reason.trim().length < 10) {
    throw new DossierRuleError('INVALID_OPERATION', "Un motif explicite d'au moins 10 caractères est obligatoire pour retirer une catégorie (Test T23).");
  }
  if (await repository.hasActiveAssignment(input.dossierId, input.typeId)) {
    throw new DossierRuleError('INVALID_OPERATION', 'Impossible de retirer ce volet : une affectation active est en cours. Veuillez terminer ou réaffecter la mission au préalable.');
  }
  await repository.transaction(async (unit) => {
    await unit.removeCategory({ ...input, reason: input.reason.trim() });
    await unit.recordEvents([{
      idEvenement: crypto.randomUUID(),
      typeEvenement: 'VOLET_RETIRE',
      idActeur: input.actorId,
      idDossierContenuCible: input.dossierId,
      idTypeDechetContenuCible: input.typeId,
      motif: input.reason.trim(),
    }]);
  });
}

export async function recordExternalTransfer(repository: DossiersRepository, input: {
  dossierId: string;
  recipient: string;
  reason: string;
  actorId: string;
}) {
  if (!input.recipient || input.recipient.trim().length < 3) {
    throw new DossierRuleError('INVALID_OPERATION', "Le libellé de l'organisme destinataire externe est obligatoire.");
  }
  if (!input.reason || input.reason.trim().length < 10) {
    throw new DossierRuleError('INVALID_OPERATION', "Un motif de transfert explicite d'au moins 10 caractères est obligatoire.");
  }
  await repository.recordExternalTransfer({
    ...input,
    recipient: input.recipient.trim(),
    reason: input.reason.trim(),
    eventId: crypto.randomUUID(),
  });
}

export function getDossierDetails(repository: DossiersRepository, dossierId: string) {
  return repository.getDetails(dossierId).then((details) => {
    if (!details) throw new DossierRuleError('NOT_FOUND', 'Dossier introuvable.');
    return details;
  });
}
