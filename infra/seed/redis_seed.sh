#!/bin/bash
# Seed Redis với trending songs cho Recommendation Service
# Dùng redis-cli qua docker exec
#
# Usage (từ repo root):
#   bash infra/seed/redis_seed.sh
#
# Prerequisites:
#   docker compose -f infra/docker-compose.yml up redis -d
#
# Song UUIDs phải khớp với SeedData.sql (music_db.songs).
# Score = play_count từ SeedData.sql để Rule Engine scoring có ý nghĩa.

set -e

REDIS_PASSWORD=${REDIS_PASSWORD:-changeme_local}
CONTAINER=${REDIS_CONTAINER:-smartmusic-redis}

echo "=== Redis Seed Script (via docker exec redis-cli) ==="
echo "Container: $CONTAINER"
echo ""

redis_cmd() {
  docker exec "$CONTAINER" redis-cli -a "$REDIS_PASSWORD" --no-auth-warning "$@"
}

# Populate trending sorted set (score = play_count từ SeedData.sql)
# UUIDs khớp chính xác với SeedData.sql INSERT INTO songs
echo "Seeding rec:trending:global with 8 seeded songs..."

redis_cmd ZADD rec:trending:global \
  12000000 "11111111-0000-0000-0000-000000000002" \
  8500000  "11111111-0000-0000-0000-000000000001" \
  3500000  "11111111-0000-0000-0000-000000000008" \
  3200000  "11111111-0000-0000-0000-000000000003" \
  2700000  "11111111-0000-0000-0000-000000000007" \
  2100000  "11111111-0000-0000-0000-000000000005" \
  1800000  "11111111-0000-0000-0000-000000000004" \
  980000   "11111111-0000-0000-0000-000000000006" > /dev/null

# No TTL — trending list is refreshed by Kafka Song_Played events at runtime.
# During local dev without live events, we keep it indefinitely.

COUNT=$(redis_cmd ZCARD rec:trending:global)
echo "✅ rec:trending:global: $COUNT songs"

echo ""
echo "Top 5 trending:"
redis_cmd ZREVRANGE rec:trending:global 0 4 WITHSCORES

echo ""
echo "✅ Redis seed complete"
