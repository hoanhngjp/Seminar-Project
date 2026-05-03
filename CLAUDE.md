# CLAUDE.md — Smart Music Streaming Platform

## Project Overview

Nền tảng nghe nhạc trực tuyến kiến trúc Microservices, xây dựng trong khuôn khổ đồ án seminar (nhóm 3-4 người, 1 học kỳ). Ba bài toán cốt lõi: **Filter Bubble** → Rule Engine thay ML; **Weak Social** → Realtime Listening Party; **Lack of Creator Insights** → Analytics Dashboard. Tài liệu gốc: PRD V5, Backlog V7, API Design V2, Use Case V1.

---

## Tech Stack

| Service | Language | Framework | DB |
|---|---|---|---|
| API Gateway | C# | ASP.NET Core + YARP | Redis |
| Auth Service | C# | ASP.NET Core Identity | PostgreSQL + Redis |
| User Service | C# | ASP.NET Core + EF Core | PostgreSQL |
| Music Service | C# | ASP.NET Core + AWS SDK | PostgreSQL / MongoDB |
| Streaming Service | C# | ASP.NET Core | S3 + CDN |
| Listening Party Service | C# | ASP.NET Core + SignalR | Redis |
| Analytics Service | C# | ASP.NET Core | InfluxDB / MongoDB |
| Notification Service | C# | ASP.NET Core | MongoDB |
| Search Service | C# | ASP.NET Core | Elasticsearch |
| Recommendation Service | Python | FastAPI | Redis |
| Frontend | TypeScript | React | — |

---

## Scope Boundaries

### IN Scope (Phase 1 — MVP)
- Authentication & RBAC (Listener, Creator, Admin)
- Core Audio Streaming (HTTP Range + Pre-signed URL + CDN)
- Context-Aware Rule-based Recommendation Engine
- Realtime Listening Party (WebSocket / SignalR)
- Creator Analytics Dashboard
- Search (Elasticsearch fuzzy)
- Notification Service (new release alerts)
- API Gateway
- Event-driven Analytics (Kafka, idempotency, DLQ)
- Frontend Web SPA (React)

### OUT of Scope — Không bao giờ implement
- ML/AI models (LSTM, GRU, PyTorch, Vector DB, Pinecone, Weaviate)
- Collaborative Filtering (Phase 2 nếu còn thời gian)
- Bloom Filter (thay bằng Redis SET)
- gRPC full internal mesh (chỉ Auth → User dùng gRPC)
- DRM, Mobile App (iOS/Android), Payment Gateway
- Train AI from scratch

> Chi tiết constraints và ví dụ: `.claude/rules/no-scope-creep/RULE.md`

---

## Communication Patterns

| Protocol | Dùng cho |
|---|---|
| gRPC | Chỉ 2 calls: API Gateway → Auth (ValidateToken), Auth → User (GetUserProfile) |
| REST | Service-to-service internal calls + tất cả external APIs |
| Kafka | Async events — 5 topics: Song_Played, Song_Skipped, New_Release, User_Preferences_Updated, Notification_Sent |
| WebSocket (SignalR) | Listening Party realtime sync |

---

## How to Use This Repo

| Task | Bắt buộc đọc | Tùy chọn |
|---|---|---|
| Implement C# service | `.claude/skills/aspnet-service/SKILL.md`, `.claude/skills/microservice-api/SKILL.md` | `database/DATABASE_SCHEMA.md` |
| Implement API endpoint | `docs/originals/API_DESIGN_V2.md`, `.claude/rules/api-contract-first/RULE.md` | `docs/contracts/GRPC_CONTRACTS.md` |
| Implement Recommendation Service | `.claude/skills/fastapi-service/SKILL.md`, `.claude/rules/no-scope-creep/RULE.md` | `docs/originals/API_DESIGN_V2.md` |
| Implement Frontend | `.claude/skills/react-spa/SKILL.md` | `docs/originals/API_DESIGN_V2.md` |
| Viết tests | `docs/testing/TEST_PLAN.md`, `.claude/rules/testing-required/RULE.md` | — |
| Dùng Redis | `.github/REDIS_KEY_DESIGN.md` | — |
| Dùng Kafka | `docs/contracts/KAFKA_EVENT_CONTRACTS.md`, `docs/contracts/kafka-schemas/` | — |
| Setup local dev | `infra/DOCKER_README.md`, `infra/.env.example` | `infra/verify-infra.sh` |
| Verify infrastructure healthy | `infra/verify-infra.sh` | `infra/DOCKER_README.md` |
| Viết bất kỳ code nào | `.claude/rules/security-non-negotiable/RULE.md` | — |
| Tạo branch / commit / PR | `conventions/GIT_WORKFLOW.md` | — |

---

## Repo Structure

```
Seminar-Project/
├── SmartMusic.sln                          # C# solution (9 services)
├── setup-repo.ps1                          # One-command scaffold (Windows)
├── services/
│   ├── api-gateway/                        # C# — YARP reverse proxy
│   ├── auth-service/                       # C# — JWT + Identity
│   ├── user-service/                       # C# — profiles + preferences
│   ├── music-service/                      # C# — upload + metadata
│   ├── streaming-service/                  # C# — pre-signed URL + CDN
│   ├── listening-party-service/            # C# — SignalR rooms
│   ├── analytics-service/                  # C# — InfluxDB write + read
│   ├── notification-service/               # C# — MongoDB fan-out
│   ├── search-service/                     # C# — Elasticsearch
│   ├── recommendation-service/             # Python — FastAPI + Rule Engine
│   │   ├── src/recommendation_service/
│   │   ├── tests/
│   │   ├── requirements.txt
│   │   ├── requirements-test.txt
│   │   └── .venv/                          # Python virtual env (local only)
│   └── frontend/                           # TypeScript — React + Vite
│       └── src/
│           ├── api/                        # axios clients
│           ├── components/
│           ├── hooks/
│           ├── pages/
│           ├── store/                      # zustand
│           └── types/
├── proto/                                  # Protobuf: auth.proto, user.proto
├── infra/
│   ├── docker-compose.yml
│   ├── .env.example                        # Template — copy to .env
│   └── DOCKER_README.md
├── database/DATABASE_SCHEMA.md
├── docs/
│   ├── originals/                          # PRD V5, Backlog V7, API Design V2, Use Cases V1
│   ├── architecture/                       # Mermaid diagrams + PNG exports
│   ├── contracts/                          # gRPC, Kafka, JSON schemas
│   └── testing/TEST_PLAN.md
├── conventions/                            # Coding, Git, Secrets
├── tests/
│   ├── load/                               # k6 scripts
│   └── chaos/                             # Chaos test scripts
└── .github/
    ├── workflows/ci.yml                    # GitHub Actions CI
    └── REDIS_KEY_DESIGN.md
```

Mỗi C# service theo **Clean Architecture**:
```
services/<service-name>/
├── src/
│   ├── <Name>.Api/            # Controllers, Middleware, Program.cs
│   ├── <Name>.Application/    # Services, DTOs, Interfaces, Exceptions
│   ├── <Name>.Infrastructure/ # Repositories, Kafka, Redis, Data/Migrations
│   └── <Name>.Domain/         # Pure domain models
├── tests/
│   ├── <Name>.UnitTests/      # xUnit + Moq + FluentAssertions
│   └── <Name>.IntegrationTests/ # WebApplicationFactory + Testcontainers
└── Dockerfile
```

---

## File Index

### Original Documents (chỉ đọc)
- `docs/originals/PRD_Smart_Music_V5.md` — Product Requirements, Personas, Metrics, Scope
- `docs/originals/Backlog_V7.md` — User Stories, Acceptance Criteria, Epic breakdown
- `docs/originals/API_DESIGN_V2.md` — Tất cả endpoints, request/response, error codes, latency budget
- `docs/originals/Use_Case_Document_V1.md` — 24 Use Cases chi tiết

### Architecture
- `docs/architecture/system_architecture_mermaid.md` — 4 Architecture Diagrams (Mermaid)
- `docs/architecture/use_case_diagram_mermaid.md` — Use Case Diagram
- `docs/architecture/sequence_diagrams_mermaid.md` — 8 Sequence Diagrams (SD-01 → SD-08)

### Contracts & Schemas
- `docs/contracts/GRPC_CONTRACTS.md` — Spec 2 gRPC calls: ValidateToken + GetUserProfile, timeout, fallback
- `docs/contracts/KAFKA_EVENT_CONTRACTS.md` — Contract 5 Kafka events, idempotency, DLQ, backward compat
- `docs/contracts/kafka-schemas/` — JSON Schema (draft-07) cho từng Kafka event
- `proto/auth.proto` — Protobuf definition: AuthService.ValidateToken
- `proto/user.proto` — Protobuf definition: UserService.GetUserProfile

### Database & Infrastructure
- `database/DATABASE_SCHEMA.md` — Full schema: PostgreSQL (Auth/User/Music), MongoDB, InfluxDB
- `.github/REDIS_KEY_DESIGN.md` — Redis key conventions, type, TTL cho mọi service
- `infra/docker-compose.yml` — Local dev: tất cả services + infrastructure
- `infra/.env.example` — Template biến môi trường
- `infra/DOCKER_README.md` — Hướng dẫn setup local, migrations, troubleshooting

### Testing
- `docs/testing/TEST_PLAN.md` — Strategy, unit/integration/load/chaos, AC coverage matrix (46 ACs)

### Setup & CI
- `setup-repo.ps1` — One-command scaffold: tạo solution, services, Python venv, React frontend (chạy một lần sau khi clone)
- `infra/verify-infra.sh` — Kiểm tra toàn bộ infrastructure local healthy: Redis, PostgreSQL (7 DBs), MongoDB, Elasticsearch, Kafka (5 topics), InfluxDB, MinIO. Output ✅/❌ kèm lệnh fix.
- `.github/workflows/ci.yml` — GitHub Actions CI: dotnet build+test, pytest, frontend build

### Task Starters
- `.claude/TASK_STARTERS.md` — Prompt templates cho 10 loại task phổ biến (files cần đính kèm + prompt starter sẵn sàng paste)

### Skills (.claude/skills/)
- `.claude/skills/aspnet-service/SKILL.md` — Conventions và patterns cho C# / ASP.NET Core services
- `.claude/skills/fastapi-service/SKILL.md` — Conventions và patterns cho Python / FastAPI (Recommendation)
- `.claude/skills/microservice-api/SKILL.md` — Microservice API design patterns
- `.claude/skills/react-spa/SKILL.md` — Frontend conventions cho React / TypeScript SPA

### Rules (.claude/rules/)
- `.claude/rules/no-scope-creep/RULE.md` — OUT of scope tuyệt đối, Phase 2 only, Kafka topic limit
- `.claude/rules/api-contract-first/RULE.md` — Checklist 8 điểm trước khi implement endpoint, response format, error codes
- `.claude/rules/security-non-negotiable/RULE.md` — JWT, secrets, RBAC, S3, rate limit, PII — không có ngoại lệ
- `.claude/rules/testing-required/RULE.md` — Unit + integration test bắt buộc, AC coverage, mock rules

### Project Logs
- `CHANGELOG.md` — lịch sử thay đổi theo milestone, formal (dành cho thầy/hội đồng)
- `.claude/DEVLOG.md` — nhật ký bug/decision/blocker hàng ngày (dành cho nhóm và Claude)

### Conventions
- `conventions/CODING_CONVENTIONS.md` — C# + Python coding style, folder structure, naming, logging
- `conventions/GIT_WORKFLOW.md` — Branch strategy, commit convention, PR template
- `conventions/SECRETS_MANAGEMENT.md` — Secrets list, .env rules, xử lý khi lộ secret

---

## How to Start a Session

Mỗi conversation mới với Claude, thực hiện theo thứ tự:

1. Đọc `.claude/CURRENT_STATE.md` để biết context
2. Tra `.claude/TASK_STARTERS.md` để lấy đúng template
3. Đính kèm files theo danh sách trong template
4. Paste session opener vào đầu chat:
   `"Đọc [files đính kèm]. Tóm tắt task, chưa viết code."`
5. Sau khi xong: cập nhật `CURRENT_STATE.md` và commit

## Session Opener Template

```
Đọc các files đính kèm theo thứ tự:
1. CLAUDE.md
2. .claude/CURRENT_STATE.md
3. .claude/plan/[plan file hôm nay]
4. [skill files]
5. [rule files]

Sau khi đọc: tóm tắt task, constraints cần lưu ý,
câu hỏi cần clarify. Chưa viết code.
```
