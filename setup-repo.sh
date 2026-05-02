#!/usr/bin/env bash
# setup-repo.sh — Smart Music Streaming Platform
# Khởi tạo toàn bộ folder structure, C# solution, Python project, React frontend.
# Chạy một lần từ repo root sau khi clone.
#
# Usage:
#   bash setup-repo.sh
#
# Prerequisites:
#   - .NET SDK 8.0+   (dotnet --version)
#   - Node.js 20 LTS  (node --version)
#   - Python 3.11+    (python3 --version)
#   - Git

set -euo pipefail

###############################################################################
# Helpers
###############################################################################

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
section() { echo -e "\n${GREEN}══════════════════════════════════════${NC}"; \
            echo -e "${GREEN}  $*${NC}"; \
            echo -e "${GREEN}══════════════════════════════════════${NC}"; }

require_tool() {
  if ! command -v "$1" &>/dev/null; then
    echo -e "${RED}[ERROR]${NC} '$1' not found. $2"
    exit 1
  fi
}

###############################################################################
# Pre-flight checks
###############################################################################

section "Pre-flight checks"

require_tool dotnet  "Install .NET SDK 8.0 from https://dotnet.microsoft.com/download"
require_tool node    "Install Node.js 20 LTS from https://nodejs.org"
require_tool npm     "Comes with Node.js"
require_tool python3 "Install Python 3.11+ from https://python.org"
require_tool git     "Install Git from https://git-scm.com"

DOTNET_MAJOR=$(dotnet --version | cut -d. -f1)
if [[ "$DOTNET_MAJOR" -lt 8 ]]; then
  echo -e "${RED}[ERROR]${NC} .NET SDK 8.0+ required (found $(dotnet --version))"
  exit 1
fi

NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  warn "Node.js 20 LTS recommended (found $(node --version))"
fi

PYTHON_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)')
PYTHON_MAJOR=$(python3 -c 'import sys; print(sys.version_info.major)')
if [[ "$PYTHON_MAJOR" -lt 3 ]] || [[ "$PYTHON_MAJOR" -eq 3 && "$PYTHON_MINOR" -lt 11 ]]; then
  warn "Python 3.11+ recommended (found $(python3 --version))"
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
info "Repo root: $REPO_ROOT"
cd "$REPO_ROOT"

###############################################################################
# 1. Top-level directory skeleton
###############################################################################

section "1. Creating top-level directory skeleton"

TOP_LEVEL_DIRS=(
  "services"
  "proto"
  "infra/postgres/init"
  "infra/kafka"
  "database"
  "docs/originals"
  "docs/architecture/diagrams"
  "docs/contracts/kafka-schemas"
  "docs/testing"
  "conventions"
  "tests/load"
  "tests/chaos"
  ".claude/rules/no-scope-creep"
  ".claude/rules/api-contract-first"
  ".claude/rules/security-non-negotiable"
  ".claude/rules/testing-required"
  ".claude/skills/aspnet-service"
  ".claude/skills/fastapi-service"
  ".claude/skills/microservice-api"
  ".claude/skills/react-spa"
  ".github"
)

for dir in "${TOP_LEVEL_DIRS[@]}"; do
  mkdir -p "$dir"
  info "  mkdir $dir"
done

###############################################################################
# 2. .gitignore
###############################################################################

section "2. Creating .gitignore"

cat > .gitignore << 'GITIGNORE'
# ── Secrets ────────────────────────────────────────────────────────────────
.env
*.env
!.env.example
secrets/
*.pem
*.key
*.p12
*.pfx

# ── C# / .NET ──────────────────────────────────────────────────────────────
bin/
obj/
*.user
*.suo
.vs/
*.DotSettings.user
TestResults/
*.trx
*.coverage
coverage/
*.nupkg
*.snupkg
.packages/
project.lock.json

# ── Python ─────────────────────────────────────────────────────────────────
__pycache__/
*.py[cod]
*.pyo
*.pyd
.Python
.venv/
venv/
env/
.env/
pip-wheel-metadata/
*.egg-info/
dist/
build/
.pytest_cache/
.mypy_cache/
.ruff_cache/
htmlcov/
.coverage
*.cover
.hypothesis/

# ── Node / React ───────────────────────────────────────────────────────────
node_modules/
dist/
build/
.next/
.nuxt/
.cache/
*.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
.pnpm-store/

# ── Docker ─────────────────────────────────────────────────────────────────
docker-compose.override.yml

# ── OS / Editor ────────────────────────────────────────────────────────────
.DS_Store
Thumbs.db
desktop.ini
.idea/
*.swp
*.swo
*~

# ── JetBrains ──────────────────────────────────────────────────────────────
.idea/
*.iml
GITIGNORE

info "  .gitignore written"

###############################################################################
# 3. C# solution + 9 ASP.NET Core services (Clean Architecture)
###############################################################################

section "3. Scaffolding C# solution"

CSHARP_SERVICES=(
  "api-gateway:ApiGateway"
  "auth-service:AuthService"
  "user-service:UserService"
  "music-service:MusicService"
  "streaming-service:StreamingService"
  "listening-party-service:ListeningPartyService"
  "analytics-service:AnalyticsService"
  "notification-service:NotificationService"
  "search-service:SearchService"
)

SOLUTION_FILE="SmartMusic.sln"

if [[ ! -f "$SOLUTION_FILE" ]]; then
  dotnet new sln -n SmartMusic --output .
  info "  Created $SOLUTION_FILE"
else
  info "  $SOLUTION_FILE already exists — skipping sln creation"
fi

scaffold_csharp_service() {
  local slug="$1"   # e.g. auth-service
  local name="$2"   # e.g. AuthService

  local svc_dir="services/$slug"
  mkdir -p "$svc_dir/src" "$svc_dir/tests"

  # ── 4 source projects ──────────────────────────────────────────────────
  local projects=("Api" "Application" "Infrastructure" "Domain")
  for layer in "${projects[@]}"; do
    local proj_name="${name}.${layer}"
    local proj_dir="$svc_dir/src/$proj_name"
    if [[ ! -d "$proj_dir" ]]; then
      if [[ "$layer" == "Api" ]]; then
        dotnet new webapi -n "$proj_name" --output "$proj_dir" \
          --use-controllers --no-openapi false --framework net8.0 \
          --no-restore 2>/dev/null
        # Remove default WeatherForecast files
        rm -f "$proj_dir/Controllers/WeatherForecastController.cs" \
              "$proj_dir/WeatherForecast.cs"
      elif [[ "$layer" == "Domain" ]]; then
        dotnet new classlib -n "$proj_name" --output "$proj_dir" \
          --framework net8.0 --no-restore 2>/dev/null
        rm -f "$proj_dir/Class1.cs"
      else
        dotnet new classlib -n "$proj_name" --output "$proj_dir" \
          --framework net8.0 --no-restore 2>/dev/null
        rm -f "$proj_dir/Class1.cs"
      fi
      info "    dotnet new → $proj_dir"
    else
      info "    skip (exists) → $proj_dir"
    fi
  done

  # ── 2 test projects ────────────────────────────────────────────────────
  local test_layers=("UnitTests" "IntegrationTests")
  for tl in "${test_layers[@]}"; do
    local test_name="${name}.${tl}"
    local test_dir="$svc_dir/tests/$test_name"
    if [[ ! -d "$test_dir" ]]; then
      dotnet new xunit -n "$test_name" --output "$test_dir" \
        --framework net8.0 --no-restore 2>/dev/null
      rm -f "$test_dir/UnitTest1.cs"
      info "    dotnet new xunit → $test_dir"
    else
      info "    skip (exists) → $test_dir"
    fi
  done

  # ── Project references (layer dependencies) ───────────────────────────
  local api_proj="$svc_dir/src/${name}.Api/${name}.Api.csproj"
  local app_proj="$svc_dir/src/${name}.Application/${name}.Application.csproj"
  local inf_proj="$svc_dir/src/${name}.Infrastructure/${name}.Infrastructure.csproj"
  local dom_proj="$svc_dir/src/${name}.Domain/${name}.Domain.csproj"
  local unit_proj="$svc_dir/tests/${name}.UnitTests/${name}.UnitTests.csproj"
  local int_proj="$svc_dir/tests/${name}.IntegrationTests/${name}.IntegrationTests.csproj"

  dotnet add "$api_proj" reference "$app_proj" "$inf_proj" 2>/dev/null || true
  dotnet add "$app_proj" reference "$dom_proj" 2>/dev/null || true
  dotnet add "$inf_proj" reference "$app_proj" 2>/dev/null || true
  dotnet add "$unit_proj" reference "$app_proj" "$dom_proj" 2>/dev/null || true
  dotnet add "$int_proj" reference "$api_proj" 2>/dev/null || true

  # ── Add common NuGet packages ─────────────────────────────────────────
  # Application layer
  dotnet add "$app_proj" package FluentValidation --no-restore 2>/dev/null || true

  # Infrastructure layer
  dotnet add "$inf_proj" package Microsoft.EntityFrameworkCore --no-restore 2>/dev/null || true
  dotnet add "$inf_proj" package StackExchange.Redis --no-restore 2>/dev/null || true
  dotnet add "$inf_proj" package Confluent.Kafka --no-restore 2>/dev/null || true

  # Test projects
  dotnet add "$unit_proj" package Moq --no-restore 2>/dev/null || true
  dotnet add "$unit_proj" package FluentAssertions --no-restore 2>/dev/null || true
  dotnet add "$int_proj" package Microsoft.AspNetCore.Mvc.Testing --no-restore 2>/dev/null || true
  dotnet add "$int_proj" package Testcontainers --no-restore 2>/dev/null || true
  dotnet add "$int_proj" package FluentAssertions --no-restore 2>/dev/null || true

  # ── Folder structure inside each layer ────────────────────────────────
  mkdir -p "$svc_dir/src/${name}.Api/Controllers"
  mkdir -p "$svc_dir/src/${name}.Api/Middleware"
  mkdir -p "$svc_dir/src/${name}.Api/Extensions"
  mkdir -p "$svc_dir/src/${name}.Application/Services"
  mkdir -p "$svc_dir/src/${name}.Application/DTOs"
  mkdir -p "$svc_dir/src/${name}.Application/Exceptions"
  mkdir -p "$svc_dir/src/${name}.Application/Interfaces"
  mkdir -p "$svc_dir/src/${name}.Infrastructure/Repositories"
  mkdir -p "$svc_dir/src/${name}.Infrastructure/Kafka"
  mkdir -p "$svc_dir/src/${name}.Infrastructure/Redis"
  mkdir -p "$svc_dir/src/${name}.Infrastructure/Data/Migrations"
  mkdir -p "$svc_dir/src/${name}.Domain/Models"

  # Keep-files so git tracks empty dirs
  touch "$svc_dir/src/${name}.Api/Controllers/.gitkeep"
  touch "$svc_dir/src/${name}.Application/Services/.gitkeep"
  touch "$svc_dir/src/${name}.Infrastructure/Repositories/.gitkeep"
  touch "$svc_dir/src/${name}.Domain/Models/.gitkeep"

  # ── Dockerfile ────────────────────────────────────────────────────────
  if [[ ! -f "$svc_dir/Dockerfile" ]]; then
    cat > "$svc_dir/Dockerfile" << DOCKERFILE
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/${name}.Api/${name}.Api.csproj", "src/${name}.Api/"]
COPY ["src/${name}.Application/${name}.Application.csproj", "src/${name}.Application/"]
COPY ["src/${name}.Infrastructure/${name}.Infrastructure.csproj", "src/${name}.Infrastructure/"]
COPY ["src/${name}.Domain/${name}.Domain.csproj", "src/${name}.Domain/"]
RUN dotnet restore "src/${name}.Api/${name}.Api.csproj"
COPY . .
RUN dotnet build "src/${name}.Api/${name}.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "src/${name}.Api/${name}.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "${name}.Api.dll"]
DOCKERFILE
    info "    Dockerfile → $svc_dir/Dockerfile"
  fi

  # ── Add all projects to solution ──────────────────────────────────────
  dotnet sln "$SOLUTION_FILE" add \
    "$svc_dir/src/${name}.Api/${name}.Api.csproj" \
    "$svc_dir/src/${name}.Application/${name}.Application.csproj" \
    "$svc_dir/src/${name}.Infrastructure/${name}.Infrastructure.csproj" \
    "$svc_dir/src/${name}.Domain/${name}.Domain.csproj" \
    "$svc_dir/tests/${name}.UnitTests/${name}.UnitTests.csproj" \
    "$svc_dir/tests/${name}.IntegrationTests/${name}.IntegrationTests.csproj" \
    2>/dev/null || true

  info "  ✓ $slug scaffolded"
}

for entry in "${CSHARP_SERVICES[@]}"; do
  slug="${entry%%:*}"
  name="${entry##*:}"
  section "  Scaffolding $slug"
  scaffold_csharp_service "$slug" "$name"
done

# api-gateway gets YARP
API_PROJ="services/api-gateway/src/ApiGateway.Api/ApiGateway.Api.csproj"
dotnet add "$API_PROJ" package Yarp.ReverseProxy --no-restore 2>/dev/null || true

# listening-party gets SignalR (already in ASP.NET Core — just mark it)
touch "services/listening-party-service/src/ListeningPartyService.Api/Hubs/.gitkeep"

###############################################################################
# 4. NuGet restore
###############################################################################

section "4. Restoring NuGet packages (this may take a while)"
dotnet restore SmartMusic.sln

###############################################################################
# 5. Python recommendation-service
###############################################################################

section "5. Scaffolding recommendation-service (Python / FastAPI)"

RECSVC="services/recommendation-service"
mkdir -p "$RECSVC/src/recommendation_service/"{api/routes,services,models,infrastructure/redis,kafka}
mkdir -p "$RECSVC/tests/unit" "$RECSVC/tests/integration"

# pyproject.toml
if [[ ! -f "$RECSVC/pyproject.toml" ]]; then
  cat > "$RECSVC/pyproject.toml" << 'PYPROJECT'
[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.backends.legacy:build"

[project]
name = "recommendation-service"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.111.0",
    "uvicorn[standard]>=0.30.0",
    "pydantic>=2.7.0",
    "pydantic-settings>=2.3.0",
    "redis[hiredis]>=5.0.0",
    "aiokafka>=0.11.0",
    "httpx>=0.27.0",
    "python-dotenv>=1.0.0",
]

[project.optional-dependencies]
test = [
    "pytest>=8.2.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.27.0",
    "respx>=0.21.0",
    "fakeredis[aioredis]>=2.23.0",
]
dev = [
    "ruff>=0.4.0",
    "mypy>=1.10.0",
]
PYPROJECT
  info "  pyproject.toml written"
fi

# requirements files (pin for reproducibility in Docker)
if [[ ! -f "$RECSVC/requirements.txt" ]]; then
  cat > "$RECSVC/requirements.txt" << 'REQS'
# Generated from pyproject.toml — keep in sync
fastapi>=0.111.0
uvicorn[standard]>=0.30.0
pydantic>=2.7.0
pydantic-settings>=2.3.0
redis[hiredis]>=5.0.0
aiokafka>=0.11.0
httpx>=0.27.0
python-dotenv>=1.0.0
REQS
fi

if [[ ! -f "$RECSVC/requirements-test.txt" ]]; then
  cat > "$RECSVC/requirements-test.txt" << 'REQS'
pytest>=8.2.0
pytest-asyncio>=0.23.0
httpx>=0.27.0
respx>=0.21.0
fakeredis[aioredis]>=2.23.0
REQS
fi

# pytest.ini
cat > "$RECSVC/pytest.ini" << 'PYTESTINI'
[pytest]
asyncio_mode = auto
testpaths = tests
PYTESTINI

# conftest.py
cat > "$RECSVC/tests/conftest.py" << 'CONFTEST'
import pytest
import fakeredis.aioredis


@pytest.fixture
async def fake_redis():
    server = fakeredis.aioredis.FakeRedis()
    yield server
    await server.aclose()
CONFTEST

# __init__ files
touch "$RECSVC/src/__init__.py"
touch "$RECSVC/src/recommendation_service/__init__.py"
touch "$RECSVC/src/recommendation_service/api/__init__.py"
touch "$RECSVC/src/recommendation_service/api/routes/__init__.py"
touch "$RECSVC/src/recommendation_service/services/__init__.py"
touch "$RECSVC/src/recommendation_service/models/__init__.py"
touch "$RECSVC/src/recommendation_service/infrastructure/__init__.py"
touch "$RECSVC/src/recommendation_service/infrastructure/redis/__init__.py"
touch "$RECSVC/src/recommendation_service/kafka/__init__.py"
touch "$RECSVC/tests/__init__.py"
touch "$RECSVC/tests/unit/__init__.py"
touch "$RECSVC/tests/integration/__init__.py"

# Minimal main.py
if [[ ! -f "$RECSVC/src/recommendation_service/main.py" ]]; then
  cat > "$RECSVC/src/recommendation_service/main.py" << 'MAIN'
from fastapi import FastAPI

app = FastAPI(title="Recommendation Service", version="0.1.0")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
MAIN
fi

# Dockerfile
if [[ ! -f "$RECSVC/Dockerfile" ]]; then
  cat > "$RECSVC/Dockerfile" << 'DOCKERFILE'
FROM python:3.11-slim AS base
WORKDIR /app

FROM base AS deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM deps AS final
COPY src/ ./src/
ENV PYTHONPATH=/app/src
EXPOSE 8000
CMD ["uvicorn", "recommendation_service.main:app", "--host", "0.0.0.0", "--port", "8000"]
DOCKERFILE
fi

# Virtual environment
if [[ ! -d "$RECSVC/.venv" ]]; then
  info "  Creating virtual environment at $RECSVC/.venv"
  python3 -m venv "$RECSVC/.venv"
  "$RECSVC/.venv/bin/pip" install --quiet --upgrade pip
  "$RECSVC/.venv/bin/pip" install --quiet -r "$RECSVC/requirements.txt" \
                                             -r "$RECSVC/requirements-test.txt"
  info "  ✓ Virtual environment ready"
else
  info "  .venv already exists — skipping"
fi

info "  ✓ recommendation-service scaffolded"

###############################################################################
# 6. React TypeScript frontend
###############################################################################

section "6. Scaffolding frontend (React TypeScript / Vite)"

FRONTEND="services/frontend"

if [[ ! -f "$FRONTEND/package.json" ]]; then
  info "  Running: npm create vite@latest frontend -- --template react-ts"
  # create in services/ then rename/move so it lands at services/frontend
  pushd services > /dev/null
  npm create vite@latest frontend -- --template react-ts --yes 2>/dev/null \
    || npx create-vite@latest frontend --template react-ts 2>/dev/null
  popd > /dev/null

  pushd "$FRONTEND" > /dev/null

  # Additional packages
  info "  Installing extra packages"
  npm install --save \
    react-router-dom \
    axios \
    @tanstack/react-query \
    zustand \
    2>/dev/null

  npm install --save-dev \
    @types/node \
    vitest \
    @vitest/ui \
    @testing-library/react \
    @testing-library/user-event \
    @testing-library/jest-dom \
    jsdom \
    2>/dev/null

  popd > /dev/null
  info "  ✓ Vite + React TS bootstrapped"
else
  info "  frontend/package.json already exists — skipping Vite scaffold"
fi

# Source structure
mkdir -p "$FRONTEND/src/"{api,assets,components/common,hooks,pages,store,types,utils}
touch "$FRONTEND/src/api/.gitkeep"
touch "$FRONTEND/src/components/common/.gitkeep"
touch "$FRONTEND/src/hooks/.gitkeep"
touch "$FRONTEND/src/pages/.gitkeep"
touch "$FRONTEND/src/store/.gitkeep"
touch "$FRONTEND/src/types/.gitkeep"

# Dockerfile
if [[ ! -f "$FRONTEND/Dockerfile" ]]; then
  cat > "$FRONTEND/Dockerfile" << 'DOCKERFILE'
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM nginx:alpine AS final
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
DOCKERFILE
fi

###############################################################################
# 7. infra — copy .env.example
###############################################################################

section "7. Environment files"

if [[ ! -f "infra/.env.example" ]]; then
  warn "  infra/.env.example not found — creating placeholder"
  touch "infra/.env.example"
fi

# Copy to repo root for convenience (docker-compose often reads from root)
if [[ ! -f ".env.example" ]]; then
  cp "infra/.env.example" ".env.example"
  info "  Copied infra/.env.example → .env.example"
fi

if [[ ! -f ".env" ]]; then
  cp "infra/.env.example" ".env"
  info "  Created .env from template — EDIT BEFORE USE"
  warn "  → Open .env and replace every 'changeme_local' value"
else
  info "  .env already exists — skipping"
fi

# Service-level .env.example stubs
for entry in "${CSHARP_SERVICES[@]}"; do
  slug="${entry%%:*}"
  stub="services/$slug/.env.example"
  if [[ ! -f "$stub" ]]; then
    echo "# Copy root .env.example — service-specific overrides go here" > "$stub"
  fi
done

if [[ ! -f "services/recommendation-service/.env.example" ]]; then
  echo "# Copy root .env.example — recommendation-service overrides" \
    > "services/recommendation-service/.env.example"
fi

###############################################################################
# 8. proto files placeholder
###############################################################################

section "8. Protobuf directory"
mkdir -p proto
for f in auth.proto user.proto; do
  [[ -f "proto/$f" ]] || touch "proto/$f"
done
info "  proto/ ready"

###############################################################################
# 9. Placeholder docs & contracts
###############################################################################

section "9. Placeholder docs & contracts"

PLACEHOLDER_FILES=(
  "docs/contracts/GRPC_CONTRACTS.md"
  "docs/contracts/KAFKA_EVENT_CONTRACTS.md"
  "docs/contracts/kafka-schemas/song_played.json"
  "docs/contracts/kafka-schemas/song_skipped.json"
  "docs/contracts/kafka-schemas/new_release.json"
  "docs/contracts/kafka-schemas/user_preferences_updated.json"
  "docs/contracts/kafka-schemas/notification_sent.json"
  "docs/testing/TEST_PLAN.md"
  "database/DATABASE_SCHEMA.md"
  ".github/REDIS_KEY_DESIGN.md"
  "conventions/CODING_CONVENTIONS.md"
  "conventions/GIT_WORKFLOW.md"
  "conventions/SECRETS_MANAGEMENT.md"
)

for f in "${PLACEHOLDER_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    mkdir -p "$(dirname "$f")"
    echo "# $(basename "$f") — TODO" > "$f"
    info "  placeholder → $f"
  fi
done

###############################################################################
# 10. GitHub Actions CI skeleton
###############################################################################

section "10. GitHub Actions CI"

mkdir -p .github/workflows

if [[ ! -f ".github/workflows/ci.yml" ]]; then
  cat > ".github/workflows/ci.yml" << 'CIyml'
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  dotnet-build-test:
    name: .NET build & test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: "8.0.x"
      - run: dotnet restore SmartMusic.sln
      - run: dotnet build SmartMusic.sln --no-restore -c Release
      - run: dotnet test SmartMusic.sln --no-build -c Release --logger trx

  python-test:
    name: Python test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/recommendation-service
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r requirements.txt -r requirements-test.txt
      - run: pytest --tb=short

  frontend-build:
    name: Frontend build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: services/frontend/package-lock.json
      - run: npm ci
      - run: npm run build
CITML
  info "  .github/workflows/ci.yml written"
fi

###############################################################################
# 11. README.md
###############################################################################

section "11. README.md"

if [[ ! -f "README.md" ]] || [[ ! -s "README.md" ]]; then
  cat > "README.md" << 'README'
# Smart Music Streaming Platform

Nền tảng nghe nhạc trực tuyến kiến trúc Microservices — Đồ án Seminar.

## Services

| Service | Port | Tech |
|---|---|---|
| api-gateway | 5000 | ASP.NET Core + YARP |
| auth-service | 5001 | ASP.NET Core Identity |
| user-service | 5002 | ASP.NET Core + EF Core |
| music-service | 5003 | ASP.NET Core + AWS SDK |
| streaming-service | 5004 | ASP.NET Core |
| listening-party-service | 5005 | ASP.NET Core + SignalR |
| analytics-service | 5006 | ASP.NET Core |
| notification-service | 5007 | ASP.NET Core |
| search-service | 5008 | ASP.NET Core |
| recommendation-service | 5009 | Python + FastAPI |
| frontend | 3000 | React + TypeScript |

## Prerequisites

| Tool | Version |
|---|---|
| Docker Desktop | 4.x (WSL 2 backend on Windows) |
| .NET SDK | 8.0 |
| Node.js | 20 LTS |
| Python | 3.11+ |

## First-time setup

```bash
# 1. Clone
git clone <repo-url>
cd Seminar-Project

# 2. Run setup script (first time only)
bash setup-repo.sh

# 3. Edit secrets
#    Open .env and replace every 'changeme_local' value

# 4. Start infrastructure + all services
docker-compose -f infra/docker-compose.yml up -d

# 5. Create MinIO bucket (run once after first docker-compose up)
docker exec smartmusic-minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec smartmusic-minio mc mb local/smartmusic-audio

# 6. Run EF Core migrations
dotnet ef database update --project services/auth-service/src/AuthService.Api
dotnet ef database update --project services/user-service/src/UserService.Api
dotnet ef database update --project services/music-service/src/MusicService.Api
dotnet ef database update --project services/streaming-service/src/StreamingService.Api
dotnet ef database update --project services/listening-party-service/src/ListeningPartyService.Api
dotnet ef database update --project services/analytics-service/src/AnalyticsService.Api
dotnet ef database update --project services/notification-service/src/NotificationService.Api
```

## Running services natively (for development)

Start only infrastructure:

```bash
docker-compose -f infra/docker-compose.yml up -d postgres mongodb redis elasticsearch zookeeper kafka influxdb minio
```

Then run individual services:

```bash
# C# service
dotnet run --project services/auth-service/src/AuthService.Api

# Python recommendation-service
cd services/recommendation-service
source .venv/bin/activate   # Windows: .venv\Scripts\activate
uvicorn src.recommendation_service.main:app --reload --port 5009

# Frontend
cd services/frontend
npm run dev
```

## Running tests

```bash
# All .NET tests
dotnet test SmartMusic.sln

# Python tests
cd services/recommendation-service
source .venv/bin/activate
pytest

# Frontend tests
cd services/frontend
npm test
```

## Docs

- Architecture: `docs/architecture/`
- API contract: `docs/originals/API_DESIGN_V2.md`
- Database schema: `database/DATABASE_SCHEMA.md`
- Redis key design: `.github/REDIS_KEY_DESIGN.md`
- Kafka contracts: `docs/contracts/KAFKA_EVENT_CONTRACTS.md`
- Docker guide: `infra/DOCKER_README.md`
- Git workflow: `conventions/GIT_WORKFLOW.md`
README
  info "  README.md written"
fi

###############################################################################
# Done
###############################################################################

section "Setup complete"
echo ""
echo -e "  ${GREEN}Next steps:${NC}"
echo "  1. Open .env and replace every 'changeme_local' with real local values"
echo "  2. docker-compose -f infra/docker-compose.yml up -d"
echo "  3. Run EF Core migrations (see README.md)"
echo "  4. Happy coding!"
echo ""
echo -e "  ${YELLOW}NEVER commit .env — it is in .gitignore${NC}"
echo ""
