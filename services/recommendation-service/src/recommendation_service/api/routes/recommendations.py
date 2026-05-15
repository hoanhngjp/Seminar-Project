"""
Routes — thin handlers only. Business logic lives in RecommendationService.

GET  /api/v1/recommendations       — AC2.1.x (Rule Engine + fallback)
POST /api/v1/recommendations/feedback — AC2.2.x (async weight update)
"""
import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from recommendation_service.core.dependencies import get_recommendation_service
from recommendation_service.exceptions.domain_exceptions import UnauthorizedException
from recommendation_service.schemas.request import FeedbackRequest, RecommendationQueryParams
from recommendation_service.schemas.response import ApiResponse, RecommendationData
from recommendation_service.services.recommendation_service import RecommendationService

router = APIRouter(prefix="/api/v1/recommendations", tags=["recommendations"])
logger = logging.getLogger(__name__)


def _get_user_id(request: Request) -> str:
    """Extract user identity from gateway-injected header."""
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        raise UnauthorizedException()
    return user_id


# ----------------------------------------------------------------
# Contract-First Checklist — GET /api/v1/recommendations
# [1] GET /api/v1/recommendations
# [2] Query: context (optional), limit (1-50, default 20)
#     Headers: X-User-Id (required), X-User-Role
# [3] 200: { success, data: { items: [...] }, meta: { cache: HIT|MISS } }
# [4] 400 VALIDATION_ERROR, 401 UNAUTHORIZED
# [5] GatewayAuth (X-User-Id header)
# [6] 300ms (asyncio.wait_for inside service)
# [7] YES
# [8] Rule Engine: base + context_bonus + preference_bonus - skip_penalty
#     Fallback: cache → Rule Engine (300ms) → Trending list
# ----------------------------------------------------------------

@router.get("")
async def get_recommendations(
    request: Request,
    context: Annotated[str | None, Query(pattern="^(morning|afternoon|evening|night|none)$")] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    service: RecommendationService = Depends(get_recommendation_service),
) -> JSONResponse:
    user_id = _get_user_id(request)
    correlation_id = getattr(request.state, "correlation_id", "")

    items, cache_status = await service.get_recommendations(
        user_id=user_id,
        context=context,
        limit=limit,
        correlation_id=correlation_id,
    )

    data = RecommendationData(items=items)
    response = ApiResponse.ok(data.model_dump(by_alias=True), correlation_id, cache=cache_status)
    return JSONResponse(content=response.model_dump(), status_code=200)


# ----------------------------------------------------------------
# Contract-First Checklist — POST /api/v1/recommendations/feedback
# [1] POST /api/v1/recommendations/feedback
# [2] Body: { songId, action: PLAY|SKIP, durationPercent }
#     Headers: X-User-Id (required)
# [3] 202: { success, data: { received: true }, meta }
# [4] 400 VALIDATION_ERROR, 401 UNAUTHORIZED
# [5] GatewayAuth (X-User-Id header)
# [6] 100ms (async 202 — return immediately, process in background)
# [7] YES
# [8] Async weight update; does not block on Redis write
# ----------------------------------------------------------------

@router.post("/feedback", status_code=202)
async def post_feedback(
    request: Request,
    body: FeedbackRequest,
    service: RecommendationService = Depends(get_recommendation_service),
) -> JSONResponse:
    user_id = _get_user_id(request)
    correlation_id = getattr(request.state, "correlation_id", "")

    # Fire-and-forget weight update — 202 returned immediately (AC latency 100ms)
    asyncio.create_task(
        service.apply_feedback(
            user_id=user_id,
            genre_id=str(body.song_id),  # use song_id as genre proxy until Music Service enrichment
            action=body.action,
            duration_percent=body.duration_percent,
        )
    )

    response = ApiResponse.ok({"received": True}, correlation_id)
    return JSONResponse(content=response.model_dump(), status_code=202)
