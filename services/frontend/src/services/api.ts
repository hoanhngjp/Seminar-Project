// Axios instance — migrated from api/client.ts
// Access token in-memory (NOT localStorage) per security-non-negotiable rule
import axios, { type AxiosError } from 'axios';

let _accessToken: string | null = null;
// Optional fallback getter — injected by AuthInitializer so the interceptor
// can recover the token from the zustand store when _accessToken is null
// (e.g. after Vite HMR clears module state).
let _tokenGetter: (() => string | null) | null = null;

export const setAccessToken = (token: string | null): void => {
  _accessToken = token;
};

export const getAccessToken = (): string | null => _accessToken;

/** Call once at app startup to register a store-backed token fallback. */
export const registerTokenGetter = (getter: () => string | null): void => {
  _tokenGetter = getter;
};

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000',
  withCredentials: true, // sends HTTP-only refresh cookie automatically
});

// Attach Bearer token to every request.
// Falls back to the registered store getter if the module-level variable is null.
apiClient.interceptors.request.use((config) => {
  const token = _accessToken ?? _tokenGetter?.() ?? null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Queue-based token refresh on 401 TOKEN_EXPIRED
let _isRefreshing = false;
let _refreshQueue: Array<(token: string | null) => void> = [];

const processQueue = (token: string | null): void => {
  _refreshQueue.forEach((cb) => cb(token));
  _refreshQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;

    const errorCode = (error.response?.data as { error?: { code?: string } })?.error?.code;
    // Never attempt to re-refresh if the failing request was itself a refresh call.
    // Without this guard, AuthInitializer's initial refresh (no cookie) → 401 →
    // interceptor retries refresh → deadlock → timeout → setAccessToken(null) → clears
    // the token set by a concurrent auto-login.
    const isRefreshRequest = original?.url?.includes('/auth/refresh');
    const shouldRefresh =
      error.response?.status === 401 &&
      (errorCode === 'TOKEN_EXPIRED' || errorCode === 'UNAUTHORIZED') &&
      !original?._retry &&
      !isRefreshRequest;

    if (!shouldRefresh) return Promise.reject(error);

    if (_isRefreshing) {
      return new Promise((resolve, reject) => {
        _refreshQueue.push((token) => {
          if (!token || !original) { reject(error); return; }
          original._retry = true;
          original.headers?.set('Authorization', `Bearer ${token}`);
          resolve(apiClient(original));
        });
      });
    }

    _isRefreshing = true;
    if (original) original._retry = true;

    try {
      const res = await apiClient.post<{ data: { accessToken: string } }>(
        '/api/v1/auth/refresh',
        {},
        { withCredentials: true },
      );
      const newToken = res.data.data.accessToken;
      setAccessToken(newToken);
      processQueue(newToken);
      if (original) {
        original.headers?.set('Authorization', `Bearer ${newToken}`);
        return apiClient(original);
      }
    } catch {
      setAccessToken(null);
      processQueue(null);
      window.location.href = '/login';
    } finally {
      _isRefreshing = false;
    }

    return Promise.reject(error);
  },
);
