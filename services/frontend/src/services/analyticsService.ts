import { apiClient } from './api';
import type { ApiResponse } from '../types/api';
import type { AnalyticsStats, HeatmapDropOff } from '../types/domain';

export type TimeRange = '7d' | '30d';

export interface HeatmapPoint {
  second: number;
  skipRate: number;
}

export interface SongStats {
  totalPlays: number;
  totalSkips: number;
  uniqueListeners: number;
  avgListenPercent: number;
}

export async function fetchHeatmap(songId: string, timeRange: TimeRange): Promise<HeatmapDropOff[]> {
  const res = await apiClient.get<ApiResponse<{ songId: string; heatmap: HeatmapDropOff[] }>>(
    `/api/v1/analytics/creator/heatmap/${songId}`,
    { params: { timeRange } },
  );
  return res.data.data?.heatmap ?? [];
}

export async function fetchSongStats(songId: string, timeRange: TimeRange): Promise<AnalyticsStats> {
  const res = await apiClient.get<ApiResponse<AnalyticsStats>>(
    `/api/v1/analytics/creator/stats/${songId}`,
    { params: { timeRange } },
  );
  return res.data.data ?? { totalPlays: 0, totalSkips: 0, uniqueListeners: 0, avgListenPercent: 0, dailyListeners: [] };
}
