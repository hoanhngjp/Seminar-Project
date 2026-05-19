# Docker Local Development Guide

## Prerequisites

| Tool | Minimum version | Notes |
|------|----------------|-------|
| Docker Desktop | 4.x | Enable WSL 2 backend on Windows |
| .NET SDK | 8.0 | For running/debugging C# services outside Docker |
| Python | 3.11 | For the recommendation-service |
| Node.js | 20 LTS | For the frontend |

---

## First-time setup

### 1. Copy and edit the environment file

```bash
cp .env.example .env
```

Open `.env` and change every value marked `changeme_local`, especially:
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `MONGO_PASSWORD`
- `JWT_SECRET` — must be at least 32 characters

### 2. Start the full stack

```bash
docker-compose up -d
```

Wait ~60 seconds for Kafka and Elasticsearch to become healthy before the application services stabilise.

### 3. Create the MinIO bucket

Once MinIO is running, create the audio bucket:

```bash
docker exec smartmusic-minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec smartmusic-minio mc mb local/smartmusic-audio
```

### 4. Run database migrations

Three services use EF Core migrations backed by PostgreSQL. Run them from the repo root:

```bash
# Startup context: --project points to the Infrastructure project containing the DbContext
dotnet ef database update \
  --project services/auth-service/src/AuthService.Infrastructure \
  --startup-project services/auth-service/src/AuthService.Api

dotnet ef database update \
  --project services/user-service/src/UserService.Infrastructure \
  --startup-project services/user-service/src/UserService.Api

dotnet ef database update \
  --project services/music-service/src/MusicService.Infrastructure \
  --startup-project services/music-service/src/MusicService.Api
```

> **Other services do not need EF Core migrations:**
> - `streaming-service` — no relational DB; uses GCS pre-signed URLs only.
> - `listening-party-service` — state is ephemeral in Redis; no persistent schema.
> - `analytics-service` — writes to InfluxDB (time-series) and MongoDB; neither uses EF Core.
> - `notification-service` — uses MongoDB; no EF Core.
> - `search-service` — index managed by Elasticsearch; no EF Core.

### 5. Seed sample data (optional)

```bash
docker exec -it smartmusic-postgres psql -U smartmusic -f /seeds/sample_data.sql
```

---

## Start / stop commands

| Action | Command |
|--------|---------|
| Start everything | `docker-compose up -d` |
| Stop everything (keep data) | `docker-compose stop` |
| Stop and remove containers | `docker-compose down` |
| Stop and wipe all volumes | `docker-compose down -v` |
| Rebuild a service image | `docker-compose build auth-service` |
| Restart a single service | `docker-compose restart auth-service` |

---

## Ports reference

### Infrastructure

| Service | Host port | Purpose |
|---------|-----------|---------|
| PostgreSQL | 5432 | Relational DB |
| MongoDB | 27017 | Document store |
| Redis | 6379 | Cache / pub-sub |
| Elasticsearch | 9200 | Full-text search |
| Kafka | 9092 | Message broker |
| Zookeeper | 2181 | Kafka coordination |
| InfluxDB | 8086 | Time-series metrics |
| MinIO API | 9000 | S3-compatible object storage |
| MinIO Console | 9001 | MinIO web UI |

### Developer tools

| Service | Host port | URL |
|---------|-----------|-----|
| Kafka UI | 8080 | http://localhost:8080 |
| Mongo Express | 8081 | http://localhost:8081 |

### Application services

| Service | Host port | URL |
|---------|-----------|-----|
| api-gateway | 5000 | http://localhost:5000 |
| auth-service | 5001 | http://localhost:5001 |
| user-service | 5002 | http://localhost:5002 |
| music-service | 5003 | http://localhost:5003 |
| streaming-service | 5004 | http://localhost:5004 |
| listening-party-service | 5005 | http://localhost:5005 |
| analytics-service | 5006 | http://localhost:5006 |
| notification-service | 5007 | http://localhost:5007 |
| search-service | 5008 | http://localhost:5008 |
| recommendation-service | 5009 | http://localhost:5009 |
| frontend | 3000 | http://localhost:3000 |

---

## Running a subset of services

Start only the infrastructure layer (useful when running app services natively):

```bash
docker-compose up -d postgres mongodb redis elasticsearch zookeeper kafka influxdb minio
```

Start infra plus a specific app service:

```bash
docker-compose up -d postgres redis kafka auth-service
```

---

## Viewing logs

```bash
# Stream logs for one service
docker-compose logs -f auth-service

# Stream logs for multiple services
docker-compose logs -f auth-service api-gateway

# Last 100 lines for all services
docker-compose logs --tail=100
```

---

## Common troubleshooting

### Kafka is not ready / services keep restarting

Kafka takes 20-30 seconds to become fully ready. The health check on the `kafka` container will gate dependent services, but if you started the stack while Kafka was still initialising you may see restart loops. Fix:

```bash
docker-compose restart auth-service user-service music-service
```

To inspect Kafka health:

```bash
docker exec smartmusic-kafka kafka-broker-api-versions --bootstrap-server localhost:9092
```

### Elasticsearch runs out of memory (OOM killed)

The container is capped at 512 MB. If your host has less than 4 GB free RAM, lower the JVM heap in `docker-compose.yml`:

```yaml
environment:
  - ES_JAVA_OPTS=-Xms128m -Xmx256m
```

On Linux you may also need:

```bash
sudo sysctl -w vm.max_map_count=262144
```

### Port already in use

Find which process owns the port and stop it, or change the host-side port mapping in `docker-compose.yml`:

```bash
# Linux / macOS
lsof -i :5432

# Windows (PowerShell)
netstat -ano | findstr :5432
```

### PostgreSQL init scripts did not run

Init scripts in `./infra/postgres/init/` only execute when the volume is brand new. If you already have a `pgdata` volume, drop it and restart:

```bash
docker-compose down -v
docker-compose up -d
```

### MinIO bucket not found

The bucket must be created manually after first start (see First-time setup step 3). The container does not auto-create buckets.

### Mongo Express shows "Unauthorized"

The default credentials for the Mongo Express UI are:
- Username: `admin`
- Password: whatever you set for `MONGO_PASSWORD` in `.env`

### PostgreSQL port conflict (5432 already in use)

Stop and wipe all volumes, then restart cleanly:

```bash
docker-compose down -v
docker-compose up -d
```

If a system PostgreSQL process owns port 5432, either stop it (`sudo systemctl stop postgresql` on Linux) or remap the host port in `docker-compose.yml` (e.g. `"5433:5432"`) and update `*_DB_CONNECTION_STRING` in `.env` accordingly.

### Google OAuth credentials fail

The auth-service supports optional Google OAuth login. To enable it:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create an **OAuth 2.0 Client ID** (Web application type).
3. Add `http://localhost:5001/signin-google` as an authorised redirect URI.
4. Copy the Client ID and Client Secret into `.env`:

```dotenv
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

If these values are absent the service starts normally; the Google login button will be hidden on the frontend.

### Kafka topic not found

The five required topics are created automatically by the `kafka-init` container on first start. If they are missing (e.g. after `docker-compose down -v`), recreate them manually:

```bash
docker exec smartmusic-kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create --if-not-exists --topic Song_Played \
  --partitions 3 --replication-factor 1

docker exec smartmusic-kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create --if-not-exists --topic Song_Skipped \
  --partitions 3 --replication-factor 1

docker exec smartmusic-kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create --if-not-exists --topic New_Release \
  --partitions 1 --replication-factor 1

docker exec smartmusic-kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create --if-not-exists --topic User_Preferences_Updated \
  --partitions 1 --replication-factor 1

docker exec smartmusic-kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create --if-not-exists --topic Notification_Sent \
  --partitions 1 --replication-factor 1
```

Verify all five topics exist:

```bash
docker exec smartmusic-kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 --list
```

### Elasticsearch not ready

Elasticsearch typically takes 20–30 seconds after the container starts before it accepts connections. Wait and then check the health endpoint:

```bash
curl http://localhost:9200/_cluster/health?pretty
```

Expected: `"status": "green"` or `"yellow"`. If you see a connection-refused error, wait another 30 seconds and retry. A status of `"red"` usually means the JVM heap is too small — see the OOM section above.

### InfluxDB and MongoDB are placeholder services for Phase 2

Both `influxdb` and `mongodb` are included in `docker-compose.yml` and will start with the stack, but **no application service currently writes to them** in the MVP codebase. They are reserved for:
- `analytics-service` → InfluxDB (time-series play events) — Phase 2
- `notification-service` → MongoDB (fan-out store) — Phase 2

You can safely ignore connection-refused logs from these services during local development.

---

## External Credentials

Some features require credentials obtained outside this repository. The table below lists every external dependency, whether it is mandatory, and which service consumes it.

| Credential | Required | Used by |
|---|---|---|
| GCS (Google Cloud Storage) service-account JSON | Mandatory | Music Service (audio upload), Streaming Service (pre-signed URLs) |
| Cloudinary API key / secret / cloud name | Mandatory | Music Service (cover-image upload) |
| Google OAuth Client ID / Secret | Optional | Auth Service (Google login) |
| MinIO (built-in Docker) | Available locally | Alternative to GCS for local development |

### Configuring GCS

1. Create a service account in [Google Cloud Console](https://console.cloud.google.com/) with the **Storage Object Admin** role on your bucket.
2. Download the JSON key file.
3. Set the path in `.env`:

```dotenv
GCS_BUCKET_NAME=your-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/gcs-key.json
```

4. Mount the key file into the Music Service and Streaming Service containers in `docker-compose.yml` (or export `GOOGLE_APPLICATION_CREDENTIALS` in your shell when running services natively).

### Configuring Cloudinary

1. Sign up at [cloudinary.com](https://cloudinary.com/) (free tier is sufficient for development).
2. Copy the three values from the Cloudinary dashboard into `.env`:

```dotenv
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Using MinIO as a local GCS alternative

MinIO is already running at `http://localhost:9000` (console at `http://localhost:9001`). The Music Service and Streaming Service can target MinIO instead of GCS by setting the appropriate S3-compatible endpoint variables in `.env`. See `.env.example` for the exact variable names.
