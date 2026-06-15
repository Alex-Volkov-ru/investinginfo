import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  ChevronDown,
  Grid3x3,
  HelpCircle,
  LayoutGrid,
  Move,
  Paintbrush,
  Plus,
  RefreshCw,
  Save,
  FilePlus,
} from 'lucide-react';
import { WhiteboardListItem } from '../../types';

interface BoardToolbarProps {
  boardName: string;
  boardList: WhiteboardListItem[];
  currentBoardId: number | null;
  saving: boolean;
  isDirty: boolean;
  gridMode: boolean;
  drawingEnabled: boolean;
  showBoardPicker: boolean;
  onToggleBoardPicker: () => void;
  onSelectBoard: (id: number) => void;
  onSave: () => void;
  onNewBoard: () => void;
  onAddExpense: () => void;
  onToggleGrid: () => void;
  onToggleDrawing: () => void;
  onOpenHelp: () => void;
}

export function BoardToolbar({
  boardName,
  boardList,
  currentBoardId,
  saving,
  isDirty,
  gridMode,
  drawingEnabled,
  showBoardPicker,
  onToggleBoardPicker,
  onSelectBoard,
  onSave,
  onNewBoard,
  onAddExpense,
  onToggleGrid,
  onToggleDrawing,
  onOpenHelp,
}: BoardToolbarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{boardName}</h2>
        {isDirty && !saving && (
          <span className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">не сохранено</span>
        )}
        {saving && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            сохранение…
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onAddExpense} className="btn btn-primary text-sm flex items-center gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden xs:inline">Добавить расход</span>
          <span className="xs:hidden">Расход</span>
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="btn btn-secondary text-sm flex items-center gap-1.5"
        >
          <Save className="h-4 w-4" />
          Сохранить
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBoardPicker();
            }}
            className="btn btn-secondary text-sm flex items-center gap-1.5"
          >
            <LayoutGrid className="h-4 w-4" />
            Доски
            <ChevronDown className="h-4 w-4" />
          </button>
          {showBoardPicker && (
            <div
              className="absolute right-0 mt-1 w-64 max-h-60 overflow-y-auto custom-scrollbar rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl z-50 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              {boardList.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-500">Нет сохранённых досок</p>
              ) : (
                boardList.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onSelectBoard(b.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      b.id === currentBoardId ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : ''
                    }`}
                  >
                    <div className="font-medium truncate">{b.name}</div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(b.updated_at), 'd MMM yyyy, HH:mm', { locale: ru })}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <button type="button" onClick={onNewBoard} className="btn btn-secondary text-sm flex items-center gap-1.5">
          <FilePlus className="h-4 w-4" />
          <span className="hidden sm:inline">Новая</span>
        </button>

        <button
          type="button"
          onClick={onToggleGrid}
          className={`btn text-sm flex items-center gap-1.5 ${
            gridMode ? 'btn-primary' : 'btn-secondary'
          }`}
          title={gridMode ? 'Свободный режим' : 'Режим сетки'}
        >
          {gridMode ? <Move className="h-4 w-4" /> : <Grid3x3 className="h-4 w-4" />}
          <span className="hidden sm:inline">{gridMode ? 'Свободно' : 'Сетка'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenHelp}
          className="btn btn-secondary text-sm p-2"
          title="Справка"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onToggleDrawing}
          className={`btn text-sm flex items-center gap-1.5 ${
            drawingEnabled ? 'btn-primary' : 'btn-secondary'
          }`}
          title="Рукописные заметки"
        >
          <Paintbrush className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
