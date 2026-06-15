import { useEffect, useRef, useState } from 'react';
import { Pencil, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react';
import {
  formatMoney,
  CARD_ACCENTS,
  isCardItem,
  isIncomeItem,
  zoneColor,
} from '../../lib/whiteboardUtils';
import { BudgetCategory, WhiteboardItem, WhiteboardZone } from '../../types';

interface BoardCardProps {
  item: WhiteboardItem;
  index: number;
  gridMode: boolean;
  isDragging: boolean;
  isResizing: boolean;
  categories: BudgetCategory[];
  zones: WhiteboardZone[];
  onUpdate: (id: string, patch: Partial<WhiteboardItem>) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string, clientX: number, clientY: number) => void;
  onResizeStart: (id: string, clientX: number, clientY: number) => void;
}

export function BoardCard({
  item,
  index,
  gridMode,
  isDragging,
  isResizing,
  categories,
  zones,
  onUpdate,
  onDelete,
  onDragStart,
  onResizeStart,
}: BoardCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [amount, setAmount] = useState(String(item.amount));
  const titleRef = useRef<HTMLInputElement>(null);
  const isBudget = item.kind === 'budget';
  const isIncome = isIncomeItem(item);
  const zColor = zoneColor(item.zone_id, zones);
  const accent = isBudget
    ? 'border-l-emerald-500'
    : isIncome
      ? 'border-l-sky-500'
      : CARD_ACCENTS[index % CARD_ACCENTS.length];
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

  const width = item.width ?? 180;
  const height = item.height ?? 100;
  const kindCategories = categories.filter(
    (c) => c.is_active && c.kind === (isIncome ? 'income' : 'expense')
  );

  useEffect(() => {
    if (!editing) {
      setTitle(item.title);
      setAmount(String(item.amount));
    }
  }, [item.title, item.amount, editing]);

  useEffect(() => {
    if (editing && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [editing]);

  const commitEdit = () => {
    if (isBudget) {
      setEditing(false);
      return;
    }
    const parsed = Math.max(0, Number(amount) || 0);
    const trimmed = title.trim() || (isIncome ? 'Доход' : 'Расход');
    onUpdate(item.id, { title: trimmed, amount: parsed });
    setEditing(false);
  };

  const cancelEdit = () => {
    setTitle(item.title);
    setAmount(String(item.amount));
    setEditing(false);
  };

  const positionStyle = gridMode
    ? undefined
    : {
        left: item.x,
        top: item.y,
        width,
        height,
        touchAction: 'none' as const,
      };

  const gridSpan = isBudget && gridMode ? 'col-span-full' : '';

  return (
    <div
      data-board-card
      className={`
        group select-none
        ${gridMode ? `relative w-full ${gridSpan}` : 'absolute'}
        ${isDragging || isResizing ? 'z-30 scale-[1.01] shadow-xl' : 'z-10 shadow-md hover:shadow-lg'}
        transition-shadow duration-150
      `}
      style={positionStyle}
      onDoubleClick={() => !isBudget && !isMobile && setEditing(true)}
    >
      <div
        className={`
          relative w-full h-full rounded-xl border-l-4 ${accent}
          flex flex-col overflow-hidden ring-1 ring-gray-300/80 dark:ring-gray-500/80
          ${isBudget
            ? 'bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-900 dark:to-teal-900 border-2 border-emerald-400 dark:border-emerald-500 shadow-lg'
            : isIncome
              ? 'bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950 dark:to-blue-950 border-2 border-sky-400 dark:border-sky-500 shadow-lg'
              : 'bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 shadow-lg'}
          p-3 cursor-grab active:cursor-grabbing
        `}
        style={{
          ...(gridMode ? { minHeight: isBudget ? 100 : height } : { width: '100%', height: '100%' }),
          ...(zColor ? { boxShadow: `0 0 0 2px ${zColor}55` } : {}),
        }}
        onPointerDown={(e) => {
          if (editing || gridMode) return;
          if ((e.target as HTMLElement).closest('button, input, select, [data-resize-handle]')) return;
          e.preventDefault();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          onDragStart(item.id, e.clientX, e.clientY);
        }}
      >
        <div className="flex items-start justify-between gap-1 mb-1 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {isBudget && <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
            {isIncome && <TrendingUp className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />}
            {!isBudget && !isIncome && (
              <TrendingDown className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            )}
            {editing && isCardItem(item) ? (
              <input
                ref={titleRef}
                className="input text-sm py-1 px-2 flex-1 min-w-0"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
              />
            ) : (
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight line-clamp-2">
                {item.title}
              </h3>
            )}
          </div>
          {!isBudget && (
            <div className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Редактировать"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                aria-label="Удалить"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-center min-h-0 gap-1">
          {editing && isCardItem(item) ? (
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                className="input text-sm py-1 px-2 flex-1 tabular-nums"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
              />
              <button type="button" className="btn btn-primary text-xs px-2 py-1" onClick={commitEdit}>
                OK
              </button>
            </div>
          ) : (
            <p
              className={`font-bold tabular-nums truncate ${
                isBudget
                  ? 'text-2xl text-emerald-800 dark:text-emerald-200'
                  : isIncome
                    ? 'text-lg text-sky-800 dark:text-sky-200'
                    : 'text-lg text-gray-900 dark:text-white'
              }`}
            >
              {formatMoney(item.amount)}
            </p>
          )}

          {isCardItem(item) && (
            <select
              className="text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-1.5 py-1 text-gray-800 dark:text-gray-200 max-w-full"
              value={item.category_id ?? ''}
              onChange={(e) =>
                onUpdate(item.id, {
                  category_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              onPointerDown={(e) => e.stopPropagation()}
            >
              <option value="">Категория…</option>
              {kindCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {!gridMode && (
          <div
            data-resize-handle
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-0.5 opacity-60 group-hover:opacity-100"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onResizeStart(item.id, e.clientX, e.clientY);
            }}
          >
            <svg viewBox="0 0 10 10" className="w-3 h-3 text-gray-500" aria-hidden>
              <path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 5v4H5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
