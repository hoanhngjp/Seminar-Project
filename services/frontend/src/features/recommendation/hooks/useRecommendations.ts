import { useState, useEffect, useCallback } from 'react';
import { fetchRecommendations } from '../../../services/recommendationService';
import { getTimeContext } from '../../../utils/time';
import type { RecommendedSong, TimeContext } from '../../../types/domain';

interface RecommendationGroups {
  contextItems:    RecommendedSong[];   // reason.type === 'CONTEXT'
  trendingItems:   RecommendedSong[];   // reason.type === 'TRENDING'
  preferenceItems: RecommendedSong[];   // reason.type === 'PREFERENCE'
  loading: boolean;
  error: string | null;
  context: TimeContext | 'none';
  reload: () => void;
}

export function useRecommendations(externalContext?: TimeContext | 'none'): RecommendationGroups {
  const [items,   setItems]   = useState<RecommendedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [autoContext] = useState<TimeContext>(() => getTimeContext());

  const context: TimeContext | 'none' = externalContext !== undefined ? externalContext : autoContext;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchCtx = context === 'none' ? autoContext : context;
      const data = await fetchRecommendations(fetchCtx);
      setItems(data);
    } catch {
      setError('Không thể tải gợi ý. Thử lại.');
    } finally {
      setLoading(false);
    }
  }, [context, autoContext]);

  useEffect(() => { load(); }, [load]);

  return {
    contextItems:    items.filter((i) => i.reason.type === 'CONTEXT'),
    trendingItems:   items.filter((i) => i.reason.type === 'TRENDING'),
    preferenceItems: items.filter((i) => i.reason.type === 'PREFERENCE'),
    loading,
    error,
    context,
    reload: load,
  };
}
