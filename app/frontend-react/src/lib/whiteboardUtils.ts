import { WhiteboardItem } from '../types';

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
export const MIN_CARD_WIDTH = 120;
export const MIN_CARD_HEIGHT = 72;

export const CARD_ACCENTS = [
  'border-l-rose-500',
  'border-l-amber-500',
  'border-l-emerald-500',
  'border-l-sky-500',
  'border-l-violet-500',
  'border-l-orange-500',
] as const;

export const AUTO_SAVE_INTERVAL_MS = 30_000;

export function normalizeItem(item: WhiteboardItem): WhiteboardItem {
  const kind = item.kind || 'expense';
  const isBudget = kind === 'budget';
  return {
    ...item,
    kind,
    width: item.width ?? (isBudget ? DEFAULT_BUDGET_WIDTH : DEFAULT_CARD_WIDTH),
    height: item.height ?? (isBudget ? DEFAULT_BUDGET_HEIGHT : DEFAULT_CARD_HEIGHT),
  };
}

export function isExpenseItem(item: WhiteboardItem): boolean {
  return (item.kind || 'expense') === 'expense';
}

export function ensureBudgetCard(items: WhiteboardItem[], budget: number): WhiteboardItem[] {
  const expenses = items.filter(isExpenseItem);
  if (budget <= 0) return expenses;

  const existing = items.find((i) => i.kind === 'budget');
  if (existing) {
    return [
      normalizeItem({ ...existing, amount: budget, title: 'Месячный бюджет' }),
      ...expenses.map(normalizeItem),
    ];
  }

  return [
    normalizeItem({
      id: BUDGET_CARD_ID,
      kind: 'budget',
      title: 'Месячный бюджет',
      amount: budget,
      x: 24,
      y: 24,
      width: DEFAULT_BUDGET_WIDTH,
      height: DEFAULT_BUDGET_HEIGHT,
    }),
    ...expenses.map(normalizeItem),
  ];
}
