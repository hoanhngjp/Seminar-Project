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

  const login = async (credentials: Record<string, string>) => {
    setLoading(true);
    setErrorMsg(null);
    setIsLocked(false);
    
    try {
      const { accessToken, userId, role } = await authService.login(credentials);
      setAccessToken(accessToken);
      setAuth(accessToken, userId, role);
      navigate(role === 'Creator' ? '/dashboard' : '/');
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

  return { login, register, loading, errorMsg, setErrorMsg, isLocked };
}
