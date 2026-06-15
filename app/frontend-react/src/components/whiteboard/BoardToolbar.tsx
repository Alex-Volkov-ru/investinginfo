import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  ChevronDown,
  Download,
  Grid3x3,
  HelpCircle,
  LayoutGrid,
  Layers,
  MoreHorizontal,
  Move,
  Paintbrush,
  Plus,
  RefreshCw,
  Save,
  FilePlus,
  Undo2,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { WhiteboardListItem } from '../../types';

interface BoardToolbarProps {
  boardName: string;
  boardList: WhiteboardListItem[];
  currentBoardId: number | null;
  saving: boolean;
  isDirty: boolean;
  gridMode: boolean;
  drawingEnabled: boolean;
  zonesVisible: boolean;
  canUndo: boolean;
  showBoardPicker: boolean;
  isMobile?: boolean;
  onToggleBoardPicker: () => void;
  onSelectBoard: (id: number) => void;
  onSave: () => void;
  onNewBoard: () => void;
  onAddExpense: () => void;
  onAddIncome: () => void;
  onExport: () => void;
  onTemplate: () => void;
  onUndo: () => void;
  onToggleZones: () => void;
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
  zonesVisible,
  canUndo,
  showBoardPicker,
  isMobile = false,
  onToggleBoardPicker,
  onSelectBoard,
  onSave,
  onNewBoard,
  onAddExpense,
  onAddIncome,
  onExport,
  onTemplate,
  onUndo,
  onToggleZones,
  onToggleGrid,
  onToggleDrawing,
  onOpenHelp,
}: BoardToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const iconBtn = (active = false) =>
    `btn text-sm min-h-[44px] min-w-[44px] p-2 flex items-center justify-center ${active ? 'btn-primary' : 'btn-secondary'}`;

  const secondaryActions = (
    <>
      <button type="button" onClick={onUndo} disabled={!canUndo} className={iconBtn()} title="Отменить">
        <Undo2 className="h-4 w-4" />
      </button>
      <button type="button" onClick={onExport} disabled={!currentBoardId} className={iconBtn()} title="В бюджет">
        <Download className="h-4 w-4" />
      </button>
      <button type="button" onClick={onTemplate} className={iconBtn()} title="Шаблон">
        <FilePlus className="h-4 w-4" />
      </button>
      <button type="button" onClick={onNewBoard} className={iconBtn()} title="Новая доска">
        <Plus className="h-4 w-4" />
      </button>
      {!isMobile && (
        <>
          <button type="button" onClick={onToggleZones} className={iconBtn(zonesVisible)} title="Зоны">
            <Layers className="h-4 w-4" />
          </button>
          <button type="button" onClick={onToggleDrawing} className={iconBtn(drawingEnabled)} title="Рисование">
            <Paintbrush className="h-4 w-4" />
          </button>
        </>
      )}
      <button type="button" onClick={onToggleGrid} className={`${iconBtn(gridMode)} ${isMobile ? 'hidden' : ''}`} title="Сетка">
        {gridMode ? <Move className="h-4 w-4" /> : <Grid3x3 className="h-4 w-4" />}
      </button>
      <button type="button" onClick={onOpenHelp} className={iconBtn()} title="Справка">
        <HelpCircle className="h-4 w-4" />
      </button>
    </>
  );

  return (
    <div className="flex flex-col gap-2" data-tour="whiteboard-toolbar">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{boardName}</h2>
          {isDirty && !saving && (
            <span className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap shrink-0">
              не сохранено
            </span>
          )}
          {saving && (
            <span className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1 shrink-0">
              <RefreshCw className="h-3 w-3 animate-spin" />
              …
            </span>
          )}
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBoardPicker();
            }}
            className="btn btn-secondary text-sm min-h-[44px] flex items-center gap-1 px-3"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Доски</span>
            <ChevronDown className="h-4 w-4" />
          </button>
          {showBoardPicker && (
            <div
              className="absolute right-0 mt-1 w-[min(16rem,calc(100vw-2rem))] max-h-60 overflow-y-auto custom-scrollbar rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl z-50 py-1"
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
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
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
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onAddExpense} className="btn btn-primary text-sm min-h-[44px] flex-1 sm:flex-none flex items-center justify-center gap-1.5">
          <Plus className="h-4 w-4" />
          Расход
        </button>
        <button type="button" onClick={onAddIncome} className="btn btn-secondary text-sm min-h-[44px] flex-1 sm:flex-none flex items-center justify-center gap-1.5">
          <TrendingUp className="h-4 w-4" />
          Доход
        </button>
        <button type="button" onClick={onSave} disabled={saving} className="btn btn-secondary text-sm min-h-[44px] flex items-center gap-1.5 px-3">
          <Save className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">Сохранить</span>
        </button>

        {isMobile ? (
          <div className="relative">
            <button type="button" className={iconBtn()} onClick={() => setMoreOpen((v) => !v)} aria-label="Ещё">
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                <div className="absolute right-0 mt-1 z-50 flex flex-wrap gap-1 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl w-48">
                  {secondaryActions}
                </div>
              </>
            )}
          </div>
        ) : (
          secondaryActions
        )}
      </div>

      {isMobile && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
          На телефоне карточки в сетке — удобнее листать и редактировать. Нажмите карандаш на карточке.
        </p>
      )}
    </div>
  );
}
