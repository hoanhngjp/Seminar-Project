import { apiClient } from './client';

export interface RecommendationItem {
  songId: string;
  title: string;
  artist: string;
  explainText: string;
}

// Raw shape from Python FastAPI (snake_case)
interface RawSongItem {
  song_id: string;
  title: string;
  artist: string;
  thumbnail: string;
  reason: { type: string; text: string };
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
    data: { items: RawSongItem[] };
    error: { code: string; message: string } | null;
  }>('/api/v1/recommendations', { params: { context, limit } });

  return res.data.data.items.map((item) => ({
    songId: item.song_id,
    title: item.title,
    artist: item.artist,
    explainText: item.reason?.text ?? '',
  }));
}
