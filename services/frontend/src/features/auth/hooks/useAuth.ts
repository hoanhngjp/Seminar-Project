import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { authService } from '../../../services/authService';
import { setAccessToken } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errorMessages';

export function useAuth() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const handleAuthSuccess = (
    accessToken: string,
    userId: string,
    role: string,
    hasCompletedOnboarding: boolean,
    displayName?: string | null,
    avatarUrl?: string | null,
  ) => {
    setAccessToken(accessToken);
    setAuth(accessToken, userId, role as any, hasCompletedOnboarding, displayName, avatarUrl);
    if (!hasCompletedOnboarding && role === 'Listener') {
      navigate('/onboarding');
    } else {
      navigate(role === 'Creator' ? '/dashboard' : '/');
    }
  };

  const login = async (credentials: { email: string; password: string }) => {
    setLoading(true);
    setErrorMsg(null);
    setIsLocked(false);
    try {
      const { accessToken, userId, role, hasCompletedOnboarding, displayName, avatarUrl } = await authService.login(credentials);
      handleAuthSuccess(accessToken, userId, role, hasCompletedOnboarding, displayName, avatarUrl);
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === 'ACCOUNT_LOCKED') {
        setIsLocked(true);
      } else {
        setErrorMsg(getErrorMessage(code));
      }
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async (idToken: string) => {
    setLoading(true);
    setErrorMsg(null);
    setIsLocked(false);
    try {
      const { accessToken, userId, role, hasCompletedOnboarding, displayName, avatarUrl } = await authService.googleSignIn(idToken);
      handleAuthSuccess(accessToken, userId, role, hasCompletedOnboarding, displayName, avatarUrl);
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      setErrorMsg(getErrorMessage(code) ?? 'Đăng nhập Google thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: any) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await authService.register(data);
      navigate('/login');
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      setErrorMsg(getErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  return { login, googleLogin, register, loading, errorMsg, setErrorMsg, isLocked };
}
