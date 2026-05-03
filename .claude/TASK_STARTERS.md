# TASK_STARTERS.md — Prompt Templates

Paste prompt starter vào conversation mới, điền các placeholder `[BRACKET]`, đính kèm files theo danh sách.

**Wrap-up bắt buộc sau mỗi task** (trước khi close branch):
1. Ghi `.claude/DEVLOG.md` — bug > 30 phút, quyết định kỹ thuật, workaround
2. Cập nhật `.claude/CURRENT_STATE.md` — tick [x] task xong, điền task tiếp theo
3. Cập nhật `CHANGELOG.md` — thêm vào `[Unreleased]` hoặc chuyển xuống milestone nếu xong hẳn
4. Commit 3 file cùng lúc: `git add .claude/DEVLOG.md .claude/CURRENT_STATE.md CHANGELOG.md`

---

### 1. Implement new C# endpoint

**Files đính kèm:**
- Tầng 1 (luôn): `CLAUDE.md`
- Tầng 2 (task): `aspnet-service/SKILL.md`, `microservice-api/SKILL.md`, `api-contract-first/RULE.md`, `security-non-negotiable/RULE.md`, `testing-required/RULE.md`
- Tầng 3 (tra cứu): `docs/originals/API_DESIGN_V2.md`, `database/DATABASE_SCHEMA.md`, `.github/REDIS_KEY_DESIGN.md`

**Prompt:**
```
Đọc CLAUDE.md, aspnet-service/SKILL.md, microservice-api/SKILL.md,
api-contract-first/RULE.md, security-non-negotiable/RULE.md, và
testing-required/RULE.md đính kèm trước khi làm.

Implement [HTTP_METHOD] [PATH] trong [TÊN SERVICE] (services/[service-folder]/).

Acceptance Criteria cần cover:
- [AC từ Backlog V7 — ví dụ: AC1.1.1]
- [AC từ Backlog V7]

Notes & Constraints từ API Design V2:
- [copy trực tiếp từ cột Notes & Constraints của endpoint này]

Bắt đầu bằng cách điền Contract-First Checklist 8 ô trong
api-contract-first/RULE.md trước khi viết code.
```

---

### 2. Implement new Python FastAPI endpoint

**Files đính kèm:**
- Tầng 1 (luôn): `CLAUDE.md`
- Tầng 2 (task): `fastapi-service/SKILL.md`, `api-contract-first/RULE.md`, `no-scope-creep/RULE.md`, `security-non-negotiable/RULE.md`, `testing-required/RULE.md`
- Tầng 3 (tra cứu): `docs/originals/API_DESIGN_V2.md`, `.github/REDIS_KEY_DESIGN.md`

**Prompt:**
```
Đọc CLAUDE.md, fastapi-service/SKILL.md, api-contract-first/RULE.md,
no-scope-creep/RULE.md, security-non-negotiable/RULE.md, và
testing-required/RULE.md đính kèm trước khi làm.

Implement [HTTP_METHOD] [PATH] trong Recommendation Service
(services/recommendation-service/).

Acceptance Criteria cần cover:
- [AC từ Backlog V7]
- [AC từ Backlog V7]

Constraint bắt buộc: Recommendation chỉ dùng Rule Engine + Redis.
KHÔNG dùng scikit-learn, numpy matrix ops, hay bất kỳ ML library nào.
Rule Engine: final_score = base_score + context_bonus + preference_bonus - skip_penalty.

Bắt đầu bằng cách điền Contract-First Checklist 8 ô trong
api-contract-first/RULE.md trước khi viết code.
```

---

### 3. Implement Kafka consumer

**Files đính kèm:**
- Tầng 1 (luôn): `CLAUDE.md`
- Tầng 2 (task): `[aspnet-service/SKILL.md hoặc fastapi-service/SKILL.md]`, `no-scope-creep/RULE.md`, `security-non-negotiable/RULE.md`, `testing-required/RULE.md`
- Tầng 3 (tra cứu): `docs/contracts/KAFKA_EVENT_CONTRACTS.md`, `docs/contracts/kafka-schemas/[topic].v1.json`, `.github/REDIS_KEY_DESIGN.md`

**Prompt:**
```
Đọc CLAUDE.md, [aspnet-service/SKILL.md hoặc fastapi-service/SKILL.md],
no-scope-creep/RULE.md, security-non-negotiable/RULE.md, và
testing-required/RULE.md đính kèm trước khi làm.

Implement Kafka consumer cho topic [TÊN TOPIC] trong [TÊN SERVICE].

Event schema: xem docs/contracts/kafka-schemas/[topic].v1.json đính kèm.
Consumer phải:
1. Check Redis SET dedup (key: dedup:[TOPIC]:{eventId}, TTL 24h) trước khi xử lý
2. Xử lý: [MÔ TẢ BUSINESS LOGIC]
3. DLQ sau 3 retries Exponential Backoff nếu xử lý thất bại

Viết unit test với mock event payload kiểm tra:
- Happy path: event mới → xử lý thành công
- Duplicate: eventId đã có trong Redis → skip, không xử lý lại

Bắt đầu bằng cách đọc Kafka idempotency pattern trong
KAFKA_EVENT_CONTRACTS.md trước khi viết code.
```

---

### 4. Implement React page/feature

**Files đính kèm:**
- Tầng 1 (luôn): `CLAUDE.md`
- Tầng 2 (task): `react-spa/SKILL.md`, `security-non-negotiable/RULE.md`, `testing-required/RULE.md`
- Tầng 3 (tra cứu): `docs/originals/API_DESIGN_V2.md`

**Prompt:**
```
Đọc CLAUDE.md, react-spa/SKILL.md, security-non-negotiable/RULE.md, và
testing-required/RULE.md đính kèm trước khi làm.

Implement [TÊN FEATURE / TÊN PAGE] trong Frontend SPA
(services/frontend/ hoặc frontend/).

Acceptance Criteria:
- [AC từ Backlog V7]
- [AC từ Backlog V7]

API endpoints cần gọi: xem API_DESIGN_V2.md đính kèm.

Constraint bắt buộc:
- Access Token lưu in-memory (KHÔNG localStorage/sessionStorage)
- Refresh Token trong HTTP-only Cookie — browser tự xử lý
- RBAC check ở backend — frontend chỉ ẩn UI, không trust role từ client

Bắt đầu bằng cách đọc component conventions trong
react-spa/SKILL.md trước khi viết code.
```

---

### 5. Write tests cho service có sẵn

**Files đính kèm:**
- Tầng 1 (luôn): `CLAUDE.md`
- Tầng 2 (task): `testing-required/RULE.md`, `[aspnet-service/SKILL.md hoặc fastapi-service/SKILL.md]`
- Tầng 3 (tra cứu): `docs/testing/TEST_PLAN.md`, `docs/originals/API_DESIGN_V2.md`

**Prompt:**
```
Đọc CLAUDE.md, testing-required/RULE.md, và [aspnet-service/SKILL.md
hoặc fastapi-service/SKILL.md] đính kèm trước khi làm.

Viết tests cho [TÊN SERVICE] — cụ thể: [CLASS/MODULE/ENDPOINT cần test].

ACs cần cover (từ AC Coverage Matrix trong TEST_PLAN.md):
- [ACx.x.x: mô tả]
- [ACx.x.x: mô tả]

Yêu cầu tối thiểu theo testing-required/RULE.md:
- Unit tests: mock Redis, DB, Kafka, S3 — không dùng real infrastructure
- Integration tests (nếu là endpoint): dùng WebApplicationFactory + Testcontainers
- Mỗi test method comment: // ACx.x.x: Given... When... Then...
- Naming: MethodName_Scenario_ExpectedResult (C#) / test_method_scenario_result (Python)

Bắt đầu bằng cách xác nhận đủ 7 test case bắt buộc trong
testing-required/RULE.md Section 2 trước khi viết.
```

---

### 6. Debug / fix bug trong service

**Files đính kèm:**
- Tầng 1 (luôn): `CLAUDE.md`
- Tầng 2 (task): `[aspnet-service/SKILL.md hoặc fastapi-service/SKILL.md]`, `security-non-negotiable/RULE.md`
- Tầng 3 (tra cứu): `docs/originals/API_DESIGN_V2.md`, `docs/contracts/KAFKA_EVENT_CONTRACTS.md`

**Prompt:**
```
Đọc CLAUDE.md và [aspnet-service/SKILL.md hoặc fastapi-service/SKILL.md]
đính kèm trước khi làm.

Bug trong [TÊN SERVICE] — [ENDPOINT hoặc COMPONENT bị lỗi]:

Triệu chứng:
- [mô tả hành vi quan sát được]
- [log / error message nếu có]

Hành vi kỳ vọng (theo API Design V2):
- [mô tả response / behavior đúng]

File liên quan:
- [đường dẫn file nghi ngờ]

Constraint: fix phải backward-compatible — không đổi tên field, không thay
đổi data type, không xóa field trong response (xem api-contract-first/RULE.md).

Sau khi fix, thêm regression test để đảm bảo bug không tái hiện.
```

---

### 7. Review code trước khi merge

**Files đính kèm:**
- Tầng 1 (luôn): `CLAUDE.md`
- Tầng 2 (task): `api-contract-first/RULE.md`, `security-non-negotiable/RULE.md`, `testing-required/RULE.md`, `no-scope-creep/RULE.md`
- Tầng 3 (tra cứu): `docs/originals/API_DESIGN_V2.md`, `conventions/CODING_CONVENTIONS.md`

**Prompt:**
```
Đọc CLAUDE.md, api-contract-first/RULE.md, security-non-negotiable/RULE.md,
testing-required/RULE.md, và no-scope-creep/RULE.md đính kèm trước khi review.

Review code sau đây từ [TÊN SERVICE] — PR: [TIÊU ĐỀ PR hoặc mô tả].

[PASTE CODE CẦN REVIEW]

Checklist review theo thứ tự ưu tiên:
1. Security: JWT, secrets hardcode, input validation, RBAC, PII in logs
2. API contract: response format, error codes, latency budget, breaking change
3. Scope: có gì nằm ngoài MVP scope không (ML, gRPC mới, Kafka topic mới)
4. Tests: có đủ unit + integration test, AC coverage không
5. Code quality: naming, error handling, timeout, idempotency

Với mỗi vấn đề tìm thấy: nêu rõ rule nào vi phạm và cách sửa cụ thể.
```

---

### 8. Tạo database migration

**Files đính kèm:**
- Tầng 1 (luôn): `CLAUDE.md`
- Tầng 2 (task): `aspnet-service/SKILL.md`, `security-non-negotiable/RULE.md`
- Tầng 3 (tra cứu): `database/DATABASE_SCHEMA.md`

**Prompt:**
```
Đọc CLAUDE.md, aspnet-service/SKILL.md, và security-non-negotiable/RULE.md
đính kèm trước khi làm.

Tạo EF Core migration cho [TÊN SERVICE] để [MÔ TẢ THAY ĐỔI SCHEMA].

Schema hiện tại: xem database/DATABASE_SCHEMA.md đính kèm — table [TÊN TABLE].

Thay đổi cần thực hiện:
- [thêm / sửa / xóa column / index / constraint]
- [lý do thay đổi]

Constraint bắt buộc:
- Migration phải backward-compatible (không xóa column đang dùng)
- Không hardcode connection string — đọc từ environment variable
- Index phải được thêm nếu column sẽ dùng trong WHERE clause thường xuyên
- Migration file không cần test (ngoại lệ theo testing-required/RULE.md)

Bắt đầu bằng cách đọc schema hiện tại trong DATABASE_SCHEMA.md để
tránh conflict với indexes và constraints đã có.
```

---

### 9. Implement gRPC call (chỉ Auth ↔ User)

**Files đính kèm:**
- Tầng 1 (luôn): `CLAUDE.md`
- Tầng 2 (task): `aspnet-service/SKILL.md`, `no-scope-creep/RULE.md`, `security-non-negotiable/RULE.md`, `testing-required/RULE.md`
- Tầng 3 (tra cứu): `docs/contracts/GRPC_CONTRACTS.md`, `proto/auth.proto`, `proto/user.proto`

**Prompt:**
```
Đọc CLAUDE.md, aspnet-service/SKILL.md, no-scope-creep/RULE.md,
security-non-negotiable/RULE.md, và testing-required/RULE.md đính kèm trước khi làm.

Implement gRPC call [ValidateToken hoặc GetUserProfile] —
[API Gateway → Auth Service hoặc Auth Service → User Service].

Spec đầy đủ: xem docs/contracts/GRPC_CONTRACTS.md và proto/[file].proto đính kèm.

Constraint bắt buộc (từ no-scope-creep/RULE.md):
- Đây là 1 trong 2 gRPC calls duy nhất được phép trong toàn hệ thống
- Timeout: 100ms — implement CancellationToken, không để vô thời hạn
- Fallback bắt buộc: [mô tả fallback từ GRPC_CONTRACTS.md]
- Circuit Breaker: trigger sau 3 consecutive failures

Bắt đầu bằng cách đọc timeout và fallback spec trong
GRPC_CONTRACTS.md trước khi viết code.
```

---

### 10. Implement WebSocket handler (Listening Party)

**Files đính kèm:**
- Tầng 1 (luôn): `CLAUDE.md`
- Tầng 2 (task): `aspnet-service/SKILL.md`, `no-scope-creep/RULE.md`, `security-non-negotiable/RULE.md`, `testing-required/RULE.md`
- Tầng 3 (tra cứu): `docs/originals/API_DESIGN_V2.md`, `.github/REDIS_KEY_DESIGN.md`

**Prompt:**
```
Đọc CLAUDE.md, aspnet-service/SKILL.md, no-scope-creep/RULE.md,
security-non-negotiable/RULE.md, và testing-required/RULE.md đính kèm trước khi làm.

Implement SignalR handler [TÊN HANDLER / EVENT TYPE] trong
Listening Party Service (services/listening-party-service/).

Acceptance Criteria cần cover:
- [AC từ Backlog V7 — ví dụ: AC7.2.1, AC7.2.2]
- [AC từ Backlog V7]

Constraint bắt buộc:
- Host Authority: chỉ Host mới được gửi PLAYER_ACTION — reject Member ngay tại handler,
  không để business logic quyết định
- Heartbeat: Ping mỗi 30s, Pong timeout 10s → disconnect
- Reconnect: Exponential Backoff (1s → 2s → 4s → max 30s)
- Room state lưu trên Redis (ephemeral) — không persist vào DB
- Event dedup qua eventId: bỏ qua event đã xử lý (Redis SET NX)

Bắt đầu bằng cách đọc Host Authority constraint trong
no-scope-creep/RULE.md và WebSocket spec trong API_DESIGN_V2.md
trước khi viết code.
```
