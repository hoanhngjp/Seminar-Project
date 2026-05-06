import { apiClient } from './client';

export interface SearchResultItem {
  songId: string;
  title: string;
  artist: string;
  album: string;
}

export interface SearchResponse {
  items: SearchResultItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function searchSongs(
  query: string,
  limit = 10,
  cursor?: string,
): Promise<SearchResponse> {
  const params: Record<string, string | number> = { q: query, type: 'song', limit };
  if (cursor) params['cursor'] = cursor;

  const res = await apiClient.get<{
    success: boolean;
    data: SearchResponse;
    error: { code: string; message: string } | null;
  }>('/api/v1/search', { params });

  return res.data.data;
}
