import React, { useState } from 'react';
import {
  Line,
  Bar,
  Doughnut,
} from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
} from 'chart.js';
import { useTheme } from '../contexts/ThemeContext';
import { YearSummary } from '../types';
import { BootstrapIcon } from './BootstrapIcon';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

interface YearDashboardProps {
  data: YearSummary;
  onCategoryClick?: (category: string, type: 'income' | 'expense') => void;
  onMonthClick?: (month: number) => void;
}

const monthNames = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
];

export const YearDashboard: React.FC<YearDashboardProps> = ({
  data,
  onCategoryClick,
  onMonthClick,
}) => {
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const getBorderColor = () => (theme === 'dark' ? '#1f2937' : '#ffffff');
  const getLabelColor = () => (theme === 'dark' ? '#d1d5db' : '#374151');
  const getGridColor = () => (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)');

  // Вычисляем средние значения
  const avgIncome = data.income_total / 12;
  const avgExpense = data.expense_total / 12;
  const avgNet = data.net_total / 12;
  const savingsRate = data.income_total > 0 ? (data.savings / data.income_total) * 100 : 0;

  // Находим лучший и худший месяцы
  const bestMonth = data.monthly_data.reduce((best, current) =>
    current.net > best.net ? current : best
  );
  const worstMonth = data.monthly_data.reduce((worst, current) =>
    current.net < worst.net ? current : worst
  );

  // График 1: Динамика доходов и расходов по месяцам (Line)
  const monthlyTrendData: ChartData<'line'> = {
    labels: data.monthly_data.map((m) => monthNames[m.month - 1]),
    datasets: [
      {
        label: 'Доходы',
        data: data.monthly_data.map((m) => m.income),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Расходы',
        data: data.monthly_data.map((m) => m.expense),
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const monthlyTrendOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { color: getLabelColor() },
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
        bodyColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        titleColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y;
            if (value === null || value === undefined) return '';
            return `${context.dataset.label}: ${value.toLocaleString('ru-RU', {
              style: 'currency',
              currency: 'RUB',
            })}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: getLabelColor(),
          callback: (value: number | string) => {
            return typeof value === 'number' ? value.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : String(value);
          },
        },
        grid: { color: getGridColor() },
      },
      x: {
        ticks: { color: getLabelColor() },
        grid: { display: false },
      },
    },
    onClick: (_event: any, elements: any) => {
      if (elements && elements.length > 0 && onMonthClick) {
        const index = elements[0].index;
        onMonthClick(data.monthly_data[index].month);
      }
    },
  };

  // График 2: Сравнение доходов и расходов по месяцам (Bar)
  const monthlyComparisonData: ChartData<'bar'> = {
    labels: data.monthly_data.map((m) => monthNames[m.month - 1]),
    datasets: [
      {
        label: 'Доходы',
        data: data.monthly_data.map((m) => m.income),
        backgroundColor: '#10B981',
        borderColor: '#059669',
        borderWidth: 1,
      },
      {
        label: 'Расходы',
        data: data.monthly_data.map((m) => m.expense),
        backgroundColor: '#EF4444',
        borderColor: '#DC2626',
        borderWidth: 1,
      },
    ],
  };

  const monthlyComparisonOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { color: getLabelColor() },
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
        bodyColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        titleColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y;
            if (value === null || value === undefined) return '';
            return `${context.dataset.label}: ${value.toLocaleString('ru-RU', {
              style: 'currency',
              currency: 'RUB',
            })}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: getLabelColor(),
          callback: (value: number | string) => {
            return typeof value === 'number' ? value.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : String(value);
          },
        },
        grid: { color: getGridColor() },
      },
      x: {
        ticks: { color: getLabelColor() },
        grid: { display: false },
      },
    },
    onClick: (_event: any, elements: any) => {
      if (elements && elements.length > 0 && onMonthClick) {
        const index = elements[0].index;
        onMonthClick(data.monthly_data[index].month);
      }
    },
  };

  // График 3: Доходы по категориям (Doughnut)
  const topIncomeCategories = data.income_by_category.slice(0, 10);
  const incomeColorsArray = [
    '#10B981', '#059669', '#047857', '#065F46', '#064E3B',
    '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5', '#ECFDF5',
  ];
  const incomeTotal = topIncomeCategories.reduce((sum, c) => sum + c.amount, 0);
  const incomeLegendItems = topIncomeCategories.map((c, index) => ({
    name: c.name,
    amount: c.amount,
    percentage: incomeTotal > 0 ? ((c.amount / incomeTotal) * 100).toFixed(1) : '0',
    color: incomeColorsArray[index % incomeColorsArray.length],
  }));
  const incomeCategoryData: ChartData<'doughnut'> = {
    labels: topIncomeCategories.map((c) => c.name),
    datasets: [
      {
        data: topIncomeCategories.map((c) => c.amount),
        backgroundColor: incomeColorsArray,
        borderColor: getBorderColor(),
        borderWidth: 2,
      },
    ],
  };

  const incomeCategoryOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Отключаем встроенную легенду
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
        bodyColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        titleColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        callbacks: {
          label: (context: any) => {
            const value = context.parsed;
            const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${context.label}: ${value.toLocaleString('ru-RU', {
              style: 'currency',
              currency: 'RUB',
            })} (${percentage}%)`;
          },
        },
      },
    },
    onClick: (_event: any, elements: any) => {
      if (elements && elements.length > 0 && onCategoryClick) {
        const index = elements[0].index;
        const category = topIncomeCategories[index]?.name;
        if (category) {
          setSelectedCategory(category);
          onCategoryClick(category, 'income');
        }
      }
    },
  };

  // График 4: Расходы по категориям (Doughnut)
  const topExpenseCategories = data.expense_by_category.slice(0, 10);
  const expenseColorsArray = [
    '#EF4444', '#DC2626', '#B91C1C', '#991B1B', '#7F1D1D',
    '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2', '#FEF2F2',
  ];
  const expenseTotal = topExpenseCategories.reduce((sum, c) => sum + c.amount, 0);
  const expenseLegendItems = topExpenseCategories.map((c, index) => ({
    name: c.name,
    amount: c.amount,
    percentage: expenseTotal > 0 ? ((c.amount / expenseTotal) * 100).toFixed(1) : '0',
    color: expenseColorsArray[index % expenseColorsArray.length],
  }));
  const expenseCategoryData: ChartData<'doughnut'> = {
    labels: topExpenseCategories.map((c) => c.name),
    datasets: [
      {
        data: topExpenseCategories.map((c) => c.amount),
        backgroundColor: expenseColorsArray,
        borderColor: getBorderColor(),
        borderWidth: 2,
      },
    ],
  };

  const expenseCategoryOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Отключаем встроенную легенду
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
        bodyColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        titleColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        callbacks: {
          label: (context: any) => {
            const value = context.parsed;
            const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${context.label}: ${value.toLocaleString('ru-RU', {
              style: 'currency',
              currency: 'RUB',
            })} (${percentage}%)`;
          },
        },
      },
    },
    onClick: (_event: any, elements: any) => {
      if (elements && elements.length > 0 && onCategoryClick) {
        const index = elements[0].index;
        const category = topExpenseCategories[index]?.name;
        if (category) {
          setSelectedCategory(category);
          onCategoryClick(category, 'expense');
        }
      }
    },
  };

  // График 5: Топ-10 категорий расходов (Horizontal Bar)
  const topExpensesData: ChartData<'bar'> = {
    labels: topExpenseCategories.map((c) => c.name),
    datasets: [
      {
        label: 'Сумма',
        data: topExpenseCategories.map((c) => c.amount),
        backgroundColor: '#EF4444',
        borderColor: '#DC2626',
        borderWidth: 1,
      },
    ],
  };

  const topExpensesOptions: ChartOptions<'bar'> = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
        bodyColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        titleColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.x;
            if (value === null || value === undefined) return '';
            return value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          color: getLabelColor(),
          callback: (value: number | string) => {
            return typeof value === 'number' ? value.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : String(value);
          },
        },
        grid: { color: getGridColor() },
      },
      y: {
        ticks: { color: getLabelColor() },
        grid: { display: false },
      },
    },
    onClick: (_event: any, elements: any) => {
      if (elements && elements.length > 0 && onCategoryClick) {
        const index = elements[0].index;
        const category = topExpenseCategories[index]?.name;
        if (category) {
          setSelectedCategory(category);
          onCategoryClick(category, 'expense');
        }
      }
    },
  };

  // График 6: Топ-10 категорий доходов (Horizontal Bar)
  const topIncomeData: ChartData<'bar'> = {
    labels: topIncomeCategories.map((c) => c.name),
    datasets: [
      {
        label: 'Сумма',
        data: topIncomeCategories.map((c) => c.amount),
        backgroundColor: '#10B981',
        borderColor: '#059669',
        borderWidth: 1,
      },
    ],
  };

  const topIncomeOptions: ChartOptions<'bar'> = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
        bodyColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        titleColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.x;
            if (value === null || value === undefined) return '';
            return value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          color: getLabelColor(),
          callback: (value: number | string) => {
            return typeof value === 'number' ? value.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : String(value);
          },
        },
        grid: { color: getGridColor() },
      },
      y: {
        ticks: { color: getLabelColor() },
        grid: { display: false },
      },
    },
    onClick: (_event: any, elements: any) => {
      if (elements && elements.length > 0 && onCategoryClick) {
        const index = elements[0].index;
        const category = topIncomeCategories[index]?.name;
        if (category) {
          setSelectedCategory(category);
          onCategoryClick(category, 'income');
        }
      }
    },
  };

  // График 7: Динамика сбережений по месяцам (Line)
  const savingsTrendData: ChartData<'line'> = {
    labels: data.monthly_data.map((m) => monthNames[m.month - 1]),
    datasets: [
      {
        label: 'Сбережения',
        data: data.monthly_data.map((m) => m.savings),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const savingsTrendOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { color: getLabelColor() },
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
        bodyColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        titleColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y;
            if (value === null || value === undefined) return '';
            return `${context.dataset.label}: ${value.toLocaleString('ru-RU', {
              style: 'currency',
              currency: 'RUB',
            })}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: getLabelColor(),
          callback: (value: number | string) => {
            return typeof value === 'number' ? value.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : String(value);
          },
        },
        grid: { color: getGridColor() },
      },
      x: {
        ticks: { color: getLabelColor() },
        grid: { display: false },
      },
    },
  };

  // График 8: Баланс по месяцам (Line)
  const balanceTrendData: ChartData<'line'> = {
    labels: data.monthly_data.map((m) => monthNames[m.month - 1]),
    datasets: [
      {
        label: 'Баланс',
        data: data.monthly_data.map((m) => m.net),
        borderColor: data.net_total >= 0 ? '#10B981' : '#EF4444',
        backgroundColor: data.net_total >= 0
          ? 'rgba(16, 185, 129, 0.1)'
          : 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const balanceTrendOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { color: getLabelColor() },
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
        bodyColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        titleColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y;
            if (value === null || value === undefined) return '';
            return `${context.dataset.label}: ${value.toLocaleString('ru-RU', {
              style: 'currency',
              currency: 'RUB',
            })}`;
          },
        },
      },
    },
    scales: {
      y: {
        ticks: {
          color: getLabelColor(),
          callback: (value: number | string) => {
            return typeof value === 'number' ? value.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : String(value);
          },
        },
        grid: { color: getGridColor() },
      },
      x: {
        ticks: { color: getLabelColor() },
        grid: { display: false },
      },
    },
    onClick: (_event: any, elements: any) => {
      if (elements && elements.length > 0 && onMonthClick) {
        const index = elements[0].index;
        onMonthClick(data.monthly_data[index].month);
      }
    },
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Общий доход</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {data.income_total.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Средний: {avgIncome.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}
              </div>
            </div>
            <BootstrapIcon name="arrow-up-circle" className="text-green-600 dark:text-green-400" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Общий расход</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {data.expense_total.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Средний: {avgExpense.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}
              </div>
            </div>
            <BootstrapIcon name="arrow-down-circle" className="text-red-600 dark:text-red-400" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Баланс</div>
              <div className={`text-2xl font-bold mt-1 ${
                data.net_total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {data.net_total.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Средний: {avgNet.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}
              </div>
            </div>
            {data.net_total >= 0 ? (
              <BootstrapIcon name="graph-up-arrow" className="text-green-600 dark:text-green-400" size={32} />
            ) : (
              <BootstrapIcon name="graph-down-arrow" className="text-red-600 dark:text-red-400" size={32} />
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Сбережения</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {data.savings.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {savingsRate.toFixed(1)}% от дохода
              </div>
            </div>
            <BootstrapIcon name="piggy-bank" className="text-blue-600 dark:text-blue-400" size={32} />
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center">
            <BootstrapIcon name="bar-chart" className="mr-2 flex-shrink-0" size={20} />
            Статистика
            <div className="relative group ml-2">
              <BootstrapIcon 
                name="info-circle" 
                className="text-gray-400 dark:text-gray-500 cursor-help flex-shrink-0" 
                size={16}
              />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                <strong>Статистика</strong> — показывает ключевые показатели за год: лучший и худший месяцы по балансу, 
                количество месяцев с положительным балансом. Помогает оценить финансовую стабильность и выявить периоды наибольшей прибыльности.
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              </div>
            </div>
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Лучший месяц:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {monthNames[bestMonth.month - 1]} ({bestMonth.net.toLocaleString('ru-RU', {
                  style: 'currency',
                  currency: 'RUB',
                  maximumFractionDigits: 0,
                })})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Худший месяц:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {monthNames[worstMonth.month - 1]} ({worstMonth.net.toLocaleString('ru-RU', {
                  style: 'currency',
                  currency: 'RUB',
                  maximumFractionDigits: 0,
                })})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Месяцев с профицитом:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {data.monthly_data.filter((m) => m.net > 0).length} из 12
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center">
            <BootstrapIcon name="pie-chart" className="mr-2 flex-shrink-0" size={20} />
            Аналитика
            <div className="relative group ml-2">
              <BootstrapIcon 
                name="info-circle" 
                className="text-gray-400 dark:text-gray-500 cursor-help flex-shrink-0" 
                size={16}
              />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                <strong>Аналитика</strong> — аналитические показатели: средние значения доходов и расходов в месяц, 
                процент сбережений от общего дохода. Помогает понять финансовые привычки и эффективность управления бюджетом.
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              </div>
            </div>
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Средний доход/месяц:</span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                {avgIncome.toLocaleString('ru-RU', {
                  style: 'currency',
                  currency: 'RUB',
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Средний расход/месяц:</span>
              <span className="text-sm font-medium text-red-600 dark:text-red-400">
                {avgExpense.toLocaleString('ru-RU', {
                  style: 'currency',
                  currency: 'RUB',
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Процент сбережений:</span>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {savingsRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* График 1: Динамика доходов и расходов */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <BootstrapIcon name="graph-up" className="mr-2 flex-shrink-0" size={20} />
              Динамика доходов и расходов
            </h3>
            <div className="relative group">
              <BootstrapIcon 
                name="info-circle" 
                className="text-gray-400 dark:text-gray-500 cursor-help flex-shrink-0" 
                size={16}
              />
              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Показывает изменение доходов и расходов по месяцам в виде двух линий. 
                Позволяет увидеть тренды, сезонность и периоды роста или снижения финансовых показателей.
                <div className="absolute top-full right-4 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="h-64">
            <Line data={monthlyTrendData} options={monthlyTrendOptions} />
          </div>
        </div>

        {/* График 2: Сравнение по месяцам */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <BootstrapIcon name="bar-chart-steps" className="mr-2 flex-shrink-0" size={20} />
              Сравнение по месяцам
            </h3>
            <div className="relative group">
              <BootstrapIcon 
                name="info-circle" 
                className="text-gray-400 dark:text-gray-500 cursor-help flex-shrink-0" 
                size={16}
              />
              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Сравнивает доходы и расходы по каждому месяцу в виде столбцов. 
                Наглядно показывает, в какие месяцы был профицит (доходы больше расходов) или дефицит бюджета.
                <div className="absolute top-full right-4 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="h-64">
            <Bar data={monthlyComparisonData} options={monthlyComparisonOptions} />
          </div>
        </div>

        {/* График 3: Доходы по категориям */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <BootstrapIcon name="pie-chart" className="mr-2 flex-shrink-0" size={20} />
              Доходы по категориям
            </h3>
            <div className="relative group">
              <BootstrapIcon 
                name="info-circle" 
                className="text-gray-400 dark:text-gray-500 cursor-help flex-shrink-0" 
                size={16}
              />
              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Круговая диаграмма показывает распределение доходов по категориям за год. 
                Позволяет увидеть, какие источники дохода приносят больше всего средств и какова их доля в общем доходе.
                <div className="absolute top-full right-4 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 h-64 overflow-hidden">
              <Doughnut data={incomeCategoryData} options={incomeCategoryOptions} />
            </div>
            <div className="flex-shrink-0 lg:w-48">
              <ul className="space-y-2">
                {incomeLegendItems.map((item, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                      {item.name}: {item.percentage}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* График 4: Расходы по категориям */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <BootstrapIcon name="pie-chart-fill" className="mr-2 flex-shrink-0" size={20} />
              Расходы по категориям
            </h3>
            <div className="relative group">
              <BootstrapIcon 
                name="info-circle" 
                className="text-gray-400 dark:text-gray-500 cursor-help flex-shrink-0" 
                size={16}
              />
              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Круговая диаграмма показывает распределение расходов по категориям за год. 
                Помогает понять, на что тратится больше всего денег и какие категории расходов занимают наибольшую долю в бюджете.
                <div className="absolute top-full right-4 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 h-64 overflow-hidden">
              <Doughnut data={expenseCategoryData} options={expenseCategoryOptions} />
            </div>
            <div className="flex-shrink-0 lg:w-48">
              <ul className="space-y-2">
                {expenseLegendItems.map((item, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                      {item.name}: {item.percentage}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* График 5: Топ-10 категорий расходов */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <BootstrapIcon name="arrow-up-circle" className="mr-2 flex-shrink-0" size={20} />
              Топ-10 категорий расходов
            </h3>
            <div className="relative group">
              <BootstrapIcon 
                name="info-circle" 
                className="text-gray-400 dark:text-gray-500 cursor-help flex-shrink-0" 
                size={16}
              />
              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Горизонтальный график показывает 10 категорий расходов, отсортированных по сумме затрат. 
                Помогает быстро определить самые затратные статьи бюджета и найти возможности для оптимизации расходов.
                <div className="absolute top-full right-4 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="h-80">
            <Bar data={topExpensesData} options={topExpensesOptions} />
          </div>
        </div>

        {/* График 6: Топ-10 категорий доходов */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <BootstrapIcon name="arrow-down-circle" className="mr-2 flex-shrink-0" size={20} />
              Топ-10 категорий доходов
            </h3>
            <div className="relative group">
              <BootstrapIcon 
                name="info-circle" 
                className="text-gray-400 dark:text-gray-500 cursor-help flex-shrink-0" 
                size={16}
              />
              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Горизонтальный график показывает 10 категорий доходов, отсортированных по сумме поступлений. 
                Помогает определить основные источники дохода и их вклад в общий финансовый результат.
                <div className="absolute top-full right-4 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="h-80">
            <Bar data={topIncomeData} options={topIncomeOptions} />
          </div>
        </div>

        {/* График 7: Динамика сбережений */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <BootstrapIcon name="piggy-bank" className="mr-2 flex-shrink-0" size={20} />
              Динамика сбережений
            </h3>
            <div className="relative group">
              <BootstrapIcon 
                name="info-circle" 
                className="text-gray-400 dark:text-gray-500 cursor-help flex-shrink-0" 
                size={16}
              />
              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Показывает изменение суммы сбережений по месяцам. 
                Помогает отслеживать прогресс накоплений и оценить эффективность стратегии сбережений в течение года.
                <div className="absolute top-full right-4 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="h-64">
            <Line data={savingsTrendData} options={savingsTrendOptions} />
          </div>
        </div>

        {/* График 8: Баланс по месяцам */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <BootstrapIcon name="balance-scale" className="mr-2 flex-shrink-0" size={20} />
              Баланс по месяцам
            </h3>
            <div className="relative group">
              <BootstrapIcon 
                name="info-circle" 
                className="text-gray-400 dark:text-gray-500 cursor-help flex-shrink-0" 
                size={16}
              />
              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Показывает разницу между доходами и расходами (баланс) по каждому месяцу. 
                Положительные значения означают профицит, отрицательные — дефицит бюджета. 
                Помогает оценить финансовую стабильность и выявить проблемные периоды.
                <div className="absolute top-full right-4 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="h-64">
            <Line data={balanceTrendData} options={balanceTrendOptions} />
          </div>
        </div>
      </div>

      {selectedCategory && (
        <div className="card bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Выбрана категория: <strong>{selectedCategory}</strong>. Кликните на график, чтобы увидеть детали.
          </p>
        </div>
      )}
    </div>
  );
};

