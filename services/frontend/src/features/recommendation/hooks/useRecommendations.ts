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
  context: TimeContext;
  reload: () => void;
}

export function useRecommendations(): RecommendationGroups {
  const [items,   setItems]   = useState<RecommendedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [context] = useState<TimeContext>(() => getTimeContext());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecommendations(context);
      setItems(data);
    } catch {
      setError('Không thể tải gợi ý. Thử lại.');
    } finally {
      setLoading(false);
    }
  }, [context]);

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
