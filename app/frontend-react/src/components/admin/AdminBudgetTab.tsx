import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  adminService,
  BudgetAnomaly,
  BudgetUserDashboard,
  CategoryTemplate,
  MonthStatusItem,
  WhiteboardStat,
  AdminTransaction,
  OverLimitItem,
} from '../../services/adminService';
import { UserListItem } from '../../services/userService';
import {
  AdminDeleteBtn,
  AdminField,
  AdminFormRow,
  AdminLoading,
  AdminSection,
  AdminStatGrid,
  AdminTableBody,
  AdminTableHead,
  AdminTableWrap,
  adminInputClass,
  adminSelectClass,
} from './AdminUi';

interface Props {
  users: UserListItem[];
}

export const AdminBudgetTab = ({ users }: Props) => {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<BudgetUserDashboard[]>([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0, net: 0 });
  const [anomalies, setAnomalies] = useState<BudgetAnomaly[]>([]);
  const [templates, setTemplates] = useState<CategoryTemplate[]>([]);
  const [whiteboards, setWhiteboards] = useState<WhiteboardStat[]>([]);
  const [monthStatus, setMonthStatus] = useState<MonthStatusItem[]>([]);
  const [compareA, setCompareA] = useState<number>(0);
  const [compareB, setCompareB] = useState<number>(0);
  const [compareResult, setCompareResult] = useState<{ user_a: Record<string, unknown>; user_b: Record<string, unknown> } | null>(null);
  const [newTpl, setNewTpl] = useState({ kind: 'expense', name: '', monthly_limit: '', apply_to_new_users: false });
  const [txUserId, setTxUserId] = useState<number | ''>('');
  const [overLimits, setOverLimits] = useState<OverLimitItem[]>([]);
  const [txSearch, setTxSearch] = useState('');
  const [txResults, setTxResults] = useState<AdminTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [dash, anom, tpl, wb, ms, ol] = await Promise.all([
        adminService.getBudgetDashboard(),
        adminService.getBudgetAnomalies(),
        adminService.listCategoryTemplates(),
        adminService.getWhiteboardStats(),
        adminService.getMonthStatus(),
        adminService.getOverLimits(),
      ]);
      setDashboard(dash.users);
      setTotals(dash.totals);
      setAnomalies(anom);
      setTemplates(tpl);
      setWhiteboards(wb);
      setMonthStatus(ms);
      setOverLimits(ol);
    } finally {
      setLoading(false);
    }
  };

  const searchTransactions = async () => {
    if (!txSearch.trim()) return;
    setTxLoading(true);
    try {
      setTxResults(await adminService.listTransactions({ q: txSearch.trim(), limit: 50 }));
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const onCreateTemplate = async () => {
    if (!newTpl.name.trim()) return;
    await adminService.createCategoryTemplate({
      kind: newTpl.kind,
      name: newTpl.name.trim(),
      monthly_limit: newTpl.monthly_limit ? parseFloat(newTpl.monthly_limit) : undefined,
      apply_to_new_users: newTpl.apply_to_new_users,
    });
    toast.success('Шаблон создан');
    setNewTpl({ kind: 'expense', name: '', monthly_limit: '', apply_to_new_users: false });
    await load();
  };

  const onCompare = async () => {
    if (!compareA || !compareB) return;
    const res = await adminService.compareBudget(compareA, compareB);
    setCompareResult(res);
  };

  if (loading) return <AdminLoading />;

  return (
    <div className="space-y-4">
      <div className="admin-mobile-stack">
        <AdminStatGrid
          items={[
            { label: 'Доход', value: `${totals.income.toLocaleString('ru-RU')} ₽`, tone: 'green' },
            { label: 'Расход', value: `${totals.expense.toLocaleString('ru-RU')} ₽`, tone: 'red' },
            { label: 'Итого', value: `${totals.net.toLocaleString('ru-RU')} ₽`, tone: 'blue' },
          ]}
        />
        <button type="button" className="btn btn-secondary text-xs shrink-0 self-start sm:self-center" onClick={() => void load()}>
          Обновить
        </button>
      </div>

      <AdminTableWrap>
        <AdminTableHead>
          <tr>
            <th className="min-w-[120px]">Email</th>
            <th>Доход</th>
            <th>Расход</th>
            <th className="hidden sm:table-cell">Итого</th>
            <th className="hidden md:table-cell">Топ трата</th>
            <th className="hidden lg:table-cell">Лимиты</th>
          </tr>
        </AdminTableHead>
        <AdminTableBody>
          {dashboard.map((u) => (
            <tr key={u.user_id}>
              <td className="admin-cell-email">
                <div>{u.email}</div>
                <div className="text-xs admin-cell-muted sm:hidden mt-0.5">
                  Итого {u.net.toLocaleString('ru-RU')} ₽
                  {u.top_expense_category ? ` • ${u.top_expense_category}` : ''}
                </div>
              </td>
              <td className="admin-cell-money-pos tabular-nums">{u.income.toLocaleString('ru-RU')}</td>
              <td className="admin-cell-money-neg tabular-nums">{u.expense.toLocaleString('ru-RU')}</td>
              <td className="hidden sm:table-cell tabular-nums">{u.net.toLocaleString('ru-RU')}</td>
              <td className="hidden md:table-cell">{u.top_expense_category || '—'}</td>
              <td className="hidden lg:table-cell">
                {u.over_limit_categories > 0 ? (
                  <span className="text-red-600 dark:text-red-400">{u.over_limit_categories} превыш.</span>
                ) : (
                  'OK'
                )}
              </td>
            </tr>
          ))}
        </AdminTableBody>
      </AdminTableWrap>

      {overLimits.length > 0 && (
        <AdminSection title={`Превышения лимитов (${overLimits.length})`}>
          <AdminTableWrap maxHeight="240px">
            <AdminTableHead>
              <tr>
                <th>Email</th>
                <th>Категория</th>
                <th>Лимит</th>
                <th>Факт</th>
                <th>+</th>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {overLimits.map((o, i) => (
                <tr key={`${o.user_id}-${o.category_name}-${i}`}>
                  <td className="admin-cell-email">{o.email}</td>
                  <td>{o.category_name}</td>
                  <td className="tabular-nums">{o.monthly_limit.toLocaleString('ru-RU')}</td>
                  <td className="admin-cell-money-neg tabular-nums">{o.spent.toLocaleString('ru-RU')}</td>
                  <td className="text-red-600 tabular-nums">+{o.over_pct}%</td>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTableWrap>
        </AdminSection>
      )}

      <AdminSection title="Поиск транзакций">
        <div className="flex flex-col sm:flex-row gap-2 p-4 border-b border-gray-100 dark:border-gray-700">
          <input
            className={`${adminInputClass} admin-input-wide flex-1`}
            placeholder="Email или описание..."
            value={txSearch}
            onChange={(e) => setTxSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void searchTransactions()}
          />
          <button type="button" className="btn btn-secondary text-sm min-h-[44px]" disabled={txLoading} onClick={() => void searchTransactions()}>
            {txLoading ? '...' : 'Найти'}
          </button>
        </div>
        {txResults.length > 0 && (
          <AdminTableWrap maxHeight="280px">
            <AdminTableHead>
              <tr>
                <th>Дата</th>
                <th>Email</th>
                <th>Категория</th>
                <th>Сумма</th>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {txResults.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap admin-cell-muted">{format(new Date(t.occurred_at), 'dd.MM.yy')}</td>
                  <td className="admin-cell-email">{t.email}</td>
                  <td>{t.category_name || '—'}</td>
                  <td className={t.type === 'income' ? 'admin-cell-money-pos' : 'admin-cell-money-neg'}>
                    {t.amount.toLocaleString('ru-RU')} ₽
                  </td>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTableWrap>
        )}
      </AdminSection>

      {anomalies.length > 0 && (
        <AdminSection title={`Аномалии (${anomalies.length})`}>
          <ul className="text-xs space-y-1 max-h-32 overflow-y-auto custom-scrollbar px-4 pb-4">
            {anomalies.map((a, i) => (
              <li key={i} className="text-amber-700 dark:text-amber-300 break-words">
                {a.email}: {a.message}
                {a.amount != null && ` (${a.amount.toLocaleString('ru-RU')} ₽)`}
              </li>
            ))}
          </ul>
        </AdminSection>
      )}

      <AdminSection title="Шаблоны категорий">
        <AdminFormRow>
          <AdminField label="Тип">
            <select className={adminSelectClass} value={newTpl.kind} onChange={(e) => setNewTpl({ ...newTpl, kind: e.target.value })}>
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
          </AdminField>
          <AdminField label="Название" className="flex-1 min-w-[140px]">
            <input className={`${adminInputClass} admin-input-wide`} placeholder="Название" value={newTpl.name} onChange={(e) => setNewTpl({ ...newTpl, name: e.target.value })} />
          </AdminField>
          <AdminField label="Лимит">
            <input className={adminInputClass} placeholder="0" value={newTpl.monthly_limit} onChange={(e) => setNewTpl({ ...newTpl, monthly_limit: e.target.value })} />
          </AdminField>
          <label className="admin-checkbox-label self-end pb-1">
            <input type="checkbox" checked={newTpl.apply_to_new_users} onChange={(e) => setNewTpl({ ...newTpl, apply_to_new_users: e.target.checked })} />
            Для новых
          </label>
          <button type="button" className="btn btn-primary text-xs min-h-[44px] self-end" onClick={() => void onCreateTemplate()}>
            Добавить
          </button>
        </AdminFormRow>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-col sm:flex-row sm:justify-between gap-1 text-xs px-4 py-2">
              <span className="break-words">
                {t.kind === 'expense' ? '−' : '+'} {t.name}
                {t.monthly_limit ? ` (лимит ${t.monthly_limit})` : ''}
              </span>
              <AdminDeleteBtn onClick={() => void adminService.deleteCategoryTemplate(t.id).then(load)} />
            </div>
          ))}
        </div>
        {users.length > 0 && (
          <AdminFormRow>
            <AdminField label="Пользователь" className="flex-1">
              <select className={`${adminSelectClass} admin-select-wide`} value={txUserId} onChange={(e) => setTxUserId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Применить шаблоны пользователю...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.email}</option>
                ))}
              </select>
            </AdminField>
            {txUserId && (
              <button
                type="button"
                className="btn btn-secondary text-xs min-h-[44px] self-end"
                onClick={async () => {
                  const r = await adminService.applyCategoryTemplates(txUserId as number);
                  toast.success(`Создано категорий: ${r.created}`);
                }}
              >
                Применить
              </button>
            )}
          </AdminFormRow>
        )}
      </AdminSection>

      <AdminSection title="Сравнение пользователей">
        <AdminFormRow>
          <AdminField label="Пользователь A" className="flex-1">
            <select className={`${adminSelectClass} admin-select-wide`} value={compareA} onChange={(e) => setCompareA(Number(e.target.value))}>
              <option value={0}>Выберите...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.email}</option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Пользователь B" className="flex-1">
            <select className={`${adminSelectClass} admin-select-wide`} value={compareB} onChange={(e) => setCompareB(Number(e.target.value))}>
              <option value={0}>Выберите...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.email}</option>
              ))}
            </select>
          </AdminField>
          <button type="button" className="btn btn-secondary text-xs min-h-[44px] self-end" onClick={() => void onCompare()}>
            Сравнить
          </button>
        </AdminFormRow>
        {compareResult && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-4 text-xs">
            {[compareResult.user_a, compareResult.user_b].map((u, i) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="font-medium break-all">{String(u.email)}</div>
                <div className="mt-1">Доход: {Number(u.income).toLocaleString('ru-RU')} ₽</div>
                <div>Расход: {Number(u.expense).toLocaleString('ru-RU')} ₽</div>
                <div>Транзакций: {String(u.transaction_count)}</div>
              </div>
            ))}
          </div>
        )}
      </AdminSection>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AdminSection title="Доски бюджета">
          <div className="px-4 pb-4 space-y-1">
            {whiteboards.map((w) => (
              <div key={w.user_id} className="text-xs py-1 break-all">{w.email}: {w.boards_count} досок</div>
            ))}
          </div>
        </AdminSection>
        <AdminSection title="Активность за месяц">
          <div className="px-4 pb-4 space-y-1">
            {monthStatus.map((m) => (
              <div key={m.user_id} className={`text-xs py-1 break-all ${!m.has_activity ? 'text-gray-400' : ''}`}>
                {m.email}: {m.has_activity ? `${m.transaction_count} опер.` : 'нет активности'}
              </div>
            ))}
          </div>
        </AdminSection>
      </div>
    </div>
  );
};
