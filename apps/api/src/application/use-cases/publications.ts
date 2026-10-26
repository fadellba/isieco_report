import { ConflictError } from '../../core/errors.js';
import {
  PendingPublication,
  PendingPhotoVariant,
  PhotoVariantDecision,
  PublicationDecision,
  PublicationPhoto,
  PublicationRuleError,
  PublicationPhotoSource,
  PublicationTarget,
  PublicPublication,
} from '../../domain/publications.js';
import { PublicationsRepository } from '../ports/publications-repository.js';

export async function submitPublication(
  repository: PublicationsRepository,
  input: {
    target: PublicationTarget;
    actorId: string;
    photos: PublicationPhoto[];
  },
): Promise<string> {
  if (input.photos.length === 0) {
    throw new PublicationRuleError('PHOTOS_REQUIRED');
  }
  if (new Set(input.photos.map((photo) => photo.id)).size !== input.photos.length) {
    throw new PublicationRuleError('INVALID_PHOTOS');
  }
  if (
    input.target.type === 'SIGNALEMENT' &&
    input.photos.some((photo) => photo.role !== 'OBSERVATION')
  ) {
    throw new PublicationRuleError('INVALID_PHOTOS');
  }
  if (
    input.target.type === 'DOSSIER' &&
    input.photos.some((photo) => photo.role === 'OBSERVATION')
  ) {
    throw new PublicationRuleError('INVALID_PHOTOS');
  }

  try {
    return await repository.submit(input);
  } catch (error) {
    if (error instanceof PublicationRuleError && error.rule === 'DUPLICATE_PUBLICATION') {
      throw new ConflictError('Une publication existe déjà pour cette cible.');
    }
    throw error;
  }
}

export async function decidePublication(
  repository: PublicationsRepository,
  input: {
    publicationId: string;
    actorId: string;
    decision: PublicationDecision;
    reason: string | null;
  },
  at = new Date(),
): Promise<void> {
  const reason = input.reason?.trim() || null;
  if (input.decision !== 'APPROUVEE' && (!reason || reason.length < 10)) {
    throw new PublicationRuleError('DECISION_REASON_REQUIRED');
  }
  await repository.decide({ ...input, reason, at });
}

export function listPendingPublications(
  repository: PublicationsRepository,
  limit: number,
): Promise<PendingPublication[]> {
  return repository.listPending(limit);
}

export function listPublications(
  repository: PublicationsRepository,
  limit: number,
): Promise<PublicPublication[]> {
  return repository.listPublic(limit);
}

export async function submitPhotoVariant(
  repository: PublicationsRepository,
  input: {
    source: PublicationPhotoSource;
    photoId: string;
    reference: string;
    submittedBy: string;
  },
  at = new Date(),
): Promise<void> {
  await repository.submitPhotoVariant({ ...input, at });
}

export async function decidePhotoVariant(
  repository: PublicationsRepository,
  input: {
    source: PublicationPhotoSource;
    photoId: string;
    actorId: string;
    decision: PhotoVariantDecision;
    reason?: string | null;
  },
  at = new Date(),
): Promise<void> {
  const reason = input.reason?.trim() || null;
  if (input.decision === 'REFUSEE' && (!reason || reason.length < 10)) {
    throw new PublicationRuleError('DECISION_REASON_REQUIRED');
  }
  await repository.decidePhotoVariant({ ...input, reason, at });
}

export function listPendingPhotoVariants(
  repository: PublicationsRepository,
  limit: number,
): Promise<PendingPhotoVariant[]> {
  return repository.listPendingPhotoVariants(limit);
}

export async function withdrawPhotoVariant(
  repository: PublicationsRepository,
  input: {
    source: PublicationPhotoSource;
    photoId: string;
    actorId: string;
    reason: string;
  },
  at = new Date(),
): Promise<void> {
  const reason = input.reason.trim();
  if (reason.length < 10) throw new PublicationRuleError('DECISION_REASON_REQUIRED');
  await repository.withdrawPhotoVariant({ ...input, reason, at });
}
