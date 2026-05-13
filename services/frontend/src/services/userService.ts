import { apiClient } from './api';
import type { ApiResponse } from '../types/api';

export interface UpdatePreferencesPayload {
  preferredGenres: string[];
  preferredArtists: string[];
  audioQuality?: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  hasCompletedOnboarding: boolean;
}

export const userService = {
  getProfile: async (): Promise<UserProfile> => {
    const res = await apiClient.get<ApiResponse<UserProfile>>('/api/v1/users/me');
    return res.data.data!;
  },

  updatePreferences: async (payload: UpdatePreferencesPayload) => {
    const res = await apiClient.post<{ success: boolean; data: unknown }>('/api/v1/users/me/preferences', payload);
    return res.data;
  },
};
