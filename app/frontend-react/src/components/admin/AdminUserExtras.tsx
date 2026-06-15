import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { adminService, AuditLogItem, UserDetail } from '../../services/adminService';
import { UserListItem } from '../../services/userService';
import { authService } from '../../lib/auth';
import { BootstrapIcon } from '../BootstrapIcon';
import {
  AdminSection,
  AdminStatGrid,
  AdminTableBody,
  AdminTableHead,
  AdminTableWrap,
} from './AdminUi';

interface Props {
  user: UserListItem;
  currentUserId?: number;
  onClose: () => void;
  onImpersonated?: () => void;
  onRequestDelete?: () => void;
}

export const AdminUserDrawer = ({ user, currentUserId, onClose, onImpersonated, onRequestDelete }: Props) => {
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
    <div className="fixed inset-0 z-50 flex flex-col sm:flex-row sm:justify-end bg-black/40" onClick={onClose}>
      <div
        className="mt-auto sm:mt-0 w-full sm:max-w-md h-[min(92vh,100%)] sm:h-full bg-white dark:bg-gray-800 shadow-xl overflow-y-auto custom-scrollbar rounded-t-2xl sm:rounded-none pb-safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mobile-sheet-header">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Карточка пользователя</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <BootstrapIcon name="x-lg" size={18} />
          </button>
        </div>

        {loading || !detail ? (
          <div className="p-5 text-sm text-gray-500">Загрузка...</div>
        ) : (
          <div className="mobile-sheet-body">
            <AdminTableWrap>
              <AdminTableBody>
                {[
                  ['Email', detail.email],
                  ['Имя', detail.tg_username || '—'],
                  ['Роль', detail.is_staff ? 'Админ' : 'Пользователь'],
                  ['Tinkoff', detail.has_tinkoff ? 'Подключён' : 'Нет'],
                  ['Регистрация', format(new Date(detail.created_at), 'dd.MM.yyyy')],
                  ['Последний вход', detail.last_login_at ? format(new Date(detail.last_login_at), 'dd.MM.yyyy HH:mm') : 'никогда'],
                ].map(([label, value]) => (
                  <tr key={String(label)}>
                    <td className="admin-cell-muted w-28 sm:w-36">{label}</td>
                    <td className="font-medium break-all">{value}</td>
                  </tr>
                ))}
              </AdminTableBody>
            </AdminTableWrap>

            <AdminStatGrid
              items={[
                { label: 'Портфели', value: String(detail.portfolios_count), tone: 'blue' },
                { label: 'Позиции', value: String(detail.positions_count), tone: 'blue' },
                { label: 'Транзакции', value: String(detail.transactions_count), tone: 'green' },
                { label: 'Доски', value: String(detail.whiteboards_count), tone: 'default' },
                { label: 'Обязательства', value: String(detail.obligation_blocks_count), tone: 'amber' },
                { label: 'Категории', value: String(detail.categories_count), tone: 'default' },
              ]}
            />

            <button type="button" className="btn btn-primary w-full text-sm min-h-[44px]" onClick={() => void onImpersonate()}>
              <BootstrapIcon name="box-arrow-in-right" className="mr-2 inline" size={14} />
              Войти как пользователь
            </button>

            {currentUserId !== user.id && onRequestDelete && (
              <button type="button" className="btn btn-danger w-full text-sm min-h-[44px]" onClick={onRequestDelete}>
                <BootstrapIcon name="trash" className="mr-2 inline" size={14} />
                Удалить пользователя
              </button>
            )}
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

  if (loading || logs.length === 0) return null;

  return (
    <AdminSection title="Журнал действий админов" subtitle={`Последние ${logs.length} записей`}>
      <AdminTableWrap maxHeight="220px">
        <AdminTableHead>
          <tr>
            <th>Время</th>
            <th>Админ</th>
            <th className="hidden sm:table-cell">Действие</th>
            <th>Цель</th>
          </tr>
        </AdminTableHead>
        <AdminTableBody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="whitespace-nowrap admin-cell-muted">{format(new Date(l.created_at), 'dd.MM HH:mm')}</td>
              <td className="max-w-[6rem] sm:max-w-none truncate">{l.admin_email}</td>
              <td className="hidden sm:table-cell">
                <code className="text-xs bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded">{l.action}</code>
              </td>
              <td className="admin-cell-email">{l.target_email || '—'}</td>
            </tr>
          ))}
        </AdminTableBody>
      </AdminTableWrap>
    </AdminSection>
  );
};
