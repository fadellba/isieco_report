export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  public code: string;
  public details?: unknown;
  public status: number;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  let normalizedPath = endpoint;
  if (!endpoint.startsWith('http')) {
    if (endpoint.startsWith('/api/')) {
      normalizedPath = endpoint;
    } else if (endpoint === '/api') {
      normalizedPath = '/api';
    } else {
      normalizedPath = `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    }
  }
  const url = normalizedPath;

  const headers: Record<string, string> = {
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Envoi automatique des cookies HttpOnly de session
  });

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorData = isRecord(data) ? data : {};
    const apiError = isRecord(errorData.error) ? errorData.error : {};
    const errorMsg =
      (typeof apiError.message === 'string' && apiError.message) ||
      (typeof errorData.message === 'string' && errorData.message) ||
      `Erreur requête (${response.status})`;
    const errorCode = typeof apiError.code === 'string' ? apiError.code : 'API_ERROR';
    throw new ApiError(errorMsg, errorCode, response.status, apiError.details);
  }

  return data as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const api = {
  get: <T = unknown>(endpoint: string, headers?: Record<string, string>) =>
    apiRequest<T>(endpoint, { method: 'GET', headers }),

  post: <T = unknown>(endpoint: string, body?: unknown, headers?: Record<string, string>) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    }),

  put: <T = unknown>(endpoint: string, body?: unknown, headers?: Record<string, string>) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    }),

  patch: <T = unknown>(endpoint: string, body?: unknown, headers?: Record<string, string>) =>
    apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    }),

  delete: <T = unknown>(endpoint: string, headers?: Record<string, string>) =>
    apiRequest<T>(endpoint, { method: 'DELETE', headers }),
};

export const apiClient = api;
