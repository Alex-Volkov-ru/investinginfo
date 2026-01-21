import { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
} from 'chart.js';
import { useTheme } from '../contexts/ThemeContext';

ChartJS.register(ArcElement, Tooltip, Legend);

interface ChartSlice {
  name: string;
  amount: number;
}

interface ChartsProps {
  incomeData: ChartSlice[];
  expenseData: ChartSlice[];
}

// Кастомные цвета для графиков
const incomeColors = [
  '#10b981', // emerald-500
  '#34d399', // emerald-400
  '#6ee7b7', // emerald-300
  '#a7f3d0', // emerald-200
  '#86efac', // emerald-400
  '#4ade80', // green-400
  '#22c55e', // green-500
  '#16a34a', // green-600
];

const expenseColors = [
  '#ef4444', // red-500
  '#f87171', // red-400
  '#fca5a5', // red-300
  '#fecaca', // red-200
  '#fb7185', // rose-400
  '#f43f5e', // rose-500
  '#e11d48', // rose-600
  '#be123c', // rose-700
];

export const IncomeExpenseCharts: React.FC<ChartsProps> = ({ incomeData, expenseData }) => {
  const { theme } = useTheme();
  
  const borderColor = theme === 'dark' ? '#1f2937' : '#ffffff';
  const tooltipBg = theme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)';
  const tooltipTextColor = theme === 'dark' ? '#1f2937' : '#ffffff';
  
  // Подготовка данных для графиков
  const incomeChartData: ChartData<'doughnut'> = useMemo(() => ({
    labels: incomeData.map((item) => item.name),
    datasets: [
      {
        data: incomeData.map((item) => item.amount),
        backgroundColor: incomeData.map((_, index) => incomeColors[index % incomeColors.length]),
        borderWidth: 3,
        borderColor: borderColor,
        hoverBorderWidth: 4,
        hoverBorderColor: '#ffffff',
      },
    ],
  }), [incomeData, borderColor]);

  const expenseChartData: ChartData<'doughnut'> = useMemo(() => ({
    labels: expenseData.map((item) => item.name),
    datasets: [
      {
        data: expenseData.map((item) => item.amount),
        backgroundColor: expenseData.map((_, index) => expenseColors[index % expenseColors.length]),
        borderWidth: 3,
        borderColor: borderColor,
        hoverBorderWidth: 4,
        hoverBorderColor: '#ffffff',
      },
    ],
  }), [expenseData, borderColor]);

  // Вычисляем проценты для кастомной легенды
  const incomeTotal = incomeData.reduce((sum, item) => sum + item.amount, 0);
  const expenseTotal = expenseData.reduce((sum, item) => sum + item.amount, 0);

  const incomeLegendItems = useMemo(() => {
    return incomeData.map((item, index) => ({
      name: item.name,
      amount: item.amount,
      percentage: incomeTotal > 0 ? ((item.amount / incomeTotal) * 100).toFixed(1) : '0',
      color: incomeColors[index % incomeColors.length],
    }));
  }, [incomeData, incomeTotal]);

  const expenseLegendItems = useMemo(() => {
    return expenseData.map((item, index) => ({
      name: item.name,
      amount: item.amount,
      percentage: expenseTotal > 0 ? ((item.amount / expenseTotal) * 100).toFixed(1) : '0',
      color: expenseColors[index % expenseColors.length],
    }));
  }, [expenseData, expenseTotal]);

  // Опции графиков БЕЗ легенды (легенда будет HTML)
  const chartOptions: ChartOptions<'doughnut'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    layout: {
      padding: {
        bottom: 10,
        top: 10,
        left: 10,
        right: 10,
      },
    },
    plugins: {
      legend: {
        display: false, // Отключаем встроенную легенду
      },
      tooltip: {
        backgroundColor: tooltipBg,
        padding: 10,
        titleColor: tooltipTextColor,
        bodyColor: tooltipTextColor,
        titleFont: {
          size: 13,
          weight: 'bold' as const,
        },
        bodyFont: {
          size: 12,
        },
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: function (context: any) {
            return context[0].label || '';
          },
          label: function (context: any) {
            const value = context.parsed || 0;
            const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${value.toLocaleString('ru-RU', {
              style: 'currency',
              currency: 'RUB',
            })} (${percentage}%)`;
          },
        },
      },
    },
  }), [tooltipBg, tooltipTextColor]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Доходы */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Доходы по категориям
          </h3>
          {incomeData.length > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Всего: {incomeTotal.toLocaleString('ru-RU', {
                style: 'currency',
                currency: 'RUB',
              })}
            </div>
          )}
        </div>
        {incomeData.length === 0 ? (
          <div className="flex items-center justify-center h-96">
            <p className="text-gray-500 dark:text-gray-400">Нет данных</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 h-96 min-h-[400px]">
              <Doughnut data={incomeChartData} options={chartOptions} />
            </div>
            <div className="flex-shrink-0 md:w-48">
              <ul className="space-y-3">
                {incomeLegendItems.map((item, index) => {
                  const maxLabelLength = 20;
                  const truncatedLabel = item.name.length > maxLabelLength
                    ? item.name.substring(0, maxLabelLength) + '...'
                    : item.name;
                  return (
                    <li key={index} className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                        {truncatedLabel} ({item.percentage}%)
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Расходы */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Расходы по категориям
          </h3>
          {expenseData.length > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Всего: {expenseTotal.toLocaleString('ru-RU', {
                style: 'currency',
                currency: 'RUB',
              })}
            </div>
          )}
        </div>
        {expenseData.length === 0 ? (
          <div className="flex items-center justify-center h-96">
            <p className="text-gray-500 dark:text-gray-400">Нет данных</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 h-96 min-h-[400px]">
              <Doughnut data={expenseChartData} options={chartOptions} />
            </div>
            <div className="flex-shrink-0 md:w-48">
              <ul className="space-y-3">
                {expenseLegendItems.map((item, index) => {
                  const maxLabelLength = 20;
                  const truncatedLabel = item.name.length > maxLabelLength
                    ? item.name.substring(0, maxLabelLength) + '...'
                    : item.name;
                  return (
                    <li key={index} className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                        {truncatedLabel} ({item.percentage}%)
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
