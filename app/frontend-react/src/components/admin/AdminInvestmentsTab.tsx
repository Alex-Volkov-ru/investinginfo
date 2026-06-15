import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { adminService, AssetClassSlice, PortfolioUserSummary, ProblemPosition, TinkoffStatusItem } from '../../services/adminService';
import { BootstrapIcon } from '../BootstrapIcon';

const ISSUE_LABELS: Record<string, string> = {
  instrument_not_found: 'Инструмент не найден',
  zero_quantity: 'Нулевое кол-во',
  missing_figi: 'Нет FIGI',
  duplicate_figi: 'Дубль FIGI',
};

export const AdminInvestmentsTab = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<PortfolioUserSummary[]>([]);
  const [totals, setTotals] = useState({ total_value: 0, total_positions: 0 });
  const [tinkoff, setTinkoff] = useState<TinkoffStatusItem[]>([]);
  const [problems, setProblems] = useState<ProblemPosition[]>([]);
  const [assetClasses, setAssetClasses] = useState<AssetClassSlice[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingId, setCheckingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [ov, tk, pr, ac] = await Promise.all([
        adminService.getInvestmentsOverview(),
        adminService.getTinkoffStatus(),
        adminService.getProblemPositions(),
        adminService.getAssetClasses(),
      ]);
      setOverview(ov.users);
      setTotals({ total_value: ov.total_value, total_positions: ov.total_positions });
      setTinkoff(tk);
      setProblems(pr);
      setAssetClasses(ac);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const onRefreshQuotes = async () => {
    setRefreshing(true);
    try {
      const res = await adminService.refreshQuotes();
      toast.success(`Обновлено: ${res.updated}, ошибок: ${res.failed}`);
    } finally {
      setRefreshing(false);
    }
  };

  const onCheckTinkoff = async (userId: number) => {
    setCheckingId(userId);
    try {
      const res = await adminService.checkTinkoff(userId);
      setTinkoff((prev) => prev.map((t) => (t.user_id === userId ? res : t)));
      toast.success(res.message || res.status);
    } finally {
      setCheckingId(null);
    }
  };

  if (loading) {
    return <div className="text-gray-600 dark:text-gray-400 text-sm">Загрузка...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Всего позиций: <strong>{totals.total_positions}</strong> • Стоимость (avg): <strong>{totals.total_value.toLocaleString('ru-RU')} ₽</strong>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary text-xs" onClick={() => void load()}>Обновить</button>
          <button className="btn btn-secondary text-xs" onClick={() => void adminService.exportPortfolios()}>Экспорт CSV</button>
          <button className="btn btn-primary text-xs" onClick={() => void onRefreshQuotes()} disabled={refreshing}>
            {refreshing ? 'Обновление...' : 'Обновить котировки'}
          </button>
        </div>
      </div>

      {assetClasses.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {assetClasses.map((a) => (
            <div key={a.asset_class} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-gray-500 uppercase">{a.asset_class}</div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">{a.percentage}%</div>
              <div className="text-xs text-gray-500">{a.count} поз. • {a.value.toLocaleString('ru-RU')} ₽</div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-2 py-2 text-left">Пользователь</th>
              <th className="px-2 py-2 text-left">Портфели</th>
              <th className="px-2 py-2 text-left">Позиции</th>
              <th className="px-2 py-2 text-left">Стоимость</th>
              <th className="px-2 py-2 text-left">Tinkoff</th>
              <th className="px-2 py-2 text-left">Обновлено</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {overview.map((u) => {
              const tk = tinkoff.find((t) => t.user_id === u.user_id);
              return (
                <tr key={u.user_id}>
                  <td className="px-2 py-2">{u.email}</td>
                  <td className="px-2 py-2">{u.portfolios_count}</td>
                  <td className="px-2 py-2">{u.positions_count}</td>
                  <td className="px-2 py-2">{u.portfolio_value.toLocaleString('ru-RU')} ₽</td>
                  <td className="px-2 py-2">
                    {tk?.has_token ? (
                      <button
                        className="text-primary-600 text-xs underline"
                        disabled={checkingId === u.user_id}
                        onClick={() => void onCheckTinkoff(u.user_id)}
                      >
                        {checkingId === u.user_id ? '...' : tk.status === 'ok' ? 'OK' : 'Проверить'}
                      </button>
                    ) : (
                      <span className="text-gray-400">нет</span>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {u.last_position_update ? format(new Date(u.last_position_update), 'dd.MM.yy HH:mm') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {problems.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
            <BootstrapIcon name="exclamation-triangle" size={14} />
            Проблемные позиции ({problems.length})
          </div>
          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            <table className="w-full text-xs divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left">Email</th>
                  <th className="px-2 py-1 text-left">FIGI</th>
                  <th className="px-2 py-1 text-left">Проблема</th>
                </tr>
              </thead>
              <tbody>
                {problems.map((p) => (
                  <tr key={`${p.position_id}-${p.issue}`}>
                    <td className="px-2 py-1">{p.email}</td>
                    <td className="px-2 py-1">{p.ticker || p.figi}</td>
                    <td className="px-2 py-1 text-red-600">{ISSUE_LABELS[p.issue] || p.issue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
