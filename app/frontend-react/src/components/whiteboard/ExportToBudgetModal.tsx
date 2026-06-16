import { BudgetAccount } from '../../types';
import { ExportPreview, formatMoney } from '../../lib/whiteboardUtils';
import { format } from 'date-fns';

interface ExportToBudgetModalProps {
  isOpen: boolean;
  accounts: BudgetAccount[];
  loading: boolean;
  preview: ExportPreview | null;
  onClose: () => void;
  onExport: (accountId: number, occurredAt: string) => void;
}

export function ExportToBudgetModal({
  isOpen,
  accounts,
  loading,
  preview,
  onClose,
  onExport,
}: ExportToBudgetModalProps) {
  if (!isOpen) return null;

  const today = format(new Date(), 'yyyy-MM-dd');
  const noAccounts = accounts.length === 0;
  const nothingToExport = preview !== null && preview.readyCount === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Экспорт в бюджет
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Карточки доходов и расходов с категорией станут транзакциями в модуле «Бюджет».
        </p>

        {preview && (
          <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3 text-sm space-y-1">
            <div className="font-medium text-gray-900 dark:text-gray-100">Предпросмотр</div>
            <div className="text-gray-600 dark:text-gray-400">
              Готово к экспорту: <strong className="text-gray-900 dark:text-gray-100">{preview.readyCount}</strong>
              {preview.incomeCount > 0 && (
                <span> · доходы {preview.incomeCount} ({formatMoney(preview.incomeTotal)})</span>
              )}
              {preview.expenseCount > 0 && (
                <span> · расходы {preview.expenseCount} ({formatMoney(preview.expenseTotal)})</span>
              )}
            </div>
            {preview.skippedNoCategory > 0 && (
              <div className="text-amber-700 dark:text-amber-300 text-xs">
                Без категории (будут пропущены): {preview.skippedNoCategory}
              </div>
            )}
            {preview.skippedZeroAmount > 0 && (
              <div className="text-gray-500 dark:text-gray-400 text-xs">
                С нулевой суммой: {preview.skippedZeroAmount}
              </div>
            )}
          </div>
        )}

        {noAccounts && (
          <div className="mb-4 rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm text-yellow-900 dark:text-yellow-100">
            Сначала создайте счёт в разделе «Бюджет» → Счета.
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const accountId = Number(fd.get('account_id'));
            const occurredAt = String(fd.get('occurred_at') || today);
            if (accountId) onExport(accountId, occurredAt);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Счёт
            </label>
            <select
              name="account_id"
              required
              className="input"
              defaultValue={accounts[0]?.id}
              disabled={noAccounts}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.currency})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Дата операций
            </label>
            <input type="date" name="occurred_at" className="input" defaultValue={today} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || noAccounts || nothingToExport}
            >
              {loading ? 'Экспорт…' : `Экспортировать${preview ? ` (${preview.readyCount})` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
