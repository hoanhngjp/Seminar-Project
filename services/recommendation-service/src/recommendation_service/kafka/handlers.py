"""
Kafka event handlers — pure async functions, no global state.
Called by consumer.py after idempotency check passes.

Song_Played:  duration_percent >= 80 → +0.3 genre weight   (AC2.2.1)
Song_Skipped: duration_percent < 30  → -0.2 genre weight   (AC2.2.2)
User_Preferences_Updated:             seed onboarding prefs
"""
import json
import logging

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

WEIGHTS_TTL = 7 * 24 * 3600   # 7 days
ONBOARDING_TTL = 7 * 24 * 3600


async def handle_song_played(payload: dict, redis: aioredis.Redis) -> None:
    # AC2.2.1: Song_Played → increase genre weight if listened >= 80%
    user_id = payload["user_id"]
    genre_id = payload["genre_id"]
    duration_percent = float(payload.get("duration_percent", 0))

    if duration_percent >= 80:
        weights_key = f"rec:weights:{user_id}"
        await redis.hincrbyfloat(weights_key, genre_id, 0.3)
        await redis.expire(weights_key, WEIGHTS_TTL)
        # Invalidate recommendation cache for this user
        async for key in redis.scan_iter(f"rec:cache:{user_id}:*"):
            await redis.delete(key)
        logger.info(
            "weight_increased user_id=%s genre_id=%s duration_percent=%.1f",
            user_id, genre_id, duration_percent,
        )


async def handle_song_skipped(payload: dict, redis: aioredis.Redis) -> None:
    # AC2.2.2: Song_Skipped → decrease genre weight if skipped before 30%
    user_id = payload["user_id"]
    genre_id = payload["genre_id"]
    duration_percent = float(payload.get("duration_percent", 0))

    if duration_percent < 30:
        weights_key = f"rec:weights:{user_id}"
        await redis.hincrbyfloat(weights_key, genre_id, -0.2)
        await redis.expire(weights_key, WEIGHTS_TTL)
        async for key in redis.scan_iter(f"rec:cache:{user_id}:*"):
            await redis.delete(key)
        logger.info(
            "weight_decreased user_id=%s genre_id=%s duration_percent=%.1f",
            user_id, genre_id, duration_percent,
        )


async def handle_preferences_updated(payload: dict, redis: aioredis.Redis) -> None:
    # User_Preferences_Updated: seed onboarding genre preferences
    user_id = payload["user_id"]
    genres = payload.get("genres", [])

    onboarding_key = f"rec:onboarding:{user_id}"
    await redis.set(onboarding_key, json.dumps({"genres": genres}), ex=ONBOARDING_TTL)

    # Invalidate stale recommendation cache
    async for key in redis.scan_iter(f"rec:cache:{user_id}:*"):
        await redis.delete(key)

    logger.info("onboarding_weights_seeded user_id=%s genres=%s", user_id, genres)
