# GIT_WORKFLOW.md — Smart Music Streaming Platform

> Git workflow cho nhóm 3-4 người, 1 học kỳ. Đủ chặt để nhất quán, đủ nhẹ để không overhead.

---

## 1. Branch Strategy — GitHub Flow

**Chọn GitHub Flow** (không dùng Gitflow).

| | Gitflow | GitHub Flow | Trunk-based |
|---|---|---|---|
| Branches | main + develop + feature + release + hotfix | main + feature | main only |
| Phù hợp | Team lớn, release cycle dài | **Nhóm nhỏ, liên tục merge** | CI/CD mature, feature flags |
| Overhead | Cao | **Thấp** | Thấp nhưng rủi ro cao |

**Lý do chọn GitHub Flow:**
- `main` luôn deployable — bất kỳ commit nào trên main đều có thể demo được
- Feature branch ngắn (< 3 ngày) → ít conflict hơn
- 1 protected branch duy nhất → quy trình đơn giản, dễ enforce với nhóm nhỏ
- Phù hợp với sprint-based workflow của seminar

```
main  ←──────────────────────────────────── protected, luôn deployable
  ↑
  ├── feature/auth-service/refresh-token-rotation
  ├── feature/recommendation-service/rule-engine
  ├── fix/streaming-service/presigned-url-expiry
  ├── chore/docker/elasticsearch-memory-limit
  └── docs/update-database-schema
```

**Quy tắc cứng:**
- `main`: protected — **không push trực tiếp**, chỉ merge qua PR
- Feature branch: tạo từ `main`, merge lại `main` qua PR với ít nhất 1 approval
- Branch lifetime: cố gắng < 3 ngày; nếu dài hơn → chia task nhỏ hơn
- Xóa branch sau khi merge (bật "auto-delete head branches" trên GitHub)

---

## 2. Branch Naming Convention

Format: **`{type}/{scope}/{short-description}`**

### Types

| Type | Khi nào dùng |
|---|---|
| `feature/` | Tính năng mới |
| `fix/` | Sửa bug |
| `refactor/` | Cấu trúc lại code, không đổi behavior |
| `chore/` | Config, dependencies, tooling — không đổi production code |
| `docs/` | Chỉ tài liệu |
| `test/` | Thêm hoặc sửa tests |
| `hotfix/` | Fix khẩn trên main (hiếm) |

### Scopes (tên service hoặc khu vực)

`auth-service` · `user-service` · `music-service` · `streaming-service` · `recommendation-service`
`listening-party` · `analytics-service` · `notification-service` · `search-service` · `api-gateway`
`frontend` · `infra` · `docker` · `proto` · `docs`

### Ví dụ thực tế

```
feature/auth-service/refresh-token-rotation
feature/recommendation-service/context-rule-engine
feature/listening-party/host-reelection
feature/analytics-service/skip-heatmap-endpoint
fix/streaming-service/presigned-url-ttl-900s
fix/user-service/onboarding-idempotency-conflict
fix/api-gateway/circuit-breaker-timeout
refactor/music-service/s3-upload-retry-logic
chore/docker/add-elasticsearch-healthcheck
chore/proto/add-correlation-id-to-validate-token
docs/redis-key-design-listening-party
test/auth-service/token-reuse-integration
```

**Quy tắc đặt tên:**
- Tất cả lowercase, dùng `-` (không dùng `_`, không có space)
- Short description: 3–5 từ, đủ hiểu không cần mở file
- Luôn có scope để biết ngay PR ảnh hưởng service nào

---

## 3. Commit Message — Conventional Commits

### Format

```
{type}({scope}): {mô tả ngắn}

[body — giải thích TẠI SAO, không phải LÀM GÌ]

[footer — breaking change, issue ref]
```

### Types

| Type | Khi nào |
|---|---|
| `feat` | Tính năng mới |
| `fix` | Bug fix |
| `refactor` | Cấu trúc lại, không đổi behavior |
| `chore` | Config, deps, tooling |
| `docs` | Tài liệu |
| `test` | Tests |
| `perf` | Cải thiện performance |
| `ci` | CI/CD pipeline |

### Ví dụ thực tế cho project này

```
feat(auth-service): add refresh token rotation with Redis blacklist

Implements one-time-use refresh tokens per PRD V5 security spec.
On reuse detection, all sessions for the user are immediately revoked
to prevent session hijacking.

feat(recommendation-service): implement time-of-day context rule engine

Morning (6-12h) boosts acoustic/focus tags +0.3.
Evening (18-24h) boosts chill/lounge +0.3.
Fallback to Top 50 Trending if timeout > 300ms.

fix(streaming-service): correct presigned URL TTL from 3600 to 900 seconds

API_DESIGN_V2 specifies 15-minute expiry for security.

feat(listening-party): reject member PLAYER_ACTION at WebSocket handler

Only host (hostId == sender) may send PLAYER_ACTION. Members now
receive REJECTED frame with reason "NOT_HOST".

chore(docker): add healthcheck for elasticsearch container

test(auth-service): add integration test for token reuse attack scenario

refactor(music-service): extract S3 upload logic to dedicated UploadService

feat(api-gateway): add Polly circuit breaker for auth service downstream

Opens after 3 failures, stays open 30s. Fallback: offline JWT verify
using cached public key (auth:pubkey:cache Redis key, TTL 1h).
```

### Quy tắc

- Subject line: tối đa 72 ký tự, **imperative mood** — "add" không phải "added"
- Không dùng dấu `.` ở cuối subject line
- Body: giải thích **TẠI SAO** (diff đã nói lên LÀM GÌ rồi)
- Breaking change: thêm footer `BREAKING CHANGE: <mô tả>`

---

## 4. Pull Request Process

### PR Title

Cùng format với commit message:
```
feat(auth-service): add refresh token rotation
fix(streaming-service): correct presigned URL TTL to 900 seconds
```

### PR Template

Tạo file `.github/pull_request_template.md` (commit file này vào repo):

```markdown
## Summary
<!-- 2-3 câu: PR này làm gì và tại sao? -->

## Changes
<!-- Bullet list các thay đổi chính -->
-
-

## Type of Change
- [ ] `feat` — tính năng mới
- [ ] `fix` — bug fix
- [ ] `refactor` — cấu trúc lại
- [ ] `chore` — config/deps
- [ ] `docs` — tài liệu
- [ ] `test` — chỉ tests

## Testing
- [ ] Unit tests đã thêm/cập nhật
- [ ] Integration tests đã thêm/cập nhật
- [ ] Đã test local với `docker-compose up`
- [ ] Manual test scenario: ___________________________

## Pre-Merge Checklist
- [ ] Build không có lỗi (`dotnet build` / `uvicorn` khởi động)
- [ ] Không có file `.env` hoặc secret được commit
- [ ] Response format dùng `ApiResponse<T>` wrapper đúng spec
- [ ] `CorrelationId` được propagate trong tất cả log statements
- [ ] Redis key tuân theo `REDIS_KEY_DESIGN.md`
- [ ] Error code khớp với `API_DESIGN_V2.md`
- [ ] `CancellationToken` được truyền xuyên suốt async chain (C#)
- [ ] Không hardcode connection string hay port trong code
- [ ] Kafka consumer có idempotency check trước khi xử lý event

## Related
<!-- User Story ID từ Backlog, ví dụ: US-1.1, UC-05 -->
```

### Review Policy

- **1 reviewer bắt buộc** (không phải tác giả) — phù hợp nhóm 3-4 người
- Reviewer kiểm tra: logic đúng, convention tuân thủ, không có secret leak
- Tác giả **không tự merge** PR của mình
- Mục tiêu: review trong vòng **24 giờ**
- PR quá lớn (> 400 lines changed) → đề nghị tách nhỏ

---

## 5. Merge Strategy — Squash and Merge

**Dùng Squash and Merge** (không dùng merge commit, không rebase merge).

**Tại sao Squash:**
- `main` history sạch — mỗi feature = 1 commit có nghĩa
- WIP commits ("fix typo", "oops null check") bị collapse
- Dễ `git revert` toàn bộ 1 feature bằng 1 commit
- Works well với Conventional Commits → history đẹp, dễ đọc

**Sau khi squash merge:**
- Xóa branch (auto-delete hoặc thủ công)
- Squash commit message trên `main` phải đúng Conventional Commit format

---

## 6. Branch Protection Rules (GitHub Settings)

**Settings → Branches → Add rule** cho branch `main`:

```
✅ Require a pull request before merging
   ✅ Require 1 approval
   ✅ Dismiss stale pull request approvals when new commits are pushed
✅ Do not allow bypassing the above settings
✅ Allow auto-delete head branches after merge
```

**CODEOWNERS** (optional) — tự động assign reviewer theo service:

```
# .github/CODEOWNERS
/services/auth-service/              @member-A
/services/user-service/              @member-A
/services/recommendation-service/   @member-B
/services/listening-party-service/  @member-B
/frontend/                           @member-C
/services/music-service/             @member-D
```

---

## 7. Handling Merge Conflicts

### Quy trình chuẩn

```bash
# Bước 1: Trước khi bắt đầu task mới, luôn pull latest main
git checkout main
git pull origin main

# Bước 2: Tạo branch từ main mới nhất
git checkout -b feature/auth-service/my-feature

# Bước 3: Commit thường xuyên, nhỏ và rõ ràng
git add -p   # stage từng hunk — không add nguyên file
git commit -m "feat(auth-service): add token expiry validation"

# Bước 4: Nếu main có commit mới trong khi bạn đang làm — rebase
git fetch origin
git rebase origin/main

# Bước 5: Resolve conflict trong rebase
# Sửa file conflict, sau đó:
git add <file-đã-resolve>
git rebase --continue

# Bước 6: Force-push BRANCH CỦA BẠN (không phải main)
git push --force-with-lease origin feature/auth-service/my-feature
```

### Ngăn Conflict Từ Đầu

| Tình huống | Cách xử lý |
|---|---|
| 2 người cùng sửa 1 file | Thông báo trước trong chat nhóm |
| Branch sống lâu > 3 ngày | Rebase lên main hàng ngày |
| PR quá lớn | Tách theo layer: Controller / Service / Repository |
| Conflict phức tạp | Pair-resolve cùng nhau trên call |

> **Rebase để sync, không merge main vào branch:**
> ```bash
> git rebase origin/main   # ✅ giữ history tuyến tính
> git merge main           # ❌ tạo merge commit rác trên feature branch
> ```

---

## 8. Tagging & Versioning

Đơn giản — tag theo milestone:

```bash
git tag -a v0.1.0 -m "Sprint 1: Auth + User Service + API Gateway"
git tag -a v0.2.0 -m "Sprint 2: Streaming + Recommendation + Search"
git tag -a v0.3.0 -m "Sprint 3: Listening Party + Analytics + Notification"
git tag -a v1.0.0 -m "Final: All services integrated, demo-ready"
git push origin --tags
```

| Tag | Ý nghĩa |
|---|---|
| `v0.x.0` | Sprint deliverable (đang phát triển) |
| `v1.0.0` | Final demo-ready release |
| `v1.0.x` | Bug fix sau demo |

---

## 9. Quick Reference Card

### Workflow hàng ngày

```bash
# ── Bắt đầu task mới ─────────────────────────────────────────
git checkout main && git pull origin main
git checkout -b feature/{scope}/{description}

# ── Trong khi làm ────────────────────────────────────────────
git add -p
git commit -m "feat({scope}): {description}"
git fetch origin && git rebase origin/main   # sync định kỳ

# ── Chuẩn bị PR ──────────────────────────────────────────────
git push origin feature/{scope}/{description}
# → Mở PR trên GitHub → request review → Squash and Merge

# ── Sau khi merge ────────────────────────────────────────────
git checkout main && git pull origin main
git branch -d feature/{scope}/{description}
```

### Wrap-up sau mỗi task (bắt buộc trước khi close branch)

```
1. Ghi .claude/DEVLOG.md
   → Bug mất > 30 phút, quyết định kỹ thuật quan trọng, workaround đáng nhớ

2. Cập nhật .claude/CURRENT_STATE.md
   → Đánh dấu task vừa xong [x], điền "Làm tiếp theo" = task tiếp theo

3. Cập nhật CHANGELOG.md
   → Nếu hoàn thành toàn bộ milestone: chuyển items từ [Unreleased] xuống section milestone
   → Nếu chỉ xong 1 task lẻ: thêm vào [Unreleased] để gom về sau

4. Commit cả 3 file cùng lúc
```

```bash
git add .claude/DEVLOG.md .claude/CURRENT_STATE.md CHANGELOG.md
git commit -m "docs: wrap-up {scope}/{task} — update devlog, state, changelog"
```

### Commit Type Cheatsheet

| Type | Dùng khi |
|---|---|
| `feat` | Thêm tính năng mới |
| `fix` | Sửa bug |
| `refactor` | Cấu trúc lại không đổi behavior |
| `chore` | Config, deps, tooling |
| `docs` | Tài liệu |
| `test` | Tests |
| `perf` | Cải thiện hiệu năng |
| `ci` | CI/CD |

### Commit Nhanh — Scope Reference

```
feat(api-gateway): ...
feat(auth-service): ...
feat(user-service): ...
feat(music-service): ...
feat(streaming-service): ...
feat(recommendation-service): ...
feat(listening-party): ...
feat(analytics-service): ...
feat(notification-service): ...
feat(search-service): ...
feat(frontend): ...
chore(docker): ...
chore(proto): ...
docs(...): ...
```
