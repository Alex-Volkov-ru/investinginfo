import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  adminService,
  BudgetAnomaly,
  BudgetUserDashboard,
  CategoryTemplate,
  MonthStatusItem,
  WhiteboardStat,
} from '../../services/adminService';
import { UserListItem } from '../../services/userService';

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

  const load = async () => {
    setLoading(true);
    try {
      const [dash, anom, tpl, wb, ms] = await Promise.all([
        adminService.getBudgetDashboard(),
        adminService.getBudgetAnomalies(),
        adminService.listCategoryTemplates(),
        adminService.getWhiteboardStats(),
        adminService.getMonthStatus(),
      ]);
      setDashboard(dash.users);
      setTotals(dash.totals);
      setAnomalies(anom);
      setTemplates(tpl);
      setWhiteboards(wb);
      setMonthStatus(ms);
    } finally {
      setLoading(false);
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

  if (loading) return <div className="text-sm text-gray-600 dark:text-gray-400">Загрузка...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="grid grid-cols-3 gap-2 flex-1 mr-4">
          <div className="bg-green-50 dark:bg-green-900/20 rounded p-2 text-center">
            <div className="text-xs text-gray-500">Доход</div>
            <div className="font-semibold text-green-700 dark:text-green-300">{totals.income.toLocaleString('ru-RU')} ₽</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded p-2 text-center">
            <div className="text-xs text-gray-500">Расход</div>
            <div className="font-semibold text-red-700 dark:text-red-300">{totals.expense.toLocaleString('ru-RU')} ₽</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2 text-center">
            <div className="text-xs text-gray-500">Итого</div>
            <div className="font-semibold">{totals.net.toLocaleString('ru-RU')} ₽</div>
          </div>
        </div>
        <button className="btn btn-secondary text-xs" onClick={() => void load()}>Обновить</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-2 py-2 text-left">Email</th>
              <th className="px-2 py-2 text-left">Доход</th>
              <th className="px-2 py-2 text-left">Расход</th>
              <th className="px-2 py-2 text-left">Итого</th>
              <th className="px-2 py-2 text-left">Топ трата</th>
              <th className="px-2 py-2 text-left">Лимиты</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {dashboard.map((u) => (
              <tr key={u.user_id}>
                <td className="px-2 py-2">{u.email}</td>
                <td className="px-2 py-2 text-green-600">{u.income.toLocaleString('ru-RU')}</td>
                <td className="px-2 py-2 text-red-600">{u.expense.toLocaleString('ru-RU')}</td>
                <td className="px-2 py-2">{u.net.toLocaleString('ru-RU')}</td>
                <td className="px-2 py-2">{u.top_expense_category || '—'}</td>
                <td className="px-2 py-2">
                  {u.over_limit_categories > 0 ? (
                    <span className="text-red-600">{u.over_limit_categories} превыш.</span>
                  ) : 'OK'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {anomalies.length > 0 && (
        <div>
          <div className="text-sm font-semibold mb-2">Аномалии ({anomalies.length})</div>
          <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
            {anomalies.map((a, i) => (
              <li key={i} className="text-amber-700 dark:text-amber-300">
                {a.email}: {a.message}
                {a.amount != null && ` (${a.amount.toLocaleString('ru-RU')} ₽)`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <div className="text-sm font-semibold mb-2">Шаблоны категорий</div>
        <div className="flex flex-wrap gap-2 mb-2">
          <select className="rounded border px-2 py-1 text-xs dark:bg-gray-900" value={newTpl.kind} onChange={(e) => setNewTpl({ ...newTpl, kind: e.target.value })}>
            <option value="expense">Расход</option>
            <option value="income">Доход</option>
          </select>
          <input className="rounded border px-2 py-1 text-xs dark:bg-gray-900 flex-1 min-w-[120px]" placeholder="Название" value={newTpl.name} onChange={(e) => setNewTpl({ ...newTpl, name: e.target.value })} />
          <input className="rounded border px-2 py-1 text-xs dark:bg-gray-900 w-24" placeholder="Лимит" value={newTpl.monthly_limit} onChange={(e) => setNewTpl({ ...newTpl, monthly_limit: e.target.value })} />
          <label className="text-xs flex items-center gap-1">
            <input type="checkbox" checked={newTpl.apply_to_new_users} onChange={(e) => setNewTpl({ ...newTpl, apply_to_new_users: e.target.checked })} />
            Для новых
          </label>
          <button className="btn btn-primary text-xs" onClick={() => void onCreateTemplate()}>Добавить</button>
        </div>
        {templates.map((t) => (
          <div key={t.id} className="flex justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-800">
            <span>{t.kind === 'expense' ? '−' : '+'} {t.name} {t.monthly_limit ? `(лимит ${t.monthly_limit})` : ''}</span>
            <button className="text-red-500" onClick={() => void adminService.deleteCategoryTemplate(t.id).then(load)}>удалить</button>
          </div>
        ))}
        {users.length > 0 && (
          <div className="mt-2 flex gap-2 items-center">
            <select className="rounded border px-2 py-1 text-xs dark:bg-gray-900" value={txUserId} onChange={(e) => setTxUserId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Применить шаблоны пользователю...</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
            </select>
            {txUserId && (
              <button className="btn btn-secondary text-xs" onClick={async () => {
                const r = await adminService.applyCategoryTemplates(txUserId as number);
                toast.success(`Создано категорий: ${r.created}`);
              }}>Применить</button>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <div className="text-sm font-semibold mb-2">Сравнение пользователей</div>
        <div className="flex flex-wrap gap-2 items-center">
          <select className="rounded border px-2 py-1 text-xs dark:bg-gray-900" value={compareA} onChange={(e) => setCompareA(Number(e.target.value))}>
            <option value={0}>Пользователь A</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
          </select>
          <select className="rounded border px-2 py-1 text-xs dark:bg-gray-900" value={compareB} onChange={(e) => setCompareB(Number(e.target.value))}>
            <option value={0}>Пользователь B</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
          </select>
          <button className="btn btn-secondary text-xs" onClick={() => void onCompare()}>Сравнить</button>
        </div>
        {compareResult && (
          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
            {[compareResult.user_a, compareResult.user_b].map((u, i) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                <div className="font-medium">{String(u.email)}</div>
                <div>Доход: {Number(u.income).toLocaleString('ru-RU')} ₽</div>
                <div>Расход: {Number(u.expense).toLocaleString('ru-RU')} ₽</div>
                <div>Транзакций: {String(u.transaction_count)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-200 dark:border-gray-700 pt-3">
        <div>
          <div className="text-sm font-semibold mb-2">Доски бюджета</div>
          {whiteboards.map((w) => (
            <div key={w.user_id} className="text-xs py-1">{w.email}: {w.boards_count} досок</div>
          ))}
        </div>
        <div>
          <div className="text-sm font-semibold mb-2">Активность за месяц</div>
          {monthStatus.map((m) => (
            <div key={m.user_id} className={`text-xs py-1 ${!m.has_activity ? 'text-gray-400' : ''}`}>
              {m.email}: {m.has_activity ? `${m.transaction_count} опер.` : 'нет активности'}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
