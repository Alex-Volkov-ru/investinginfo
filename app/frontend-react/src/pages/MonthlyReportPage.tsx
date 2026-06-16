import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MonthlyReviewBanner } from '../components/MonthlyReviewBanner';

export default function MonthlyReportPage() {
  const { user, isInitializing } = useAuth();
  const location = useLocation();
  const isMobileRoute = location.pathname === '/monthly_report_mobile';

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500 dark:text-gray-400">
        Загрузка…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div
      className={isMobileRoute ? 'px-3 pt-3 pb-6' : 'max-w-4xl mx-auto px-4 py-6'}
      data-tour="monthly-report"
    >
      <h1 className={`font-semibold text-gray-900 dark:text-gray-100 ${isMobileRoute ? 'text-lg mb-3' : 'text-2xl mb-4'}`}>
        Сводка месяца
      </h1>
      <p className={`text-gray-600 dark:text-gray-400 ${isMobileRoute ? 'text-xs mb-3' : 'text-sm mb-4'}`}>
        Бюджет, инвестиции и обязательства за выбранный месяц. Переключайте месяцы стрелками.
      </p>
      <MonthlyReviewBanner standalone compact={isMobileRoute} />
    </div>
  );
}
