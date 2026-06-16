import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X, Plus, Trash2, Check, CalendarPlus, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { ObligationBlock, ObligationPayment } from '../../types';
import { budgetService } from '../../services/budgetService';
import { DatePicker } from '../DatePicker';
import {
  applyScheduleToBlock,
  formatPaymentAmount,
  trimTrailingEmptyPayments,
} from '../../lib/obligationUtils';
import { notifyObligationsUpdated } from '../../lib/obligationsEvents';

export type ScheduleModalMode = 'view' | 'edit';

interface ObligationScheduleModalProps {
  isOpen: boolean;
  mode: ScheduleModalMode;
  block: ObligationBlock;
  onClose: () => void;
  onModeChange: (mode: ScheduleModalMode) => void;
  onBlockUpdated: (block: ObligationBlock) => void;
}

function formatPaymentDate(date?: string): string {
  if (!date) return '—';
  return format(new Date(date), 'd MMM yyyy', { locale: ru });
}

export function ObligationScheduleModal({
  isOpen,
  mode,
  block,
  onClose,
  onModeChange,
  onBlockUpdated,
}: ObligationScheduleModalProps) {
  const blockId = block.id!;
  const [draft, setDraft] = useState<ObligationPayment[]>([]);
  const [saving, setSaving] = useState(false);

  const storedPayments = useMemo(
    () => trimTrailingEmptyPayments(block.payments || []),
    [block.payments]
  );

  useEffect(() => {
    if (!isOpen) return;
    const base = storedPayments.length ? storedPayments : block.payments || [];
    setDraft(JSON.parse(JSON.stringify(base)));
  }, [isOpen, block.payments, storedPayments]);

  const isEdit = mode === 'edit';
  const rows = isEdit ? draft : storedPayments;
  const baselineDraft = useMemo(
    () =>
      JSON.stringify(
        (storedPayments.length ? storedPayments : block.payments || []).map((p) => ({
          n: p.n,
          ok: Boolean(p.ok),
          date: p.date || null,
          amount: Number(p.amount || 0),
          note: p.note || '',
        }))
      ),
    [storedPayments, block.payments]
  );
  const draftSnapshot = useMemo(
    () =>
      JSON.stringify(
        draft.map((p) => ({
          n: p.n,
          ok: Boolean(p.ok),
          date: p.date || null,
          amount: Number(p.amount || 0),
          note: p.note || '',
        }))
      ),
    [draft]
  );
  const isDirty = isEdit && draftSnapshot !== baselineDraft;

  const requestClose = () => {
    if (saving) return;
    if (isDirty && !window.confirm('Есть несохранённые изменения. Закрыть без сохранения?')) return;
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, requestClose]);

  const persistPayments = async (paymentsToSave: ObligationPayment[], closeAfter = false) => {
    setSaving(true);
    try {
      const updated = await budgetService.updateObligationBlock(blockId, {
        ...block,
        payments: paymentsToSave,
      });
      onBlockUpdated(updated);
      notifyObligationsUpdated();
      if (closeAfter) {
        onClose();
        toast.success('График сохранён');
      }
    } catch {
      // interceptor
    } finally {
      setSaving(false);
    }
  };

  const savePayments = (paymentsToSave: ObligationPayment[]) =>
    void persistPayments(paymentsToSave, true);

  const fillDraft = () => {
    setDraft(applyScheduleToBlock(block));
    toast.success('Даты и суммы подставлены');
  };

  const addRow = () => {
    const maxN = draft.length > 0 ? Math.max(...draft.map((p) => p.n)) : 0;
    setDraft([
      ...draft,
      {
        n: maxN + 1,
        ok: false,
        date: format(new Date(), 'yyyy-MM-dd'),
        amount: block.monthly || 0,
        note: '',
      },
    ]);
  };

  const updateRow = (n: number, patch: Partial<ObligationPayment>) => {
    setDraft(draft.map((p) => (p.n === n ? { ...p, ...patch } : p)));
  };

  const removeRow = (n: number) => {
    setDraft(draft.filter((p) => p.n !== n));
  };

  const togglePaid = (payment: ObligationPayment) => {
    const updated = (block.payments || []).map((p) =>
      (payment.id && p.id === payment.id) || p.n === payment.n
        ? {
            ...p,
            ok: !p.ok,
            date: p.date || format(new Date(), 'yyyy-MM-dd'),
            amount: p.amount || block.monthly || 0,
          }
        : p
    );
    void persistPayments(updated, false);
  };

  const startEdit = () => {
    setDraft(JSON.parse(JSON.stringify(storedPayments.length ? storedPayments : block.payments || [])));
    onModeChange('edit');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full sm:max-w-3xl rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col max-h-[94vh] sm:max-h-[88vh]"
        role="dialog"
        aria-labelledby="schedule-modal-title"
        aria-modal="true"
      >
        <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden />
        </div>
        {/* Шапка */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="min-w-0">
            <h2 id="schedule-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {isEdit ? 'Редактирование графика' : 'График платежей'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {block.title}
              {!isEdit && rows.length > 0 && (
                <span className="ml-2">
                  · {rows.filter((p) => p.ok).length}/{rows.length} оплачено
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Панель действий (редактирование) */}
        {isEdit && (
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
            <button
              type="button"
              onClick={fillDraft}
              disabled={saving || !block.start_date || !block.monthly}
              className="btn btn-sm btn-outline min-h-[44px] sm:min-h-0"
            >
              <CalendarPlus className="h-4 w-4 mr-1.5 inline" />
              Автозаполнение
            </button>
            <button
              type="button"
              onClick={addRow}
              className="btn btn-sm btn-outline min-h-[44px] sm:min-h-0"
            >
              <Plus className="h-4 w-4 mr-1.5 inline" />
              Добавить платёж
            </button>
          </div>
        )}

        {/* Таблица */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6 py-3 min-h-0">
          {rows.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p className="mb-4">Платежей пока нет</p>
              {isEdit && (
                <button type="button" onClick={fillDraft} className="btn btn-primary">
                  <CalendarPlus className="h-4 w-4 mr-2 inline" />
                  Создать из параметров кредита
                </button>
              )}
            </div>
          ) : isEdit ? (
            <>
              {/* Мобильные карточки */}
              <div className="sm:hidden space-y-3">
                {[...draft].sort((a, b) => a.n - b.n).map((payment) => (
                  <div
                    key={payment.n}
                    className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 space-y-3 bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-500">Платёж №{payment.n}</span>
                      <button
                        type="button"
                        onClick={() => removeRow(payment.n)}
                        className="p-2 rounded-lg text-red-500 active:bg-red-50 dark:active:bg-red-900/20 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Дата</label>
                      <DatePicker
                        value={payment.date ? format(new Date(payment.date), 'yyyy-MM-dd') : ''}
                        onChange={(value) => updateRow(payment.n, { date: value || undefined })}
                        className="w-full"
                        placeholder="дд.мм.гггг"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Сумма, ₽</label>
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={payment.amount || ''}
                        onChange={(e) =>
                          updateRow(payment.n, { amount: parseFloat(e.target.value) || 0 })
                        }
                        className="input py-2.5 w-full min-h-[44px]"
                      />
                    </div>
                    <label className="flex items-center gap-2 min-h-[44px] text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={payment.ok || false}
                        onChange={(e) => updateRow(payment.n, { ok: e.target.checked })}
                        className="h-5 w-5 rounded"
                      />
                      Оплачен
                    </label>
                  </div>
                ))}
              </div>
              {/* Десктоп — таблица */}
              <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/60 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-10">№</th>
                    <th className="px-3 py-2.5 text-left font-medium text-gray-500 min-w-[150px]">Дата</th>
                    <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-32">Сумма, ₽</th>
                    <th className="px-3 py-2.5 text-center font-medium text-gray-500 w-24">Оплачен</th>
                    <th className="px-2 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {[...draft].sort((a, b) => a.n - b.n).map((payment) => (
                    <tr key={payment.n} className="bg-white dark:bg-gray-800">
                      <td className="px-3 py-2 text-gray-400 font-medium">{payment.n}</td>
                      <td className="px-3 py-2">
                        <DatePicker
                          value={payment.date ? format(new Date(payment.date), 'yyyy-MM-dd') : ''}
                          onChange={(value) => updateRow(payment.n, { date: value || undefined })}
                          className="w-full min-w-[140px]"
                          placeholder="дд.мм.гггг"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={payment.amount || ''}
                          onChange={(e) =>
                            updateRow(payment.n, { amount: parseFloat(e.target.value) || 0 })
                          }
                          className="input py-1.5 w-full"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={payment.ok || false}
                          onChange={(e) => updateRow(payment.n, { ok: e.target.checked })}
                          className="h-4 w-4 rounded"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => removeRow(payment.n)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          aria-label="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          ) : (
            <div className="space-y-2">
              {[...rows].sort((a, b) => a.n - b.n).map((payment) => (
                <div
                  key={payment.n}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    payment.ok
                      ? 'bg-green-50/60 dark:bg-green-900/10 border-green-200 dark:border-green-800/50'
                      : 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => togglePaid(payment)}
                    disabled={saving}
                    className={`shrink-0 h-11 w-11 rounded-lg border-2 flex items-center justify-center ${
                      payment.ok
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 dark:border-gray-500 hover:border-green-500'
                    }`}
                    aria-label={payment.ok ? 'Снять оплату' : 'Отметить оплаченным'}
                  >
                    {payment.ok ? <Check className="h-3.5 w-3.5" /> : null}
                  </button>
                  <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-3 gap-1 sm:gap-4 text-sm">
                    <span className="text-gray-400">№{payment.n}</span>
                    <span className="text-gray-700 dark:text-gray-300">{formatPaymentDate(payment.date)}</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100 col-span-2 sm:col-span-1">
                      {formatPaymentAmount(payment.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Подвал */}
        <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end gap-2 px-4 sm:px-6 py-4 pb-safe-bottom border-t border-gray-200 dark:border-gray-700 shrink-0 bg-gray-50/80 dark:bg-gray-900/40 rounded-b-2xl sm:rounded-b-xl">
          {isEdit ? (
            <>
              <button
                type="button"
                onClick={() => savePayments(draft)}
                disabled={saving || draft.length === 0}
                className="btn btn-primary w-full sm:w-auto min-h-[44px]"
              >
                Сохранить график
              </button>
              <button
                type="button"
                onClick={requestClose}
                disabled={saving}
                className="btn btn-secondary w-full sm:w-auto min-h-[44px]"
              >
                Отмена
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={startEdit}
                className="btn btn-primary w-full sm:w-auto min-h-[44px]"
              >
                <Pencil className="h-4 w-4 mr-2 inline" />
                Изменить график
              </button>
              <button
                type="button"
                onClick={requestClose}
                className="btn btn-secondary w-full sm:w-auto min-h-[44px]"
              >
                Закрыть
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
