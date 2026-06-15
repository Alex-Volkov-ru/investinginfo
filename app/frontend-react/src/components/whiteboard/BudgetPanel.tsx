import { formatMoney } from '../../lib/whiteboardUtils';

interface BudgetPanelProps {
  budget: number;
  incomeTotal: number;
  expenseTotal: number;
  gridMode: boolean;
  onBudgetChange: (value: number) => void;
  onResetExpenses: () => void;
}

export function BudgetPanel({
  budget,
  incomeTotal,
  expenseTotal,
  gridMode,
  onBudgetChange,
  onResetExpenses,
}: BudgetPanelProps) {
  const planTotal = budget + incomeTotal;
  const remainder = planTotal - expenseTotal;
  const isPositive = remainder >= 0;
  const progress = planTotal > 0 ? Math.min(100, (expenseTotal / planTotal) * 100) : 0;
  const progressColor =
    progress >= 100 ? 'bg-red-500' : progress >= 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-md px-4 py-3" data-tour="whiteboard-budget-panel">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <label className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
            <span className="whitespace-nowrap">Месячный бюджет</span>
            <input
              type="number"
              min={0}
              step={1000}
              className="input w-36 text-right tabular-nums"
              value={budget || ''}
              onChange={(e) => onBudgetChange(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Доходы: </span>
              <span className="font-semibold text-sky-600 dark:text-sky-400 tabular-nums">
                {formatMoney(incomeTotal)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Расходы: </span>
              <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                {formatMoney(expenseTotal)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Остаток: </span>
              <span
                className={`font-bold tabular-nums ${
                  isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatMoney(remainder)}
              </span>
            </div>
            {gridMode && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300">
                режим сетки
              </span>
            )}
          </div>
        </div>
        <button type="button" onClick={onResetExpenses} className="btn btn-secondary text-sm self-start lg:self-auto">
          Сбросить карточки
        </button>
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
          <span>Расходы от плана (бюджет + доходы)</span>
          <span className="font-medium tabular-nums">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
