import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  MobileUser,
  TypeDechetRef,
  SignalementDraft,
  SignalementItem,
  MissionTerrainItem,
  PointItem,
  NotificationItem,
} from '../types/index.js';
import { ResultatIntervention } from '@isieco/shared';

const TOKEN_STORAGE_KEY = '@isieco_mobile_token';
const USER_STORAGE_KEY = '@isieco_mobile_user';
const API_URL_KEY = '@isieco_custom_api_url';
const TYPES_DECHETS_CACHE_KEY = '@isieco_types_dechets_cache_v1';

let currentToken: string | null = null;
let customApiBaseUrl: string =
  (Platform.OS === 'web'
    ? Constants.expoConfig?.extra?.apiUrlWeb
    : Constants.expoConfig?.extra?.apiUrl) || 'http://localhost:3001';

export const setApiBaseUrl = async (url: string) => {
  customApiBaseUrl = url.replace(/\/$/, '');
  await AsyncStorage.setItem(API_URL_KEY, customApiBaseUrl);
};

export const getApiBaseUrl = () => customApiBaseUrl;

export const loadStoredAuth = async (): Promise<{ token: string | null; user: MobileUser | null }> => {
  try {
    const savedUrl = await AsyncStorage.getItem(API_URL_KEY);
    if (savedUrl) customApiBaseUrl = savedUrl;

    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    const userStr = await AsyncStorage.getItem(USER_STORAGE_KEY);
    currentToken = token;
    const user = userStr ? JSON.parse(userStr) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
};

export const saveAuthSession = async (token: string, user: MobileUser) => {
  currentToken = token;
  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
  await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
};

export const clearAuthSession = async () => {
  currentToken = null;
  await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
  await AsyncStorage.removeItem(USER_STORAGE_KEY);
};

export const getAuthToken = () => currentToken;

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${customApiBaseUrl}/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error?.message || data?.message || `Erreur serveur (${response.status})`;
    throw new Error(errorMsg);
  }

  return data as T;
}

async function uploadPhoto(endpoint: string, photoUri: string) {
  const extension = photoUri.split(/[?#]/, 1)[0].split('.').pop()?.toLowerCase();
  const mimeType =
    extension === 'png'
      ? 'image/png'
      : extension === 'webp'
        ? 'image/webp'
        : extension === 'jpg' || extension === 'jpeg'
          ? 'image/jpeg'
          : null;
  if (!mimeType || !extension) {
    throw new Error('Format de photo non pris en charge. Utilisez une image JPEG, PNG ou WebP.');
  }

  const headers: Record<string, string> = {};
  if (currentToken) headers.Authorization = `Bearer ${currentToken}`;
  const response = await FileSystem.uploadAsync(`${customApiBaseUrl}/api${endpoint}`, photoUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType,
    headers,
  });
  let data: {
    error?: { message?: string };
    message?: string;
    success?: boolean;
    idPhoto?: string;
    referencePhoto?: string;
  } | null = null;
  try {
    data = JSON.parse(response.body);
  } catch {
    data = null;
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(data?.error?.message || data?.message || `Erreur serveur (${response.status})`);
  }
  if (!data?.success || !data.idPhoto || !data.referencePhoto) {
    throw new Error('Réponse invalide du serveur lors de la transmission de la photo.');
  }
  return { success: data.success, idPhoto: data.idPhoto, referencePhoto: data.referencePhoto };
}

export const mobileApi = {
  auth: {
    login: async (email: string, motDePasse: string) => {
      const res = await request<{
        success: boolean;
        token: string;
        utilisateur: MobileUser;
      }>('/auth/connexion', {
        method: 'POST',
        body: JSON.stringify({ email, motDePasse }),
      });
      if (res.token && res.utilisateur) {
        await saveAuthSession(res.token, res.utilisateur);
      }
      return res;
    },
    logout: async () => {
      try {
        await request('/auth/deconnexion', { method: 'POST' });
      } catch {
        // ignore network error on logout
      } finally {
        await clearAuthSession();
      }
    },
  },

  referentiels: {
    getTypesDechets: async () => {
      try {
        const res = await request<{ success: boolean; data: TypeDechetRef[] }>(
          '/referentiels/types-dechets'
        );
        await AsyncStorage.setItem(TYPES_DECHETS_CACHE_KEY, JSON.stringify(res.data));
        return res.data;
      } catch (requestError) {
        const cachedTypes = await AsyncStorage.getItem(TYPES_DECHETS_CACHE_KEY);
        if (!cachedTypes) throw requestError;

        const parsed: unknown = JSON.parse(cachedTypes);
        if (
          !Array.isArray(parsed) ||
          !parsed.every(
            (type): type is TypeDechetRef =>
              typeof type?.idTypeDechet === 'string' &&
              typeof type?.codeType === 'string' &&
              typeof type?.libelle === 'string'
          )
        ) {
          throw new Error('Le référentiel local des déchets est invalide. Reconnectez-vous pour le recharger.');
        }
        return parsed;
      }
    },
  },

  signalements: {
    create: async (draft: SignalementDraft) => {
      const res = await request<{ success: boolean; idSignalement: string; message: string }>(
        '/signalements',
        {
          method: 'POST',
          body: JSON.stringify({
            description: draft.description,
            latitude: draft.latitude,
            longitude: draft.longitude,
            precisionLocalisation: draft.precisionLocalisation,
            descriptionLocalisation: draft.descriptionLocalisation,
            categories: draft.categories,
          }),
        }
      );
      return res;
    },
    uploadPhoto: (idSignalement: string, photoUri: string) =>
      uploadPhoto(`/signalements/${idSignalement}/photos/contenu`, photoUri),
    getMine: async () => {
      const res = await request<{ success: boolean; count: number; data: SignalementItem[] }>(
        '/signalements/mes-signalements'
      );
      return res.data;
    },
  },

  interventions: {
    getMissions: async () => {
      const res = await request<{ success: boolean; count: number; data: MissionTerrainItem[] }>(
        '/interventions/mes-missions'
      );
      return res.data;
    },
    demarrer: async (idIntervention: string) => {
      return request<{ success: boolean; message: string }>(
        `/interventions/${idIntervention}/demarrer`,
        { method: 'POST' }
      );
    },
    uploadPhoto: (idIntervention: string, photoUri: string) =>
      uploadPhoto(`/interventions/${idIntervention}/photos/contenu`, photoUri),
    terminer: async (
      idIntervention: string,
      payload: {
        resultatIntervention: ResultatIntervention;
        compteRendu: string;
        motifException?: string;
      }
    ) => {
      return request<{ success: boolean; message: string }>(
        `/interventions/${idIntervention}/terminer`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
    },
  },

  points: {
    getMine: async () => {
      const res = await request<{
        success: boolean;
        soldeTotal: number;
        historique: PointItem[];
      }>('/points/mes-points');
      return res;
    },
  },

  notifications: {
    getMine: async () => {
      const res = await request<{
        success: boolean;
        count: number;
        nonLues: number;
        data: NotificationItem[];
      }>('/notifications');
      return res;
    },
    markAsRead: async (idNotification: string) => {
      return request<{ success: boolean }>(`/notifications/${idNotification}/lu`, {
        method: 'PATCH',
      });
    },
  },
};
