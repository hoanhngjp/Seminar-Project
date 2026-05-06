import { apiClient } from './client';

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

export type TimeRange = '7d' | '30d';

export async function fetchHeatmap(songId: string, timeRange: TimeRange): Promise<HeatmapPoint[]> {
  const res = await apiClient.get<{ data: { heatmap: HeatmapPoint[] } }>(
    `/api/v1/analytics/creator/heatmap/${songId}`,
    { params: { timeRange } },
  );
  return res.data.data.heatmap;
}

export async function fetchSongStats(songId: string, timeRange: TimeRange): Promise<SongStats> {
  const res = await apiClient.get<{ data: SongStats }>(
    `/api/v1/analytics/creator/stats/${songId}`,
    { params: { timeRange } },
  );
  return res.data.data;
}
