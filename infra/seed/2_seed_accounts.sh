#!/usr/bin/env bash
# ============================================================
# Smart Music Platform — Phase B: Demo Accounts Seed
# ============================================================
#
# Chạy script này SAU KHI tất cả service containers đã up:
#   docker compose -f infra/docker-compose.yml up -d --build
#
# Script sẽ tự wait cho API Gateway healthy trước khi tạo accounts.
#
# Idempotent: nếu account đã tồn tại → skip (không báo lỗi).
#
# Usage (từ repo root):
#   bash infra/seed/2_seed_accounts.sh
#   bash infra/seed/2_seed_accounts.sh http://localhost:5000   # custom base URL
# ============================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INFRA_DIR="$REPO_ROOT/infra"

# ── Colors ───────────────────────────────────────────────────
GREEN="\033[0;32m"; RED="\033[0;31m"; YELLOW="\033[1;33m"
CYAN="\033[0;36m"; BOLD="\033[1m"; NC="\033[0m"

ok()    { echo -e "  ${GREEN}✅ $*${NC}"; }
warn()  { echo -e "  ${YELLOW}⚠️  $*${NC}"; }
fail()  { echo -e "  ${RED}❌ $*${NC}"; }
info()  { echo -e "  ℹ️  $*"; }

# ── Load .env ─────────────────────────────────────────────────
if [[ -f "$INFRA_DIR/.env" ]]; then
  set -a; source "$INFRA_DIR/.env"; set +a
fi

BASE_URL="${1:-http://localhost:5000}"
REGISTER_URL="$BASE_URL/api/v1/auth/register"
HEALTH_URL="$BASE_URL/health"

echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}  Smart Music — Phase B: Demo Accounts Seed${NC}"
echo -e "${BOLD}============================================${NC}"
echo "  Gateway: $BASE_URL"

# ── Wait for API Gateway ──────────────────────────────────────
echo ""
echo "Waiting for API Gateway to be healthy..."

GATEWAY_UP=false
for i in $(seq 1 20); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
  if [[ "$STATUS" == "200" ]]; then
    ok "Gateway is up (HTTP 200)"
    GATEWAY_UP=true
    break
  fi
  info "Attempt $i/20 — HTTP $STATUS — waiting 5s..."
  sleep 5
done

if [[ "$GATEWAY_UP" != "true" ]]; then
  fail "API Gateway not reachable after 100s."
  echo ""
  echo "  Possible causes:"
  echo "    - Services not started: run 'docker compose -f infra/docker-compose.yml up -d --build'"
  echo "    - Gateway port not 5000: pass custom URL as argument:"
  echo "      bash infra/seed/2_seed_accounts.sh http://localhost:<PORT>"
  exit 1
fi

# ── Helper: extract JSON field without jq ────────────────────
json_get() {
  echo "$2" | grep -oP "\"${1}\"\\s*:\\s*\"\\K[^\"]+" | head -1
}
json_bool() {
  echo "$2" | grep -oP "\"${1}\"\\s*:\\s*\\K(true|false)" | head -1
}

# ── Register account (idempotent) ────────────────────────────
register() {
  local email="$1" password="$2" display_name="$3" role="$4"

  echo -n "  Creating [$role] $email ... "

  local response http_code body success

  response=$(curl -s -w "\n%{http_code}" -X POST "$REGISTER_URL" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\",\"displayName\":\"$display_name\",\"role\":\"$role\"}")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -n -1)
  success=$(json_bool "success" "$body")

  if [[ "$http_code" == "201" && "$success" == "true" ]]; then
    local user_id
    user_id=$(json_get "userId" "$body")
    echo -e "${GREEN}✅ Created (userId: $user_id)${NC}"
  elif [[ "$http_code" == "400" ]]; then
    local message
    message=$(json_get "message" "$body")
    if echo "$message" | grep -qiE "already registered|already exists"; then
      echo -e "${YELLOW}⚠️  Already exists — skipped${NC}"
    else
      echo -e "${RED}❌ 400 — $message${NC}"
    fi
  elif [[ "$http_code" == "000" ]]; then
    echo -e "${RED}❌ Cannot connect to $BASE_URL${NC}"
    exit 1
  else
    local message
    message=$(json_get "message" "$body")
    echo -e "${RED}❌ HTTP $http_code — $message${NC}"
  fi
}

# ── Create accounts ───────────────────────────────────────────
echo ""
echo "Creating demo accounts..."
echo ""

# listener@ và creator@ đã được seed bởi UserService DbInitializer (password: Test1234!)
# Chỉ tạo listener2@ là account mới thực sự qua API
register "listener2@example.com"  "Test1234!" "Listener Two"    "Listener"

# ── Onboarding preferences (optional, best-effort) ───────────
echo ""
echo "Setting up preferences for listener accounts (best-effort)..."

# Login and set preferences for listener (ignore errors — optional step)
set_preferences() {
  local email="$1" password="$2"

  local login_resp http_code body access_token

  login_resp=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" 2>/dev/null)

  http_code=$(echo "$login_resp" | tail -1)
  body=$(echo "$login_resp" | head -n -1)
  access_token=$(json_get "accessToken" "$body")

  if [[ "$http_code" != "200" || -z "$access_token" ]]; then
    warn "Could not login as $email (HTTP $http_code) — skipping preferences"
    return
  fi

  local prefs_resp prefs_code

  prefs_resp=$(curl -s -w "\n%{http_code}" -X POST \
    "$BASE_URL/api/v1/users/me/preferences" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $access_token" \
    -d '{
      "preferredGenres": ["Pop", "Indie", "Hip-Hop"],
      "preferredArtists": [
        "b0000002-0000-0000-0000-000000000001",
        "b0000002-0000-0000-0000-000000000003"
      ],
      "language": "vi"
    }' 2>/dev/null)

  prefs_code=$(echo "$prefs_resp" | tail -1)

  if [[ "$prefs_code" == "200" ]]; then
    ok "Preferences set for $email"
  else
    warn "Preferences skipped for $email (HTTP $prefs_code)"
  fi
}

set_preferences "listener@example.com"  "Test1234!"
set_preferences "listener2@example.com" "Test1234!"

# ── Summary ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${GREEN}${BOLD}  Phase B complete!${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""
echo "  Demo accounts:"
echo "    Listener  : listener@example.com   / Test1234!  (seeded by UserService)"
echo "    Creator   : creator@example.com    / Test1234!  (seeded by UserService)"
echo "    Admin     : admin@example.com      / Test1234!  (seeded by UserService)"
echo "    Listener2 : listener2@example.com  / Test1234!  (created by this script)"
echo ""
echo "  Platform ready at: http://localhost:5173"
echo ""
echo -e "${BOLD}  Quick smoke test:${NC}"
echo "    curl http://localhost:5000/health"
echo "    curl http://localhost:5000/api/v1/search?q=son+tung | python3 -m json.tool"
echo ""
