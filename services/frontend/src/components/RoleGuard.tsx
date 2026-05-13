import type { ReactNode } from 'react';
import { useProtectedRoute } from '../features/auth/hooks/useProtectedRoute';
import type { Role } from '../types/domain';

interface Props {
  roles: Role[];
  children: ReactNode;
}

export default function RoleGuard({ roles, children }: Props) {
  useProtectedRoute(roles);
  return <>{children}</>;
}
