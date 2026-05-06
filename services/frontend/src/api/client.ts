import axios, { AxiosError } from 'axios';

// Access token in-memory — không dùng localStorage (XSS risk)
let _accessToken: string | null = null;
export const setAccessToken = (token: string | null) => { _accessToken = token; };
export const getAccessToken = () => _accessToken;

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  withCredentials: true, // gửi HTTP-only refresh cookie tự động
});

apiClient.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

let _isRefreshing = false;
let _refreshQueue: Array<(token: string | null) => void> = [];

const processQueue = (token: string | null) => {
  _refreshQueue.forEach((cb) => cb(token));
  _refreshQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;

    const errorCode = (error.response?.data as { error?: { code?: string } })?.error?.code;
    const isTokenExpired =
      error.response?.status === 401 && errorCode === 'TOKEN_EXPIRED' && !original?._retry;

    if (!isTokenExpired) {
      return Promise.reject(error);
    }

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
      // redirect to login — import dynamically to avoid circular dep
      window.location.href = '/login';
    } finally {
      _isRefreshing = false;
    }

    return Promise.reject(error);
  },
);
