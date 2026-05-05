import json
import logging

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

WEIGHTS_TTL = 7 * 24 * 3600   # 7 days
CACHE_TTL = 3600               # 1 hour
IDEMPOTENCY_TTL = 24 * 3600   # 24 hours
ONBOARDING_TTL = 7 * 24 * 3600


class RedisRepository:
    def __init__(self, client: aioredis.Redis):
        self._r = client

    # ---- Cache-aside ----

    async def get_cached_recommendations(self, user_id: str, context: str) -> list | None:
        key = f"rec:cache:{user_id}:{context}"
        raw = await self._r.get(key)
        return json.loads(raw) if raw else None

    async def set_cached_recommendations(self, user_id: str, context: str, data: list) -> None:
        key = f"rec:cache:{user_id}:{context}"
        await self._r.set(key, json.dumps(data), ex=CACHE_TTL)

    async def invalidate_user_cache(self, user_id: str) -> None:
        async for key in self._r.scan_iter(f"rec:cache:{user_id}:*"):
            await self._r.delete(key)

    # ---- Genre weights (Redis Hash) ----

    async def get_weights(self, user_id: str) -> dict[str, float]:
        key = f"rec:weights:{user_id}"
        raw = await self._r.hgetall(key)
        return {k: float(v) for k, v in raw.items()}

    async def increment_weight(self, user_id: str, genre_id: str, delta: float) -> None:
        key = f"rec:weights:{user_id}"
        await self._r.hincrbyfloat(key, genre_id, delta)
        await self._r.expire(key, WEIGHTS_TTL)

    # ---- Trending fallback (read-only) ----

    async def get_trending(self, limit: int = 50) -> list[str]:
        return await self._r.zrevrange("rec:trending:global", 0, limit - 1)

    # ---- Idempotency (SET NX) ----

    async def check_and_set_idempotency(self, event_id: str) -> bool:
        """Returns True if event is NEW (not yet processed). False if duplicate."""
        key = f"rec:idempotency:{event_id}"
        result = await self._r.set(key, "1", ex=IDEMPOTENCY_TTL, nx=True)
        return result is not None

    # ---- Onboarding preferences ----

    async def get_onboarding_genres(self, user_id: str) -> list[str]:
        key = f"rec:onboarding:{user_id}"
        raw = await self._r.get(key)
        if not raw:
            return []
        return json.loads(raw).get("genres", [])

    async def set_onboarding_genres(self, user_id: str, genres: list[str]) -> None:
        key = f"rec:onboarding:{user_id}"
        await self._r.set(key, json.dumps({"genres": genres}), ex=ONBOARDING_TTL)
