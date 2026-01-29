import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BootstrapIcon } from './BootstrapIcon';
import { monthlyReviewService, MonthlyReview } from '../services/monthlyReviewService';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

/** Показывать блок «Итоги месяца» только 1–3 числа и в последние 3 дня месяца */
function isInShowWindow(d: Date): boolean {
  const day = d.getDate();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return day <= 3 || day >= lastDay - 2;
}

interface MonthlyReviewBannerProps {
  /** Режим страницы для админа: всегда показывать, без окна 1–3 / последние 3 дня и без «Закрыть» */
  standalone?: boolean;
  /** Компактный вид для мобильного лейаута */
  compact?: boolean;
}

export const MonthlyReviewBanner: React.FC<MonthlyReviewBannerProps> = ({ standalone = false, compact = false }) => {
  const [review, setReview] = useState<MonthlyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [forceShow, setForceShow] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  useEffect(() => {
    if (standalone) {
      const loadReview = async (year?: number, month?: number) => {
        setLoading(true);
        try {
          const data = await monthlyReviewService.getReview(year, month);
          setReview(data);
          setSelectedYear(data.year);
          setSelectedMonth(data.month);
        } catch (error) {
          console.error('Ошибка загрузки месячного обзора:', error);
        } finally {
          setLoading(false);
        }
      };
      loadReview(selectedYear ?? undefined, selectedMonth ?? undefined);
      return;
    }

    const today = new Date();
    const dismissedKey = `monthly_review_${today.getFullYear()}_${today.getMonth()}`;
    const wasDismissed = localStorage.getItem(dismissedKey);

    if (wasDismissed === 'true' && !forceShow) {
      setDismissed(true);
      setLoading(false);
      return;
    }

    const loadReview = async (year?: number, month?: number) => {
      setLoading(true);
      try {
        const data = await monthlyReviewService.getReview(year, month);
        setReview(data);
        setSelectedYear(data.year);
        setSelectedMonth(data.month);
        setDismissed(false);
      } catch (error) {
        console.error('Ошибка загрузки месячного обзора:', error);
        setDismissed(true);
      } finally {
        setLoading(false);
      }
    };

    loadReview(selectedYear ?? undefined, selectedMonth ?? undefined);
  }, [forceShow, standalone]);

  const loadMonth = (year: number, month: number) => {
    setLoading(true);
    monthlyReviewService.getReview(year, month).then((data) => {
      setReview(data);
      setSelectedYear(data.year);
      setSelectedMonth(data.month);
      setLoading(false);
    }).catch((error) => {
      console.error('Ошибка загрузки месячного обзора:', error);
      setLoading(false);
    });
  };

  const goPrevMonth = () => {
    if (!review) return;
    let y = review.year;
    let m = review.month - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    loadMonth(y, m);
  };

  const goNextMonth = () => {
    if (!review) return;
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    if (review.year > currentYear || (review.year === currentYear && review.month >= currentMonth)) return;
    let y = review.year;
    let m = review.month + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    loadMonth(y, m);
  };

  const handleDismiss = () => {
    const today = new Date();
    const dismissedKey = `monthly_review_${today.getFullYear()}_${today.getMonth()}`;
    localStorage.setItem(dismissedKey, 'true');
    setForceShow(false);
    setDismissed(true);
  };

  const today = new Date();
  if (!standalone && !isInShowWindow(today)) {
    return null;
  }

  if (loading) {
    return (
      <div className={`bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${compact ? 'mb-3 p-3' : 'mb-6 p-4'}`}>
        <div className={compact ? 'text-xs text-gray-600 dark:text-gray-400' : 'text-sm text-gray-600 dark:text-gray-400'}>Загрузка итогов месяца...</div>
      </div>
    );
  }

  if (!standalone && dismissed && !forceShow) {
    return (
      <div className={`bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-center ${compact ? 'mb-3 p-3' : 'mb-6 p-4'}`}>
        <button
          onClick={() => {
            const today = new Date();
            const dismissedKey = `monthly_review_${today.getFullYear()}_${today.getMonth()}`;
            localStorage.removeItem(dismissedKey);
            setForceShow(true);
            setDismissed(false);
          }}
          className={compact ? 'text-xs text-primary-600 dark:text-primary-400 active:underline' : 'text-sm text-primary-600 dark:text-primary-400 hover:underline'}
        >
          Итоги месяца
        </button>
      </div>
    );
  }

  if (!review) {
    return null;
  }

  const monthName = MONTH_NAMES[review.month - 1];
  const isCurrentMonth = review.year === today.getFullYear() && review.month === today.getMonth() + 1;

  const budgetHref = compact ? '/budget_mobile' : '/budget';

  return (
    <div className={`bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 border border-primary-200 dark:border-primary-700 rounded-lg shadow-sm ${compact ? 'mb-3 p-3' : 'mb-6 p-4'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className={`flex items-center justify-between gap-2 flex-wrap ${compact ? 'mb-2' : 'mb-3'}`}>
            <div className="flex items-center gap-2 min-w-0 min-h-[2rem]">
              <button
                type="button"
                onClick={goPrevMonth}
                disabled={loading}
                className={`inline-flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 disabled:opacity-50 border border-transparent shrink-0 active:bg-gray-200 dark:active:bg-gray-700 ${compact ? 'w-8 h-8' : 'min-w-[2.25rem] min-h-[2.25rem] gap-1 px-2 hover:bg-gray-200 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                title="Предыдущий месяц"
              >
                <BootstrapIcon name="chevron-left" size={compact ? 16 : 18} />
                {!compact && <span className="hidden sm:inline">Назад</span>}
              </button>
              <span className="flex items-baseline gap-2 min-w-0">
                <span className="inline-flex items-center justify-center shrink-0 translate-y-[0.08em]" aria-hidden>
                  <BootstrapIcon name="calendar-check" className="text-primary-600 dark:text-primary-400" size={compact ? 16 : 20} />
                </span>
                <h2 className={`font-semibold text-gray-900 dark:text-gray-100 truncate leading-none ${compact ? 'text-sm' : 'text-lg'}`}>
                  Обзор за {monthName} {review.year}
                </h2>
              </span>
              <button
                type="button"
                onClick={goNextMonth}
                disabled={loading || isCurrentMonth}
                className={`inline-flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 disabled:opacity-50 border border-transparent shrink-0 active:bg-gray-200 dark:active:bg-gray-700 ${compact ? 'w-8 h-8' : 'min-w-[2.25rem] min-h-[2.25rem] gap-1 px-2 hover:bg-gray-200 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                title={isCurrentMonth ? 'Текущий месяц' : 'Следующий месяц'}
              >
                {!compact && <span className="hidden sm:inline">Вперёд</span>}
                <BootstrapIcon name="chevron-right" size={compact ? 16 : 18} />
              </button>
            </div>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 ${compact ? 'gap-2' : 'gap-4'}`}>
            {/* Бюджет */}
            <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${compact ? 'p-2' : 'p-3'}`}>
              <div className={`flex items-center ${compact ? 'mb-1' : 'mb-2'}`}>
                <BootstrapIcon name="wallet2" className="text-primary-600 dark:text-primary-400 mr-1.5 shrink-0" size={compact ? 14 : 16} />
                <span className={`font-medium text-gray-900 dark:text-gray-100 ${compact ? 'text-xs' : 'text-sm'}`}>Бюджет</span>
              </div>
              <div className={`text-gray-600 dark:text-gray-400 ${compact ? 'text-[11px] mb-0.5' : 'text-xs mb-1'}`}>
                Доход: <span className="font-semibold text-green-600 dark:text-green-400">{review.budget.total_income.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className={`text-gray-600 dark:text-gray-400 ${compact ? 'text-[11px] mb-0.5' : 'text-xs mb-1'}`}>
                Расход: <span className="font-semibold text-red-600 dark:text-red-400">{review.budget.total_expense.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className={`text-gray-600 dark:text-gray-400 ${compact ? 'text-[11px] mb-1' : 'text-xs mb-2'}`}>
                Итого: <span className={`font-semibold ${review.budget.net_result >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {review.budget.net_result >= 0 ? '+' : ''}{review.budget.net_result.toLocaleString('ru-RU')} ₽
                </span>
              </div>
              {review.budget.categories_over_limit > 0 && (
                <div className={`border-t border-gray-200 dark:border-gray-700 ${compact ? 'mt-1.5 pt-1.5' : 'mt-2 pt-2'}`}>
                  <div className={`flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium ${compact ? 'text-[11px]' : 'text-xs'}`}>
                    <BootstrapIcon name="exclamation-triangle" className="shrink-0" size={compact ? 12 : 14} />
                    <span>Перерасход по {review.budget.categories_over_limit} {review.budget.categories_over_limit === 1 ? 'категории' : 'категориям'}</span>
                  </div>
                  {review.budget.top_over_limit.length > 0 && (
                    <div className={`text-gray-600 dark:text-gray-400 ${compact ? 'text-[11px] mt-0.5' : 'text-xs mt-1'}`}>
                      {review.budget.top_over_limit.map((cat) => (
                        <div key={cat.category_id}>
                          {cat.category_name}: +{(cat.spent - cat.monthly_limit).toLocaleString('ru-RU')} ₽
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {review.budget.categories_over_limit === 0 && review.budget.categories_with_limits > 0 && (
                <div className={`flex items-center gap-1.5 text-green-600 dark:text-green-400 border-t border-gray-200 dark:border-gray-700 ${compact ? 'mt-1.5 pt-1.5 text-[11px]' : 'mt-2 pt-2 text-xs'}`}>
                  <BootstrapIcon name="check-circle" className="shrink-0" size={compact ? 12 : 14} />
                  <span>Все категории в рамках лимита</span>
                </div>
              )}
            </div>

            {/* Обязательства */}
            <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${compact ? 'p-2' : 'p-3'}`}>
              <div className={`flex items-center ${compact ? 'mb-1' : 'mb-2'}`}>
                <BootstrapIcon name="file-earmark-text" className="text-primary-600 dark:text-primary-400 mr-1.5 shrink-0" size={compact ? 14 : 16} />
                <span className={`font-medium text-gray-900 dark:text-gray-100 ${compact ? 'text-xs' : 'text-sm'}`}>Обязательства</span>
              </div>
              {review.obligations.blocks.length > 0 || review.obligations.upcoming_payments_count > 0 ? (
                <>
                  {review.obligations.blocks.map((b) => (
                    <div key={b.block_id} className={`border-b border-gray-200 dark:border-gray-700 last:border-0 ${compact ? 'mb-1.5 pb-1.5 last:pb-0 last:mb-0' : 'mb-2 pb-2 last:pb-0 last:mb-0'}`}>
                      <div className={`font-medium text-gray-900 dark:text-gray-100 ${compact ? 'text-[11px] mb-0' : 'text-xs mb-0.5'}`}>{b.title}</div>
                      {b.payments_in_month_count > 0 ? (
                        <div className={compact ? 'text-[11px] text-green-600 dark:text-green-400' : 'text-xs text-green-600 dark:text-green-400'}>
                          Оплачено: {b.payments_in_month_count} {b.payments_in_month_count === 1 ? 'платёж' : 'платежей'}, {b.payments_in_month_amount.toLocaleString('ru-RU')} ₽
                        </div>
                      ) : (
                        <div className={compact ? 'text-[11px] text-gray-500 dark:text-gray-400' : 'text-xs text-gray-500 dark:text-gray-400'}>В месяце платежей не было</div>
                      )}
                      <div className={compact ? 'text-[11px] text-gray-600 dark:text-gray-400' : 'text-xs text-gray-600 dark:text-gray-400'}>
                        Остаток: {b.remaining.toLocaleString('ru-RU')} ₽ · погашено {b.progress_pct.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                  {review.obligations.upcoming_payments_count > 0 && (
                    <div className={`border-t border-gray-200 dark:border-gray-700 ${compact ? 'mt-1.5 pt-1.5' : 'mt-2 pt-2'}`}>
                      <div className={compact ? 'text-[11px] text-gray-600 dark:text-gray-400' : 'text-xs text-gray-600 dark:text-gray-400'}>
                        Ближайшие платежи: {review.obligations.upcoming_payments_count}
                      </div>
                      <div className={compact ? 'text-[11px] font-semibold text-gray-900 dark:text-gray-100' : 'text-xs font-semibold text-gray-900 dark:text-gray-100'}>
                        {review.obligations.upcoming_payments_amount.toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className={compact ? 'text-[11px] text-gray-500 dark:text-gray-400' : 'text-xs text-gray-500 dark:text-gray-400'}>
                  Нет активных кредитов / в месяце платежей не было
                </div>
              )}
            </div>
          </div>

          <div className={`flex items-center justify-between ${compact ? 'mt-2' : 'mt-4'}`}>
            <Link
              to={budgetHref}
              className={`text-primary-600 dark:text-primary-400 active:underline flex items-center ${compact ? 'text-xs' : 'text-sm hover:underline'}`}
            >
              Подробный отчёт по бюджету
              <BootstrapIcon name="arrow-right" className="ml-1 shrink-0" size={compact ? 12 : 14} />
            </Link>
            {!standalone && (
              <button
                onClick={handleDismiss}
                className={`text-gray-500 dark:text-gray-400 ${compact ? 'text-xs active:text-gray-700 dark:active:text-gray-200' : 'text-sm hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                Закрыть
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
