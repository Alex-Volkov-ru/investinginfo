import { apiClient } from '../lib/api';
import { Portfolio, Position, PositionFull, Quote, ResolveItem, Candle } from '../types';

export const portfolioService = {
  // Portfolios
  async getPortfolios(): Promise<Portfolio[]> {
    const response = await apiClient.get<Portfolio[]>('/portfolio');
    return response.data;
  },

  async createPortfolio(data: { title: string; type?: string; currency?: string }): Promise<Portfolio> {
    const response = await apiClient.post<Portfolio>('/portfolio', data);
    return response.data;
  },

  // Positions
  async getPositions(portfolioId: number): Promise<Position[]> {
    const response = await apiClient.get<Position[]>(`/portfolio/${portfolioId}/positions`);
    return response.data;
  },

  async getPositionsFull(portfolioId: number): Promise<PositionFull[]> {
    const response = await apiClient.get<PositionFull[]>(`/portfolio/${portfolioId}/positions/full`);
    return response.data;
  },

  async upsertPosition(data: {
    portfolio_id: number;
    ticker: string;
    class_hint?: string;
    figi?: string;
    quantity: number;
    avg_price: number;
    name?: string;
    currency?: string;
    nominal?: number;
  }): Promise<Position> {
    const response = await apiClient.post<Position>('/portfolio/positions', data);
    return response.data;
  },

  async deletePosition(positionId: number): Promise<void> {
    await apiClient.delete(`/portfolio/positions/${positionId}`);
  },

  // Market
  async resolveTicker(ticker: string): Promise<{ ticker: string; results: ResolveItem[] }> {
    const response = await apiClient.get<{ ticker: string; results: ResolveItem[] }>('/resolve', {
      params: { ticker },
    });
    return response.data;
  },

  async getQuote(figi: string): Promise<Quote> {
    const response = await apiClient.get<Quote>(`/quote/${figi}`);
    return response.data;
  },

  async getCandles(
    figi: string,
    interval: string = '1d',
    from?: string,
    to?: string
  ): Promise<Candle[]> {
    const response = await apiClient.get<Candle[]>(`/candles/${figi}`, {
      params: { interval, from, to },
    });
    return response.data;
  },

  async getQuotesByTickers(tickers: string[], classHint?: string): Promise<{ results: Quote[] }> {
    const response = await apiClient.post<{ results: Quote[] }>('/quotes_by_tickers', {
      tickers,
      class_hint: classHint,
    });
    return response.data;
  },
};

