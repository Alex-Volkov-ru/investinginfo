import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MonthlyReviewBanner } from '../components/MonthlyReviewBanner';

export default function MonthlyReportPage() {
  const { user } = useAuth();
  const location = useLocation();
  const isMobileRoute = location.pathname === '/monthly_report_mobile';

  if (!user?.is_staff) {
    return <Navigate to={isMobileRoute ? '/mobile' : '/'} replace />;
  }

  return (
    <div className={isMobileRoute ? 'px-3 pt-3 pb-6' : 'max-w-4xl mx-auto px-4 py-6'}>
      <MonthlyReviewBanner standalone compact={isMobileRoute} />
    </div>
  );
}
