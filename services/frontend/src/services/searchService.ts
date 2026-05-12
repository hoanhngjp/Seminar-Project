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

  const res = await apiClient.get<ApiResponse<SearchResult[]>>(
    '/api/v1/search',
    { params },
  );
  const meta = res.data.meta;
  return {
    items:      res.data.data ?? [],
    nextCursor: meta.pagination?.nextCursor ?? null,
    hasMore:    meta.pagination?.hasMore ?? false,
  };
}
