import { WhiteboardItem, WhiteboardZone } from '../types';
import { DEFAULT_ZONES, generateItemId } from './whiteboardUtils';

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  budget: number;
  zones: WhiteboardZone[];
  items: Omit<WhiteboardItem, 'id'>[];
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'family_month',
    name: 'Семейный месяц',
    description: 'Базовый план: жильё, еда, транспорт, развлечения',
    budget: 100000,
    zones: DEFAULT_ZONES,
    items: [
      { kind: 'expense', title: 'Аренда / ипотека', amount: 35000, x: 40, y: 200, zone_id: 'zone_must' },
      { kind: 'expense', title: 'Продукты', amount: 25000, x: 40, y: 320, zone_id: 'zone_must' },
      { kind: 'expense', title: 'Транспорт', amount: 8000, x: 360, y: 200, zone_id: 'zone_later' },
      { kind: 'expense', title: 'Кафе и развлечения', amount: 12000, x: 680, y: 200, zone_id: 'zone_wants' },
      { kind: 'income', title: 'Зарплата', amount: 120000, x: 360, y: 40 },
    ],
  },
  {
    id: 'vacation',
    name: 'Отпуск',
    description: 'Поездка: билеты, жильё, еда, сувениры',
    budget: 80000,
    zones: [
      { id: 'zone_must', title: 'Обязательно', color: '#0ea5e9', x: 24, y: 160, width: 280, height: 200, priority: 1 },
      { id: 'zone_wants', title: 'По желанию', color: '#a855f7', x: 320, y: 160, width: 280, height: 200, priority: 2 },
    ],
    items: [
      { kind: 'expense', title: 'Билеты', amount: 25000, x: 40, y: 180, zone_id: 'zone_must' },
      { kind: 'expense', title: 'Отель', amount: 30000, x: 40, y: 280, zone_id: 'zone_must' },
      { kind: 'expense', title: 'Еда', amount: 15000, x: 340, y: 180, zone_id: 'zone_wants' },
      { kind: 'expense', title: 'Экскурсии', amount: 10000, x: 340, y: 280, zone_id: 'zone_wants' },
    ],
  },
  {
    id: 'renovation',
    name: 'Ремонт',
    description: 'Материалы, работа, мебель',
    budget: 200000,
    zones: DEFAULT_ZONES,
    items: [
      { kind: 'expense', title: 'Материалы', amount: 80000, x: 40, y: 200, zone_id: 'zone_must' },
      { kind: 'expense', title: 'Работа', amount: 60000, x: 40, y: 300, zone_id: 'zone_must' },
      { kind: 'expense', title: 'Мебель', amount: 50000, x: 360, y: 200, zone_id: 'zone_later' },
      { kind: 'expense', title: 'Декор', amount: 15000, x: 680, y: 200, zone_id: 'zone_wants' },
    ],
  },
];

export function applyTemplate(template: BoardTemplate): {
  name: string;
  budget: number;
  zones: WhiteboardZone[];
  items: WhiteboardItem[];
} {
  return {
    name: template.name,
    budget: template.budget,
    zones: template.zones.map((z) => ({ ...z })),
    items: template.items.map((item) => ({
      ...item,
      id: generateItemId(),
    })) as WhiteboardItem[],
  };
}
