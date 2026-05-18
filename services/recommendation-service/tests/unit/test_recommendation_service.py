"""
Unit tests for RecommendationService orchestration logic.
Tests fallback chain and cache behavior using AsyncMock repo.
AC2.1.5: timeout → fallback trending
"""
import asyncio

import pytest
from unittest.mock import AsyncMock, patch

from recommendation_service.schemas.response import ReasonItem, SongItem
from recommendation_service.services.recommendation_service import RecommendationService

USER_ID = "user-abc-123"
CORR_ID = "corr-id-001"


def _make_repo(
    cached=None,
    weights=None,
    trending=None,
    onboarding=None,
):
    repo = AsyncMock()
    repo.get_cached_recommendations = AsyncMock(return_value=cached)
    repo.set_cached_recommendations = AsyncMock()
    repo.invalidate_user_cache = AsyncMock()
    repo.get_weights = AsyncMock(return_value=weights or {})
    repo.get_trending = AsyncMock(return_value=trending or [])
    repo.get_onboarding_genres = AsyncMock(return_value=onboarding or [])
    repo.increment_weight = AsyncMock()
    return repo


# ----------------------------------------------------------------
# Cache hit (AC2.1.5 path: cache → skip rule engine)
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_cache_hit_returns_cached_and_skips_rule_engine():
    cached_data = [
        {
            "song_id": "s1", "title": "Song 1", "artist": "A",
            "thumbnail": "", "reason": {"type": "TRENDING", "text": "Đang thịnh hành"},
        }
    ]
    repo = _make_repo(cached=cached_data)
    service = RecommendationService(repo)

    items, cache_status = await service.get_recommendations(USER_ID, "morning", 10, CORR_ID)

    assert cache_status == "HIT"
    assert len(items) == 1
    assert items[0].song_id == "s1"
    repo.get_weights.assert_not_called()  # rule engine must NOT run
    repo.get_trending.assert_not_called()


# ----------------------------------------------------------------
# Rule engine runs on cache miss
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_cache_miss_runs_rule_engine_and_caches_result():
    from unittest.mock import AsyncMock
    from recommendation_service.infrastructure.music_service_client import MusicBatchSong

    repo = _make_repo(
        cached=None,
        trending=["song-A", "song-B", "song-C"],
    )
    music_client = AsyncMock()
    music_client.get_songs_batch = AsyncMock(return_value=[
        MusicBatchSong(id="song-A", title="Song A", artist_name="Artist A",
                       genre_id="genre-1", mood_tags=[], cover_image_url="", duration_sec=180),
    ])
    service = RecommendationService(repo, music_client)

    items, cache_status = await service.get_recommendations(USER_ID, "morning", 2, CORR_ID)

    assert cache_status == "MISS"
    repo.set_cached_recommendations.assert_called_once()


# ----------------------------------------------------------------
# Fallback to trending on Rule Engine timeout (AC2.1.5)
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_fallback_trending_when_rule_engine_times_out():
    # AC2.1.5: Rule Engine timeout > 300ms → return Top 50 Trending
    repo = AsyncMock()
    repo.get_cached_recommendations = AsyncMock(return_value=None)
    repo.get_trending = AsyncMock(return_value=["trending-1", "trending-2"])
    repo.set_cached_recommendations = AsyncMock()

    async def slow_weights(user_id):
        await asyncio.sleep(10)  # simulate timeout
        return {}

    repo.get_weights = AsyncMock(side_effect=slow_weights)
    repo.get_onboarding_genres = AsyncMock(return_value=[])

    service = RecommendationService(repo)

    # Patch timeout to 50ms so test is fast
    with patch("recommendation_service.services.recommendation_service.settings") as mock_settings:
        mock_settings.recommendation_timeout_ms = 50
        items, cache_status = await service.get_recommendations(USER_ID, "morning", 10, CORR_ID)

    assert cache_status == "MISS"
    repo.get_trending.assert_called_once()
    # All items should be TRENDING reason type
    for item in items:
        assert item.reason.type == "TRENDING"


# ----------------------------------------------------------------
# apply_feedback — weight updates
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_apply_feedback_play_gte_80_increments_weight():
    repo = _make_repo()
    service = RecommendationService(repo)

    await service.apply_feedback(USER_ID, "genre-123", "PLAY", 95.0)

    repo.increment_weight.assert_called_once_with(USER_ID, "genre-123", 0.3)
    repo.invalidate_user_cache.assert_called_once_with(USER_ID)


@pytest.mark.asyncio
async def test_apply_feedback_play_lt_80_does_nothing():
    repo = _make_repo()
    service = RecommendationService(repo)

    await service.apply_feedback(USER_ID, "genre-123", "PLAY", 60.0)

    repo.increment_weight.assert_not_called()
    repo.invalidate_user_cache.assert_not_called()


@pytest.mark.asyncio
async def test_apply_feedback_skip_lt_30_decrements_weight():
    repo = _make_repo()
    service = RecommendationService(repo)

    await service.apply_feedback(USER_ID, "genre-123", "SKIP", 10.0)

    repo.increment_weight.assert_called_once_with(USER_ID, "genre-123", -0.2)
    repo.invalidate_user_cache.assert_called_once_with(USER_ID)


@pytest.mark.asyncio
async def test_apply_feedback_skip_gte_30_does_nothing():
    repo = _make_repo()
    service = RecommendationService(repo)

    await service.apply_feedback(USER_ID, "genre-123", "SKIP", 50.0)

    repo.increment_weight.assert_not_called()
