import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineAction } from '../types/index.js';
import { mobileApi } from './api.js';

const QUEUE_STORAGE_KEY = '@isieco_offline_queue_v1';

export const getPendingActions = async (): Promise<OfflineAction[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const enqueueOfflineAction = async (
  type: OfflineAction['type'],
  payload: any
): Promise<OfflineAction> => {
  const current = await getPendingActions();
  const newAction: OfflineAction = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type,
    payload,
    timestamp: new Date().toISOString(),
  };

  const updated = [...current, newAction];
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updated));
  return newAction;
};

export const removeOfflineAction = async (id: string): Promise<void> => {
  const current = await getPendingActions();
  const updated = current.filter((a) => a.id !== id);
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updated));
};

const savePendingActions = async (actions: OfflineAction[]): Promise<void> => {
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(actions));
};

export const syncOfflineQueue = async (): Promise<{
  total: number;
  synced: number;
  failed: number;
}> => {
  const queue = await getPendingActions();
  if (queue.length === 0) return { total: 0, synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const action of queue) {
    try {
      if (action.type === 'SIGNALEMENT_CREATION') {
        let idSignalement = action.payload.idSignalementCree as string | undefined;
        if (!idSignalement) {
          const result = await mobileApi.signalements.create(action.payload);
          idSignalement = result.idSignalement;
          action.payload.idSignalementCree = idSignalement;
          await savePendingActions(queue);
        }
        if (action.payload.photoUri) {
          await mobileApi.signalements.uploadPhoto(idSignalement, action.payload.photoUri);
        }
        await removeOfflineAction(action.id);
        synced++;
      } else if (action.type === 'INTERVENTION_TERMINER') {
        if (action.payload.photoUri && !action.payload.photoReference) {
          const photo = await mobileApi.interventions.uploadPhoto(
            action.payload.idIntervention,
            action.payload.photoUri
          );
          action.payload.photoReference = photo.referencePhoto;
          await savePendingActions(queue);
        }
        await mobileApi.interventions.terminer(
          action.payload.idIntervention,
          action.payload.data
        );
        await removeOfflineAction(action.id);
        synced++;
      }
    } catch {
      failed++;
    }
  }

  return { total: queue.length, synced, failed };
};
