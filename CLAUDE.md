# CLAUDE.md — Smart Music Streaming Platform

## Tổng quan dự án

**Smart Music Streaming Platform** là nền tảng nghe nhạc trực tuyến áp dụng kiến trúc Microservices, xây dựng trong khuôn khổ đồ án seminar (nhóm 3-4 người, 1 học kỳ). Tài liệu tham chiếu: PRD V5, Backlog V7, API Design V2, Use Case V1.

Ba bài toán cốt lõi:
- **Filter Bubble** → Context-Aware Rule Engine (thay ML/AI)
- **Weak Social** → Realtime Listening Party qua WebSocket
- **Lack of Creator Insights** → Creator Analytics Dashboard (heatmap skip-rate, daily listeners)

---

## Tech Stack

### Backend Services (C# / ASP.NET Core)

| Service | Ngôn ngữ | Framework | DB chính | Ghi chú |
|---|---|---|---|---|
| API Gateway | C# | ASP.NET Core + YARP | Redis | Routing, Rate Limit, Auth Termination, < 50ms |
| Auth Service | C# | ASP.NET Core Identity | PostgreSQL + Redis | JWT, RBAC, Refresh Token Rotation, Redis Blacklist |
| User Service | C# | ASP.NET Core + EF Core | PostgreSQL | Profiles, Preferences |
| Music Service | C# | ASP.NET Core + AWS SDK | PostgreSQL / MongoDB | Metadata, S3 Upload |
| Streaming Service | C# | ASP.NET Core | S3 + CDN | Pre-signed URL, HTTP Range Requests |
| Listening Party Service | C# | ASP.NET Core + SignalR | Redis (ephemeral) | WebSocket, Host Authority |
| Analytics Service | C# | ASP.NET Core | InfluxDB / MongoDB | Append-only, Idempotency, DLQ |
| Notification Service | C# | ASP.NET Core | MongoDB | Fan-out, DLQ after 3 retries |
| Search Service | C# | ASP.NET Core | Elasticsearch | Fuzzy Search |

### Backend Services (Python)

| Service | Ngôn ngữ | Framework | DB chính | Ghi chú |
|---|---|---|---|---|
| Recommendation Service | Python | FastAPI | Redis | Rule Engine, không dùng ML/AI/Vector DB |

### Frontend

| Layer | Ngôn ngữ | Framework |
|---|---|---|
| Web SPA | TypeScript | React |

### Infrastructure

| Thành phần | Vai trò |
|---|---|
| Kafka | Message Broker — 5 topics, at-least-once delivery |
| Redis Cluster | Cache, Sessions, Rate Limit, Recommendation Weights |
| S3 + CDN | Audio Storage + Delivery |
| Elasticsearch | Search Index (3 nodes) |
| PostgreSQL (RDS) | User Service, Auth Service, Music Service |
| MongoDB (Atlas) | Notification Service, Music Service (metadata) |
| InfluxDB Cloud | Analytics (time-series) |
| Docker + Kubernetes | Container orchestration |
| Prometheus + Grafana | Observability, Metrics |

---

## Kiến trúc hệ thống

### Communication Patterns

- **gRPC**: Auth hot path — API Gateway → Auth Service → User Service (low latency)
- **REST**: Service-to-service internal calls (Music ↔ Streaming, Recommendation ↔ Music)
- **Kafka (Async)**: Event-driven — Streaming/Music/User → Kafka → Analytics/Recommendation/Notification
- **WebSocket (SignalR)**: Listening Party realtime bidirectional sync

### Kafka Topics (5 topics)

| Topic | Producer | Consumer(s) | Delivery |
|---|---|---|---|
| `Song_Played` | Streaming Service | Analytics, Recommendation | at-least-once |
| `Song_Skipped` | Streaming Service | Analytics, Recommendation | at-least-once |
| `New_Release` | Music Service | Notification | at-least-once |
| `User_Preferences_Updated` | User Service | Recommendation | at-least-once |
| `Notification_Sent` | Notification Service | Analytics | best-effort |

### Database per Service Pattern

Mỗi service có database riêng — không được truy cập DB của service khác trực tiếp.

---

## Actors & Use Cases

**4 Actors**: Listener, Creator (Artist), Admin, System (Automated)

**24 Use Cases** (8 EPICs):

| EPIC | UC | Tên |
|---|---|---|
| EPIC 1 — Auth | UC-01, UC-02, UC-03 | Login/Logout, Refresh Token, Onboarding |
| EPIC 3 — Streaming | UC-04, UC-05, UC-06, UC-07 | Search, Play, Seek, Song Info |
| EPIC 2 — Recommendation | UC-08, UC-09 | Gợi ý nhạc, Play/Skip Feedback |
| EPIC 7 — Listening Party | UC-10, UC-11, UC-12, UC-13 | Tạo phòng, Join, Host Control, Member Sync |
| EPIC 1 — Creator | UC-14 | Upload nhạc |
| EPIC 4 — Analytics | UC-15, UC-16 | Heatmap skip-rate, Daily stats |
| EPIC 6 — Notification | UC-17, UC-18 | Nhận thông báo, Đánh dấu đã đọc |
| Admin | UC-19, UC-20, UC-21 | Quản lý user, Kiểm duyệt, Giám sát |
| System | UC-22, UC-23, UC-24 | Tracking, Update weights, Fan-out |

---

## API Conventions

Tất cả API theo chuẩn thống nhất từ `docs/originals/API_DESIGN_V2.md`:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "apiVersion": "v1",
    "requestId": "uuid",
    "timestamp": "ISO8601",
    "cache": "HIT | MISS"
  },
  "error": null
}
```

**Error codes**: `AUTH_INVALID_CREDENTIALS`, `TOKEN_REUSED`, `ACCOUNT_LOCKED`, `VALIDATION_ERROR`, `RATE_LIMIT_EXCEEDED`, `IDEMPOTENCY_CONFLICT`, `ROOM_NOT_FOUND`, v.v.

**Idempotency**: Các POST mutating operations phải gửi header `Idempotency-Key` (UUID), lưu Redis TTL 24h.

**Budget latency (p95)**:

| Loại | Target |
|---|---|
| API Gateway routing | < 50ms |
| Auth (login) | < 500ms |
| Streaming get URL | < 300ms |
| Recommendation | < 300ms (fallback nếu > 300ms) |
| Search | < 200ms |
| Listening Party sync | < 500ms |

---

## Scope Control (quan trọng)

### IN Scope (Phase 1 — MVP)
- Authentication & RBAC (Listener, Creator, Admin)
- Core Audio Streaming (HTTP Range + Pre-signed URL + CDN)
- Context-Aware **Rule-based** Recommendation Engine
- Realtime Listening Party (WebSocket / SignalR)
- Creator Analytics Dashboard
- Search (Elasticsearch fuzzy)
- Notification Service (new release alerts)
- API Gateway
- Event-driven Analytics (Kafka, idempotency, DLQ)
- Frontend Web SPA (React)

### OUT of Scope (đừng implement)
- ML/AI models (LSTM, GRU, PyTorch, Vector DB)
- Collaborative Filtering (Phase 2 nếu còn thời gian)
- Bloom Filter (thay bằng Redis SET)
- gRPC full internal mesh (chỉ Auth → User dùng gRPC)
- DRM, Mobile App (iOS/Android), Payment Gateway
- Train AI from scratch

---

## Cấu trúc thư mục

```
smart-music-platform/
│
├── CLAUDE.md                              ← thư mục gốc
├── README.md
│
├── docs/
│   ├── originals/                         ← tài liệu gốc từ stakeholder, chỉ đọc
│   │   ├── PRD_Smart_Music_V5.docx
│   │   ├── PRD_Smart_Music_V5.md
│   │   ├── API_DESIGN_V2.xlsx
│   │   ├── API_DESIGN_V2.md
│   │   ├── Backlog_V7.docx
│   │   ├── Backlog_V7.md
│   │   ├── Use_Case_Document_V1.docx
│   │   └── Use_Case_Document_V1.md
│   │
│   ├── architecture/                      ← diagrams và tài liệu kiến trúc
│   │   ├── system_architecture_mermaid.md
│   │   ├── use_case_diagram_mermaid.md
│   │   ├── sequence_diagrams_mermaid.md
│   │   └── diagrams/                      ← PNG exports
│   │
│   ├── contracts/                         ← API contracts, event schemas
│   │   ├── GRPC_CONTRACTS.md
│   │   ├── KAFKA_EVENT_CONTRACTS.md
│   │   └── kafka-schemas/
│   │       ├── song_played.v1.json
│   │       ├── song_skipped.v1.json
│   │       ├── new_release.v1.json
│   │       ├── user_preferences_updated.v1.json
│   │       └── notification_sent.v1.json
│   │
│   └── testing/
│       └── TEST_PLAN.md
│
├── infra/                                 ← chạy hệ thống local
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── DOCKER_README.md
│   └── k8s/
│
├── proto/                                 ← root level, tất cả C# services reference
│   ├── auth.proto
│   └── user.proto
│
├── database/
│   └── DATABASE_SCHEMA.md
│
├── .github/
│   ├── REDIS_KEY_DESIGN.md
│   └── pull_request_template.md           ← tạo khi setup CI
│
└── conventions/                           ← team conventions
    ├── CODING_CONVENTIONS.md
    ├── GIT_WORKFLOW.md
    └── SECRETS_MANAGEMENT.md
```

---

## Tài liệu tham chiếu

### Tài liệu gốc (không sửa trực tiếp)

| File | Vị trí | Mô tả |
|---|---|---|
| PRD V5 | `docs/originals/PRD_Smart_Music_V5.docx` | Product Requirements, Personas, Metrics, Scope |
| Backlog V7 | `docs/originals/Backlog_V7.docx` | User Stories, Acceptance Criteria, Epic breakdown |
| API Design V2 | `docs/originals/API_DESIGN_V2.xlsx` | Tất cả API endpoints, request/response, errors, latency budget |
| Use Case V1 | `docs/originals/Use_Case_Document_V1.docx` | 24 Use Cases chi tiết |

### Tài liệu thiết kế kỹ thuật (source of truth khi implement)

| File | Mô tả | Khi nào dùng |
|---|---|---|
| `database/DATABASE_SCHEMA.md` | Schema đầy đủ: PostgreSQL (Auth/User/Music), MongoDB (Notification), InfluxDB (Analytics) | Trước khi viết migration, EF Core model, repository |
| `docs/contracts/GRPC_CONTRACTS.md` | Spec 2 gRPC calls: ValidateToken + GetUserProfile, timeout, fallback | Khi implement Auth Service, User Service, API Gateway |
| `proto/auth.proto` | Protobuf definition cho AuthService.ValidateToken | Generate C# gRPC code |
| `proto/user.proto` | Protobuf definition cho UserService.GetUserProfile | Generate C# gRPC code |
| `.github/REDIS_KEY_DESIGN.md` | Toàn bộ Redis key conventions cho mọi service — naming, type, TTL | Mỗi khi đọc/ghi Redis |
| `docs/contracts/KAFKA_EVENT_CONTRACTS.md` | Contract chính thức 5 Kafka events: fields, producer/consumer contract, idempotency, DLQ, backward compat | Trước khi implement Kafka producer/consumer bất kỳ |
| `docs/contracts/kafka-schemas/*.v1.json` | JSON Schema (draft-07) cho từng event — validate payload trước khi publish | Khi viết Kafka producer hoặc consumer |
| `docs/testing/TEST_PLAN.md` | Test strategy, unit/integration/load/chaos tests, AC coverage matrix 46 ACs | Khi viết tests cho bất kỳ service nào |
| `conventions/CODING_CONVENTIONS.md` | C# + Python coding conventions: folder structure, naming, error handling, logging, Kafka pattern | Trước khi bắt đầu viết code bất kỳ service nào |
| `conventions/GIT_WORKFLOW.md` | Branch strategy (GitHub Flow), commit convention, PR template, merge strategy | Onboarding thành viên mới, mỗi khi tạo branch/commit/PR |
| `conventions/SECRETS_MANAGEMENT.md` | Danh sách toàn bộ secrets, quy ước .env, không hardcode, xử lý khi lộ secret | Setup môi trường, thêm service mới |
| `infra/docker-compose.yml` | Local dev infrastructure — tất cả services và infra | `docker-compose up` để chạy local |
| `infra/.env.example` | Template biến môi trường — copy thành `.env` | Setup lần đầu |
| `infra/DOCKER_README.md` | Hướng dẫn chạy local: first-time setup, migrations, troubleshooting | Onboarding thành viên mới |

### Tài liệu Markdown (convert từ Docs, đọc nhanh)

| File | Mô tả |
|---|---|
| `docs/originals/PRD_Smart_Music_V5.md` | PRD dạng Markdown |
| `docs/originals/Backlog_V7.md` | Backlog dạng Markdown |
| `docs/originals/API_DESIGN_V2.md` | API Design dạng Markdown |
| `docs/originals/Use_Case_Document_V1.md` | Use Cases dạng Markdown |
| `docs/architecture/system_architecture_mermaid.md` | 4 Architecture Diagrams (Mermaid) |
| `docs/architecture/use_case_diagram_mermaid.md` | Use Case Diagram (Mermaid) |
| `docs/architecture/sequence_diagrams_mermaid.md` | 8 Sequence Diagrams SD-01 → SD-08 (Mermaid) |

---

## Quy ước code

- Ngôn ngữ trong code: **tiếng Anh** — tên biến, class, method, comment, field DB đều dùng `snake_case` (DB) hoặc `PascalCase`/`camelCase` (C#/TypeScript)
- Tài liệu & commit message: tiếng Việt hoặc tiếng Anh đều được
- Mỗi service là một project độc lập trong solution (`services/<service-name>/`)
- Proto files: `proto/<service>.proto`, generate ra `src/Generated/`

### Port allocation (local dev)

| Service | Port |
|---|---|
| Frontend (React) | 3000 |
| API Gateway | 5000 |
| Auth Service | 5001 |
| User Service | 5002 |
| Music Service | 5003 |
| Streaming Service | 5004 |
| Listening Party Service | 5005 |
| Analytics Service | 5006 |
| Notification Service | 5007 |
| Search Service | 5008 |
| Recommendation Service (Python) | 5009 |
| PostgreSQL | 5432 |
| MongoDB | 27017 |
| Redis | 6379 |
| Kafka | 9092 |
| Elasticsearch | 9200 |
| InfluxDB | 8086 |
| MinIO (S3 local) | 9000 / 9001 |
| Kafka UI | 8080 |
| Mongo Express | 8081 |

---

## Ghi chú cho Claude

- **API**: Khi implement bất kỳ endpoint nào, đối chiếu `docs/originals/API_DESIGN_V2.md` lấy đúng path, method, error codes, latency budget.
- **Database**: Trước khi tạo model/migration, đọc `database/DATABASE_SCHEMA.md` — đặc biệt chú ý indexes và constraints.
- **Redis**: Mọi key Redis phải theo đúng pattern trong `.github/REDIS_KEY_DESIGN.md`. Không tự đặt key ngoài quy ước.
- **gRPC**: Chỉ 2 calls dùng gRPC (ValidateToken + GetUserProfile). Xem `docs/contracts/GRPC_CONTRACTS.md` cho timeout, fallback behavior.
- **Recommendation**: Không dùng ML — chỉ Rule Engine + Redis weights. Không dùng Vector DB, PyTorch.
- **gRPC scope**: Chỉ Auth → User dùng gRPC; tất cả internal calls khác dùng REST.
- **Kafka idempotency**: Mọi consumer phải check Redis SET dedup (TTL 24h) trước khi xử lý event. DLQ sau 3 retries.
- **Listening Party**: Chỉ Host mới được gửi PLAYER_ACTION — reject Member ngay tại WebSocket handler.
- **S3 atomicity**: Chỉ commit metadata vào DB sau khi S3 upload confirm thành công. Rollback nếu S3 fail.
- **PII trong Analytics**: Tuyệt đối không lưu email/tên vào InfluxDB — chỉ dùng anonymized `user_id` (UUID).
