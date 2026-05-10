import datetime
import logging
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

from recommendation_service.api.routes import health, recommendations
from recommendation_service.core.config import settings
from recommendation_service.exceptions.domain_exceptions import DomainException
from recommendation_service.kafka.consumer import start_consumer, stop_consumer
from recommendation_service.middleware.correlation_id import CorrelationIdMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — Redis
    redis_client = aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
    )
    app.state.redis = redis_client
    try:
        await redis_client.ping()
        logger.info("redis_connected service=%s", settings.service_name)
    except Exception as exc:
        logger.warning("redis_not_available error=%s", str(exc))

    # Startup — Kafka consumer (background task)
    consumer_task = await start_consumer(app)
    logger.info("kafka_consumer_started service=%s", settings.service_name)

    yield

    # Shutdown
    await stop_consumer(consumer_task)
    await redis_client.aclose()
    logger.info("shutdown_complete service=%s", settings.service_name)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Recommendation Service",
        version=settings.service_version,
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else "/docs",  # always expose for dev
    )

    app.add_middleware(CorrelationIdMiddleware)

    app.include_router(health.router)
    app.include_router(recommendations.router)

    Instrumentator().instrument(app).expose(app, endpoint="/metrics")

    @app.exception_handler(DomainException)
    async def domain_exception_handler(request: Request, exc: DomainException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.http_status,
            content=_error_body(request, exc.error_code, exc.message),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error("unhandled_exception error=%s", str(exc))
        return JSONResponse(
            status_code=500,
            content=_error_body(request, "INTERNAL_ERROR", "An unexpected error occurred."),
        )

    return app


def _error_body(request: Request, code: str, message: str) -> dict:
    return {
        "success": False,
        "data": None,
        "meta": {
            "apiVersion": "v1",
            "requestId": getattr(request.state, "correlation_id", ""),
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        },
        "error": {"code": code, "message": message},
    }


app = create_app()
