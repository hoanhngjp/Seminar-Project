"""
Integration tests for recommendations API endpoints.
Uses fakeredis — no external infrastructure needed.
"""
import json

import pytest
import fakeredis.aioredis
from httpx import AsyncClient, ASGITransport

from recommendation_service.main import create_app

FAKE_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
AUTH_HEADERS = {"X-User-Id": FAKE_USER_ID, "X-User-Role": "Listener"}


@pytest.fixture
def fake_redis():
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


@pytest.fixture
def app_with_redis(fake_redis):
    application = create_app()
    application.state.redis = fake_redis
    return application


@pytest.fixture
async def client(app_with_redis):
    async with AsyncClient(
        transport=ASGITransport(app=app_with_redis), base_url="http://test"
    ) as c:
        yield c


# ----------------------------------------------------------------
# GET /api/v1/recommendations — happy path
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_recommendations_returns_200(client):
    response = await client.get(
        "/api/v1/recommendations?context=morning&limit=5",
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    assert "items" in body["data"]
    assert body["meta"]["apiVersion"] == "v1"
    assert body["meta"]["requestId"] != ""


@pytest.mark.asyncio
async def test_get_recommendations_without_auth_returns_401(client):
    response = await client.get("/api/v1/recommendations?context=morning")
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_get_recommendations_cache_hit(client, fake_redis):
    cached = [
        {
            "song_id": "cached-song-1",
            "title": "Cached Song",
            "artist": "Artist",
            "thumbnail": "",
            "reason": {"type": "TRENDING", "text": "Đang thịnh hành"},
        }
    ]
    await fake_redis.set(
        f"rec:cache:{FAKE_USER_ID}:morning", json.dumps(cached)
    )

    response = await client.get(
        "/api/v1/recommendations?context=morning&limit=5",
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["cache"] == "HIT"
    assert body["data"]["items"][0]["songId"] == "cached-song-1"


@pytest.mark.asyncio
async def test_get_recommendations_returns_trending_fallback(client, fake_redis):
    # Seed trending data; no user cache → Rule Engine runs → returns trending
    await fake_redis.zadd(
        "rec:trending:global",
        {"song-trending-001": 9500, "song-trending-002": 8200},
    )

    response = await client.get(
        "/api/v1/recommendations?context=morning&limit=2",
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["meta"]["cache"] == "MISS"


@pytest.mark.asyncio
async def test_get_recommendations_invalid_context_returns_422(client):
    response = await client.get(
        "/api/v1/recommendations?context=invalid",
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_recommendations_limit_capped_at_50(client):
    response = await client.get(
        "/api/v1/recommendations?limit=100",
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 422


# ----------------------------------------------------------------
# POST /api/v1/recommendations/feedback — happy path
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_post_feedback_returns_202(client):
    body = {
        "song_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "action": "PLAY",
        "duration_percent": 95.0,
    }
    response = await client.post(
        "/api/v1/recommendations/feedback",
        json=body,
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 202
    data = response.json()
    assert data["success"] is True
    assert data["data"]["received"] is True
    assert data["error"] is None


@pytest.mark.asyncio
async def test_post_feedback_without_auth_returns_401(client):
    body = {
        "song_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "action": "SKIP",
        "duration_percent": 10.0,
    }
    response = await client.post("/api/v1/recommendations/feedback", json=body)

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_post_feedback_invalid_action_returns_422(client):
    body = {
        "song_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "action": "REWIND",  # invalid
        "duration_percent": 50.0,
    }
    response = await client.post(
        "/api/v1/recommendations/feedback",
        json=body,
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_post_feedback_duration_out_of_range_returns_422(client):
    body = {
        "song_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "action": "PLAY",
        "duration_percent": 150.0,  # > 100
    }
    response = await client.post(
        "/api/v1/recommendations/feedback",
        json=body,
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 422


# ----------------------------------------------------------------
# Health check
# ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_health_returns_healthy(client, fake_redis):
    response = await client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
