import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;
  userId: string | null;
  role: 'Listener' | 'Creator' | 'Admin' | null;
  setAuth: (token: string, userId: string, role: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  userId: null,
  role: null,
  setAuth: (token, userId, role) =>
    set({ accessToken: token, userId, role: role as AuthState['role'] }),
  clearAuth: () => set({ accessToken: null, userId: null, role: null }),
}));
