import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BootstrapIcon } from './BootstrapIcon';

export const MobileLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navigation = [
    { name: 'Инвестиции', href: '/mobile', icon: 'graph-up-arrow' },
    { name: 'Бюджет', href: '/budget_mobile', icon: 'wallet2' },
    { name: 'Обязательства', href: '/obligations_mobile', icon: 'file-earmark-text' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 safe-area-top">
      {/* Compact Header for Telegram */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <BootstrapIcon name="wallet2" className="text-primary-600 dark:text-primary-400 mr-2" size={24} />
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">BIGS</h1>
            </div>
            <button
              onClick={logout}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 rounded-lg transition-colors"
              title="Выход"
            >
              <BootstrapIcon name="box-arrow-right" size={20} />
            </button>
          </div>
        </div>

        {/* Bottom Navigation Bar */}
        <nav className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex justify-around">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex flex-col items-center justify-center px-2 py-3 flex-1 min-h-[60px] transition-colors active:bg-gray-100 dark:active:bg-gray-700 ${
                  isActive(item.href)
                    ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <BootstrapIcon name={item.icon} size={20} />
                <span className="text-xs mt-1 font-medium">{item.name}</span>
              </Link>
            ))}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="pb-20">
        <Outlet />
      </main>
    </div>
  );
};

