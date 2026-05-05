"""
Unit tests for Kafka event handlers.
AC2.2.1: Song_Played → increase genre weight when duration >= 80%
AC2.2.2: Song_Skipped → decrease genre weight when duration < 30%
AC2.2.3: duplicate event → skip (idempotency — tested via consumer integration)
"""
import json

import pytest
import fakeredis.aioredis

from recommendation_service.kafka.handlers import (
    handle_preferences_updated,
    handle_song_played,
    handle_song_skipped,
)

USER_ID = "user-abc-123"
GENRE_ID = "genre-xyz-456"


@pytest.fixture
def redis():
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


# ----------------------------------------------------------------
# handle_song_played (AC2.2.1)
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_song_played_increments_weight_when_duration_gte_80(redis):
    # AC2.2.1: listened >= 80% → genre weight increases
    payload = {"user_id": USER_ID, "genre_id": GENRE_ID, "duration_percent": 95.0}
    await handle_song_played(payload, redis)

    weight = await redis.hget(f"rec:weights:{USER_ID}", GENRE_ID)
    assert weight is not None
    assert float(weight) == pytest.approx(0.3, abs=0.001)


@pytest.mark.asyncio
async def test_song_played_does_not_increment_when_duration_lt_80(redis):
    # duration < 80% → no weight change
    payload = {"user_id": USER_ID, "genre_id": GENRE_ID, "duration_percent": 50.0}
    await handle_song_played(payload, redis)

    weight = await redis.hget(f"rec:weights:{USER_ID}", GENRE_ID)
    assert weight is None


@pytest.mark.asyncio
async def test_song_played_invalidates_cache(redis):
    # Cache must be invalidated after weight change
    cache_key = f"rec:cache:{USER_ID}:morning"
    await redis.set(cache_key, json.dumps([{"song_id": "s1"}]))

    payload = {"user_id": USER_ID, "genre_id": GENRE_ID, "duration_percent": 100.0}
    await handle_song_played(payload, redis)

    cached = await redis.get(cache_key)
    assert cached is None


@pytest.mark.asyncio
async def test_song_played_sets_ttl_on_weights(redis):
    payload = {"user_id": USER_ID, "genre_id": GENRE_ID, "duration_percent": 90.0}
    await handle_song_played(payload, redis)

    ttl = await redis.ttl(f"rec:weights:{USER_ID}")
    assert ttl > 0


# ----------------------------------------------------------------
# handle_song_skipped (AC2.2.2)
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_song_skipped_decrements_weight_when_duration_lt_30(redis):
    # AC2.2.2: skipped before 30% → genre weight decreases
    payload = {"user_id": USER_ID, "genre_id": GENRE_ID, "duration_percent": 10.0}
    await handle_song_skipped(payload, redis)

    weight = await redis.hget(f"rec:weights:{USER_ID}", GENRE_ID)
    assert weight is not None
    assert float(weight) == pytest.approx(-0.2, abs=0.001)


@pytest.mark.asyncio
async def test_song_skipped_does_not_decrement_when_duration_gte_30(redis):
    # duration >= 30% → no penalty (listener gave it a fair chance)
    payload = {"user_id": USER_ID, "genre_id": GENRE_ID, "duration_percent": 45.0}
    await handle_song_skipped(payload, redis)

    weight = await redis.hget(f"rec:weights:{USER_ID}", GENRE_ID)
    assert weight is None


@pytest.mark.asyncio
async def test_song_skipped_invalidates_cache(redis):
    cache_key = f"rec:cache:{USER_ID}:evening"
    await redis.set(cache_key, json.dumps([{"song_id": "s2"}]))

    payload = {"user_id": USER_ID, "genre_id": GENRE_ID, "duration_percent": 5.0}
    await handle_song_skipped(payload, redis)

    cached = await redis.get(cache_key)
    assert cached is None


# ----------------------------------------------------------------
# handle_preferences_updated
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_preferences_updated_seeds_onboarding(redis):
    payload = {"user_id": USER_ID, "genres": ["Pop", "Jazz", "Acoustic"]}
    await handle_preferences_updated(payload, redis)

    raw = await redis.get(f"rec:onboarding:{USER_ID}")
    assert raw is not None
    data = json.loads(raw)
    assert data["genres"] == ["Pop", "Jazz", "Acoustic"]


@pytest.mark.asyncio
async def test_preferences_updated_invalidates_cache(redis):
    cache_key = f"rec:cache:{USER_ID}:morning"
    await redis.set(cache_key, json.dumps([{"song_id": "s3"}]))

    payload = {"user_id": USER_ID, "genres": ["Rock"]}
    await handle_preferences_updated(payload, redis)

    cached = await redis.get(cache_key)
    assert cached is None
