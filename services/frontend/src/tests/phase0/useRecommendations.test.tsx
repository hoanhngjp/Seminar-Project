// Tests for Phase 0 — useRecommendations externalContext support
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRecommendations } from '../../features/recommendation/hooks/useRecommendations';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('../../services/recommendationService', () => ({
  fetchRecommendations: vi.fn().mockResolvedValue([
    {
      id: 'song-001', title: 'Lạc Trôi', artist: 'Sơn Tùng M-TP',
      duration: 245, isExplicit: false,
      reason: { type: 'CONTEXT', text: 'Phù hợp buổi sáng' },
    },
    {
      id: 'song-002', title: 'Có Chắc Yêu Là Đây', artist: 'Sơn Tùng M-TP',
      duration: 228, isExplicit: false,
      reason: { type: 'TRENDING', text: 'Trending' },
    },
    {
      id: 'song-003', title: 'Chuyến Xe', artist: 'Ngọt',
      duration: 210, isExplicit: false,
      reason: { type: 'PREFERENCE', text: '' },
    },
  ]),
}));

vi.mock('../../utils/time', () => ({
  getTimeContext: vi.fn().mockReturnValue('morning'),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRecommendations — backward compat (no externalContext)', () => {
  it('returns grouped items and autoContext when called without argument', async () => {
    const { result } = renderHook(() => useRecommendations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.context).toBe('morning');
    expect(result.current.contextItems).toHaveLength(1);
    expect(result.current.trendingItems).toHaveLength(1);
    expect(result.current.preferenceItems).toHaveLength(1);
  });
});

describe('useRecommendations — externalContext override', () => {
  it('uses externalContext when provided', async () => {
    const { result } = renderHook(() => useRecommendations('evening'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.context).toBe('evening');
  });

  it('uses none context when externalContext is none', async () => {
    const { result } = renderHook(() => useRecommendations('none'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.context).toBe('none');
  });

  it('reloads when externalContext changes', async () => {
    const { fetchRecommendations } = await import('../../services/recommendationService');
    const fetchMock = vi.mocked(fetchRecommendations);
    fetchMock.mockClear();

    const { rerender } = renderHook(
      ({ ctx }: { ctx: 'morning' | 'evening' | 'none' }) => useRecommendations(ctx),
      { initialProps: { ctx: 'morning' as 'morning' | 'evening' | 'none' } },
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender({ ctx: 'evening' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

describe('useRecommendations — error handling', () => {
  it('sets error when fetchRecommendations throws', async () => {
    const { fetchRecommendations } = await import('../../services/recommendationService');
    vi.mocked(fetchRecommendations).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useRecommendations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
    expect(result.current.contextItems).toHaveLength(0);
  });
});
