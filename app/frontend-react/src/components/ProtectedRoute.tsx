import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Сохраняем информацию о мобильном маршруте в localStorage
    const isMobileRoute = location.pathname.includes('_mobile') || location.pathname === '/mobile';
    if (isMobileRoute) {
      localStorage.setItem('preferredMobileRoute', 'true');
    } else {
      localStorage.removeItem('preferredMobileRoute');
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

