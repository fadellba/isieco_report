import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  secureStorage: new Map<string, string>(),
  ownerId: 'citizen-a',
  encrypt: vi.fn(async (plaintext: string) => ({
    combined: async () => plaintext,
  })),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => mocks.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mocks.storage.set(key, value);
    },
    removeItem: async (key: string) => {
      mocks.storage.delete(key);
    },
    getAllKeys: async () => [...mocks.storage.keys()],
    multiGet: async (keys: string[]) =>
      keys.map((key) => [key, mocks.storage.get(key) ?? null]),
  },
}));

vi.mock('expo-crypto', () => ({
  AESSealedData: {
    fromCombined: (ciphertext: string) => ({ ciphertext }),
  },
  AESEncryptionKey: {
    generate: async () => ({ encoded: async () => 'a'.repeat(64) }),
    import: async () => ({}),
  },
  AESKeySize: { AES256: 256 },
  aesEncryptAsync: mocks.encrypt,
  aesDecryptAsync: async (sealed: { ciphertext: string }) => sealed.ciphertext,
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mocks.secureStorage.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mocks.secureStorage.set(key, value);
  },
}));

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('./api.js', () => ({
  getStoredAuthUserId: async () => mocks.ownerId,
  mobileApi: {
    signalements: {
      create: vi.fn(),
      uploadPhoto: vi.fn(),
    },
    interventions: {
      uploadPhoto: vi.fn(),
      terminer: vi.fn(),
    },
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  enqueueOfflineAction,
  getLegacyPendingActionCount,
  getPendingActions,
} from './offlineQueue.js';

const sampleInput = {
  type: 'SIGNALEMENT_CREATION' as const,
  payload: {
    description: 'Déchets sur la chaussée',
    latitude: null,
    longitude: null,
    precisionLocalisation: null,
    descriptionLocalisation: null,
    categories: [{ idTypeDechet: 'type-plastique' }],
  },
};

describe('offline queue persistence', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.secureStorage.clear();
    mocks.ownerId = 'citizen-a';
    mocks.encrypt.mockClear();
  });

  it('encrypts native queue data and decrypts it when read', async () => {
    expect(Platform.OS).toBe('android');
    await enqueueOfflineAction(sampleInput);

    const storageKey = '@isieco_offline_queue_v3_citizen-a';
    const stored = await AsyncStorage.getItem(storageKey);
    expect(stored).not.toContain(sampleInput.payload.description);
    expect(JSON.parse(stored!)).toMatchObject({
      version: 1,
      algorithm: 'AES-256-GCM',
    });
    expect(await getPendingActions()).toMatchObject([
      { ownerId: 'citizen-a', payload: sampleInput.payload },
    ]);
  });

  it('keeps each account queue isolated', async () => {
    await enqueueOfflineAction(sampleInput);
    mocks.ownerId = 'citizen-b';
    expect(await getPendingActions()).toEqual([]);

    await enqueueOfflineAction({
      ...sampleInput,
      payload: { ...sampleInput.payload, description: 'Autre compte' },
    });
    expect(await getPendingActions()).toMatchObject([
      { ownerId: 'citizen-b', payload: { description: 'Autre compte' } },
    ]);

    mocks.ownerId = 'citizen-a';
    expect(await getPendingActions()).toMatchObject([
      { ownerId: 'citizen-a', payload: sampleInput.payload },
    ]);
  });

  it('migrates the previous per-account plaintext queue without losing actions', async () => {
    const previousKey = '@isieco_offline_queue_v2_citizen-a';
    const legacyAction = {
      id: 'old-action',
      ownerId: 'citizen-a',
      timestamp: '2026-10-23T00:00:00.000Z',
      ...sampleInput,
    };
    await AsyncStorage.setItem(previousKey, JSON.stringify([legacyAction]));

    expect(await getPendingActions()).toEqual([legacyAction]);
    expect(await AsyncStorage.getItem(previousKey)).toBeNull();
    expect(await AsyncStorage.getItem('@isieco_offline_queue_v3_citizen-a')).toContain(
      'AES-256-GCM',
    );
  });

  it('archives legacy unowned actions encrypted and reports their count', async () => {
    const oldKey = '@isieco_offline_queue_v1';
    await AsyncStorage.setItem(oldKey, JSON.stringify([sampleInput, sampleInput]));

    expect(await getLegacyPendingActionCount()).toBe(2);
    expect(await AsyncStorage.getItem(oldKey)).toBeNull();
    const archive = await AsyncStorage.getItem(
      '@isieco_offline_queue_v1_unassigned_archive',
    );
    expect(JSON.parse(archive!)).toMatchObject({ algorithm: 'AES-256-GCM' });
  });

  it('keeps invalid queue contents untouched and reports the read error', async () => {
    const key = '@isieco_offline_queue_v3_citizen-a';
    const corruptValue = '{invalid';
    await AsyncStorage.setItem(key, corruptValue);

    await expect(getPendingActions()).rejects.toThrow('illisible');
    expect(await AsyncStorage.getItem(key)).toBe(corruptValue);
  });
});
