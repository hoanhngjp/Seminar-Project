import { apiClient, setAccessToken } from './api';

export type Role = 'Listener' | 'Creator' | 'Admin';

export interface LoginData {
  accessToken: string;
  expiresIn: number;
}

export interface MeData {
  id: string;
  username: string;
  role: Role;
  hasCompletedOnboarding: boolean;
  displayName?: string;
  avatarUrl?: string | null;
}

const resolveDisplayName = (me: MeData): string | null => {
  const name = me.displayName?.trim() || me.username?.trim();
  return name || null;
};

const fetchMe = async (): Promise<{ accessToken: string; userId: string; role: Role; hasCompletedOnboarding: boolean }> => {
  throw new Error('fetchMe must be called after setAccessToken');
};

const fetchMeWithToken = async (accessToken: string) => {
  setAccessToken(accessToken);
  const meRes = await apiClient.get<{ success: boolean; data: MeData }>('/api/v1/users/me');
  const me = meRes.data.data;
  return {
    accessToken,
    userId:               me.id,
    role:                 me.role,
    hasCompletedOnboarding: me.hasCompletedOnboarding,
    displayName:          resolveDisplayName(me),
    avatarUrl:            me.avatarUrl ?? null,
  };
};

export const authService = {
  login: async (credentials: { email: string; password: string }) => {
    const loginRes = await apiClient.post<{ success: boolean; data: LoginData }>('/api/v1/auth/login', credentials);
    return fetchMeWithToken(loginRes.data.data.accessToken);
  },

  googleSignIn: async (idToken: string) => {
    const loginRes = await apiClient.post<{ success: boolean; data: LoginData }>('/api/v1/auth/google', { idToken });
    return fetchMeWithToken(loginRes.data.data.accessToken);
  },

  register: async (data: { email: string; password: string; displayName: string; role?: string }) => {
    await apiClient.post('/api/v1/auth/register', data);
    return { success: true };
  },
};
