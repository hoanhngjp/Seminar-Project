# Smart Music Streaming Platform

Nền tảng nghe nhạc trực tuyến kiến trúc Microservices — Đồ án Seminar (nhóm 3–4 người, 1 học kỳ).

Ba bài toán cốt lõi: **Filter Bubble** → Rule Engine; **Weak Social** → Realtime Listening Party; **Lack of Creator Insights** → Analytics Dashboard.

---

## Services

| Service                 | Port | Tech                                             |
| ----------------------- | ---- | ------------------------------------------------ |
| api-gateway             | 5000 | ASP.NET Core + YARP                              |
| auth-service            | 5001 | ASP.NET Core Identity + PostgreSQL               |
| user-service            | 5002 | ASP.NET Core + EF Core + PostgreSQL              |
| music-service           | 5003 | ASP.NET Core + Google Cloud Storage + PostgreSQL |
| streaming-service       | 5004 | ASP.NET Core + GCS pre-signed URL                |
| listening-party-service | 5005 | ASP.NET Core + SignalR + Redis                   |
| analytics-service       | 5006 | ASP.NET Core + InfluxDB                          |
| notification-service    | 5007 | ASP.NET Core + MongoDB                           |
| search-service          | 5008 | ASP.NET Core + Elasticsearch                     |
| recommendation-service  | 5009 | Python + FastAPI + Redis                         |
| frontend                | 5173 | React + TypeScript + Vite                        |

---

## Prerequisites

Cài đặt các tool sau trước khi bắt đầu:

| Tool             | Version | Cài đặt / Kiểm tra                                                                 |
| ---------------- | ------- | -------------------------------------------------------------------------------------- |
| Docker Desktop   | 4.x+    | [docs.docker.com](https://docs.docker.com/get-docker/) — enable WSL 2 trên Windows      |
| .NET SDK         | 8.0     | [dot.net](https://dotnet.microsoft.com/download) — `dotnet --version`                  |
| dotnet-ef tool   | 8.x     | `dotnet tool install --global dotnet-ef`                                             |
| Node.js          | 20 LTS  | [nodejs.org](https://nodejs.org) — `node --version`                                    |
| Python           | 3.11+   | [python.org](https://python.org) — `python --version`                                  |
| Google Cloud SDK | any     | [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install) — `gsutil --version` |
| Git              | any     | `git --version`                                                                      |

---

## External Services (bắt buộc)

Project dùng các dịch vụ cloud bên ngoài. Bạn cần tạo tài khoản và lấy credentials trước khi chạy:

| Service              | Dùng cho                         | Lấy credentials tại                                                                       |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| Google Cloud Storage | Lưu trữ file audio (.mp3)       | [console.cloud.google.com](https://console.cloud.google.com) → IAM → Service Accounts        |
| Cloudinary           | Lưu trữ ảnh bìa album, avatar | [cloudinary.com](https://cloudinary.com) → Dashboard                                          |
| Google OAuth         | Đăng nhập bằng Google         | [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials |

Sau khi có credentials, điền vào `infra/.env` (xem Bước 2 bên dưới).

---

## Setup từ đầu (first-time)

### Bước 1 — Clone và scaffold

```bash
git clone <repo-url>
cd Seminar-Project

# Scaffold toàn bộ repo (chỉ chạy một lần sau khi clone)
# Windows PowerShell:
.\setup-repo.ps1
```

### Bước 2 — Cấu hình .env

```bash
cp infra/.env.example infra/.env
```

Mở `infra/.env` và điền các giá trị **bắt buộc** sau:

```dotenv
# Google Cloud Storage — lưu file .mp3
GCP_PROJECT_ID=your-gcp-project-id
GCP_BUCKET_NAME=your-gcs-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=./secrets/google-cloud-key.json
# → Tải Service Account Key JSON về, đặt tại infra/secrets/google-cloud-key.json

# Google OAuth — đăng nhập bằng Google
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
VITE_GOOGLE_CLIENT_ID=your-google-client-id

# Cloudinary — ảnh bìa album
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# JWT (đổi thành chuỗi ngẫu nhiên ít nhất 32 ký tự)
JWT_SECRET=your-256-bit-secret-key-here-minimum-32-characters
```

Các giá trị còn lại (PostgreSQL, Redis, Kafka, v.v.) đã có sẵn mặc định hợp lệ cho local dev.

### Bước 3 — Đặt file tests/fixtures/test-audio.mp3

Script seed GCS cần một file MP3 bất kỳ làm placeholder cho 30 bài hát:

```bash
# Đặt bất kỳ file .mp3 hợp lệ vào đường dẫn này
cp /path/to/any-song.mp3 tests/fixtures/test-audio.mp3
```

### Bước 4 — Start infra containers

```bash
docker compose -f infra/docker-compose.yml up -d \
  postgres redis elasticsearch kafka zookeeper influxdb mongodb

# Đợi ~15s, sau đó kiểm tra:
bash infra/verify-infra.sh
```

### Bước 5 — Chạy Phase A seed (infra)

```bash
bash infra/seed/1_seed_infra.sh
```

Phase A thực hiện tự động:

1. Wait PostgreSQL healthy
2. EF Core migrations (`auth_db`, `user_db`, `music_db`)
3. Seed PostgreSQL: 30 bài hát + 16 nghệ sĩ + genres + user preferences
4. Seed Elasticsearch: index 30 bài (fuzzy search)
5. Seed Redis: `rec:trending:global` (30 songs, scored by play_count)
6. Seed Lyrics: 21 bài LRC → `music_db.songs.Lyrics`
7. Upload GCS audio: 30 placeholder mp3 → `gs://BUCKET/songs/{id}/audio.mp3`

### Bước 6 — Build và start tất cả services

```bash
docker compose -f infra/docker-compose.yml up -d --build
# Build và start api-gateway, auth-service, music-service, ...
# Đợi ~30s cho services healthy
```

### Bước 7 — Chạy Phase B seed (demo accounts)

```bash
bash infra/seed/2_seed_accounts.sh
# Script tự wait API Gateway healthy, rồi tạo accounts
```

**Demo accounts sau khi seed:**

| Role      | Email                 | Password  | Nguồn                    |
| --------- | --------------------- | --------- | ------------------------- |
| Listener  | listener@example.com  | Test1234! | UserService DbInitializer |
| Creator   | creator@example.com   | Test1234! | UserService DbInitializer |
| Admin     | admin@example.com     | Test1234! | UserService DbInitializer |
| Listener2 | listener2@example.com | Test1234! | 2_seed_accounts.sh        |

### Bước 8 — Mở frontend

```
http://localhost:3000
```

---

## Tóm tắt lệnh (Quick Reference)

```bash
# Xem hướng dẫn seed đầy đủ:
bash infra/seed/seed.sh

# Chỉ Phase A (infra, không cần services up):
bash infra/seed/1_seed_infra.sh

# Chỉ Phase B (demo accounts, cần services up):
bash infra/seed/2_seed_accounts.sh

# Seed lại từng phần (idempotent):
bash infra/seed/elasticsearch_seed.sh    # chỉ Elasticsearch
bash infra/seed/redis_seed.sh            # chỉ Redis trending
bash infra/seed/seed_lyrics.sh           # chỉ lyrics
bash infra/seed/gcs_seed.sh              # chỉ GCS audio

# Kiểm tra infrastructure healthy:
bash infra/verify-infra.sh

# Kiểm tra Acceptance Criteria:
bash infra/verify_ac.sh
```

> **Lưu ý:** Tất cả seed scripts đều **idempotent** — an toàn để chạy lại mà không bị duplicate data.

---

## Chạy từng service natively (development)

Khởi động chỉ infrastructure:

```bash
docker compose -f infra/docker-compose.yml up -d \
  postgres mongodb redis elasticsearch zookeeper kafka influxdb mongodb
```

Chạy service:

```bash
# C# service
dotnet run --project services/auth-service/src/AuthService.Api

# Python recommendation-service
cd services/recommendation-service
.venv/bin/activate          # Linux/macOS
# hoặc: .venv\Scripts\Activate.ps1   (Windows PowerShell)
uvicorn src.recommendation_service.main:app --reload --port 5009

# Frontend (với mock API — không cần backend)
cd services/frontend
npm run dev
# Để dùng real API: đảm bảo services đang chạy, VITE_MOCK=false trong .env.development
```

---

## Chạy tests

```bash
# Tất cả .NET tests
dotnet test SmartMusic.sln

# Python tests
cd services/recommendation-service
.venv/bin/python -m pytest

# Frontend tests
cd services/frontend
npm test
```

---

## Cấu trúc Repo

```
Seminar-Project/
├── services/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── user-service/
│   ├── music-service/
│   ├── streaming-service/
│   ├── listening-party-service/
│   ├── analytics-service/
│   ├── notification-service/
│   ├── search-service/
│   ├── recommendation-service/    # Python / FastAPI
│   └── frontend/                  # React / TypeScript / Vite
├── proto/                         # Protobuf definitions (gRPC)
├── infra/
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── seed/                      # Seed scripts
│   │   ├── seed.sh                # Entrypoint + hướng dẫn
│   │   ├── 1_seed_infra.sh        # Phase A: migrations + data + GCS
│   │   └── 2_seed_accounts.sh     # Phase B: demo accounts via API
│   └── secrets/                   # gitignored — đặt google-cloud-key.json ở đây
├── database/                      # Schema documentation
├── docs/
│   ├── originals/                 # PRD, Backlog, API Design, Use Cases
│   ├── architecture/              # Diagrams (Mermaid)
│   ├── contracts/                 # gRPC, Kafka, JSON schemas
│   └── testing/                   # Test plan
├── tests/
│   ├── fixtures/                  # test-audio.mp3 (gitignored)
│   ├── lyrics/                    # .lrc files cho 21 bài
│   ├── load/                      # k6 load tests
│   └── chaos/                     # Chaos test scripts
├── conventions/                   # Coding, Git, Secrets conventions
└── SmartMusic.sln
```

Mỗi C# service theo Clean Architecture:

```
services/<service-name>/
├── src/
│   ├── <Name>.Api/                # ASP.NET Core entry point
│   ├── <Name>.Application/        # Business logic, DTOs, interfaces
│   ├── <Name>.Infrastructure/     # EF Core, Redis, Kafka, GCS
│   └── <Name>.Domain/             # Pure domain models
├── tests/
│   ├── <Name>.UnitTests/
│   └── <Name>.IntegrationTests/
└── Dockerfile
```

---

## Tài liệu tham khảo

| Tài liệu                      | Đường dẫn                                        |
| ------------------------------- | ---------------------------------------------------- |
| API Design V2 (source of truth) | `docs/originals/API_DESIGN_V2.md`                  |
| PRD V5                          | `docs/originals/PRD_Smart_Music_V5.md`             |
| Backlog V7                      | `docs/originals/Backlog_V7.md`                     |
| Use Cases V1                    | `docs/originals/Use_Case_Document_V1.md`           |
| Architecture diagrams           | `docs/architecture/system_architecture_mermaid.md` |
| Sequence diagrams               | `docs/architecture/sequence_diagrams_mermaid.md`   |
| Database schema                 | `database/DATABASE_SCHEMA.md`                      |
| Redis key design                | `.github/REDIS_KEY_DESIGN.md`                      |
| Kafka event contracts           | `docs/contracts/KAFKA_EVENT_CONTRACTS.md`          |
| gRPC contracts                  | `docs/contracts/GRPC_CONTRACTS.md`                 |
| Test plan                       | `docs/testing/TEST_PLAN.md`                        |
| Docker guide                    | `infra/DOCKER_README.md`                           |
| Seed guide                      | `infra/seed/seed.sh --help`                        |
| Infrastructure health check     | `infra/verify-infra.sh`                            |
| Coding conventions              | `conventions/CODING_CONVENTIONS.md`                |
| Git workflow                    | `conventions/GIT_WORKFLOW.md`                      |

---

## Git workflow nhanh

```bash
# Tạo branch mới
git checkout -b feat/auth-login

# Commit
git add .
git commit -m "feat(auth): implement POST /auth/login with JWT"

# Push và tạo PR
git push -u origin feat/auth-login
```

Convention: `type(scope): subject` — type: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.

> **NEVER commit `.env` hoặc `infra/secrets/`** — đã có trong `.gitignore`.
