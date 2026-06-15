import { X } from 'lucide-react';
import { BudgetCategory } from '../../types';

interface AddCardModalProps {
  isOpen: boolean;
  kind: 'expense' | 'income';
  categories: BudgetCategory[];
  onClose: () => void;
  onSubmit: (data: { title: string; amount: number; category_id?: number }) => void;
}

export function AddCardModal({ isOpen, kind, categories, onClose, onSubmit }: AddCardModalProps) {
  if (!isOpen) return null;

  const filtered = categories.filter((c) => c.is_active && c.kind === kind);
  const label = kind === 'income' ? 'доход' : 'расход';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">
            Новый {label}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const title = String(fd.get('title') || '').trim() || (kind === 'income' ? 'Доход' : 'Расход');
            const amount = Math.max(0, Number(fd.get('amount')) || 0);
            const catRaw = fd.get('category_id');
            const category_id = catRaw ? Number(catRaw) : undefined;
            onSubmit({ title, amount, category_id });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Название
            </label>
            <input name="title" className="input" placeholder={kind === 'income' ? 'Зарплата' : 'Продукты'} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Сумма, ₽
            </label>
            <input name="amount" type="number" min={0} className="input" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Категория из бюджета
            </label>
            <select name="category_id" className="input">
              <option value="">— без категории —</option>
              {filtered.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Для экспорта в бюджет категория обязательна
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary">
              Добавить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
