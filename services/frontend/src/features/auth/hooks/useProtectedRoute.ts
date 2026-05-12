import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';

export function useProtectedRoute(allowedRoles?: string[]) {
  const role = useAuthStore((s) => s.role);
  const navigate = useNavigate();

  useEffect(() => {
    if (!role) {
      navigate('/login', { replace: true });
    } else if (allowedRoles && !allowedRoles.includes(role)) {
      navigate('/', { replace: true });
    }
  }, [role, allowedRoles, navigate]);
}
