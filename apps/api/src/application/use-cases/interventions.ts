import crypto from 'node:crypto';
import { ResultatIntervention } from '@isieco/shared';
import {
  InterventionMembership,
  InterventionRuleError,
} from '../../domain/interventions.js';
import {
  InterventionPhotoStorage,
  InterventionsRepository,
} from '../ports/interventions-repository.js';

async function requireMembership(
  repository: InterventionsRepository,
  idIntervention: string,
  idUtilisateur: string,
  now: Date,
): Promise<InterventionMembership> {
  const membership = await repository.findMembership(idIntervention, idUtilisateur, now);
  if (!membership.intervention) {
    throw new InterventionRuleError('INTERVENTION_NOT_FOUND');
  }
  if (!membership.isMember) {
    throw new InterventionRuleError('TEAM_MEMBERSHIP_REQUIRED');
  }
  return membership.intervention;
}

export async function listInterventionMissions(
  repository: InterventionsRepository,
  idUtilisateur: string,
) {
  return repository.listMissions(idUtilisateur, new Date());
}

export async function startIntervention(
  repository: InterventionsRepository,
  idIntervention: string,
  idUtilisateur: string,
): Promise<void> {
  const now = new Date();
  const intervention = await requireMembership(repository, idIntervention, idUtilisateur, now);
  if (intervention.dateFinAffectation || intervention.etatAffectation !== 'ACTIVE') {
    throw new InterventionRuleError('ASSIGNMENT_INACTIVE_FOR_START');
  }
  if (intervention.statutIntervention !== 'PROGRAMMEE') {
    throw new InterventionRuleError('INTERVENTION_NOT_SCHEDULED');
  }
  await repository.start(idIntervention, idUtilisateur, now);
}

export async function finishIntervention(
  repository: InterventionsRepository,
  idIntervention: string,
  idUtilisateur: string,
  input: { resultatIntervention?: string; compteRendu?: string; motifException?: string },
): Promise<void> {
  if (!input.resultatIntervention) {
    throw new InterventionRuleError('REPORT_REQUIRED');
  }
  if (!input.compteRendu || input.compteRendu.trim().length < 10) {
    throw new InterventionRuleError('REPORT_TOO_SHORT');
  }
  if (
    input.resultatIntervention !== ResultatIntervention.SUCCES_TOTAL &&
    (!input.motifException || input.motifException.trim().length < 10)
  ) {
    throw new InterventionRuleError('EXCEPTION_REASON_REQUIRED');
  }

  const now = new Date();
  const intervention = await requireMembership(repository, idIntervention, idUtilisateur, now);
  if (intervention.dateFinAffectation || intervention.etatAffectation !== 'ACTIVE') {
    throw new InterventionRuleError('ASSIGNMENT_INACTIVE_FOR_FINISH');
  }
  if (intervention.statutIntervention !== 'EN_COURS' || !intervention.dateHeureDebut) {
    throw new InterventionRuleError('INTERVENTION_NOT_STARTED');
  }
  if (!(await repository.canSubmitReport(intervention.idEquipe, idUtilisateur, now))) {
    throw new InterventionRuleError('REPORT_SUBMISSION_FORBIDDEN');
  }

  await repository.finish(
    intervention,
    idUtilisateur,
    {
      resultatIntervention: input.resultatIntervention,
      compteRendu: input.compteRendu.trim(),
      motifException: input.motifException?.trim(),
    },
    now,
  );
}

export async function addInterventionPhoto(
  repository: InterventionsRepository,
  idIntervention: string,
  idUtilisateur: string,
  input: { referencePhoto?: string; contextePhoto?: string; description?: string },
): Promise<{ idPhoto: string; referencePhoto: string }> {
  if (!input.referencePhoto) {
    throw new InterventionRuleError('PHOTO_REFERENCE_REQUIRED');
  }
  await requireMembership(repository, idIntervention, idUtilisateur, new Date());
  const idPhoto = crypto.randomUUID();
  await repository.createPhoto({
    idPhoto,
    idIntervention,
    referencePhoto: input.referencePhoto,
    contextePhoto: input.contextePhoto || 'FIN_INTERVENTION',
    description: input.description || null,
    mediaStockeeLocale: false,
  });
  return { idPhoto, referencePhoto: input.referencePhoto };
}

export async function uploadPrivateInterventionPhoto(
  repository: InterventionsRepository,
  storage: InterventionPhotoStorage,
  idIntervention: string,
  idUtilisateur: string,
  upload: { mimetype: string; file: AsyncIterable<Uint8Array> },
  onCleanupError: (error: unknown) => void,
): Promise<{ idPhoto: string }> {
  await requireMembership(repository, idIntervention, idUtilisateur, new Date());
  const idPhoto = crypto.randomUUID();
  const { filename } = await storage.store(upload, idPhoto);
  try {
    await repository.createPhoto({
      idPhoto,
      idIntervention,
      referencePhoto: filename,
      contextePhoto: 'FIN_INTERVENTION',
      description: 'Preuve photo transmise par l’application mobile',
      mediaStockeeLocale: true,
    });
  } catch (error) {
    try {
      await storage.remove(filename);
    } catch (cleanupError) {
      onCleanupError(cleanupError);
    }
    throw error;
  }
  return { idPhoto };
}

export async function getPrivateInterventionPhoto(
  repository: InterventionsRepository,
  storage: InterventionPhotoStorage,
  idIntervention: string,
  idPhoto: string,
  idUtilisateur: string,
  requireTeamMembership: boolean,
): Promise<{ mimeType: string; content: Buffer }> {
  if (requireTeamMembership) {
    await requireMembership(repository, idIntervention, idUtilisateur, new Date());
  }
  const reference = await repository.findPhotoReference(idIntervention, idPhoto);
  const image = reference ? await storage.read(reference, idPhoto) : null;
  if (!image) {
    throw new InterventionRuleError('PHOTO_NOT_FOUND');
  }
  return image;
}
