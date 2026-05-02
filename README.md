# Smart Music Streaming Platform

Nền tảng nghe nhạc trực tuyến kiến trúc Microservices - Đồ án Seminar (nhóm 3-4 người, 1 học kỳ).

Ba bài toán cốt lỗi **Filter Bubble** -> Rule Engine; **Weak Social** -> Realtime Listening Party; **Lack of Creator Insights** -> Analytics Dashboard.

---

## Services

| Service                 | Port | Tech                                        |
| ----------------------- | ---- | ------------------------------------------- |
| api-gateway             | 5000 | ASP.NET Core + YARP                         |
| auth-service            | 5001 | ASP.NET Core Identity + PostgreSQL          |
| user-service            | 5002 | ASP.NET Core + EF Core + PostgreSQL         |
| music-service           | 5003 | ASP.NET Core + AWS SDK + PostgreSQL/MongoDB |
| streaming-service       | 5004 | ASP.NET Core + S3 + CDN                     |
| listening-party-service | 5005 | ASP.NET Core + SignalR + Redis              |
| analytics-service       | 5006 | ASP.NET Core + InfluxDB/MongoDB             |
| notification-service    | 5007 | ASP.NET Core + MongoDB                      |
| search-service          | 5008 | ASP.NET Core + Elasticsearch                |
| recommendation-service  | 5009 | Python + FastAPI + Redis                    |
| frontend                | 3000 | React + TypeScript + Vite                   |

---

## Prerequisites

| Tool           | Version | Notes                           |
| -------------- | ------- | ------------------------------- |
| Docker Desktop | 4.x     | Enable WSL 2 backend on Windows |
| .NET SDK       | 8.0     | `dotnet --version`            |
| Node.js        | 20 LTS  | `node --version`              |
| Python         | 3.11+   | `python --version`            |
| Git            | any     | `git --version`               |

---

## First-time setup

```powershell
# 1. Clone
git clone <repo-url>
cd Seminar-Project

# 2. Scaffold toan bo repo (chi chay mot lan)
.\setup-repo.ps1

# 3. Sua secrets - bat buoc truoc khi chay docker-compose
#    Mo .env, thay moi gia tri changeme_local
notepad infra/.env

# 4. Khoi dong toan bo infrastructure + services
docker-compose -f infra/docker-compose.yml up -d

# 5. Kiem tra infrastructure healthy (doi ~30s de services start)
bash infra/verify-infra.sh

# 6. Tao MinIO bucket (chay mot lan sau khi docker-compose up lan dau)
docker exec smartmusic-minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec smartmusic-minio mc mb local/smartmusic-audio

# 7. Chay EF Core migrations
dotnet ef database update --project services/auth-service/src/AuthService.Api
dotnet ef database update --project services/user-service/src/UserService.Api
dotnet ef database update --project services/music-service/src/MusicService.Api
dotnet ef database update --project services/streaming-service/src/StreamingService.Api
dotnet ef database update --project services/listening-party-service/src/ListeningPartyService.Api
dotnet ef database update --project services/analytics-service/src/AnalyticsService.Api
dotnet ef database update --project services/notification-service/src/NotificationService.Api
```

---

## Chạy từng service natively (cho development)

Khoi dong chi infrastructure:

```powershell
docker-compose -f infra/docker-compose.yml up -d `
  postgres mongodb redis elasticsearch zookeeper kafka influxdb minio
```

Chay service:

```powershell
# C# service
dotnet run --project services/auth-service/src/AuthService.Api

# Python recommendation-service
cd services/recommendation-service
.venv\Scripts\Activate.ps1
uvicorn src.recommendation_service.main:app --reload --port 5009

# Frontend
cd services/frontend
npm run dev
```

---

## Chạy tests

```powershell
# Tat ca .NET tests
dotnet test SmartMusic.sln

# Python tests
cd services/recommendation-service
.venv\Scripts\Activate.ps1
pytest

# Frontend tests
cd services/frontend
npm test
```

---

## Cấu trúc Repo

```
Seminar-Project/
+-- services/
|   +-- api-gateway/
|   +-- auth-service/
|   +-- user-service/
|   +-- music-service/
|   +-- streaming-service/
|   +-- listening-party-service/
|   +-- analytics-service/
|   +-- notification-service/
|   +-- search-service/
|   +-- recommendation-service/    # Python / FastAPI
|   +-- frontend/                  # React / TypeScript
+-- proto/                         # Protobuf definitions (gRPC)
+-- infra/                         # docker-compose, .env.example
+-- database/                      # Schema documentation
+-- docs/
|   +-- originals/                 # PRD, Backlog, API Design, Use Cases
|   +-- architecture/              # Diagrams (Mermaid + PNG)
|   +-- contracts/                 # gRPC, Kafka, JSON schemas
|   +-- testing/                   # Test plan
+-- conventions/                   # Coding, Git, Secrets conventions
+-- tests/
|   +-- load/                      # k6 load tests
|   +-- chaos/                     # Chaos test scripts
+-- SmartMusic.sln
+-- setup-repo.ps1                 # One-command repo init
```

Moi C# service theo Clean Architecture:

```
services/<service-name>/
+-- src/
|   +-- <Name>.Api/                # ASP.NET Core entry point
|   +-- <Name>.Application/        # Business logic, DTOs, interfaces
|   +-- <Name>.Infrastructure/     # EF Core, Redis, Kafka, S3
|   +-- <Name>.Domain/             # Pure domain models
+-- tests/
|   +-- <Name>.UnitTests/
|   +-- <Name>.IntegrationTests/
+-- Dockerfile
```

---

## Tài liệu tham khảo

| Tài liệu                       | Đường dẫn                                        |
| -------------------------------- | ---------------------------------------------------- |
| API Design V2 (source of truth)  | `docs/originals/API_DESIGN_V2.md`                  |
| PRD V5                           | `docs/originals/PRD_Smart_Music_V5.md`             |
| Backlog V7                       | `docs/originals/Backlog_V7.md`                     |
| Use Cases V1                     | `docs/originals/Use_Case_Document_V1.md`           |
| Architecture diagrams            | `docs/architecture/system_architecture_mermaid.md` |
| Sequence diagrams                | `docs/architecture/sequence_diagrams_mermaid.md`   |
| Database schema                  | `database/DATABASE_SCHEMA.md`                      |
| Redis key design                 | `.github/REDIS_KEY_DESIGN.md`                      |
| Kafka event contracts            | `docs/contracts/KAFKA_EVENT_CONTRACTS.md`          |
| gRPC contracts                   | `docs/contracts/GRPC_CONTRACTS.md`                 |
| Test plan                        | `docs/testing/TEST_PLAN.md`                        |
| Docker guide                     | `infra/DOCKER_README.md`                           |
| Infrastructure health check      | `infra/verify-infra.sh`                            |
| Coding conventions               | `conventions/CODING_CONVENTIONS.md`                |
| Git workflow                     | `conventions/GIT_WORKFLOW.md`                      |
| Task starters (prompt templates) | `.claude/TASK_STARTERS.md`                         |

---

## Git workflow nhanh

```powershell
# Tao branch moi (theo GIT_WORKFLOW.md)
git checkout -b feat/auth-login

# Commit
git add .
git commit -m "feat(auth): implement POST /auth/login with JWT"

# Push va tao PR
git push -u origin feat/auth-login
```

Convention: `type(scope): subject` -- type: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.

> **NEVER commit `.env`** -- đã có trong `.gitignore`.
