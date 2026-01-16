import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ChartOptions,
  ChartData,
} from 'chart.js';
import { useTheme } from '../contexts/ThemeContext';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

interface PositionData {
  figi: string;
  quantity: number;
  avg_price: number;
  instrument?: {
    ticker?: string;
    name?: string;
    class?: string;
  };
}

interface PortfolioChartsProps {
  positions: PositionData[];
  quotes: Record<string, { price: number }>;
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
}

export const PortfolioCharts: React.FC<PortfolioChartsProps> = ({
  positions,
  quotes,
  totalValue,
  totalPnL,
  totalPnLPercent,
}) => {
  const { theme } = useTheme();

  // Группировка по классам
  const classGroups: Record<string, number> = {};
  const tickerValues: Record<string, number> = {};
  const tickerQuantities: Record<string, number> = {};

  positions.forEach((pos) => {
    const quote = quotes[pos.figi];
    const currentPrice = quote?.price || 0;
    const value = pos.quantity * currentPrice;
    const classType = pos.instrument?.class || 'other';
    
    // Маппинг классов на русские названия
    const classMap: Record<string, string> = {
      share: 'Акции',
      bond: 'ОФЗ',
      etf: 'Фонды',
      other: 'Другое',
    };
    const className = classMap[classType] || 'Другое';
    
    classGroups[className] = (classGroups[className] || 0) + value;

    const ticker = pos.instrument?.ticker || pos.figi;
    const name = pos.instrument?.name || ticker;
    const displayName = `${name} (${ticker})`;
    
    tickerValues[displayName] = (tickerValues[displayName] || 0) + value;
    tickerQuantities[displayName] = (tickerQuantities[displayName] || 0) + pos.quantity;
  });

  // Данные для графика аллокации по классам
  const classLabels = Object.keys(classGroups);
  const classData = Object.values(classGroups);
  const classColors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];

  const allocationChartData: ChartData<'doughnut'> = {
    labels: classLabels,
    datasets: [
      {
        data: classData,
        backgroundColor: classData.map((_, i) => classColors[i % classColors.length]),
        borderWidth: 3,
        borderColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        hoverOffset: 8,
      },
    ],
  };

  // Данные для графика по тикерам (стоимость)
  const tickerLabels = Object.keys(tickerValues).slice(0, 10); // Топ 10
  const tickerValueData = tickerLabels.map((label) => tickerValues[label]);

  const tickerValueChartData: ChartData<'bar'> = {
    labels: tickerLabels.map((label) => {
      // Обрезаем длинные названия
      if (label.length > 25) {
        return label.substring(0, 22) + '...';
      }
      return label;
    }),
    datasets: [
      {
        label: 'Стоимость (₽)',
        data: tickerValueData,
        backgroundColor: '#3b82f6',
        borderColor: '#2563eb',
        borderWidth: 1,
      },
    ],
  };

  // Данные для графика количества бумаг
  const tickerQuantityData = tickerLabels.map((label) => tickerQuantities[label]);

  const tickerQuantityChartData: ChartData<'bar'> = {
    labels: tickerLabels.map((label) => {
      if (label.length > 25) {
        return label.substring(0, 22) + '...';
      }
      return label;
    }),
    datasets: [
      {
        label: 'Количество',
        data: tickerQuantityData,
        backgroundColor: '#8b5cf6',
        borderColor: '#7c3aed',
        borderWidth: 1,
      },
    ],
  };

  const getLabelColor = () => (theme === 'dark' ? '#d1d5db' : '#374151');
  const getGridColor = () => (theme === 'dark' ? '#374151' : '#e5e7eb');

  const doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: {
        display: false, // Убираем легенду
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
        bodyColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        titleColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        padding: 12,
        callbacks: {
          label: function (context) {
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

  const barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: getLabelColor(),
          callback: function (value) {
            return value.toLocaleString('ru-RU');
          },
        },
        grid: {
          color: getGridColor(),
        },
      },
      x: {
        ticks: {
          color: getLabelColor(),
          maxRotation: 45,
          minRotation: 45,
        },
        grid: {
          display: false,
        },
      },
    },
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
            const value = context.parsed.y;
            return (value !== null && value !== undefined) ? value.toLocaleString('ru-RU') : '0';
          },
        },
      },
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      {/* Аллокация по классам */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Аллокация по классам
        </h3>
        <div className="h-64 relative">
          <Doughnut data={allocationChartData} options={doughnutOptions} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ padding: '20%' }}>
            <div className="text-[10px] text-gray-600 dark:text-gray-400 mb-0.5">Всего</div>
            <div className="text-sm font-bold text-gray-900 dark:text-gray-100 text-center leading-none">
              {totalValue.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}
            </div>
            <div className={`text-[10px] font-medium mt-1 text-center leading-tight ${
              totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              <div className="leading-tight">P/L: {totalPnL.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}</div>
              <div className="leading-tight">({totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Аллокация по тикерам (стоимость) */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Аллокация по тикерам (стоимость)
        </h3>
        <div className="h-64">
          {tickerLabels.length > 0 ? (
            <Bar data={tickerValueChartData} options={barOptions} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Нет данных
            </div>
          )}
        </div>
      </div>

      {/* Количество бумаг по тикерам */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Количество бумаг по тикерам
        </h3>
        <div className="h-64">
          {tickerLabels.length > 0 ? (
            <Bar data={tickerQuantityChartData} options={barOptions} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Нет данных
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

