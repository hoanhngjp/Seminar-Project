#!/usr/bin/env bash
# ============================================================
# Smart Music Platform — Seed Lyrics (LRC → music_db)
# ============================================================
# Chạy từ repo root:
#   bash infra/seed/seed_lyrics.sh
#
# Yêu cầu:
#   - PostgreSQL container đang up (port 5434 trên host)
#   - psql CLI có trên PATH
#   - Redis container đang up (smartmusic-redis)
#   - File LRC trong tests/lyrics/
# ============================================================

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LYRICS_DIR="$REPO_ROOT/tests/lyrics"

PG_USER="${POSTGRES_USER:-smartmusic}"
PG_PASS="${POSTGRES_PASSWORD:-changeme_local}"
PG_DB="music_db"
PG_CONTAINER="${POSTGRES_CONTAINER:-smartmusic-postgres}"

REDIS_PASSWORD=${REDIS_PASSWORD:-changeme_local}
REDIS_CONTAINER=${REDIS_CONTAINER:-smartmusic-redis}

redis_cli() {
  docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" --no-auth-warning "$@"
}

run_sql() {
  echo "$1" | docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -q
}

echo "=== Seed Lyrics ==="
echo "DB: $PG_CONTAINER/$PG_DB"
echo "Lyrics dir: $LYRICS_DIR"
echo ""

# ── Mapping: song_id → lrc filename ──────────────────────────────────────────
declare -A SONG_LRC
SONG_LRC["b0000001-0000-0000-0000-000000000001"]="(MV TEASER) BƯỚC QUA NHAU.lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000002"]="ANH NHỚ RA - Vũ. (Feat. Trang).lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000003"]="ANH NHỚ RA - Vũ. (Solo Version) Live Session.lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000006"]="BƯỚC QUA NHAU Vũ. (Official MV).lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000007"]="Chúng Ta Không Thuộc Về Nhau.lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000008"]="Chậm lại.lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000010"]="Ghé Qua - Dick x Tofu x PC [Official Audio] - TaynguyenSound Official.lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000012"]="Intro 2022.lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000013"]="Lạ lùng.lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000014"]="Ngọt - CHUYỂN KÊNH (sản phẩm này không phải là thuốc).lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000015"]="Ngọt - LẦN CUỐI (đi bên em xót xa người ơi).lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000016"]="Những lời hứa bỏ quên.lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000018"]="Nơi Này Có Anh.lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000019"]="Nếu Những Tiếc Nuối.lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000021"]="Stay with Me - Night Tempo Showa Groove Mix.lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000022"]="SƠN TÙNG M-TP _ SKY DECADE _ Cơn Mưa Xa Dần.lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000023"]="SƠN TÙNG M-TP _ SKY DECADE _ Nắng Ấm Ngang Qua.lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000024"]="Tùng TeA & PC - Mây Lang Thang ft. NewoulZ (Official MV) - TaynguyenSound Official.lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000028"]="[Live] Thôi Trễ Rồi, Chắc Anh Phải Về Đây - TaynguyenSound Live in Hà Nội - TaynguyenSound Official.lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000029"]="Âm Thầm Bên Em.lrc"
SONG_LRC["b0000001-0000-0000-0000-000000000030"]="「真夜中のドア〜stay with me」_ 松原みき Official Lyric Video.lrc"

# ── Step 1: UPDATE lyrics trong DB ───────────────────────────────────────────
echo "→ Updating lyrics in $PG_DB..."
COUNT=0
SKIPPED=0

for SONG_ID in "${!SONG_LRC[@]}"; do
  LRC_FILE="${LYRICS_DIR}/${SONG_LRC[$SONG_ID]}"

  if [[ ! -f "$LRC_FILE" ]]; then
    echo "  [SKIP] $SONG_ID — file not found: ${SONG_LRC[$SONG_ID]}"
    ((SKIPPED++)) || true
    continue
  fi

  # Read LRC content and escape single quotes for SQL
  LRC_CONTENT=$(cat "$LRC_FILE" | sed "s/'/''/g")

  run_sql "UPDATE songs SET \"Lyrics\" = '$LRC_CONTENT', \"UpdatedAt\" = NOW() WHERE \"Id\" = '$SONG_ID';"

  echo "  [OK]   $SONG_ID — ${SONG_LRC[$SONG_ID]}"
  ((COUNT++)) || true
done

echo ""
echo "  Updated: $COUNT songs | Skipped: $SKIPPED"

# ── Step 2: Flush Redis cache cho 22 bài có lyrics ───────────────────────────
echo ""
echo "→ Flushing Redis song:meta cache for seeded songs..."
FLUSHED=0

for SONG_ID in "${!SONG_LRC[@]}"; do
  RESULT=$(redis_cli DEL "song:meta:$SONG_ID" 2>/dev/null || true)
  if [[ "$RESULT" == "1" ]]; then
    echo "  [DEL]  song:meta:$SONG_ID"
    ((FLUSHED++)) || true
  else
    echo "  [MISS] song:meta:$SONG_ID (not cached)"
  fi
done

echo ""
echo "  Flushed: $FLUSHED Redis keys"
echo ""
echo "=== Done ==="
