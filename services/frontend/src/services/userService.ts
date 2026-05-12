import { apiClient } from './api';

export interface UpdatePreferencesPayload {
  preferredGenres: string[];
  preferredArtists: string[];
  audioQuality?: string;
}

export const userService = {
  updatePreferences: async (payload: UpdatePreferencesPayload) => {
    const res = await apiClient.post<{ success: boolean; data: any }>('/api/v1/users/me/preferences', payload);
    return res.data;
  },
};
