import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

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
  const incomeChartData = {
    labels: incomeData.map((item) => item.name),
    datasets: [
      {
        data: incomeData.map((item) => item.amount),
        backgroundColor: incomeData.map((_, index) => incomeColors[index % incomeColors.length]),
        borderWidth: 3,
        borderColor: '#1f2937', // gray-800 для темной темы
        hoverBorderWidth: 4,
        hoverBorderColor: '#ffffff',
      },
    ],
  };

  const expenseChartData = {
    labels: expenseData.map((item) => item.name),
    datasets: [
      {
        data: expenseData.map((item) => item.amount),
        backgroundColor: expenseData.map((_, index) => expenseColors[index % expenseColors.length]),
        borderWidth: 3,
        borderColor: '#1f2937', // gray-800 для темной темы
        hoverBorderWidth: 4,
        hoverBorderColor: '#ffffff',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '60%', // Делаем график более тонким
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
          font: {
            size: 13,
            weight: 'bold' as const,
          },
          color: '#374151', // gray-700
          generateLabels: function (chart: any) {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              const dataset = data.datasets[0];
              const total = dataset.data.reduce((a: number, b: number) => a + b, 0);
              return data.labels.map((label: string, i: number) => {
                const value = dataset.data[i];
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                return {
                  text: `${label} (${percentage}%)`,
                  fillStyle: dataset.backgroundColor[i],
                  hidden: false,
                  index: i,
                };
              });
            }
            return [];
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold' as const,
        },
        bodyFont: {
          size: 13,
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
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${value.toLocaleString('ru-RU', {
              style: 'currency',
              currency: 'RUB',
            })} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Доходы по категориям
          </h3>
          {incomeData.length > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Всего: {incomeData.reduce((sum, item) => sum + item.amount, 0).toLocaleString('ru-RU', {
                style: 'currency',
                currency: 'RUB',
              })}
            </div>
          )}
        </div>
        {incomeData.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500 dark:text-gray-400">Нет данных</p>
          </div>
        ) : (
          <div className="h-80">
            <Doughnut data={incomeChartData} options={chartOptions} />
          </div>
        )}
      </div>
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Расходы по категориям
          </h3>
          {expenseData.length > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Всего: {expenseData.reduce((sum, item) => sum + item.amount, 0).toLocaleString('ru-RU', {
                style: 'currency',
                currency: 'RUB',
              })}
            </div>
          )}
        </div>
        {expenseData.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500 dark:text-gray-400">Нет данных</p>
          </div>
        ) : (
          <div className="h-80 overflow-hidden">
            <Doughnut data={expenseChartData} options={chartOptions} />
          </div>
        )}
      </div>
    </div>
  );
};

