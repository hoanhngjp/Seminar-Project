#!/usr/bin/env bash
# seed_creator_demo.sh — Seed dữ liệu test cho creator@example.com
#
# Làm 3 việc:
#   1. INSERT 3 bài hát vào music_db cho Demo Artist (creator@example.com)
#   2. Seed InfluxDB với ~300 play events lịch sử (30 ngày) cho 3 bài hát đó
#   3. Flush Redis analytics cache để service fetch fresh data
#
# Yêu cầu:
#   - docker-compose up -d (postgres, influxdb, redis đang chạy)
#   - psql có trong PATH (Git Bash: chạy từ Git Bash hoặc install psql client)
#   - curl có trong PATH
#
# Usage:
#   bash infra/seed/seed_creator_demo.sh
#   bash infra/seed/seed_creator_demo.sh --host localhost --pg-port 5434
#
# Account: creator@example.com / Test1234!
# ArtistId: aa111111-bbbb-cccc-dddd-eeeeeeeeeeee
# UserId:   b2c3d4e5-f6a7-8901-bcde-f12345678901

set -uo pipefail

# ── Configurable defaults ────────────────────────────────────────
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5434}"
PG_USER="${PG_USER:-smartmusic}"
PG_PASS="${PG_PASS:-changeme_local}"
PG_CONTAINER="${PG_CONTAINER:-smartmusic-postgres}"
INFLUX_HOST="${INFLUX_HOST:-localhost}"
INFLUX_PORT="${INFLUX_PORT:-8086}"
INFLUX_TOKEN="${INFLUX_TOKEN:-my-super-secret-token-change-this-in-production}"
INFLUX_ORG="${INFLUX_ORG:-smartmusic}"
INFLUX_BUCKET="${INFLUX_BUCKET:-analytics}"
INFLUX_CONTAINER="${INFLUX_CONTAINER:-smartmusic-influxdb}"
REDIS_CONTAINER="${REDIS_CONTAINER:-smartmusic-redis}"
REDIS_PASS="${REDIS_PASS:-changeme_local}"

# ── Parse args ───────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --host)        PG_HOST="$2"; INFLUX_HOST="$2"; shift 2;;
    --pg-port)     PG_PORT="$2"; shift 2;;
    --influx-port) INFLUX_PORT="$2"; shift 2;;
    *) shift;;
  esac
done

GREEN="\033[0;32m"; RED="\033[0;31m"; YELLOW="\033[1;33m"; CYAN="\033[0;36m"; NC="\033[0m"
log()  { echo -e "${GREEN}[OK]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }
info() { echo -e "${CYAN}[INFO]${NC} $*"; }

echo ""
echo "================================================"
echo "  Smart Music — Creator Demo Data Seed"
echo "  Account: creator@example.com / Test1234!"
echo "================================================"
echo ""

# ── Fixed UUIDs ──────────────────────────────────────────────────
ARTIST_ID="aa111111-bbbb-cccc-dddd-eeeeeeeeeeee"
CREATOR_USER_ID="b2c3d4e5-f6a7-8901-bcde-f12345678901"

# 3 song UUIDs cho Demo Artist (prefix c1 để tránh conflict với b0000001-* hiện có)
SONG1_ID="c1000001-0000-0000-0000-000000000001"
SONG2_ID="c1000001-0000-0000-0000-000000000002"
SONG3_ID="c1000001-0000-0000-0000-000000000003"

# Genre IDs (từ SeedData.sql)
GENRE_POP="d4e5f6a7-b8c9-0123-defa-234567890123"
GENRE_INDIE="f2a3b4c5-d6e7-8901-fabc-234567890123"
GENRE_ACOUSTIC="e1f2a3b4-c5d6-7890-efab-123456789012"

# ── Step 1: PostgreSQL — INSERT songs ────────────────────────────
echo "Step 1/3 — Inserting 3 demo songs into music_db..."

# Pipe SQL to psql inside the postgres container via stdin (-i flag)
docker exec -i -e PGPASSWORD="$PG_PASS" "$PG_CONTAINER" \
  psql -U "$PG_USER" -d music_db -v ON_ERROR_STOP=1 \
  <<'SQL'

-- 3 bài hát cho Demo Artist (creator@example.com)
-- Reuse GCS audio keys từ các bài hát đã có trong bucket để khỏi upload lại
INSERT INTO songs (
  "Id", "ArtistId", "AlbumId", "Title", "DurationSec",
  "S3AudioKey", "CoverImageUrl", "Language", "Mood",
  "IsExplicit", "IsPublished", "PlayCount",
  "CreatedAt", "UpdatedAt"
) VALUES

  -- Demo Song 1: pop-indie
  -- S3AudioKey uses demo/ prefix so it's unique; streaming will 404 but analytics works
  ('c1000001-0000-0000-0000-000000000001',
   'aa111111-bbbb-cccc-dddd-eeeeeeeeeeee', NULL,
   'Chiều Tà (Demo)', 210,
   'songs/demo/chieu-ta-demo.mp3',
   'https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962339/smart-music/covers/buoc-qua-nhau.jpg',
   'vi', 'chill', false, true, 0,
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days'),

  -- Demo Song 2: acoustic
  ('c1000001-0000-0000-0000-000000000002',
   'aa111111-bbbb-cccc-dddd-eeeeeeeeeeee', NULL,
   'Mưa Về (Demo)', 195,
   'songs/demo/mua-ve-demo.mp3',
   'https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962336/smart-music/covers/anh-nho-ra.jpg',
   'vi', 'sad', false, true, 0,
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),

  -- Demo Song 3: indie
  ('c1000001-0000-0000-0000-000000000003',
   'aa111111-bbbb-cccc-dddd-eeeeeeeeeeee', NULL,
   'Nắng Sớm (Demo)', 240,
   'songs/demo/nang-som-demo.mp3',
   'https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962340/smart-music/covers/cham-lai.jpg',
   'vi', 'energetic', false, true, 0,
   NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days')

ON CONFLICT ("Id") DO NOTHING;

-- song_genres: Pop + Indie cho bài 1, Acoustic + Indie cho bài 2, Indie cho bài 3
-- Ghi chú: "CreatedAt" column không có trong song_genres schema → chỉ insert SongId + GenreId
INSERT INTO song_genres ("SongId", "GenreId", "CreatedAt") VALUES
  ('c1000001-0000-0000-0000-000000000001', 'd4e5f6a7-b8c9-0123-defa-234567890123', NOW()),  -- Pop
  ('c1000001-0000-0000-0000-000000000001', 'f2a3b4c5-d6e7-8901-fabc-234567890123', NOW()),  -- Indie
  ('c1000001-0000-0000-0000-000000000002', 'e1f2a3b4-c5d6-7890-efab-123456789012', NOW()),  -- Acoustic
  ('c1000001-0000-0000-0000-000000000002', 'f2a3b4c5-d6e7-8901-fabc-234567890123', NOW()),  -- Indie
  ('c1000001-0000-0000-0000-000000000003', 'f2a3b4c5-d6e7-8901-fabc-234567890123', NOW())   -- Indie
ON CONFLICT DO NOTHING;

SQL

log "Songs inserted into music_db"

# ── Step 2: InfluxDB — Seed historical play events ───────────────
echo ""
echo "Step 2/3 — Seeding InfluxDB with historical play events (30 days)..."

INFLUX_URL="http://${INFLUX_HOST}:${INFLUX_PORT}"

# Verify InfluxDB is reachable
status=$(curl -s -o /dev/null -w "%{http_code}" "$INFLUX_URL/health" 2>/dev/null || echo "000")
if [[ "$status" != "200" ]]; then
  fail "InfluxDB not reachable at $INFLUX_URL (HTTP $status). Is docker-compose up?"
fi

TMP_LP=$(mktemp /tmp/influx_lp_XXXXXX.txt)
trap 'rm -f "$TMP_LP"' EXIT

# Helper: write line protocol from a file (avoids "Argument list too long" on Windows)
influx_write() {
  local data="$1"
  echo "$data" > "$TMP_LP"
  curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${INFLUX_URL}/api/v2/write?org=${INFLUX_ORG}&bucket=${INFLUX_BUCKET}&precision=ms" \
    -H "Authorization: Token ${INFLUX_TOKEN}" \
    -H "Content-Type: text/plain; charset=utf-8" \
    --data-binary "@${TMP_LP}"
}

# Generate timestamps: now - N days in Unix milliseconds
# We use bash arithmetic: $(date +%s) * 1000
now_sec=$(date +%s)

# Build line protocol batch
# Format: song_played,song_id=<id>,user_id=<uid>,platform=web duration_sec=<d>,listened_sec=<ls>,duration_percent=<pct> <timestamp_ms>
# We simulate realistic data: ~10-20 plays/day over 30 days, varying listen percentages

build_play_events() {
  local song_id="$1"
  local duration="$2"     # seconds
  local base_plays="$3"   # avg plays per day

  # Fake listener UUIDs — 5 distinct listeners rotating
  local listeners=(
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    "d4e5f6a7-b8c9-0123-defa-234567890123"
    "e5f6a7b8-c9d0-1234-efab-567890123456"
    "f6a7b8c9-d0e1-2345-fabc-678901234567"
    "a7b8c9d0-e1f2-3456-abcd-789012345678"
  )

  local lines=""
  local day
  for day in $(seq 29 -1 0); do
    # Vary plays: weekends get 1.5x, weekdays base
    local day_plays=$base_plays
    if (( day % 7 == 0 || day % 7 == 6 )); then
      day_plays=$(( base_plays + base_plays / 2 ))
    fi

    local play_idx
    for play_idx in $(seq 1 $day_plays); do
      # Timestamp: day ago + random hour offset (0-23h * 3600s + random minutes)
      local hour=$(( (play_idx * 3 + day) % 24 ))
      local minute=$(( (play_idx * 7 + day * 3) % 60 ))
      local ts_ms=$(( (now_sec - day * 86400 + hour * 3600 + minute * 60) * 1000 ))

      # Listened percent: most finish 70-100%, some skip at 20-40%
      local pct_raw=$(( (play_idx * 13 + day * 7 + 65) % 100 ))
      local pct
      if (( pct_raw < 15 )); then
        pct=25  # early skip
      elif (( pct_raw < 30 )); then
        pct=55  # mid skip
      else
        pct=$(( 70 + (pct_raw % 30) ))  # 70-99% listened
      fi

      local listened=$(( duration * pct / 100 ))
      local user_idx=$(( (play_idx + day) % 5 ))
      local user_id="${listeners[$user_idx]}"

      if [[ -n "$lines" ]]; then
        lines="${lines}
"
      fi
      lines="${lines}song_played,song_id=${song_id},user_id=${user_id},platform=web duration_sec=${duration}i,listened_sec=${listened}i,duration_percent=${pct}.0 ${ts_ms}"
    done
  done

  echo "$lines"
}

info "Generating play events for Song 1 (Chiều Tà — 15 plays/day avg)..."
events1=$(build_play_events "$SONG1_ID" 210 15)
result=$(influx_write "$events1")
if [[ "$result" == "204" ]]; then
  log "Song 1 events written (HTTP 204)"
else
  warn "Song 1 InfluxDB write returned HTTP $result (non-204 may still succeed)"
fi

info "Generating play events for Song 2 (Mưa Về — 8 plays/day avg)..."
events2=$(build_play_events "$SONG2_ID" 195 8)
result=$(influx_write "$events2")
if [[ "$result" == "204" ]]; then
  log "Song 2 events written (HTTP 204)"
else
  warn "Song 2 InfluxDB write returned HTTP $result"
fi

info "Generating play events for Song 3 (Nắng Sớm — 12 plays/day avg)..."
events3=$(build_play_events "$SONG3_ID" 240 12)
result=$(influx_write "$events3")
if [[ "$result" == "204" ]]; then
  log "Song 3 events written (HTTP 204)"
else
  warn "Song 3 InfluxDB write returned HTTP $result"
fi

# ── Step 3: Redis — Flush analytics cache ────────────────────────
echo ""
echo "Step 3/3 — Flushing Redis analytics cache for demo songs..."

redis_del() {
  local key="$1"
  docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASS" --no-auth-warning DEL "$key" 2>/dev/null || true
}

redis_del "heatmap:${SONG1_ID}:7d"
redis_del "heatmap:${SONG1_ID}:30d"
redis_del "stats:${SONG1_ID}"
redis_del "heatmap:${SONG2_ID}:7d"
redis_del "heatmap:${SONG2_ID}:30d"
redis_del "stats:${SONG2_ID}"
redis_del "heatmap:${SONG3_ID}:7d"
redis_del "heatmap:${SONG3_ID}:30d"
redis_del "stats:${SONG3_ID}"

# Also flush music service song cache for these songs
redis_del "music:song:${SONG1_ID}"
redis_del "music:song:${SONG2_ID}"
redis_del "music:song:${SONG3_ID}"

log "Redis cache flushed"

# ── Summary ───────────────────────────────────────────────────────
echo ""
echo "================================================"
echo "  Done! Creator demo data seeded."
echo ""
echo "  Login: creator@example.com / Test1234!"
echo ""
echo "  Songs available in Creator Dashboard:"
echo "    1. Chiều Tà (Demo)   — ${SONG1_ID}"
echo "    2. Mưa Về (Demo)     — ${SONG2_ID}"
echo "    3. Nắng Sớm (Demo)   — ${SONG3_ID}"
echo ""
echo "  Next steps:"
echo "    1. Rebuild music-service:  docker-compose up -d --build music-service"
echo "    2. Login as creator@example.com / Test1234!"
echo "    3. Go to Creator Dashboard → chọn bài → xem heatmap/stats"
echo "================================================"
echo ""
