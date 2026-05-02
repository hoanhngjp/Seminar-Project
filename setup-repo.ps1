#Requires -Version 5.1
<#
.SYNOPSIS  Smart Music Streaming Platform - repo scaffold script (Windows PowerShell)
.DESCRIPTION
    Khoi tao folder structure, C# solution, Python venv, React frontend.
    Chay mot lan tu repo root sau khi clone.
.EXAMPLE  .\setup-repo.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Info($msg)    { Write-Host "[INFO]  $msg" -ForegroundColor Green }
function Warn($msg)    { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Err($msg)     { Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Section($msg) {
    Write-Host ""
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Cyan
}

function Require-Tool($cmd, $hint) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Err "'$cmd' not found. $hint"
        exit 1
    }
}

function New-Dirs([string[]]$dirs) {
    foreach ($d in $dirs) {
        if (-not (Test-Path $d)) {
            New-Item -ItemType Directory -Path $d -Force | Out-Null
            Info "  mkdir $d"
        }
    }
}

function Touch($path) {
    $dir = Split-Path $path -Parent
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    if (-not (Test-Path $path)) {
        New-Item -ItemType File -Path $path -Force | Out-Null
    }
}

# Write lines to file only if file does not exist yet.
function Write-Lines($path, [string[]]$lines) {
    if (-not (Test-Path $path)) {
        $dir = Split-Path $path -Parent
        if ($dir -and -not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        $lines | Set-Content $path -Encoding utf8
        Info "  wrote $path"
    } else {
        Info "  skip (exists) $path"
    }
}

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------

Section "Pre-flight checks"

Require-Tool "dotnet" "Install .NET SDK 8.0 from https://dotnet.microsoft.com/download"
Require-Tool "node"   "Install Node.js 20 LTS from https://nodejs.org"
Require-Tool "npm"    "Comes with Node.js"
Require-Tool "git"    "Install Git from https://git-scm.com"

# Accept both 'python' and 'python3'
$PYTHON = $null
foreach ($py in @("python", "python3")) {
    if (Get-Command $py -ErrorAction SilentlyContinue) { $PYTHON = $py; break }
}
if (-not $PYTHON) {
    Err "python / python3 not found. Install Python 3.11+ from https://python.org"
    exit 1
}

$dotnetMajor = [int]((dotnet --version).Split(".")[0])
if ($dotnetMajor -lt 8) {
    Err ".NET SDK 8.0+ required (found $(dotnet --version))"
    exit 1
}

$REPO_ROOT = $PSScriptRoot
Info "Repo root: $REPO_ROOT"
Set-Location $REPO_ROOT

# ---------------------------------------------------------------------------
# 1. Top-level directory skeleton
# ---------------------------------------------------------------------------

Section "1. Top-level directories"

New-Dirs @(
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
    ".github/workflows"
)

# ---------------------------------------------------------------------------
# 2. .gitignore
# ---------------------------------------------------------------------------

Section "2. .gitignore"

Write-Lines ".gitignore" @(
    "# Secrets"
    ".env"
    "*.env"
    "!.env.example"
    "secrets/"
    "*.pem"
    "*.key"
    "*.p12"
    "*.pfx"
    ""
    "# C# / .NET"
    "bin/"
    "obj/"
    "*.user"
    "*.suo"
    ".vs/"
    "*.DotSettings.user"
    "TestResults/"
    "*.trx"
    "*.coverage"
    "coverage/"
    "*.nupkg"
    "*.snupkg"
    ".packages/"
    "project.lock.json"
    ""
    "# Python"
    "__pycache__/"
    "*.py[cod]"
    "*.pyo"
    "*.pyd"
    ".Python"
    ".venv/"
    "venv/"
    "env/"
    "pip-wheel-metadata/"
    "*.egg-info/"
    "dist/"
    "build/"
    ".pytest_cache/"
    ".mypy_cache/"
    ".ruff_cache/"
    "htmlcov/"
    ".coverage"
    "*.cover"
    ".hypothesis/"
    ""
    "# Node / React"
    "node_modules/"
    "dist/"
    "build/"
    ".next/"
    ".cache/"
    "*.local"
    "npm-debug.log*"
    "yarn-error.log*"
    ""
    "# Docker"
    "docker-compose.override.yml"
    ""
    "# OS / Editor"
    ".DS_Store"
    "Thumbs.db"
    "desktop.ini"
    ".idea/"
    "*.swp"
    "*~"
)

# ---------------------------------------------------------------------------
# 3. C# solution + 9 ASP.NET Core services (Clean Architecture)
# ---------------------------------------------------------------------------

Section "3. C# solution scaffold"

$CSHARP_SERVICES = @(
    @{ Slug = "api-gateway";             Name = "ApiGateway" }
    @{ Slug = "auth-service";            Name = "AuthService" }
    @{ Slug = "user-service";            Name = "UserService" }
    @{ Slug = "music-service";           Name = "MusicService" }
    @{ Slug = "streaming-service";       Name = "StreamingService" }
    @{ Slug = "listening-party-service"; Name = "ListeningPartyService" }
    @{ Slug = "analytics-service";       Name = "AnalyticsService" }
    @{ Slug = "notification-service";    Name = "NotificationService" }
    @{ Slug = "search-service";          Name = "SearchService" }
)

$SLN = "SmartMusic.sln"
if (-not (Test-Path $SLN)) {
    dotnet new sln -n SmartMusic --output . | Out-Null
    Info "  Created $SLN"
} else {
    Info "  $SLN already exists -- skipping"
}

function Scaffold-CSharpService($slug, $name) {
    $svcDir = "services/$slug"
    New-Dirs @("$svcDir/src", "$svcDir/tests")

    # 4 source projects
    foreach ($layer in @("Api", "Application", "Infrastructure", "Domain")) {
        $projName = "${name}.${layer}"
        $projDir  = "$svcDir/src/$projName"
        if (-not (Test-Path $projDir)) {
            if ($layer -eq "Api") {
                dotnet new webapi -n $projName --output $projDir `
                    --use-controllers --framework net8.0 --no-restore 2>$null | Out-Null
                Remove-Item "$projDir/Controllers/WeatherForecastController.cs" -EA SilentlyContinue
                Remove-Item "$projDir/WeatherForecast.cs" -EA SilentlyContinue
            } else {
                dotnet new classlib -n $projName --output $projDir `
                    --framework net8.0 --no-restore 2>$null | Out-Null
                Remove-Item "$projDir/Class1.cs" -EA SilentlyContinue
            }
            Info "    created $projDir"
        } else {
            Info "    skip (exists) $projDir"
        }
    }

    # 2 test projects
    foreach ($tl in @("UnitTests", "IntegrationTests")) {
        $testName = "${name}.${tl}"
        $testDir  = "$svcDir/tests/$testName"
        if (-not (Test-Path $testDir)) {
            dotnet new xunit -n $testName --output $testDir `
                --framework net8.0 --no-restore 2>$null | Out-Null
            Remove-Item "$testDir/UnitTest1.cs" -EA SilentlyContinue
            Info "    created $testDir"
        } else {
            Info "    skip (exists) $testDir"
        }
    }

    # Project references
    $apiProj  = "$svcDir/src/${name}.Api/${name}.Api.csproj"
    $appProj  = "$svcDir/src/${name}.Application/${name}.Application.csproj"
    $infProj  = "$svcDir/src/${name}.Infrastructure/${name}.Infrastructure.csproj"
    $domProj  = "$svcDir/src/${name}.Domain/${name}.Domain.csproj"
    $unitProj = "$svcDir/tests/${name}.UnitTests/${name}.UnitTests.csproj"
    $intProj  = "$svcDir/tests/${name}.IntegrationTests/${name}.IntegrationTests.csproj"

    dotnet add $apiProj  reference $appProj $infProj 2>$null | Out-Null
    dotnet add $appProj  reference $domProj           2>$null | Out-Null
    dotnet add $infProj  reference $appProj           2>$null | Out-Null
    dotnet add $unitProj reference $appProj $domProj 2>$null | Out-Null
    dotnet add $intProj  reference $apiProj           2>$null | Out-Null

    # NuGet packages
    dotnet add $appProj  package FluentValidation                 --no-restore 2>$null | Out-Null
    dotnet add $infProj  package Microsoft.EntityFrameworkCore    --no-restore 2>$null | Out-Null
    dotnet add $infProj  package StackExchange.Redis              --no-restore 2>$null | Out-Null
    dotnet add $infProj  package Confluent.Kafka                  --no-restore 2>$null | Out-Null
    dotnet add $unitProj package Moq                              --no-restore 2>$null | Out-Null
    dotnet add $unitProj package FluentAssertions                 --no-restore 2>$null | Out-Null
    dotnet add $intProj  package Microsoft.AspNetCore.Mvc.Testing --no-restore 2>$null | Out-Null
    dotnet add $intProj  package Testcontainers                   --no-restore 2>$null | Out-Null
    dotnet add $intProj  package FluentAssertions                 --no-restore 2>$null | Out-Null

    # Folder structure
    New-Dirs @(
        "$svcDir/src/${name}.Api/Controllers"
        "$svcDir/src/${name}.Api/Middleware"
        "$svcDir/src/${name}.Api/Extensions"
        "$svcDir/src/${name}.Application/Services"
        "$svcDir/src/${name}.Application/DTOs"
        "$svcDir/src/${name}.Application/Exceptions"
        "$svcDir/src/${name}.Application/Interfaces"
        "$svcDir/src/${name}.Infrastructure/Repositories"
        "$svcDir/src/${name}.Infrastructure/Kafka"
        "$svcDir/src/${name}.Infrastructure/Redis"
        "$svcDir/src/${name}.Infrastructure/Data/Migrations"
        "$svcDir/src/${name}.Domain/Models"
    )
    Touch "$svcDir/src/${name}.Api/Controllers/.gitkeep"
    Touch "$svcDir/src/${name}.Application/Services/.gitkeep"
    Touch "$svcDir/src/${name}.Infrastructure/Repositories/.gitkeep"
    Touch "$svcDir/src/${name}.Domain/Models/.gitkeep"

    # Dockerfile
    Write-Lines "$svcDir/Dockerfile" @(
        "FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base"
        "WORKDIR /app"
        "EXPOSE 80"
        ""
        "FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build"
        "WORKDIR /src"
        "COPY [""src/${name}.Api/${name}.Api.csproj"", ""src/${name}.Api/""]"
        "COPY [""src/${name}.Application/${name}.Application.csproj"", ""src/${name}.Application/""]"
        "COPY [""src/${name}.Infrastructure/${name}.Infrastructure.csproj"", ""src/${name}.Infrastructure/""]"
        "COPY [""src/${name}.Domain/${name}.Domain.csproj"", ""src/${name}.Domain/""]"
        "RUN dotnet restore ""src/${name}.Api/${name}.Api.csproj"""
        "COPY . ."
        "RUN dotnet build ""src/${name}.Api/${name}.Api.csproj"" -c Release -o /app/build"
        ""
        "FROM build AS publish"
        "RUN dotnet publish ""src/${name}.Api/${name}.Api.csproj"" -c Release -o /app/publish"
        ""
        "FROM base AS final"
        "WORKDIR /app"
        "COPY --from=publish /app/publish ."
        "ENTRYPOINT [""dotnet"", ""${name}.Api.dll""]"
    )

    # Add all projects to solution
    foreach ($p in @($apiProj, $appProj, $infProj, $domProj, $unitProj, $intProj)) {
        dotnet sln $SLN add $p 2>$null | Out-Null
    }

    Info "  done: $slug"
}

foreach ($svc in $CSHARP_SERVICES) {
    Section "  Scaffold $($svc.Slug)"
    Scaffold-CSharpService $svc.Slug $svc.Name
}

# api-gateway: YARP
dotnet add "services/api-gateway/src/ApiGateway.Api/ApiGateway.Api.csproj" `
    package Yarp.ReverseProxy --no-restore 2>$null | Out-Null
Info "  Added YARP to api-gateway"

# listening-party: SignalR Hubs folder
Touch "services/listening-party-service/src/ListeningPartyService.Api/Hubs/.gitkeep"

# ---------------------------------------------------------------------------
# 4. NuGet restore
# ---------------------------------------------------------------------------

Section "4. NuGet restore (may take a while)"
dotnet restore SmartMusic.sln
Info "  NuGet restore done"

# ---------------------------------------------------------------------------
# 5. Python recommendation-service
# ---------------------------------------------------------------------------

Section "5. Python recommendation-service"

$RECSVC = "services/recommendation-service"
New-Dirs @(
    "$RECSVC/src/recommendation_service/api/routes"
    "$RECSVC/src/recommendation_service/services"
    "$RECSVC/src/recommendation_service/models"
    "$RECSVC/src/recommendation_service/infrastructure/redis"
    "$RECSVC/src/recommendation_service/kafka"
    "$RECSVC/tests/unit"
    "$RECSVC/tests/integration"
)

Write-Lines "$RECSVC/pyproject.toml" @(
    "[build-system]"
    "requires = [""setuptools>=68"", ""wheel""]"
    "build-backend = ""setuptools.backends.legacy:build"""
    ""
    "[project]"
    "name = ""recommendation-service"""
    "version = ""0.1.0"""
    "requires-python = "">=3.11"""
    "dependencies = ["
    "    ""fastapi>=0.111.0"","
    "    ""uvicorn[standard]>=0.30.0"","
    "    ""pydantic>=2.7.0"","
    "    ""pydantic-settings>=2.3.0"","
    "    ""redis[hiredis]>=5.0.0"","
    "    ""aiokafka>=0.11.0"","
    "    ""httpx>=0.27.0"","
    "    ""python-dotenv>=1.0.0"","
    "]"
    ""
    "[project.optional-dependencies]"
    "test = ["
    "    ""pytest>=8.2.0"","
    "    ""pytest-asyncio>=0.23.0"","
    "    ""httpx>=0.27.0"","
    "    ""respx>=0.21.0"","
    "    ""fakeredis[aioredis]>=2.23.0"","
    "]"
    "dev = ["
    "    ""ruff>=0.4.0"","
    "    ""mypy>=1.10.0"","
    "]"
)

Write-Lines "$RECSVC/requirements.txt" @(
    "fastapi>=0.111.0"
    "uvicorn[standard]>=0.30.0"
    "pydantic>=2.7.0"
    "pydantic-settings>=2.3.0"
    "redis[hiredis]>=5.0.0"
    "aiokafka>=0.11.0"
    "httpx>=0.27.0"
    "python-dotenv>=1.0.0"
)

Write-Lines "$RECSVC/requirements-test.txt" @(
    "pytest>=8.2.0"
    "pytest-asyncio>=0.23.0"
    "httpx>=0.27.0"
    "respx>=0.21.0"
    "fakeredis[aioredis]>=2.23.0"
)

Write-Lines "$RECSVC/pytest.ini" @(
    "[pytest]"
    "asyncio_mode = auto"
    "testpaths = tests"
)

Write-Lines "$RECSVC/tests/conftest.py" @(
    "import pytest"
    "import fakeredis.aioredis"
    ""
    ""
    "@pytest.fixture"
    "async def fake_redis():"
    "    server = fakeredis.aioredis.FakeRedis()"
    "    yield server"
    "    await server.aclose()"
)

foreach ($f in @(
    "$RECSVC/src/__init__.py"
    "$RECSVC/src/recommendation_service/__init__.py"
    "$RECSVC/src/recommendation_service/api/__init__.py"
    "$RECSVC/src/recommendation_service/api/routes/__init__.py"
    "$RECSVC/src/recommendation_service/services/__init__.py"
    "$RECSVC/src/recommendation_service/models/__init__.py"
    "$RECSVC/src/recommendation_service/infrastructure/__init__.py"
    "$RECSVC/src/recommendation_service/infrastructure/redis/__init__.py"
    "$RECSVC/src/recommendation_service/kafka/__init__.py"
    "$RECSVC/tests/__init__.py"
    "$RECSVC/tests/unit/__init__.py"
    "$RECSVC/tests/integration/__init__.py"
)) { Touch $f }

Write-Lines "$RECSVC/src/recommendation_service/main.py" @(
    "from fastapi import FastAPI"
    ""
    "app = FastAPI(title=""Recommendation Service"", version=""0.1.0"")"
    ""
    ""
    "@app.get(""/health"")"
    "async def health() -> dict:"
    "    return {""status"": ""ok""}"
)

Write-Lines "$RECSVC/Dockerfile" @(
    "FROM python:3.11-slim AS base"
    "WORKDIR /app"
    ""
    "FROM base AS deps"
    "COPY requirements.txt ."
    "RUN pip install --no-cache-dir -r requirements.txt"
    ""
    "FROM deps AS final"
    "COPY src/ ./src/"
    "ENV PYTHONPATH=/app/src"
    "EXPOSE 8000"
    "CMD [""uvicorn"", ""recommendation_service.main:app"", ""--host"", ""0.0.0.0"", ""--port"", ""8000""]"
)

# Virtual environment
$venvPath = "$RECSVC/.venv"
if (-not (Test-Path $venvPath)) {
    Info "  Creating .venv"
    & $PYTHON -m venv $venvPath
    $pip = "$venvPath/Scripts/pip.exe"
    & $pip install --quiet --upgrade pip
    & $pip install --quiet -r "$RECSVC/requirements.txt" -r "$RECSVC/requirements-test.txt"
    Info "  .venv ready"
} else {
    Info "  .venv already exists -- skipping"
}

# ---------------------------------------------------------------------------
# 6. React TypeScript frontend (Vite)
# ---------------------------------------------------------------------------

Section "6. Frontend (React + TypeScript + Vite)"

$FRONTEND = "services/frontend"

if (-not (Test-Path "$FRONTEND/package.json")) {
    Info "  npm create vite@latest"
    Push-Location "services"
    npm create vite@latest frontend -- --template react-ts
    Pop-Location

    Push-Location $FRONTEND
    npm install --save react-router-dom axios "@tanstack/react-query" zustand
    npm install --save-dev "@types/node" vitest "@vitest/ui" "@testing-library/react" "@testing-library/user-event" "@testing-library/jest-dom" jsdom
    Pop-Location
    Info "  Vite + React TS done"
} else {
    Info "  frontend/package.json exists -- skipping"
}

New-Dirs @(
    "$FRONTEND/src/api"
    "$FRONTEND/src/assets"
    "$FRONTEND/src/components/common"
    "$FRONTEND/src/hooks"
    "$FRONTEND/src/pages"
    "$FRONTEND/src/store"
    "$FRONTEND/src/types"
    "$FRONTEND/src/utils"
)
Touch "$FRONTEND/src/api/.gitkeep"
Touch "$FRONTEND/src/components/common/.gitkeep"
Touch "$FRONTEND/src/hooks/.gitkeep"
Touch "$FRONTEND/src/pages/.gitkeep"
Touch "$FRONTEND/src/store/.gitkeep"
Touch "$FRONTEND/src/types/.gitkeep"

Write-Lines "$FRONTEND/Dockerfile" @(
    "FROM node:20-alpine AS deps"
    "WORKDIR /app"
    "COPY package*.json ./"
    "RUN npm ci"
    ""
    "FROM deps AS build"
    "COPY . ."
    "RUN npm run build"
    ""
    "FROM nginx:alpine AS final"
    "COPY --from=build /app/dist /usr/share/nginx/html"
    "EXPOSE 80"
    "CMD [""nginx"", ""-g"", ""daemon off;""]"
)

# ---------------------------------------------------------------------------
# 7. Environment files
# ---------------------------------------------------------------------------

Section "7. Environment files"

if (Test-Path "infra/.env.example") {
    if (-not (Test-Path ".env.example")) {
        Copy-Item "infra/.env.example" ".env.example"
        Info "  Copied infra/.env.example -> .env.example"
    }
    if (-not (Test-Path ".env")) {
        Copy-Item "infra/.env.example" ".env"
        Info "  Created .env from template"
        Warn "  Open .env and replace every changeme_local value before docker-compose"
    } else {
        Info "  .env already exists -- skipping"
    }
} else {
    Warn "  infra/.env.example not found -- skipping .env creation"
}

foreach ($svc in $CSHARP_SERVICES) {
    $stub = "services/$($svc.Slug)/.env.example"
    if (-not (Test-Path $stub)) {
        Set-Content $stub "# Copy root .env.example -- service-specific overrides go here" -Encoding utf8
    }
}
if (-not (Test-Path "$RECSVC/.env.example")) {
    Set-Content "$RECSVC/.env.example" "# Copy root .env.example -- recommendation-service overrides" -Encoding utf8
}

# ---------------------------------------------------------------------------
# 8. Placeholder docs and contracts
# ---------------------------------------------------------------------------

Section "8. Placeholder docs and contracts"

foreach ($f in @(
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
)) {
    if (-not (Test-Path $f)) {
        $dir = Split-Path $f -Parent
        if ($dir) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        Set-Content $f "# $(Split-Path $f -Leaf) -- TODO" -Encoding utf8
        Info "  placeholder -> $f"
    }
}

# ---------------------------------------------------------------------------
# 9. GitHub Actions CI
# ---------------------------------------------------------------------------

Section "9. GitHub Actions CI"

Write-Lines ".github/workflows/ci.yml" @(
    "name: CI"
    ""
    "on:"
    "  push:"
    "    branches: [main, develop]"
    "  pull_request:"
    "    branches: [main, develop]"
    ""
    "jobs:"
    "  dotnet-build-test:"
    "    name: dotnet build and test"
    "    runs-on: ubuntu-latest"
    "    steps:"
    "      - uses: actions/checkout@v4"
    "      - uses: actions/setup-dotnet@v4"
    "        with:"
    "          dotnet-version: '8.0.x'"
    "      - run: dotnet restore SmartMusic.sln"
    "      - run: dotnet build SmartMusic.sln --no-restore -c Release"
    "      - run: dotnet test SmartMusic.sln --no-build -c Release --logger trx"
    ""
    "  python-test:"
    "    name: python test"
    "    runs-on: ubuntu-latest"
    "    defaults:"
    "      run:"
    "        working-directory: services/recommendation-service"
    "    steps:"
    "      - uses: actions/checkout@v4"
    "      - uses: actions/setup-python@v5"
    "        with:"
    "          python-version: '3.11'"
    "      - run: pip install -r requirements.txt -r requirements-test.txt"
    "      - run: pytest --tb=short"
    ""
    "  frontend-build:"
    "    name: frontend build"
    "    runs-on: ubuntu-latest"
    "    defaults:"
    "      run:"
    "        working-directory: services/frontend"
    "    steps:"
    "      - uses: actions/checkout@v4"
    "      - uses: actions/setup-node@v4"
    "        with:"
    "          node-version: '20'"
    "          cache: npm"
    "          cache-dependency-path: services/frontend/package-lock.json"
    "      - run: npm ci"
    "      - run: npm run build"
)

# ---------------------------------------------------------------------------
# 10. README
# ---------------------------------------------------------------------------

Section "10. README.md"

if (-not (Test-Path "README.md") -or (Get-Item "README.md").Length -eq 0) {
    Write-Lines "README.md" @(
        "# Smart Music Streaming Platform"
        ""
        "Nen tang nghe nhac truc tuyen kien truc Microservices -- Do an Seminar."
        ""
        "## Services"
        ""
        "| Service                 | Port | Tech                        |"
        "|-------------------------|------|-----------------------------|"
        "| api-gateway             | 5000 | ASP.NET Core + YARP         |"
        "| auth-service            | 5001 | ASP.NET Core Identity       |"
        "| user-service            | 5002 | ASP.NET Core + EF Core      |"
        "| music-service           | 5003 | ASP.NET Core + AWS SDK      |"
        "| streaming-service       | 5004 | ASP.NET Core                |"
        "| listening-party-service | 5005 | ASP.NET Core + SignalR      |"
        "| analytics-service       | 5006 | ASP.NET Core                |"
        "| notification-service    | 5007 | ASP.NET Core                |"
        "| search-service          | 5008 | ASP.NET Core                |"
        "| recommendation-service  | 5009 | Python + FastAPI            |"
        "| frontend                | 3000 | React + TypeScript          |"
        ""
        "## Prerequisites"
        ""
        "| Tool           | Version                       |"
        "|----------------|-------------------------------|"
        "| Docker Desktop | 4.x (WSL 2 on Windows)        |"
        "| .NET SDK       | 8.0                           |"
        "| Node.js        | 20 LTS                        |"
        "| Python         | 3.11+                         |"
        ""
        "## First-time setup"
        ""
        "    # 1. Clone"
        "    git clone <repo-url>"
        "    cd Seminar-Project"
        ""
        "    # 2. Run setup script (first time only)"
        "    .\setup-repo.ps1"
        ""
        "    # 3. Edit .env -- replace every changeme_local value"
        ""
        "    # 4. Start everything"
        "    docker-compose -f infra/docker-compose.yml up -d"
        ""
        "    # 5. Create MinIO bucket (once)"
        "    docker exec smartmusic-minio mc alias set local http://localhost:9000 minioadmin minioadmin"
        "    docker exec smartmusic-minio mc mb local/smartmusic-audio"
        ""
        "    # 6. EF Core migrations"
        "    dotnet ef database update --project services/auth-service/src/AuthService.Api"
        "    dotnet ef database update --project services/user-service/src/UserService.Api"
        "    dotnet ef database update --project services/music-service/src/MusicService.Api"
        "    dotnet ef database update --project services/streaming-service/src/StreamingService.Api"
        "    dotnet ef database update --project services/listening-party-service/src/ListeningPartyService.Api"
        "    dotnet ef database update --project services/analytics-service/src/AnalyticsService.Api"
        "    dotnet ef database update --project services/notification-service/src/NotificationService.Api"
        ""
        "## Running natively (dev)"
        ""
        "    # Infrastructure only"
        "    docker-compose -f infra/docker-compose.yml up -d postgres mongodb redis elasticsearch zookeeper kafka influxdb minio"
        ""
        "    # C# service"
        "    dotnet run --project services/auth-service/src/AuthService.Api"
        ""
        "    # Python service"
        "    cd services/recommendation-service"
        "    .venv\Scripts\Activate.ps1"
        "    uvicorn src.recommendation_service.main:app --reload --port 5009"
        ""
        "    # Frontend"
        "    cd services/frontend"
        "    npm run dev"
        ""
        "## Running tests"
        ""
        "    dotnet test SmartMusic.sln"
        "    cd services/recommendation-service; pytest"
        "    cd services/frontend; npm test"
        ""
        "## Docs"
        ""
        "- Architecture  : docs/architecture/"
        "- API contract  : docs/originals/API_DESIGN_V2.md"
        "- DB schema     : database/DATABASE_SCHEMA.md"
        "- Redis keys    : .github/REDIS_KEY_DESIGN.md"
        "- Kafka events  : docs/contracts/KAFKA_EVENT_CONTRACTS.md"
        "- Docker guide  : infra/DOCKER_README.md"
        "- Git workflow  : conventions/GIT_WORKFLOW.md"
    )
}

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

Section "Setup complete"
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Green
Write-Host "  1. Open .env and replace every changeme_local value"
Write-Host "  2. docker-compose -f infra/docker-compose.yml up -d"
Write-Host "  3. Run EF Core migrations (see README.md)"
Write-Host "  4. Happy coding!"
Write-Host ""
Write-Host "  NEVER commit .env -- it is in .gitignore" -ForegroundColor Yellow
Write-Host ""