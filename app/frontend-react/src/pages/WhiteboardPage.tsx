import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AddCardModal } from '../components/whiteboard/AddCardModal';
import { BoardCard } from '../components/whiteboard/BoardCard';
import { BoardToolbar } from '../components/whiteboard/BoardToolbar';
import { BoardZones } from '../components/whiteboard/BoardZones';
import { BudgetPanel } from '../components/whiteboard/BudgetPanel';
import { CalculatorWidget } from '../components/whiteboard/CalculatorWidget';
import { DrawingCanvas } from '../components/whiteboard/DrawingCanvas';
import { ExportToBudgetModal } from '../components/whiteboard/ExportToBudgetModal';
import { TemplatePickerModal } from '../components/whiteboard/TemplatePickerModal';
import { useBoardUndo } from '../hooks/useBoardUndo';
import { useTour } from '../contexts/TourContext';
import {
  AUTO_SAVE_INTERVAL_MS,
  clampCardSize,
  DEFAULT_ZONES,
  defaultBoardName,
  detectZoneForItem,
  ensureBudgetCard,
  generateItemId,
  isCardItem,
  isExpenseItem,
  isIncomeItem,
  MIN_CARD_HEIGHT,
  MIN_CARD_WIDTH,
  normalizeItem,
  sanitizeBoardItems,
} from '../lib/whiteboardUtils';
import { BOARD_TEMPLATES, applyTemplate } from '../lib/whiteboardTemplates';
import { budgetService } from '../services/budgetService';
import { whiteboardService } from '../services/whiteboardService';
import { BudgetAccount, BudgetCategory, WhiteboardItem, WhiteboardListItem, WhiteboardZone } from '../types';

const WhiteboardPage = () => {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; itemX: number; itemY: number } | null>(null);
  const resizeRef = useRef<{ id: string; startX: number; startY: number; startW: number; startH: number } | null>(null);

  const [boardId, setBoardId] = useState<number | null>(null);
  const [boardName, setBoardName] = useState(defaultBoardName());
  const [budget, setBudget] = useState(0);
  const [items, setItems] = useState<WhiteboardItem[]>([]);
  const [zones, setZones] = useState<WhiteboardZone[]>([]);
  const [canvasData, setCanvasData] = useState<string | null>(null);
  const [boardList, setBoardList] = useState<WhiteboardListItem[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [accounts, setAccounts] = useState<BudgetAccount[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);

  const [gridMode, setGridMode] = useState(false);
  const [zonesVisible, setZonesVisible] = useState(true);
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [showBoardPicker, setShowBoardPicker] = useState(false);
  const { startTour } = useTour();
  const [addCardKind, setAddCardKind] = useState<'expense' | 'income' | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
  } | null>(null);

  const { pushUndo, undo, canUndo, clearUndo } = useBoardUndo();

  const expenseTotal = useMemo(
    () => items.filter(isExpenseItem).reduce((s, i) => s + i.amount, 0),
    [items]
  );
  const incomeTotal = useMemo(
    () => items.filter(isIncomeItem).reduce((s, i) => s + i.amount, 0),
    [items]
  );
  const budgetCard = useMemo(() => items.find((i) => i.kind === 'budget'), [items]);
  const cardItems = useMemo(() => items.filter(isCardItem), [items]);

  const getSnapshot = useCallback(
    () => ({ items, zones, budget, canvasData, boardName }),
    [items, zones, budget, canvasData, boardName]
  );

  const markDirty = useCallback(() => setIsDirty(true), []);

  const commitChange = useCallback(
    (mutate: () => void, trackUndo = true) => {
      if (trackUndo) pushUndo(getSnapshot());
      mutate();
      markDirty();
    },
    [getSnapshot, pushUndo, markDirty]
  );

  const applyBoard = useCallback(
    (data: {
      id: number;
      name: string;
      budget: number;
      items: WhiteboardItem[];
      zones?: WhiteboardZone[];
      canvas_data: string | null;
    }) => {
      setBoardId(data.id);
      setBoardName(data.name);
      setBudget(data.budget);
      setItems(ensureBudgetCard((data.items || []).map(normalizeItem), data.budget));
      setZones(data.zones?.length ? data.zones : []);
      setCanvasData(data.canvas_data);
      setIsDirty(false);
      clearUndo();
    },
    [clearUndo]
  );

  useEffect(() => {
    (async () => {
      try {
        const [cats, accs] = await Promise.all([
          budgetService.getCategories(),
          budgetService.getAccounts(),
        ]);
        setCategories(cats);
        setAccounts(accs);
      } catch {
        // interceptor
      }
    })();
  }, []);

  const refreshBoardList = useCallback(async () => {
    try {
      setBoardList(await whiteboardService.list());
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
        if (!latest.zones?.length) setZonesVisible(false);
      } else {
        setBoardId(null);
        setBoardName(defaultBoardName());
        setBudget(0);
        setItems([]);
        setZones([]);
        setCanvasData(null);
        setZonesVisible(false);
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        const snap = undo();
        if (!snap) return;
        setItems(snap.items);
        setZones(snap.zones);
        setBudget(snap.budget);
        setCanvasData(snap.canvasData);
        setBoardName(snap.boardName);
        markDirty();
        toast.success('Отменено');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, markDirty]);

  const buildPayload = useCallback(
    () => ({
      name: boardName,
      budget,
      items: sanitizeBoardItems(ensureBudgetCard(items, budget)),
      zones,
      canvas_data: canvasData,
    }),
    [boardName, budget, items, zones, canvasData]
  );

  const saveBoard = useCallback(
    async (silent = false) => {
      if (saving) return;
      setSaving(true);
      try {
        const payload = buildPayload();
        const opts = { silent };
        if (boardId) {
          applyBoard(await whiteboardService.update(boardId, payload, opts));
        } else {
          applyBoard(
            await whiteboardService.create({ ...payload, name: payload.name || defaultBoardName() }, opts)
          );
        }
        await refreshBoardList();
        if (!silent) toast.success('Доска сохранена');
      } catch {
        if (!silent) {
          // ошибки ручного сохранения показывает interceptor
        }
      } finally {
        setSaving(false);
      }
    },
    [saving, buildPayload, boardId, applyBoard, refreshBoardList]
  );

  useEffect(() => {
    if (!isDirty || loading) return;
    const timer = window.setInterval(() => saveBoard(true), AUTO_SAVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isDirty, loading, saveBoard]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (resizeRef.current) {
        const { id, startX, startY, startW, startH } = resizeRef.current;
        const size = clampCardSize(startW + (e.clientX - startX), startH + (e.clientY - startY));
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, ...size } : it))
        );
        markDirty();
        return;
      }
      if (!dragRef.current || gridMode) return;
      const { id, startX, startY, itemX, itemY } = dragRef.current;
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? {
                ...it,
                x: Math.max(0, itemX + e.clientX - startX),
                y: Math.max(0, itemY + e.clientY - startY),
              }
            : it
        )
      );
      markDirty();
    };

    const onUp = () => {
      if (dragRef.current && !gridMode && zones.length > 0) {
        const { id } = dragRef.current;
        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== id) return it;
            const zone_id = detectZoneForItem(it, zones);
            return { ...it, zone_id };
          })
        );
      }
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
  }, [gridMode, markDirty, zones]);

  const addCard = (
    kind: 'expense' | 'income',
    partial: { title: string; amount: number; category_id?: number; x?: number; y?: number }
  ) => {
    const board = boardRef.current;
    const x = partial.x ?? (board ? Math.max(20, board.clientWidth / 2 - 90) : 100);
    const y = partial.y ?? (board ? Math.max(20, board.clientHeight / 2 - 50) : 100);
    const item = normalizeItem({
      id: generateItemId(),
      kind,
      title: partial.title,
      amount: partial.amount,
      category_id: partial.category_id ?? null,
      x,
      y,
      zone_id: detectZoneForItem({ x, y, width: 180, height: 100 } as WhiteboardItem, zones),
    });
    commitChange(() => setItems((prev) => ensureBudgetCard([...prev, item], budget)));
  };

  const handleBoardDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gridMode || drawingEnabled) return;
    if ((e.target as HTMLElement).closest('[data-board-card]')) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    addCard('expense', {
      title: 'Новый расход',
      amount: 0,
      x: e.clientX - rect.left - 80,
      y: e.clientY - rect.top - 44,
    });
  };

  const handleBudgetChange = (value: number) => {
    commitChange(() => {
      setBudget(value);
      setItems((prev) => ensureBudgetCard(prev, value));
    });
  };

  const handleToggleZones = () => {
    if (zones.length === 0) {
      commitChange(() => setZones(DEFAULT_ZONES.map((z) => ({ ...z }))));
      setZonesVisible(true);
      toast.success('Зоны добавлены на доску');
      return;
    }
    setZonesVisible((v) => !v);
  };

  const handleApplyTemplate = (templateId: string) => {
    const tpl = BOARD_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const applied = applyTemplate(tpl);
    commitChange(() => {
      setBoardName(applied.name);
      setBudget(applied.budget);
      setZones(applied.zones);
      setItems(ensureBudgetCard(applied.items.map(normalizeItem), applied.budget));
      setZonesVisible(true);
    });
    setShowTemplateModal(false);
    toast.success(`Шаблон «${tpl.name}» применён`);
  };

  const handleExport = async (accountId: number, occurredAt: string) => {
    if (!boardId) {
      toast.error('Сначала сохраните доску');
      return;
    }
    setExporting(true);
    try {
      const result = await whiteboardService.exportToBudget(boardId, {
        account_id: accountId,
        occurred_at: occurredAt,
      });
      toast.success(`Создано транзакций: ${result.created}`);
      if (result.skipped > 0) {
        toast.error(`Пропущено: ${result.skipped}. Назначьте категории карточкам.`);
      }
      setShowExportModal(false);
    } catch {
      // interceptor
    } finally {
      setExporting(false);
    }
  };

  const loadBoardById = async (id: number) => {
    applyBoard(await whiteboardService.getById(id));
    setShowBoardPicker(false);
    toast.success('Доска загружена');
  };

  const renderCard = (item: WhiteboardItem, index: number) => (
    <BoardCard
      key={item.id}
      item={item}
      index={index}
      gridMode={gridMode}
      isDragging={draggingId === item.id}
      isResizing={resizingId === item.id}
      categories={categories}
      zones={zones}
      onUpdate={(id, patch) => {
        commitChange(() =>
          setItems((prev) => ensureBudgetCard(
            prev.map((it) => (it.id === id ? normalizeItem({ ...it, ...patch }) : it)),
            budget
          ))
        , false);
      }}
      onDelete={(id) => {
        commitChange(() => setItems((prev) => ensureBudgetCard(prev.filter((it) => it.id !== id), budget)));
      }}
      onDragStart={(id, clientX, clientY) => {
        if (gridMode) return;
        pushUndo(getSnapshot());
        const target = items.find((it) => it.id === id);
        if (!target) return;
        dragRef.current = { id, startX: clientX, startY: clientY, itemX: target.x, itemY: target.y };
        setDraggingId(id);
      }}
      onResizeStart={(id, clientX, clientY) => {
        if (gridMode) return;
        pushUndo(getSnapshot());
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
      <div className="flex items-center justify-center min-h-[50vh] text-gray-500 dark:text-gray-400">
        Загрузка доски…
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
          zonesVisible={zonesVisible}
          canUndo={canUndo}
          showBoardPicker={showBoardPicker}
          onToggleBoardPicker={() => setShowBoardPicker((v) => !v)}
          onSelectBoard={loadBoardById}
          onSave={() => saveBoard(false)}
          onNewBoard={() => {
            setNewBoardName(defaultBoardName());
            setShowNewBoardModal(true);
          }}
          onAddExpense={() => setAddCardKind('expense')}
          onAddIncome={() => setAddCardKind('income')}
          onExport={() => (boardId ? setShowExportModal(true) : toast.error('Сначала сохраните доску'))}
          onTemplate={() => setShowTemplateModal(true)}
          onUndo={() => {
            const snap = undo();
            if (!snap) return;
            setItems(snap.items);
            setZones(snap.zones);
            setBudget(snap.budget);
            setCanvasData(snap.canvasData);
            setBoardName(snap.boardName);
            markDirty();
          }}
          onToggleZones={handleToggleZones}
          onToggleGrid={() => setGridMode((v) => !v)}
          onToggleDrawing={() => setDrawingEnabled((v) => !v)}
          onOpenHelp={() => startTour(true)}
        />
        <BudgetPanel
          budget={budget}
          incomeTotal={incomeTotal}
          expenseTotal={expenseTotal}
          gridMode={gridMode}
          onBudgetChange={handleBudgetChange}
          onResetExpenses={() => {
            setConfirmDialog({
              title: 'Сбросить карточки?',
              message: 'Удалятся все доходы и расходы. Бюджет и зоны останутся.',
              confirmText: 'Сбросить',
              onConfirm: () => {
                commitChange(() =>
                  setItems((prev) => ensureBudgetCard(prev.filter((i) => i.kind === 'budget'), budget))
                );
                setConfirmDialog(null);
              },
            });
          }}
        />
      </div>

      <div
        ref={boardRef}
        data-tour="whiteboard-canvas"
        className={`relative flex-1 min-h-[480px] overflow-auto custom-scrollbar whiteboard-grid ${
          gridMode ? 'whiteboard-grid-active' : ''
        }`}
        onDoubleClick={handleBoardDoubleClick}
      >
        <BoardZones zones={zones} visible={zonesVisible} gridMode={gridMode} />
        <DrawingCanvas
          enabled={drawingEnabled}
          canvasData={canvasData}
          onChange={(data) => commitChange(() => setCanvasData(data), false)}
        />

        {cardItems.length === 0 && !budgetCard && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[2]">
            <p className="text-gray-500 dark:text-gray-400 text-center px-6">
              Шаблон · Расход/Доход · категории из бюджета · зоны (иконка слоёв)
            </p>
          </div>
        )}

        {gridMode ? (
          <div className="relative z-10 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgetCard && renderCard(budgetCard, -1)}
            {cardItems.map((item, i) => renderCard(item, i))}
          </div>
        ) : (
          <div className="relative z-10 min-h-[640px] min-w-full">
            {budgetCard && renderCard(budgetCard, -1)}
            {cardItems.map((item, i) => renderCard(item, i))}
          </div>
        )}

        <div className="fixed bottom-4 right-4 z-40">
          <CalculatorWidget
            onSendToBoard={(amount) => addCard('expense', { title: `Калькулятор: ${amount}`, amount })}
          />
        </div>
      </div>

      <AddCardModal
        isOpen={addCardKind !== null}
        kind={addCardKind ?? 'expense'}
        categories={categories}
        onClose={() => setAddCardKind(null)}
        onSubmit={(data) => {
          if (addCardKind) addCard(addCardKind, data);
          setAddCardKind(null);
        }}
      />

      <ExportToBudgetModal
        isOpen={showExportModal}
        accounts={accounts}
        loading={exporting}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
      />

      <TemplatePickerModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelect={handleApplyTemplate}
      />

      {showNewBoardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Новая доска</h3>
            <input
              className="input mb-4"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (() => {
                commitChange(() => {
                  setBoardId(null);
                  setBoardName(newBoardName.trim() || defaultBoardName());
                  setBudget(0);
                  setItems([]);
                  setZones([]);
                  setCanvasData(null);
                });
                setShowNewBoardModal(false);
              })()}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setShowNewBoardModal(false)}>Отмена</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  commitChange(() => {
                    setBoardId(null);
                    setBoardName(newBoardName.trim() || defaultBoardName());
                    setBudget(0);
                    setItems([]);
                    setZones([]);
                    setCanvasData(null);
                  });
                  setShowNewBoardModal(false);
                }}
              >
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
