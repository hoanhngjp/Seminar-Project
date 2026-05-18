import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;
  userId: string | null;
  role: 'Listener' | 'Creator' | 'Admin' | null;
  displayName: string | null;
  avatarUrl: string | null;
  hasCompletedOnboarding: boolean;
  isInitialized: boolean;
  setAuth: (token: string, userId: string, role: string, hasCompletedOnboarding?: boolean, displayName?: string | null, avatarUrl?: string | null) => void;
  completeOnboarding: () => void;
  clearAuth: () => void;
  setInitialized: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  userId: null,
  role: null,
  displayName: null,
  avatarUrl: null,
  hasCompletedOnboarding: false,
  isInitialized: false,
  setAuth: (token, userId, role, hasCompletedOnboarding = false, displayName = null, avatarUrl = null) =>
    set({ accessToken: token, userId, role: role as AuthState['role'], hasCompletedOnboarding, displayName, avatarUrl }),
  completeOnboarding: () => set({ hasCompletedOnboarding: true }),
  clearAuth: () => set({ accessToken: null, userId: null, role: null, hasCompletedOnboarding: false, displayName: null, avatarUrl: null }),
  setInitialized: () => set({ isInitialized: true }),
}));
