import { X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Удалить',
  cancelText = 'Отмена',
  confirmButtonClass = 'btn-danger',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button
            onClick={onCancel}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-gray-700 dark:text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <button onClick={onCancel} className="btn btn-secondary">
            {cancelText}
          </button>
          <button onClick={onConfirm} className={`btn ${confirmButtonClass}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

