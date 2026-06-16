import { WhiteboardItem, WhiteboardZone } from '../types';

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
}

export function generateItemId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultBoardName(): string {
  const now = new Date();
  return `Доска ${now.toLocaleDateString('ru-RU')}`;
}

export const BUDGET_CARD_ID = '__budget_card__';
export const HELP_STORAGE_KEY = 'whiteboard_help_dismissed';

export const DEFAULT_CARD_WIDTH = 180;
export const DEFAULT_CARD_HEIGHT = 100;
export const DEFAULT_BUDGET_WIDTH = 220;
export const DEFAULT_BUDGET_HEIGHT = 120;
export const MIN_CARD_WIDTH = 140;
export const MIN_CARD_HEIGHT = 96;
export const MAX_CARD_WIDTH = 1200;
export const MAX_CARD_HEIGHT = 800;

export type CardLayout = 'compact' | 'normal' | 'spacious';

export function clampCardSize(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.round(Math.min(MAX_CARD_WIDTH, Math.max(MIN_CARD_WIDTH, width))),
    height: Math.round(Math.min(MAX_CARD_HEIGHT, Math.max(MIN_CARD_HEIGHT, height))),
  };
}

/** Адаптивная вёрстка карточки под текущий размер */
export function getCardLayout(width: number, height: number): CardLayout {
  if (width < 160 || height < 110) return 'compact';
  if (width >= 220 && height >= 140) return 'spacious';
  return 'normal';
}

/** Размер шрифта суммы пропорционален плашке */
export function cardAmountFontSize(width: number, height: number, isBudget: boolean): number {
  const byWidth = width * (isBudget ? 0.11 : 0.1);
  const byHeight = height * (isBudget ? 0.26 : 0.22);
  const size = Math.min(byWidth, byHeight);
  if (isBudget) return Math.round(Math.max(16, Math.min(32, size)));
  return Math.round(Math.max(13, Math.min(24, size)));
}

export const CARD_COLOR_PRESETS = [
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#0ea5e9',
  '#8b5cf6',
  '#f97316',
  '#ec4899',
  '#14b8a6',
] as const;

export const DEFAULT_INCOME_COLOR = '#0ea5e9';
export const DEFAULT_EXPENSE_COLOR = '#f43f5e';
export const DEFAULT_BUDGET_COLOR = '#10b981';

export const MIN_ZONE_WIDTH = 120;
export const MIN_ZONE_HEIGHT = 96;

export const AUTO_SAVE_INTERVAL_MS = 30_000;

export const BOARD_GRID_SIZE = 16;
export const SNAP_THRESHOLD = 12;
export const CARD_SNAP_GAP = 12;

export const DEFAULT_ZONES: WhiteboardZone[] = [
  {
    id: 'zone_must',
    title: 'Обязательное',
    color: '#ef4444',
    x: 24,
    y: 180,
    width: 300,
    height: 220,
    priority: 1,
  },
  {
    id: 'zone_later',
    title: 'Можно отложить',
    color: '#f59e0b',
    x: 340,
    y: 180,
    width: 300,
    height: 220,
    priority: 2,
  },
  {
    id: 'zone_wants',
    title: 'Хотелки',
    color: '#8b5cf6',
    x: 656,
    y: 180,
    width: 300,
    height: 220,
    priority: 3,
  },
];

export function normalizeItem(item: WhiteboardItem): WhiteboardItem {
  const kind = item.kind || 'expense';
  const isBudget = kind === 'budget';
  const defaults = {
    width: isBudget ? DEFAULT_BUDGET_WIDTH : DEFAULT_CARD_WIDTH,
    height: isBudget ? DEFAULT_BUDGET_HEIGHT : DEFAULT_CARD_HEIGHT,
  };
  const { width, height } = clampCardSize(item.width ?? defaults.width, item.height ?? defaults.height);
  return {
    ...item,
    kind,
    width,
    height,
    x: Math.max(0, Math.round(item.x ?? 0)),
    y: Math.max(0, Math.round(item.y ?? 0)),
    amount: Math.max(0, Number(item.amount) || 0),
    category_id: item.category_id ?? null,
    zone_id: item.zone_id ?? null,
    color: item.color ?? null,
  };
}

export function defaultItemColor(kind: WhiteboardItem['kind'], index = 0): string {
  if (kind === 'budget') return DEFAULT_BUDGET_COLOR;
  if (kind === 'income') return DEFAULT_INCOME_COLOR;
  return CARD_COLOR_PRESETS[index % CARD_COLOR_PRESETS.length];
}

export function itemMarkerColor(item: WhiteboardItem, index = 0): string {
  if (item.color) return item.color;
  return defaultItemColor(item.kind, index);
}

/** Позиция новой карточки: доходы — в ряд с бюджетом, расходы — ниже */
export function suggestCardPosition(
  kind: 'expense' | 'income',
  items: WhiteboardItem[]
): { x: number; y: number } {
  const gap = 16;
  const w = DEFAULT_CARD_WIDTH;
  const h = DEFAULT_CARD_HEIGHT;
  const budget = items.find((i) => i.kind === 'budget');
  const normalized = items.map(normalizeItem);

  if (kind === 'income') {
    const incomes = normalized.filter((i) => i.kind === 'income');
    if (budget) {
      const bw = budget.width ?? DEFAULT_BUDGET_WIDTH;
      if (incomes.length === 0) {
        return { x: budget.x + bw + gap, y: budget.y };
      }
      const rightmost = incomes.reduce((a, b) => (a.x + (a.width ?? w) > b.x + (b.width ?? w) ? a : b));
      return { x: rightmost.x + (rightmost.width ?? w) + gap, y: rightmost.y };
    }
    return { x: 24 + incomes.length * (w + gap), y: 24 };
  }

  const expenses = normalized.filter(isExpenseItem);
  const rowY = normalized.reduce((max, it) => {
    const bottom = it.y + (it.height ?? h);
    return Math.max(max, bottom);
  }, budget ? budget.y + (budget.height ?? DEFAULT_BUDGET_HEIGHT) : h);
  const baseY = rowY + gap;
  const baseX = budget?.x ?? 24;
  const col = expenses.length % 4;
  const row = Math.floor(expenses.length / 4);
  return { x: baseX + col * (w + gap), y: baseY + row * (h + gap) };
}

export function sortItemsForDisplay(items: WhiteboardItem[]): WhiteboardItem[] {
  const budget = items.filter((i) => i.kind === 'budget');
  const incomes = items.filter((i) => i.kind === 'income');
  const expenses = items.filter(isExpenseItem);
  return [...budget, ...incomes, ...expenses];
}

export function clampZoneSize(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.round(Math.min(MAX_CARD_WIDTH, Math.max(MIN_ZONE_WIDTH, width))),
    height: Math.round(Math.min(MAX_CARD_HEIGHT, Math.max(MIN_ZONE_HEIGHT, height))),
  };
}

/** Подготовка карточек перед отправкой на API */
export function sanitizeBoardItems(items: WhiteboardItem[]): WhiteboardItem[] {
  return items.map(normalizeItem);
}

export function isExpenseItem(item: WhiteboardItem): boolean {
  return (item.kind || 'expense') === 'expense';
}

export function isIncomeItem(item: WhiteboardItem): boolean {
  return item.kind === 'income';
}

export function isCardItem(item: WhiteboardItem): boolean {
  return isExpenseItem(item) || isIncomeItem(item);
}

export function ensureBudgetCard(items: WhiteboardItem[], budget: number): WhiteboardItem[] {
  const nonBudget = items.filter((i) => i.kind !== 'budget').map(normalizeItem);
  if (budget <= 0) return nonBudget;

  const existing = items.find((i) => i.kind === 'budget');
  const budgetCard = normalizeItem(
    existing
      ? { ...existing, amount: budget, title: 'Месячный бюджет' }
      : {
          id: BUDGET_CARD_ID,
          kind: 'budget',
          title: 'Месячный бюджет',
          amount: budget,
          x: 24,
          y: 24,
          width: DEFAULT_BUDGET_WIDTH,
          height: DEFAULT_BUDGET_HEIGHT,
        }
  );
  return [budgetCard, ...nonBudget];
}

/** Центр карточки попадает в зону — привязать zone_id */
export function detectZoneForItem(item: WhiteboardItem, zones: WhiteboardZone[]): string | null {
  const w = item.width ?? DEFAULT_CARD_WIDTH;
  const h = item.height ?? DEFAULT_CARD_HEIGHT;
  const cx = item.x + w / 2;
  const cy = item.y + h / 2;
  const sorted = [...zones].sort((a, b) => b.priority - a.priority);
  for (const z of sorted) {
    if (cx >= z.x && cx <= z.x + z.width && cy >= z.y && cy <= z.y + z.height) {
      return z.id;
    }
  }
  return null;
}

export function zoneColor(zoneId: string | null | undefined, zones: WhiteboardZone[]): string | undefined {
  if (!zoneId) return undefined;
  return zones.find((z) => z.id === zoneId)?.color;
}

/** Магнитное выравнивание к другим карточкам и сетке при перетаскивании */
export function snapCardPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  draggingId: string,
  items: WhiteboardItem[]
): { x: number; y: number } {
  let nx = x;
  let ny = y;
  let minDx = SNAP_THRESHOLD + 1;
  let minDy = SNAP_THRESHOLD + 1;

  for (const raw of items) {
    if (raw.id === draggingId) continue;
    const it = normalizeItem(raw);
    const ow = it.width ?? DEFAULT_CARD_WIDTH;
    const oh = it.height ?? DEFAULT_CARD_HEIGHT;
    const ox = it.x;
    const oy = it.y;
    const or = ox + ow;
    const ob = oy + oh;

    const xTargets = [
      ox,
      or - width,
      or + CARD_SNAP_GAP,
      ox - width - CARD_SNAP_GAP,
      ox + (ow - width) / 2,
    ];
    for (const tx of xTargets) {
      const d = Math.abs(x - tx);
      if (d <= SNAP_THRESHOLD && d < minDx) {
        minDx = d;
        nx = tx;
      }
    }

    const yTargets = [
      oy,
      ob - height,
      ob + CARD_SNAP_GAP,
      oy - height - CARD_SNAP_GAP,
      oy + (oh - height) / 2,
    ];
    for (const ty of yTargets) {
      const d = Math.abs(y - ty);
      if (d <= SNAP_THRESHOLD && d < minDy) {
        minDy = d;
        ny = ty;
      }
    }
  }

  if (minDx > SNAP_THRESHOLD) {
    const gx = Math.round(x / BOARD_GRID_SIZE) * BOARD_GRID_SIZE;
    if (Math.abs(x - gx) <= SNAP_THRESHOLD) nx = gx;
  }
  if (minDy > SNAP_THRESHOLD) {
    const gy = Math.round(y / BOARD_GRID_SIZE) * BOARD_GRID_SIZE;
    if (Math.abs(y - gy) <= SNAP_THRESHOLD) ny = gy;
  }

  return { x: Math.max(0, Math.round(nx)), y: Math.max(0, Math.round(ny)) };
}

export interface ExportPreview {
  incomeCount: number;
  expenseCount: number;
  readyCount: number;
  skippedNoCategory: number;
  skippedZeroAmount: number;
  incomeTotal: number;
  expenseTotal: number;
}

/** Предпросмотр экспорта доски в бюджет (логика совпадает с backend export). */
export function summarizeExportItems(items: WhiteboardItem[]): ExportPreview {
  let incomeCount = 0;
  let expenseCount = 0;
  let readyCount = 0;
  let skippedNoCategory = 0;
  let skippedZeroAmount = 0;
  let incomeTotal = 0;
  let expenseTotal = 0;

  for (const item of items) {
    if (!isCardItem(item)) continue;
    const amount = Number(item.amount) || 0;
    if (isIncomeItem(item)) {
      incomeCount += 1;
      incomeTotal += amount;
    } else {
      expenseCount += 1;
      expenseTotal += amount;
    }
    if (amount <= 0) {
      skippedZeroAmount += 1;
      continue;
    }
    if (!item.category_id) {
      skippedNoCategory += 1;
      continue;
    }
    readyCount += 1;
  }

  return {
    incomeCount,
    expenseCount,
    readyCount,
    skippedNoCategory,
    skippedZeroAmount,
    incomeTotal,
    expenseTotal,
  };
}
