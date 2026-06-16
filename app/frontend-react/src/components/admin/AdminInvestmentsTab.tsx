import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { adminService, AssetClassSlice, PortfolioUserSummary, ProblemPosition, TinkoffStatusItem, PortfolioMarketRow, InvestmentAlert } from '../../services/adminService';
import { BootstrapIcon } from '../BootstrapIcon';
import { AdminLoading, AdminSection, AdminStatGrid, AdminTableBody, AdminTableHead, AdminTableWrap } from './AdminUi';

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
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [marketRows, setMarketRows] = useState<PortfolioMarketRow[]>([]);
  const [marketNote, setMarketNote] = useState<string | undefined>();
  const [alerts, setAlerts] = useState<InvestmentAlert[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [ov, tk, pr, ac, market, alertList] = await Promise.all([
        adminService.getInvestmentsOverview(),
        adminService.getTinkoffStatus(),
        adminService.getProblemPositions(),
        adminService.getAssetClasses(),
        adminService.getMarketOverview(),
        adminService.getInvestmentAlerts(),
      ]);
      setOverview(ov.users);
      setTotals({ total_value: ov.total_value, total_positions: ov.total_positions });
      setTinkoff(tk);
      setProblems(pr);
      setAssetClasses(ac);
      setMarketRows(market.rows);
      setMarketNote(market.tinkoff_available ? undefined : market.message);
      setAlerts(alertList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const onCheckTinkoff = async (userId: number) => {
    setCheckingId(userId);
    try {
      const res = await adminService.checkTinkoff(userId);
      setTinkoff((prev) => prev.map((t) => (t.user_id === userId ? res : t)));
    } finally {
      setCheckingId(null);
    }
  };

  if (loading) {
    return <AdminLoading />;
  }

  return (
    <div className="space-y-4">
      <div className="admin-mobile-stack">
        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          Позиций: <strong>{totals.total_positions}</strong>
          <span className="hidden sm:inline"> • </span>
          <span className="block sm:inline mt-0.5 sm:mt-0">
            Стоимость: <strong>{totals.total_value.toLocaleString('ru-RU')} ₽</strong>
          </span>
        </div>
        <div className="admin-mobile-stack-actions">
          <button type="button" className="btn btn-secondary text-xs" onClick={() => void load()}>Обновить</button>
          <button type="button" className="btn btn-secondary text-xs" onClick={() => void adminService.exportPortfolios()}>CSV</button>
        </div>
      </div>

      {assetClasses.length > 0 && (
        <AdminStatGrid
          items={assetClasses.map((a) => ({
            label: a.asset_class,
            value: `${a.percentage}% • ${a.count} поз.`,
            tone: 'default' as const,
          }))}
        />
      )}

      {alerts.length > 0 && (
        <AdminSection title={`Алерты (${alerts.length})`}>
          <ul className="text-xs divide-y divide-gray-100 dark:divide-gray-800 px-4 pb-3">
            {alerts.map((a, i) => (
              <li key={`${a.user_id}-${a.kind}-${i}`} className="py-2 flex gap-2">
                <BootstrapIcon
                  name={a.severity === 'warn' ? 'exclamation-triangle' : 'info-circle'}
                  size={14}
                  className={a.severity === 'warn' ? 'text-amber-500 shrink-0 mt-0.5' : 'text-blue-500 shrink-0 mt-0.5'}
                />
                <span>
                  <strong>{a.email}</strong> — {a.message}
                </span>
              </li>
            ))}
          </ul>
        </AdminSection>
      )}

      {marketRows.length > 0 && (
        <AdminSection title="Средняя vs рынок">
          {marketNote && (
            <div className="text-xs text-amber-600 dark:text-amber-400 px-4 pt-3">{marketNote}</div>
          )}
          <AdminTableWrap>
            <AdminTableHead>
              <tr>
                <th>Email</th>
                <th className="hidden sm:table-cell">Поз.</th>
                <th>Средняя</th>
                <th>Рынок</th>
                <th>Δ</th>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {marketRows.map((m) => (
                <tr key={m.user_id}>
                  <td className="admin-cell-email">{m.email}</td>
                  <td className="hidden sm:table-cell tabular-nums">{m.positions_count}</td>
                  <td className="tabular-nums">{m.avg_value.toLocaleString('ru-RU')} ₽</td>
                  <td className="tabular-nums">
                    {m.market_value != null ? `${m.market_value.toLocaleString('ru-RU')} ₽` : '—'}
                  </td>
                  <td className={`tabular-nums ${m.delta_pct != null && m.delta_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {m.delta_pct != null ? `${m.delta_pct > 0 ? '+' : ''}${m.delta_pct}%` : '—'}
                  </td>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTableWrap>
        </AdminSection>
      )}

      <AdminTableWrap>
        <AdminTableHead>
          <tr>
            <th className="min-w-[120px]">Пользователь</th>
            <th className="hidden sm:table-cell">Портф.</th>
            <th>Поз.</th>
            <th>Стоимость</th>
            <th className="hidden md:table-cell">Tinkoff</th>
            <th className="hidden lg:table-cell">Обновлено</th>
          </tr>
        </AdminTableHead>
        <AdminTableBody>
          {overview.map((u) => {
            const tk = tinkoff.find((t) => t.user_id === u.user_id);
            return (
              <tr key={u.user_id}>
                <td className="admin-cell-email">
                  <div>{u.email}</div>
                  <div className="text-xs admin-cell-muted sm:hidden mt-0.5">
                    {u.portfolios_count} портф. • {u.positions_count} поз.
                    {u.last_position_update ? ` • ${format(new Date(u.last_position_update), 'dd.MM.yy')}` : ''}
                  </div>
                </td>
                <td className="hidden sm:table-cell tabular-nums">{u.portfolios_count}</td>
                <td className="tabular-nums">{u.positions_count}</td>
                <td className="tabular-nums whitespace-nowrap">{u.portfolio_value.toLocaleString('ru-RU')} ₽</td>
                <td className="hidden md:table-cell">
                  {tk?.has_token ? (
                    <button
                      type="button"
                      className="text-primary-600 text-xs underline min-h-[32px]"
                      disabled={checkingId === u.user_id}
                      onClick={() => void onCheckTinkoff(u.user_id)}
                    >
                      {checkingId === u.user_id ? '...' : tk.status === 'ok' ? 'OK' : 'Проверить'}
                    </button>
                  ) : (
                    <span className="text-gray-400">нет</span>
                  )}
                </td>
                <td className="hidden lg:table-cell whitespace-nowrap admin-cell-muted">
                  {u.last_position_update ? format(new Date(u.last_position_update), 'dd.MM.yy HH:mm') : '—'}
                </td>
              </tr>
            );
          })}
        </AdminTableBody>
      </AdminTableWrap>

      {problems.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
            <BootstrapIcon name="exclamation-triangle" size={14} />
            Проблемные позиции ({problems.length})
          </div>
          <AdminTableWrap maxHeight="12rem">
            <AdminTableHead>
              <tr>
                <th>Email</th>
                <th className="hidden sm:table-cell">FIGI</th>
                <th>Проблема</th>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {problems.map((p) => (
                <tr key={`${p.position_id}-${p.issue}`}>
                  <td className="admin-cell-email">{p.email}</td>
                  <td className="hidden sm:table-cell">{p.ticker || p.figi}</td>
                  <td className="text-red-600 dark:text-red-400">
                    {ISSUE_LABELS[p.issue] || p.issue}
                    <span className="block sm:hidden text-xs admin-cell-muted">{p.ticker || p.figi}</span>
                  </td>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTableWrap>
        </div>
      )}
    </div>
  );
};
