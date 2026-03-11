import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

/**
 * Wraps all protected routes. Consumes AuthContext (set up in Step 2).
 *
 * - While isLoading: full-screen spinner (prevents flash-of-redirect on refresh)
 * - Authenticated: renders child routes via <Outlet />
 * - Unauthenticated: redirects to /auth
 */
export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}
