#!/usr/bin/env bash
# demo_accounts.sh — Tạo demo accounts cho Listener và Creator
# Chạy sau khi infra và services đã up: docker-compose up -d
# Yêu cầu: curl, jq
#
# Usage:
#   bash infra/seed/demo_accounts.sh
#   bash infra/seed/demo_accounts.sh http://localhost:5000   # custom base URL

set -euo pipefail

BASE_URL="${1:-http://localhost:5000}"
REGISTER_URL="$BASE_URL/api/v1/auth/register"

GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
NC="\033[0m"

log()  { echo -e "${GREEN}[OK]${NC}  $*"; }
warn() { echo -e "${YELLOW}[SKIP]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }

register_account() {
  local email="$1"
  local password="$2"
  local display_name="$3"
  local role="$4"

  echo -n "  Creating $role account: $email ... "

  response=$(curl -s -w "\n%{http_code}" -X POST "$REGISTER_URL" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\",\"displayName\":\"$display_name\",\"role\":\"$role\"}")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -n -1)
  success=$(echo "$body" | jq -r '.success // false')

  if [[ "$http_code" == "201" && "$success" == "true" ]]; then
    user_id=$(echo "$body" | jq -r '.data.userId')
    log "Created ($user_id)"
  elif [[ "$http_code" == "400" ]]; then
    message=$(echo "$body" | jq -r '.error.message // "unknown error"')
    if echo "$message" | grep -qi "already registered\|already exists"; then
      warn "Already exists — skipping"
    else
      fail "400 $message"
    fi
  else
    fail "HTTP $http_code — $(echo "$body" | jq -r '.error.message // "unknown"')"
  fi
}

echo ""
echo "================================================"
echo "  Smart Music — Demo Account Setup"
echo "  Gateway: $BASE_URL"
echo "================================================"
echo ""

# Wait for gateway to be ready
echo "Checking gateway health..."
for i in {1..10}; do
  if curl -s "$BASE_URL/health" | grep -q "healthy\|ok\|OK" 2>/dev/null; then
    log "Gateway is up"
    break
  fi
  if [[ $i -eq 10 ]]; then
    fail "Gateway not reachable after 10 tries. Is docker-compose up?"
    exit 1
  fi
  echo "  Waiting... ($i/10)"
  sleep 3
done

echo ""
echo "Creating accounts..."
register_account "listener@example.com"  "Demo1234!"  "Demo Listener"  "Listener"
register_account "creator@example.com"   "Demo1234!"  "Demo Creator"   "Creator"
register_account "listener2@example.com" "Demo1234!"  "Listener Two"   "Listener"

echo ""
echo "================================================"
echo "  Demo accounts ready. Login credentials:"
echo "  Listener: listener@example.com / Demo1234!"
echo "  Creator:  creator@example.com  / Demo1234!"
echo "================================================"
echo ""
