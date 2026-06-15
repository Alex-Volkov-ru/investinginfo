import { useState } from 'react';
import toast from 'react-hot-toast';
import { BootstrapIcon } from '../BootstrapIcon';
import { adminService } from '../../services/adminService';
import { UserListItem } from '../../services/userService';

interface Props {
  user: UserListItem;
  currentUserId?: number;
  onClose: () => void;
  onDeleted: () => void;
}

export const DeleteUserDialog = ({ user, currentUserId, onClose, onDeleted }: Props) => {
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isSelf = currentUserId != null && user.id === currentUserId;
  const emailMatch = confirmEmail.trim().toLowerCase() === user.email.trim().toLowerCase();

  const onDelete = async () => {
    if (!emailMatch || deleting) return;
    setDeleting(true);
    try {
      const res = await adminService.deleteUser(user.id, confirmEmail.trim());
      toast.success(res.message);
      onDeleted();
      onClose();
    } catch {
      // handled by interceptor
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Удаление пользователя</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Действие необратимо</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1">
            <BootstrapIcon name="x-lg" size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isSelf ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              Нельзя удалить свой аккаунт. Попросите другого администратора.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Будут удалены все данные пользователя: портфели, бюджет, доски, обязательства.
              </p>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 px-3 py-2 text-sm">
                <span className="text-gray-500">Email: </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{user.email}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Введите email для подтверждения
                </label>
                <input
                  type="email"
                  className="input text-sm"
                  placeholder={user.email}
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  autoFocus
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-gray-200 dark:border-gray-700">
          <button type="button" className="btn btn-secondary text-sm" onClick={onClose} disabled={deleting}>
            Отмена
          </button>
          {!isSelf && (
            <button
              type="button"
              className="btn btn-danger text-sm"
              disabled={!emailMatch || deleting}
              onClick={() => void onDelete()}
            >
              {deleting ? 'Удаление...' : 'Удалить навсегда'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
