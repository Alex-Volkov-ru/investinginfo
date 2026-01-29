import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { BootstrapIcon } from './BootstrapIcon';
import { PaymentReminders } from './PaymentReminders';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { userService } from '../services/userService';

export const MobileLayout: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
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
    { name: 'Инвестиции', href: '/mobile', icon: 'graph-up-arrow' },
    { name: 'Бюджет', href: '/budget_mobile', icon: 'wallet2' },
    { name: 'Обязательства', href: '/obligations_mobile', icon: 'file-earmark-text' },
    ...(user?.is_staff ? [{ name: 'Админ', href: '/admin_mobile', icon: 'shield-lock' as const }] : []),
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 safe-area-top">
      {/* Compact Header for Telegram */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/mobile" className="flex items-center">
              <BootstrapIcon name="wallet2" className="text-primary-600 dark:text-primary-400 mr-2" size={24} />
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">WealthTracker</h1>
            </Link>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="text-xs text-gray-600 dark:text-gray-400 active:opacity-70 px-2 py-1 rounded"
              >
                {user?.tg_username || 'Гость'}
              </button>
              <PaymentReminders isMobile={true} />
              <button
                onClick={toggleTheme}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 rounded-lg transition-colors"
                title={theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
              >
                {theme === 'dark' ? (
                  <BootstrapIcon name="sun-fill" size={20} />
                ) : (
                  <BootstrapIcon name="moon-fill" size={20} />
                )}
              </button>
            </div>
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

      {/* Profile Bottom Sheet */}
      {profileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setProfileOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-lg z-50 max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Профиль</h2>
              <button
                onClick={() => setProfileOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 dark:text-gray-400 active:opacity-70"
              >
                <BootstrapIcon name="x" size={24} />
              </button>
            </div>
            <div className="px-4 py-4 space-y-1">
              <div className="px-4 py-3 mb-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {user?.tg_username || 'Без имени'}
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 break-all">
                  {user?.email}
                </div>
              </div>
              <button
                className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700 rounded-lg flex items-center"
                onClick={() => openEdit('name')}
              >
                <BootstrapIcon name="person" className="mr-3" size={18} />
                Изменить имя
              </button>
              <button
                className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700 rounded-lg flex items-center"
                onClick={() => openEdit('email')}
              >
                <BootstrapIcon name="envelope" className="mr-3" size={18} />
                Изменить почту
              </button>
              <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
              <button
                className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 active:bg-gray-100 dark:active:bg-gray-700 rounded-lg flex items-center"
                onClick={() => {
                  setProfileOpen(false);
                  logout();
                }}
              >
                <BootstrapIcon name="box-arrow-right" className="mr-3" size={18} />
                Выход
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit Modal */}
      {editField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
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
                  className="btn btn-secondary text-sm min-h-[44px]"
                  onClick={closeEdit}
                  disabled={savingProfile}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn btn-primary text-sm min-h-[44px]"
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

