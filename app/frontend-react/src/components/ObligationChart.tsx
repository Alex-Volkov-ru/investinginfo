import React from 'react';
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

interface ObligationChartProps {
  paid: number;
  remaining: number;
  total: number;
}

export const ObligationChart: React.FC<ObligationChartProps> = ({
  paid,
  remaining,
  total,
}) => {
  const { theme } = useTheme();

  const getBorderColor = () => (theme === 'dark' ? '#1f2937' : '#ffffff');

  const chartData: ChartData<'doughnut'> = {
    labels: ['Оплачено', 'Остаток'],
    datasets: [
      {
        data: [paid, remaining],
        backgroundColor: ['#10b981', '#ef4444'], // green-500, red-500
        borderColor: getBorderColor(),
        borderWidth: 3,
        hoverOffset: 8,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
        bodyColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        titleColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        padding: 12,
        callbacks: {
          label: function (context) {
            const value = context.parsed || 0;
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
  };

  return (
    <div className="h-64 relative">
      <Doughnut data={chartData} options={options} />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2" style={{ padding: '20%' }}>
        <div className="text-[10px] text-gray-600 dark:text-gray-400 leading-none mb-1">Всего</div>
        <div className="text-sm font-bold text-gray-900 dark:text-gray-100 text-center leading-tight">
          {total.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}
        </div>
        <div className="text-[10px] font-medium mt-1 text-center leading-tight text-green-600 dark:text-green-400">
          <div>Оплачено: {paid.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}</div>
        </div>
      </div>
    </div>
  );
};

