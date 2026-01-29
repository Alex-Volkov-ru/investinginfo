import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { BootstrapIcon } from './BootstrapIcon';
import { PaymentReminders } from './PaymentReminders';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { userService } from '../services/userService';

export const Layout: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editField, setEditField] = useState<'name' | 'email' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const openEdit = (field: 'name' | 'email') => {
    setEditField(field);
    setEditValue(field === 'name' ? (user?.tg_username || '') : (user?.email || ''));
    setProfileOpen(false);
  };

  const closeEdit = () => {
    if (savingProfile) return;
    setEditField(null);
    setEditValue('');
  };

  const handleSaveProfile = async () => {
    if (!editField || !user) return;
    const value = editValue.trim();
    if (!value) return;
    setSavingProfile(true);
    try {
      if (editField === 'name') {
        const updated = await userService.updateName(value);
        updateUser({ tg_username: updated.tg_username });
        toast.success('Имя обновлено');
      } else {
        const updated = await userService.updateEmail(value);
        updateUser({ email: updated.email });
        toast.success('Почта обновлена');
      }
      closeEdit();
    } catch {
      // ошибки обрабатываются interceptor'ом
    } finally {
      setSavingProfile(false);
    }
  };

  const navigation = [
    { name: 'Инвестиции', href: '/', icon: 'graph-up-arrow' },
    { name: 'Бюджет', href: '/budget', icon: 'wallet2' },
    { name: 'Обязательства', href: '/obligations', icon: 'file-earmark-text' },
    ...(user?.is_staff ? [{ name: 'Админ', href: '/admin', icon: 'shield-lock' }] : []),
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
            <div className="hidden md:flex items-center space-x-4 relative">
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
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((v) => !v)}
                  className="flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <span className="mr-2">{user?.tg_username || 'Гость'}</span>
                  <BootstrapIcon name="chevron-down" size={14} />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 z-30">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user?.tg_username || 'Без имени'}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 break-all">
                        {user?.email}
                      </div>
                    </div>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => openEdit('name')}
                    >
                      Изменить имя
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => openEdit('email')}
                    >
                      Изменить почту
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                      }}
                    >
                      <BootstrapIcon name="box-arrow-right" className="mr-2" size={16} />
                      Выход
                    </button>
                  </div>
                )}
              </div>
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

      {editField && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-sm p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {editField === 'name' ? 'Изменить имя' : 'Изменить почту'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {editField === 'name' ? 'Имя' : 'Почта'}
                </label>
                <input
                  type={editField === 'email' ? 'email' : 'text'}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={closeEdit}
                  disabled={savingProfile}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn btn-primary text-sm"
                  onClick={handleSaveProfile}
                  disabled={savingProfile || !editValue.trim()}
                >
                  {savingProfile ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

