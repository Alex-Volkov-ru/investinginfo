import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { budgetService } from '../services/budgetService';
import { ObligationBlock, ObligationPayment } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ObligationChart } from '../components/ObligationChart';
import { DatePicker } from '../components/DatePicker';
import { ConfirmDialog } from '../components/ConfirmDialog';

const ObligationsPage = () => {
  const [blocks, setBlocks] = useState<ObligationBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ObligationBlock | null>(null);
  const [editingPayments, setEditingPayments] = useState<Record<number, ObligationPayment[]>>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

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

  const autoFillPayments = (block: ObligationBlock) => {
    if (!block.id || !block.start_date || !block.monthly || block.monthly === 0) {
      toast.error('Заполните дату начала и ежемесячный платеж для автозаполнения');
      return;
    }

    const payments = editingPayments[block.id] || block.payments || [];
    const startDate = new Date(block.start_date);
    const dueDay = block.due_day || 15;
    const monthlyAmount = block.monthly;

    // Вычисляем первую дату платежа
    const firstPaymentDate = new Date(startDate);
    firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 1);
    firstPaymentDate.setDate(Math.min(dueDay, new Date(firstPaymentDate.getFullYear(), firstPaymentDate.getMonth() + 1, 0).getDate()));

    const updatedPayments: ObligationPayment[] = payments.map((payment, index) => {
      if (index === 0 && payment.date) {
        // Если первая дата уже заполнена, используем её как базовую
        const baseDate = new Date(payment.date);
        const newDate = new Date(baseDate);
        newDate.setMonth(newDate.getMonth() + index);
        newDate.setDate(Math.min(dueDay, new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate()));
        return {
          ...payment,
          date: format(newDate, 'yyyy-MM-dd'),
          amount: payment.amount || monthlyAmount,
        };
      } else if (index === 0) {
        // Первый платеж
        return {
          ...payment,
          date: format(firstPaymentDate, 'yyyy-MM-dd'),
          amount: monthlyAmount,
        };
      } else {
        // Последующие платежи - вычисляем дату от предыдущего
        const prevPayment: ObligationPayment = updatedPayments[index - 1];
        if (prevPayment && prevPayment.date) {
          const prevDate = new Date(prevPayment.date);
          const newDate = new Date(prevDate);
          newDate.setMonth(newDate.getMonth() + 1);
          newDate.setDate(Math.min(dueDay, new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate()));
          return {
            ...payment,
            date: format(newDate, 'yyyy-MM-dd'),
            amount: payment.amount || monthlyAmount,
          };
        } else {
          const newDate = new Date(firstPaymentDate);
          newDate.setMonth(newDate.getMonth() + index);
          newDate.setDate(Math.min(dueDay, new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate()));
          return {
            ...payment,
            date: format(newDate, 'yyyy-MM-dd'),
            amount: payment.amount || monthlyAmount,
          };
        }
      }
    });

    setEditingPayments({ ...editingPayments, [block.id]: updatedPayments });
    toast.success('Платежи автозаполнены');
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
      // Преобразуем пустые строки в undefined для дат
      const blockData = {
        ...newBlock,
        start_date: newBlock.start_date || undefined,
        next_payment: newBlock.next_payment || undefined,
        close_date: newBlock.close_date || undefined,
      };
      const block = await budgetService.createObligationBlock(blockData);
      setBlocks([...blocks, block]);
      resetBlockForm();
      setShowBlockModal(false);
      toast.success('Кредитный блок создан');
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const handleUpdateBlock = async () => {
    if (!editingBlock || !editingBlock.id) return;

    try {
      // Преобразуем пустые строки в undefined для дат
      const blockData = {
        ...editingBlock,
        start_date: editingBlock.start_date || undefined,
        next_payment: editingBlock.next_payment || undefined,
        close_date: editingBlock.close_date || undefined,
      };
      const updated = await budgetService.updateObligationBlock(editingBlock.id, blockData);
      setBlocks(blocks.map((b) => (b.id === updated.id ? updated : b)));
      setEditingBlock(null);
      setShowBlockModal(false);
      toast.success('Кредитный блок обновлен');
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Обязательства</h1>
        <button
          onClick={() => {
            setEditingBlock(null);
            resetBlockForm();
            setShowBlockModal(true);
          }}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Кредит
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="text-sm text-gray-600 dark:text-gray-400">Остаток по кредитам</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {totals.totalBlocks.toLocaleString('ru-RU', {
              style: 'currency',
              currency: 'RUB',
            })}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-600 dark:text-gray-400">Оплачено по кредитам</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {totals.paidBlocks.toLocaleString('ru-RU', {
              style: 'currency',
              currency: 'RUB',
            })}
          </div>
        </div>
      </div>

      {/* Blocks */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Загрузка...</div>
        ) : blocks.length === 0 ? (
          <div className="card text-center py-8 text-gray-500 dark:text-gray-400">Кредитов пока нет</div>
        ) : (
          blocks.map((block) => {
            const isEditingPayments = block.id && editingPayments[block.id]?.length > 0;
            const payments = isEditingPayments ? editingPayments[block.id!] : (block.payments || []);

            return (
              <div key={block.id} className="card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{block.title}</h3>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      Статус: {block.status} | Ставка: {block.rate}%
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditBlock(block)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => block.id && handleDeleteBlock(block.id)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
                  {/* График */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">График оплаты</h4>
                    <ObligationChart
                      paid={block.paid_total || 0}
                      remaining={block.remaining || block.total}
                      total={block.total}
                    />
                  </div>

                  {/* Карточки метрик */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Общая сумма</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {block.total.toLocaleString('ru-RU', {
                          style: 'currency',
                          currency: 'RUB',
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Оплачено</div>
                      <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {block.paid_total?.toLocaleString('ru-RU', {
                          style: 'currency',
                          currency: 'RUB',
                        }) || '0 ₽'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Остаток</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {block.remaining?.toLocaleString('ru-RU', {
                          style: 'currency',
                          currency: 'RUB',
                        }) || block.total.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Прогресс</div>
                      <div className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                        {block.progress_pct?.toFixed(1) || '0'}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* График платежей */}
                {payments.length > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">График платежей</h4>
                      {!isEditingPayments ? (
                        <button
                          onClick={() => startEditingPayments(block)}
                          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          Редактировать
                        </button>
                      ) : (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => autoFillPayments(block)}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                            title="Автозаполнить даты и суммы"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Автозаполнить
                          </button>
                          <button
                            onClick={() => addPayment(block)}
                            className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center"
                            title="Добавить платеж"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Добавить
                          </button>
                          <button
                            onClick={() => block.id && handleUpdatePayments(block.id)}
                            className="text-sm text-green-600 dark:text-green-400 hover:underline flex items-center"
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Сохранить
                          </button>
                          <button
                            onClick={() => block.id && cancelEditingPayments(block.id)}
                            className="text-sm text-gray-600 dark:text-gray-400 hover:underline flex items-center"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Отмена
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">№</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Дата</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Сумма</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Статус</th>
                            {isEditingPayments && (
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Действия</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {payments.map((payment) => {
                            // Показываем все платежи, не только первые 6
                            return (
                            <tr key={payment.n}>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{payment.n}</td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                                {isEditingPayments ? (
                                  <DatePicker
                                    value={payment.date ? format(new Date(payment.date), 'yyyy-MM-dd') : ''}
                                    onChange={(value) => {
                                      const updated = payments.map((p) =>
                                        p.n === payment.n ? { ...p, date: value || undefined } : p
                                      );
                                      setEditingPayments({ ...editingPayments, [block.id!]: updated });
                                    }}
                                    className="w-full"
                                    placeholder="дд.мм.гггг"
                                  />
                                ) : (
                                  payment.date ? format(new Date(payment.date), 'dd.MM.yyyy') : '-'
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                                {isEditingPayments ? (
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
                                    className="input text-xs py-1"
                                  />
                                ) : (
                                  payment.amount.toLocaleString('ru-RU', {
                                    style: 'currency',
                                    currency: 'RUB',
                                  })
                                )}
                              </td>
                              <td className="px-4 py-2">
                                {isEditingPayments ? (
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
                                ) : payment.ok ? (
                                  <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                                    Оплачено
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full">
                                    Ожидает
                                  </span>
                                )}
                              </td>
                              {isEditingPayments && (
                                <td className="px-4 py-2">
                                  <button
                                    onClick={() => removePayment(block, payment.n)}
                                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                                    title="Удалить платеж"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Confirm Dialog */}
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

      {/* Add/Edit Block Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              {editingBlock ? 'Редактировать кредит' : 'Новый кредит'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название</label>
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
                  className="input"
                  placeholder="Название кредита"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Общая сумма</label>
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
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ежемесячный платеж</label>
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
                    className="input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ставка (%)</label>
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
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">День платежа</label>
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
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Дата выдачи (начало начисления)
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
                  Следующий платёж
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Статус</label>
                <select
                  value={editingBlock?.status || newBlock.status || 'Активный'}
                  onChange={(e) => {
                    if (editingBlock) {
                      setEditingBlock({ ...editingBlock, status: e.target.value });
                    } else {
                      setNewBlock({ ...newBlock, status: e.target.value });
                    }
                  }}
                  className="input"
                >
                  <option value="Активный">Активный</option>
                  <option value="Просрочен">Просрочен</option>
                  <option value="Закрыт">Закрыт</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Заметки</label>
                <textarea
                  value={editingBlock?.notes || newBlock.notes || ''}
                  onChange={(e) => {
                    if (editingBlock) {
                      setEditingBlock({ ...editingBlock, notes: e.target.value });
                    } else {
                      setNewBlock({ ...newBlock, notes: e.target.value });
                    }
                  }}
                  className="input"
                  rows={3}
                  placeholder="Комментарий..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowBlockModal(false);
                  setEditingBlock(null);
                  resetBlockForm();
                }}
                className="btn btn-secondary"
              >
                Отмена
              </button>
              <button
                onClick={editingBlock ? handleUpdateBlock : handleCreateBlock}
                className="btn btn-primary"
              >
                {editingBlock ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ObligationsPage;

