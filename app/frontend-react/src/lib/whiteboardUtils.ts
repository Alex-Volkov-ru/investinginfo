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

export type CardLayout = 'compact' | 'normal' | 'spacious';

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

export const CARD_ACCENTS = [
  'border-l-rose-500',
  'border-l-amber-500',
  'border-l-emerald-500',
  'border-l-sky-500',
  'border-l-violet-500',
  'border-l-orange-500',
] as const;

export const AUTO_SAVE_INTERVAL_MS = 30_000;

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
  return {
    ...item,
    kind,
    width: item.width ?? (isBudget ? DEFAULT_BUDGET_WIDTH : DEFAULT_CARD_WIDTH),
    height: item.height ?? (isBudget ? DEFAULT_BUDGET_HEIGHT : DEFAULT_CARD_HEIGHT),
    category_id: item.category_id ?? null,
    zone_id: item.zone_id ?? null,
  };
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
