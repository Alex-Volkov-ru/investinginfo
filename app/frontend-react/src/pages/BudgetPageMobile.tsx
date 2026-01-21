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
  YearSummary,
} from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { IncomeExpenseCharts } from '../components/Charts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MonthYearPicker } from '../components/MonthYearPicker';
import { DatePicker } from '../components/DatePicker';
import { YearPicker } from '../components/YearPicker';
import { YearDashboard } from '../components/YearDashboard';

const BudgetPageMobile = () => {
  const [accounts, setAccounts] = useState<BudgetAccount[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [charts, setCharts] = useState<Charts | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'transactions' | 'accounts' | 'categories' | 'obligations' | 'year'>('summary');
  const [obligations, setObligations] = useState<BudgetObligation[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearSummary, setYearSummary] = useState<YearSummary | null>(null);
  const [yearLoading, setYearLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [newAccount, setNewAccount] = useState({ title: '', currency: 'RUB', is_savings: false });
  const [newCategory, setNewCategory] = useState({ kind: 'expense' as 'income' | 'expense', name: '', monthly_limit: null as number | null });
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
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
  const [newObligation, setNewObligation] = useState({
    title: '',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    amount: 0,
    currency: 'RUB',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 10;

  // Сбрасываем страницу при изменении месяца
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth]);

  useEffect(() => {
    if (activeTab === 'year') {
      loadYearData();
    } else {
      loadData();
    }
  }, [selectedMonth, selectedYear, activeTab]);

  const loadYearData = async () => {
    setYearLoading(true);
    try {
      const data = await budgetService.getYearSummary(selectedYear);
      setYearSummary(data);
    } catch (error) {
      // Ошибка обработана в interceptor
    } finally {
      setYearLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const dateFrom = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const dateTo = `${year}-${month}-${lastDay}`;

      const [accountsData, categoriesData, transactionsData, summaryData, chartsData, obligationsData] = await Promise.all([
        budgetService.getAccounts(),
        budgetService.getCategories(),
        budgetService.getTransactions({ date_from: dateFrom, date_to: dateTo }),
        budgetService.getMonthSummary(dateFrom, dateTo),
        budgetService.getCharts(dateFrom, dateTo),
        budgetService.getObligations(selectedMonth),
      ]);

      setAccounts(accountsData);
      setCategories(categoriesData);
      setTransactions(transactionsData);
      setSummary(summaryData);
      setCharts(chartsData);
      setObligations(obligationsData);
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

  const handleCreateAccount = async () => {
    if (!newAccount.title.trim()) {
      toast.error('Введите название счета');
      return;
    }

    try {
      const account = await budgetService.createAccount(newAccount);
      setAccounts([...accounts, account]);
      setNewAccount({ title: '', currency: 'RUB', is_savings: false });
      setShowAccountModal(false);
      toast.success('Счет создан');
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const handleDeleteAccount = (accountId: number) => {
    const account = accounts.find((a) => a.id === accountId);
    setConfirmDialog({
      isOpen: true,
      title: 'Удаление счета',
      message: `Вы уверены, что хотите удалить счет "${account?.title}"?`,
      onConfirm: async () => {
        try {
          await budgetService.deleteAccount(accountId);
          setAccounts(accounts.filter((a) => a.id !== accountId));
          toast.success('Счет удален');
          await loadData();
        } catch (error) {
          // Ошибка обработана в interceptor
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) {
      toast.error('Введите название категории');
      return;
    }

    try {
      const category = await budgetService.createCategory(newCategory);
      setCategories([...categories, category]);
      setNewCategory({ kind: 'expense', name: '', monthly_limit: null });
      setShowCategoryModal(false);
      toast.success('Категория создана');
      await loadData();
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    if (!editingCategory.name.trim()) {
      toast.error('Введите название категории');
      return;
    }

    try {
      const updated = await budgetService.updateCategory(editingCategory.id, {
        name: editingCategory.name,
        monthly_limit: editingCategory.monthly_limit,
      });
      setCategories(categories.map(cat => cat.id === updated.id ? updated : cat));
      setEditingCategory(null);
      toast.success('Категория обновлена');
      await loadData();
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const handleDeleteCategory = (categoryId: number) => {
    const category = categories.find((c) => c.id === categoryId);
    setConfirmDialog({
      isOpen: true,
      title: 'Удаление категории',
      message: `Вы уверены, что хотите удалить категорию "${category?.name}"?`,
      onConfirm: async () => {
        try {
          await budgetService.deleteCategory(categoryId);
          setCategories(categories.filter((c) => c.id !== categoryId));
          toast.success('Категория удалена');
          await loadData();
        } catch (error) {
          // Ошибка обработана в interceptor
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleCreateObligation = async () => {
    if (!newObligation.title.trim() || !newObligation.amount) {
      toast.error('Заполните название и сумму');
      return;
    }

    try {
      const obligation = await budgetService.createObligation(newObligation);
      setObligations([...obligations, obligation]);
      setNewObligation({
        title: '',
        due_date: format(new Date(), 'yyyy-MM-dd'),
        amount: 0,
        currency: 'RUB',
      });
      toast.success('Обязательный платеж добавлен');
      await loadData();
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const handleUpdateObligation = async (obligationId: number, isDone: boolean) => {
    try {
      const updated = await budgetService.updateObligation(obligationId, { is_done: isDone });
      setObligations(obligations.map((o) => (o.id === updated.id ? updated : o)));
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const handleDeleteObligation = (obligationId: number) => {
    const obligation = obligations.find((o) => o.id === obligationId);
    setConfirmDialog({
      isOpen: true,
      title: 'Удаление платежа',
      message: `Вы уверены, что хотите удалить "${obligation?.title}"?`,
      onConfirm: async () => {
        try {
          await budgetService.deleteObligation(obligationId);
          setObligations(obligations.filter((o) => o.id !== obligationId));
          toast.success('Платеж удален');
        } catch (error) {
          // Ошибка обработана в interceptor
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const incomeCategories = categories.filter((c) => c.kind === 'income' && c.is_active);
  const expenseCategories = categories.filter((c) => c.kind === 'expense' && c.is_active);

  // Вычисляем суммы расходов по категориям за месяц
  const categoryExpenses = transactions
    .filter(tx => tx.type === 'expense' && tx.category_id)
    .reduce((acc, tx) => {
      const catId = tx.category_id!;
      acc[catId] = (acc[catId] || 0) + tx.amount;
      return acc;
    }, {} as Record<number, number>);

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
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-shrink-0 px-3 py-3 text-center text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'summary'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400'
          }`}
        >
          Сводка
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex-shrink-0 px-3 py-3 text-center text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'transactions'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400'
          }`}
        >
          Транзакции
        </button>
        <button
          onClick={() => setActiveTab('obligations')}
          className={`flex-shrink-0 px-3 py-3 text-center text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'obligations'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400'
          }`}
        >
          Платежи
        </button>
        <button
          onClick={() => setActiveTab('year')}
          className={`flex-shrink-0 px-3 py-3 text-center text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'year'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400'
          }`}
        >
          Год
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex-shrink-0 px-3 py-3 text-center text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'accounts'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400'
          }`}
        >
          Счета
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex-shrink-0 px-3 py-3 text-center text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'categories'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400'
          }`}
        >
          Категории
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
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">
                    {summary.income_total.toLocaleString('ru-RU', {
                      style: 'currency',
                      currency: 'RUB',
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Расходы</div>
                  <div className="text-xl font-bold text-red-600 dark:text-red-400">
                    {summary.expense_total.toLocaleString('ru-RU', {
                      style: 'currency',
                      currency: 'RUB',
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Баланс</div>
                  <div className={`text-xl font-bold ${summary.net_total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {summary.net_total.toLocaleString('ru-RU', {
                      style: 'currency',
                      currency: 'RUB',
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Сбережения</div>
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
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
                  <IncomeExpenseCharts 
                    incomeData={charts.income_by_category}
                    expenseData={charts.expense_by_category}
                  />
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
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Загрузка...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Транзакций пока нет</div>
          ) : (() => {
            const totalPages = Math.ceil(transactions.length / transactionsPerPage);
            const startIndex = (currentPage - 1) * transactionsPerPage;
            const endIndex = startIndex + transactionsPerPage;
            const paginatedTransactions = transactions.slice(startIndex, endIndex);

            return (
              <>
            {paginatedTransactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 shadow"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold ${
                        tx.type === 'income' ? 'text-green-600 dark:text-green-400' : tx.type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                      }`}>
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '→'}
                        {tx.amount.toLocaleString('ru-RU', {
                          style: 'currency',
                          currency: tx.currency,
                        })}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-100 whitespace-nowrap flex-shrink-0">
                        {format(new Date(tx.occurred_at), 'dd.MM.yyyy')}
                      </span>
                    </div>
                    {tx.description && (
                      <div className="text-xs text-gray-900 dark:text-gray-100 truncate mt-0.5">
                        {tx.description}
                      </div>
                    )}
                    {/* Прогресс-бар лимита для расходов */}
                    {tx.type === 'expense' && tx.category_id && (() => {
                      const category = categories.find(c => c.id === tx.category_id);
                      if (!category?.monthly_limit) return null;
                      
                      const spent = categoryExpenses[category.id] || 0;
                      const limit = category.monthly_limit;
                      const percent = (spent / limit) * 100;
                      const isOverLimit = spent > limit;
                      const isNearLimit = percent >= 80 && percent <= 100;
                      
                      return (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-600 dark:text-gray-400">{category.name}</span>
                            <span className={`text-xs font-medium ${
                              isOverLimit ? 'text-red-600 dark:text-red-400' : isNearLimit ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              {percent.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                isOverLimit
                                  ? 'bg-red-500'
                                  : isNearLimit
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => handleDeleteTransaction(tx.id)}
                    className="flex-shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20 rounded-lg"
                  >
                    <BootstrapIcon name="trash" size={16} />
                  </button>
                </div>
              </div>
            ))}
            
            {/* Пагинация для мобильной версии */}
            {totalPages > 1 && (
              <div className="mt-4 flex flex-col items-center space-y-3">
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Страница {currentPage} из {totalPages}
                </div>
                <div className="flex items-center space-x-2 w-full">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg active:bg-gray-50 dark:active:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center"
                  >
                    <BootstrapIcon name="chevron-left" size={16} className="mr-1" />
                    Назад
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg active:bg-gray-50 dark:active:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center"
                  >
                    Вперед
                    <BootstrapIcon name="chevron-right" size={16} className="ml-1" />
                  </button>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Показано {startIndex + 1}-{Math.min(endIndex, transactions.length)} из {transactions.length}
                </div>
              </div>
            )}
            </>
            );
          })()}
        </div>
      )}

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Счета</h2>
            <button
              onClick={() => setShowAccountModal(true)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-primary-600 text-white rounded-lg active:bg-primary-700"
            >
              <BootstrapIcon name="plus-lg" size={20} />
            </button>
          </div>
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Счетов пока нет. Создайте первый счет.
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{account.title}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {account.currency} {account.is_savings && '(Сбережения)'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteAccount(account.id)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20 rounded-lg"
                  >
                    <BootstrapIcon name="trash" size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Категории</h2>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-primary-600 text-white rounded-lg active:bg-primary-700"
            >
              <BootstrapIcon name="plus-lg" size={20} />
            </button>
          </div>
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <h3 className="text-md font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Категории доходов ({incomeCategories.length})
              </h3>
              {incomeCategories.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Нет категорий доходов</p>
              ) : (
                <div className="space-y-2">
                  {incomeCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between py-2 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">{cat.name}</span>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="min-w-[32px] min-h-[32px] flex items-center justify-center text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20 rounded"
                      >
                        <BootstrapIcon name="trash" size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <h3 className="text-md font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Категории расходов ({expenseCategories.length})
              </h3>
              {expenseCategories.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Нет категорий расходов</p>
              ) : (
                <div className="space-y-2">
                  {expenseCategories.map((cat) => {
                    const spent = categoryExpenses[cat.id] || 0;
                    const limit = cat.monthly_limit;
                    const percent = limit ? (spent / limit) * 100 : 0;
                    const isOverLimit = limit && spent > limit;
                    const isNearLimit = limit && percent >= 80 && percent <= 100;
                    
                    return (
                      <div
                        key={cat.id}
                        className="py-2 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{cat.name}</span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setEditingCategory(cat)}
                              className="min-w-[32px] min-h-[32px] flex items-center justify-center text-blue-600 dark:text-blue-400 active:bg-blue-50 dark:active:bg-blue-900/20 rounded"
                              title="Редактировать категорию"
                            >
                              <BootstrapIcon name="pencil" size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="min-w-[32px] min-h-[32px] flex items-center justify-center text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20 rounded"
                            >
                              <BootstrapIcon name="trash" size={16} />
                            </button>
                          </div>
                        </div>
                        {limit && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className={`${isOverLimit ? 'text-red-600 dark:text-red-400' : isNearLimit ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                Потрачено: {spent.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })} / {limit.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                              </span>
                              <span className={`font-medium ${isOverLimit ? 'text-red-600 dark:text-red-400' : isNearLimit ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                {percent.toFixed(0)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  isOverLimit
                                    ? 'bg-red-500'
                                    : isNearLimit
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(percent, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {!limit && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Лимит не установлен
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Obligations Tab */}
      {activeTab === 'obligations' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Обязательные платежи</h2>
          </div>
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Загрузка...</div>
          ) : obligations.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Обязательных платежей пока нет</div>
          ) : (
            <div className="space-y-3">
              {obligations.map((obligation) => {
                const dueDate = new Date(obligation.due_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                dueDate.setHours(0, 0, 0, 0);
                const isOverdue = !obligation.is_done && dueDate < today;
                const isDone = obligation.is_done;
                return (
                  <div
                    key={obligation.id}
                    className={`bg-white dark:bg-gray-800 rounded-lg p-4 shadow ${
                      isDone ? 'bg-green-50 dark:bg-green-900/20' : isOverdue ? 'bg-red-50 dark:bg-red-900/20' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{obligation.title}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {format(new Date(obligation.due_date), 'dd.MM.yyyy')}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={obligation.is_done}
                            onChange={(e) => handleUpdateObligation(obligation.id, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className={`w-11 h-6 rounded-full peer transition-colors ${
                            isDone
                              ? 'bg-green-500 peer-checked:bg-green-600'
                              : isOverdue
                              ? 'bg-red-500 peer-checked:bg-red-600'
                              : 'bg-gray-200 dark:bg-gray-700 peer-checked:bg-primary-600'
                          } peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600`}></div>
                        </label>
                        <button
                          onClick={() => handleDeleteObligation(obligation.id)}
                          className="min-w-[32px] min-h-[32px] flex items-center justify-center text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20 rounded"
                        >
                          <BootstrapIcon name="trash" size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {obligation.amount.toLocaleString('ru-RU', {
                        style: 'currency',
                        currency: obligation.currency,
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название</label>
                <input
                  type="text"
                  value={newObligation.title}
                  onChange={(e) => setNewObligation({ ...newObligation, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Напр. Кредит"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Дата</label>
                  <DatePicker
                    value={newObligation.due_date}
                    onChange={(value) => setNewObligation({ ...newObligation, due_date: value })}
                    placeholder="дд.мм.гггг"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Сумма</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newObligation.amount || ''}
                    onChange={(e) => setNewObligation({ ...newObligation, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateObligation}
                className="w-full min-h-[44px] px-4 py-2 bg-primary-600 text-white rounded-lg active:bg-primary-700"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Year Tab */}
      {activeTab === 'year' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Годовой обзор</h2>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Год:</label>
              <YearPicker value={selectedYear} onChange={setSelectedYear} />
            </div>
          </div>
          {yearLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Загрузка...</div>
          ) : yearSummary ? (
            <YearDashboard
              data={yearSummary}
              onCategoryClick={(category, type) => {
                toast.success(`Категория: ${category} (${type === 'income' ? 'Доходы' : 'Расходы'})`);
              }}
              onMonthClick={(month) => {
                const yearStr = selectedYear.toString();
                const monthStr = month.toString().padStart(2, '0');
                setSelectedMonth(`${yearStr}-${monthStr}`);
                setActiveTab('transactions');
              }}
            />
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Нет данных за выбранный год</div>
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

      {/* Add Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-xl p-4 pb-safe-bottom">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Новый счет</h3>
              <button
                onClick={() => setShowAccountModal(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-700 rounded-lg"
              >
                <BootstrapIcon name="x-lg" size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название</label>
                <input
                  type="text"
                  value={newAccount.title}
                  onChange={(e) => setNewAccount({ ...newAccount, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Название счета"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Валюта</label>
                <select
                  value={newAccount.currency}
                  onChange={(e) => setNewAccount({ ...newAccount, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="RUB">RUB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_savings"
                  checked={newAccount.is_savings}
                  onChange={(e) => setNewAccount({ ...newAccount, is_savings: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="is_savings" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Сберегательный счет
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAccountModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg active:bg-gray-300 dark:active:bg-gray-600 min-h-[44px]"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateAccount}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg active:bg-primary-700 min-h-[44px]"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-xl p-4 pb-safe-bottom">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Новая категория</h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-700 rounded-lg"
              >
                <BootstrapIcon name="x-lg" size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Тип</label>
                <select
                  value={newCategory.kind}
                  onChange={(e) => setNewCategory({ ...newCategory, kind: e.target.value as 'income' | 'expense' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="income">Доход</option>
                  <option value="expense">Расход</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Название категории"
                />
              </div>
              {newCategory.kind === 'expense' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Лимит на месяц (руб.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newCategory.monthly_limit || ''}
                    onChange={(e) => setNewCategory({ ...newCategory, monthly_limit: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Не установлен"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Оставьте пустым, если лимит не нужен
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg active:bg-gray-300 dark:active:bg-gray-600 min-h-[44px]"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateCategory}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg active:bg-primary-700 min-h-[44px]"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-xl p-4 pb-safe-bottom">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Редактировать категорию</h3>
              <button
                onClick={() => setEditingCategory(null)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-700 rounded-lg"
              >
                <BootstrapIcon name="x-lg" size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название</label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Название категории"
                />
              </div>
              {editingCategory.kind === 'expense' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Лимит на месяц (руб.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingCategory.monthly_limit || ''}
                    onChange={(e) => setEditingCategory({ ...editingCategory, monthly_limit: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Не установлен"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Оставьте пустым, если лимит не нужен
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditingCategory(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg active:bg-gray-300 dark:active:bg-gray-600 min-h-[44px]"
              >
                Отмена
              </button>
              <button
                onClick={handleUpdateCategory}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg active:bg-primary-700 min-h-[44px]"
              >
                Сохранить
              </button>
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

