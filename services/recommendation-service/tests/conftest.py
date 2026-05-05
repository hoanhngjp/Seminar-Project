import pytest
import pytest_asyncio
import fakeredis.aioredis
from httpx import AsyncClient, ASGITransport

from recommendation_service.main import create_app


@pytest_asyncio.fixture
async def fake_redis():
    server = fakeredis.aioredis.FakeRedis(decode_responses=True)
    yield server
    await server.aclose()


@pytest_asyncio.fixture
async def app(fake_redis):
    application = create_app()
    # Override lifespan: inject fake_redis and skip Kafka consumer startup
    application.state.redis = fake_redis
    return application


@pytest_asyncio.fixture
async def client(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# Fake gateway headers
FAKE_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
FAKE_ROLE = "Listener"
AUTH_HEADERS = {"X-User-Id": FAKE_USER_ID, "X-User-Role": FAKE_ROLE}
