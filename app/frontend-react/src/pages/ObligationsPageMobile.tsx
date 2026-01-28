import { useState, useEffect } from 'react';
import { BootstrapIcon } from '../components/BootstrapIcon';
import { AlertCircle, Calendar } from 'lucide-react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { budgetService } from '../services/budgetService';
import { ObligationBlock, ObligationPayment, UpcomingPayment } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ObligationChart } from '../components/ObligationChart';
import { DatePicker } from '../components/DatePicker';
import { ConfirmDialog } from '../components/ConfirmDialog';

const ObligationsPageMobile = () => {
  const [blocks, setBlocks] = useState<ObligationBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ObligationBlock | null>(null);
  const [editingPayments, setEditingPayments] = useState<Record<number, ObligationPayment[]>>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null);
  const [upcomingPayments, setUpcomingPayments] = useState<UpcomingPayment[]>([]);

  const [newBlock, setNewBlock] = useState<ObligationBlock>({
    title: '',
    total: 0,
    monthly: 0,
    rate: 0,
    due_day: 15,
    start_date: format(new Date(), 'yyyy-MM-dd'),
    next_payment: '',
    close_date: '',
    status: 'Активный',
    notes: '',
    payments: [],
  });

  useEffect(() => {
    loadData();
    loadUpcomingPayments();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const blocksData = await budgetService.getObligationBlocks();
      setBlocks(blocksData);
    } catch (error) {
      // Ошибка обработана в interceptor
    } finally {
      setLoading(false);
    }
  };

  const loadUpcomingPayments = async () => {
    try {
      const data = await budgetService.getUpcomingPayments(3); // Только на 3 дня
      setUpcomingPayments(data);
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const getNextPaymentInfo = (block: ObligationBlock): UpcomingPayment | null => {
    // Ищем в списке upcomingPayments
    const found = upcomingPayments.find(p => p.block_id === block.id);
    if (found) return found;

    // Если не нашли, вычисляем локально
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Ищем первый неоплаченный платеж
    const unpaid = block.payments
      .filter(p => !p.ok && p.date)
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
    
    if (unpaid.length > 0) {
      const nextDate = new Date(unpaid[0].date!);
      const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntil >= 0 && daysUntil <= 7) {
        return {
          block_id: block.id!,
          block_title: block.title || '',
          payment_date: unpaid[0].date!,
          amount: unpaid[0].amount,
          days_until: daysUntil,
          is_urgent: daysUntil <= 1,
          is_warning: daysUntil > 1 && daysUntil <= 3,
        };
      }
    }
    
    return null;
  };

  const handleUpdatePayments = async (blockId: number) => {
    const payments = editingPayments[blockId];
    if (!payments) return;

    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    try {
      const updated = await budgetService.updateObligationBlock(blockId, {
        ...block,
        payments: payments,
      });
      setBlocks(blocks.map((b) => (b.id === updated.id ? updated : b)));
      setEditingPayments({ ...editingPayments, [blockId]: [] });
      toast.success('Платежи обновлены');
      await loadData();
      await loadUpcomingPayments();
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const startEditingPayments = (block: ObligationBlock) => {
    if (!block.id) return;
    setEditingPayments({
      ...editingPayments,
      [block.id]: JSON.parse(JSON.stringify(block.payments || [])),
    });
  };

  const cancelEditingPayments = (blockId: number) => {
    setEditingPayments({ ...editingPayments, [blockId]: [] });
  };

  const addPayment = (block: ObligationBlock) => {
    if (!block.id) return;
    const payments = editingPayments[block.id] || block.payments || [];
    const maxN = payments.length > 0 ? Math.max(...payments.map((p) => p.n)) : 0;
    const newPayment: ObligationPayment = {
      n: maxN + 1,
      ok: false,
      date: undefined,
      amount: block.monthly || 0,
      note: '',
    };
    setEditingPayments({
      ...editingPayments,
      [block.id]: [...payments, newPayment],
    });
  };

  const removePayment = (block: ObligationBlock, paymentN: number) => {
    if (!block.id) return;
    const payments = editingPayments[block.id] || block.payments || [];
    const updated = payments.filter((p) => p.n !== paymentN);
    setEditingPayments({
      ...editingPayments,
      [block.id]: updated,
    });
  };

  const handleCreateBlock = async () => {
    if (!newBlock.title?.trim() || !newBlock.total) {
      toast.error('Заполните обязательные поля');
      return;
    }

    try {
      const blockData = {
        ...newBlock,
        start_date: newBlock.start_date || undefined,
        next_payment: newBlock.next_payment || undefined,
        close_date: newBlock.close_date || undefined,
      };
      await budgetService.createObligationBlock(blockData);
      resetBlockForm();
      setShowBlockModal(false);
      toast.success('Кредитный блок создан');
      await loadData();
      await loadUpcomingPayments();
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const handleUpdateBlock = async () => {
    if (!editingBlock || !editingBlock.id) return;

    try {
      const blockData = {
        ...editingBlock,
        start_date: editingBlock.start_date || undefined,
        next_payment: editingBlock.next_payment || undefined,
        close_date: editingBlock.close_date || undefined,
      };
      await budgetService.updateObligationBlock(editingBlock.id, blockData);
      setEditingBlock(null);
      setShowBlockModal(false);
      toast.success('Кредитный блок обновлен');
      await loadData();
      await loadUpcomingPayments();
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const handleDeleteBlock = async (id: number) => {
    setConfirmAction(() => async () => {
      try {
        await budgetService.deleteObligationBlock(id);
        setBlocks(blocks.filter((b) => b.id !== id));
        toast.success('Кредитный блок удален');
        await loadUpcomingPayments();
        await loadUpcomingPayments();
      } catch (error) {
        // Ошибка обработана в interceptor
      }
    });
    setShowConfirmDialog(true);
  };

  const resetBlockForm = () => {
    setNewBlock({
      title: '',
      total: 0,
      monthly: 0,
      rate: 0,
      due_day: 15,
      start_date: format(new Date(), 'yyyy-MM-dd'),
      next_payment: '',
      close_date: '',
      status: 'Активный',
      notes: '',
      payments: [],
    });
  };

  const openEditBlock = (block: ObligationBlock) => {
    setEditingBlock(block);
    setShowBlockModal(true);
  };

  const calculateTotals = () => {
    const totalBlocks = blocks.reduce((sum, b) => sum + (b.remaining || 0), 0);
    const paidBlocks = blocks.reduce((sum, b) => sum + (b.paid_total || 0), 0);
    return { totalBlocks, paidBlocks };
  };

  const totals = calculateTotals();

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Обязательства</h1>
        <button
          onClick={() => {
            setEditingBlock(null);
            resetBlockForm();
            setShowBlockModal(true);
          }}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-primary-600 text-white rounded-lg active:bg-primary-700"
        >
          <BootstrapIcon name="plus-lg" size={20} />
        </button>
      </div>

      {/* Баннер с напоминаниями */}
      {upcomingPayments.length > 0 && (
        <div className={`rounded-lg p-3 mb-3 border-l-4 ${
          upcomingPayments.some(p => p.is_urgent)
            ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
        }`}>
          <div className="flex items-start">
            <AlertCircle className={`h-4 w-4 mr-2 flex-shrink-0 mt-0.5 ${
              upcomingPayments.some(p => p.is_urgent)
                ? 'text-red-600 dark:text-red-400'
                : 'text-yellow-600 dark:text-yellow-400'
            }`} />
            <div className="flex-1">
              <h3 className={`text-sm font-semibold mb-2 ${
                upcomingPayments.some(p => p.is_urgent)
                  ? 'text-red-900 dark:text-red-100'
                  : 'text-yellow-900 dark:text-yellow-100'
              }`}>
                {upcomingPayments.some(p => p.is_urgent)
                  ? '⚠️ Срочные платежи!'
                  : '⏰ Ближайшие платежи'}
              </h3>
              <div className="space-y-2">
                {upcomingPayments.map((payment) => (
                  <div
                    key={`${payment.block_id}-${payment.payment_date}`}
                    className="flex justify-between items-center"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                        {payment.block_title}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {format(new Date(payment.payment_date), 'dd.MM.yyyy')}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-2">
                      <span className="font-bold text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">
                        {payment.amount.toLocaleString('ru-RU', {
                          style: 'currency',
                          currency: 'RUB',
                          maximumFractionDigits: 0,
                        })}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-bold rounded whitespace-nowrap ${
                        payment.is_urgent
                          ? 'bg-red-500 text-white'
                          : 'bg-yellow-500 text-white'
                      }`}>
                        {payment.days_until === 0 ? 'СЕГОДНЯ' :
                         payment.days_until === 1 ? 'ЗАВТРА' :
                         `${payment.days_until} дн.`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Остаток</div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {totals.totalBlocks.toLocaleString('ru-RU', {
              style: 'currency',
              currency: 'RUB',
              maximumFractionDigits: 0,
            })}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Оплачено</div>
          <div className="text-xl font-bold text-green-600">
            {totals.paidBlocks.toLocaleString('ru-RU', {
              style: 'currency',
              currency: 'RUB',
              maximumFractionDigits: 0,
            })}
          </div>
        </div>
      </div>

      {/* Blocks List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Загрузка...</div>
        ) : blocks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow text-center text-gray-500 dark:text-gray-400">
            Кредитов пока нет
          </div>
        ) : (
          blocks.map((block) => {
            const isEditingPayments = block.id && editingPayments[block.id]?.length > 0;
            const payments = isEditingPayments ? editingPayments[block.id!] : (block.payments || []);
            const isExpanded = expandedBlock === block.id;

            return (
              <div key={block.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                {/* Block Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{block.title}</h3>
                      {(() => {
                        const nextPayment = getNextPaymentInfo(block);
                        if (!nextPayment) return null;
                        
                        return (
                          <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            nextPayment.is_urgent
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                          }`}>
                            <Calendar className="h-3 w-3 mr-1" />
                            {nextPayment.days_until === 0 ? 'Сегодня' :
                             nextPayment.days_until === 1 ? 'Завтра' :
                             `${nextPayment.days_until} дн.`}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {block.status} | {block.rate}%
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditBlock(block)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-700 rounded-lg"
                    >
                      <BootstrapIcon name="pencil" size={18} />
                    </button>
                    <button
                      onClick={() => block.id && handleDeleteBlock(block.id)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20 rounded-lg"
                    >
                      <BootstrapIcon name="trash" size={18} />
                    </button>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Общая сумма</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {block.total.toLocaleString('ru-RU', {
                        style: 'currency',
                        currency: 'RUB',
                        maximumFractionDigits: 0,
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Остаток</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {(block.remaining || block.total).toLocaleString('ru-RU', {
                        style: 'currency',
                        currency: 'RUB',
                        maximumFractionDigits: 0,
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Оплачено</div>
                    <div className="text-sm font-semibold text-green-600">
                      {(block.paid_total || 0).toLocaleString('ru-RU', {
                        style: 'currency',
                        currency: 'RUB',
                        maximumFractionDigits: 0,
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Прогресс</div>
                    <div className="text-sm font-semibold text-primary-600">
                      {block.progress_pct?.toFixed(1) || '0'}%
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="mb-3">
                  <ObligationChart
                    paid={block.paid_total || 0}
                    remaining={block.remaining || block.total}
                    total={block.total}
                  />
                </div>

                {/* Payments */}
                {payments.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Платежи</h4>
                      {!isEditingPayments ? (
                        <button
                          onClick={() => startEditingPayments(block)}
                          className="min-h-[36px] px-3 py-1 text-sm text-primary-600 dark:text-primary-400 active:bg-primary-50 dark:active:bg-primary-900/20 rounded"
                        >
                          Редактировать
                        </button>
                      ) : (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => block.id && handleUpdatePayments(block.id)}
                            className="min-h-[36px] px-3 py-1 text-sm text-green-600 dark:text-green-400 active:bg-green-50 dark:active:bg-green-900/20 rounded"
                          >
                            Сохранить
                          </button>
                          <button
                            onClick={() => block.id && cancelEditingPayments(block.id)}
                            className="min-h-[36px] px-3 py-1 text-sm text-gray-600 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-700 rounded"
                          >
                            Отмена
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {payments.slice(0, isExpanded ? payments.length : 5).map((payment) => (
                        <div
                          key={payment.n}
                          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm"
                        >
                          <div className="flex-1">
                            <div className="font-medium">№{payment.n}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {isEditingPayments ? (
                                <DatePicker
                                  value={payment.date ? format(new Date(payment.date), 'yyyy-MM-dd') : ''}
                                  onChange={(value) => {
                                    const updated = payments.map((p) =>
                                      p.n === payment.n ? { ...p, date: value || undefined } : p
                                    );
                                    setEditingPayments({ ...editingPayments, [block.id!]: updated });
                                  }}
                                  className="w-full text-xs"
                                />
                              ) : payment.date ? (
                                format(new Date(payment.date), 'dd.MM.yyyy')
                              ) : (
                                '-'
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {isEditingPayments ? (
                              <>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={payment.amount || ''}
                                  onChange={(e) => {
                                    const updated = payments.map((p) =>
                                      p.n === payment.n ? { ...p, amount: parseFloat(e.target.value) || 0 } : p
                                    );
                                    setEditingPayments({ ...editingPayments, [block.id!]: updated });
                                  }}
                                  className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                                />
                                <input
                                  type="checkbox"
                                  checked={payment.ok || false}
                                  onChange={(e) => {
                                    const updated = payments.map((p) =>
                                      p.n === payment.n ? { ...p, ok: e.target.checked } : p
                                    );
                                    setEditingPayments({ ...editingPayments, [block.id!]: updated });
                                  }}
                                  className="h-4 w-4"
                                />
                                <button
                                  onClick={() => removePayment(block, payment.n)}
                                  className="min-w-[36px] min-h-[36px] flex items-center justify-center text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20 rounded"
                                >
                                  <BootstrapIcon name="trash" size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <div className="text-right">
                                  <div className="font-medium">
                                    {payment.amount.toLocaleString('ru-RU', {
                                      style: 'currency',
                                      currency: 'RUB',
                                      maximumFractionDigits: 0,
                                    })}
                                  </div>
                                  {payment.ok ? (
                                    <span className="text-xs text-green-600">Оплачено</span>
                                  ) : (
                                    <span className="text-xs text-gray-500">Ожидает</span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {payments.length > 5 && !isExpanded && (
                      <button
                        onClick={() => setExpandedBlock(block.id!)}
                        className="w-full mt-2 text-xs text-primary-600 dark:text-primary-400 text-center"
                      >
                        Показать все ({payments.length})
                      </button>
                    )}
                    {isEditingPayments && (
                      <button
                        onClick={() => addPayment(block)}
                        className="w-full mt-2 min-h-[44px] py-2 text-sm text-primary-600 dark:text-primary-400 border border-primary-600 dark:border-primary-400 rounded active:bg-primary-50 dark:active:bg-primary-900/20"
                      >
                        <BootstrapIcon name="plus" size={16} className="inline mr-1" />
                        Добавить платеж
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Confirm Dialog */}
      {showConfirmDialog && (
        <ConfirmDialog
          isOpen={showConfirmDialog}
          title="Удаление кредита"
          message="Вы уверены, что хотите удалить этот кредит? Это действие нельзя отменить."
          onConfirm={() => {
            if (confirmAction) {
              confirmAction();
            }
            setShowConfirmDialog(false);
            setConfirmAction(null);
          }}
          onCancel={() => {
            setShowConfirmDialog(false);
            setConfirmAction(null);
          }}
          confirmText="Удалить"
          cancelText="Отмена"
          confirmButtonClass="btn-danger"
        />
      )}

      {/* Add/Edit Block Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-xl p-4 pb-safe-bottom max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {editingBlock ? 'Редактировать кредит' : 'Новый кредит'}
              </h2>
              <button
                onClick={() => {
                  setShowBlockModal(false);
                  setEditingBlock(null);
                  resetBlockForm();
                }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-700 rounded-lg"
              >
                <BootstrapIcon name="x-lg" size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Название
                </label>
                <input
                  type="text"
                  value={editingBlock?.title || newBlock.title || ''}
                  onChange={(e) => {
                    if (editingBlock) {
                      setEditingBlock({ ...editingBlock, title: e.target.value });
                    } else {
                      setNewBlock({ ...newBlock, title: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Название кредита"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Общая сумма
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingBlock?.total || newBlock.total || ''}
                    onChange={(e) => {
                      if (editingBlock) {
                        setEditingBlock({ ...editingBlock, total: parseFloat(e.target.value) || 0 });
                      } else {
                        setNewBlock({ ...newBlock, total: parseFloat(e.target.value) || 0 });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ежемесячный платеж
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingBlock?.monthly || newBlock.monthly || ''}
                    onChange={(e) => {
                      if (editingBlock) {
                        setEditingBlock({ ...editingBlock, monthly: parseFloat(e.target.value) || 0 });
                      } else {
                        setNewBlock({ ...newBlock, monthly: parseFloat(e.target.value) || 0 });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ставка (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingBlock?.rate || newBlock.rate || ''}
                    onChange={(e) => {
                      if (editingBlock) {
                        setEditingBlock({ ...editingBlock, rate: parseFloat(e.target.value) || 0 });
                      } else {
                        setNewBlock({ ...newBlock, rate: parseFloat(e.target.value) || 0 });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    День платежа
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={editingBlock?.due_day || newBlock.due_day || 15}
                    onChange={(e) => {
                      if (editingBlock) {
                        setEditingBlock({ ...editingBlock, due_day: parseInt(e.target.value) || 15 });
                      } else {
                        setNewBlock({ ...newBlock, due_day: parseInt(e.target.value) || 15 });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Дата выдачи
                </label>
                <DatePicker
                  value={
                    editingBlock?.start_date
                      ? format(new Date(editingBlock.start_date), 'yyyy-MM-dd')
                      : newBlock.start_date || format(new Date(), 'yyyy-MM-dd')
                  }
                  onChange={(value) => {
                    if (editingBlock) {
                      setEditingBlock({ ...editingBlock, start_date: value || undefined });
                    } else {
                      setNewBlock({ ...newBlock, start_date: value || undefined });
                    }
                  }}
                  placeholder="дд.мм.гггг"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Следующий платеж
                </label>
                <DatePicker
                  value={
                    editingBlock?.next_payment
                      ? format(new Date(editingBlock.next_payment), 'yyyy-MM-dd')
                      : newBlock.next_payment || ''
                  }
                  onChange={(value) => {
                    if (editingBlock) {
                      setEditingBlock({ ...editingBlock, next_payment: value || undefined });
                    } else {
                      setNewBlock({ ...newBlock, next_payment: value || undefined });
                    }
                  }}
                  placeholder="дд.мм.гггг"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Дата закрытия
                </label>
                <DatePicker
                  value={
                    editingBlock?.close_date
                      ? format(new Date(editingBlock.close_date), 'yyyy-MM-dd')
                      : newBlock.close_date || ''
                  }
                  onChange={(value) => {
                    if (editingBlock) {
                      setEditingBlock({ ...editingBlock, close_date: value || undefined });
                    } else {
                      setNewBlock({ ...newBlock, close_date: value || undefined });
                    }
                  }}
                  placeholder="дд.мм.гггг"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Статус
                </label>
                <select
                  value={editingBlock?.status || newBlock.status || 'Активный'}
                  onChange={(e) => {
                    if (editingBlock) {
                      setEditingBlock({ ...editingBlock, status: e.target.value });
                    } else {
                      setNewBlock({ ...newBlock, status: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="Активный">Активный</option>
                  <option value="Просрочен">Просрочен</option>
                  <option value="Закрыт">Закрыт</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Заметки
                </label>
                <textarea
                  value={editingBlock?.notes || newBlock.notes || ''}
                  onChange={(e) => {
                    if (editingBlock) {
                      setEditingBlock({ ...editingBlock, notes: e.target.value });
                    } else {
                      setNewBlock({ ...newBlock, notes: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  rows={3}
                  placeholder="Комментарий..."
                />
              </div>

              <div className="flex space-x-3 pt-4 pb-4">
                <button
                  onClick={() => {
                    setShowBlockModal(false);
                    setEditingBlock(null);
                    resetBlockForm();
                  }}
                  className="flex-1 min-h-[44px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 active:bg-gray-50 dark:active:bg-gray-700"
                >
                  Отмена
                </button>
                <button
                  onClick={editingBlock ? handleUpdateBlock : handleCreateBlock}
                  className="flex-1 min-h-[44px] px-4 py-2 bg-primary-600 text-white rounded-lg active:bg-primary-700"
                >
                  {editingBlock ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ObligationsPageMobile;
