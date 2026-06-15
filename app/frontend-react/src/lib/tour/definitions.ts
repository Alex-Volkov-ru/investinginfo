export interface AppTourStep {
  element: string;
  title: string;
  description: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  staffOnly?: boolean;
}

export interface AppTourDefinition {
  id: string;
  title: string;
  steps: AppTourStep[];
}

const LAYOUT_DESKTOP: AppTourStep[] = [
  {
    element: '[data-tour="nav-main"]',
    title: 'Навигация',
    description: 'Переключайтесь между разделами: инвестиции, бюджет, доска, обязательства и другие.',
    side: 'bottom',
  },
  {
    element: '[data-tour="payment-reminders"]',
    title: 'Напоминания',
    description: 'Колокольчик показывает ближайшие обязательные платежи по кредитам и срокам.',
    side: 'bottom',
  },
  {
    element: '[data-tour="theme-toggle"]',
    title: 'Тема оформления',
    description: 'Переключение светлой и тёмной темы интерфейса.',
    side: 'bottom',
  },
  {
    element: '[data-tour="profile-menu"]',
    title: 'Профиль',
    description: 'Имя, почта, выход из аккаунта и редактирование данных.',
    side: 'bottom',
  },
];

const LAYOUT_MOBILE: AppTourStep[] = [
  {
    element: '[data-tour="mobile-nav"]',
    title: 'Нижнее меню',
    description: 'Основные разделы приложения — нажмите иконку, чтобы перейти.',
    side: 'top',
  },
  {
    element: '[data-tour="payment-reminders"]',
    title: 'Напоминания',
    description: 'Ближайшие платежи по обязательствам.',
    side: 'bottom',
  },
  {
    element: '[data-tour="theme-toggle"]',
    title: 'Тема',
    description: 'Светлая или тёмная тема.',
    side: 'bottom',
  },
  {
    element: '[data-tour="profile-menu"]',
    title: 'Профиль',
    description: 'Ваше имя — нажмите, чтобы изменить данные или выйти.',
    side: 'bottom',
  },
];

const PORTFOLIO_STEPS: AppTourStep[] = [
  {
    element: '[data-tour="portfolio-token"]',
    title: 'Токен Тинькофф',
    description: 'Подключите API-токен брокера для автоматической подгрузки котировок и позиций.',
    side: 'bottom',
  },
  {
    element: '[data-tour="portfolio-add-position"]',
    title: 'Добавить позицию',
    description: 'Ручное добавление акции, облигации или фонда в выбранный портфель.',
    side: 'bottom',
  },
  {
    element: '[data-tour="portfolio-new-portfolio"]',
    title: 'Новый портфель',
    description: 'Создайте отдельный портфель — например, ИИС, долгосрочный или спекулятивный.',
    side: 'bottom',
  },
  {
    element: '[data-tour="portfolio-select"]',
    title: 'Выбор портфеля',
    description: 'Переключение между портфелями. Все позиции и графики относятся к выбранному.',
    side: 'bottom',
  },
  {
    element: '[data-tour="portfolio-summary"]',
    title: 'Сводка',
    description: 'Общая стоимость, разбивка по типам активов и прибыль/убыток (P/L).',
    side: 'bottom',
  },
  {
    element: '[data-tour="portfolio-charts"]',
    title: 'Графики',
    description: 'Диаграмма распределения активов и динамика доходности.',
    side: 'top',
  },
  {
    element: '[data-tour="portfolio-positions"]',
    title: 'Позиции',
    description: 'Список бумаг по группам. Редактирование и удаление — кнопки у каждой строки.',
    side: 'top',
  },
];

const BUDGET_STEPS: AppTourStep[] = [
  {
    element: '[data-tour="budget-period"]',
    title: 'Период',
    description: 'Выберите месяц и год — все сводки и транзакции фильтруются по этому периоду.',
    side: 'bottom',
  },
  {
    element: '[data-tour="budget-toolbar"]',
    title: 'Быстрые действия',
    description: '«Счёт» — кошелёк денег. «Категория» — статья дохода/расхода. «Транзакция» — запись операции.',
    side: 'bottom',
  },
  {
    element: '[data-tour="budget-tabs"]',
    title: 'Вкладки бюджета',
    description: 'Сводка, транзакции, обязательные платежи, годовой обзор, счета и категории.',
    side: 'bottom',
  },
  {
    element: '[data-tour="budget-content"]',
    title: 'Содержимое вкладки',
    description: 'Здесь отображаются данные выбранной вкладки: графики, таблицы, формы.',
    side: 'top',
  },
];

const OBLIGATIONS_STEPS: AppTourStep[] = [
  {
    element: '[data-tour="obligations-add"]',
    title: 'Добавить кредит',
    description: 'Создайте блок кредита: сумма, ставка, ежемесячный платёж и график.',
    side: 'bottom',
  },
  {
    element: '[data-tour="obligations-alerts"]',
    title: 'Ближайшие платежи',
    description: 'Предупреждение о срочных и предстоящих платежах по всем кредитам.',
    side: 'bottom',
  },
  {
    element: '[data-tour="obligations-summary"]',
    title: 'Итоги',
    description: 'Остаток по кредитам и сколько уже оплачено.',
    side: 'bottom',
  },
  {
    element: '[data-tour="obligations-blocks"]',
    title: 'Кредитные блоки',
    description: 'График погашения, расписание платежей. Отметьте галочкой оплаченные.',
    side: 'top',
  },
];

const WHITEBOARD_STEPS: AppTourStep[] = [
  {
    element: '[data-tour="whiteboard-toolbar"]',
    title: 'Панель доски',
    description: 'Расход, доход, сохранение, экспорт в бюджет, шаблоны и список досок.',
    side: 'bottom',
  },
  {
    element: '[data-tour="whiteboard-budget-panel"]',
    title: 'Бюджет и прогресс',
    description: 'Месячный лимит, доходы, расходы, остаток и полоса прогресса.',
    side: 'bottom',
  },
  {
    element: '[data-tour="whiteboard-canvas"]',
    title: 'Рабочая область',
    description: 'Перетаскивайте карточки, меняйте размер за уголок. Двойной клик — новый расход.',
    side: 'top',
  },
  {
    element: '[data-tour="whiteboard-zones"]',
    title: 'Зоны приоритетов',
    description: 'Кнопка «слои» включает зоны: обязательное, можно отложить, хотелки.',
    side: 'left',
  },
  {
    element: '[data-tour="whiteboard-calculator"]',
    title: 'Калькулятор',
    description: 'Посчитайте сумму и нажмите «На доску» — появится карточка расхода.',
    side: 'left',
  },
];

const ADMIN_STEPS: AppTourStep[] = [
  {
    element: '[data-tour="admin-tabs"]',
    title: 'Разделы админки',
    description: 'Бэкапы, пользователи и панели модулей (в разработке).',
    side: 'bottom',
    staffOnly: true,
  },
  {
    element: '[data-tour="admin-content"]',
    title: 'Управление',
    description: 'Создание бэкапов, скачивание, восстановление. Управление пользователями и правами.',
    side: 'top',
    staffOnly: true,
  },
];

const MONTHLY_REPORT_STEPS: AppTourStep[] = [
  {
    element: '[data-tour="monthly-report"]',
    title: 'Сводка месяца',
    description: 'Итоги бюджета и обязательств за месяц. Стрелки — переключение месяцев.',
    side: 'bottom',
    staffOnly: true,
  },
];

const LOGIN_STEPS: AppTourStep[] = [
  {
    element: '[data-tour="login-form"]',
    title: 'Вход и регистрация',
    description: 'Войдите по email и паролю или создайте новый аккаунт.',
    side: 'bottom',
  },
  {
    element: '[data-tour="login-register-fields"]',
    title: 'Дополнительные поля',
    description: 'При регистрации: логин сервиса (обязателен), телефон и токен Тинькофф — по желанию.',
    side: 'top',
  },
];

function withLayout(steps: AppTourStep[], mobile: boolean): AppTourStep[] {
  return [...(mobile ? LAYOUT_MOBILE : LAYOUT_DESKTOP), ...steps];
}

export const TOUR_BY_ROUTE: Record<string, AppTourDefinition> = {
  '/': { id: 'portfolio', title: 'Инвестиции', steps: [] },
  '/mobile': { id: 'portfolio', title: 'Инвестиции', steps: [] },
  '/budget': { id: 'budget', title: 'Бюджет', steps: [] },
  '/budget_mobile': { id: 'budget', title: 'Бюджет', steps: [] },
  '/obligations': { id: 'obligations', title: 'Обязательства', steps: [] },
  '/obligations_mobile': { id: 'obligations', title: 'Обязательства', steps: [] },
  '/whiteboard': { id: 'whiteboard', title: 'Доска', steps: [] },
  '/whiteboard_mobile': { id: 'whiteboard', title: 'Доска', steps: [] },
  '/admin': { id: 'admin', title: 'Админ', steps: [] },
  '/admin_mobile': { id: 'admin', title: 'Админ', steps: [] },
  '/monthly-report': { id: 'monthly-report', title: 'Сводка месяца', steps: [] },
  '/monthly_report_mobile': { id: 'monthly-report', title: 'Сводка месяца', steps: [] },
  '/login': { id: 'login', title: 'Вход', steps: LOGIN_STEPS },
};

const PAGE_STEPS: Record<string, AppTourStep[]> = {
  portfolio: PORTFOLIO_STEPS,
  budget: BUDGET_STEPS,
  obligations: OBLIGATIONS_STEPS,
  whiteboard: WHITEBOARD_STEPS,
  admin: ADMIN_STEPS,
  'monthly-report': MONTHLY_REPORT_STEPS,
  login: LOGIN_STEPS,
};

export function resolveTour(pathname: string, mobile: boolean, isStaff: boolean): AppTourDefinition | null {
  const meta = TOUR_BY_ROUTE[pathname];
  if (!meta) return null;

  if (meta.id === 'login') {
    return { ...meta, steps: LOGIN_STEPS.filter((s) => elementExists(s.element)) };
  }

  const pageSteps = PAGE_STEPS[meta.id] || [];
  const steps = withLayout(pageSteps, mobile).filter((step) => {
    if (step.staffOnly && !isStaff) return false;
    return elementExists(step.element);
  });

  if (steps.length === 0) return null;
  return { ...meta, steps };
}

function elementExists(selector: string): boolean {
  if (typeof document === 'undefined') return true;
  return Boolean(document.querySelector(selector));
}

export function filterExistingSteps(steps: AppTourStep[], isStaff: boolean): AppTourStep[] {
  return steps.filter((step) => {
    if (step.staffOnly && !isStaff) return false;
    return elementExists(step.element);
  });
}
