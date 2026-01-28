import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { backupService, BackupInfo } from '../services/backupService';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../lib/auth';

type AdminTab = 'backups' | 'investments' | 'budget' | 'obligations';

const AdminPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('backups');

  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [diskUsage, setDiskUsage] = useState<any>(null);

  const [confirm, setConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmButtonClass?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const isStaff = !!user?.is_staff;

  const canShow = useMemo(() => isStaff, [isStaff]);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const data = await backupService.list();
      setBackups(data.backups || []);
      setDiskUsage(data.disk_usage || null);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canShow) return;
    if (activeTab === 'backups') {
      loadBackups();
    }
  }, [canShow]);

  useEffect(() => {
    if (!canShow) return;
    if (activeTab === 'backups') {
      loadBackups();
    }
  }, [activeTab, canShow]);

  const onCreateBackup = async () => {
    try {
      const res = await backupService.create();
      toast.success(res.message || 'Запущено создание бэкапа');
      setTimeout(() => void loadBackups(), 1500);
    } catch {
      // handled by interceptor
    }
  };

  const onRotate = async () => {
    try {
      const res = await backupService.rotate();
      toast.success(res.message || 'Ротация бэкапов запущена');
      setTimeout(() => void loadBackups(), 1500);
    } catch {
      // handled by interceptor
    }
  };

  const onRestore = (filename: string) => {
    setConfirm({
      isOpen: true,
      title: 'Восстановление бэкапа',
      message: `Восстановить БД из ${filename}? Это перезапишет данные в базе.`,
      confirmText: 'Восстановить',
      confirmButtonClass: 'btn-danger',
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, isOpen: false }));
        try {
          const res = await backupService.restore(filename, false);
          toast.success(res.message || 'Восстановление запущено');
        } catch {
          // handled by interceptor
        }
      },
    });
  };

  const onDelete = (filename: string) => {
    setConfirm({
      isOpen: true,
      title: 'Удаление бэкапа',
      message: `Удалить ${filename}?`,
      confirmText: 'Удалить',
      confirmButtonClass: 'btn-danger',
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, isOpen: false }));
        try {
          const res = await backupService.delete(filename);
          toast.success(res.message || 'Бэкап удален');
          await loadBackups();
        } catch {
          // handled by interceptor
        }
      },
    });
  };

  if (!canShow) {
    return (
      <div className="card">
        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Админ-панель</div>
        <div className="text-gray-700 dark:text-gray-300">Нет доступа (требуется роль администратора).</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Админ</h1>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {user?.email}
        </div>
      </div>

      <div className="flex space-x-2">
        <button
          className={`btn ${activeTab === 'backups' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('backups')}
        >
          Бэкапы
        </button>
        <button
          className={`btn ${activeTab === 'investments' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('investments')}
        >
          Инвестиции
        </button>
        <button
          className={`btn ${activeTab === 'budget' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('budget')}
        >
          Бюджет
        </button>
        <button
          className={`btn ${activeTab === 'obligations' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('obligations')}
        >
          Обязательства
        </button>
      </div>

      {activeTab === 'backups' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Бэкапы</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Управление бэкапами БД.
                <span className="ml-1">
                  «Ротация» — удаление старых бэкапов по правилу хранения (например, старше 30 дней).
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button className="btn btn-secondary" onClick={() => void loadBackups()} disabled={loading}>
                Обновить
              </button>
              <button
                className="btn btn-secondary"
                onClick={onRotate}
                disabled={loading}
                title="Ротация: удалить старые бэкапы по сроку хранения"
              >
                Ротация
              </button>
              <button
                className="btn btn-primary"
                onClick={onCreateBackup}
                disabled={loading}
                title="Создать новый бэкап базы данных"
              >
                Создать бэкап
              </button>
            </div>
          </div>

          {diskUsage && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-600 dark:text-gray-400">Бэкапов</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{diskUsage.backup_count}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-600 dark:text-gray-400">Размер бэкапов</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{diskUsage.backup_total_size_mb} MB</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-600 dark:text-gray-400">Диск (used)</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{diskUsage.disk_usage_percent}%</div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Файл</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Создан</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Размер</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {backups.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400" colSpan={4}>
                      {loading ? 'Загрузка...' : 'Бэкапов нет'}
                    </td>
                  </tr>
                ) : (
                  backups.map((b) => (
                    <tr key={b.filename}>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{b.filename}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {b.created_at ? format(new Date(b.created_at), 'dd.MM.yyyy HH:mm') : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{b.size_mb} MB</td>
                      <td className="px-4 py-2 text-right space-x-2">
                        <a
                          className="btn btn-secondary"
                          href={
                            `${backupService.downloadUrl(b.filename)}?token=${encodeURIComponent(
                              authService.getToken() || '',
                            )}`
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          Скачать
                        </a>
                        <button className="btn btn-secondary" onClick={() => onRestore(b.filename)}>
                          Восстановить
                        </button>
                        <button className="btn btn-danger" onClick={() => onDelete(b.filename)}>
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab !== 'backups' && (
        <div className="card">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {activeTab === 'investments' ? 'Инвестиции' : activeTab === 'budget' ? 'Бюджет' : 'Обязательства'}
          </div>
          <div className="text-gray-700 dark:text-gray-300">
            Панель в разработке. Здесь будут админ‑инструменты для раздела.
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirm.isOpen}
        title={confirm.title}
        message={confirm.message}
        onCancel={() => setConfirm((c) => ({ ...c, isOpen: false }))}
        onConfirm={confirm.onConfirm}
        confirmText={confirm.confirmText}
        confirmButtonClass={confirm.confirmButtonClass}
      />
    </div>
  );
};

export default AdminPage;

