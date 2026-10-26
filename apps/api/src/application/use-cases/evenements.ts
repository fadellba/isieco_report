import { EvenementRuleError } from '../../domain/evenements.js';
import {
  AuditEvent,
  AuditEventFilters,
  EvenementsRepository,
  EventTargets,
} from '../ports/evenements-repository.js';

export type ListAuditEventsInput = AuditEventFilters & { limit?: number | string };

export async function listAuditEvents(
  repository: EvenementsRepository,
  input: ListAuditEventsInput,
): Promise<AuditEvent[]> {
  const numericLimit = Number(input.limit);
  const limit = numericLimit || 100;
  return repository.list({
    typeEvenement: input.typeEvenement,
    idActeur: input.idActeur,
    idDossierCible: input.idDossierCible,
    idSignalementCible: input.idSignalementCible,
    allowedEventTypes: input.allowedEventTypes,
  }, limit);
}

export async function correctAuditEvent(
  repository: EvenementsRepository,
  input: {
    eventId: string;
    actorId: string;
    newType?: string;
    reason: string;
    dataAfter?: unknown;
  },
): Promise<{ idEvenement: string; idEvenementCorrige: string }> {
  const reason = input.reason?.trim();
  if (!reason || reason.length < 10) {
    throw new EvenementRuleError('INVALID_CORRECTION_REASON');
  }

  const targets = await repository.getCorrectionTargets(input.eventId);
  if (!targets) {
    throw new EvenementRuleError('ORIGINAL_EVENT_NOT_FOUND');
  }

  const idEvenement = await repository.createCorrection({
    ...targets,
    typeEvenement: input.newType || 'EVENEMENT_CORRIGE',
    actorId: input.actorId,
    originalEventId: input.eventId,
    donneesApres: input.dataAfter,
    motif: `Correction tracée : ${reason}`,
  });

  return { idEvenement, idEvenementCorrige: input.eventId };
}

export async function createAuditEvent(
  repository: EvenementsRepository,
  input: {
    typeEvenement?: string;
    dateEvenement?: string;
    actorId: string;
    targets: EventTargets;
    motif?: string;
  },
): Promise<string> {
  if (!input.typeEvenement) {
    throw new EvenementRuleError('EVENT_TYPE_REQUIRED');
  }

  const targets = input.targets;
  const hasDossierContenu = targets.idDossierContenuCible != null;
  const hasDechetContenu = targets.idTypeDechetContenuCible != null;
  if (hasDossierContenu !== hasDechetContenu) {
    throw new EvenementRuleError('INCOMPLETE_COMPOSITE_TARGET');
  }

  const hasMainTarget = [
    targets.idSignalementCible,
    targets.idDossierCible,
    targets.idRattachementCible,
    targets.idAffectationCible,
    targets.idInterventionCible,
    targets.idVerificationCible,
    targets.idUtilisateurCible,
    targets.idEquipeCible,
    targets.idTypeDechetCible,
    targets.idCompetenceEquipeCible,
    hasDossierContenu && hasDechetContenu ? true : null,
  ].filter(Boolean).length;

  if (hasMainTarget === 0) {
    throw new EvenementRuleError('NO_EVENT_TARGET');
  }
  if (hasMainTarget > 1) {
    throw new EvenementRuleError('MULTIPLE_EVENT_TARGETS');
  }

  if (hasDossierContenu && hasDechetContenu) {
    const exists = await repository.contenuDossierExists(
      targets.idDossierContenuCible!,
      targets.idTypeDechetContenuCible!,
    );
    if (!exists) {
      throw new EvenementRuleError('COMPOSITE_TARGET_NOT_FOUND');
    }
  }

  return repository.create({
    ...targets,
    typeEvenement: input.typeEvenement,
    dateEvenement: input.dateEvenement ? new Date(input.dateEvenement) : new Date(),
    actorId: input.actorId,
    motif: input.motif || null,
  });
}
