import { apiClient } from './api';

export type Role = 'Listener' | 'Creator' | 'Admin';

export interface LoginData {
  accessToken: string;
  expiresIn: number;
}

export interface MeData {
  id: string;
  username: string;
  role: Role;
}

export const authService = {
  login: async (credentials: Record<string, string>) => {
    const loginRes = await apiClient.post<{ success: boolean; data: LoginData }>('/api/v1/auth/login', credentials);
    const meRes = await apiClient.get<{ success: boolean; data: MeData }>('/api/v1/users/me');
    
    return {
      accessToken: loginRes.data.data.accessToken,
      userId: meRes.data.data.id,
      role: meRes.data.data.role,
    };
  },
  
  register: async (data: any) => {
    // Mock the register endpoint for now
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true };
  },
};
