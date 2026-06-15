import { formatMoney } from '../../lib/whiteboardUtils';



interface BudgetPanelProps {

  budget: number;

  expenseTotal: number;

  gridMode: boolean;

  onBudgetChange: (value: number) => void;

  onResetExpenses: () => void;

}



export function BudgetPanel({

  budget,

  expenseTotal,

  gridMode,

  onBudgetChange,

  onResetExpenses,

}: BudgetPanelProps) {

  const remainder = budget - expenseTotal;

  const isPositive = remainder >= 0;



  return (

    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-md px-4 py-3">

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">

        <label className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">

          <span className="whitespace-nowrap">Месячный бюджет</span>

          <input

            type="number"

            min={0}

            step={1000}

            className="input w-36 text-right tabular-nums"

            value={budget || ''}

            onChange={(e) => onBudgetChange(Math.max(0, Number(e.target.value) || 0))}

          />

          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">

            → появится карточка на доске

          </span>

        </label>

        <div className="hidden sm:block h-8 w-px bg-gray-200 dark:bg-gray-700" />

        <div className="flex flex-wrap gap-4 text-sm">

          <div>

            <span className="text-gray-500 dark:text-gray-400">Расходы: </span>

            <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">

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

      <button

        type="button"

        onClick={onResetExpenses}

        className="btn btn-secondary text-sm self-start sm:self-auto"

      >

        Сбросить расходы

      </button>

    </div>

  );

}

