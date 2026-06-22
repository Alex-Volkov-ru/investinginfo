import { PositionFull, Quote } from '../types';

/** Цена позиции: котировка или средняя цена покупки как fallback. */
export function positionCurrentPrice(position: PositionFull, quote?: Quote | null): number {
  if (quote?.price && quote.price > 0) return quote.price;
  return position.avg_price;
}

export function hasLiveQuote(quote?: Quote | null): boolean {
  return !!(quote?.price && quote.price > 0);
}

export function positionMarketValue(position: PositionFull, quote?: Quote | null): number {
  return position.quantity * positionCurrentPrice(position, quote);
}

export function positionCost(position: PositionFull): number {
  return position.quantity * position.avg_price;
}

export function positionPnL(position: PositionFull, quote?: Quote | null): { pnl: number; pnlPercent: number } {
  const cost = positionCost(position);
  const value = positionMarketValue(position, quote);
  const pnl = value - cost;
  const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
  return { pnl, pnlPercent };
}

export function quotesMapFromResults(results: Quote[]): Record<string, Quote> {
  const map: Record<string, Quote> = {};
  results.forEach((q) => {
    if (q.figi) map[q.figi] = q;
  });
  return map;
}

export function countMissingQuotes(positions: PositionFull[], quotes: Record<string, Quote>): number {
  return positionsMissingQuotes(positions, quotes).length;
}

export function positionsMissingQuotes(positions: PositionFull[], quotes: Record<string, Quote>): PositionFull[] {
  return positions.filter((p) => !hasLiveQuote(quotes[p.figi]));
}

export function missingQuoteLabels(positions: PositionFull[], quotes: Record<string, Quote>): string[] {
  return positionsMissingQuotes(positions, quotes).map(
    (p) => p.instrument?.ticker || p.instrument?.name || p.figi
  );
}
