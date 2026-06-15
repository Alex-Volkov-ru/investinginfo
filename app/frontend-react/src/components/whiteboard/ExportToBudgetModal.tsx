import { BudgetAccount } from '../../types';
import { format } from 'date-fns';

interface ExportToBudgetModalProps {
  isOpen: boolean;
  accounts: BudgetAccount[];
  loading: boolean;
  onClose: () => void;
  onExport: (accountId: number, occurredAt: string) => void;
}

export function ExportToBudgetModal({
  isOpen,
  accounts,
  loading,
  onClose,
  onExport,
}: ExportToBudgetModalProps) {
  if (!isOpen) return null;

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Экспорт в бюджет
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Карточки доходов и расходов с категорией станут транзакциями в модуле «Бюджет».
        </p>
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
            <select name="account_id" required className="input" defaultValue={accounts[0]?.id}>
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
            <button type="submit" className="btn btn-primary" disabled={loading || accounts.length === 0}>
              {loading ? 'Экспорт…' : 'Экспортировать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
