import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { backupService, BackupInfo } from '../services/backupService';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../lib/auth';
import { userService, UserListItem } from '../services/userService';
import { BootstrapIcon } from '../components/BootstrapIcon';

type AdminTab = 'backups' | 'users' | 'investments' | 'budget' | 'obligations';

const AdminPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('backups');

  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [diskUsage, setDiskUsage] = useState<any>(null);
  
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStaff, setFilterStaff] = useState<'all' | 'staff' | 'regular'>('all');
  const [sortField, setSortField] = useState<'created_at' | 'last_login_at' | 'email'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [editField, setEditField] = useState<'name' | 'email' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState<number | null>(null);

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

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await userService.listUsers();
      setUsers(data);
    } catch {
      // handled by interceptor
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (!canShow) return;
    if (activeTab === 'backups') {
      loadBackups();
    } else if (activeTab === 'users') {
      loadUsers();
    }
  }, [canShow]);

  useEffect(() => {
    if (!canShow) return;
    if (activeTab === 'backups') {
      loadBackups();
    } else if (activeTab === 'users') {
      loadUsers();
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

  const handleToggleStaff = (user: UserListItem) => {
    const newStatus = !user.is_staff;
    setConfirm({
      isOpen: true,
      title: newStatus ? 'Назначить администратором' : 'Снять права администратора',
      message: `${newStatus ? 'Назначить' : 'Снять права администратора у'} пользователя ${user.email}?`,
      confirmText: newStatus ? 'Назначить' : 'Снять',
      confirmButtonClass: newStatus ? 'btn-primary' : 'btn-danger',
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, isOpen: false }));
        try {
          await userService.toggleStaff(user.id, newStatus);
          toast.success(newStatus ? 'Права администратора назначены' : 'Права администратора сняты');
          await loadUsers();
        } catch {
          // handled by interceptor
        }
      },
    });
  };

  const openEditUser = (user: UserListItem, field: 'name' | 'email') => {
    setEditingUser(user);
    setEditField(field);
    setEditValue(field === 'name' ? (user.tg_username || '') : user.email);
  };

  const closeEditUser = () => {
    if (savingEdit) return;
    setEditingUser(null);
    setEditField(null);
    setEditValue('');
  };

  const handleSaveEdit = async () => {
    if (!editingUser || !editField) return;
    const value = editValue.trim();
    if (!value) return;
    setSavingEdit(true);
    try {
      if (editField === 'name') {
        await userService.adminUpdateName(editingUser.id, value);
        toast.success('Имя обновлено');
      } else {
        await userService.adminUpdateEmail(editingUser.id, value);
        toast.success('Почта обновлена');
      }
      await loadUsers();
      closeEditUser();
    } catch {
      // handled by interceptor
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.email.toLowerCase().includes(query) ||
          (u.tg_username && u.tg_username.toLowerCase().includes(query))
      );
    }

    if (filterStaff !== 'all') {
      filtered = filtered.filter((u) => (filterStaff === 'staff') === u.is_staff);
    }

    const sorted = [...filtered].sort((a, b) => {
      let aVal: string | number | undefined;
      let bVal: string | number | undefined;

      if (sortField === 'email') {
        aVal = a.email.toLowerCase();
        bVal = b.email.toLowerCase();
      } else if (sortField === 'created_at') {
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
      } else if (sortField === 'last_login_at') {
        aVal = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
        bVal = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
      }

      if (aVal === undefined || bVal === undefined) return 0;
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [users, searchQuery, filterStaff, sortField, sortDirection]);

  if (!canShow) {
    return (
      <div className="card">
        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Админ-панель</div>
        <div className="text-gray-700 dark:text-gray-300">Нет доступа (требуется роль администратора).</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 md:px-0 md:py-0 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">Админ</h1>
        <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 truncate max-w-[50%] text-right">
          {user?.email}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className={`btn text-xs md:text-sm ${activeTab === 'backups' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('backups')}
        >
          Бэкапы
        </button>
        <button
          className={`btn text-xs md:text-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('users')}
        >
          Пользователи
        </button>
        <button
          className={`btn text-xs md:text-sm ${activeTab === 'investments' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('investments')}
        >
          Инвестиции
        </button>
        <button
          className={`btn text-xs md:text-sm ${activeTab === 'budget' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('budget')}
        >
          Бюджет
        </button>
        <button
          className={`btn text-xs md:text-sm ${activeTab === 'obligations' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('obligations')}
        >
          Обязательства
        </button>
      </div>

      {activeTab === 'backups' && (
        <div className="card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
            <div className="text-sm md:text-base">
              <div className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">Бэкапы</div>
              <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
                Управление бэкапами БД.
                <span className="ml-1">
                  «Ротация» — удаление старых бэкапов по правилу хранения (например, старше 30 дней).
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0 sm:space-x-2">
              <button
                className="btn btn-secondary w-full sm:w-auto text-xs md:text-sm"
                onClick={() => void loadBackups()}
                disabled={loading}
              >
                Обновить
              </button>
              <button
                className="btn btn-secondary w-full sm:w-auto text-xs md:text-sm"
                onClick={onRotate}
                disabled={loading}
                title="Ротация: удалить старые бэкапы по сроку хранения"
              >
                Ротация
              </button>
              <button
                className="btn btn-primary w-full sm:w-auto text-xs md:text-sm"
                onClick={onCreateBackup}
                disabled={loading}
                title="Создать новый бэкап базы данных"
              >
                Создать бэкап
              </button>
            </div>
          </div>

          {diskUsage && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="text-[11px] md:text-xs text-gray-600 dark:text-gray-400">Бэкапов</div>
                <div className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {diskUsage.backup_count}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="text-[11px] md:text-xs text-gray-600 dark:text-gray-400">Размер бэкапов</div>
                <div className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {diskUsage.backup_total_size_mb} MB
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="text-[11px] md:text-xs text-gray-600 dark:text-gray-400">Диск (used)</div>
                <div className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {diskUsage.disk_usage_percent}%
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Файл</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Создан</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Размер</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {backups.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-gray-600 dark:text-gray-400" colSpan={4}>
                      {loading ? 'Загрузка...' : 'Бэкапов нет'}
                    </td>
                  </tr>
                ) : (
                  backups.map((b) => (
                    <tr key={b.filename}>
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100 break-all">{b.filename}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {b.created_at ? format(new Date(b.created_at), 'dd.MM.yyyy HH:mm') : '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{b.size_mb} MB</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end flex-wrap gap-1">
                          <a
                            className="btn btn-secondary text-xs md:text-sm"
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
                          <button
                            className="btn btn-secondary text-xs md:text-sm"
                            onClick={() => onRestore(b.filename)}
                          >
                            Восстановить
                          </button>
                          <button
                            className="btn btn-danger text-xs md:text-sm"
                            onClick={() => onDelete(b.filename)}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
            <div className="text-sm md:text-base">
              <div className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">Пользователи</div>
              <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
                Управление пользователями системы
              </div>
            </div>
            <button
              className="btn btn-secondary w-full sm:w-auto text-xs md:text-sm"
              onClick={() => void loadUsers()}
              disabled={usersLoading}
            >
              Обновить
            </button>
          </div>

          <div className="mb-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Поиск по email или имени..."
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={filterStaff}
                onChange={(e) => setFilterStaff(e.target.value as 'all' | 'staff' | 'regular')}
              >
                <option value="all">Все</option>
                <option value="staff">Администраторы</option>
                <option value="regular">Обычные</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300 w-12">ID</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300 min-w-[150px]">
                    <button
                      className="hover:text-primary-600 dark:hover:text-primary-400"
                      onClick={() => {
                        if (sortField === 'email') {
                          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('email');
                          setSortDirection('asc');
                        }
                      }}
                    >
                      Email {sortField === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300 hidden sm:table-cell min-w-[100px]">Имя</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300 w-24">Роль</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300 hidden md:table-cell whitespace-nowrap">
                    <button
                      className="hover:text-primary-600 dark:hover:text-primary-400"
                      onClick={() => {
                        if (sortField === 'created_at') {
                          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('created_at');
                          setSortDirection('desc');
                        }
                      }}
                    >
                      Регистрация {sortField === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300 hidden lg:table-cell whitespace-nowrap">
                    <button
                      className="hover:text-primary-600 dark:hover:text-primary-400"
                      onClick={() => {
                        if (sortField === 'last_login_at') {
                          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('last_login_at');
                          setSortDirection('desc');
                        }
                      }}
                    >
                      Последний вход {sortField === 'last_login_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="px-2 py-2 text-right font-medium text-gray-600 dark:text-gray-300 w-20">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {usersLoading ? (
                  <tr>
                    <td className="px-2 py-4 text-gray-600 dark:text-gray-400" colSpan={7}>
                      Загрузка...
                    </td>
                  </tr>
                ) : filteredAndSortedUsers.length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-gray-600 dark:text-gray-400" colSpan={7}>
                      Пользователи не найдены
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="px-2 py-2 text-gray-700 dark:text-gray-300">{u.id}</td>
                      <td className="px-2 py-2 text-gray-900 dark:text-gray-100 break-all">
                        <div className="font-medium">{u.email}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 sm:hidden mt-1">
                          {u.tg_username || 'Без имени'} • {format(new Date(u.created_at), 'dd.MM.yyyy')}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-gray-700 dark:text-gray-300 hidden sm:table-cell">{u.tg_username || '-'}</td>
                      <td className="px-2 py-2">
                        {u.is_staff ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200">
                            Админ
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                            Обыч.
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-gray-700 dark:text-gray-300 hidden md:table-cell whitespace-nowrap text-xs">
                        {format(new Date(u.created_at), 'dd.MM.yyyy')}
                      </td>
                      <td className="px-2 py-2 text-gray-700 dark:text-gray-300 hidden lg:table-cell whitespace-nowrap text-xs">
                        {u.last_login_at ? format(new Date(u.last_login_at), 'dd.MM.yyyy HH:mm') : 'Никогда'}
                      </td>
                      <td className="px-2 py-2 relative">
                        <div className="flex justify-end">
                          <button
                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                            onClick={() => setUserMenuOpen(userMenuOpen === u.id ? null : u.id)}
                            title="Действия"
                          >
                            <BootstrapIcon name="three-dots-vertical" size={16} />
                          </button>
                          {userMenuOpen === u.id && (
                            <>
                              <div
                                className="fixed inset-0 z-30"
                                onClick={() => setUserMenuOpen(null)}
                              />
                              <div className="absolute right-0 mt-1 z-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[160px] py-1">
                                <button
                                  className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                                  onClick={() => {
                                    openEditUser(u, 'name');
                                    setUserMenuOpen(null);
                                  }}
                                >
                                  <BootstrapIcon name="person" className="mr-2" size={14} />
                                  Изменить имя
                                </button>
                                <button
                                  className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                                  onClick={() => {
                                    openEditUser(u, 'email');
                                    setUserMenuOpen(null);
                                  }}
                                >
                                  <BootstrapIcon name="envelope" className="mr-2" size={14} />
                                  Изменить почту
                                </button>
                                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                                <button
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center ${
                                    u.is_staff
                                      ? 'text-red-600 dark:text-red-400'
                                      : 'text-primary-600 dark:text-primary-400'
                                  }`}
                                  onClick={() => {
                                    setUserMenuOpen(null);
                                    handleToggleStaff(u);
                                  }}
                                >
                                  <BootstrapIcon
                                    name={u.is_staff ? 'shield-x' : 'shield-check'}
                                    className="mr-2"
                                    size={14}
                                  />
                                  {u.is_staff ? 'Снять админ' : 'Сделать админ'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab !== 'backups' && activeTab !== 'users' && (
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

      {editingUser && editField && (
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
                  onClick={closeEditUser}
                  disabled={savingEdit}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn btn-primary text-sm"
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editValue.trim()}
                >
                  {savingEdit ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;

