import { useState, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Trash2 } from 'lucide-react';
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

const BudgetPage = () => {
  const [accounts, setAccounts] = useState<BudgetAccount[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [charts, setCharts] = useState<Charts | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'transactions' | 'summary' | 'accounts' | 'categories' | 'obligations' | 'year'>('summary');
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
  const [newCategory, setNewCategory] = useState({ kind: 'expense' as 'income' | 'expense', name: '' });
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
      // Вычисляем даты для выбранного месяца
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
    } catch (error) {
      // Ошибка обработана в interceptor
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'year') {
      loadYearData();
    } else {
      loadData();
    }
  }, [selectedMonth, selectedYear, activeTab]);


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

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) {
      toast.error('Введите название категории');
      return;
    }

    try {
      const category = await budgetService.createCategory(newCategory);
      setCategories([...categories, category]);
      setNewCategory({ kind: 'expense', name: '' });
      setShowCategoryModal(false);
      toast.success('Категория создана');
      loadData(); // Перезагружаем данные для обновления графиков
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
          loadData(); // Перезагружаем данные для обновления графиков
        } catch (error) {
          // Ошибка обработана в interceptor
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleDeleteTransaction = (transactionId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Удаление транзакции',
      message: 'Вы уверены, что хотите удалить эту транзакцию?',
      onConfirm: async () => {
        try {
          await budgetService.deleteTransaction(transactionId);
          setTransactions(transactions.filter((t) => t.id !== transactionId));
          toast.success('Транзакция удалена');
          loadData(); // Перезагружаем данные для обновления сводок
        } catch (error) {
          // Ошибка обработана в interceptor
        } finally {
          setConfirmDialog(null);
        }
      },
    });
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
          loadData(); // Перезагружаем данные
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
      const transaction = await budgetService.createTransaction(newTransaction);
      setTransactions([transaction, ...transactions]);
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
      await loadData(); // Перезагружаем для обновления summary
      toast.success('Транзакция создана');
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const incomeCategories = categories.filter((c) => c.kind === 'income' && c.is_active);
  const expenseCategories = categories.filter((c) => c.kind === 'expense' && c.is_active);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Бюджет</h1>
        <div className="flex items-center space-x-4">
          {/* Month/Year Selector */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Период:</label>
            <MonthYearPicker
              value={selectedMonth}
              onChange={setSelectedMonth}
            />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowAccountModal(true)}
              className="btn btn-secondary flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Счет
            </button>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="btn btn-secondary flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Категория
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Транзакция
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'summary', label: 'Сводка' },
            { id: 'transactions', label: 'Транзакции' },
            { id: 'obligations', label: 'Обязательные платежи' },
            { id: 'year', label: 'Годовой обзор' },
            { id: 'accounts', label: 'Счета' },
            { id: 'categories', label: 'Категории' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Сводка</strong> — показывает общую статистику по выбранному месяцу: общие доходы, расходы, баланс и сбережения. 
              Также отображаются графики распределения доходов и расходов по категориям для визуального анализа структуры бюджета.
            </p>
          </div>
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Доходы</div>
                    <div className="text-2xl font-bold text-green-600 mt-1">
                      {summary.income_total.toLocaleString('ru-RU', {
                        style: 'currency',
                        currency: 'RUB',
                      })}
                    </div>
                  </div>
                  <ArrowUpCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Расходы</div>
                    <div className="text-2xl font-bold text-red-600 mt-1">
                      {summary.expense_total.toLocaleString('ru-RU', {
                        style: 'currency',
                        currency: 'RUB',
                      })}
                    </div>
                  </div>
                  <ArrowDownCircle className="h-8 w-8 text-red-600" />
                </div>
              </div>
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Баланс</div>
                    <div className={`text-2xl font-bold mt-1 ${
                      summary.net_total >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {summary.net_total.toLocaleString('ru-RU', {
                        style: 'currency',
                        currency: 'RUB',
                      })}
                    </div>
                  </div>
                  {summary.net_total >= 0 ? (
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-red-600" />
                  )}
                </div>
              </div>
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Сбережения</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {summary.savings.toLocaleString('ru-RU', {
                        style: 'currency',
                        currency: 'RUB',
                      })}
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Пополняйте через переводы со счета на счет сбережений
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {charts && (
            <IncomeExpenseCharts
              incomeData={charts.income_by_category}
              expenseData={charts.expense_by_category}
            />
          )}
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Транзакции</strong> — список всех финансовых операций за выбранный месяц. 
              Позволяет просматривать доходы, расходы и переводы между счетами с указанием категорий, сумм и дат. 
              Можно добавлять новые транзакции и удалять существующие.
            </p>
          </div>
          <div className="card">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Транзакции</h2>
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Загрузка...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Транзакций пока нет</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Дата</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Тип</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Сумма</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Описание</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Действия</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {format(new Date(tx.occurred_at), 'dd.MM.yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            tx.type === 'income'
                              ? 'bg-green-100 text-green-800'
                              : tx.type === 'expense'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {tx.type === 'income' ? 'Доход' : tx.type === 'expense' ? 'Расход' : 'Перевод'}
                        </span>
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                          tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        {tx.amount.toLocaleString('ru-RU', {
                          style: 'currency',
                          currency: tx.currency,
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{tx.description || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-600"
                          title="Удалить транзакцию"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Счета</strong> — управление вашими финансовыми счетами (банковские карты, наличные, сберегательные счета и т.д.). 
              Позволяет создавать новые счета, указывать валюту и отмечать счета как сберегательные. 
              Все транзакции привязываются к конкретным счетам для точного учета средств.
            </p>
          </div>
          <div className="card">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Счета</h2>
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Счетов пока нет. Создайте первый счет.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 relative"
                >
                  <button
                    onClick={() => handleDeleteAccount(account.id)}
                    className="absolute top-2 right-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-600"
                    title="Удалить счет"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{account.title}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {account.currency} {account.is_savings && '(Сбережения)'}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {/* Obligations Tab */}
      {activeTab === 'obligations' && (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Обязательные платежи</strong> — управление регулярными обязательными платежами (кредиты, коммунальные услуги, подписки и т.д.). 
              Позволяет отслеживать сроки платежей, отмечать выполненные обязательства и видеть общую сумму обязательств за период.
            </p>
          </div>
          {/* Form for adding obligation */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Обязательные платежи</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Название
                </label>
                <input
                  type="text"
                  value={newObligation.title}
                  onChange={(e) => setNewObligation({ ...newObligation, title: e.target.value })}
                  className="input"
                  placeholder="Напр. Кредит"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Дата
                </label>
                <DatePicker
                  value={newObligation.due_date}
                  onChange={(value) => setNewObligation({ ...newObligation, due_date: value })}
                  placeholder="дд.мм.гггг"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Сумма
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newObligation.amount || ''}
                  onChange={(e) =>
                    setNewObligation({ ...newObligation, amount: parseFloat(e.target.value) || 0 })
                  }
                  className="input"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Валюта
                </label>
                <input
                  type="text"
                  value={newObligation.currency}
                  onChange={(e) => setNewObligation({ ...newObligation, currency: e.target.value.toUpperCase() })}
                  className="input"
                  maxLength={3}
                />
              </div>
            </div>
            <button
              onClick={async () => {
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
                } catch (error) {
                  // Ошибка обработана в interceptor
                }
              }}
              className="btn btn-primary mt-4"
            >
              Добавить
            </button>
          </div>

          {/* Obligations Table */}
          <div className="card">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Дата
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Название
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Сумма
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Готово
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {obligations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        Обязательных платежей пока нет
                      </td>
                    </tr>
                  ) : (
                    obligations.map((obligation) => {
                      const dueDate = new Date(obligation.due_date);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      dueDate.setHours(0, 0, 0, 0);
                      const isOverdue = !obligation.is_done && dueDate < today;
                      const isDone = obligation.is_done;

                      // Определяем цвет строки
                      let rowClass = 'hover:bg-gray-50 dark:hover:bg-gray-700';
                      let textClass = 'text-gray-900 dark:text-gray-100';
                      if (isDone) {
                        rowClass = 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30';
                        textClass = 'text-green-900 dark:text-green-100';
                      } else if (isOverdue) {
                        rowClass = 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30';
                        textClass = 'text-red-900 dark:text-red-100';
                      }

                      return (
                        <tr key={obligation.id} className={rowClass}>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm ${textClass}`}>
                            {format(new Date(obligation.due_date), 'dd.MM.yyyy')}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm ${textClass}`}>
                            {obligation.title}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm ${textClass}`}>
                            {obligation.amount.toLocaleString('ru-RU', {
                              style: 'currency',
                              currency: obligation.currency,
                            })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={obligation.is_done}
                                onChange={async (e) => {
                                  try {
                                    const updated = await budgetService.updateObligation(obligation.id, {
                                      is_done: e.target.checked,
                                    });
                                    setObligations(
                                      obligations.map((o) => (o.id === updated.id ? updated : o))
                                    );
                                  } catch (error) {
                                    // Ошибка обработана в interceptor
                                  }
                                }}
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
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <button
                              onClick={() => {
                                setConfirmDialog({
                                  isOpen: true,
                                  title: 'Удаление платежа',
                                  message: `Вы уверены, что хотите удалить "${obligation.title}"?`,
                                  onConfirm: async () => {
                                    try {
                                      await budgetService.deleteObligation(obligation.id);
                                      setObligations(obligations.filter((o) => o.id !== obligation.id));
                                      setConfirmDialog(null);
                                      toast.success('Платеж удален');
                                    } catch (error) {
                                      // Ошибка обработана в interceptor
                                    }
                                  },
                                });
                              }}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-600 flex items-center"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Удалить
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Итого за период: </span>
                          <span className="font-bold">
                            {obligations.reduce((sum, o) => sum + o.amount, 0).toLocaleString('ru-RU', {
                              style: 'currency',
                              currency: 'RUB',
                            })}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Осталось: </span>
                          <span className="font-bold">
                            {obligations
                              .filter((o) => !o.is_done)
                              .reduce((sum, o) => sum + o.amount, 0)
                              .toLocaleString('ru-RU', {
                                style: 'currency',
                                currency: 'RUB',
                              })}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Year Dashboard Tab */}
      {activeTab === 'year' && (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Годовой обзор</strong> — комплексная аналитика за выбранный год. 
              Показывает динамику доходов и расходов по месяцам, распределение по категориям, топ категорий, 
              статистику по сбережениям и балансу. Помогает анализировать финансовые тренды и планировать бюджет на следующий год.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Годовой обзор</h2>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Год:</label>
              <YearPicker
                value={selectedYear}
                onChange={setSelectedYear}
              />
            </div>
          </div>

          {yearLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Загрузка...</div>
          ) : yearSummary ? (
            <YearDashboard
              data={yearSummary}
              onCategoryClick={(category, type) => {
                // Переключаемся на вкладку транзакций с фильтром по категории
                // Можно добавить модальное окно с детализацией позже
                toast.success(`Категория: ${category} (${type === 'income' ? 'Доходы' : 'Расходы'})`);
              }}
              onMonthClick={(month) => {
                // Переключаемся на вкладку транзакций с выбранным месяцем
                const yearStr = selectedYear.toString();
                const monthStr = month.toString().padStart(2, '0');
                setSelectedMonth(`${yearStr}-${monthStr}`);
                setActiveTab('transactions');
              }}
            />
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Нет данных за выбранный год
            </div>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Категории</strong> — система классификации доходов и расходов. 
              Позволяет создавать категории для группировки транзакций (например, "Продукты", "Транспорт", "Зарплата"). 
              Категории используются для анализа структуры бюджета и построения графиков распределения средств.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Категории доходов ({incomeCategories.length})
            </h3>
            {incomeCategories.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Нет категорий доходов</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {incomeCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between py-2 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">{cat.name}</span>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-600 transition-colors"
                      title="Удалить категорию"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Категории расходов ({expenseCategories.length})
            </h3>
            {expenseCategories.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Нет категорий расходов</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {expenseCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between py-2 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">{cat.name}</span>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-600 transition-colors"
                      title="Удалить категорию"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Новая транзакция</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Тип
                </label>
                <select
                  value={newTransaction.type}
                  onChange={(e) => {
                    const newType = e.target.value as any;
                    setNewTransaction({
                      ...newTransaction,
                      type: newType,
                      contra_account_id: newType === 'transfer' ? newTransaction.contra_account_id : 0,
                      category_id: newType === 'transfer' ? 0 : newTransaction.category_id,
                    });
                  }}
                  className="input"
                >
                  <option value="income">Доход</option>
                  <option value="expense">Расход</option>
                  <option value="transfer">Перевод (для пополнения сбережений)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {newTransaction.type === 'transfer' ? 'Счет отправителя' : 'Счет'}
                </label>
                <select
                  value={newTransaction.account_id}
                  onChange={(e) =>
                    setNewTransaction({ ...newTransaction, account_id: parseInt(e.target.value) })
                  }
                  className="input"
                >
                  <option value={0}>Выберите счет</option>
                  {accounts
                    .filter((acc) => newTransaction.type !== 'transfer' || acc.id !== newTransaction.contra_account_id)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.title} {acc.is_savings && '(Сбережения)'}
                      </option>
                    ))}
                </select>
              </div>
              {newTransaction.type === 'transfer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Счет получателя
                  </label>
                  <select
                    value={newTransaction.contra_account_id}
                    onChange={(e) =>
                      setNewTransaction({
                        ...newTransaction,
                        contra_account_id: parseInt(e.target.value),
                      })
                    }
                    className="input"
                  >
                    <option value={0}>Выберите счет</option>
                    {accounts
                      .filter((acc) => acc.id !== newTransaction.account_id)
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.title} {acc.is_savings && '(Сбережения)'}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Для пополнения сбережений выберите счет сбережений как получателя
                  </p>
                </div>
              )}
              {newTransaction.type !== 'transfer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Категория
                  </label>
                  <select
                    value={newTransaction.category_id}
                    onChange={(e) =>
                      setNewTransaction({ ...newTransaction, category_id: parseInt(e.target.value) })
                    }
                    className="input"
                  >
                    <option value={0}>Выберите категорию</option>
                    {(newTransaction.type === 'income' ? incomeCategories : expenseCategories).map(
                      (cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      )
                    )}
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
                  onChange={(e) =>
                    setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) || 0 })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Дата</label>
                <DatePicker
                  value={newTransaction.occurred_at}
                  onChange={(value) =>
                    setNewTransaction({ ...newTransaction, occurred_at: value })
                  }
                  placeholder="дд.мм.гггг"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                <textarea
                  value={newTransaction.description}
                  onChange={(e) =>
                    setNewTransaction({ ...newTransaction, description: e.target.value })
                  }
                  className="input"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                Отмена
              </button>
              <button onClick={handleCreateTransaction} className="btn btn-primary">
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Новый счет</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <input
                  type="text"
                  value={newAccount.title}
                  onChange={(e) => setNewAccount({ ...newAccount, title: e.target.value })}
                  className="input"
                  placeholder="Название счета"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Валюта</label>
                <select
                  value={newAccount.currency}
                  onChange={(e) => setNewAccount({ ...newAccount, currency: e.target.value })}
                  className="input"
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
                <label htmlFor="is_savings" className="ml-2 block text-sm text-gray-700">
                  Сберегательный счет
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowAccountModal(false)} className="btn btn-secondary">
                Отмена
              </button>
              <button onClick={handleCreateAccount} className="btn btn-primary">
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Новая категория</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
                <select
                  value={newCategory.kind}
                  onChange={(e) =>
                    setNewCategory({ ...newCategory, kind: e.target.value as 'income' | 'expense' })
                  }
                  className="input"
                >
                  <option value="income">Доход</option>
                  <option value="expense">Расход</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="input"
                  placeholder="Название категории"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowCategoryModal(false)} className="btn btn-secondary">
                Отмена
              </button>
              <button onClick={handleCreateCategory} className="btn btn-primary">
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          confirmText="Удалить"
          cancelText="Отмена"
        />
      )}
    </div>
  );
};

export default BudgetPage;

