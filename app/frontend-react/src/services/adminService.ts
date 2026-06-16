import { apiClient } from '../lib/api';

export interface PortfolioUserSummary {
  user_id: number;
  email: string;
  tg_username?: string;
  portfolios_count: number;
  positions_count: number;
  portfolio_value: number;
  last_position_update?: string;
}

export interface InvestmentsOverview {
  users: PortfolioUserSummary[];
  total_value: number;
  total_positions: number;
}

export interface TinkoffStatusItem {
  user_id: number;
  email: string;
  has_token: boolean;
  status: string;
  message?: string;
  checked_at?: string;
}

export interface ProblemPosition {
  user_id: number;
  email: string;
  position_id: number;
  portfolio_id: number;
  figi: string;
  ticker?: string;
  issue: string;
}

export interface AssetClassSlice {
  asset_class: string;
  count: number;
  value: number;
  percentage: number;
}

export interface BudgetUserDashboard {
  user_id: number;
  email: string;
  income: number;
  expense: number;
  net: number;
  top_expense_category?: string;
  over_limit_categories: number;
}

export interface BudgetDashboard {
  year: number;
  month: number;
  users: BudgetUserDashboard[];
  totals: { income: number; expense: number; net: number };
}

export interface BudgetAnomaly {
  user_id: number;
  email: string;
  kind: string;
  message: string;
  amount?: number;
}

export interface CategoryTemplate {
  id: number;
  kind: string;
  name: string;
  monthly_limit?: number;
  apply_to_new_users: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminTransaction {
  id: number;
  user_id: number;
  email: string;
  type: string;
  amount: number;
  currency: string;
  occurred_at: string;
  category_name?: string;
  description?: string;
}

export interface WhiteboardStat {
  user_id: number;
  email: string;
  boards_count: number;
  last_updated?: string;
}

export interface MonthStatusItem {
  user_id: number;
  email: string;
  has_activity: boolean;
  transaction_count: number;
  income: number;
  expense: number;
}

export interface ObligationSummaryItem {
  user_id: number;
  email: string;
  block_id: number;
  title: string;
  monthly: number;
  remaining: number;
  status: string;
  next_payment?: string;
}

export interface CalendarPayment {
  user_id: number;
  email: string;
  date: string;
  title: string;
  amount: number;
  kind: string;
}

export interface ObligationRisk {
  user_id: number;
  email: string;
  kind: string;
  title: string;
  message: string;
  amount?: number;
  due_date?: string;
}

export interface ObligationTemplate {
  id: number;
  title: string;
  total: number;
  monthly: number;
  rate: number;
  due_day: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface UserDetail {
  id: number;
  email: string;
  tg_username?: string;
  is_staff: boolean;
  has_tinkoff: boolean;
  created_at: string;
  last_login_at?: string;
  portfolios_count: number;
  positions_count: number;
  transactions_count: number;
  whiteboards_count: number;
  obligation_blocks_count: number;
  categories_count: number;
}

export interface AuditLogItem {
  id: number;
  admin_id: number;
  admin_email: string;
  action: string;
  target_user_id?: number;
  target_email?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface UserActivity {
  user_id: number;
  registered_at: string;
  last_login_at?: string;
  last_transaction_at?: string;
  last_position_update?: string;
  last_whiteboard_update?: string;
}

export interface OverLimitItem {
  user_id: number;
  email: string;
  category_name: string;
  monthly_limit: number;
  spent: number;
  over_by: number;
  over_pct: number;
}

export interface CalendarHeatmap {
  year: number;
  month: number;
  days: { day: number; payment_count: number; total_amount: number }[];
  forecast_7d: number;
  forecast_30d: number;
  overdue_count: number;
  upcoming_count: number;
}

export interface ObligationRiskDetailed {
  user_id: number;
  email: string;
  kind: string;
  severity: 'overdue' | 'today' | 'soon' | 'upcoming';
  title: string;
  message: string;
  amount: number;
  due_date?: string;
  days_until?: number;
}

export interface PortfolioMarketRow {
  user_id: number;
  email: string;
  avg_value: number;
  market_value?: number;
  delta_pct?: number;
  positions_count: number;
}

export interface PortfolioMarketOut {
  rows: PortfolioMarketRow[];
  tinkoff_available: boolean;
  message?: string;
}

export interface InvestmentAlert {
  user_id: number;
  email: string;
  kind: string;
  message: string;
  severity: 'warn' | 'info';
}

export interface ImpersonateResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  email: string;
  tg_username?: string;
  impersonated_by: number;
}

function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const adminService = {
  // Investments
  async getInvestmentsOverview(): Promise<InvestmentsOverview> {
    const r = await apiClient.get<InvestmentsOverview>('/admin/investments/overview');
    return r.data;
  },
  async getTinkoffStatus(): Promise<TinkoffStatusItem[]> {
    const r = await apiClient.get<TinkoffStatusItem[]>('/admin/investments/tinkoff-status');
    return r.data;
  },
  async checkTinkoff(userId: number): Promise<TinkoffStatusItem> {
    const r = await apiClient.post<TinkoffStatusItem>(`/admin/investments/tinkoff-check/${userId}`);
    return r.data;
  },
  async getProblemPositions(): Promise<ProblemPosition[]> {
    const r = await apiClient.get<ProblemPosition[]>('/admin/investments/problems');
    return r.data;
  },
  async getAssetClasses(): Promise<AssetClassSlice[]> {
    const r = await apiClient.get<AssetClassSlice[]>('/admin/investments/asset-classes');
    return r.data;
  },
  async exportPortfolios(): Promise<void> {
    const r = await apiClient.get('/admin/investments/export', { responseType: 'blob' });
    downloadBlob(r.data, 'portfolios_export.csv');
  },
  async getMarketOverview(): Promise<PortfolioMarketOut> {
    const r = await apiClient.get<PortfolioMarketOut>('/admin/investments/market-overview');
    return r.data;
  },
  async getInvestmentAlerts(): Promise<InvestmentAlert[]> {
    const r = await apiClient.get<InvestmentAlert[]>('/admin/investments/alerts');
    return r.data;
  },

  // Budget
  async getBudgetDashboard(year?: number, month?: number): Promise<BudgetDashboard> {
    const r = await apiClient.get<BudgetDashboard>('/admin/budget/dashboard', { params: { year, month } });
    return r.data;
  },
  async getBudgetAnomalies(): Promise<BudgetAnomaly[]> {
    const r = await apiClient.get<BudgetAnomaly[]>('/admin/budget/anomalies');
    return r.data;
  },
  async listCategoryTemplates(): Promise<CategoryTemplate[]> {
    const r = await apiClient.get<CategoryTemplate[]>('/admin/budget/category-templates');
    return r.data;
  },
  async createCategoryTemplate(data: Omit<CategoryTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<CategoryTemplate> {
    const r = await apiClient.post<CategoryTemplate>('/admin/budget/category-templates', data);
    return r.data;
  },
  async deleteCategoryTemplate(id: number): Promise<void> {
    await apiClient.delete(`/admin/budget/category-templates/${id}`);
  },
  async applyCategoryTemplates(userId: number): Promise<{ created: number }> {
    const r = await apiClient.post<{ created: number }>(`/admin/budget/category-templates/apply/${userId}`);
    return r.data;
  },
  async listTransactions(params?: { user_id?: number; q?: string; type?: string; from_date?: string; to_date?: string; limit?: number }): Promise<AdminTransaction[]> {
    const r = await apiClient.get<AdminTransaction[]>('/admin/budget/transactions', { params });
    return r.data;
  },
  async getOverLimits(year?: number, month?: number): Promise<OverLimitItem[]> {
    const r = await apiClient.get<OverLimitItem[]>('/admin/budget/over-limits', { params: { year, month } });
    return r.data;
  },
  async compareBudget(userAId: number, userBId: number, year?: number, month?: number) {
    const r = await apiClient.get('/admin/budget/compare', {
      params: { user_a_id: userAId, user_b_id: userBId, year, month },
    });
    return r.data as { user_a: Record<string, unknown>; user_b: Record<string, unknown> };
  },
  async getWhiteboardStats(): Promise<WhiteboardStat[]> {
    const r = await apiClient.get<WhiteboardStat[]>('/admin/budget/whiteboard-stats');
    return r.data;
  },
  async getMonthStatus(year?: number, month?: number): Promise<MonthStatusItem[]> {
    const r = await apiClient.get<MonthStatusItem[]>('/admin/budget/month-status', { params: { year, month } });
    return r.data;
  },

  // Obligations
  async getObligationsSummary(): Promise<ObligationSummaryItem[]> {
    const r = await apiClient.get<ObligationSummaryItem[]>('/admin/obligations/summary');
    return r.data;
  },
  async getObligationsCalendar(year?: number, month?: number): Promise<CalendarPayment[]> {
    const r = await apiClient.get<CalendarPayment[]>('/admin/obligations/calendar', { params: { year, month } });
    return r.data;
  },
  async getObligationsHeatmap(year?: number, month?: number): Promise<CalendarHeatmap> {
    const r = await apiClient.get<CalendarHeatmap>('/admin/obligations/calendar-heatmap', { params: { year, month } });
    return r.data;
  },
  async getObligationsRisksDetailed(): Promise<ObligationRiskDetailed[]> {
    const r = await apiClient.get<ObligationRiskDetailed[]>('/admin/obligations/risks-detailed');
    return r.data;
  },
  async getObligationsRisks(): Promise<ObligationRisk[]> {
    const r = await apiClient.get<ObligationRisk[]>('/admin/obligations/risks');
    return r.data;
  },
  async listObligationTemplates(): Promise<ObligationTemplate[]> {
    const r = await apiClient.get<ObligationTemplate[]>('/admin/obligations/templates');
    return r.data;
  },
  async createObligationTemplate(data: Omit<ObligationTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<ObligationTemplate> {
    const r = await apiClient.post<ObligationTemplate>('/admin/obligations/templates', data);
    return r.data;
  },
  async deleteObligationTemplate(id: number): Promise<void> {
    await apiClient.delete(`/admin/obligations/templates/${id}`);
  },
  async applyObligationTemplate(templateId: number, userId: number): Promise<{ block_id: number; created?: boolean }> {
    const r = await apiClient.post<{ block_id: number; created?: boolean }>(`/admin/obligations/templates/${templateId}/apply/${userId}`);
    return r.data;
  },
  async applyAllObligationTemplates(userId: number): Promise<{ created: number; reused: number }> {
    const r = await apiClient.post<{ created: number; reused: number }>(`/admin/obligations/templates/apply/${userId}`);
    return r.data;
  },

  // Users
  async getUserDetail(userId: number): Promise<UserDetail> {
    const r = await apiClient.get<UserDetail>(`/admin/users/${userId}/detail`);
    return r.data;
  },
  async getUserActivity(userId: number): Promise<UserActivity> {
    const r = await apiClient.get<UserActivity>(`/admin/users/${userId}/activity`);
    return r.data;
  },
  async impersonate(userId: number): Promise<ImpersonateResponse> {
    const r = await apiClient.post<ImpersonateResponse>(`/admin/users/${userId}/impersonate`);
    return r.data;
  },
  async getAuditLog(limit = 50): Promise<AuditLogItem[]> {
    const r = await apiClient.get<AuditLogItem[]>('/admin/audit-log', { params: { limit } });
    return r.data;
  },
  async bulkExportUsers(userIds: number[]): Promise<void> {
    const r = await apiClient.post('/admin/users/bulk-export', { user_ids: userIds }, { responseType: 'blob' });
    downloadBlob(r.data, 'users_export.csv');
  },

  async deleteUser(userId: number, confirmEmail: string): Promise<{ success: boolean; message: string }> {
    const r = await apiClient.delete(`/admin/users/${userId}`, { data: { confirm_email: confirmEmail } });
    return r.data;
  },
};
