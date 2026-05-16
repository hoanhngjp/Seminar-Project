import { useEffect, useRef, type ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient, setAccessToken } from '../services/api';

interface MeData {
  id: string;
  role: string;
  hasCompletedOnboarding: boolean;
}

export default function AuthInitializer({ children }: { children: ReactNode }) {
  const setAuth        = useAuthStore((s) => s.setAuth);
  const clearAuth      = useAuthStore((s) => s.clearAuth);
  const setInitialized = useAuthStore((s) => s.setInitialized);
  const hasRun = useRef(false);

  useEffect(() => {
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
        setAuth(token, me.id, me.role, me.hasCompletedOnboarding);
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => {
        setInitialized();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
