import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Check, CalendarPlus, Pencil, List, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import { ObligationBlock, ObligationPayment } from '../../types';
import { budgetService } from '../../services/budgetService';
import {
  applyScheduleToBlock,
  countPaid,
  findNextUnpaid,
  formatPaymentAmount,
  scheduleNeedsFill,
  trimTrailingEmptyPayments,
} from '../../lib/obligationUtils';
import { notifyObligationsUpdated } from '../../lib/obligationsEvents';
import {
  ObligationScheduleModal,
  ScheduleModalMode,
} from './ObligationScheduleModal';

interface ObligationPaymentsPanelProps {
  block: ObligationBlock;
  onBlockUpdated: (block: ObligationBlock) => void;
  compact?: boolean;
}

function formatPaymentDate(date?: string, short = false): string {
  if (!date) return 'Дата не указана';
  return format(new Date(date), short ? 'd MMM yyyy' : 'd MMMM yyyy', { locale: ru });
}

export function ObligationPaymentsPanel({
  block,
  onBlockUpdated,
  compact = false,
}: ObligationPaymentsPanelProps) {
  const blockId = block.id!;
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ScheduleModalMode>('view');

  const storedPayments = block.payments || [];
  const displayStored = useMemo(() => trimTrailingEmptyPayments(storedPayments), [storedPayments]);
  const needsFill = scheduleNeedsFill(storedPayments);
  const nextUnpaid = findNextUnpaid(displayStored);
  const paidCount = countPaid(displayStored);
  const totalCount = displayStored.length;
  const progressPct = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  const unpaidCount = totalCount - paidCount;

  const previewLimit = compact ? 3 : 4;
  const previewPayments = displayStored
    .filter((p) => !p.ok)
    .sort((a, b) => a.n - b.n)
    .slice(0, previewLimit);

  const openModal = (mode: ScheduleModalMode) => {
    setModalMode(mode);
    setModalOpen(true);
  };

  const savePayments = async (paymentsToSave: ObligationPayment[]) => {
    setSaving(true);
    try {
      const updated = await budgetService.updateObligationBlock(blockId, {
        ...block,
        payments: paymentsToSave,
      });
      onBlockUpdated(updated);
      notifyObligationsUpdated();
      toast.success('График сохранён');
    } catch {
      // interceptor
    } finally {
      setSaving(false);
    }
  };

  const createSchedule = async () => {
    const generated = applyScheduleToBlock(block);
    await savePayments(generated);
  };

  const openCreateInModal = () => {
    openModal('edit');
  };

  const markNextPaid = async () => {
    if (!nextUnpaid) {
      toast.error('Все платежи уже отмечены');
      return;
    }
    const today = format(new Date(), 'yyyy-MM-dd');
    const updated = storedPayments.map((p) =>
      p.n === nextUnpaid.n
        ? {
            ...p,
            ok: true,
            date: p.date || today,
            amount: p.amount || block.monthly || 0,
          }
        : p
    );
    await savePayments(updated);
  };

  if (!storedPayments.length && !needsFill) return null;

  return (
    <>
      <section
        className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 ${
          compact ? 'mt-3 border-t-0 rounded-lg' : 'mt-4'
        }`}
      >
        <div className={`${compact ? 'px-3 pb-3' : 'p-4 pb-3'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">График платежей</h4>
              {totalCount > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {paidCount} из {totalCount} оплачено
                </p>
              )}
            </div>
            {!needsFill && totalCount > 0 && (
              <div className={`${compact ? 'grid grid-cols-2 gap-2 w-full mt-2' : 'flex flex-wrap gap-2 shrink-0'}`}>
                <button
                  type="button"
                  onClick={() => openModal('view')}
                  className={`btn btn-sm btn-outline ${compact ? 'min-h-[44px]' : ''}`}
                >
                  <List className="h-4 w-4 mr-1.5 inline" />
                  {compact ? 'График' : 'Весь график'}
                </button>
                <button
                  type="button"
                  onClick={() => openModal('edit')}
                  className={`btn btn-sm btn-outline ${compact ? 'min-h-[44px]' : ''}`}
                >
                  <Pencil className="h-4 w-4 mr-1.5 inline" />
                  Изменить
                </button>
              </div>
            )}
          </div>

          {totalCount > 0 && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {needsFill && (
          <div className={`${compact ? 'px-3 pb-4' : 'px-4 pb-4'}`}>
            <div className="rounded-lg border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 text-center">
              <CalendarDays className="h-8 w-8 mx-auto text-amber-600 dark:text-amber-400 mb-2" />
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                График не заполнен. Можно создать автоматически или настроить вручную.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => void createSchedule()}
                  disabled={saving || !block.start_date || !block.monthly}
                  className={`btn btn-primary ${compact ? 'w-full min-h-[44px]' : ''}`}
                >
                  <CalendarPlus className="h-4 w-4 mr-2 inline" />
                  Создать график
                </button>
                <button
                  type="button"
                  onClick={openCreateInModal}
                  disabled={!block.start_date || !block.monthly}
                  className={`btn btn-outline ${compact ? 'w-full min-h-[44px]' : ''}`}
                >
                  Настроить вручную
                </button>
              </div>
            </div>
          </div>
        )}

        {!needsFill && nextUnpaid && (
          <div className={`${compact ? 'px-3 pb-3' : 'px-4 pb-3'}`}>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-primary-200 dark:border-primary-800 shadow-sm p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-primary-600 dark:text-primary-400 mb-1">
                Ближайший платёж
              </div>
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {formatPaymentAmount(nextUnpaid.amount || block.monthly)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {formatPaymentDate(nextUnpaid.date, compact)} · №{nextUnpaid.n}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void markNextPaid()}
                  disabled={saving}
                  className={`btn btn-primary ${compact ? 'w-full min-h-[44px]' : 'shrink-0'}`}
                >
                  <Check className="h-4 w-4 mr-2 inline" />
                  Оплатил
                </button>
              </div>
            </div>
          </div>
        )}

        {!needsFill && previewPayments.length > 0 && (
          <div className={`${compact ? 'px-3 pb-4' : 'px-4 pb-4'}`}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Далее по графику
            </p>
            <div className="space-y-1.5">
              {previewPayments.map((payment) => (
                <div
                  key={payment.n}
                  className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-white/60 dark:bg-gray-800/60"
                >
                  <span className="text-gray-500 dark:text-gray-400 truncate mr-2">
                    №{payment.n} · {formatPaymentDate(payment.date, compact)}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatPaymentAmount(payment.amount)}
                  </span>
                </div>
              ))}
            </div>
            {unpaidCount > previewLimit && (
              <button
                type="button"
                onClick={() => openModal('view')}
                className="btn btn-sm btn-outline w-full mt-2"
              >
                Ещё {unpaidCount - previewLimit} ожидающих
              </button>
            )}
          </div>
        )}
      </section>

      <ObligationScheduleModal
        isOpen={modalOpen}
        mode={modalMode}
        block={block}
        onClose={() => setModalOpen(false)}
        onModeChange={setModalMode}
        onBlockUpdated={onBlockUpdated}
      />
    </>
  );
}
