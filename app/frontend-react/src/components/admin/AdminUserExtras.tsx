import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { adminService, AuditLogItem, UserDetail } from '../../services/adminService';
import { UserListItem } from '../../services/userService';
import { authService } from '../../lib/auth';
import { BootstrapIcon } from '../BootstrapIcon';

interface Props {
  user: UserListItem;
  onClose: () => void;
  onImpersonated?: () => void;
}

export const AdminUserDrawer = ({ user, onClose, onImpersonated }: Props) => {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        setDetail(await adminService.getUserDetail(user.id));
      } finally {
        setLoading(false);
      }
    })();
  }, [user.id]);

  const onImpersonate = async () => {
    const res = await adminService.impersonate(user.id);
    authService.startImpersonation(res);
    toast.success(`Вход как ${res.email}`);
    onImpersonated?.();
    window.location.href = '/';
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 w-full max-w-md h-full shadow-xl p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Карточка пользователя</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><BootstrapIcon name="x-lg" size={18} /></button>
        </div>

        {loading || !detail ? (
          <div className="text-sm text-gray-500">Загрузка...</div>
        ) : (
          <div className="space-y-3 text-sm">
            <div><span className="text-gray-500">Email:</span> {detail.email}</div>
            <div><span className="text-gray-500">Имя:</span> {detail.tg_username || '—'}</div>
            <div><span className="text-gray-500">Роль:</span> {detail.is_staff ? 'Админ' : 'Пользователь'}</div>
            <div><span className="text-gray-500">Tinkoff:</span> {detail.has_tinkoff ? 'да' : 'нет'}</div>
            <div><span className="text-gray-500">Регистрация:</span> {format(new Date(detail.created_at), 'dd.MM.yyyy')}</div>
            <div><span className="text-gray-500">Последний вход:</span> {detail.last_login_at ? format(new Date(detail.last_login_at), 'dd.MM.yyyy HH:mm') : 'никогда'}</div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 text-center">
                <div className="text-xs text-gray-500">Портфели</div>
                <div className="font-semibold">{detail.portfolios_count} / {detail.positions_count} поз.</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 text-center">
                <div className="text-xs text-gray-500">Транзакции</div>
                <div className="font-semibold">{detail.transactions_count}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 text-center">
                <div className="text-xs text-gray-500">Доски</div>
                <div className="font-semibold">{detail.whiteboards_count}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 text-center">
                <div className="text-xs text-gray-500">Обязательства</div>
                <div className="font-semibold">{detail.obligation_blocks_count}</div>
              </div>
            </div>

            <button className="btn btn-primary w-full text-sm mt-4" onClick={() => void onImpersonate()}>
              <BootstrapIcon name="box-arrow-in-right" className="mr-2" size={14} />
              Войти как пользователь
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const AdminAuditLog = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setLogs(await adminService.getAuditLog(30));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return null;

  if (logs.length === 0) return null;

  return (
    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Журнал действий админов</div>
      <div className="overflow-x-auto max-h-40 overflow-y-auto">
        <table className="w-full text-xs divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              <th className="px-2 py-1 text-left">Время</th>
              <th className="px-2 py-1 text-left">Админ</th>
              <th className="px-2 py-1 text-left">Действие</th>
              <th className="px-2 py-1 text-left">Цель</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="px-2 py-1 whitespace-nowrap">{format(new Date(l.created_at), 'dd.MM HH:mm')}</td>
                <td className="px-2 py-1">{l.admin_email}</td>
                <td className="px-2 py-1">{l.action}</td>
                <td className="px-2 py-1">{l.target_email || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
