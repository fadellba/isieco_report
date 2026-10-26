import {
  AffectationRuleError,
  assertCompetenceIsCurrent,
  assertDossierHasLocation,
} from '../../domain/affectations.js';
import { StatutDossier } from '@isieco/shared';
import { AffectationsRepository, CreateAssignmentInput } from '../ports/affectations-repository.js';

function applyAssignmentRule(assertion: () => void): void {
  assertion();
}

export async function listPendingAssignments(repository: AffectationsRepository) {
  const data = await repository.listPending();
  const priorityOrder: Record<string, number> = { URGENTE: 1, ELEVEE: 2, MOYENNE: 3 };
  data.sort((a, b) =>
    (priorityOrder[a.priorite] ?? 4) - (priorityOrder[b.priorite] ?? 4)
    || a.dateCreationDossier.getTime() - b.dateCreationDossier.getTime()
  );
  return data;
}

export async function createAssignment(repository: AffectationsRepository, input: Omit<CreateAssignmentInput, 'idAffectation'>) {
  if (input.referenceOperationUnique) {
    const existing = await repository.findIdempotent(input.referenceOperationUnique);
    if (existing) return { existing, idempotent: true as const };
  }

  const categoryState = await repository.findDossierCategory(input.idDossier, input.idTypeDechet);
  if (!categoryState) {
    throw new AffectationRuleError('CATEGORY_NOT_FOUND', 'Échec de la contrainte : le type de déchet visé est absent du contenu de ce dossier (Test T05).');
  }
  if (categoryState === 'RETIRE') {
    throw new AffectationRuleError('CATEGORY_REMOVED', "Impossible d'affecter une catégorie retirée du dossier (Test T23).");
  }
  const dossierStatus = await repository.findDossierStatus(input.idDossier);
  if (
    dossierStatus === StatutDossier.CLOS_RESOLUTION_CONFIRMEE ||
    dossierStatus === StatutDossier.CLOS_SANS_SUITE
  ) {
    throw new AffectationRuleError(
      'DOSSIER_CLOSED',
      'Un dossier clôturé doit être réouvert avant toute nouvelle affectation.',
    );
  }

  const competence = await repository.findCompetence(input.idCompetenceEquipe, input.idEquipe, input.idTypeDechet);
  applyAssignmentRule(() => assertCompetenceIsCurrent(competence, new Date(), {
    missing: "L'équipe sélectionnée ne possède pas la compétence requise pour ce type de déchet (Test T06).",
    notYetValid: "La compétence de l'équipe n'est pas encore valide à la date d'affectation.",
    expired: "La compétence de l'équipe pour ce type de déchet a expiré à la date d'affectation (Test T07).",
  }));
  const dossierLocation = await repository.findDossierLocation(input.idDossier);
  applyAssignmentRule(() => assertDossierHasLocation(
    dossierLocation,
    "Le dossier doit avoir une localisation exploitable avant son affectation (RG30).",
  ));
  if (await repository.hasActiveAssignment(input.idDossier, input.idTypeDechet)) {
    throw new AffectationRuleError('ACTIVE_ASSIGNMENT_EXISTS', 'Une affectation active existe déjà pour ce couple dossier/catégorie. Utilisez la réaffectation pour la remplacer (Test T08).');
  }

  const idAffectation = crypto.randomUUID();
  const existing = await repository.create({ ...input, idAffectation });
  if (existing) return { existing, idempotent: true as const };
  return { idAffectation, idempotent: false as const };
}

export async function reassign(
  repository: AffectationsRepository,
  input: {
    assignmentId: string;
    teamId: string;
    competenceId: string;
    reason: string;
    actorId: string;
    referenceOperationUnique?: string;
  },
) {
  if (!input.reason || input.reason.trim().length < 10) {
    throw new AffectationRuleError('INVALID_REASON', "Un motif explicite d'au moins 10 caractères est obligatoire pour une réaffectation.");
  }
  const current = await repository.findActiveAssignment(input.assignmentId);
  if (!current) throw new AffectationRuleError('ACTIVE_ASSIGNMENT_NOT_FOUND', 'Affectation active introuvable ou déjà terminée.');
  const dossierStatus = await repository.findDossierStatus(current.idDossier);
  if (
    dossierStatus === StatutDossier.CLOS_RESOLUTION_CONFIRMEE ||
    dossierStatus === StatutDossier.CLOS_SANS_SUITE
  ) {
    throw new AffectationRuleError(
      'DOSSIER_CLOSED',
      'Un dossier clôturé doit être réouvert avant toute réaffectation.',
    );
  }

  const decisionDate = new Date();
  const competence = await repository.findCompetence(input.competenceId, input.teamId, current.idTypeDechet);
  applyAssignmentRule(() => assertCompetenceIsCurrent(
    competence,
    decisionDate,
    {
      missing: 'La nouvelle équipe ne dispose pas de la compétence requise pour ce volet.',
      notYetValid: "La compétence de la nouvelle équipe n'est pas encore valide.",
      expired: 'La compétence de la nouvelle équipe a expiré.',
    },
  ));
  const dossierLocation = await repository.findDossierLocation(current.idDossier);
  applyAssignmentRule(() => assertDossierHasLocation(
    dossierLocation,
    "Le dossier doit avoir une localisation exploitable avant sa réaffectation (RG30).",
  ));

  const newAssignmentId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();
  const replaced = await repository.replace({
    oldAssignmentId: input.assignmentId,
    dossierId: current.idDossier,
    typeId: current.idTypeDechet,
    teamId: input.teamId,
    competenceId: input.competenceId,
    actorId: input.actorId,
    reason: input.reason.trim(),
    newAssignmentId,
    correlationId,
    referenceOperationUnique: input.referenceOperationUnique,
  });
  if (!replaced) {
    throw new AffectationRuleError('ASSIGNMENT_CHANGED', "L'affectation a changé d'état et ne peut plus être réaffectée.");
  }
  return { newAssignmentId, correlationId };
}
