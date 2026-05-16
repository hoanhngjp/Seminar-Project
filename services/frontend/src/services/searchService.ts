import { apiClient } from './api';
import type { ApiResponse } from '../types/api';
import type { SearchResult } from '../types/domain';

export interface SearchResponse {
  items: SearchResult[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function searchContent(
  query: string,
  type: 'all' | 'song' | 'artist' = 'all',
  limit = 10,
  cursor?: string,
): Promise<SearchResponse> {
  const params: Record<string, string | number> = { q: query, type, limit };
  if (cursor) params['cursor'] = cursor;

  const res = await apiClient.get<ApiResponse<{ items: SearchResult[]; nextCursor: string | null; hasMore: boolean }>>(
    '/api/v1/search',
    { params },
  );
  const d = res.data.data;
  return {
    items:      d?.items ?? [],
    nextCursor: d?.nextCursor ?? null,
    hasMore:    d?.hasMore ?? false,
  };
}
