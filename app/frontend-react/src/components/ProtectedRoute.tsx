import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { saveReturnUrl } from '../lib/authReturn';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
        Загрузка…
      </div>
    );
  }

  if (!isAuthenticated) {
    const isMobileRoute = location.pathname.includes('_mobile') || location.pathname === '/mobile';
    if (isMobileRoute) {
      localStorage.setItem('preferredMobileRoute', 'true');
    } else {
      localStorage.removeItem('preferredMobileRoute');
    }
    saveReturnUrl(location.pathname + location.search);
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};
