#!/usr/bin/env bash
# ============================================================
# Smart Music Platform — Phase A: Infrastructure Seed
# ============================================================
#
# Chạy script này SAU KHI các infra containers đã up:
#   docker compose -f infra/docker-compose.yml up -d \
#     postgres redis elasticsearch kafka zookeeper influxdb mongodb
#
# KHÔNG cần các service containers (api-gateway, auth-service, v.v.)
#
# Prerequisites:
#   - docker CLI trên PATH
#   - dotnet CLI + dotnet-ef tool trên PATH
#       dotnet tool install --global dotnet-ef
#   - gsutil (Google Cloud SDK) trên PATH
#   - GCP_BUCKET_NAME đã set trong infra/.env
#   - GOOGLE_APPLICATION_CREDENTIALS trỏ đến service account JSON
#   - tests/fixtures/test-audio.mp3 tồn tại (bất kỳ file mp3 hợp lệ)
#
# Idempotent: an toàn để chạy lại — sẽ skip những gì đã tồn tại.
#
# Usage (từ repo root):
#   bash infra/seed/1_seed_infra.sh
# ============================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INFRA_DIR="$REPO_ROOT/infra"
SEED_DIR="$INFRA_DIR/seed"

# ── Colors ──────────────────────────────────────────────────
GREEN="\033[0;32m"; RED="\033[0;31m"; YELLOW="\033[1;33m"
CYAN="\033[0;36m"; BOLD="\033[1m"; NC="\033[0m"

step()  { echo -e "\n${CYAN}${BOLD}[$1/$TOTAL_STEPS]${NC} $2"; }
ok()    { echo -e "  ${GREEN}✅ $*${NC}"; }
warn()  { echo -e "  ${YELLOW}⚠️  $*${NC}"; }
fail()  { echo -e "  ${RED}❌ $*${NC}"; }
info()  { echo -e "  ℹ️  $*"; }

TOTAL_STEPS=7

# ── Load .env ────────────────────────────────────────────────
if [[ -f "$INFRA_DIR/.env" ]]; then
  set -a; source "$INFRA_DIR/.env"; set +a
  info "Loaded infra/.env"
else
  warn "infra/.env not found — using defaults. Copy infra/.env.example → infra/.env first."
fi

PG_USER="${POSTGRES_USER:-smartmusic}"
PG_PASS="${POSTGRES_PASSWORD:-changeme_local}"
REDIS_CONTAINER="${REDIS_CONTAINER:-smartmusic-redis}"
REDIS_PASSWORD="${REDIS_PASSWORD:-changeme_local}"
PG_CONTAINER="${POSTGRES_CONTAINER:-smartmusic-postgres}"
ES_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"

# Helper: run psql inside the postgres container (no host psql needed)
pg_exec() {
  docker exec -i "$PG_CONTAINER" \
    env PGPASSWORD="$PG_PASS" psql -U "$PG_USER" "$@"
}

echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}  Smart Music — Phase A: Infrastructure Seed${NC}"
echo -e "${BOLD}============================================${NC}"
echo "  Postgres : container $PG_CONTAINER"
echo "  Redis    : $REDIS_CONTAINER"
echo "  ES       : $ES_URL"

# ── Step 0: Preflight checks ─────────────────────────────────
echo ""
echo -e "${BOLD}[Preflight] Checking prerequisites...${NC}"

PREFLIGHT_OK=true

check_cmd() {
  if command -v "$1" &>/dev/null; then
    ok "$1 found"
  else
    fail "$1 not found on PATH — install it before continuing"
    PREFLIGHT_OK=false
  fi
}

check_cmd docker
check_cmd dotnet
check_cmd gsutil

# Check dotnet-ef tool
if dotnet ef --version &>/dev/null; then
  ok "dotnet-ef tool found"
else
  fail "dotnet-ef not found — run: dotnet tool install --global dotnet-ef"
  PREFLIGHT_OK=false
fi

# Check GCS credentials
GCP_BUCKET="${GCP_BUCKET_NAME:-}"
if [[ -z "$GCP_BUCKET" ]]; then
  fail "GCP_BUCKET_NAME not set in infra/.env — required for audio streaming to work"
  PREFLIGHT_OK=false
else
  ok "GCP_BUCKET_NAME = $GCP_BUCKET"
fi

GCP_CREDS="${GOOGLE_APPLICATION_CREDENTIALS:-}"
if [[ -n "$GCP_CREDS" && -f "$GCP_CREDS" ]]; then
  ok "GOOGLE_APPLICATION_CREDENTIALS found: $GCP_CREDS"
elif gsutil ls &>/dev/null 2>&1; then
  ok "gsutil auth via application-default login"
else
  fail "No GCS credentials — set GOOGLE_APPLICATION_CREDENTIALS or run: gcloud auth application-default login"
  PREFLIGHT_OK=false
fi

FIXTURE="$REPO_ROOT/tests/fixtures/test-audio.mp3"
if [[ -f "$FIXTURE" ]]; then
  ok "Placeholder audio found: tests/fixtures/test-audio.mp3"
else
  fail "Missing: tests/fixtures/test-audio.mp3"
  info "Place any valid .mp3 file at that path and retry."
  PREFLIGHT_OK=false
fi

if [[ "$PREFLIGHT_OK" != "true" ]]; then
  echo ""
  fail "Preflight failed — fix the issues above and re-run."
  exit 1
fi

# ── Step 1: Wait for PostgreSQL ──────────────────────────────
step 1 "Waiting for PostgreSQL (container: $PG_CONTAINER)..."

for i in $(seq 1 30); do
  if pg_exec -d postgres -c "SELECT 1" &>/dev/null; then
    ok "PostgreSQL ready"
    break
  fi
  if [[ $i -eq 30 ]]; then
    fail "PostgreSQL not ready after 90s. Is docker compose up?"
    exit 1
  fi
  info "Attempt $i/30 — waiting 3s..."
  sleep 3
done

# ── Step 2: EF Core Migrations ───────────────────────────────
step 2 "Running EF Core migrations (idempotent)..."

# Build only the 3 service projects needed for migrations (not test projects)
info "Building migration projects..."
for proj in \
  "services/auth-service/src/AuthService.Api" \
  "services/user-service/src/UserService.Api" \
  "services/music-service/src/MusicService.Api"; do
  dotnet build "$REPO_ROOT/$proj" --configuration Release -v quiet 2>&1 | tail -1
done
ok "Build complete"

run_migration() {
  local name="$1" project="$2" startup="$3"
  info "→ $name..."
  dotnet ef database update \
    --project "$REPO_ROOT/$project" \
    --startup-project "$REPO_ROOT/$startup" \
    --no-build \
    2>&1 | tail -5
  ok "$name migration applied"
}

run_migration "auth-service" \
  "services/auth-service/src/AuthService.Infrastructure" \
  "services/auth-service/src/AuthService.Api"

run_migration "user-service" \
  "services/user-service/src/UserService.Infrastructure" \
  "services/user-service/src/UserService.Api"

run_migration "music-service" \
  "services/music-service/src/MusicService.Infrastructure" \
  "services/music-service/src/MusicService.Api"

info "→ analytics-service: InfluxDB (no EF migration)"
info "→ notification-service: MongoDB (no EF migration)"
info "→ listening-party-service: Redis (no EF migration)"
info "→ search-service: Elasticsearch (no EF migration)"

# ── Step 3: Seed PostgreSQL ───────────────────────────────────
step 3 "Seeding PostgreSQL data (ON CONFLICT DO NOTHING — idempotent)..."

# Check idempotency: count existing songs
EXISTING=$(pg_exec -d music_db -tAc "SELECT COUNT(*) FROM songs;" 2>/dev/null || echo "0")

if [[ "$EXISTING" -ge 30 ]]; then
  ok "Already have $EXISTING songs in music_db — running anyway (ON CONFLICT DO NOTHING)"
else
  info "Found $EXISTING songs — inserting seed data..."
fi

# Pipe SeedData.sql into the container via stdin
pg_exec -d postgres -v ON_ERROR_STOP=0 < "$SEED_DIR/SeedData.sql" \
  2>&1 | grep -E "(ERROR|WARNING)" || true

AFTER=$(pg_exec -d music_db -tAc "SELECT COUNT(*) FROM songs;" 2>/dev/null || echo "?")
ok "PostgreSQL seed done — $AFTER songs in music_db"

# ── Step 4: Seed Elasticsearch ────────────────────────────────
step 4 "Seeding Elasticsearch (recreate index — idempotent)..."
# Override to localhost — infra/.env sets elasticsearch:9200 (docker internal, not reachable from host)
ELASTICSEARCH_URL="http://localhost:9200" bash "$SEED_DIR/elasticsearch_seed.sh"
ok "Elasticsearch seed done"

# ── Step 5: Seed Redis trending ───────────────────────────────
step 5 "Seeding Redis trending data (ZADD — idempotent)..."
bash "$SEED_DIR/redis_seed.sh"
ok "Redis seed done"

# ── Step 6: Seed Lyrics ──────────────────────────────────────
step 6 "Seeding lyrics into music_db (UPDATE — idempotent)..."
bash "$SEED_DIR/seed_lyrics.sh"
ok "Lyrics seed done"

# ── Step 7: Seed GCS audio files ─────────────────────────────
step 7 "Uploading audio files to GCS bucket: $GCP_BUCKET..."

# All 30 song IDs matching SeedData.sql
SONG_IDS=(
  "b0000001-0000-0000-0000-000000000001"
  "b0000001-0000-0000-0000-000000000002"
  "b0000001-0000-0000-0000-000000000003"
  "b0000001-0000-0000-0000-000000000004"
  "b0000001-0000-0000-0000-000000000005"
  "b0000001-0000-0000-0000-000000000006"
  "b0000001-0000-0000-0000-000000000007"
  "b0000001-0000-0000-0000-000000000008"
  "b0000001-0000-0000-0000-000000000009"
  "b0000001-0000-0000-0000-000000000010"
  "b0000001-0000-0000-0000-000000000011"
  "b0000001-0000-0000-0000-000000000012"
  "b0000001-0000-0000-0000-000000000013"
  "b0000001-0000-0000-0000-000000000014"
  "b0000001-0000-0000-0000-000000000015"
  "b0000001-0000-0000-0000-000000000016"
  "b0000001-0000-0000-0000-000000000017"
  "b0000001-0000-0000-0000-000000000018"
  "b0000001-0000-0000-0000-000000000019"
  "b0000001-0000-0000-0000-000000000020"
  "b0000001-0000-0000-0000-000000000021"
  "b0000001-0000-0000-0000-000000000022"
  "b0000001-0000-0000-0000-000000000023"
  "b0000001-0000-0000-0000-000000000024"
  "b0000001-0000-0000-0000-000000000025"
  "b0000001-0000-0000-0000-000000000026"
  "b0000001-0000-0000-0000-000000000027"
  "b0000001-0000-0000-0000-000000000028"
  "b0000001-0000-0000-0000-000000000029"
  "b0000001-0000-0000-0000-000000000030"
)

UPLOADED=0
SKIPPED=0

for SONG_ID in "${SONG_IDS[@]}"; do
  GCS_PATH="gs://$GCP_BUCKET/songs/$SONG_ID/audio.mp3"

  # Idempotency: skip if file already exists on GCS
  if gsutil -q stat "$GCS_PATH" 2>/dev/null; then
    info "  [skip] $SONG_ID — already on GCS"
    ((SKIPPED++)) || true
  else
    echo -n "  → uploading $SONG_ID ... "
    if gsutil -q cp "$FIXTURE" "$GCS_PATH"; then
      echo -e "${GREEN}✅${NC}"
      ((UPLOADED++)) || true
    else
      echo -e "${RED}❌ FAILED${NC}"
      fail "Upload failed for $SONG_ID — check gsutil auth and bucket permissions"
      exit 1
    fi
  fi
done

ok "GCS seed done — uploaded: $UPLOADED, skipped (already existed): $SKIPPED"

# ── Summary ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${GREEN}${BOLD}  Phase A complete!${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""
echo "  Songs in DB    : $AFTER"
echo "  ES documents   : $(curl -s "$ES_URL/songs/_count" | grep -o '"count":[0-9]*' | cut -d: -f2 || echo '?')"
echo "  GCS audio files: $((UPLOADED + SKIPPED)) / ${#SONG_IDS[@]}"
echo ""
echo -e "${BOLD}  Next step:${NC}"
echo "  1. Build & start all service containers:"
echo "     docker compose -f infra/docker-compose.yml up -d --build"
echo ""
echo "  2. Wait ~30s for services to be healthy, then run:"
echo "     bash infra/seed/2_seed_accounts.sh"
echo ""
