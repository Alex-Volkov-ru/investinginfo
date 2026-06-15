import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BudgetPanel } from '../components/whiteboard/BudgetPanel';
import { BoardToolbar } from '../components/whiteboard/BoardToolbar';
import { BoardCard } from '../components/whiteboard/BoardCard';
import { CalculatorWidget } from '../components/whiteboard/CalculatorWidget';
import { DrawingCanvas } from '../components/whiteboard/DrawingCanvas';
import { WhiteboardHelp, dismissHelp, isHelpDismissed } from '../components/whiteboard/WhiteboardHelp';
import { whiteboardService } from '../services/whiteboardService';
import { WhiteboardItem, WhiteboardListItem } from '../types';
import {
  AUTO_SAVE_INTERVAL_MS,
  defaultBoardName,
  ensureBudgetCard,
  generateItemId,
  isExpenseItem,
  MIN_CARD_HEIGHT,
  MIN_CARD_WIDTH,
  normalizeItem,
} from '../lib/whiteboardUtils';

const WhiteboardPage = () => {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    itemX: number;
    itemY: number;
  } | null>(null);
  const resizeRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const [boardId, setBoardId] = useState<number | null>(null);
  const [boardName, setBoardName] = useState(defaultBoardName());
  const [budget, setBudget] = useState(0);
  const [items, setItems] = useState<WhiteboardItem[]>([]);
  const [canvasData, setCanvasData] = useState<string | null>(null);
  const [boardList, setBoardList] = useState<WhiteboardListItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);

  const [gridMode, setGridMode] = useState(false);
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [showBoardPicker, setShowBoardPicker] = useState(false);
  const [showHelpBanner, setShowHelpBanner] = useState(() => !isHelpDismissed());
  const [showHelpModal, setShowHelpModal] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newExpense, setNewExpense] = useState({ title: '', amount: '' });
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
  } | null>(null);

  const expenseTotal = useMemo(
    () => items.filter(isExpenseItem).reduce((sum, item) => sum + item.amount, 0),
    [items]
  );

  const budgetCard = useMemo(() => items.find((i) => i.kind === 'budget'), [items]);
  const expenseItems = useMemo(() => items.filter(isExpenseItem), [items]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const syncItems = useCallback((nextItems: WhiteboardItem[], nextBudget: number) => {
    setItems(ensureBudgetCard(nextItems.map(normalizeItem), nextBudget));
  }, []);

  const applyBoard = useCallback(
    (data: { id: number; name: string; budget: number; items: WhiteboardItem[]; canvas_data: string | null }) => {
      setBoardId(data.id);
      setBoardName(data.name);
      setBudget(data.budget);
      setItems(ensureBudgetCard((data.items || []).map(normalizeItem), data.budget));
      setCanvasData(data.canvas_data);
      setIsDirty(false);
    },
    []
  );

  const refreshBoardList = useCallback(async () => {
    try {
      const list = await whiteboardService.list();
      setBoardList(list);
    } catch {
      // interceptor
    }
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const [latest, list] = await Promise.all([
        whiteboardService.getLatest(),
        whiteboardService.list(),
      ]);
      setBoardList(list);
      if (latest) {
        applyBoard(latest);
      } else {
        setBoardId(null);
        setBoardName(defaultBoardName());
        setBudget(0);
        setItems([]);
        setCanvasData(null);
        setIsDirty(false);
      }
    } catch {
      // interceptor
    } finally {
      setLoading(false);
    }
  }, [applyBoard]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!showBoardPicker) return;
    const close = () => setShowBoardPicker(false);
    const t = window.setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('click', close);
    };
  }, [showBoardPicker]);

  const buildPayload = useCallback(
    () => ({
      name: boardName,
      budget,
      items,
      canvas_data: canvasData,
    }),
    [boardName, budget, items, canvasData]
  );

  const saveBoard = useCallback(
    async (silent = false) => {
      if (saving) return;
      setSaving(true);
      try {
        const payload = buildPayload();
        if (boardId) {
          const updated = await whiteboardService.update(boardId, payload);
          applyBoard(updated);
        } else {
          const created = await whiteboardService.create({
            ...payload,
            name: payload.name || defaultBoardName(),
          });
          applyBoard(created);
        }
        await refreshBoardList();
        if (!silent) toast.success('Доска сохранена');
      } catch {
        // interceptor
      } finally {
        setSaving(false);
      }
    },
    [saving, buildPayload, boardId, applyBoard, refreshBoardList]
  );

  useEffect(() => {
    if (!isDirty || loading) return;
    const timer = window.setInterval(() => {
      saveBoard(true);
    }, AUTO_SAVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isDirty, loading, saveBoard]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (resizeRef.current) {
        const { id, startX, startY, startW, startH } = resizeRef.current;
        const dw = e.clientX - startX;
        const dh = e.clientY - startY;
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  width: Math.max(MIN_CARD_WIDTH, Math.round(startW + dw)),
                  height: Math.max(MIN_CARD_HEIGHT, Math.round(startH + dh)),
                }
              : it
          )
        );
        markDirty();
        return;
      }

      if (!dragRef.current || gridMode) return;
      const { id, startX, startY, itemX, itemY } = dragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? { ...it, x: Math.max(0, itemX + dx), y: Math.max(0, itemY + dy) }
            : it
        )
      );
      markDirty();
    };

    const onUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
      setDraggingId(null);
      setResizingId(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [gridMode, markDirty]);

  const addItem = (partial: { title: string; amount: number; x?: number; y?: number }) => {
    const board = boardRef.current;
    const x = partial.x ?? (board ? Math.max(20, board.clientWidth / 2 - 90) : 100);
    const y = partial.y ?? (board ? Math.max(20, board.clientHeight / 2 - 50) : 100);
    const item = normalizeItem({
      id: generateItemId(),
      kind: 'expense',
      title: partial.title,
      amount: partial.amount,
      x,
      y,
    });
    setItems((prev) => ensureBudgetCard([...prev, item], budget));
    markDirty();
  };

  const handleBoardDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gridMode || drawingEnabled) return;
    if ((e.target as HTMLElement).closest('[data-board-card]')) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    addItem({
      title: 'Новый расход',
      amount: 0,
      x: e.clientX - rect.left - 80,
      y: e.clientY - rect.top - 44,
    });
  };

  const handleBudgetChange = (value: number) => {
    setBudget(value);
    setItems((prev) => ensureBudgetCard(prev, value));
    markDirty();
  };

  const handleToggleGrid = () => {
    setGridMode((prev) => {
      const next = !prev;
      toast.success(
        next
          ? 'Режим сетки: карточки выстроены в колонки'
          : 'Свободный режим: перетаскивание и изменение размера'
      );
      return next;
    });
  };

  const handleAddExpenseSubmit = () => {
    const title = newExpense.title.trim() || 'Расход';
    const amount = Math.max(0, Number(newExpense.amount) || 0);
    addItem({ title, amount });
    setNewExpense({ title: '', amount: '' });
    setShowAddModal(false);
  };

  const handleLoadBoard = async (id: number) => {
    if (isDirty) {
      setConfirmDialog({
        title: 'Несохранённые изменения',
        message: 'Загрузить другую доску? Текущие изменения могут быть потеряны.',
        confirmText: 'Загрузить',
        onConfirm: async () => {
          setConfirmDialog(null);
          await loadBoardById(id);
        },
      });
      return;
    }
    await loadBoardById(id);
  };

  const loadBoardById = async (id: number) => {
    try {
      const board = await whiteboardService.getById(id);
      applyBoard(board);
      setShowBoardPicker(false);
      toast.success(`Загружена: ${board.name}`);
    } catch {
      // interceptor
    }
  };

  const handleNewBoard = () => {
    if (isDirty) {
      setConfirmDialog({
        title: 'Несохранённые изменения',
        message: 'Создать новую доску? Несохранённые изменения будут потеряны.',
        confirmText: 'Создать',
        onConfirm: () => {
          setConfirmDialog(null);
          setNewBoardName(defaultBoardName());
          setShowNewBoardModal(true);
        },
      });
      return;
    }
    setNewBoardName(defaultBoardName());
    setShowNewBoardModal(true);
  };

  const confirmNewBoard = () => {
    const name = newBoardName.trim() || defaultBoardName();
    setBoardId(null);
    setBoardName(name);
    setBudget(0);
    setItems([]);
    setCanvasData(null);
    setIsDirty(true);
    setShowNewBoardModal(false);
    toast.success('Новая доска создана');
  };

  const handleResetExpenses = () => {
    setConfirmDialog({
      title: 'Сбросить расходы?',
      message: 'Все карточки расходов будут удалены. Карточка бюджета останется.',
      confirmText: 'Сбросить',
      onConfirm: () => {
        syncItems(items.filter((i) => i.kind === 'budget'), budget);
        markDirty();
        setConfirmDialog(null);
        toast.success('Карточки расходов удалены');
      },
    });
  };

  const handleCalculatorSend = (amount: number) => {
    addItem({ title: `Калькулятор: ${amount}`, amount });
    toast.success('Карточка добавлена');
  };

  const handleDismissHelp = () => {
    dismissHelp();
    setShowHelpBanner(false);
  };

  const renderCard = (item: WhiteboardItem, index: number) => (
    <BoardCard
      key={item.id}
      item={item}
      index={index}
      gridMode={gridMode}
      isDragging={draggingId === item.id}
      isResizing={resizingId === item.id}
      onUpdate={(id, patch) => {
        setItems((prev) => {
          const next = prev.map((it) => (it.id === id ? normalizeItem({ ...it, ...patch }) : it));
          return ensureBudgetCard(next, budget);
        });
        markDirty();
      }}
      onDelete={(id) => {
        setItems((prev) => ensureBudgetCard(prev.filter((it) => it.id !== id), budget));
        markDirty();
      }}
      onDragStart={(id, clientX, clientY) => {
        if (gridMode) return;
        const target = items.find((it) => it.id === id);
        if (!target) return;
        dragRef.current = {
          id,
          startX: clientX,
          startY: clientY,
          itemX: target.x,
          itemY: target.y,
        };
        setDraggingId(id);
      }}
      onResizeStart={(id, clientX, clientY) => {
        if (gridMode) return;
        const target = items.find((it) => it.id === id);
        if (!target) return;
        resizeRef.current = {
          id,
          startX: clientX,
          startY: clientY,
          startW: target.width ?? MIN_CARD_WIDTH,
          startH: target.height ?? MIN_CARD_HEIGHT,
        };
        setResizingId(id);
      }}
    />
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-gray-500 dark:text-gray-400">Загрузка доски…</div>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="flex flex-col gap-3 p-4 sm:p-6 border-b-2 border-gray-300 dark:border-gray-700 bg-slate-100 dark:bg-gray-900">
        <BoardToolbar
          boardName={boardName}
          boardList={boardList}
          currentBoardId={boardId}
          saving={saving}
          isDirty={isDirty}
          gridMode={gridMode}
          drawingEnabled={drawingEnabled}
          showBoardPicker={showBoardPicker}
          onToggleBoardPicker={() => setShowBoardPicker((v) => !v)}
          onSelectBoard={handleLoadBoard}
          onSave={() => saveBoard(false)}
          onNewBoard={handleNewBoard}
          onAddExpense={() => setShowAddModal(true)}
          onToggleGrid={handleToggleGrid}
          onToggleDrawing={() => setDrawingEnabled((v) => !v)}
          onOpenHelp={() => setShowHelpModal(true)}
        />
        <BudgetPanel
          budget={budget}
          expenseTotal={expenseTotal}
          gridMode={gridMode}
          onBudgetChange={handleBudgetChange}
          onResetExpenses={handleResetExpenses}
        />
      </div>

      {showHelpBanner && (
        <div className="pt-3">
          <WhiteboardHelp
            showBanner
            showModal={false}
            onDismissBanner={handleDismissHelp}
            onOpenModal={() => setShowHelpModal(true)}
            onCloseModal={() => setShowHelpModal(false)}
          />
        </div>
      )}

      <div
        ref={boardRef}
        className={`relative flex-1 min-h-[420px] overflow-auto custom-scrollbar whiteboard-grid ${
          gridMode ? 'whiteboard-grid-active' : ''
        }`}
        onDoubleClick={handleBoardDoubleClick}
      >
        <DrawingCanvas
          enabled={drawingEnabled}
          canvasData={canvasData}
          onChange={(data) => {
            setCanvasData(data);
            markDirty();
          }}
        />

        {expenseItems.length === 0 && !budgetCard && !drawingEnabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[2]">
            <div className="text-center px-6 max-w-md">
              <p className="text-gray-400 dark:text-gray-500 text-lg font-medium mb-1">
                Пустая доска
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-600">
                Введите бюджет сверху · двойной клик — расход · ? — справка
              </p>
            </div>
          </div>
        )}

        {gridMode ? (
          <div className="relative z-10 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-h-full auto-rows-min">
            {budgetCard && renderCard(budgetCard, -1)}
            {expenseItems.map((item, index) => renderCard(item, index))}
          </div>
        ) : (
          <div className="relative z-10 min-h-full min-w-full" style={{ minHeight: '600px' }}>
            {budgetCard && renderCard(budgetCard, -1)}
            {expenseItems.map((item, index) => renderCard(item, index))}
          </div>
        )}

        <div className="fixed bottom-4 right-4 z-40 max-w-[calc(100vw-2rem)] sm:max-w-none pointer-events-auto">
          <CalculatorWidget onSendToBoard={handleCalculatorSend} />
        </div>
      </div>

      <WhiteboardHelp
        showBanner={false}
        showModal={showHelpModal}
        onDismissBanner={handleDismissHelp}
        onOpenModal={() => setShowHelpModal(true)}
        onCloseModal={() => setShowHelpModal(false)}
      />

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Новый расход</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название</label>
                <input
                  className="input"
                  value={newExpense.title}
                  onChange={(e) => setNewExpense((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Продукты, аренда…"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Сумма, ₽</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Отмена
                </button>
                <button type="button" className="btn btn-primary" onClick={handleAddExpenseSubmit}>
                  Добавить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewBoardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Новая доска</h3>
            <input
              className="input mb-4"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="Название доски"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && confirmNewBoard()}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setShowNewBoardModal(false)}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmNewBoard}>
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <ConfirmDialog
          isOpen
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

export default WhiteboardPage;
