import { BOARD_TEMPLATES } from '../../lib/whiteboardTemplates';

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (templateId: string) => void;
}

export function TemplatePickerModal({ isOpen, onClose, onSelect }: TemplatePickerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Шаблон доски
        </h3>
        <div className="space-y-3">
          {BOARD_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className="w-full text-left rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 p-4 transition-colors bg-gray-50 dark:bg-gray-900/50"
            >
              <div className="font-semibold text-gray-900 dark:text-gray-100">{t.name}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t.description}</div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                Бюджет: {t.budget.toLocaleString('ru-RU')} ₽ · карточек: {t.items.length}
              </div>
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="btn btn-secondary w-full mt-4">
          Отмена
        </button>
      </div>
    </div>
  );
}
