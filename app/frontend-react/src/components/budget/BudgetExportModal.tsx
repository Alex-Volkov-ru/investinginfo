import { useEffect, useMemo, useState } from 'react';
import { format, lastDayOfMonth, parseISO, subMonths } from 'date-fns';
import { MonthYearPicker } from '../MonthYearPicker';

type ExportMode = 'month' | 'range';

interface BudgetExportModalProps {
  isOpen: boolean;
  defaultMonth: string;
  onClose: () => void;
  onExport: (dateFrom: string, dateTo: string) => Promise<void>;
}

function monthBounds(monthValue: string): { from: string; to: string } {
  const [year, month] = monthValue.split('-').map(Number);
  const from = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
  const to = format(lastDayOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');
  return { from, to };
}

export function BudgetExportModal({
  isOpen,
  defaultMonth,
  onClose,
  onExport,
}: BudgetExportModalProps) {
  const [mode, setMode] = useState<ExportMode>('month');
  const [monthValue, setMonthValue] = useState(defaultMonth);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMode('month');
    setMonthValue(defaultMonth);
    const bounds = monthBounds(defaultMonth);
    setDateFrom(bounds.from);
    setDateTo(bounds.to);
  }, [isOpen, defaultMonth]);

  const previewPeriod = useMemo(() => {
    if (mode === 'month') {
      const bounds = monthBounds(monthValue);
      return { from: bounds.from, to: bounds.to };
    }
    return { from: dateFrom, to: dateTo };
  }, [mode, monthValue, dateFrom, dateTo]);

  const isValidRange =
    mode === 'month' ||
    (Boolean(dateFrom) && Boolean(dateTo) && dateFrom <= dateTo);

  if (!isOpen) return null;

  const applyPreset = (preset: 'current' | 'previous') => {
    const base = preset === 'previous' ? subMonths(parseISO(`${defaultMonth}-01`), 1) : parseISO(`${defaultMonth}-01`);
    const value = format(base, 'yyyy-MM');
    setMonthValue(value);
    const bounds = monthBounds(value);
    setDateFrom(bounds.from);
    setDateTo(bounds.to);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidRange) return;
    setLoading(true);
    try {
      await onExport(previewPeriod.from, previewPeriod.to);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Экспорт в Excel
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          Выберите период для выгрузки доходов и расходов.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-mode"
                checked={mode === 'month'}
                onChange={() => setMode('month')}
              />
              По месяцу
            </label>
            {mode === 'month' && (
              <div className="pl-6 space-y-3">
                <MonthYearPicker value={monthValue} onChange={setMonthValue} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-secondary text-xs" onClick={() => applyPreset('current')}>
                    Текущий на странице
                  </button>
                  <button type="button" className="btn btn-secondary text-xs" onClick={() => applyPreset('previous')}>
                    Прошлый месяц
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-mode"
                checked={mode === 'range'}
                onChange={() => setMode('range')}
              />
              Произвольный период
            </label>
            {mode === 'range' && (
              <div className="pl-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">С</label>
                  <input
                    type="date"
                    className="input w-full"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">По</label>
                  <input
                    type="date"
                    className="input w-full"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
            Период:{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {previewPeriod.from && previewPeriod.to
                ? `${format(parseISO(previewPeriod.from), 'dd.MM.yyyy')} — ${format(parseISO(previewPeriod.to), 'dd.MM.yyyy')}`
                : '—'}
            </span>
          </div>

          {!isValidRange && mode === 'range' && (
            <p className="text-sm text-red-600">Дата начала должна быть не позже даты окончания.</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !isValidRange}>
              {loading ? 'Выгрузка…' : 'Выгрузить Excel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
