# SECRETS_MANAGEMENT.md — Smart Music Streaming Platform

> Quản lý secrets cho môi trường dev và staging. Nhóm 3-4 người.

---

## Ground Rules — Đọc Trước Khi Làm Gì Khác

```
🚫 KHÔNG BAO GIỜ hardcode secret trong source code
🚫 KHÔNG BAO GIỜ commit file .env có giá trị thật lên Git
🚫 KHÔNG BAO GIỜ log secret (password, token, key, connection string)
🚫 KHÔNG BAO GIỜ chia sẻ secret qua chat/email dạng plain text
🚫 KHÔNG BAO GIỜ để secret trong PR description hay comment

✅ Luôn dùng environment variables
✅ Luôn dùng .env.example làm template (safe to commit, không có giá trị thật)
✅ Rotate secret ngay lập tức nếu bị lộ
✅ Chỉ chia sẻ secret qua kênh bảo mật (gặp trực tiếp hoặc Telegram secret chat)
```

---

## 1. Danh Sách Toàn Bộ Secrets

### 1.1 Shared Infrastructure Secrets

Dùng chung bởi nhiều services — quản lý 1 lần trong `.env`.

| Tên biến | Mô tả | Dùng bởi |
|---|---|---|
| `POSTGRES_USER` | PostgreSQL admin username | Auth, User, Music |
| `POSTGRES_PASSWORD` | PostgreSQL admin password | Auth, User, Music |
| `REDIS_PASSWORD` | Redis AUTH password | API Gateway, Auth, User, Recommendation, Streaming, Listening Party, Analytics |
| `MONGO_USERNAME` | MongoDB root username | Notification, Music |
| `MONGO_PASSWORD` | MongoDB root password | Notification, Music |
| `INFLUXDB_TOKEN` | InfluxDB API token (read+write) | Analytics |
| `INFLUXDB_ORG` | InfluxDB organization name | Analytics |
| `INFLUXDB_BUCKET` | InfluxDB bucket name | Analytics |
| `MINIO_ROOT_USER` | MinIO / S3 access key ID | Music, Streaming |
| `MINIO_ROOT_PASSWORD` | MinIO / S3 secret access key | Music, Streaming |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka broker address | Tất cả Kafka producers/consumers |

### 1.2 Per-Service Secrets

| Tên biến | Mô tả | Service |
|---|---|---|
| `JWT_SECRET` | HMAC-SHA256 key ký JWT (tối thiểu 32 ký tự) | Auth (ký), API Gateway (verify offline) |
| `JWT_ACCESS_TOKEN_EXPIRY` | Access token TTL (giây), default: 3600 | Auth |
| `JWT_REFRESH_TOKEN_EXPIRY` | Refresh token TTL (giây), default: 604800 | Auth |
| `AUTH_DB_CONNECTION` | PostgreSQL connection string cho auth_db | Auth |
| `USER_DB_CONNECTION` | PostgreSQL connection string cho user_db | User |
| `MUSIC_DB_CONNECTION` | PostgreSQL connection string cho music_db | Music |
| `NOTIFICATION_MONGO_URI` | MongoDB URI cho notification_db | Notification |
| `MUSIC_MONGO_URI` | MongoDB URI cho music metadata | Music |
| `AWS_ACCESS_KEY_ID` | S3 / MinIO access key | Music, Streaming |
| `AWS_SECRET_ACCESS_KEY` | S3 / MinIO secret key | Music, Streaming |
| `AWS_S3_BUCKET` | S3 bucket name | Music, Streaming |
| `AWS_S3_ENDPOINT` | S3 endpoint URL (MinIO local: `http://minio:9000`) | Music, Streaming |

### 1.3 Environment-Specific Config (non-secret nhưng không hardcode)

| Tên biến | Ví dụ | Dùng bởi |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Development` | Tất cả C# services |
| `REDIS_CONNECTION` | `redis:6379,password=...` | Tất cả services dùng Redis |
| `REDIS_URL` | `redis://:password@redis:6379` | Recommendation (Python) |
| `ELASTICSEARCH_URL` | `http://elasticsearch:9200` | Search |
| `AUTH_SERVICE_URL` | `http://auth-service:80` | API Gateway |
| `USER_SERVICE_URL` | `http://user-service:80` | Auth |
| `MUSIC_SERVICE_URL` | `http://music-service:80` | Streaming, Recommendation |
| `VITE_API_BASE_URL` | `http://localhost:5000` | Frontend |
| `VITE_WS_URL` | `ws://localhost:5005` | Frontend |

---

## 2. Quy Ước File .env

### 2.1 Cấu trúc .env

```bash
# ============================================================
# Smart Music Streaming Platform — Local Development Secrets
# ============================================================
# DANGER: File này chứa secrets THẬT.
#         KHÔNG BAO GIỜ commit file này lên Git.
#         KHÔNG chia sẻ qua chat/email.
# ============================================================

# ── Shared: PostgreSQL ────────────────────────────────────────
POSTGRES_USER=smartmusic
POSTGRES_PASSWORD=<strong-password-here>

# ── Shared: Redis ────────────────────────────────────────────
REDIS_PASSWORD=<redis-password-here>
REDIS_CONNECTION=redis:6379,password=<redis-password-here>
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# ── Shared: MongoDB ──────────────────────────────────────────
MONGO_USERNAME=admin
MONGO_PASSWORD=<mongo-password-here>

# ── Shared: InfluxDB ─────────────────────────────────────────
INFLUXDB_TOKEN=<influxdb-api-token>
INFLUXDB_ORG=smartmusic
INFLUXDB_BUCKET=analytics
INFLUXDB_URL=http://influxdb:8086

# ── Shared: MinIO / S3 ───────────────────────────────────────
MINIO_ROOT_USER=<minio-access-key>
MINIO_ROOT_PASSWORD=<minio-secret-key>
AWS_ACCESS_KEY_ID=${MINIO_ROOT_USER}
AWS_SECRET_ACCESS_KEY=${MINIO_ROOT_PASSWORD}
AWS_S3_BUCKET=smartmusic-audio
AWS_S3_ENDPOINT=http://minio:9000

# ── Shared: Kafka ────────────────────────────────────────────
KAFKA_BOOTSTRAP_SERVERS=kafka:29092

# ── Shared: Elasticsearch ────────────────────────────────────
ELASTICSEARCH_URL=http://elasticsearch:9200

# ── Auth Service ─────────────────────────────────────────────
JWT_SECRET=<minimum-32-character-random-string>
JWT_ACCESS_TOKEN_EXPIRY=3600
JWT_REFRESH_TOKEN_EXPIRY=604800
AUTH_DB_CONNECTION=Host=postgres;Port=5432;Database=auth_db;Username=smartmusic;Password=<postgres-password>

# ── User Service ─────────────────────────────────────────────
USER_DB_CONNECTION=Host=postgres;Port=5432;Database=user_db;Username=smartmusic;Password=<postgres-password>

# ── Music Service ────────────────────────────────────────────
MUSIC_DB_CONNECTION=Host=postgres;Port=5432;Database=music_db;Username=smartmusic;Password=<postgres-password>
MUSIC_MONGO_URI=mongodb://admin:<mongo-password>@mongodb:27017/music_db?authSource=admin

# ── Notification Service ─────────────────────────────────────
NOTIFICATION_MONGO_URI=mongodb://admin:<mongo-password>@mongodb:27017/notification_db?authSource=admin

# ── Internal Service URLs (Docker network) ───────────────────
AUTH_SERVICE_URL=http://auth-service:80
USER_SERVICE_URL=http://user-service:80
MUSIC_SERVICE_URL=http://music-service:80
STREAMING_SERVICE_URL=http://streaming-service:80
RECOMMENDATION_SERVICE_URL=http://recommendation-service:8000

# ── Frontend ─────────────────────────────────────────────────
VITE_API_BASE_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5005
```

### 2.2 Quy Ước Đặt Tên Biến

**Format:** `{SERVICE}_{VARIABLE}` cho per-service, `{COMPONENT}_{VARIABLE}` cho shared.

```bash
✅ JWT_SECRET               # shared, tên rõ ràng
✅ AUTH_DB_CONNECTION       # prefix service tường minh
✅ MINIO_ROOT_PASSWORD      # component name
✅ NOTIFICATION_MONGO_URI   # service_component

❌ DB_PASS                  # mơ hồ — DB nào?
❌ secret                   # không mô tả gì
❌ authDbConnectionString   # sai convention (không phải UPPER_SNAKE)
❌ PASS                     # quá ngắn
```

**Quy tắc:**
- Tất cả `UPPER_SNAKE_CASE`
- Prefix service name cho per-service vars
- Shared infra: tên component làm prefix (`POSTGRES_`, `REDIS_`, `MONGO_`)
- Group theo service, phân cách bằng comment

---

## 3. .gitignore Rules

Thêm vào `.gitignore` ở root của repo:

```gitignore
# ─── Secrets & Environment ──────────────────────────────────
.env
.env.local
.env.*.local
*.env

# Giữ lại .env.example (template an toàn, không có giá trị thật)
!.env.example

# ─── IDE ────────────────────────────────────────────────────
.vs/
.idea/
*.user
.DS_Store
Thumbs.db

# ─── .NET ───────────────────────────────────────────────────
**/bin/
**/obj/
*.user

# ─── Python ─────────────────────────────────────────────────
__pycache__/
*.pyc
.venv/
venv/

# ─── Node / Frontend ────────────────────────────────────────
node_modules/
dist/

# ─── Kubernetes Secrets (nếu có) ────────────────────────────
k8s/secrets/*.yaml

# ─── Logs ───────────────────────────────────────────────────
*.log
logs/
```

---

## 4. Developer Mới Onboard — Lấy Secrets Ở Đâu?

```
Bước 1: Clone repo
  git clone <repo-url>
  cd Seminar-Project

Bước 2: Copy template
  cp .env.example .env

Bước 3: Lấy giá trị thật từ thành viên khác
  → Liên hệ thành viên đã setup môi trường
  → Chia sẻ CHỈ qua kênh bảo mật:
     ✅ Gặp trực tiếp / đọc cho nhau nghe
     ✅ Telegram Secret Chat (end-to-end encrypted)
     ❌ Discord, GitHub Issues/PR, email thường, Messenger

Bước 4: Điền .env
  → Mở .env, thay thế tất cả <placeholder> bằng giá trị thật

Bước 5: Generate JWT_SECRET (nếu cần)
  # PowerShell:
  [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

  # bash/Linux:
  openssl rand -base64 32

Bước 6: Verify
  docker-compose up postgres redis mongodb -d
  # Kiểm tra log — không có lỗi kết nối là OK
```

**Local dev — giá trị gợi ý (KHÔNG dùng trên staging/production):**

| Secret | Giá trị dev đơn giản |
|---|---|
| `POSTGRES_PASSWORD` | `dev_password_local` |
| `REDIS_PASSWORD` | `dev_redis_local` |
| `MONGO_PASSWORD` | `dev_mongo_local` |
| `JWT_SECRET` | `dev-only-secret-key-do-not-use-in-production-32c` |
| `MINIO_ROOT_USER` | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | `minioadmin` |

---

## 5. Code Enforcement — Không Hardcode

### C# — Cách Đúng

```csharp
// ❌ KHÔNG BAO GIỜ LÀM THẾ NÀY
private const string ConnectionString = "Host=localhost;Password=mypassword123";
var jwtSecret = "my-secret-key-hardcoded";

// ✅ ĐÚNG — đọc từ IConfiguration
public class AuthService
{
    private readonly JwtSettings _jwt;

    public AuthService(IOptions<JwtSettings> jwtOptions)
    {
        _jwt = jwtOptions.Value;
    }
}

// appsettings.Development.json chỉ chứa non-secret config
// Secrets đọc từ env vars được map tự động bởi ASP.NET Core:
// Jwt__Secret → JWT_SECRET (environment variable)
// ConnectionStrings__PostgreSQL → CONNECTION_STRINGS__POSTGRESQL

// ✅ ĐÚNG — IOptions<T> pattern
public class JwtSettings
{
    public string Secret { get; init; } = string.Empty;
    public int AccessTokenExpiry { get; init; } = 3600;
    public int RefreshTokenExpiry { get; init; } = 604800;
}

// Program.cs
builder.Services.Configure<JwtSettings>(
    builder.Configuration.GetSection("Jwt"));
```

### Python — Cách Đúng

```python
# ❌ KHÔNG BAO GIỜ LÀM THẾ NÀY
REDIS_PASSWORD = "mypassword123"
JWT_SECRET = "hardcoded-secret-key"

# ✅ ĐÚNG — pydantic-settings đọc từ env vars / .env file
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    redis_url: str
    jwt_secret: str
    influxdb_token: str
    kafka_bootstrap_servers: str
    music_service_url: str

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

settings = Settings()  # Auto-reads from environment / .env

# ✅ ĐÚNG — không bao giờ log secret
import structlog
logger = structlog.get_logger()

# ❌ log secret
logger.info("Connecting", redis_url=settings.redis_url)   # lộ password trong URL

# ✅ chỉ log thông tin an toàn
logger.info("Redis connected", host="redis", port=6379)
```

### Không Log Secret

```csharp
// ❌ LOG SECRET
_logger.LogInformation("Connecting to DB: {ConnStr}", connectionString);  // lộ password
_logger.LogDebug("JWT secret: {Secret}", _jwtSecret);

// ✅ CHỈ LOG THÔNG TIN AN TOÀN
_logger.LogInformation("Connecting to PostgreSQL. Host={Host} Database={Db}", host, database);
_logger.LogInformation("JWT configured. AccessTokenExpiry={Expiry}s", _jwt.AccessTokenExpiry);
```

---

## 6. Quy Trình Xử Lý Khi Secret Bị Lộ

Nếu secret bị commit lên Git, share nhầm qua chat, hoặc xuất hiện trong logs:

```
HÀNH ĐỘNG NGAY (trong vòng 15 phút):

1. Revoke secret bị lộ
   JWT_SECRET bị lộ:
   → Đổi JWT_SECRET trong .env
   → Tất cả JWT cũ sẽ invalid → users phải login lại
   → Thông báo nhóm

   Database password bị lộ:
   → Đổi password trong DB (ALTER USER ... PASSWORD '...')
   → Cập nhật .env

   MinIO/AWS key bị lộ:
   → Xóa key cũ, tạo key mới trong MinIO console

2. Xóa khỏi Git history nếu đã commit
   # Dùng git-filter-repo (cài: pip install git-filter-repo)
   git filter-repo --path .env --invert-paths

   # Hoặc xóa specific string
   git filter-repo --replace-text <(echo '${SECRET_VALUE}==>REDACTED')

   # Force-push (thông báo nhóm trước!)
   git push --force-with-lease origin main

3. Thông báo toàn nhóm
   → Yêu cầu mọi người re-pull và cập nhật .env

4. Kiểm tra log xem có truy cập bất thường không
   → Xem log trong khoảng thời gian từ lúc lộ đến lúc revoke

5. Ghi chú vào SECRETS_MANAGEMENT.md
   → Bài học rút ra, thêm vào quy trình phòng ngừa
```

---

## 7. Kubernetes Secrets (Staging/Production — Optional)

Nếu deploy lên Kubernetes, cấu trúc Secret theo service:

```yaml
# k8s/secrets/auth-service-secret.yaml
# KHÔNG commit file này với giá trị thật!
# Tạo bằng: kubectl create secret generic auth-service-secrets \
#   --from-literal=JWT_SECRET=<value> \
#   --from-literal=AUTH_DB_CONNECTION=<value>

apiVersion: v1
kind: Secret
metadata:
  name: auth-service-secrets
  namespace: smartmusic
type: Opaque
stringData:
  JWT_SECRET: "<value>"
  AUTH_DB_CONNECTION: "<value>"
  REDIS_CONNECTION: "<value>"
```

Dùng trong Deployment:
```yaml
# k8s/deployments/auth-service.yaml
containers:
  - name: auth-service
    env:
      - name: JWT_SECRET
        valueFrom:
          secretKeyRef:
            name: auth-service-secrets
            key: JWT_SECRET
      - name: AUTH_DB_CONNECTION
        valueFrom:
          secretKeyRef:
            name: auth-service-secrets
            key: AUTH_DB_CONNECTION
```

**K8s Secrets phân theo service:**

| Service | Secret Name | Keys |
|---|---|---|
| Auth Service | `auth-service-secrets` | `JWT_SECRET`, `AUTH_DB_CONNECTION`, `REDIS_CONNECTION` |
| User Service | `user-service-secrets` | `USER_DB_CONNECTION`, `REDIS_CONNECTION` |
| Music Service | `music-service-secrets` | `MUSIC_DB_CONNECTION`, `MUSIC_MONGO_URI`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| Streaming Service | `streaming-service-secrets` | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_S3_ENDPOINT` |
| Listening Party | `party-service-secrets` | `REDIS_CONNECTION` |
| Analytics Service | `analytics-service-secrets` | `INFLUXDB_TOKEN`, `INFLUXDB_ORG`, `INFLUXDB_BUCKET` |
| Notification Service | `notification-service-secrets` | `NOTIFICATION_MONGO_URI` |
| Search Service | `search-service-secrets` | `ELASTICSEARCH_URL` |
| Recommendation | `recommendation-service-secrets` | `REDIS_URL`, `KAFKA_BOOTSTRAP_SERVERS` |
| API Gateway | `gateway-secrets` | `REDIS_CONNECTION` |

> `.gitignore` phải bao gồm `k8s/secrets/*.yaml`.

---

## 8. Quick Reference — Toàn Bộ Secrets

| Tên biến | Loại | Service(s) dùng |
|---|---|---|
| `POSTGRES_USER` | Shared infra | Auth, User, Music |
| `POSTGRES_PASSWORD` | Shared infra | Auth, User, Music |
| `REDIS_PASSWORD` | Shared infra | Gateway, Auth, User, Rec, Stream, Party, Analytics |
| `MONGO_USERNAME` | Shared infra | Notification, Music |
| `MONGO_PASSWORD` | Shared infra | Notification, Music |
| `INFLUXDB_TOKEN` | Shared infra | Analytics |
| `INFLUXDB_ORG` | Shared infra | Analytics |
| `INFLUXDB_BUCKET` | Shared infra | Analytics |
| `MINIO_ROOT_USER` | Shared infra | Music, Streaming |
| `MINIO_ROOT_PASSWORD` | Shared infra | Music, Streaming |
| `JWT_SECRET` | Per-service | Auth (sign), Gateway (verify) |
| `AUTH_DB_CONNECTION` | Per-service | Auth |
| `USER_DB_CONNECTION` | Per-service | User |
| `MUSIC_DB_CONNECTION` | Per-service | Music |
| `MUSIC_MONGO_URI` | Per-service | Music |
| `NOTIFICATION_MONGO_URI` | Per-service | Notification |
| `AWS_ACCESS_KEY_ID` | Per-service | Music, Streaming |
| `AWS_SECRET_ACCESS_KEY` | Per-service | Music, Streaming |
| `AWS_S3_BUCKET` | Per-service | Music, Streaming |
| `AWS_S3_ENDPOINT` | Per-service | Music, Streaming |
