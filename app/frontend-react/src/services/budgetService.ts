import { apiClient } from '../lib/api';
import {
  BudgetAccount,
  BudgetCategory,
  BudgetTransaction,
  MonthSummary,
  Charts,
  BudgetObligation,
  ObligationBlock,
  YearSummary,
  UpcomingPayment,
} from '../types';

export const budgetService = {
  // Accounts
  async getAccounts(): Promise<BudgetAccount[]> {
    const response = await apiClient.get<BudgetAccount[]>('/budget/accounts');
    return response.data;
  },

  async createAccount(data: { title: string; currency?: string; is_savings?: boolean }): Promise<BudgetAccount> {
    const response = await apiClient.post<BudgetAccount>('/budget/accounts', data);
    return response.data;
  },

  async deleteAccount(accountId: number): Promise<void> {
    await apiClient.delete(`/budget/accounts/${accountId}`);
  },

  // Categories
  async getCategories(): Promise<BudgetCategory[]> {
    const response = await apiClient.get<BudgetCategory[]>('/budget/categories');
    return response.data;
  },

  async createCategory(data: {
    kind: 'income' | 'expense';
    name: string;
    parent_id?: number;
    monthly_limit?: number | null;
  }): Promise<BudgetCategory> {
    const response = await apiClient.post<BudgetCategory>('/budget/categories', data);
    return response.data;
  },

  async updateCategory(categoryId: number, data: {
    name?: string;
    monthly_limit?: number | null;
  }): Promise<BudgetCategory> {
    const response = await apiClient.put<BudgetCategory>(`/budget/categories/${categoryId}`, data);
    return response.data;
  },

  async deleteCategory(categoryId: number): Promise<void> {
    await apiClient.delete(`/budget/categories/${categoryId}`);
  },

  // Transactions
  async getTransactions(params?: {
    date_from?: string;
    date_to?: string;
    type?: string;
    account_id?: number;
  }): Promise<BudgetTransaction[]> {
    const response = await apiClient.get<BudgetTransaction[]>('/budget/transactions', { params });
    return response.data;
  },

  async createTransaction(data: {
    type: 'income' | 'expense' | 'transfer';
    account_id: number;
    contra_account_id?: number;
    category_id?: number;
    amount: number;
    currency?: string;
    occurred_at?: string;
    description?: string;
  }): Promise<BudgetTransaction> {
    const response = await apiClient.post<BudgetTransaction>('/budget/transactions', data);
    return response.data;
  },

  async deleteTransaction(transactionId: number): Promise<void> {
    await apiClient.delete(`/budget/transactions/${transactionId}`);
  },

  // Summary
  async getMonthSummary(dateFrom?: string, dateTo?: string): Promise<MonthSummary> {
    const response = await apiClient.get<MonthSummary>('/budget/summary/month', {
      params: { date_from: dateFrom, date_to: dateTo },
    });
    return response.data;
  },

  async getCharts(dateFrom?: string, dateTo?: string): Promise<Charts> {
    const response = await apiClient.get<Charts>('/budget/summary/charts', {
      params: { date_from: dateFrom, date_to: dateTo },
    });
    return response.data;
  },

  async getYearSummary(year: number): Promise<YearSummary> {
    const response = await apiClient.get<YearSummary>('/budget/summary/year', {
      params: { year },
    });
    return response.data;
  },

  // Obligations
  async getObligations(month?: string): Promise<BudgetObligation[]> {
    const params = month ? { month } : {};
    const response = await apiClient.get<BudgetObligation[]>('/budget/obligations', { params });
    return response.data;
  },

  async createObligation(data: {
    title: string;
    due_date: string;
    amount: number;
    currency?: string;
  }): Promise<BudgetObligation> {
    const response = await apiClient.post<BudgetObligation>('/budget/obligations', data);
    return response.data;
  },

  async updateObligation(id: number, data: Partial<BudgetObligation>): Promise<BudgetObligation> {
    const response = await apiClient.patch<BudgetObligation>(`/budget/obligations/${id}`, data);
    return response.data;
  },

  async deleteObligation(id: number): Promise<void> {
    await apiClient.delete(`/budget/obligations/${id}`);
  },

  // Obligation Blocks
  async getObligationBlocks(): Promise<ObligationBlock[]> {
    const response = await apiClient.get<ObligationBlock[]>('/budget/obligation-blocks');
    return response.data;
  },

  async createObligationBlock(data: ObligationBlock): Promise<ObligationBlock> {
    const response = await apiClient.post<ObligationBlock>('/budget/obligation-blocks', data);
    return response.data;
  },

  async updateObligationBlock(id: number, data: ObligationBlock): Promise<ObligationBlock> {
    const response = await apiClient.put<ObligationBlock>(`/budget/obligation-blocks/${id}`, data);
    return response.data;
  },

  async deleteObligationBlock(id: number): Promise<void> {
    await apiClient.delete(`/budget/obligation-blocks/${id}`);
  },

  async previewObligationBlock(data: ObligationBlock): Promise<ObligationBlock> {
    const response = await apiClient.post<ObligationBlock>('/budget/obligation-blocks/preview', data);
    return response.data;
  },

  // Upcoming Payments
  async getUpcomingPayments(daysAhead: number = 7): Promise<UpcomingPayment[]> {
    const response = await apiClient.get<UpcomingPayment[]>('/budget/obligation-blocks/upcoming-payments', {
      params: { days_ahead: daysAhead },
    });
    return response.data;
  },
};

