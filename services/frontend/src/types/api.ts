// Shared API response types — mirrors API Design V2 response format

export interface ApiMeta {
  apiVersion: string;
  requestId: string;
  timestamp: string;
  cache?: 'HIT' | 'MISS';
  pagination?: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  meta: ApiMeta;
  error: ApiError | null;
}
