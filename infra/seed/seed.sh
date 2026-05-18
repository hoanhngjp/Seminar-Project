#!/usr/bin/env bash
# ============================================================
# Smart Music Platform — Master Seed Entrypoint
# ============================================================
#
# Script này giải thích toàn bộ quy trình seed từ đầu đến cuối,
# và có thể chạy cả 2 phase tự động (nếu truyền --all).
#
# ┌─────────────────────────────────────────────────────────┐
# │                  QUICK START                            │
# │                                                         │
# │  1. Copy & điền .env:                                   │
# │     cp infra/.env.example infra/.env                    │
# │     # Điền GCP_BUCKET_NAME, GOOGLE_APPLICATION_CRED...  │
# │                                                         │
# │  2. Start infra containers:                             │
# │     docker compose -f infra/docker-compose.yml up -d \  │
# │       postgres redis elasticsearch kafka zookeeper \    │
# │       influxdb mongodb                                  │
# │                                                         │
# │  3. Build C# services (để dotnet ef có migrations):     │
# │     dotnet build SmartMusic.sln --configuration Release │
# │                                                         │
# │  4. Chạy Phase A (infra seed):                          │
# │     bash infra/seed/1_seed_infra.sh                     │
# │                                                         │
# │  5. Start tất cả services:                              │
# │     docker compose -f infra/docker-compose.yml up -d \  │
# │       --build                                           │
# │                                                         │
# │  6. Chạy Phase B (demo accounts):                       │
# │     bash infra/seed/2_seed_accounts.sh                  │
# │                                                         │
# │  HOẶC: Chạy cả 2 phases tự động (sau khi services up): │
# │     bash infra/seed/seed.sh --all                       │
# └─────────────────────────────────────────────────────────┘
#
# Usage:
#   bash infra/seed/seed.sh           # hiển thị hướng dẫn này
#   bash infra/seed/seed.sh --all     # chạy Phase A + B tự động
#   bash infra/seed/seed.sh --phase-a # chỉ Phase A
#   bash infra/seed/seed.sh --phase-b # chỉ Phase B
# ============================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SEED_DIR="$REPO_ROOT/infra/seed"

BOLD="\033[1m"; CYAN="\033[0;36m"; GREEN="\033[0;32m"; NC="\033[0m"

MODE="${1:-help}"

print_help() {
  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║         Smart Music Platform — Seed Guide                   ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BOLD}Prerequisites (cài đặt một lần):${NC}"
  echo "  - Docker Desktop đang chạy"
  echo "  - dotnet SDK 8.0+ và dotnet-ef tool:"
  echo "      dotnet tool install --global dotnet-ef"
  echo "  - psql CLI: apt install postgresql-client  (hoặc qua brew/choco)"
  echo "  - Google Cloud SDK (gsutil):"
  echo "      https://cloud.google.com/sdk/docs/install"
  echo "  - File tests/fixtures/test-audio.mp3 (bất kỳ .mp3 hợp lệ)"
  echo ""
  echo -e "${BOLD}Bước 1 — Cấu hình .env:${NC}"
  echo "  cp infra/.env.example infra/.env"
  echo "  # Mở infra/.env và điền:"
  echo "  #   GCP_BUCKET_NAME=<tên bucket GCS của bạn>"
  echo "  #   GOOGLE_APPLICATION_CREDENTIALS=infra/secrets/google-cloud-key.json"
  echo "  #   (Các giá trị mặc định khác thường dùng được cho local dev)"
  echo ""
  echo -e "${BOLD}Bước 2 — Start infra containers:${NC}"
  echo "  docker compose -f infra/docker-compose.yml up -d \\"
  echo "    postgres redis elasticsearch kafka zookeeper influxdb mongodb"
  echo "  # Đợi ~15s cho tất cả containers healthy"
  echo ""
  echo -e "${BOLD}Bước 3 — Build C# solution:${NC}"
  echo "  dotnet build SmartMusic.sln --configuration Release"
  echo "  # Cần thiết để dotnet ef database update tìm được migrations"
  echo ""
  echo -e "${BOLD}Bước 4 — Chạy Phase A (Infrastructure Seed):${NC}"
  echo "  bash infra/seed/1_seed_infra.sh"
  echo ""
  echo "  Phase A thực hiện:"
  echo "    [1] Wait PostgreSQL healthy"
  echo "    [2] EF Core migrations (auth_db, user_db, music_db)"
  echo "    [3] Seed PostgreSQL: 30 songs + 16 artists + genres + preferences"
  echo "    [4] Seed Elasticsearch: index 30 songs (fuzzy search)"
  echo "    [5] Seed Redis: rec:trending:global (30 songs, scored by play_count)"
  echo "    [6] Seed Lyrics: 21 bài LRC → music_db.songs.Lyrics"
  echo "    [7] Upload GCS audio: 30 placeholder mp3 → gs://BUCKET/songs/{id}/audio.mp3"
  echo ""
  echo -e "${BOLD}Bước 5 — Start tất cả services:${NC}"
  echo "  docker compose -f infra/docker-compose.yml up -d --build"
  echo "  # Build và start api-gateway, auth-service, music-service, v.v."
  echo "  # Đợi ~30s cho tất cả services healthy"
  echo ""
  echo -e "${BOLD}Bước 6 — Chạy Phase B (Demo Accounts):${NC}"
  echo "  bash infra/seed/2_seed_accounts.sh"
  echo ""
  echo "  Phase B thực hiện:"
  echo "    [1] Wait API Gateway healthy"
  echo "    [2] Đăng ký 3 demo accounts qua POST /api/v1/auth/register"
  echo "    [3] Set preferences cho listener accounts"
  echo ""
  echo -e "${BOLD}Demo accounts sau khi seed:${NC}"
  echo "  Listener  : listener@example.com   / Demo1234!"
  echo "  Creator   : creator@example.com    / Demo1234!"
  echo "  Listener2 : listener2@example.com  / Demo1234!"
  echo ""
  echo -e "${BOLD}Verify sau khi seed:${NC}"
  echo "  bash infra/verify-infra.sh"
  echo "  bash infra/verify_ac.sh"
  echo ""
  echo -e "${BOLD}Chạy tự động (Phase A + B):${NC}"
  echo "  bash infra/seed/seed.sh --all"
  echo "  # Lưu ý: --all giả định infra containers đã up."
  echo "  # Bạn vẫn cần chạy 'docker compose up -d --build' cho services"
  echo "  # TRƯỚC khi Phase B bắt đầu — script sẽ wait tự động."
  echo ""
  echo -e "${BOLD}Individual scripts (dùng khi cần seed lại 1 phần):${NC}"
  echo "  bash infra/seed/1_seed_infra.sh          # toàn bộ Phase A"
  echo "  bash infra/seed/2_seed_accounts.sh       # demo accounts"
  echo "  bash infra/seed/elasticsearch_seed.sh    # chỉ Elasticsearch"
  echo "  bash infra/seed/redis_seed.sh            # chỉ Redis trending"
  echo "  bash infra/seed/seed_lyrics.sh           # chỉ lyrics"
  echo "  bash infra/seed/gcs_seed.sh              # chỉ GCS audio"
  echo ""
}

run_phase_a() {
  echo -e "${CYAN}${BOLD}▶ Running Phase A: Infrastructure Seed...${NC}"
  bash "$SEED_DIR/1_seed_infra.sh"
}

run_phase_b() {
  echo -e "${CYAN}${BOLD}▶ Running Phase B: Demo Accounts Seed...${NC}"
  bash "$SEED_DIR/2_seed_accounts.sh"
}

case "$MODE" in
  --all)
    echo ""
    echo -e "${BOLD}Running full seed: Phase A + Phase B${NC}"
    echo -e "  Note: Phase B will wait for API Gateway — ensure services are started."
    echo ""
    run_phase_a
    echo ""
    echo -e "${BOLD}If services are not running yet, start them now:${NC}"
    echo "  docker compose -f infra/docker-compose.yml up -d --build"
    echo -e "  (Phase B will wait up to 100s for the gateway to be ready)"
    echo ""
    run_phase_b
    ;;
  --phase-a)
    run_phase_a
    ;;
  --phase-b)
    run_phase_b
    ;;
  help|--help|-h|*)
    print_help
    ;;
esac
