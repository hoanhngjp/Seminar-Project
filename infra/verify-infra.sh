#!/usr/bin/env bash
# verify-infra.sh — Smart Music Streaming Platform
# Kiểm tra toàn bộ infrastructure local đang healthy.
# Chạy từ thư mục gốc repo: bash infra/verify-infra.sh

set -euo pipefail

# ============================================================
# Config
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

PASS=0
FAIL=0
WARNINGS=()

# ============================================================
# Helpers
# ============================================================
ok()   { echo "  ✅  $1"; ((PASS++)); }
fail() { echo "  ❌  $1"; ((FAIL++)); }
info() { echo "      $1"; }
section() { echo; echo "━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }

# Load .env if present (for password values)
if [[ -f "$ENV_FILE" ]]; then
  # Export only the variables we need, ignore comments/blank lines
  set -a
  # shellcheck disable=SC1090
  source <(grep -E '^[A-Z_]+=.+' "$ENV_FILE")
  set +a
else
  WARNINGS+=(".env not found at $ENV_FILE — using defaults from .env.example")
fi

# Apply defaults matching .env.example
POSTGRES_USER="${POSTGRES_USER:-smartmusic}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-changeme_local}"
REDIS_PASSWORD="${REDIS_PASSWORD:-changeme_local}"
MONGO_USERNAME="${MONGO_USERNAME:-admin}"
MONGO_PASSWORD="${MONGO_PASSWORD:-changeme_local}"
INFLUXDB_TOKEN="${INFLUXDB_TOKEN:-my-super-secret-token-change-this-in-production}"
INFLUXDB_ORG="${INFLUXDB_ORG:-smartmusic}"
INFLUXDB_BUCKET="${INFLUXDB_BUCKET:-analytics}"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-minioadmin}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-minioadmin}"
AWS_S3_BUCKET="${AWS_S3_BUCKET:-smartmusic-audio}"

# Kafka topics required by the platform (no-scope-creep rule: exactly 5)
REQUIRED_TOPICS=(
  "Song_Played"
  "Song_Skipped"
  "New_Release"
  "User_Preferences_Updated"
  "Notification_Sent"
)

# PostgreSQL databases required per service
REQUIRED_DBS=(
  "auth_db"
  "user_db"
  "music_db"
  "streaming_db"
  "listening_party_db"
  "analytics_db"
  "notification_db"
)

# ============================================================
# Header
# ============================================================
echo
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Smart Music — Infrastructure Health Verification       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo "  Date : $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Host : $(hostname)"

if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo
  echo "  ⚠️  Warnings:"
  for w in "${WARNINGS[@]}"; do
    echo "     • $w"
  done
fi

# ============================================================
# 1. Docker daemon
# ============================================================
section "Docker"
if docker info > /dev/null 2>&1; then
  ok "Docker daemon is running"
else
  fail "Docker daemon is not running"
  info "Fix: Start Docker Desktop (Windows) or 'sudo systemctl start docker' (Linux)"
  echo
  echo "━━━ RESULT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ❌  Cannot continue — Docker is required for all checks."
  exit 1
fi

# ============================================================
# 2. Redis
# ============================================================
section "Redis  (localhost:6379)"
if docker exec smartmusic-redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning PING 2>/dev/null | grep -q "PONG"; then
  ok "Redis responds to PING"
else
  fail "Redis did not respond to PING"
  info "Fix: docker compose -f infra/docker-compose.yml up -d redis"
  info "     docker logs smartmusic-redis"
fi

# ============================================================
# 3. PostgreSQL
# ============================================================
section "PostgreSQL  (localhost:5432)"

# Basic connectivity
if docker exec smartmusic-postgres pg_isready -U "$POSTGRES_USER" -q 2>/dev/null; then
  ok "PostgreSQL accepts connections (pg_isready)"
else
  fail "PostgreSQL is not ready"
  info "Fix: docker compose -f infra/docker-compose.yml up -d postgres"
  info "     docker logs smartmusic-postgres"
fi

# Per-service databases
DB_PASS_OK=true
for db in "${REQUIRED_DBS[@]}"; do
  if docker exec smartmusic-postgres \
      psql -U "$POSTGRES_USER" -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw "$db"; then
    ok "PostgreSQL DB exists: $db"
  else
    fail "PostgreSQL DB missing: $db"
    info "Fix: docker exec smartmusic-postgres psql -U $POSTGRES_USER -c 'CREATE DATABASE $db;'"
    info "     Or re-run: bash setup-repo.ps1 (runs init scripts)"
    DB_PASS_OK=false
  fi
done

if [[ "$DB_PASS_OK" == "false" ]]; then
  info ""
  info "Bulk fix — create all missing DBs:"
  info "  docker exec smartmusic-postgres psql -U $POSTGRES_USER -c \\"
  printf "    'CREATE DATABASE IF NOT EXISTS %s;'\n" "${REQUIRED_DBS[@]}" | \
    while read -r line; do info "  $line"; done
fi

# ============================================================
# 4. MongoDB
# ============================================================
section "MongoDB  (localhost:27017)"
MONGO_PING=$(docker exec smartmusic-mongodb \
  mongosh --quiet \
    -u "$MONGO_USERNAME" -p "$MONGO_PASSWORD" \
    --authenticationDatabase admin \
    --eval "db.adminCommand('ping').ok" 2>/dev/null || echo "0")

if [[ "$MONGO_PING" == "1" ]]; then
  ok "MongoDB responds to ping"
else
  fail "MongoDB ping failed"
  info "Fix: docker compose -f infra/docker-compose.yml up -d mongodb"
  info "     docker logs smartmusic-mongodb"
fi

# ============================================================
# 5. Elasticsearch
# ============================================================
section "Elasticsearch  (localhost:9200)"

ES_STATUS=$(curl -s --max-time 5 "http://localhost:9200/_cluster/health" 2>/dev/null \
  | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unreachable")

case "$ES_STATUS" in
  green)
    ok "Elasticsearch cluster status: green"
    ;;
  yellow)
    ok "Elasticsearch cluster status: yellow (single-node — expected for local dev)"
    ;;
  red)
    fail "Elasticsearch cluster status: RED — data may be unavailable"
    info "Fix: docker logs smartmusic-elasticsearch"
    info "     docker compose -f infra/docker-compose.yml restart elasticsearch"
    ;;
  *)
    fail "Elasticsearch unreachable (status: $ES_STATUS)"
    info "Fix: docker compose -f infra/docker-compose.yml up -d elasticsearch"
    info "     Check memory: ES needs at least 512 MB — see docker-compose.yml mem_limit"
    info "     On Linux: sudo sysctl -w vm.max_map_count=262144"
    ;;
esac

# ============================================================
# 6. Kafka
# ============================================================
section "Kafka  (localhost:9092)"

KAFKA_ALIVE=false
if docker exec smartmusic-kafka \
    kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1; then
  ok "Kafka broker reachable"
  KAFKA_ALIVE=true
else
  fail "Kafka broker not reachable"
  info "Fix: docker compose -f infra/docker-compose.yml up -d zookeeper kafka"
  info "     docker logs smartmusic-kafka"
  info "     docker logs smartmusic-zookeeper"
fi

# Topics — only check if broker is alive
if [[ "$KAFKA_ALIVE" == "true" ]]; then
  EXISTING_TOPICS=$(docker exec smartmusic-kafka \
    kafka-topics --bootstrap-server localhost:9092 --list 2>/dev/null || echo "")

  TOPIC_ALL_OK=true
  for topic in "${REQUIRED_TOPICS[@]}"; do
    if echo "$EXISTING_TOPICS" | grep -qx "$topic"; then
      ok "Kafka topic exists: $topic"
    else
      fail "Kafka topic missing: $topic"
      info "Fix: docker exec smartmusic-kafka kafka-topics \\"
      info "       --bootstrap-server localhost:9092 \\"
      info "       --create --topic $topic --partitions 1 --replication-factor 1"
      TOPIC_ALL_OK=false
    fi
  done

  if [[ "$TOPIC_ALL_OK" == "false" ]]; then
    echo
    info "Bulk fix — create all missing topics:"
    info "  for topic in ${REQUIRED_TOPICS[*]}; do"
    info "    docker exec smartmusic-kafka kafka-topics \\"
    info "      --bootstrap-server localhost:9092 \\"
    info "      --create --if-not-exists --topic \$topic \\"
    info "      --partitions 1 --replication-factor 1"
    info "  done"
  fi
fi

# ============================================================
# 7. InfluxDB
# ============================================================
section "InfluxDB  (localhost:8086)"

INFLUX_HEALTH=$(curl -s --max-time 5 \
  -H "Authorization: Token $INFLUXDB_TOKEN" \
  "http://localhost:8086/health" 2>/dev/null \
  | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unreachable")

if [[ "$INFLUX_HEALTH" == "pass" ]]; then
  ok "InfluxDB health: pass"

  # Verify org and bucket exist
  INFLUX_ORGS=$(curl -s --max-time 5 \
    -H "Authorization: Token $INFLUXDB_TOKEN" \
    "http://localhost:8086/api/v2/orgs" 2>/dev/null | grep -o '"name":"[^"]*"' || echo "")

  if echo "$INFLUX_ORGS" | grep -q "\"name\":\"$INFLUXDB_ORG\""; then
    ok "InfluxDB org exists: $INFLUXDB_ORG"
  else
    fail "InfluxDB org missing: $INFLUXDB_ORG"
    info "Fix: Recreate container — DOCKER_INFLUXDB_INIT_MODE=setup handles this on first start"
    info "     docker compose -f infra/docker-compose.yml rm -sf influxdb"
    info "     docker volume rm \$(docker volume ls -q | grep influxdata)"
    info "     docker compose -f infra/docker-compose.yml up -d influxdb"
  fi
else
  fail "InfluxDB unreachable (status: $INFLUX_HEALTH)"
  info "Fix: docker compose -f infra/docker-compose.yml up -d influxdb"
  info "     docker logs smartmusic-influxdb"
fi

# ============================================================
# 8. MinIO (S3 local)
# ============================================================
section "MinIO / S3  (localhost:9000)"

MINIO_HEALTH=$(curl -s --max-time 5 \
  "http://localhost:9000/minio/health/live" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")

if [[ "$MINIO_HEALTH" == "200" ]]; then
  ok "MinIO live endpoint: HTTP 200"

  # Check bucket exists
  BUCKET_EXISTS=$(docker exec smartmusic-minio \
    sh -c "mc alias set local http://localhost:9000 '$AWS_ACCESS_KEY_ID' '$AWS_SECRET_ACCESS_KEY' --quiet 2>/dev/null \
           && mc ls local/$AWS_S3_BUCKET > /dev/null 2>&1 && echo yes || echo no" 2>/dev/null || echo "no")

  if [[ "$BUCKET_EXISTS" == "yes" ]]; then
    ok "MinIO bucket exists: $AWS_S3_BUCKET"
  else
    fail "MinIO bucket missing: $AWS_S3_BUCKET"
    info "Fix: docker exec smartmusic-minio \\"
    info "       mc alias set local http://localhost:9000 $AWS_ACCESS_KEY_ID $AWS_SECRET_ACCESS_KEY"
    info "     docker exec smartmusic-minio mc mb local/$AWS_S3_BUCKET"
  fi
else
  fail "MinIO not reachable (HTTP $MINIO_HEALTH)"
  info "Fix: docker compose -f infra/docker-compose.yml up -d minio"
  info "     docker logs smartmusic-minio"
fi

# ============================================================
# 9. Docker healthcheck status summary
# ============================================================
section "Docker container health (docker ps)"

CONTAINERS=(
  "smartmusic-postgres"
  "smartmusic-mongodb"
  "smartmusic-redis"
  "smartmusic-elasticsearch"
  "smartmusic-zookeeper"
  "smartmusic-kafka"
  "smartmusic-influxdb"
  "smartmusic-minio"
)

for cname in "${CONTAINERS[@]}"; do
  STATE=$(docker inspect --format='{{.State.Status}}' "$cname" 2>/dev/null || echo "not found")
  HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$cname" 2>/dev/null || echo "n/a")

  if [[ "$STATE" == "running" ]]; then
    case "$HEALTH" in
      healthy|no-healthcheck)
        ok "$cname  [running / $HEALTH]"
        ;;
      starting)
        fail "$cname  [running / health: starting — still warming up]"
        info "Wait ~30s then re-run this script"
        ;;
      unhealthy)
        fail "$cname  [running / UNHEALTHY]"
        info "Fix: docker logs $cname  # check last error"
        info "     docker compose -f infra/docker-compose.yml restart ${cname#smartmusic-}"
        ;;
      *)
        fail "$cname  [running / health: $HEALTH]"
        ;;
    esac
  elif [[ "$STATE" == "not found" ]]; then
    fail "$cname  [not found — container does not exist]"
    info "Fix: docker compose -f infra/docker-compose.yml up -d"
  else
    fail "$cname  [state: $STATE]"
    info "Fix: docker compose -f infra/docker-compose.yml up -d ${cname#smartmusic-}"
    info "     docker logs $cname"
  fi
done

# ============================================================
# Result
# ============================================================
TOTAL=$((PASS + FAIL))
echo
echo "━━━ RESULT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Passed : $PASS / $TOTAL"
echo "  Failed : $FAIL / $TOTAL"

if [[ $FAIL -eq 0 ]]; then
  echo
  echo "  🎉  All infrastructure checks passed — ready for development!"
  echo
  exit 0
else
  echo
  echo "  🔧  Fix the ❌ items above, then re-run:"
  echo "        bash infra/verify-infra.sh"
  echo
  echo "  Quick start (spin up everything from scratch):"
  echo "    cd infra && cp .env.example .env  # fill in passwords"
  echo "    docker compose up -d"
  echo "    # wait ~30s for services to start, then:"
  echo "    bash infra/verify-infra.sh"
  echo
  exit 1
fi
