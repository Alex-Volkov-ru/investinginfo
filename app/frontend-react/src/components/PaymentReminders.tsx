import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { budgetService } from '../services/budgetService';
import { UpcomingPayment } from '../types';
import { format } from 'date-fns';

interface PaymentRemindersProps {
  isMobile?: boolean;
}

export const PaymentReminders: React.FC<PaymentRemindersProps> = ({ isMobile = false }) => {
  const [reminders, setReminders] = useState<UpcomingPayment[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    loadReminders();
    // Обновляем каждые 5 минут
    const interval = setInterval(loadReminders, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadReminders = async () => {
    try {
      const data = await budgetService.getUpcomingPayments(7); // На 7 дней вперед
      setReminders(data);
    } catch (error) {
      // Ошибка обработана в interceptor
    }
  };

  const urgentCount = reminders.filter(r => r.is_urgent).length;
  const totalCount = reminders.length;

  if (totalCount === 0) return null;

  if (isMobile) {
    // Мобильная версия - компактный бейдж
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="relative min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 rounded-lg transition-colors"
        >
          <Bell className="h-5 w-5" />
          {totalCount > 0 && (
            <span className={`absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs flex items-center justify-center font-bold ${
              urgentCount > 0 
                ? 'bg-red-500 text-white' 
                : 'bg-yellow-500 text-white'
            }`}>
              {totalCount > 9 ? '9+' : totalCount}
            </span>
          )}
        </button>

        {showDropdown && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Ближайшие платежи
                </h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {reminders.map((reminder) => (
                  <div
                    key={`${reminder.block_id}-${reminder.payment_date}`}
                    className={`p-4 border-b border-gray-100 dark:border-gray-700 ${
                      reminder.is_urgent ? 'bg-red-50 dark:bg-red-900/20' : 
                      reminder.is_warning ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {reminder.block_title}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {format(new Date(reminder.payment_date), 'dd.MM.yyyy')}
                        </div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                          {reminder.amount.toLocaleString('ru-RU', {
                            style: 'currency',
                            currency: 'RUB',
                          })}
                        </div>
                      </div>
                      <div className="ml-4">
                        {reminder.is_urgent ? (
                          <span className="px-2 py-1 text-xs font-bold bg-red-500 text-white rounded">
                            СРОЧНО
                          </span>
                        ) : reminder.is_warning ? (
                          <span className="px-2 py-1 text-xs font-bold bg-yellow-500 text-white rounded">
                            {reminder.days_until} дн.
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                            {reminder.days_until} дн.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                <Link
                  to="/obligations_mobile"
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  onClick={() => setShowDropdown(false)}
                >
                  Все обязательства →
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Десктоп версия
  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <Bell className="h-5 w-5" />
        {totalCount > 0 && (
          <span className={`absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs flex items-center justify-center font-bold ${
            urgentCount > 0 
              ? 'bg-red-500 text-white' 
              : 'bg-yellow-500 text-white'
          }`}>
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Ближайшие платежи
              </h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {reminders.map((reminder) => (
                <div
                  key={`${reminder.block_id}-${reminder.payment_date}`}
                  className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    reminder.is_urgent ? 'bg-red-50 dark:bg-red-900/20' : 
                    reminder.is_warning ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {reminder.block_title}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {format(new Date(reminder.payment_date), 'dd.MM.yyyy')}
                      </div>
                      <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                        {reminder.amount.toLocaleString('ru-RU', {
                          style: 'currency',
                          currency: 'RUB',
                        })}
                      </div>
                    </div>
                    <div className="ml-4">
                      {reminder.is_urgent ? (
                        <span className="px-2 py-1 text-xs font-bold bg-red-500 text-white rounded">
                          СРОЧНО
                        </span>
                      ) : reminder.is_warning ? (
                        <span className="px-2 py-1 text-xs font-bold bg-yellow-500 text-white rounded">
                          {reminder.days_until} дн.
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                          {reminder.days_until} дн.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <Link
                to="/obligations"
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                onClick={() => setShowDropdown(false)}
              >
                Все обязательства →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

