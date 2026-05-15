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

# Song IDs matching SeedData.sql INSERT INTO songs
SONG_IDS=(
  "11111111-0000-0000-0000-000000000001"
  "11111111-0000-0000-0000-000000000002"
  "11111111-0000-0000-0000-000000000003"
  "11111111-0000-0000-0000-000000000004"
  "11111111-0000-0000-0000-000000000005"
  "11111111-0000-0000-0000-000000000006"
  "11111111-0000-0000-0000-000000000007"
  "11111111-0000-0000-0000-000000000008"
)

echo "Uploading ${#SONG_IDS[@]} placeholder audio files..."
echo ""

for SONG_ID in "${SONG_IDS[@]}"; do
  GCS_PATH="gs://$BUCKET/songs/$SONG_ID/audio.mp3"
  echo -n "  → $GCS_PATH ... "
  if gsutil -q cp "$FIXTURE" "$GCS_PATH"; then
    echo "✅"
  else
    echo "❌ FAILED"
    exit 1
  fi
done

echo ""
echo "=== Verifying uploaded files ==="
gsutil ls "gs://$BUCKET/songs/" | head -20

echo ""
echo "✅ GCS seed complete — ${#SONG_IDS[@]} audio files uploaded."
echo "   Streaming Service pre-signed URLs will work for all seeded songs."
