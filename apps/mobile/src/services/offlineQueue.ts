import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { ResultatIntervention } from '@isieco/shared';
import { OfflineAction, OfflineActionInput } from '../types/index.js';
import { getStoredAuthUserId } from './api.js';
import { mobileApi } from './api.js';

const QUEUE_STORAGE_KEY = '@isieco_offline_queue_v3';
const PREVIOUS_QUEUE_STORAGE_KEY = '@isieco_offline_queue_v2';
const LEGACY_QUEUE_STORAGE_KEY = '@isieco_offline_queue_v1';
const LEGACY_QUEUE_ARCHIVE_PREFIX = '@isieco_offline_queue_v1_unassigned_archive';
const QUEUE_ENCRYPTION_KEY = '@isieco_offline_queue_encryption_key_v1';
const QUEUE_ENVELOPE_VERSION = 1;

type EncryptedQueue = {
  version: typeof QUEUE_ENVELOPE_VERSION;
  algorithm: 'AES-256-GCM';
  ciphertext: string;
};

let encryptionKeyPromise: Promise<Crypto.AESEncryptionKey> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function getEncryptionKey(): Promise<Crypto.AESEncryptionKey> {
  if (!encryptionKeyPromise) {
    encryptionKeyPromise = (async () => {
      const storedKey = await SecureStore.getItemAsync(QUEUE_ENCRYPTION_KEY);
      if (storedKey) return Crypto.AESEncryptionKey.import(storedKey, 'hex');

      const key = await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256);
      const encodedKey = await key.encoded('hex');
      await SecureStore.setItemAsync(QUEUE_ENCRYPTION_KEY, encodedKey);
      return key;
    })().catch((error) => {
      encryptionKeyPromise = null;
      throw error;
    });
  }
  return encryptionKeyPromise;
}

async function encodeStoredValue(value: string, storageKey: string): Promise<string> {
  if (Platform.OS === 'web') return value;

  const key = await getEncryptionKey();
  const plaintext = bytesToBase64(new TextEncoder().encode(value));
  const additionalData = bytesToBase64(new TextEncoder().encode(storageKey));
  const sealed = await Crypto.aesEncryptAsync(plaintext, key, { additionalData });
  const envelope: EncryptedQueue = {
    version: QUEUE_ENVELOPE_VERSION,
    algorithm: 'AES-256-GCM',
    ciphertext: await sealed.combined('base64') as string,
  };
  return JSON.stringify(envelope);
}

async function decodeStoredValue(raw: string, storageKey: string): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw;
  }

  if (!isRecord(parsed) || parsed.version !== QUEUE_ENVELOPE_VERSION) return raw;
  if (parsed.algorithm !== 'AES-256-GCM' || typeof parsed.ciphertext !== 'string') {
    throw new Error('Le format chiffré de la file hors ligne est invalide.');
  }

  const key = await getEncryptionKey();
  const sealed = Crypto.AESSealedData.fromCombined(parsed.ciphertext);
  const additionalData = bytesToBase64(new TextEncoder().encode(storageKey));
  const plaintext = await Crypto.aesDecryptAsync(sealed, key, {
    output: 'base64',
    additionalData,
  });
  return new TextDecoder().decode(base64ToBytes(plaintext));
}

function isOfflineAction(value: unknown, ownerId: string): value is OfflineAction {
  if (!isRecord(value) || !isRecord(value.payload)) return false;
  if (
    typeof value.id !== 'string' ||
    value.ownerId !== ownerId ||
    typeof value.timestamp !== 'string'
  ) {
    return false;
  }

  if (value.type === 'SIGNALEMENT_CREATION') {
    return (
      typeof value.payload.description === 'string' &&
      Array.isArray(value.payload.categories) &&
      value.payload.categories.every(
        (category) => isRecord(category) && typeof category.idTypeDechet === 'string',
      ) &&
      (value.payload.photoUri == null || typeof value.payload.photoUri === 'string') &&
      (value.payload.idSignalementCree == null ||
        typeof value.payload.idSignalementCree === 'string')
    );
  }

  if (value.type === 'INTERVENTION_TERMINER') {
    const data = value.payload.data;
    return (
      typeof value.payload.idIntervention === 'string' &&
      isRecord(data) &&
      Object.values(ResultatIntervention).some(
        (result) => result === data.resultatIntervention,
      ) &&
      typeof data.compteRendu === 'string' &&
      (data.motifException == null || typeof data.motifException === 'string') &&
      (value.payload.photoUri == null || typeof value.payload.photoUri === 'string') &&
      (value.payload.photoReference == null ||
        typeof value.payload.photoReference === 'string')
    );
  }

  return false;
}

async function archiveUnownedLegacyQueue(): Promise<void> {
  const legacyQueue = await AsyncStorage.getItem(LEGACY_QUEUE_STORAGE_KEY);
  if (legacyQueue === null) return;

  const keys = await AsyncStorage.getAllKeys();
  const archiveKeys = new Set(keys.filter((key) => key.startsWith(LEGACY_QUEUE_ARCHIVE_PREFIX)));
  let archiveKey = LEGACY_QUEUE_ARCHIVE_PREFIX;
  let archiveIndex = 1;
  while (archiveKeys.has(archiveKey)) {
    archiveIndex++;
    archiveKey = `${LEGACY_QUEUE_ARCHIVE_PREFIX}_${archiveIndex}`;
  }
  await AsyncStorage.setItem(
    archiveKey,
    await encodeStoredValue(legacyQueue, archiveKey),
  );
  await AsyncStorage.removeItem(LEGACY_QUEUE_STORAGE_KEY);
}

async function readPendingActions(ownerId: string): Promise<OfflineAction[]> {
  const storageKey = `${QUEUE_STORAGE_KEY}_${ownerId}`;
  const raw = await AsyncStorage.getItem(storageKey);
  if (raw !== null) {
    return parsePendingActions(await decodeStoredValue(raw, storageKey), ownerId);
  }

  const previousStorageKey = `${PREVIOUS_QUEUE_STORAGE_KEY}_${ownerId}`;
  const previousRaw = await AsyncStorage.getItem(previousStorageKey);
  if (previousRaw === null) return [];

  const actions = parsePendingActions(previousRaw, ownerId);
  await savePendingActions(ownerId, actions);
  await AsyncStorage.removeItem(previousStorageKey);
  return actions;
}

function parsePendingActions(raw: string, ownerId: string): OfflineAction[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('La file hors ligne est illisible. Les données locales ont été conservées.');
  }
  if (!Array.isArray(parsed) || !parsed.every((action) => isOfflineAction(action, ownerId))) {
    throw new Error('La file hors ligne est invalide. Les données locales ont été conservées.');
  }
  return parsed;
}

export const getPendingActions = async (): Promise<OfflineAction[]> => {
  await archiveUnownedLegacyQueue();
  const ownerId = await getStoredAuthUserId();
  if (!ownerId) return [];
  return readPendingActions(ownerId);
};

export const getLegacyPendingActionCount = async (): Promise<number> => {
  await archiveUnownedLegacyQueue();
  const keys = (await AsyncStorage.getAllKeys())
    .filter((key) => key.startsWith(LEGACY_QUEUE_ARCHIVE_PREFIX));
  const entries = await AsyncStorage.multiGet(keys);
  let total = 0;
  for (const [storageKey, raw] of entries) {
    if (raw === null) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await decodeStoredValue(raw, storageKey));
    } catch {
      throw new Error('Une ancienne file hors ligne est illisible et a été conservée.');
    }
    if (!Array.isArray(parsed)) {
      throw new Error('Une ancienne file hors ligne est invalide et a été conservée.');
    }
    total += parsed.length;
  }
  return total;
};

export const enqueueOfflineAction = async (
  input: OfflineActionInput,
): Promise<OfflineAction> => {
  await archiveUnownedLegacyQueue();
  const ownerId = await getStoredAuthUserId();
  if (!ownerId) {
    throw new Error('Connectez-vous avant d’enregistrer une action hors ligne.');
  }

  const current = await readPendingActions(ownerId);
  const metadata = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    ownerId,
    timestamp: new Date().toISOString(),
  };
  const newAction: OfflineAction = input.type === 'SIGNALEMENT_CREATION'
    ? { ...metadata, type: input.type, payload: input.payload }
    : { ...metadata, type: input.type, payload: input.payload };

  await savePendingActions(ownerId, [...current, newAction]);
  return newAction;
};

export const removeOfflineAction = async (
  id: string,
  ownerId?: string,
): Promise<void> => {
  await archiveUnownedLegacyQueue();
  const currentOwnerId = ownerId || await getStoredAuthUserId();
  if (!currentOwnerId) {
    throw new Error('Aucun compte actif ne peut accéder à cette file hors ligne.');
  }

  const current = await readPendingActions(currentOwnerId);
  const updated = current.filter((action) => action.id !== id);
  await AsyncStorage.setItem(
    `${QUEUE_STORAGE_KEY}_${currentOwnerId}`,
    JSON.stringify(updated),
  );
};

const savePendingActions = async (
  ownerId: string,
  actions: OfflineAction[],
): Promise<void> => {
  const storageKey = `${QUEUE_STORAGE_KEY}_${ownerId}`;
  await AsyncStorage.setItem(
    storageKey,
    await encodeStoredValue(JSON.stringify(actions), storageKey),
  );
};

export const syncOfflineQueue = async (): Promise<{
  total: number;
  synced: number;
  failed: number;
  failedActionIds: string[];
}> => {
  await archiveUnownedLegacyQueue();
  const ownerId = await getStoredAuthUserId();
  if (!ownerId) {
    return { total: 0, synced: 0, failed: 0, failedActionIds: [] };
  }
  const queue = await readPendingActions(ownerId);
  if (queue.length === 0) {
    return { total: 0, synced: 0, failed: 0, failedActionIds: [] };
  }

  let synced = 0;
  const failedActionIds: string[] = [];

  for (const action of queue) {
    try {
      if (action.type === 'SIGNALEMENT_CREATION') {
        let idSignalement = action.payload.idSignalementCree;
        if (!idSignalement) {
          const result = await mobileApi.signalements.create(action.payload, action.id);
          idSignalement = result.idSignalement;
          action.payload.idSignalementCree = idSignalement;
          await savePendingActions(ownerId, queue);
        }
        if (action.payload.photoUri) {
          await mobileApi.signalements.uploadPhoto(idSignalement, action.payload.photoUri);
        }
        await removeOfflineAction(action.id, ownerId);
        synced++;
      } else {
        if (action.payload.photoUri && !action.payload.photoReference) {
          const photo = await mobileApi.interventions.uploadPhoto(
            action.payload.idIntervention,
            action.payload.photoUri,
          );
          action.payload.photoReference = photo.referencePhoto;
          await savePendingActions(ownerId, queue);
        }
        await mobileApi.interventions.terminer(
          action.payload.idIntervention,
          action.payload.data,
        );
        await removeOfflineAction(action.id, ownerId);
        synced++;
      }
    } catch {
      failedActionIds.push(action.id);
    }
  }

  return {
    total: queue.length,
    synced,
    failed: failedActionIds.length,
    failedActionIds,
  };
};
