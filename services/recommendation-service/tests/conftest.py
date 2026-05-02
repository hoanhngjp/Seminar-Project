import pytest
import fakeredis.aioredis


@pytest.fixture
async def fake_redis():
    server = fakeredis.aioredis.FakeRedis()
    yield server
    await server.aclose()
