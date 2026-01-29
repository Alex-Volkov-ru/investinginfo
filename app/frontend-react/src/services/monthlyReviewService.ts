import { apiClient } from '../lib/api';

export interface CategoryLimitStatus {
  category_id: number;
  category_name: string;
  monthly_limit: number;
  spent: number;
  percentage: number;
  is_over_limit: boolean;
}

export interface BudgetReview {
  total_income: number;
  total_expense: number;
  net_result: number;
  categories_with_limits: number;
  categories_within_limit: number;
  categories_over_limit: number;
  over_limit_categories: CategoryLimitStatus[];
  top_over_limit: CategoryLimitStatus[];
}

export interface InvestmentReview {
  has_portfolio: boolean;
  portfolios_count: number;
  positions_count: number;
}

export interface ObligationBlockSummary {
  block_id: number;
  title: string;
  payments_in_month_count: number;
  payments_in_month_amount: number;
  remaining: number;
  progress_pct: number;
}

export interface ObligationReview {
  paid_count: number;
  total_payment_amount: number;
  blocks: ObligationBlockSummary[];
  upcoming_payments_count: number;
  upcoming_payments_amount: number;
}

export interface MonthlyReview {
  month: number;
  year: number;
  budget: BudgetReview;
  investments: InvestmentReview;
  obligations: ObligationReview;
}

export const monthlyReviewService = {
  async getReview(year?: number, month?: number): Promise<MonthlyReview> {
    const params = new URLSearchParams();
    if (year != null) params.set('year', String(year));
    if (month != null) params.set('month', String(month));
    const query = params.toString();
    const url = query ? `/monthly-review?${query}` : '/monthly-review';
    const response = await apiClient.get<MonthlyReview>(url);
    return response.data;
  },
};
