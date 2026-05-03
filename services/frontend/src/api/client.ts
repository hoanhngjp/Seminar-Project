import axios from 'axios';

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

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // TODO Week 2: handle 401 TOKEN_EXPIRED → auto refresh
    return Promise.reject(error);
  },
);
