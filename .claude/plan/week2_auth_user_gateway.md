# week2_auth_user_gateway.md — Auth + User + API Gateway

> Mục tiêu cuối tuần 2: Login flow hoạt động end-to-end
> React SPA → API Gateway → Auth Service → (gRPC) → User Service → JWT về browser
>
> Port mapping và curl commands: xem `.claude/plan/shared_contracts.md`
> Error codes: xem `.claude/plan/shared_contracts.md` Section 5

---

## Dependency Graph

```
Bước 0: gRPC Setup (proto generate + connection test)
    ↓
User Service (PostgreSQL user_db — port 5433)
    ↓
Auth Service (PostgreSQL auth_db — port 5432, gRPC → User Service)
    ↓
API Gateway (YARP routing + JWT validation + Rate limiting)
```

**Làm đúng thứ tự này. Không bắt đầu Auth trước khi User Service có /health pass.**

---

## Bước 0 — gRPC Setup (Làm trước, khoảng 2-3 giờ)

### Mục tiêu
Generate C# code từ proto files, verify gRPC connection trước khi implement business logic.

### Files cần kiểm tra trước
- `proto/auth.proto` — định nghĩa AuthService.ValidateToken
- `proto/user.proto` — định nghĩa UserService.GetUserProfile
- `docs/contracts/GRPC_CONTRACTS.md` — timeout, fallback, retry spec

### Các bước thực hiện

**B0.1 — Verify proto files tồn tại**
```bash
ls proto/
# Expected: auth.proto  user.proto
cat proto/auth.proto
cat proto/user.proto
```

**B0.2 — Thêm Grpc.Tools vào .csproj**
```xml
<!-- Trong Auth.Infrastructure.csproj -->
<ItemGroup>
  <PackageReference Include="Grpc.AspNetCore" Version="2.62.*" />
  <PackageReference Include="Google.Protobuf" Version="3.26.*" />
  <PackageReference Include="Grpc.Tools" Version="2.62.*">
    <PrivateAssets>all</PrivateAssets>
    <IncludeAssets>runtime; build; native; contentfiles; analyzers</IncludeAssets>
  </PackageReference>
</ItemGroup>

<ItemGroup>
  <!-- Cho Auth Service: sử dụng user.proto để gọi User Service -->
  <Protobuf Include="../../../../proto/user.proto" GrpcServices="Client" />
</ItemGroup>
```

```xml
<!-- Trong User.Api.csproj -->
<ItemGroup>
  <PackageReference Include="Grpc.AspNetCore" Version="2.62.*" />
</ItemGroup>

<ItemGroup>
  <!-- Cho User Service: expose gRPC server -->
  <Protobuf Include="../../../../proto/user.proto" GrpcServices="Server" />
</ItemGroup>
```

**B0.3 — Build để generate C# classes**
```bash
dotnet build services/auth-service/src/Auth.Infrastructure/Auth.Infrastructure.csproj
dotnet build services/user-service/src/User.Api/User.Api.csproj
# Expected: Build succeeded — classes UserService.UserServiceClient, etc. được generate
```

**B0.4 — Test gRPC connection với grpcurl**
```bash
# Install grpcurl nếu chưa có
# Windows: scoop install grpcurl

# Start User Service
dotnet run --project services/user-service/src/User.Api -- --urls http://localhost:5002 &

# Test gRPC endpoint
grpcurl -plaintext localhost:5002 list
# Expected: user.UserService

grpcurl -plaintext -d '{"user_id":"test-uuid"}' localhost:5002 user.UserService/GetUserProfile
# Expected: lỗi NOT_FOUND hoặc response rỗng (chưa có data) — OK, connection works
```

**B0.5 — Definition of Done cho Bước 0**
- [ ] `dotnet build` thành công với proto files
- [ ] `grpcurl localhost:5002 list` trả về `user.UserService`
- [ ] Connection giữa Auth và User Service không throw `RpcException: UNAVAILABLE`

---

## User Service

### Làm trước khi bắt đầu
Đọc: `docs/originals/API_DESIGN_V2.md` (phần User endpoints), `database/DATABASE_SCHEMA.md` (user_db schema), `.github/REDIS_KEY_DESIGN.md`

### Database: user_db (PostgreSQL port 5433)
Tables cần tạo: `users`, `follows`, `user_preferences`
Schema chi tiết: `database/DATABASE_SCHEMA.md`

### EF Core Migration
```bash
cd services/user-service/src/User.Infrastructure
dotnet ef migrations add InitialCreate --startup-project ../User.Api
dotnet ef database update --startup-project ../User.Api
# Verify: kết nối psql -h localhost -p 5433 -U postgres -d user_db
# \dt → phải thấy users, follows, user_preferences
```

### Endpoints cần implement

**1. GET /api/v1/users/me**
- Auth: Bearer JWT required
- Response 200: `{ success, data: { id, email, username, displayName, role, avatarUrl, bio }, meta }`
- Error: 401 UNAUTHORIZED, 404 USER_NOT_FOUND
- Latency budget: 300ms (có Redis cache TTL 15m, key: `user:profile:{userId}`)
- Retry: YES

**2. POST /api/v1/users/me/preferences**
- Auth: Bearer JWT required
- Body: `{ preferredGenres: string[], preferredLanguages: string[], audioQuality: string }`
- Response 200: `{ success, data: { updated: true }, meta }`
- Sau khi save: publish Kafka event `User_Preferences_Updated` (v1)
- Latency budget: 400ms
- Idempotency-Key: KHÔNG cần (POST với replace semantics)

**3. gRPC Server: GetUserProfile**
- Input: `{ user_id: string }`
- Output: `{ user_id, email, username, display_name, role }`
- Timeout: 100ms (caller enforce)
- Chỉ caller được phép: Auth Service

**4. Internal REST: GET /internal/users/{id}/preferences** *(cho Recommendation Service)*
- Không qua Gateway
- Response: `{ preferredGenres, preferredLanguages, audioQuality }`
- Không cần Auth middleware (service-to-service trust)

### Acceptance Criteria cần pass
- AC1.2.3: Onboarding idempotent — nếu đã có preferences thì skip
- AC1.2.2: Sau khi save preferences → Kafka User_Preferences_Updated được publish

### Prompt dùng với Claude

```
Đọc CLAUDE.md, aspnet-service/SKILL.md, microservice-api/SKILL.md,
api-contract-first/RULE.md, security-non-negotiable/RULE.md, và
testing-required/RULE.md đính kèm trước khi làm.

Implement User Service (services/user-service/) với các endpoints:
1. GET /api/v1/users/me — trả profile từ PostgreSQL, cache Redis 15m
2. POST /api/v1/users/me/preferences — save preferences + publish Kafka User_Preferences_Updated v1
3. gRPC server: GetUserProfile (proto/user.proto)
4. Internal REST: GET /internal/users/{id}/preferences

Acceptance Criteria cần cover:
- AC1.2.3: idempotent preferences save
- AC1.2.2: Kafka publish sau khi save

Database: PostgreSQL port 5433, connection string từ env USER_DB_CONNECTION_STRING
Redis: port 6379, key pattern user:profile:{userId}, TTL 900s
Kafka: topic User_Preferences_Updated, schema xem docs/contracts/KAFKA_EVENT_CONTRACTS.md

EF Core migration: dotnet ef migrations add InitialCreate
Schema: xem database/DATABASE_SCHEMA.md (tables: users, user_preferences)

Bắt đầu bằng cách điền Contract-First Checklist 8 ô trong
api-contract-first/RULE.md trước khi viết code.
Deliver theo thứ tự: implementation → unit tests → integration tests.
```

### Definition of Done

- [ ] AC1.2.3: `curl GET /api/v1/users/me` → 200 với đúng schema
- [ ] AC1.2.2: Sau `POST /preferences`, Kafka message xuất hiện trong topic `User_Preferences_Updated`
- [ ] Unit tests pass: mock Redis, mock Kafka, mock DB
- [ ] Integration test: `dotnet test services/user-service/tests/User.IntegrationTests`
- [ ] gRPC: `grpcurl localhost:5002 user.UserService/GetUserProfile` không throw UNIMPLEMENTED
- [ ] Verify migration: `psql -h localhost -p 5433 -c '\dt'` thấy đủ tables
- Thời gian ước tính: **1.5 ngày**

---

## Auth Service

### Làm trước khi bắt đầu
Đọc: `docs/originals/API_DESIGN_V2.md` (phần Auth endpoints), `database/DATABASE_SCHEMA.md` (auth_db schema), `docs/contracts/GRPC_CONTRACTS.md`, `proto/user.proto`

### Database: auth_db (PostgreSQL port 5432)
Tables cần tạo: `refresh_tokens`, `token_blacklist`
Schema chi tiết: `database/DATABASE_SCHEMA.md`

### EF Core Migration
```bash
cd services/auth-service/src/Auth.Infrastructure
dotnet ef migrations add InitialCreate --startup-project ../Auth.Api
dotnet ef database update --startup-project ../Auth.Api
# Verify: psql -h localhost -p 5432 -d auth_db
# \dt → refresh_tokens, token_blacklist
```

### Endpoints cần implement

**1. POST /api/v1/auth/login**
- Body: `{ username: string, password: string }`
- Response 200: `{ success, data: { accessToken, expiresIn }, meta }`
  - Cookie: `refreshToken` (HTTP-only, Secure, SameSite=Strict, path=/api/v1/auth/refresh)
- Errors: 400 AUTH_INVALID_CREDENTIALS, 423 ACCOUNT_LOCKED, 429 RATE_LIMIT_EXCEEDED
- Rate limit: 10 req/min per IP+Username (enforce tại Gateway, log tại Auth)
- Brute force: lock sau 5 lần fail — lưu attempt count vào Redis TTL 15m
- Sau login: gọi gRPC `GetUserProfile` từ User Service (timeout 100ms) để lấy role
- Latency budget: 500ms

**2. POST /api/v1/auth/refresh**
- Cookie: refreshToken (HTTP-only)
- Response 200: `{ success, data: { accessToken, expiresIn }, meta }`
- Errors: 401 TOKEN_EXPIRED, 403 TOKEN_REUSED
- Refresh Token Rotation: mỗi lần refresh → issue token mới, revoke token cũ
- Detect reuse: Redis SET NX `rt:used:{jti}` → nếu đã tồn tại → revoke ALL sessions
- Latency budget: 200ms

**3. POST /api/v1/auth/logout**
- Auth: Bearer JWT required
- Cookie: refreshToken
- Action: revoke refresh token + blacklist access token JTI trong Redis
- Response 200: `{ success, data: { loggedOut: true }, meta }`
- Latency budget: 150ms

### Acceptance Criteria cần pass
- AC1.1.1: Login thành công → Bearer token + HTTP-only cookie
- AC1.1.2: Login sai → 400 AUTH_INVALID_CREDENTIALS
- AC1.1.3: > 5 lần fail → 423 ACCOUNT_LOCKED (Backlog V7 ghi là 429 — đây là conflict nhỏ, dùng 423 theo API_DESIGN_V2)
- AC1.1.4: Refresh token reuse → 403 TOKEN_REUSED + revoke all sessions

### Prompt dùng với Claude

```
Đọc CLAUDE.md, aspnet-service/SKILL.md, microservice-api/SKILL.md,
api-contract-first/RULE.md, security-non-negotiable/RULE.md, và
testing-required/RULE.md đính kèm trước khi làm.

Implement Auth Service (services/auth-service/) với các endpoints:
1. POST /api/v1/auth/login — JWT issue + HTTP-only refresh cookie
2. POST /api/v1/auth/refresh — Refresh Token Rotation
3. POST /api/v1/auth/logout — revoke token + blacklist

Acceptance Criteria cần cover:
- AC1.1.1: login thành công → accessToken + HTTP-only refreshToken cookie
- AC1.1.2: login sai → 400 AUTH_INVALID_CREDENTIALS
- AC1.1.3: > 5 fail → lock account → 423 ACCOUNT_LOCKED
- AC1.1.4: refresh token reuse → 403 TOKEN_REUSED + revoke all sessions

Security requirements bắt buộc (security-non-negotiable/RULE.md):
- JWT secret từ env JWT_SECRET — không hardcode
- ValidateLifetime = true, không cho "none" algorithm
- Access token in-memory ở client, refresh token HTTP-only cookie
- Brute force: Redis key auth:attempts:{username}, TTL 900s
- Refresh token reuse: Redis SET NX rt:used:{jti}, TTL = token remaining TTL

gRPC call: sau login thành công, gọi User Service GetUserProfile
(proto/user.proto) để lấy role, timeout 100ms
Fallback nếu gRPC fail: dùng role mặc định "Listener" trong JWT claim

Database: PostgreSQL port 5432, env AUTH_DB_CONNECTION_STRING
Redis: port 6379, password từ env REDIS_PASSWORD

EF Core migration: dotnet ef migrations add InitialCreate
Schema: database/DATABASE_SCHEMA.md (tables: refresh_tokens, token_blacklist)

Bắt đầu bằng cách điền Contract-First Checklist 8 ô trước khi viết code.
```

### Definition of Done

- [ ] AC1.1.1: `curl -X POST http://localhost:5001/api/v1/auth/login -d '{"username":"...","password":"..."}' -c cookies.txt` → 200 + Set-Cookie header
- [ ] AC1.1.2: login sai → 400 `AUTH_INVALID_CREDENTIALS`
- [ ] AC1.1.3: sau 5 fail → 423 `ACCOUNT_LOCKED`
- [ ] AC1.1.4: dùng lại refresh token → 403 `TOKEN_REUSED`
- [ ] JWT verify không có hardcoded secret, đọc từ `JWT_SECRET` env
- [ ] Unit tests pass: mock gRPC client, mock Redis, mock DB
- [ ] Integration test: `dotnet test services/auth-service/tests/Auth.IntegrationTests`
- Thời gian ước tính: **2 ngày**

---

## API Gateway

### Làm trước khi bắt đầu
Đọc: `docs/originals/API_DESIGN_V2.md` (tất cả routes), `docs/contracts/GRPC_CONTRACTS.md`

### Packages cần thêm
```xml
<PackageReference Include="Yarp.ReverseProxy" Version="2.1.*" />
```

### Routing config (appsettings.json)
```json
{
  "ReverseProxy": {
    "Routes": {
      "auth-route": {
        "ClusterId": "auth-cluster",
        "Match": { "Path": "/api/v1/auth/{**catch-all}" }
      },
      "user-route": {
        "ClusterId": "user-cluster",
        "Match": { "Path": "/api/v1/users/{**catch-all}" }
      },
      "music-route": {
        "ClusterId": "music-cluster",
        "Match": { "Path": "/api/v1/music/{**catch-all}" }
      },
      "streaming-route": {
        "ClusterId": "streaming-cluster",
        "Match": { "Path": "/api/v1/streaming/{**catch-all}" }
      },
      "recommendations-route": {
        "ClusterId": "recommendation-cluster",
        "Match": { "Path": "/api/v1/recommendations/{**catch-all}" }
      },
      "search-route": {
        "ClusterId": "search-cluster",
        "Match": { "Path": "/api/v1/search/{**catch-all}" }
      },
      "analytics-route": {
        "ClusterId": "analytics-cluster",
        "Match": { "Path": "/api/v1/analytics/{**catch-all}" }
      },
      "notifications-route": {
        "ClusterId": "notification-cluster",
        "Match": { "Path": "/api/v1/notifications/{**catch-all}" }
      },
      "parties-route": {
        "ClusterId": "party-cluster",
        "Match": { "Path": "/api/v1/parties/{**catch-all}" }
      }
    },
    "Clusters": {
      "auth-cluster": { "Destinations": { "d1": { "Address": "http://auth-service:80" } } },
      "user-cluster": { "Destinations": { "d1": { "Address": "http://user-service:80" } } },
      "music-cluster": { "Destinations": { "d1": { "Address": "http://music-service:80" } } },
      "streaming-cluster": { "Destinations": { "d1": { "Address": "http://streaming-service:80" } } },
      "recommendation-cluster": { "Destinations": { "d1": { "Address": "http://recommendation-service:8000" } } },
      "search-cluster": { "Destinations": { "d1": { "Address": "http://search-service:80" } } },
      "analytics-cluster": { "Destinations": { "d1": { "Address": "http://analytics-service:80" } } },
      "notification-cluster": { "Destinations": { "d1": { "Address": "http://notification-service:80" } } },
      "party-cluster": { "Destinations": { "d1": { "Address": "http://listening-party-service:80" } } }
    }
  }
}
```

### Middleware cần implement tại Gateway

**1. JWT Validation Middleware** — validate trên mọi route ngoại trừ `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/health`
- Verify với HS256, JWT_SECRET từ env
- Check Redis blacklist: `rt:blacklist:{jti}` — nếu có → 401 TOKEN_EXPIRED
- Fallback nếu Auth Service down: dùng cached public key (đọc từ Redis `auth:public-key`)

**2. Rate Limiting Middleware** — dùng Redis Sliding Window
- `/auth/login`: 10 req/min per IP+Username
- Các route khác: 100 req/min per IP
- Response khi vượt: 429 RATE_LIMIT_EXCEEDED

**3. CorrelationId Middleware** — đọc hoặc generate X-Correlation-Id, propagate downstream

**4. Circuit Breaker** — nếu downstream > 2000ms → 503 SERVICE_UNAVAILABLE

### Acceptance Criteria cần pass
- AC0.1.1: request không có JWT → 401
- AC0.1.2: downstream > 2000ms → 503
- AC0.1.3: > 100 req/min → 429

### Prompt dùng với Claude

```
Đọc CLAUDE.md, aspnet-service/SKILL.md, api-contract-first/RULE.md,
security-non-negotiable/RULE.md, và testing-required/RULE.md đính kèm.

Implement API Gateway (services/api-gateway/) với YARP reverse proxy.

Yêu cầu:
1. YARP routing: 9 routes → 9 downstream services
   (config trong appsettings.json — không hardcode trong code)
2. JWT Validation Middleware:
   - Validate HS256, secret từ env JWT_SECRET
   - Skip: /api/v1/auth/login, /api/v1/auth/refresh, /health
   - Check Redis blacklist key rt:blacklist:{jti} — 401 nếu blacklisted
   - Propagate X-Correlation-Id
3. Rate Limiting Middleware (Redis Sliding Window):
   - /auth/login: 10 req/min per IP+Username
   - Other: 100 req/min per IP
   - 429 RATE_LIMIT_EXCEEDED khi vượt
4. Circuit Breaker: downstream > 2000ms → 503 SERVICE_UNAVAILABLE
   (dùng Polly hoặc YARP built-in health checks)

Acceptance Criteria:
- AC0.1.1: no JWT → 401 UNAUTHORIZED
- AC0.1.2: downstream timeout 2s → 503 SERVICE_UNAVAILABLE
- AC0.1.3: 101+ req/min same IP → 429 RATE_LIMIT_EXCEEDED

KHÔNG implement business logic tại Gateway.
KHÔNG gọi database tại Gateway — chỉ Redis cho rate limiting và JWT blacklist.

Bắt đầu bằng cách điền Contract-First Checklist 8 ô trước khi viết code.
```

### Definition of Done

- [ ] AC0.1.1: `curl http://localhost:5000/api/v1/users/me` (no token) → 401
- [ ] AC0.1.3: `for i in {1..101}; do curl -s -o /dev/null http://localhost:5000/api/v1/users/me; done` → cuối cùng nhận 429
- [ ] Routes hoạt động: `curl http://localhost:5000/api/v1/auth/login` forward đúng đến Auth Service
- [ ] Unit tests cho middleware (mock Redis, mock HTTP context)
- Thời gian ước tính: **1.5 ngày**

---

## Checkpoint Cuối Tuần 2 — End-to-End Login Flow

```bash
# Bước 1: Login
curl -s -c cookies.txt -X POST http://localhost:5000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"listener@example.com","password":"Test1234!"}' | jq .

# Expected:
# {
#   "success": true,
#   "data": { "accessToken": "eyJ...", "expiresIn": 900 },
#   "meta": { "apiVersion": "v1", "requestId": "uuid", "timestamp": "ISO8601" },
#   "error": null
# }
# Header: Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict

# Bước 2: Lấy profile (dùng access token)
ACCESS_TOKEN="eyJ..."  # copy từ response trên
curl -s http://localhost:5000/api/v1/users/me \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

# Expected: { "success": true, "data": { "id": "...", "email": "...", "role": "Listener" }, ... }

# Bước 3: Refresh token
curl -s -b cookies.txt -c cookies.txt \
  -X POST http://localhost:5000/api/v1/auth/refresh | jq .

# Expected: { "success": true, "data": { "accessToken": "eyJ... (mới)", ... } }

# Bước 4: Test reuse detection (dùng refresh token cũ lần nữa)
# Lấy lại cookies.txt cũ và POST lại → phải nhận 403 TOKEN_REUSED
```

**Tuần 2 hoàn thành khi:** Tất cả 4 bước trên pass.
