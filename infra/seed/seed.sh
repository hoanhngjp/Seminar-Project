#!/usr/bin/env bash
# ============================================================
# Smart Music Platform — Master Seed Script (Phase 1)
# ============================================================
# Chạy từ repo root:
#   bash infra/seed/seed.sh
#
# Yêu cầu:
#   - Docker Compose đang up (infra containers healthy)
#   - dotnet CLI có trên PATH (để chạy EF migrations)
#   - psql CLI có trên PATH hoặc chạy qua docker exec
#
# Thứ tự:
#   1. Wait for PostgreSQL healthy
#   2. Run EF migrations (auth, user, music, streaming,
#      listening-party, notification services)
#   3. Seed music_db + user_db data (SeedData.sql)
#   4. Seed Elasticsearch index + documents
#   5. Seed Redis trending data
# ============================================================

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INFRA_DIR="$REPO_ROOT/infra"
SEED_DIR="$INFRA_DIR/seed"

# Read .env (docker-compose style)
if [[ -f "$INFRA_DIR/.env" ]]; then
  set -a
  source "$INFRA_DIR/.env"
  set +a
fi

PG_HOST="${POSTGRES_HOST:-localhost}"
PG_PORT="${POSTGRES_PORT:-5432}"
PG_USER="${POSTGRES_USER:-smartmusic}"
PG_PASS="${POSTGRES_PASSWORD:-changeme_local}"

echo "============================================"
echo " Smart Music — Master Seed Script"
echo "============================================"

# ---- 1. Wait for PostgreSQL ----
echo ""
echo "[1/5] Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  if PGPASSWORD="$PG_PASS" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d postgres -c "SELECT 1" > /dev/null 2>&1; then
    echo "  PostgreSQL ready."
    break
  fi
  echo "  Attempt $i/30 — waiting 3s..."
  sleep 3
done

# ---- 2. EF Core Migrations ----
echo ""
echo "[2/5] Running EF Core migrations..."

run_migration() {
  local svc_name="$1"
  local project_path="$2"
  local startup_path="$3"

  echo "  → $svc_name..."
  dotnet ef database update \
    --project "$REPO_ROOT/$project_path" \
    --startup-project "$REPO_ROOT/$startup_path" \
    --no-build 2>&1 | tail -3
}

# Auth Service — auth_db
run_migration "auth-service" \
  "services/auth-service/src/AuthService.Infrastructure" \
  "services/auth-service/src/AuthService.Api"

# User Service — user_db (auto-migrates at startup too via DbInitializer,
# but we run here to ensure tables exist before seeding)
run_migration "user-service" \
  "services/user-service/src/UserService.Infrastructure" \
  "services/user-service/src/UserService.Api"

# Music Service — music_db
run_migration "music-service" \
  "services/music-service/src/MusicService.Infrastructure" \
  "services/music-service/src/MusicService.Api"

# Notification Service (MongoDB — no EF migration; skip)
echo "  → notification-service: MongoDB (no EF migration)"

# Listening Party Service — no DB migration needed (uses Redis)
echo "  → listening-party-service: Redis (no EF migration)"

# Analytics Service — InfluxDB (no EF migration)
echo "  → analytics-service: InfluxDB (no EF migration)"

# Search Service — Elasticsearch (no EF migration)
echo "  → search-service: Elasticsearch (no EF migration)"

echo "  Migrations done."

# ---- 3. Seed PostgreSQL data ----
echo ""
echo "[3/5] Seeding PostgreSQL data (genres, artist, songs, preferences)..."

PGPASSWORD="$PG_PASS" psql \
  -h "$PG_HOST" -p "$PG_PORT" \
  -U "$PG_USER" \
  -d postgres \
  -f "$SEED_DIR/SeedData.sql" \
  -v ON_ERROR_STOP=0 2>&1 | grep -E "(ERROR|INSERT|DO|WARNING)" || true

echo "  PostgreSQL seed done."

# ---- 4. Seed Elasticsearch ----
echo ""
echo "[4/5] Seeding Elasticsearch..."
bash "$SEED_DIR/elasticsearch_seed.sh"

# ---- 5. Seed Redis trending ----
echo ""
echo "[5/5] Seeding Redis trending data..."
bash "$SEED_DIR/redis_seed.sh"

echo ""
echo "============================================"
echo " Seed complete!"
echo ""
echo " Test accounts:"
echo "   listener@example.com / Test1234!"
echo "   creator@example.com  / Test1234!"
echo "   admin@example.com    / Test1234!"
echo ""
echo " Song IDs (for testing):"
echo "   11111111-0000-0000-0000-000000000001  Noi Nay Co Anh"
echo "   11111111-0000-0000-0000-000000000002  Lac Troi"
echo "   11111111-0000-0000-0000-000000000003  Dai Lo Mat Troi"
echo ""
echo " Next: docker compose up --build"
echo "============================================"
