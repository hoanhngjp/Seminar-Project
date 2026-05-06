import { apiClient } from './client';

export interface RecommendationItem {
  songId: string;
  title: string;
  artist: string;
  explainText: string;
}

export type ContextType = 'morning' | 'evening' | 'none';

export function getTimeContext(): ContextType {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'none';
}

export async function fetchRecommendations(
  context: ContextType,
  limit = 20,
): Promise<RecommendationItem[]> {
  const res = await apiClient.get<{
    success: boolean;
    data: { items: RecommendationItem[] };
    error: { code: string; message: string } | null;
  }>('/api/v1/recommendations', { params: { context, limit } });
  return res.data.data.items;
}
