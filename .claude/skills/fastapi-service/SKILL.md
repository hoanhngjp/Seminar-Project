# SKILL: fastapi-service

> Claude đọc file này mỗi khi tạo hoặc chỉnh sửa Recommendation Service (Python FastAPI).
> Ngắn gọn — đọc để làm, không phải đọc để học.
> Service chạy trên port **5009**. Không dùng ML/AI/Vector DB — Rule Engine + Redis only.

---

## 1. Folder Structure

```
services/
└── recommendation-service/
    ├── src/
    │   ├── main.py                        ← App factory, middleware, lifespan
    │   ├── core/
    │   │   ├── config.py                  ← Pydantic Settings (đọc .env)
    │   │   └── dependencies.py            ← FastAPI Depends() providers
    │   ├── routers/
    │   │   └── recommendations.py         ← Route handlers (thin, no logic)
    │   ├── services/
    │   │   ├── recommendation_service.py  ← Orchestration, rule engine call
    │   │   └── rule_engine.py             ← Scoring logic (pure functions)
    │   ├── repositories/
    │   │   └── redis_repository.py        ← All Redis I/O
    │   ├── schemas/
    │   │   ├── request.py                 ← Pydantic input models
    │   │   └── response.py                ← Pydantic output models
    │   ├── models/
    │   │   └── recommendation.py          ← Internal domain models (dataclass)
    │   ├── kafka/
    │   │   ├── consumer.py                ← aiokafka consumer loop
    │   │   └── handlers.py                ← Event handler functions
    │   ├── middleware/
    │   │   └── correlation_id.py          ← Extract/inject X-Correlation-Id
    │   └── exceptions/
    │       └── domain_exceptions.py       ← DomainException subclasses
    ├── tests/
    │   ├── conftest.py                    ← Fixtures: app, redis_mock, kafka_mock
    │   ├── unit/
    │   │   ├── test_rule_engine.py        ← Pure function tests (no I/O)
    │   │   └── test_recommendation_service.py
    │   └── integration/
    │       └── test_recommendations_api.py
    ├── requirements.txt
    ├── Dockerfile
    └── .env.example
```

---

## 2. Boilerplate

### main.py

```python
from contextlib import asynccontextmanager
import structlog
import redis.asyncio as aioredis
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from core.config import settings
from core.dependencies import get_redis
from routers import recommendations
from middleware.correlation_id import CorrelationIdMiddleware
from exceptions.domain_exceptions import DomainException
from kafka.consumer import start_consumer, stop_consumer

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    redis_client = aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
    )
    app.state.redis = redis_client
    await redis_client.ping()  # verify connection
    logger.info("redis_connected", service=settings.service_name)

    consumer_task = await start_consumer(app)
    logger.info("kafka_consumer_started", service=settings.service_name)

    yield

    # Shutdown
    await stop_consumer(consumer_task)
    await redis_client.aclose()
    logger.info("shutdown_complete", service=settings.service_name)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Recommendation Service",
        version=settings.service_version,
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
    )

    # Middleware — order matters: CorrelationId first
    app.add_middleware(CorrelationIdMiddleware)

    # Routers
    app.include_router(recommendations.router)

    # Global exception handlers
    @app.exception_handler(DomainException)
    async def domain_exception_handler(request: Request, exc: DomainException):
        return JSONResponse(
            status_code=exc.http_status,
            content=_error_response(request, exc.error_code, exc.message),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.error("unhandled_exception", error=str(exc), service=settings.service_name)
        return JSONResponse(
            status_code=500,
            content=_error_response(request, "INTERNAL_ERROR", "An unexpected error occurred."),
        )

    @app.get("/health", tags=["infra"])
    async def health(request: Request):
        redis: aioredis.Redis = request.app.state.redis
        try:
            await redis.ping()
            redis_status = "healthy"
        except Exception:
            redis_status = "unhealthy"
        return {
            "status": "healthy" if redis_status == "healthy" else "degraded",
            "version": settings.service_version,
            "checks": {"redis": redis_status},
        }

    return app


def _error_response(request: Request, code: str, message: str) -> dict:
    import datetime
    return {
        "success": False,
        "data": None,
        "meta": {
            "apiVersion": "v1",
            "requestId": getattr(request.state, "correlation_id", ""),
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        },
        "error": {"code": code, "message": message},
    }


app = create_app()
```

### core/config.py

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    service_name: str = "recommendation-service"
    service_version: str = "1.0.0"
    debug: bool = False

    redis_url: str = "redis://localhost:6379"

    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_consumer_group_id: str = "recommendation-service-group"
    kafka_topics: list[str] = ["Song_Played", "Song_Skipped", "User_Preferences_Updated"]

    # Rule engine
    recommendation_timeout_ms: int = 300
    recommendation_default_limit: int = 10


settings = Settings()
```

### core/dependencies.py

```python
import redis.asyncio as aioredis
from fastapi import Request
from repositories.redis_repository import RedisRepository


def get_redis(request: Request) -> aioredis.Redis:
    return request.app.state.redis


def get_redis_repo(request: Request) -> RedisRepository:
    return RedisRepository(request.app.state.redis)
```

### Response Wrapper (reusable helper)

```python
# schemas/response.py
import datetime
from typing import Any, Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class ApiMeta(BaseModel):
    apiVersion: str = "v1"
    requestId: str
    timestamp: str
    cache: str | None = None


class ApiError(BaseModel):
    code: str
    message: str


class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: T | None
    meta: ApiMeta
    error: ApiError | None

    @classmethod
    def ok(cls, data: Any, request_id: str, cache: str | None = None) -> "ApiResponse":
        return cls(
            success=True,
            data=data,
            meta=ApiMeta(
                requestId=request_id,
                timestamp=datetime.datetime.utcnow().isoformat() + "Z",
                cache=cache,
            ),
            error=None,
        )
```

---

## 3. Pydantic Schema Conventions

```python
# schemas/request.py
from pydantic import BaseModel, Field, field_validator
from typing import Literal
from uuid import UUID


class FeedbackRequest(BaseModel):
    event_id: UUID = Field(..., description="Idempotency key")
    version: str = Field(default="v1")
    song_id: UUID
    action: Literal["PLAY", "SKIP"]
    duration_percent: float = Field(..., ge=0.0, le=100.0)

    @field_validator("duration_percent")
    @classmethod
    def round_percent(cls, v: float) -> float:
        return round(v, 2)


class RecommendationQueryParams(BaseModel):
    context: Literal["morning", "afternoon", "evening", "night"] | None = None
    limit: int = Field(default=10, ge=1, le=50)
    cursor: str | None = None


# schemas/response.py
class ReasonItem(BaseModel):
    type: Literal["CONTEXT", "PREFERENCE", "TRENDING"]
    text: str


class SongItem(BaseModel):
    song_id: str
    title: str
    artist: str
    thumbnail: str
    reason: ReasonItem


class RecommendationData(BaseModel):
    items: list[SongItem]
    next_cursor: str | None = None
    has_more: bool = False
```

**Rules:**
- `Request` schema: validate input, dùng `Field(..., ge=..., le=...)`, không có defaults tuỳ tiện
- `Response` schema: luôn có type annotations đầy đủ, `| None` thay vì `Optional[X]`
- Không dùng `dict` làm kiểu trả về từ route handler — luôn trả về Pydantic model hoặc `ApiResponse`
- Tách biệt hoàn toàn request/response schema — không dùng domain model làm response trực tiếp

---

## 4. Async Patterns

```python
# ✅ async def cho tất cả route handlers
@router.get("", response_model=ApiResponse)
async def get_recommendations(
    request: Request,
    params: Annotated[RecommendationQueryParams, Query()],
    service: Annotated[RecommendationService, Depends(get_recommendation_service)],
) -> ApiResponse:
    result = await service.get_recommendations(
        user_id=request.state.user_id,
        context=params.context,
        limit=params.limit,
        correlation_id=request.state.correlation_id,
    )
    return ApiResponse.ok(result, request.state.correlation_id, cache=result.cache_status)


# ✅ asyncio-native Redis
import redis.asyncio as aioredis  # không dùng redis.Redis (sync)
value = await client.get(key)

# ✅ asyncio-native HTTP nếu cần gọi service khác
import httpx
async with httpx.AsyncClient() as client:
    resp = await client.get(url)

# ❌ KHÔNG blocking event loop
import time; time.sleep(1)          # blocks event loop
import requests; requests.get(url)  # sync HTTP — blocks event loop
result = asyncio.run(coro())        # không gọi trong async context

# ❌ KHÔNG dùng sync Redis client trong async context
import redis; r = redis.Redis()     # sync — blocks event loop
```

---

## 5. Redis Integration (aioredis)

### Repository

```python
# repositories/redis_repository.py
import json
import redis.asyncio as aioredis
import structlog

logger = structlog.get_logger()

WEIGHTS_TTL = 7 * 24 * 3600      # 7 days
CACHE_TTL   = 3600                # 1 hour
IDEMPOTENCY_TTL = 24 * 3600      # 24 hours


class RedisRepository:
    def __init__(self, client: aioredis.Redis):
        self._r = client

    # --- Cache-aside ---
    async def get_cached_recommendations(self, user_id: str, context: str) -> list | None:
        key = f"rec:cache:{user_id}:{context}"   # pattern từ REDIS_KEY_DESIGN.md
        raw = await self._r.get(key)
        return json.loads(raw) if raw else None

    async def set_cached_recommendations(self, user_id: str, context: str, data: list) -> None:
        key = f"rec:cache:{user_id}:{context}"
        await self._r.set(key, json.dumps(data), ex=CACHE_TTL)

    async def invalidate_user_cache(self, user_id: str) -> None:
        # SCAN không dùng KEYS *
        async for key in self._r.scan_iter(f"rec:cache:{user_id}:*"):
            await self._r.delete(key)

    # --- Genre weights (Redis Hash) ---
    async def get_weights(self, user_id: str) -> dict[str, float]:
        key = f"rec:weights:{user_id}"
        raw = await self._r.hgetall(key)
        return {k: float(v) for k, v in raw.items()}

    async def increment_weight(self, user_id: str, genre_id: str, delta: float) -> None:
        key = f"rec:weights:{user_id}"
        await self._r.hincrbyfloat(key, genre_id, delta)
        await self._r.expire(key, WEIGHTS_TTL)

    # --- Trending fallback ---
    async def get_trending(self, limit: int = 50) -> list[str]:
        return await self._r.zrevrange("rec:trending:global", 0, limit - 1)

    # --- Idempotency (SET NX) ---
    async def check_and_set_idempotency(self, event_id: str) -> bool:
        """Returns True nếu event là MỚI (chưa xử lý). False nếu duplicate."""
        key = f"rec:idempotency:{event_id}"
        result = await self._r.set(key, "1", ex=IDEMPOTENCY_TTL, nx=True)
        return result is not None   # True = SET thành công = mới

    # --- Onboarding weights ---
    async def get_onboarding_genres(self, user_id: str) -> list[str]:
        key = f"rec:onboarding:{user_id}"
        raw = await self._r.get(key)
        if not raw:
            return []
        return json.loads(raw).get("genres", [])
```

**Key naming rules (từ `.github/REDIS_KEY_DESIGN.md`):**

| Key | Pattern | TTL |
|---|---|---|
| Genre weights | `rec:weights:{user_id}` | 7 days |
| Recommendation cache | `rec:cache:{user_id}:{context}` | 1 hour |
| Trending | `rec:trending:global` | 1 hour (read-only) |
| Idempotency | `rec:idempotency:{event_id}` | 24 hours |
| Onboarding | `rec:onboarding:{user_id}` | 7 days |

- Không bao giờ đặt PII trong key — chỉ UUID
- Mọi key phải có TTL tường minh
- Không dùng `KEYS *` — dùng `scan_iter`
- `rec:trending:global` là read-only từ Recommendation Service — không ghi

---

## 6. Rule Engine

### Time-of-Day Context Detection

```python
# services/rule_engine.py
import datetime
from dataclasses import dataclass
from typing import Literal

ContextType = Literal["morning", "afternoon", "evening", "night"]


def get_current_context() -> ContextType:
    hour = datetime.datetime.utcnow().hour  # server UTC; adjust if needed
    if 5 <= hour < 12:
        return "morning"
    elif 12 <= hour < 17:
        return "afternoon"
    elif 17 <= hour < 21:
        return "evening"
    else:
        return "night"


CONTEXT_GENRE_MAP: dict[ContextType, list[str]] = {
    "morning":   ["acoustic", "pop", "indie"],
    "afternoon": ["pop", "hip-hop", "edm"],
    "evening":   ["r&b", "jazz", "soul"],
    "night":     ["electronic", "ambient", "classical"],
}
```

### Scoring Function

```python
@dataclass
class SongCandidate:
    song_id: str
    title: str
    artist: str
    thumbnail: str
    genre_id: str
    genre_name: str
    base_popularity: float      # 0.0 – 1.0 (từ metadata)


@dataclass
class ScoredSong:
    candidate: SongCandidate
    score: float
    reason_type: Literal["CONTEXT", "PREFERENCE", "TRENDING"]
    reason_text: str


def score_candidate(
    candidate: SongCandidate,
    context: ContextType,
    weights: dict[str, float],      # genre_id → weight từ Redis
    onboarding_genres: list[str],   # genre names từ onboarding
) -> ScoredSong:
    base_score = candidate.base_popularity

    # Context bonus: +0.4 nếu genre khớp context
    context_genres = CONTEXT_GENRE_MAP.get(context, [])
    context_bonus = 0.4 if candidate.genre_name.lower() in context_genres else 0.0

    # Preference bonus: weight từ Redis (HGETALL rec:weights:{user_id})
    preference_bonus = float(weights.get(candidate.genre_id, 0.0)) * 0.3

    # Onboarding bonus: +0.2 nếu genre nằm trong onboarding
    onboarding_bonus = 0.2 if candidate.genre_name.lower() in [g.lower() for g in onboarding_genres] else 0.0

    # Skip penalty: weight âm đã được encode trong weights (giá trị âm từ HINCRBYFLOAT -0.2)
    skip_penalty = abs(min(0.0, float(weights.get(candidate.genre_id, 0.0)))) * 0.5

    final_score = base_score + context_bonus + preference_bonus + onboarding_bonus - skip_penalty

    # Determine reason for explain_text
    if context_bonus > 0:
        reason_type = "CONTEXT"
        reason_text = _context_reason_text(context)
    elif preference_bonus > 0 or onboarding_bonus > 0:
        reason_type = "PREFERENCE"
        reason_text = f"Phù hợp sở thích {candidate.genre_name} của bạn"
    else:
        reason_type = "TRENDING"
        reason_text = "Đang thịnh hành"

    return ScoredSong(
        candidate=candidate,
        score=final_score,
        reason_type=reason_type,
        reason_text=reason_text,
    )


def _context_reason_text(context: ContextType) -> str:
    return {
        "morning":   "Gợi ý buổi sáng tươi mới",
        "afternoon": "Gợi ý buổi chiều năng động",
        "evening":   "Gợi ý buổi tối thư giãn",
        "night":     "Gợi ý đêm khuya nhẹ nhàng",
    }[context]
```

### Fallback Chain + Timeout

```python
# services/recommendation_service.py
import asyncio
from core.config import settings
from repositories.redis_repository import RedisRepository
from services.rule_engine import score_candidate, get_current_context, SongCandidate
from schemas.response import SongItem, ReasonItem
import structlog

logger = structlog.get_logger()


class RecommendationService:
    def __init__(self, repo: RedisRepository):
        self._repo = repo

    async def get_recommendations(
        self,
        user_id: str,
        context: str | None,
        limit: int,
        correlation_id: str,
    ) -> tuple[list[SongItem], str]:  # (items, cache_status)
        resolved_context = context or get_current_context()

        # 1. Cache hit
        cached = await self._repo.get_cached_recommendations(user_id, resolved_context)
        if cached:
            logger.info("recommendations_cache_hit", user_id=user_id, context=resolved_context,
                        correlation_id=correlation_id, service=settings.service_name)
            return _deserialize(cached)[:limit], "HIT"

        # 2. Rule engine với timeout 300ms
        try:
            result = await asyncio.wait_for(
                self._run_rule_engine(user_id, resolved_context, limit),
                timeout=settings.recommendation_timeout_ms / 1000,
            )
            await self._repo.set_cached_recommendations(user_id, resolved_context, _serialize(result))
            return result, "MISS"

        except asyncio.TimeoutError:
            logger.warning("rule_engine_timeout", user_id=user_id, timeout_ms=settings.recommendation_timeout_ms,
                           correlation_id=correlation_id, service=settings.service_name)
            return await self._fallback_trending(limit), "MISS"

    async def _run_rule_engine(self, user_id: str, context: str, limit: int) -> list[SongItem]:
        weights = await self._repo.get_weights(user_id)
        onboarding_genres = await self._repo.get_onboarding_genres(user_id)
        candidates = await self._fetch_candidates(context, limit * 3)  # over-fetch

        scored = [
            score_candidate(c, context, weights, onboarding_genres)
            for c in candidates
        ]
        scored.sort(key=lambda s: s.score, reverse=True)

        return [
            SongItem(
                song_id=s.candidate.song_id,
                title=s.candidate.title,
                artist=s.candidate.artist,
                thumbnail=s.candidate.thumbnail,
                reason=ReasonItem(type=s.reason_type, text=s.reason_text),
            )
            for s in scored[:limit]
        ]

    async def _fallback_trending(self, limit: int) -> list[SongItem]:
        """Fallback: Top 50 Trending từ rec:trending:global."""
        song_ids = await self._repo.get_trending(limit)
        # Nếu trending cũng rỗng → trả về list rỗng, không raise
        return [
            SongItem(
                song_id=sid, title="", artist="", thumbnail="",
                reason=ReasonItem(type="TRENDING", text="Đang thịnh hành"),
            )
            for sid in song_ids
        ]

    async def _fetch_candidates(self, context: str, limit: int) -> list[SongCandidate]:
        # Gọi Music Service REST API hoặc đọc từ local cache
        # TODO: implement với httpx.AsyncClient + circuit breaker
        return []
```

---

## 7. Kafka Consumer (aiokafka)

### Consumer Loop

```python
# kafka/consumer.py
import asyncio
import json
from aiokafka import AIOKafkaConsumer
from core.config import settings
from kafka.handlers import handle_song_played, handle_song_skipped, handle_preferences_updated
import structlog

logger = structlog.get_logger()

HANDLERS = {
    "Song_Played": handle_song_played,
    "Song_Skipped": handle_song_skipped,
    "User_Preferences_Updated": handle_preferences_updated,
}
MAX_RETRIES = 3


async def start_consumer(app) -> asyncio.Task:
    task = asyncio.create_task(_consumer_loop(app))
    return task


async def stop_consumer(task: asyncio.Task) -> None:
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


async def _consumer_loop(app) -> None:
    consumer = AIOKafkaConsumer(
        *settings.kafka_topics,
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id=settings.kafka_consumer_group_id,
        auto_offset_reset="earliest",
        enable_auto_commit=False,   # PHẢI False — manual commit
    )
    await consumer.start()
    logger.info("kafka_consumer_started", topics=settings.kafka_topics,
                service=settings.service_name)

    try:
        async for msg in consumer:
            event_id = msg.key.decode() if msg.key else None
            topic = msg.topic

            # 1. Idempotency check TRƯỚC khi xử lý
            if event_id:
                is_new = await app.state.redis.set(
                    f"rec:idempotency:{event_id}", "1",
                    ex=86400, nx=True
                )
                if not is_new:
                    logger.warning("duplicate_event_skipped", event_id=event_id, topic=topic,
                                   service=settings.service_name)
                    await consumer.commit()
                    continue

            # 2. Process với retry + exponential backoff
            payload = json.loads(msg.value.decode())
            handler = HANDLERS.get(topic)
            if handler:
                await _process_with_retry(handler, payload, app.state.redis, event_id, topic)

            # 3. Commit offset CHỈ sau khi xử lý thành công
            await consumer.commit()

    finally:
        await consumer.stop()


async def _process_with_retry(handler, payload: dict, redis, event_id: str | None, topic: str) -> None:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            await handler(payload, redis)
            return
        except Exception as exc:
            if attempt == MAX_RETRIES:
                logger.error("event_processing_failed_dlq", topic=topic, event_id=event_id,
                             error=str(exc), attempt=attempt, service=settings.service_name)
                await _send_to_dlq(topic, payload)
                return
            delay = 2 ** (attempt - 1)   # 1s → 2s → 4s
            logger.warning("event_processing_retry", topic=topic, attempt=attempt,
                           delay_s=delay, service=settings.service_name)
            await asyncio.sleep(delay)


async def _send_to_dlq(original_topic: str, payload: dict) -> None:
    # Publish to {topic}.DLQ via aiokafka producer
    # TODO: inject producer và gọi send_and_wait(f"{original_topic}.DLQ", ...)
    pass
```

### Event Handlers

```python
# kafka/handlers.py
import redis.asyncio as aioredis
import structlog

logger = structlog.get_logger()

WEIGHTS_TTL = 7 * 24 * 3600   # 7 ngày


async def handle_song_played(payload: dict, redis: aioredis.Redis) -> None:
    """Song_Played: tăng weight nếu duration_percent >= 80."""
    user_id  = payload["user_id"]
    genre_id = payload["genre_id"]
    duration_percent = float(payload["duration_percent"])

    if duration_percent >= 80:
        weights_key = f"rec:weights:{user_id}"
        await redis.hincrbyfloat(weights_key, genre_id, 0.3)
        await redis.expire(weights_key, WEIGHTS_TTL)
        # Invalidate cache
        async for key in redis.scan_iter(f"rec:cache:{user_id}:*"):
            await redis.delete(key)
        logger.info("weight_increased", user_id=user_id, genre_id=genre_id,
                    duration_percent=duration_percent, service="recommendation-service")


async def handle_song_skipped(payload: dict, redis: aioredis.Redis) -> None:
    """Song_Skipped: giảm weight nếu duration_percent < 30."""
    user_id  = payload["user_id"]
    genre_id = payload["genre_id"]
    duration_percent = float(payload["duration_percent"])

    if duration_percent < 30:
        weights_key = f"rec:weights:{user_id}"
        await redis.hincrbyfloat(weights_key, genre_id, -0.2)
        await redis.expire(weights_key, WEIGHTS_TTL)
        async for key in redis.scan_iter(f"rec:cache:{user_id}:*"):
            await redis.delete(key)
        logger.info("weight_decreased", user_id=user_id, genre_id=genre_id,
                    duration_percent=duration_percent, service="recommendation-service")


async def handle_preferences_updated(payload: dict, redis: aioredis.Redis) -> None:
    """User_Preferences_Updated: seed onboarding weights."""
    user_id = payload["user_id"]
    genres  = payload.get("genres", [])
    import json
    onboarding_key = f"rec:onboarding:{user_id}"
    await redis.set(onboarding_key, json.dumps({"genres": genres}), ex=7 * 24 * 3600)
    logger.info("onboarding_weights_seeded", user_id=user_id, genres=genres,
                service="recommendation-service")
```

**Rules:**
- `enable_auto_commit=False` — luôn luôn
- Idempotency check (`SET NX`) TRƯỚC khi gọi handler
- Commit CHỈ sau khi handler thành công
- DLQ topic = `{original_topic}.DLQ`
- Retry: 3 lần, Exponential Backoff 1s → 2s → 4s

---

## 8. Error Handling

### Custom Exceptions

```python
# exceptions/domain_exceptions.py
class DomainException(Exception):
    def __init__(self, error_code: str, message: str, http_status: int):
        self.error_code = error_code
        self.message = message
        self.http_status = http_status
        super().__init__(message)


class NotFoundException(DomainException):
    def __init__(self, resource: str):
        super().__init__(f"{resource.upper()}_NOT_FOUND", f"{resource} not found.", 404)


class ValidationException(DomainException):
    def __init__(self, message: str):
        super().__init__("VALIDATION_ERROR", message, 400)


class IdempotencyConflictException(DomainException):
    def __init__(self):
        super().__init__("IDEMPOTENCY_CONFLICT", "Duplicate request detected.", 409)


class UnauthorizedException(DomainException):
    def __init__(self):
        super().__init__("UNAUTHORIZED", "Unauthorized.", 401)


class ServiceUnavailableException(DomainException):
    def __init__(self, detail: str = "Service temporarily unavailable."):
        super().__init__("SERVICE_UNAVAILABLE", detail, 503)
```

### HTTP Status Map

| Exception | Status | Code |
|---|---|---|
| `NotFoundException` | 404 | `{RESOURCE}_NOT_FOUND` |
| `ValidationException` | 400 | `VALIDATION_ERROR` |
| `IdempotencyConflictException` | 409 | `IDEMPOTENCY_CONFLICT` |
| `UnauthorizedException` | 401 | `UNAUTHORIZED` |
| `ServiceUnavailableException` | 503 | `SERVICE_UNAVAILABLE` |
| Unhandled `Exception` | 500 | `INTERNAL_ERROR` |

**Rules:**
- Không expose stack trace hay internal message ra `error.message` trong production
- `INTERNAL_ERROR` message luôn là generic: `"An unexpected error occurred."`
- Không catch `Exception` bên trong route handlers — để `exception_handler` xử lý

---

## 9. Logging

### structlog Setup

```python
# core/config.py hoặc main.py (gọi trước create_app())
import structlog, logging

def configure_logging():
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
    )
```

### CorrelationId Middleware

```python
# middleware/correlation_id.py
import uuid
import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        correlation_id = request.headers.get("X-Correlation-Id") or str(uuid.uuid4())
        request.state.correlation_id = correlation_id

        # Bind vào structlog context cho toàn bộ request
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            correlation_id=correlation_id,
            service="recommendation-service",
        )

        response = await call_next(request)
        response.headers["X-Correlation-Id"] = correlation_id
        return response
```

### Usage

```python
logger = structlog.get_logger()

# ✅ Structured — named fields
logger.info("recommendations_returned", user_id=user_id, count=len(results), cache="HIT")
logger.warning("rule_engine_timeout", timeout_ms=300, user_id=user_id)
logger.error("kafka_handler_failed", error=str(exc), event_id=event_id)

# ❌ Không log PII
logger.info("user_login", email=user.email)      # ❌ email là PII
logger.debug("token_value", token=access_token)  # ❌ token là secret

# ❌ Không dùng f-string trong log
logger.info(f"User {user_id} requested recommendations")  # ❌ — mất structured fields
```

**Mandatory fields** (được inject tự động qua `contextvars`):

| Field | Source |
|---|---|
| `timestamp` | `TimeStamper` processor |
| `level` | `add_log_level` processor |
| `service` | `bind_contextvars` trong middleware |
| `correlation_id` | `bind_contextvars` trong middleware |
| `message` | first arg của `logger.info(...)` |

---

## 10. Test Structure

### conftest.py

```python
# tests/conftest.py
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport
from main import create_app


@pytest.fixture
def redis_mock():
    mock = AsyncMock()
    mock.get = AsyncMock(return_value=None)
    mock.set = AsyncMock(return_value=True)
    mock.hgetall = AsyncMock(return_value={})
    mock.hincrbyfloat = AsyncMock(return_value=0.3)
    mock.expire = AsyncMock(return_value=True)
    mock.zrevrange = AsyncMock(return_value=[])
    mock.scan_iter = MagicMock(return_value=aiter([]))  # async generator mock
    mock.ping = AsyncMock(return_value=True)
    return mock


@pytest_asyncio.fixture
async def app(redis_mock):
    application = create_app()
    application.state.redis = redis_mock
    return application


@pytest_asyncio.fixture
async def client(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
```

### Unit Test — Rule Engine (pure function, no I/O)

```python
# tests/unit/test_rule_engine.py
import pytest
from services.rule_engine import score_candidate, SongCandidate, CONTEXT_GENRE_MAP


def make_candidate(genre_name: str = "pop") -> SongCandidate:
    return SongCandidate(
        song_id="song-1", title="Test Song", artist="Artist",
        thumbnail="https://cdn/img.jpg", genre_id="genre-uuid-1",
        genre_name=genre_name, base_popularity=0.5,
    )


def test_context_bonus_applied_when_genre_matches():
    candidate = make_candidate(genre_name="pop")
    result = score_candidate(candidate, "morning", weights={}, onboarding_genres=[])
    assert result.score > 0.5
    assert result.reason_type == "CONTEXT"
    assert "buổi sáng" in result.reason_text


def test_no_bonus_when_genre_mismatch():
    candidate = make_candidate(genre_name="metal")
    result = score_candidate(candidate, "morning", weights={}, onboarding_genres=[])
    assert result.score == pytest.approx(0.5, abs=0.01)
    assert result.reason_type == "TRENDING"


def test_skip_penalty_reduces_score():
    weights = {"genre-uuid-1": -0.4}   # negative weight từ nhiều skip
    candidate = make_candidate(genre_name="metal")
    result = score_candidate(candidate, "morning", weights=weights, onboarding_genres=[])
    assert result.score < 0.5


def test_onboarding_bonus_applied():
    candidate = make_candidate(genre_name="jazz")
    result = score_candidate(candidate, "morning", weights={}, onboarding_genres=["Jazz"])
    assert result.score > 0.5
    assert result.reason_type in ("CONTEXT", "PREFERENCE")
```

### Unit Test — Fallback Chain

```python
# tests/unit/test_recommendation_service.py
import pytest
from unittest.mock import AsyncMock
import asyncio
from services.recommendation_service import RecommendationService


@pytest.mark.asyncio
async def test_fallback_triggered_on_timeout():
    repo = AsyncMock()
    repo.get_cached_recommendations.return_value = None
    repo.get_weights.side_effect = asyncio.sleep(1)   # simulate slow
    repo.get_trending.return_value = ["song-1", "song-2"]

    service = RecommendationService(repo)
    # timeout_ms = 50ms để trigger timeout cepat
    import core.config as cfg
    cfg.settings.recommendation_timeout_ms = 50

    items, cache = await service.get_recommendations("user-1", "morning", 10, "corr-1")

    assert cache == "MISS"
    repo.get_trending.assert_called_once()


@pytest.mark.asyncio
async def test_cache_hit_skips_rule_engine():
    repo = AsyncMock()
    repo.get_cached_recommendations.return_value = [
        {"song_id": "s1", "title": "T", "artist": "A", "thumbnail": "", "reason": {"type": "TRENDING", "text": "x"}}
    ]

    service = RecommendationService(repo)
    items, cache = await service.get_recommendations("user-1", "morning", 10, "corr-1")

    assert cache == "HIT"
    repo.get_weights.assert_not_called()
```

### Integration Test

```python
# tests/integration/test_recommendations_api.py
import pytest


@pytest.mark.asyncio
async def test_get_recommendations_returns_200(client, redis_mock):
    redis_mock.get.return_value = None
    redis_mock.hgetall.return_value = {}
    redis_mock.zrevrange.return_value = ["song-1", "song-2"]

    response = await client.get(
        "/api/v1/recommendations?context=morning&limit=5",
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert "data" in body
    assert body["meta"]["apiVersion"] == "v1"


@pytest.mark.asyncio
async def test_health_returns_healthy(client, redis_mock):
    redis_mock.ping.return_value = True
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
```

### pytest.ini / pyproject.toml

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

---

## ✅ Pre-output Checklist

Trước khi output code, Claude tự kiểm tra:

**Structure**
- [ ] `main.py` dùng `lifespan` context manager (không dùng `@app.on_event` deprecated)?
- [ ] Route handlers trong `routers/` — không có business logic?
- [ ] Business logic trong `services/` — không có Redis/Kafka I/O trực tiếp?
- [ ] Tất cả Redis I/O tập trung trong `repositories/redis_repository.py`?

**Async**
- [ ] Tất cả route handlers và service methods dùng `async def`?
- [ ] Dùng `redis.asyncio` (aioredis), không dùng sync `redis.Redis`?
- [ ] Không có `time.sleep`, `requests.get`, hoặc blocking calls trong async context?
- [ ] Không gọi `asyncio.run()` bên trong async function?

**Redis**
- [ ] Key naming đúng pattern `rec:{entity}:{identifier}` từ `REDIS_KEY_DESIGN.md`?
- [ ] Mọi key có TTL tường minh khi set?
- [ ] Không dùng `KEYS *` — chỉ `scan_iter`?
- [ ] `rec:trending:global` chỉ đọc, không ghi?
- [ ] Idempotency dùng `SET key 1 EX 86400 NX` (nx=True trong aioredis)?

**Rule Engine**
- [ ] Không có ML/AI/Vector DB — Rule Engine + Redis weights only?
- [ ] Fallback chain đúng: Cache HIT → Rule Engine (300ms timeout) → Trending fallback?
- [ ] `asyncio.wait_for` dùng `settings.recommendation_timeout_ms / 1000`?
- [ ] `score_candidate` là pure function (không có I/O, có thể unit test độc lập)?

**Kafka Consumer**
- [ ] `enable_auto_commit=False`?
- [ ] Idempotency check (`SET NX`) TRƯỚC khi gọi handler?
- [ ] Commit CHỈ sau khi handler thành công?
- [ ] `Song_Played` tăng weight chỉ khi `duration_percent >= 80`?
- [ ] `Song_Skipped` giảm weight chỉ khi `duration_percent < 30`?
- [ ] DLQ sau 3 retries, Exponential Backoff 1s → 2s → 4s?

**Error Handling**
- [ ] `INTERNAL_ERROR` message không expose stack trace hay internal details?
- [ ] Route handlers không catch `Exception` — để global handler xử lý?

**Logging**
- [ ] Không log PII (email, token, password, tên)?
- [ ] Dùng named fields trong structlog, không dùng f-string?
- [ ] `correlation_id` được bind vào contextvars từ middleware?

**Tests**
- [ ] Rule Engine tests là pure function (không mock Redis)?
- [ ] Integration tests override `app.state.redis` với mock?
- [ ] `pytest.ini` có `asyncio_mode = "auto"`?
