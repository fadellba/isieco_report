import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import {
  CreateSignalementInput,
  SignalementRuleError,
} from '../../domain/signalements.js';
import {
  PrivateImageUpload,
  SignalementPhotoStorage,
  SignalementsRepository,
} from '../ports/signalements-repository.js';

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function createSignalement(
  repository: SignalementsRepository,
  input: CreateSignalementInput,
  idempotencyKey?: string,
): Promise<string> {
  if (!input.description || input.description.trim().length < 5) {
    throw new SignalementRuleError('INVALID_DESCRIPTION', 'La description doit comporter au moins 5 caractères.');
  }
  const hasGps = input.latitude != null && input.longitude != null;
  const hasText = input.descriptionLocalisation != null && input.descriptionLocalisation.trim().length > 0;
  if (!hasGps && !hasText) {
    throw new SignalementRuleError(
      'LOCATION_REQUIRED',
      'Des coordonnées GPS valides ou un repère textuel de lieu sont obligatoires (RG06 / RG07 / Test T02).',
    );
  }
  if (!input.categories?.length) {
    throw new SignalementRuleError('CATEGORY_REQUIRED', 'Au moins une catégorie de déchet doit être déclarée.');
  }
  const typeIds = input.categories.map(({ idTypeDechet }) => idTypeDechet);
  if (new Set(typeIds).size !== typeIds.length) {
    throw new SignalementRuleError(
      'DUPLICATE_CATEGORY',
      'Une catégorie de déchet ne peut pas être déclarée deux fois dans le même signalement.',
    );
  }

  const normalizedInput: CreateSignalementInput = {
    ...input,
    description: input.description.trim(),
    descriptionLocalisation: input.descriptionLocalisation
      ? input.descriptionLocalisation.trim()
      : null,
  };
  const idSignalement = randomUUID();
  const idempotency = idempotencyKey
    ? { key: idempotencyKey, requestHash: hashCreateRequest(normalizedInput) }
    : undefined;
  return repository.create(normalizedInput, idSignalement, idempotency);
}

function hashCreateRequest(input: CreateSignalementInput): string {
  const payload = {
    description: input.description,
    dateConstat: input.dateConstat ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    precisionLocalisation: input.precisionLocalisation ?? null,
    descriptionLocalisation: input.descriptionLocalisation ?? null,
    categories: input.categories
      .map((category) => ({
        idTypeDechet: category.idTypeDechet,
        quantiteEstimee: category.quantiteEstimee ?? null,
        volumeEstime: category.volumeEstime ?? null,
        remarque: category.remarque ?? null,
      }))
      .sort((left, right) => left.idTypeDechet.localeCompare(right.idTypeDechet)),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function listMySignalements(repository: SignalementsRepository, idUtilisateur: string) {
  return repository.listByUser(idUtilisateur);
}

export async function getSignalementDetail(
  repository: SignalementsRepository,
  idSignalement: string,
  idUtilisateur: string,
  roles: string[],
) {
  const signalement = await repository.findDetail(idSignalement);
  if (!signalement) {
    throw new SignalementRuleError('SIGNALEMENT_NOT_FOUND', 'Signalement introuvable.');
  }
  if (isCitizenOnly(roles) && signalement.idUtilisateur !== idUtilisateur) {
    throw new SignalementRuleError(
      'FORBIDDEN',
      "Accès interdit : vous ne pouvez pas consulter le signalement d'un tiers (RG04 / Test T29).",
    );
  }

  return {
    ...signalement,
    photos: signalement.photos.map((photo) => ({
      ...photo,
      referencePhoto: new RegExp(`^${photo.idPhoto}\\.(jpg|png|webp)$`).test(photo.referencePhoto)
        ? `/api/signalements/${idSignalement}/photos/${photo.idPhoto}/contenu`
        : photo.referencePhoto,
    })),
  };
}

export async function addSignalementPhoto(
  repository: SignalementsRepository,
  idSignalement: string,
  idUtilisateur: string,
  roles: string[],
  referencePhoto: string,
  description: string | null,
): Promise<string> {
  await assertPhotoAccess(repository, idSignalement, idUtilisateur, roles);
  const idPhoto = randomUUID();
  await repository.createPhoto({ idSignalement, idPhoto, referencePhoto, description });
  return idPhoto;
}

export async function uploadSignalementPhoto(
  repository: SignalementsRepository,
  storage: SignalementPhotoStorage,
  input: {
    idSignalement: string;
    idUtilisateur: string;
    roles: string[];
    upload: PrivateImageUpload;
    onCleanupError?: (error: unknown) => void;
  },
): Promise<string> {
  await assertPhotoAccess(repository, input.idSignalement, input.idUtilisateur, input.roles);
  const idPhoto = randomUUID();
  const referencePhoto = await storage.store(input.upload, idPhoto);
  try {
    await repository.createPhoto({
      idPhoto,
      idSignalement: input.idSignalement,
      referencePhoto,
      description: 'Photo transmise par l’application mobile',
    });
  } catch (error) {
    try {
      await storage.remove(referencePhoto);
    } catch (cleanupError) {
      input.onCleanupError?.(cleanupError);
    }
    throw error;
  }
  return idPhoto;
}

export async function getSignalementPhoto(
  repository: SignalementsRepository,
  storage: SignalementPhotoStorage,
  input: { idSignalement: string; idPhoto: string; idUtilisateur: string; roles: string[] },
) {
  await assertPhotoAccess(repository, input.idSignalement, input.idUtilisateur, input.roles);
  const referencePhoto = await repository.findPhoto(input.idSignalement, input.idPhoto);
  if (!referencePhoto || !new RegExp(`^${input.idPhoto}\\.(jpg|png|webp)$`).test(referencePhoto)) {
    throw new SignalementRuleError('PHOTO_NOT_FOUND', 'Photo introuvable.');
  }
  return storage.read(referencePhoto);
}

export function validateSignalementPhoto(mimeType: string, fileSizeBytes: number): void {
  if (!mimeType || !ALLOWED_PHOTO_TYPES.has(mimeType)) {
    throw new SignalementRuleError(
      'INVALID_PHOTO_TYPE',
      `Type de fichier non autorisé : ${mimeType}. Seules les images JPEG, PNG et WebP sont acceptées (Test T31).`,
    );
  }
  if (fileSizeBytes > MAX_PHOTO_SIZE_BYTES) {
    throw new SignalementRuleError(
      'PHOTO_TOO_LARGE',
      `Fichier trop volumineux (${(fileSizeBytes / 1024 / 1024).toFixed(2)} Mo). Limite maximale : 5 Mo (Test T31).`,
    );
  }
}

function isCitizenOnly(roles: string[]): boolean {
  return roles.length === 1 && roles[0] === 'CITOYEN';
}

async function assertPhotoAccess(
  repository: SignalementsRepository,
  idSignalement: string,
  idUtilisateur: string,
  roles: string[],
): Promise<void> {
  const owner = await repository.findOwner(idSignalement);
  if (!owner) throw new SignalementRuleError('SIGNALEMENT_NOT_FOUND', 'Signalement introuvable.');
  if (isCitizenOnly(roles) && owner !== idUtilisateur) {
    throw new SignalementRuleError(
      'FORBIDDEN',
      "Accès interdit : vous ne pouvez pas accéder aux photos d'un tiers.",
    );
  }
}
