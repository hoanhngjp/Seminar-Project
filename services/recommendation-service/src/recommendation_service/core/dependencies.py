import redis.asyncio as aioredis
from fastapi import Request

from recommendation_service.infrastructure.music_service_client import MusicServiceClient
from recommendation_service.repositories.redis_repository import RedisRepository
from recommendation_service.services.recommendation_service import RecommendationService


def get_redis(request: Request) -> aioredis.Redis:
    return request.app.state.redis


def get_redis_repo(request: Request) -> RedisRepository:
    return RedisRepository(request.app.state.redis)


def get_recommendation_service(request: Request) -> RecommendationService:
    music_client: MusicServiceClient | None = getattr(request.app.state, "music_client", None)
    return RecommendationService(RedisRepository(request.app.state.redis), music_client)
