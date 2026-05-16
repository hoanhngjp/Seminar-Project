import { apiClient } from './api';
import type { ApiResponse } from '../types/api';
import type { RecommendedSong, TimeContext } from '../types/domain';

interface RawRecommendedSong {
  songId: string;
  title: string;
  artist: string;
  thumbnail: string;
  reason: { type: string; text: string };
}

export async function fetchRecommendations(
  context: TimeContext | 'none',
  limit = 20,
): Promise<RecommendedSong[]> {
  const res = await apiClient.get<ApiResponse<{ items: RawRecommendedSong[] }>>(
    '/api/v1/recommendations',
    { params: { context, limit } },
  );
  return (res.data.data?.items ?? []).filter((item) => item.songId).map((item) => ({
    id:         item.songId,
    title:      item.title,
    artist:     item.artist,
    coverUrl:   item.thumbnail,
    duration:   0,
    isExplicit: false,
    reason: {
      type: item.reason?.type as RecommendedSong['reason']['type'] ?? 'TRENDING',
      text: item.reason?.text ?? '',
    },
  }));
}
