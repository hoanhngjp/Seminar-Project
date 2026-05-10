#!/usr/bin/env bash
# demo_accounts.sh — Tạo demo accounts cho Listener và Creator
# Chạy sau khi infra và services đã up: docker-compose up -d
# Yêu cầu: curl (jq không cần)
#
# Usage:
#   bash infra/seed/demo_accounts.sh
#   bash infra/seed/demo_accounts.sh http://localhost:5000

set -uo pipefail

BASE_URL="${1:-http://localhost:5000}"
REGISTER_URL="$BASE_URL/api/v1/auth/register"

GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
NC="\033[0m"

log()  { echo -e "${GREEN}[OK]${NC}  $*"; }
warn() { echo -e "${YELLOW}[SKIP]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }

# Extract a JSON string value without jq — works on Git Bash / WSL / macOS
json_get() {
  local key="$1" json="$2"
  echo "$json" | grep -oP "\"${key}\"\\s*:\\s*\"\\K[^\"]*" | head -1
}

json_bool() {
  local key="$1" json="$2"
  echo "$json" | grep -oP "\"${key}\"\\s*:\\s*\\K(true|false)" | head -1
}

register_account() {
  local email="$1" password="$2" display_name="$3" role="$4"

  echo -n "  Creating $role account: $email ... "

  response=$(curl -s -w "\n%{http_code}" -X POST "$REGISTER_URL" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\",\"displayName\":\"$display_name\",\"role\":\"$role\"}")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -n -1)
  success=$(json_bool "success" "$body")

  if [[ "$http_code" == "201" && "$success" == "true" ]]; then
    user_id=$(json_get "userId" "$body")
    log "Created (userId: $user_id)"
  elif [[ "$http_code" == "400" ]]; then
    message=$(json_get "message" "$body")
    if echo "$message" | grep -qi "already registered\|already exists"; then
      warn "Already exists — skipping"
    else
      fail "400 — $message"
    fi
  elif [[ "$http_code" == "000" ]]; then
    fail "Cannot connect to $BASE_URL — is docker-compose up?"
  else
    message=$(json_get "message" "$body")
    fail "HTTP $http_code — $message"
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
  status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" 2>/dev/null || echo "000")
  if [[ "$status" == "200" ]]; then
    log "Gateway is up (HTTP 200)"
    break
  fi
  if [[ $i -eq 10 ]]; then
    fail "Gateway not reachable after 10 tries. Is docker-compose up?"
    exit 1
  fi
  echo "  Waiting... ($i/10) — HTTP $status"
  sleep 3
done

echo ""
echo "Creating accounts..."
register_account "listener@example.com"  "Demo1234!"  "Demo Listener"  "Listener"
register_account "creator@example.com"   "Demo1234!"  "Demo Creator"   "Creator"
register_account "listener2@example.com" "Demo1234!"  "Listener Two"   "Listener"

echo ""
echo "================================================"
echo "  Done. Login credentials:"
echo "  Listener : listener@example.com  / Demo1234!"
echo "  Creator  : creator@example.com   / Demo1234!"
echo "  Listener2: listener2@example.com / Demo1234!"
echo "================================================"
echo ""
