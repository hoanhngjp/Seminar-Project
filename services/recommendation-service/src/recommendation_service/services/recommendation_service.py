"""
Orchestrates the recommendation flow:
  Cache HIT → return cached
  Cache MISS → Rule Engine (300ms timeout) → cache result
  Timeout → fallback to Trending list
"""
import asyncio
import logging

from recommendation_service.core.config import settings
from recommendation_service.infrastructure.music_service_client import MusicServiceClient
from recommendation_service.repositories.redis_repository import RedisRepository
from recommendation_service.schemas.response import ReasonItem, SongItem
from recommendation_service.services.rule_engine import (
    SongCandidate,
    get_current_context,
    score_candidate,
)

logger = logging.getLogger(__name__)


class RecommendationService:
    def __init__(self, repo: RedisRepository, music_client: MusicServiceClient | None = None):
        self._repo = repo
        self._music_client = music_client

    async def get_recommendations(
        self,
        user_id: str,
        context: str | None,
        limit: int,
        correlation_id: str,
    ) -> tuple[list[SongItem], str]:
        normalized = None if (context is None or context == "none") else context
        resolved_context = normalized or get_current_context()

        # 1. Cache hit
        cached = await self._repo.get_cached_recommendations(user_id, resolved_context)
        if cached:
            logger.info(
                "recommendations_cache_hit user_id=%s context=%s correlation_id=%s",
                user_id, resolved_context, correlation_id,
            )
            items = [SongItem(**item) for item in cached]
            return items[:limit], "HIT"

        # 2. Rule Engine with 300ms timeout
        try:
            items = await asyncio.wait_for(
                self._run_rule_engine(user_id, resolved_context, limit),
                timeout=settings.recommendation_timeout_ms / 1000,
            )
            serialized = [item.model_dump() for item in items]
            await self._repo.set_cached_recommendations(user_id, resolved_context, serialized)
            return items, "MISS"

        except asyncio.TimeoutError:
            logger.warning(
                "rule_engine_timeout user_id=%s timeout_ms=%d correlation_id=%s",
                user_id, settings.recommendation_timeout_ms, correlation_id,
            )
            trending = await self._fallback_trending(limit)
            return trending, "MISS"

    async def apply_feedback(
        self,
        user_id: str,
        genre_id: str,
        action: str,
        duration_percent: float,
    ) -> None:
        """Update Redis weights based on play/skip feedback. Fire-and-forget from router."""
        if action == "PLAY" and duration_percent >= 80:
            await self._repo.increment_weight(user_id, genre_id, 0.3)
            await self._repo.invalidate_user_cache(user_id)
            logger.info("weight_increased user_id=%s genre_id=%s", user_id, genre_id)
        elif action == "SKIP" and duration_percent < 30:
            await self._repo.increment_weight(user_id, genre_id, -0.2)
            await self._repo.invalidate_user_cache(user_id)
            logger.info("weight_decreased user_id=%s genre_id=%s", user_id, genre_id)

    async def _run_rule_engine(
        self,
        user_id: str,
        context: str,
        limit: int,
    ) -> list[SongItem]:
        weights = await self._repo.get_weights(user_id)
        onboarding_genres = await self._repo.get_onboarding_genres(user_id)

        # Over-fetch trending IDs for scoring diversity
        trending_ids = await self._repo.get_trending(min(limit * 5, 100))

        # Enrich with Music Service metadata (200ms timeout, failure → graceful degradation)
        candidates = await self._build_candidates(trending_ids)

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

    async def _build_candidates(self, song_ids: list[str]) -> list[SongCandidate]:
        """
        Enrich trending song IDs with metadata from Music Service.
        Falls back to bare-ID candidates if Music Service is unavailable,
        so Rule Engine can still score by genre weight when metadata is missing.
        """
        meta_map: dict[str, object] = {}
        if self._music_client and song_ids:
            songs = await self._music_client.get_songs_batch(song_ids)
            meta_map = {s.id: s for s in songs}

        candidates = []
        for sid in song_ids:
            meta = meta_map.get(sid)
            if meta:
                candidates.append(SongCandidate(
                    song_id=sid,
                    title=meta.title,
                    artist=meta.artist_name,
                    thumbnail="",           # batch endpoint does not return coverUrl
                    genre_id=meta.genre_id or sid,
                    genre_name="",
                    mood_tags=meta.mood_tags,
                    base_popularity=0.5,
                ))
            else:
                # Music Service unavailable or song not found — use ID as genre proxy
                candidates.append(SongCandidate(
                    song_id=sid,
                    title="",
                    artist="",
                    thumbnail="",
                    genre_id=sid,
                    genre_name="",
                    mood_tags=[],
                    base_popularity=0.5,
                ))
        return candidates

    async def _fallback_trending(self, limit: int) -> list[SongItem]:
        song_ids = await self._repo.get_trending(limit)
        return [
            SongItem(
                song_id=sid,
                title="",
                artist="",
                thumbnail="",
                reason=ReasonItem(type="TRENDING", text="Đang thịnh hành"),
            )
            for sid in song_ids
        ]
