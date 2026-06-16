import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import { adminService, AdminTransaction } from '../../services/adminService';
import { UserListItem } from '../../services/userService';
import {
  AdminEmptyRow,
  AdminField,
  AdminFormRow,
  AdminTableBody,
  AdminTableHead,
  AdminTableWrap,
  adminInputClass,
  adminSelectClass,
} from './AdminUi';

interface Props {
  isOpen: boolean;
  users: UserListItem[];
  initialUserId?: number;
  onClose: () => void;
}

export const AdminTransactionSearchModal = ({ isOpen, users, initialUserId, onClose }: Props) => {
  const [userId, setUserId] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [txType, setTxType] = useState<'all' | 'income' | 'expense'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [results, setResults] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUserId(initialUserId ?? '');
      setSearch('');
      setTxType('all');
      setFromDate('');
      setToDate('');
      setResults([]);
      setSearched(false);
    }
  }, [isOpen, initialUserId]);

  const runSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const rows = await adminService.listTransactions({
        user_id: userId || undefined,
        q: search.trim() || undefined,
        type: txType === 'all' ? undefined : txType,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        limit: 200,
      });
      setResults(rows);
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of results) {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, count: results.length };
  }, [results]);

  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Поиск транзакций клиента</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Все операции из бюджета пользователя. Можно искать по email, описанию, периоду и типу.
            </p>
          </div>
          <button type="button" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-200" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="admin-modal-body">
          <AdminFormRow>
            <AdminField label="Пользователь" className="flex-1 min-w-[160px]">
              <select
                className={`${adminSelectClass} admin-select-wide`}
                value={userId}
                onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Все пользователи</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.email}</option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Тип" className="min-w-[120px]">
              <select className={adminSelectClass} value={txType} onChange={(e) => setTxType(e.target.value as 'all' | 'income' | 'expense')}>
                <option value="all">Все</option>
                <option value="income">Доход</option>
                <option value="expense">Расход</option>
              </select>
            </AdminField>
            <AdminField label="С" className="min-w-[130px]">
              <input type="date" className={adminInputClass} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </AdminField>
            <AdminField label="По" className="min-w-[130px]">
              <input type="date" className={adminInputClass} value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </AdminField>
          </AdminFormRow>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className={`${adminInputClass} flex-1`}
              placeholder="Поиск по email или описанию..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
            />
            <button type="button" className="btn btn-primary text-sm min-h-[44px] shrink-0" disabled={loading} onClick={() => void runSearch()}>
              {loading ? 'Поиск...' : 'Найти'}
            </button>
          </div>

          {searched && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Найдено: <strong>{summary.count}</strong>
              {summary.count > 0 && (
                <>
                  {' '}• доход <span className="text-green-600">{summary.income.toLocaleString('ru-RU')} ₽</span>
                  {' '}• расход <span className="text-red-600">{summary.expense.toLocaleString('ru-RU')} ₽</span>
                </>
              )}
            </div>
          )}

          <AdminTableWrap maxHeight="50vh">
            <AdminTableHead>
              <tr>
                <th>Дата</th>
                <th className="hidden sm:table-cell">Email</th>
                <th>Тип</th>
                <th>Сумма</th>
                <th className="hidden md:table-cell">Категория</th>
                <th>Описание</th>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {results.length === 0 ? (
                <AdminEmptyRow colSpan={6}>
                  {searched ? 'Ничего не найдено — измените фильтры' : 'Задайте фильтры и нажмите «Найти»'}
                </AdminEmptyRow>
              ) : (
                results.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap admin-cell-muted">{format(new Date(t.occurred_at), 'dd.MM.yy HH:mm')}</td>
                    <td className="hidden sm:table-cell admin-cell-email">{t.email}</td>
                    <td>{t.type === 'income' ? 'Доход' : 'Расход'}</td>
                    <td className={t.type === 'income' ? 'admin-cell-money-pos tabular-nums' : 'admin-cell-money-neg tabular-nums'}>
                      {t.amount.toLocaleString('ru-RU')} {t.currency || '₽'}
                    </td>
                    <td className="hidden md:table-cell">{t.category_name || '—'}</td>
                    <td className="max-w-[200px] truncate" title={t.description || undefined}>
                      {t.description || '—'}
                      <span className="block sm:hidden text-xs admin-cell-muted">{t.email}</span>
                    </td>
                  </tr>
                ))
              )}
            </AdminTableBody>
          </AdminTableWrap>
        </div>
      </div>
    </div>
  );
};
