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
echo "Seeding rec:trending:global with 30 real songs..."

redis_cmd ZADD rec:trending:global \
  85000000 "b0000001-0000-0000-0000-000000000030" \
  48000000 "b0000001-0000-0000-0000-000000000018" \
  32000000 "b0000001-0000-0000-0000-000000000007" \
  22000000 "b0000001-0000-0000-0000-000000000022" \
  19000000 "b0000001-0000-0000-0000-000000000023" \
  18000000 "b0000001-0000-0000-0000-000000000021" \
  16000000 "b0000001-0000-0000-0000-000000000029" \
  13000000 "b0000001-0000-0000-0000-000000000024" \
  12000000 "b0000001-0000-0000-0000-000000000027" \
  11000000 "b0000001-0000-0000-0000-000000000010" \
  9800000  "b0000001-0000-0000-0000-000000000026" \
  9200000  "b0000001-0000-0000-0000-000000000015" \
  8900000  "b0000001-0000-0000-0000-000000000006" \
  8400000  "b0000001-0000-0000-0000-000000000028" \
  7800000  "b0000001-0000-0000-0000-000000000014" \
  7200000  "b0000001-0000-0000-0000-000000000020" \
  6700000  "b0000001-0000-0000-0000-000000000013" \
  5500000  "b0000001-0000-0000-0000-000000000016" \
  5200000  "b0000001-0000-0000-0000-000000000008" \
  4500000  "b0000001-0000-0000-0000-000000000004" \
  4200000  "b0000001-0000-0000-0000-000000000012" \
  4100000  "b0000001-0000-0000-0000-000000000019" \
  3800000  "b0000001-0000-0000-0000-000000000002" \
  3100000  "b0000001-0000-0000-0000-000000000011" \
  2100000  "b0000001-0000-0000-0000-000000000003" \
  1900000  "b0000001-0000-0000-0000-000000000005" \
  1200000  "b0000001-0000-0000-0000-000000000001" \
  890000   "b0000001-0000-0000-0000-000000000025" \
  620000   "b0000001-0000-0000-0000-000000000017" \
  480000   "b0000001-0000-0000-0000-000000000009" > /dev/null

# No TTL — trending list is refreshed by Kafka Song_Played events at runtime.
# During local dev without live events, we keep it indefinitely.

COUNT=$(redis_cmd ZCARD rec:trending:global)
echo "✅ rec:trending:global: $COUNT songs"

echo ""
echo "Top 5 trending:"
redis_cmd ZREVRANGE rec:trending:global 0 4 WITHSCORES

echo ""
echo "✅ Redis seed complete"
