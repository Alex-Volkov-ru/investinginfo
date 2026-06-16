import { useCallback, useEffect, useMemo, useState } from 'react';
import { portfolioService } from '../services/portfolioService';
import { PositionFull, Quote } from '../types';
import { quotesMapFromResults } from '../lib/portfolioUtils';

export function usePortfolioQuotes(positions: PositionFull[]) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState(false);
  const [quotesUpdatedAt, setQuotesUpdatedAt] = useState<Date | null>(null);
  const tickers = useMemo(
    () => [...new Set(positions.map((p) => p.instrument?.ticker).filter((t): t is string => !!t))],
    [positions]
  );

  const refreshQuotes = useCallback(() => {
    if (tickers.length === 0) {
      setQuotes({});
      setQuotesError(false);
      setQuotesLoading(false);
      setQuotesUpdatedAt(null);
      return;
    }

    let cancelled = false;
    setQuotesLoading(true);
    setQuotesError(false);

    portfolioService
      .getQuotesByTickers(tickers)
      .then((response) => {
        if (cancelled) return;
        const map = quotesMapFromResults(response.results);
        setQuotes(map);
        setQuotesError(response.results.length === 0);
        setQuotesUpdatedAt(new Date());
      })
      .catch(() => {
        if (!cancelled) setQuotesError(true);
      })
      .finally(() => {
        if (!cancelled) setQuotesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tickers]);

  useEffect(() => {
    const cleanup = refreshQuotes();
    return cleanup;
  }, [refreshQuotes]);

  return { quotes, quotesLoading, quotesError, quotesUpdatedAt, refreshQuotes };
}
