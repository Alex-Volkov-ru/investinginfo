import { format } from 'date-fns';
import { ObligationBlock, ObligationPayment } from '../types';

export interface ScheduleInput {
  start_date?: string;
  due_day?: number;
  monthly?: number;
  total?: number;
  maxCount?: number;
}

export function dueDateForMonth(year: number, month: number, dueDay: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(dueDay, lastDay);
  const due = new Date(year, month - 1, day);
  const weekday = due.getDay(); // 0=Sun..6=Sat
  if (weekday === 6) due.setDate(due.getDate() + 2);
  if (weekday === 0) due.setDate(due.getDate() + 1);
  return format(due, 'yyyy-MM-dd');
}

export function estimatePaymentCount(total: number, monthly: number, maxCount = 20): number {
  if (!monthly || monthly <= 0 || !total || total <= 0) return maxCount;
  return Math.min(maxCount, Math.max(1, Math.ceil(total / monthly)));
}

/** График платежей по дате начала, дню платежа и сумме (логика как на backend). */
export function generatePaymentSchedule(input: ScheduleInput): ObligationPayment[] {
  const { start_date, due_day = 15, monthly = 0, total = 0, maxCount = 20 } = input;

  if (!start_date || monthly <= 0) {
    return Array.from({ length: maxCount }, (_, i) => ({
      n: i + 1,
      ok: false,
      amount: 0,
      note: '',
    }));
  }

  const count = estimatePaymentCount(total, monthly, maxCount);
  let y = new Date(start_date).getFullYear();
  let m = new Date(start_date).getMonth() + 2; // первый платёж — следующий месяц
  if (m > 12) {
    y += 1;
    m -= 12;
  }

  const payments: ObligationPayment[] = [];
  for (let i = 1; i <= count; i++) {
    let amount = monthly;
    if (i === count && total > 0) {
      const remainder = total - monthly * (count - 1);
      if (remainder > 0 && remainder <= monthly) amount = remainder;
    }
    payments.push({
      n: i,
      ok: false,
      date: dueDateForMonth(y, m, due_day),
      amount,
      note: '',
    });
    m += 1;
    if (m > 12) {
      y += 1;
      m = 1;
    }
  }
  return payments;
}

export function scheduleNeedsFill(payments: ObligationPayment[]): boolean {
  if (!payments.length) return true;
  const filled = payments.filter((p) => p.date && (p.amount ?? 0) > 0);
  return filled.length < Math.min(3, payments.length);
}

export function findNextUnpaid(payments: ObligationPayment[]): ObligationPayment | undefined {
  return [...payments]
    .filter((p) => !p.ok)
    .sort((a, b) => {
      if (a.date && b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (a.date) return -1;
      if (b.date) return 1;
      return a.n - b.n;
    })[0];
}

export function applyScheduleToBlock(block: ObligationBlock): ObligationPayment[] {
  return generatePaymentSchedule({
    start_date: block.start_date,
    due_day: block.due_day,
    monthly: block.monthly,
    total: block.total,
  }).map((p, i) => ({
    ...p,
    ok: block.payments?.[i]?.ok ?? p.ok,
    note: block.payments?.[i]?.note ?? p.note,
    id: block.payments?.[i]?.id,
  }));
}

export function countPaid(payments: ObligationPayment[]): number {
  return payments.filter((p) => p.ok).length;
}

/** Убирает хвост пустых строк (старые блоки с 20 нулевыми платежами). */
export function trimTrailingEmptyPayments(payments: ObligationPayment[]): ObligationPayment[] {
  let end = payments.length;
  while (end > 0) {
    const p = payments[end - 1];
    if (p.ok || p.date || (p.amount ?? 0) > 0) break;
    end -= 1;
  }
  return payments.slice(0, end);
}

export function formatPaymentAmount(amount: number | undefined): string {
  return (amount || 0).toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  });
}
