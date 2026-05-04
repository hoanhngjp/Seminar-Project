#!/bin/bash
# Seed Redis với 50 trending songs cho Recommendation Service
# Dùng redis-cli qua docker exec
#
# Usage (từ repo root):
#   bash infra/seed/redis_seed.sh
#
# Prerequisites:
#   docker compose -f infra/docker-compose.yml up redis -d

set -e

REDIS_PASSWORD=${REDIS_PASSWORD:-changeme_local}
CONTAINER=${REDIS_CONTAINER:-smartmusic-redis}

echo "=== Redis Seed Script (via docker exec redis-cli) ==="
echo "Container: $CONTAINER"
echo ""

redis_cmd() {
  docker exec "$CONTAINER" redis-cli -a "$REDIS_PASSWORD" --no-auth-warning "$@"
}

# Populate trending sorted set (score = play count proxy)
echo "Seeding rec:trending:global with 50 songs..."

redis_cmd ZADD rec:trending:global \
  9500 "song-001" 8200 "song-002" 7100 "song-003" \
  6800 "song-004" 6500 "song-005" 6200 "song-006" \
  5900 "song-007" 4500 "song-008" 4200 "song-009" \
  3800 "song-010" 3600 "song-011" 3400 "song-012" \
  3200 "song-013" 3000 "song-014" 2800 "song-015" \
  2600 "song-016" 2400 "song-017" 2200 "song-018" \
  2000 "song-019" 1900 "song-020" 1800 "song-021" \
  1700 "song-022" 1600 "song-023" 1500 "song-024" \
  1400 "song-025" 1300 "song-026" 1200 "song-027" \
  1100 "song-028" 1000 "song-029" 950  "song-030" \
  900  "song-031" 850  "song-032" 800  "song-033" \
  750  "song-034" 700  "song-035" 650  "song-036" \
  600  "song-037" 550  "song-038" 500  "song-039" \
  480  "song-040" 460  "song-041" 440  "song-042" \
  420  "song-043" 400  "song-044" 380  "song-045" \
  360  "song-046" 340  "song-047" 320  "song-048" \
  300  "song-049" 280  "song-050" > /dev/null

# TTL: 1 hour
redis_cmd EXPIRE rec:trending:global 3600 > /dev/null

COUNT=$(redis_cmd ZCARD rec:trending:global)
echo "✅ rec:trending:global: $COUNT songs"

echo ""
echo "Top 5 trending:"
redis_cmd ZREVRANGE rec:trending:global 0 4 WITHSCORES

echo ""
echo "✅ Redis seed complete"
