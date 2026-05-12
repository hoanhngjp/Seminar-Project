import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;
  userId: string | null;
  role: 'Listener' | 'Creator' | 'Admin' | null;
  hasCompletedOnboarding: boolean;
  setAuth: (token: string, userId: string, role: string, hasCompletedOnboarding?: boolean) => void;
  completeOnboarding: () => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  userId: null,
  role: null,
  hasCompletedOnboarding: false,
  setAuth: (token, userId, role, hasCompletedOnboarding = false) =>
    set({ accessToken: token, userId, role: role as AuthState['role'], hasCompletedOnboarding }),
  completeOnboarding: () => set({ hasCompletedOnboarding: true }),
  clearAuth: () => set({ accessToken: null, userId: null, role: null, hasCompletedOnboarding: false }),
}));
