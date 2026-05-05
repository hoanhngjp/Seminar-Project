import redis.asyncio as aioredis
from fastapi import Request

from recommendation_service.repositories.redis_repository import RedisRepository
from recommendation_service.services.recommendation_service import RecommendationService


def get_redis(request: Request) -> aioredis.Redis:
    return request.app.state.redis


def get_redis_repo(request: Request) -> RedisRepository:
    return RedisRepository(request.app.state.redis)


def get_recommendation_service(request: Request) -> RecommendationService:
    return RecommendationService(RedisRepository(request.app.state.redis))
