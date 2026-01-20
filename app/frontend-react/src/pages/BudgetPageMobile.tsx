import { useState, useEffect } from 'react';
import { BootstrapIcon } from '../components/BootstrapIcon';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { budgetService } from '../services/budgetService';
import {
  BudgetAccount,
  BudgetCategory,
  BudgetTransaction,
  MonthSummary,
  Charts,
  BudgetObligation,
} from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { IncomeExpenseCharts } from '../components/Charts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MonthYearPicker } from '../components/MonthYearPicker';

const BudgetPageMobile = () => {
  const [accounts, setAccounts] = useState<BudgetAccount[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [charts, setCharts] = useState<Charts | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'transactions'>('summary');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [newTransaction, setNewTransaction] = useState({
    type: 'expense' as 'income' | 'expense' | 'transfer',
    account_id: 0,
    contra_account_id: 0,
    category_id: 0,
    amount: 0,
    currency: 'RUB',
    occurred_at: format(new Date(), 'yyyy-MM-dd'),
    description: '',
  });

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const dateFrom = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const dateTo = `${year}-${month}-${lastDay}`;

      const [accountsData, categoriesData, transactionsData, summaryData, chartsData] = await Promise.all([
        budgetService.getAccounts(),
        budgetService.getCategories(),
        budgetService.getTransactions({ date_from: dateFrom, date_to: dateTo }),
        budgetService.getMonthSummary(dateFrom, dateTo),
        budgetService.getCharts(dateFrom, dateTo),
      ]);

      setAccounts(accountsData);
      setCategories(categoriesData);
      setTransactions(transactionsData);
      setSummary(summaryData);
      setCharts(chartsData);
      if (accountsData.length > 0 && !newTransaction.account_id) {
        setNewTransaction({ ...newTransaction, account_id: accountsData[0].id });
      }
    } catch (error) {
      // Ошибка обработана в interceptor
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = (transactionId: number) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    setConfirmDialog({
      isOpen: true,
      title: 'Удаление транзакции',
      message: `Вы уверены, что хотите удалить транзакцию на сумму ${transaction?.amount.toLocaleString('ru-RU', { style: 'currency', currency: transaction?.currency || 'RUB' })}?`,
      onConfirm: async () => {
        try {
          await budgetService.deleteTransaction(transactionId);
          setTransactions(transactions.filter((t) => t.id !== transactionId));
          await loadData();
          toast.success('Транзакция удалена');
        } catch (error) {
          // Ошибка обработана в interceptor
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleCreateTransaction = async () => {
    if (!newTransaction.account_id || !newTransaction.amount) {
      toast.error('Заполните обязательные поля');
      return;
    }

    try {
      await budgetService.createTransaction(newTransaction);
      setNewTransaction({
        type: 'expense',
        account_id: accounts[0]?.id || 0,
        contra_account_id: 0,
        category_id: 0,
        amount: 0,
        currency: 'RUB',
        occurred_at: format(new Date(), 'yyyy-MM-dd'),
        description: '',
      });
      setShowAddModal(false);
      await loadData();
      toast.success('Транзакция создана');
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const incomeCategories = categories.filter((c) => c.kind === 'income' && c.is_active);
  const expenseCategories = categories.filter((c) => c.kind === 'expense' && c.is_active);

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Бюджет</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-primary-600 text-white rounded-lg active:bg-primary-700"
        >
          <BootstrapIcon name="plus-lg" size={20} />
        </button>
      </div>

      {/* Month Selector */}
      <div className="flex items-center space-x-2 mb-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Период:</label>
        <MonthYearPicker value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-1 py-3 text-center font-medium border-b-2 transition-colors ${
            activeTab === 'summary'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400'
          }`}
        >
          Сводка
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex-1 py-3 text-center font-medium border-b-2 transition-colors ${
            activeTab === 'transactions'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400'
          }`}
        >
          Транзакции
        </button>
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Загрузка...</div>
          ) : summary ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Доходы</div>
                  <div className="text-xl font-bold text-green-600">
                    {summary.income_total.toLocaleString('ru-RU', {
                      style: 'currency',
                      currency: 'RUB',
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Расходы</div>
                  <div className="text-xl font-bold text-red-600">
                    {summary.expense_total.toLocaleString('ru-RU', {
                      style: 'currency',
                      currency: 'RUB',
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Баланс</div>
                  <div className={`text-xl font-bold ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summary.balance.toLocaleString('ru-RU', {
                      style: 'currency',
                      currency: 'RUB',
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Сбережения</div>
                  <div className="text-xl font-bold text-blue-600">
                    {summary.savings.toLocaleString('ru-RU', {
                      style: 'currency',
                      currency: 'RUB',
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
              </div>

              {/* Charts */}
              {charts && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                  <IncomeExpenseCharts charts={charts} />
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Нет данных</div>
          )}
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Загрузка...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Транзакций пока нет</div>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow flex justify-between items-center"
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${
                      tx.type === 'income' ? 'text-green-600' : tx.type === 'expense' ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '→'}
                      {tx.amount.toLocaleString('ru-RU', {
                        style: 'currency',
                        currency: tx.currency,
                      })}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(tx.occurred_at), 'dd.MM.yyyy')}
                    </span>
                  </div>
                  {tx.description && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">{tx.description}</div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {categories.find((c) => c.id === tx.category_id)?.name || '-'}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteTransaction(tx.id)}
                  className="ml-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20 rounded-lg"
                >
                  <BootstrapIcon name="trash" size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-xl p-4 pb-safe-bottom max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Новая транзакция</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-700 rounded-lg"
              >
                <BootstrapIcon name="x-lg" size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Тип
                </label>
                <select
                  value={newTransaction.type}
                  onChange={(e) => setNewTransaction({ ...newTransaction, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="expense">Расход</option>
                  <option value="income">Доход</option>
                  <option value="transfer">Перевод</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Счет
                </label>
                <select
                  value={newTransaction.account_id}
                  onChange={(e) => setNewTransaction({ ...newTransaction, account_id: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.title}
                    </option>
                  ))}
                </select>
              </div>

              {newTransaction.type !== 'transfer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Категория
                  </label>
                  <select
                    value={newTransaction.category_id}
                    onChange={(e) => setNewTransaction({ ...newTransaction, category_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value={0}>Выберите категорию</option>
                    {(newTransaction.type === 'income' ? incomeCategories : expenseCategories).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Сумма
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newTransaction.amount || ''}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Дата
                </label>
                <input
                  type="date"
                  value={newTransaction.occurred_at}
                  onChange={(e) => setNewTransaction({ ...newTransaction, occurred_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Описание
                </label>
                <input
                  type="text"
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Описание (необязательно)"
                />
              </div>

              <div className="flex space-x-3 pt-4 pb-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 min-h-[44px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 active:bg-gray-50 dark:active:bg-gray-700"
                >
                  Отмена
                </button>
                <button
                  onClick={handleCreateTransaction}
                  className="flex-1 min-h-[44px] px-4 py-2 bg-primary-600 text-white rounded-lg active:bg-primary-700"
                >
                  Создать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

export default BudgetPageMobile;

