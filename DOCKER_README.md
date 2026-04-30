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

Run EF Core migrations for each C# service (from the repo root):

```bash
dotnet ef database update --project services/auth-service
dotnet ef database update --project services/user-service
dotnet ef database update --project services/music-service
dotnet ef database update --project services/streaming-service
dotnet ef database update --project services/listening-party-service
dotnet ef database update --project services/analytics-service
dotnet ef database update --project services/notification-service
```

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
