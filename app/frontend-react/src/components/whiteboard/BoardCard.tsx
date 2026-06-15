import { useEffect, useRef, useState } from 'react';
import { Pencil, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react';
import {
  CARD_COLOR_PRESETS,
  cardAmountFontSize,
  formatMoney,
  getCardLayout,
  isCardItem,
  isIncomeItem,
  itemMarkerColor,
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
  zonesVisible: boolean;
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
  zonesVisible,
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
  const markerColor = itemMarkerColor(item, index);
  const zColor = zonesVisible ? zoneColor(item.zone_id, zones) : undefined;
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

  const width = item.width ?? 180;
  const height = item.height ?? 100;
  const layout = getCardLayout(width, height);
  const amountFontSize = cardAmountFontSize(width, height, isBudget);
  const showCategory = isCardItem(item) && !editing && layout !== 'compact';
  const categoryName = categories.find((c) => c.id === item.category_id)?.name;
  const kindCategories = categories.filter(
    (c) => c.is_active && c.kind === (isIncome ? 'income' : 'expense')
  );

  const padding = layout === 'compact' ? 'p-2' : layout === 'spacious' ? 'p-4' : 'p-3';

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

  const amountColor = isBudget
    ? 'text-emerald-800 dark:text-emerald-200'
    : isIncome
      ? 'text-sky-800 dark:text-sky-200'
      : 'text-gray-900 dark:text-white';

  const cardBg = isBudget
    ? 'bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-900/90 dark:to-teal-950'
    : isIncome
      ? 'bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/90 dark:to-blue-950'
      : 'bg-white dark:bg-gray-800';

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
          relative w-full h-full rounded-xl
          flex flex-col overflow-hidden
          ring-1 ring-gray-300/90 dark:ring-gray-500/90
          border border-gray-300/80 dark:border-gray-600/80
          ${cardBg}
          ${padding} cursor-grab active:cursor-grabbing
        `}
        style={{
          ...(gridMode ? { minHeight: isBudget ? 100 : height } : { width: '100%', height: '100%' }),
          borderLeftWidth: 6,
          borderLeftColor: markerColor,
          borderLeftStyle: 'solid',
          ...(zColor ? { boxShadow: `0 0 0 2px ${zColor}88, inset 0 0 0 1px ${markerColor}33` } : {}),
        }}
        onPointerDown={(e) => {
          if (editing || gridMode) return;
          if ((e.target as HTMLElement).closest('button, input, select, [data-resize-handle], [data-color-handle]')) return;
          e.preventDefault();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          onDragStart(item.id, e.clientX, e.clientY);
        }}
      >
        <div
          className={`relative shrink-0 flex items-center justify-center gap-1.5 ${
            isBudget ? 'mb-1' : 'mb-0.5'
          } ${!isBudget ? 'pr-14' : ''}`}
        >
          {isBudget && <Wallet className="h-4 w-4 shrink-0" style={{ color: markerColor }} />}
          {isIncome && <TrendingUp className="h-4 w-4 shrink-0" style={{ color: markerColor }} />}
          {!isBudget && !isIncome && (
            <TrendingDown className="h-4 w-4 shrink-0" style={{ color: markerColor }} />
          )}
          {editing && isCardItem(item) ? (
            <input
              ref={titleRef}
              className="input text-sm py-1 px-2 w-full text-center"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
            />
          ) : (
            <h3
              className={`font-semibold text-gray-900 dark:text-white leading-tight text-center w-full ${
                layout === 'compact' ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2'
              }`}
            >
              {item.title}
            </h3>
          )}

          {isBudget && (
            <label
              data-color-handle
              className="absolute top-0 right-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              title="Цвет маркера"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span
                className="block w-3.5 h-3.5 rounded-full ring-2 ring-white/80 dark:ring-gray-900/80"
                style={{ backgroundColor: markerColor }}
              />
              <input
                type="color"
                className="sr-only"
                value={markerColor}
                onChange={(e) => onUpdate(item.id, { color: e.target.value })}
              />
            </label>
          )}

          {!isBudget && (
            <div className="absolute top-0 right-0 flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <label
                data-color-handle
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                title="Цвет маркера"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <span
                  className="block w-3.5 h-3.5 rounded-full ring-2 ring-white/80 dark:ring-gray-900/80"
                  style={{ backgroundColor: markerColor }}
                />
                <input
                  type="color"
                  className="sr-only"
                  value={markerColor}
                  onChange={(e) => onUpdate(item.id, { color: e.target.value })}
                />
              </label>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className={`rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 ${isMobile ? 'p-2 min-w-[36px] min-h-[36px]' : 'p-1'}`}
                aria-label="Редактировать"
              >
                <Pencil className={isMobile ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className={`rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 ${isMobile ? 'p-2 min-w-[36px] min-h-[36px]' : 'p-1'}`}
                aria-label="Удалить"
              >
                <X className={isMobile ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
              </button>
            </div>
          )}
        </div>

        {isCardItem(item) && editing && (
          <div className="shrink-0 flex flex-wrap gap-1 justify-center pb-1" data-color-handle>
            {CARD_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className={`w-5 h-5 rounded-full ring-2 ${markerColor === c ? 'ring-primary-500' : 'ring-transparent'}`}
                style={{ backgroundColor: c }}
                onClick={() => onUpdate(item.id, { color: c })}
              />
            ))}
          </div>
        )}

        <div className="relative flex-1 flex items-center justify-center min-h-[1.75rem] overflow-hidden px-1">
          {editing && isCardItem(item) ? (
            <div className="flex gap-1.5 w-full max-w-full items-center justify-center">
              <input
                type="number"
                min={0}
                className="input text-sm py-1 px-2 flex-1 min-w-0 tabular-nums text-center"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
              />
              <button type="button" className="btn btn-primary text-xs px-2 py-1 shrink-0" onClick={commitEdit}>
                OK
              </button>
            </div>
          ) : (
            <p
              className={`font-bold tabular-nums text-center w-full leading-none ${amountColor}`}
              style={{ fontSize: `${amountFontSize}px` }}
              title={formatMoney(item.amount)}
            >
              {formatMoney(item.amount)}
            </p>
          )}
        </div>

        {isCardItem(item) && editing && (
          <div className="shrink-0 pt-1">
            <select
              className="text-xs w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-1.5 py-1 text-gray-800 dark:text-gray-200"
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
          </div>
        )}

        {showCategory && (
          <div className="shrink-0 pt-1">
            <select
              className="text-xs w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-1.5 py-1 text-gray-800 dark:text-gray-200 text-center"
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
          </div>
        )}

        {layout === 'compact' && categoryName && !editing && (
          <p className="shrink-0 text-[10px] text-center text-gray-500 dark:text-gray-400 truncate px-1 pt-0.5">
            {categoryName}
          </p>
        )}

        {!gridMode && (
          <div
            data-resize-handle
            className={`absolute bottom-0 right-0 cursor-se-resize flex items-end justify-end z-10 ${
              isMobile ? 'w-8 h-8 p-1 opacity-90' : 'w-5 h-5 p-0.5 opacity-70 group-hover:opacity-100'
            }`}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onResizeStart(item.id, e.clientX, e.clientY);
            }}
          >
            <svg viewBox="0 0 10 10" className="w-3 h-3 text-gray-600 dark:text-gray-300" aria-hidden>
              <path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 5v4H5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
