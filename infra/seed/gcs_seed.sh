#!/usr/bin/env bash
# ============================================================
# Upload placeholder audio files lên Google Cloud Storage
# cho 8 bài hát đã seed trong SeedData.sql.
#
# Usage (từ repo root):
#   bash infra/seed/gcs_seed.sh
#
# Prerequisites:
#   - gcloud CLI đã cài và đã auth: gcloud auth application-default login
#     HOẶC GOOGLE_APPLICATION_CREDENTIALS trỏ đến service account JSON
#   - GCP_BUCKET_NAME đã tạo sẵn trên GCS
#   - infra/.env đã có GCP_BUCKET_NAME
#   - tests/fixtures/test-audio.mp3 tồn tại (file mp3 bất kỳ, dùng làm placeholder)
#
# Song paths phải khớp với SeedData.sql.S3AudioKey:
#   songs/{songId}/audio.mp3
# ============================================================

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INFRA_DIR="$REPO_ROOT/infra"

# Load .env
if [[ -f "$INFRA_DIR/.env" ]]; then
  set -a
  source "$INFRA_DIR/.env"
  set +a
fi

BUCKET="${GCP_BUCKET_NAME:-}"
FIXTURE="$REPO_ROOT/tests/fixtures/test-audio.mp3"

echo "=== GCS Audio Seed Script ==="
echo "Bucket: $BUCKET"
echo ""

# Validate
if [[ -z "$BUCKET" ]]; then
  echo "❌ GCP_BUCKET_NAME is not set. Set it in infra/.env or export before running."
  exit 1
fi

if [[ ! -f "$FIXTURE" ]]; then
  echo "❌ Placeholder audio not found: $FIXTURE"
  echo "   Create a small MP3 file at tests/fixtures/test-audio.mp3 and retry."
  exit 1
fi

# Song IDs matching SeedData.sql INSERT INTO songs (all 30 songs)
SONG_IDS=(
  "b0000001-0000-0000-0000-000000000001"
  "b0000001-0000-0000-0000-000000000002"
  "b0000001-0000-0000-0000-000000000003"
  "b0000001-0000-0000-0000-000000000004"
  "b0000001-0000-0000-0000-000000000005"
  "b0000001-0000-0000-0000-000000000006"
  "b0000001-0000-0000-0000-000000000007"
  "b0000001-0000-0000-0000-000000000008"
  "b0000001-0000-0000-0000-000000000009"
  "b0000001-0000-0000-0000-000000000010"
  "b0000001-0000-0000-0000-000000000011"
  "b0000001-0000-0000-0000-000000000012"
  "b0000001-0000-0000-0000-000000000013"
  "b0000001-0000-0000-0000-000000000014"
  "b0000001-0000-0000-0000-000000000015"
  "b0000001-0000-0000-0000-000000000016"
  "b0000001-0000-0000-0000-000000000017"
  "b0000001-0000-0000-0000-000000000018"
  "b0000001-0000-0000-0000-000000000019"
  "b0000001-0000-0000-0000-000000000020"
  "b0000001-0000-0000-0000-000000000021"
  "b0000001-0000-0000-0000-000000000022"
  "b0000001-0000-0000-0000-000000000023"
  "b0000001-0000-0000-0000-000000000024"
  "b0000001-0000-0000-0000-000000000025"
  "b0000001-0000-0000-0000-000000000026"
  "b0000001-0000-0000-0000-000000000027"
  "b0000001-0000-0000-0000-000000000028"
  "b0000001-0000-0000-0000-000000000029"
  "b0000001-0000-0000-0000-000000000030"
)

echo "Uploading ${#SONG_IDS[@]} placeholder audio files (skip if already exists)..."
echo ""

UPLOADED=0
SKIPPED=0

for SONG_ID in "${SONG_IDS[@]}"; do
  GCS_PATH="gs://$BUCKET/songs/$SONG_ID/audio.mp3"

  # Idempotency: skip if file already exists on GCS
  if gsutil -q stat "$GCS_PATH" 2>/dev/null; then
    echo "  [skip] $SONG_ID — already exists"
    ((SKIPPED++)) || true
  else
    echo -n "  → $GCS_PATH ... "
    if gsutil -q cp "$FIXTURE" "$GCS_PATH"; then
      echo "✅"
      ((UPLOADED++)) || true
    else
      echo "❌ FAILED"
      exit 1
    fi
  fi
done

echo ""
echo "=== Verifying uploaded files ==="
gsutil ls "gs://$BUCKET/songs/" | head -20

echo ""
echo "✅ GCS seed complete — uploaded: $UPLOADED, skipped: $SKIPPED / ${#SONG_IDS[@]} total."
echo "   Streaming Service pre-signed URLs will work for all seeded songs."
