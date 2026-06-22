import { useCallback, useEffect, useMemo, useState } from 'react';
import { portfolioService } from '../services/portfolioService';
import { PositionFull, Quote } from '../types';
import { quotesMapFromResults } from '../lib/portfolioUtils';

export function usePortfolioQuotes(positions: PositionFull[]) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState(false);
  const [quotesTokenInvalid, setQuotesTokenInvalid] = useState(false);
  const [quotesUpdatedAt, setQuotesUpdatedAt] = useState<Date | null>(null);
  const figis = useMemo(
    () => [...new Set(positions.map((p) => p.figi).filter((f): f is string => !!f))],
    [positions]
  );

  const refreshQuotes = useCallback(() => {
    if (figis.length === 0) {
      setQuotes({});
      setQuotesError(false);
      setQuotesLoading(false);
      setQuotesUpdatedAt(null);
      return;
    }

    let cancelled = false;
    setQuotesLoading(true);
    setQuotesError(false);
    setQuotesTokenInvalid(false);

    portfolioService
      .getQuotesByFigis(figis)
      .then((response) => {
        if (cancelled) return;
        const map = quotesMapFromResults(response.results);
        setQuotes(map);
        setQuotesError(response.results.length === 0);
        setQuotesUpdatedAt(new Date());
      })
      .catch((error) => {
        if (!cancelled) {
          setQuotesError(true);
          const detail = error?.response?.data?.detail;
          if (typeof detail === 'string' && detail.toLowerCase().includes('tinkoff')) {
            setQuotesTokenInvalid(true);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setQuotesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [figis]);

  useEffect(() => {
    const cleanup = refreshQuotes();
    return cleanup;
  }, [refreshQuotes]);

  return { quotes, quotesLoading, quotesError, quotesTokenInvalid, quotesUpdatedAt, refreshQuotes };
}
