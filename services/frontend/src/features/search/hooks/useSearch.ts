import { useState, useEffect, useRef } from 'react';
import { searchContent } from '../../../services/searchService';
import type { SearchResult } from '../../../types/domain';

interface UseSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  loading: boolean;
  clearQuery: () => void;
}

export function useSearch(): UseSearchReturn {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    timerRef.current = setTimeout(async () => {
      try {
        const res = await searchContent(query);
        setResults(res.items);
      } catch {
        setResults([]); // per API contract: timeout → empty, no error thrown
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const clearQuery = () => {
    setQuery('');
    setResults([]);
    setLoading(false);
  };

  return { query, setQuery, results, loading, clearQuery };
}
