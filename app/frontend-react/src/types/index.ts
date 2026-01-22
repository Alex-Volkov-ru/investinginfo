// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  tg_username?: string;
  phone?: string;
  tinkoff_token?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  email: string;
  tg_username?: string;
}

export interface User {
  id: number;
  email: string;
  tg_username?: string;
}

// Portfolio types
export interface Portfolio {
  id: number;
  user_id: number;
  title: string;
  type: string;
  currency: string;
}

export interface Position {
  id: number;
  portfolio_id: number;
  figi: string;
  quantity: number;
  avg_price: number;
  instrument?: InstrumentShort;
}

export interface InstrumentShort {
  ticker?: string;
  name?: string;
  class?: string;
  currency?: string;
  nominal?: number;
}

export interface PositionFull extends Position {
  instrument: InstrumentShort;
}

// Market types
export interface ResolveItem {
  figi: string;
  class: string;
  name: string;
  currency?: string;
  isin?: string;
  nominal?: number;
}

export interface Quote {
  figi: string;
  price: number;
  currency?: string;
  ticker?: string;
  name?: string;
  class?: string;
  price_percent?: number;
  nominal?: number;
  aci?: number;
  dirty_price?: number;
}

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Budget types
export interface BudgetAccount {
  id: number;
  user_id: number;
  title: string;
  currency: string;
  is_savings: boolean;
  created_at: string;
}

export interface BudgetCategory {
  id: number;
  user_id: number;
  kind: 'income' | 'expense';
  name: string;
  parent_id?: number;
  is_active: boolean;
  monthly_limit?: number | null;
  created_at: string;
}

export interface BudgetTransaction {
  id: number;
  user_id: number;
  type: 'income' | 'expense' | 'transfer';
  occurred_at: string;
  account_id: number;
  contra_account_id?: number;
  category_id?: number;
  amount: number;
  currency: string;
  description?: string;
  created_at: string;
}

export interface MonthSummary {
  income_total: number;
  expense_total: number;
  net_total: number;
  savings_transferred: number;
  savings: number;
}

export interface ChartSlice {
  name: string;
  amount: number;
}

export interface Charts {
  income_by_category: ChartSlice[];
  expense_by_category: ChartSlice[];
  expense_by_day: ChartSlice[];
}

// Obligations types
export interface BudgetObligation {
  id: number;
  user_id: number;
  title: string;
  due_date: string;
  amount: number;
  currency: string;
  is_done: boolean;
  created_at: string;
  updated_at: string;
}

export interface ObligationPayment {
  id?: number;
  n: number;
  ok: boolean;
  date?: string;
  amount: number;
  note: string;
}

export interface ObligationBlock {
  id?: number;
  title?: string;
  total: number;
  monthly: number;
  rate: number;
  due_day: number;
  start_date?: string;
  next_payment?: string;
  close_date?: string;
  status: string;
  notes: string;
  payments: ObligationPayment[];
  paid_total?: number;
  paid_interest?: number;
  paid_principal?: number;
  remaining?: number;
  progress_pct?: number;
}

export interface UpcomingPayment {
  block_id: number;
  block_title: string;
  payment_date: string;
  amount: number;
  days_until: number;
  is_urgent: boolean;
  is_warning: boolean;
}

export interface YearSummary {
  year: number;
  income_total: number;
  expense_total: number;
  net_total: number;
  savings_transferred: number;
  savings: number;
  income_by_category: ChartSlice[];
  expense_by_category: ChartSlice[];
  monthly_data: Array<{
    month: number;
    income: number;
    expense: number;
    net: number;
    savings: number;
  }>;
}

