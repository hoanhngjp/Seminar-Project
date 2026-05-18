import { useEffect, useRef, type ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient, setAccessToken, registerTokenGetter } from '../services/api';

interface MeData {
  id: string;
  username?: string;
  role: string;
  hasCompletedOnboarding: boolean;
  displayName?: string;
  avatarUrl?: string | null;
}

export default function AuthInitializer({ children }: { children: ReactNode }) {
  const setAuth        = useAuthStore((s) => s.setAuth);
  const clearAuth      = useAuthStore((s) => s.clearAuth);
  const setInitialized = useAuthStore((s) => s.setInitialized);
  const hasRun = useRef(false);

  useEffect(() => {
    // Register store-backed token fallback so the Axios interceptor can recover
    // the token from zustand when the module-level variable is null (Vite HMR, etc.)
    registerTokenGetter(() => useAuthStore.getState().accessToken);

    if (hasRun.current) return;
    hasRun.current = true;

    apiClient
      .post<{ success: boolean; data: { accessToken: string } }>(
        '/api/v1/auth/refresh',
        {},
        { withCredentials: true },
      )
      .then(async (res) => {
        const token = res.data.data.accessToken;
        setAccessToken(token);
        const meRes = await apiClient.get<{ success: boolean; data: MeData }>('/api/v1/users/me');
        const me = meRes.data.data;
        const displayName = me.displayName?.trim() || me.username?.trim() || null;
        setAuth(token, me.id, me.role, me.hasCompletedOnboarding, displayName, me.avatarUrl ?? null);
      })
      .catch(() => {
        // Only clear if the user hasn't authenticated via login/register in the meantime.
        // This prevents the race condition where auto-login sets the token after
        // AuthInitializer's refresh request was already sent (no cookie yet).
        if (!useAuthStore.getState().accessToken) {
          clearAuth();
        }
      })
      .finally(() => {
        setInitialized();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
