import crypto from 'node:crypto';
import { calculateDistanceMeters, QualificationCandidate, SignalementRuleError } from '../../domain/signalements.js';
import { QualificationRuleError } from '../../domain/qualification.js';
import { QualificationRepository } from '../ports/qualification-repository.js';
import { SignalementsRepository } from '../ports/signalements-repository.js';

function assertMutationSucceeded(
  result: 'UPDATED' | 'NOT_FOUND' | 'INVALID_STATE',
): asserts result is 'UPDATED' {
  if (result === 'NOT_FOUND') {
    throw new QualificationRuleError('SIGNALEMENT_NOT_FOUND', 'Signalement introuvable.');
  }
  if (result === 'INVALID_STATE') {
    throw new QualificationRuleError(
      'INVALID_STATE',
      'La décision ne peut pas être appliquée à l’état actuel du signalement.',
    );
  }
}

export async function getQualificationInbox(repository: QualificationRepository) {
  const data = await repository.listInbox();
  return { count: data.length, data };
}

export async function startSignalementExamination(
  repository: QualificationRepository,
  idSignalement: string,
  idActeur: string,
): Promise<void> {
  assertMutationSucceeded(await repository.startExamination(idSignalement, idActeur));
}

export async function acceptSignalement(
  repository: QualificationRepository,
  idSignalement: string,
  idActeur: string,
  motif?: string,
): Promise<void> {
  assertMutationSucceeded(await repository.accept({ idSignalement, idActeur, motif }));
}

export async function rejectSignalement(
  repository: QualificationRepository,
  idSignalement: string,
  idActeur: string,
  motif: string,
): Promise<void> {
  if (!motif || motif.trim().length < 10) {
    throw new QualificationRuleError(
      'INVALID_REJECTION_REASON',
      "Un motif explicite d'au moins 10 caractères est obligatoire pour rejeter un signalement (RG17).",
    );
  }
  assertMutationSucceeded(await repository.reject({ idSignalement, idActeur, motif: motif.trim() }));
}

export async function correctSignalementAcceptance(
  repository: QualificationRepository,
  idSignalement: string,
  idActeur: string,
  motif: string,
): Promise<void> {
  if (!motif || motif.trim().length < 10) {
    throw new QualificationRuleError(
      'INVALID_CORRECTION_REASON',
      "Un motif explicite d'au moins 10 caractères est obligatoire pour corriger l'acceptation.",
    );
  }
  assertMutationSucceeded(
    await repository.correctAcceptance({ idSignalement, idActeur, motif: motif.trim() }),
  );
}

export async function requestSignalementComplement(
  repository: QualificationRepository,
  idSignalement: string,
  idActeur: string,
  motif: string,
): Promise<void> {
  if (!motif || motif.trim().length < 10) {
    throw new QualificationRuleError(
      'INVALID_COMPLEMENT_REASON',
      'Un motif d’au moins 10 caractères est obligatoire pour demander un complément.',
    );
  }
  assertMutationSucceeded(await repository.requestComplement({
    idSignalement,
    idActeur,
    motif: motif.trim(),
    idDemande: crypto.randomUUID(),
  }));
}

export async function respondToSignalementComplement(
  repository: QualificationRepository,
  input: {
    idSignalement: string;
    idDemande: string;
    idActeur: string;
    contenu: string;
  },
): Promise<void> {
  if (!input.contenu || input.contenu.trim().length === 0 || input.contenu.trim().length > 5000) {
    throw new QualificationRuleError(
      'INVALID_COMPLEMENT_RESPONSE',
      'La réponse doit contenir entre 1 et 5000 caractères.',
    );
  }
  assertMutationSucceeded(await repository.respondToComplement({
    ...input,
    contenu: input.contenu.trim(),
    idReponse: crypto.randomUUID(),
  }));
}

export async function findQualificationDuplicates(
  repository: SignalementsRepository,
  idSignalement: string,
): Promise<QualificationCandidate[]> {
  const candidates = await repository.findCandidates(idSignalement);
  if (candidates === null) {
    throw new SignalementRuleError('SIGNALEMENT_NOT_FOUND', 'Signalement introuvable.');
  }
  if (!candidates.target) return [];
  return candidates.others
    .map((candidate) => ({
      ...candidate,
      distanceMetres: calculateDistanceMeters(
        candidates.target!.latitude,
        candidates.target!.longitude,
        candidate.latitude,
        candidate.longitude,
      ),
    }))
    .filter((candidate) => candidate.distanceMetres <= 500)
    .sort((a, b) => a.distanceMetres - b.distanceMetres);
}
