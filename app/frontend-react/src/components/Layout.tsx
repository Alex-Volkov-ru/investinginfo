import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { BootstrapIcon } from './BootstrapIcon';
import { PaymentReminders } from './PaymentReminders';
import { useState } from 'react';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Инвестиции', href: '/', icon: 'graph-up-arrow' },
    { name: 'Бюджет', href: '/budget', icon: 'wallet2' },
    { name: 'Обязательства', href: '/obligations', icon: 'file-earmark-text' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <BootstrapIcon name="wallet2" className="text-primary-600 dark:text-primary-400 mr-2" size={32} />
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">WealthTracker</h1>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-1">
              {navigation.map((item) => {
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <BootstrapIcon name={item.icon} className="mr-2" size={16} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* User menu */}
            <div className="hidden md:flex items-center space-x-4">
              <PaymentReminders />
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
              >
                {theme === 'dark' ? (
                  <BootstrapIcon name="sun-fill" size={20} />
                ) : (
                  <BootstrapIcon name="moon-fill" size={20} />
                )}
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">{user?.tg_username || 'Гость'}</span>
              <button
                onClick={logout}
                className="flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <BootstrapIcon name="box-arrow-right" className="mr-2" size={16} />
                Выход
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <BootstrapIcon name="x" size={24} />
              ) : (
                <BootstrapIcon name="list" size={24} />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => {
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center px-3 py-2 rounded-lg text-base font-medium ${
                      isActive(item.href)
                        ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <BootstrapIcon name={item.icon} className="mr-3" size={20} />
                    {item.name}
                  </Link>
                );
              })}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={toggleTheme}
                  className="flex items-center w-full px-3 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  {theme === 'dark' ? (
                    <>
                      <BootstrapIcon name="sun-fill" className="mr-3" size={20} />
                      Светлая тема
                    </>
                  ) : (
                    <>
                      <BootstrapIcon name="moon-fill" className="mr-3" size={20} />
                      Темная тема
                    </>
                  )}
                </button>
                <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{user?.tg_username || 'Гость'}</div>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <BootstrapIcon name="box-arrow-right" className="mr-3" size={20} />
                  Выход
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};

