import { HelpCircle, X } from 'lucide-react';
import { HELP_STORAGE_KEY } from '../../lib/whiteboardUtils';

interface WhiteboardHelpProps {
  showBanner: boolean;
  showModal: boolean;
  onDismissBanner: () => void;
  onOpenModal: () => void;
  onCloseModal: () => void;
}

const HELP_SECTIONS = [
  {
    title: 'Категории из бюджета',
    text: 'На каждой карточке выберите категорию — те же, что в модуле «Бюджет». Нужны для экспорта в транзакции.',
  },
  {
    title: 'Доходы и расходы',
    text: 'Синие карточки — доходы, белые/цветные — расходы. Остаток считается: бюджет + доходы − расходы.',
  },
  {
    title: 'Зоны приоритетов',
    text: 'Кнопка «слои» включает зоны. Перетащите карточку в зону — она подсветится цветом зоны.',
  },
  {
    title: 'Экспорт в бюджет',
    text: 'Кнопка «В бюджет» создаёт реальные транзакции из карточек с категорией.',
  },
  {
    title: 'Шаблоны и отмена',
    text: '«Шаблон» — готовая доска. Ctrl+Z или кнопка ↩ — отмена последнего действия.',
  },
  {
    title: 'Перемещение и размер',
    text: 'В свободном режиме потяните карточку мышью или пальцем. Уголок внизу справа (при наведении) — изменение размера.',
  },
  {
    title: 'Месячный бюджет',
    text: 'Введите сумму в панели сверху — на доске появится зелёная карточка бюджета. Её тоже можно двигать и менять размер.',
  },
  {
    title: 'Режим сетки',
    text: 'Кнопка с иконкой сетки выстраивает карточки в колонки — удобно на телефоне. Свободный режим — для произвольного расположения.',
  },
  {
    title: 'Калькулятор и рисование',
    text: 'Калькулятор внизу справа: посчитайте и нажмите «На доску». Кисть — рукописные заметки поверх доски.',
  },
  {
    title: 'Сохранение',
    text: '«Сохранить» или автосохранение каждые 30 сек. Переключайте доски через меню «Доски».',
  },
];

export function WhiteboardHelpBanner({ onDismiss, onLearnMore }: { onDismiss: () => void; onLearnMore: () => void }) {
  return (
    <div className="mx-4 mb-3 flex items-start gap-3 rounded-xl border-2 border-sky-300 bg-sky-50 px-4 py-3 shadow-md dark:border-sky-600 dark:bg-slate-800 dark:shadow-lg">
      <HelpCircle className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-sky-950 dark:text-sky-50">
          Первый раз на доске?
        </p>
        <p className="text-xs text-sky-900 dark:text-slate-200 mt-1 leading-relaxed">
          Двойной клик — новый расход · уголок карточки — размер · «Сетка» — колонки на мобильном
        </p>
        <button
          type="button"
          onClick={onLearnMore}
          className="text-xs font-semibold text-sky-700 dark:text-sky-300 hover:underline mt-1.5"
        >
          Подробная инструкция →
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1.5 rounded-lg text-sky-700 hover:bg-sky-100 dark:text-slate-300 dark:hover:bg-slate-700"
        aria-label="Закрыть подсказку"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function WhiteboardHelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary-500" />
            Как пользоваться доской
          </h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto custom-scrollbar px-5 py-4 space-y-4">
          {HELP_SECTIONS.map((section) => (
            <div key={section.title}>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{section.title}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{section.text}</p>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <button type="button" onClick={onClose} className="btn btn-primary w-full text-sm">
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}

export function WhiteboardHelp({
  showBanner,
  showModal,
  onDismissBanner,
  onOpenModal,
  onCloseModal,
}: WhiteboardHelpProps) {
  return (
    <>
      {showBanner && <WhiteboardHelpBanner onDismiss={onDismissBanner} onLearnMore={onOpenModal} />}
      <WhiteboardHelpModal isOpen={showModal} onClose={onCloseModal} />
    </>
  );
}

export function isHelpDismissed(): boolean {
  try {
    return localStorage.getItem(HELP_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissHelp(): void {
  try {
    localStorage.setItem(HELP_STORAGE_KEY, '1');
  } catch {
    // ignore
  }
}
