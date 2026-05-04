#!/bin/bash
# Seed MinIO với test audio files
# Dùng mc (MinIO Client) qua docker exec — không cần AWS CLI
#
# Usage (từ repo root):
#   bash infra/seed/s3_seed.sh
#
# Prerequisites:
#   docker compose -f infra/docker-compose.yml up minio -d
#   Chờ MinIO healthy (khoảng 10s) trước khi chạy
#
# Trên Windows (Git Bash): script dùng MSYS_NO_PATHCONV=1 để tránh path conversion

set -e

BUCKET=${AWS_S3_BUCKET:-smartmusic-audio}
CONTAINER=${MINIO_CONTAINER:-smartmusic-minio}
FIXTURE_FILE="tests/fixtures/test-audio.mp3"

echo "=== S3 Seed Script (via docker exec mc) ==="
echo "Bucket   : $BUCKET"
echo "Container: $CONTAINER"
echo ""

# Kiểm tra fixture file tồn tại
if [ ! -f "$FIXTURE_FILE" ]; then
  echo "❌ Test fixture not found: $FIXTURE_FILE"
  echo "   Run from repo root: bash infra/seed/s3_seed.sh"
  exit 1
fi

# Setup mc alias (idempotent)
MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" mc alias set local http://localhost:9000 minioadmin minioadmin --quiet 2>/dev/null || true

# Tạo bucket (ignore error nếu đã tồn tại)
MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" mc mb "local/$BUCKET" 2>/dev/null \
  && echo "✅ Bucket $BUCKET created" \
  || echo "ℹ️  Bucket $BUCKET already exists"

# Upload file trực tiếp từ host qua mc pipe
# Dùng mc pipe để tránh docker cp path conversion issue trên Windows
cat "$FIXTURE_FILE" | MSYS_NO_PATHCONV=1 docker exec -i "$CONTAINER" \
  mc pipe "local/$BUCKET/songs/test-song-001/audio.mp3"

echo "✅ Uploaded test-audio.mp3 → s3://$BUCKET/songs/test-song-001/audio.mp3"

# Verify
echo ""
echo "=== Verifying bucket contents ==="
MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" mc ls "local/$BUCKET/" --recursive

echo ""
echo "✅ S3 seed complete"
