#!/usr/bin/env bash
# Elasticsearch seed: create 'songs' index + bulk-index 10 sample songs
# Run from repo root: bash infra/seed/elasticsearch_seed.sh
# Requires: curl, jq (optional for pretty output)

set -e

ES_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
INDEX="songs"

echo "=== Elasticsearch Seed ==="
echo "Target: $ES_URL/$INDEX"

# ---- health check ----
echo ""
echo "[1/3] Checking Elasticsearch health..."
STATUS=$(curl -s "$ES_URL/_cluster/health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [[ "$STATUS" == "red" ]]; then
  echo "ERROR: Elasticsearch cluster status is RED. Fix before seeding."
  exit 1
fi
echo "  Cluster status: $STATUS (OK)"

# ---- create/recreate index ----
echo ""
echo "[2/3] Creating index '$INDEX' with mapping..."

# Delete if exists (idempotent re-run)
curl -s -o /dev/null -X DELETE "$ES_URL/$INDEX" || true

curl -s -X PUT "$ES_URL/$INDEX" \
  -H 'Content-Type: application/json' \
  -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  },
  "mappings": {
    "properties": {
      "id":           { "type": "keyword" },
      "title":        { "type": "text", "analyzer": "standard" },
      "artist":       { "type": "text", "analyzer": "standard" },
      "album":        { "type": "text" },
      "genre":        { "type": "keyword" },
      "mood":         { "type": "keyword" },
      "language":     { "type": "keyword" },
      "is_explicit":  { "type": "boolean" },
      "is_published": { "type": "boolean" },
      "play_count":   { "type": "long" },
      "cover_url":    { "type": "keyword" },
      "duration_sec": { "type": "integer" }
    }
  }
}'
echo ""
echo "  Index created."

# ---- bulk index ----
echo ""
echo "[3/3] Bulk indexing 10 songs..."

curl -s -X POST "$ES_URL/$INDEX/_bulk" \
  -H 'Content-Type: application/x-ndjson' \
  --data-binary '
{"index":{"_id":"song-001"}}
{"id":"song-001","title":"Noi Nay Co Anh","artist":"Son Tung M-TP","album":"Sky Tour","genre":"V-Pop","mood":["romantic","energetic"],"language":"vi","is_explicit":false,"is_published":true,"play_count":8500000,"cover_url":"https://res.cloudinary.com/demo/image/upload/song-001.jpg","duration_sec":245}
{"index":{"_id":"song-002"}}
{"id":"song-002","title":"Lac Troi","artist":"Son Tung M-TP","album":"Single","genre":"V-Pop","mood":["epic","dramatic"],"language":"vi","is_explicit":false,"is_published":true,"play_count":12000000,"cover_url":"https://res.cloudinary.com/demo/image/upload/song-002.jpg","duration_sec":278}
{"index":{"_id":"song-003"}}
{"id":"song-003","title":"Dai Lo Mat Troi","artist":"Chillies","album":"Dai Lo Mat Troi","genre":"Rock","mood":["energetic","upbeat"],"language":"vi","is_explicit":false,"is_published":true,"play_count":3200000,"cover_url":"https://res.cloudinary.com/demo/image/upload/song-003.jpg","duration_sec":198}
{"index":{"_id":"song-004"}}
{"id":"song-004","title":"May Khi","artist":"Ngot","album":"Ngot","genre":"Indie","mood":["chill","nostalgic"],"language":"vi","is_explicit":false,"is_published":true,"play_count":1800000,"cover_url":"https://res.cloudinary.com/demo/image/upload/song-004.jpg","duration_sec":214}
{"index":{"_id":"song-005"}}
{"id":"song-005","title":"Xanh","artist":"Ngot","album":"Ngot","genre":"Indie","mood":["chill","peaceful"],"language":"vi","is_explicit":false,"is_published":true,"play_count":2100000,"cover_url":"https://res.cloudinary.com/demo/image/upload/song-005.jpg","duration_sec":187}
{"index":{"_id":"song-006"}}
{"id":"song-006","title":"Thay Chua","artist":"Ngot","album":"Ngot","genre":"Indie","mood":["chill","indie"],"language":"vi","is_explicit":false,"is_published":true,"play_count":980000,"cover_url":"https://res.cloudinary.com/demo/image/upload/song-006.jpg","duration_sec":203}
{"index":{"_id":"song-007"}}
{"id":"song-007","title":"Lan Cuoi","artist":"Ngot","album":"Ngot","genre":"Indie","mood":["sad","indie"],"language":"vi","is_explicit":false,"is_published":true,"play_count":1400000,"cover_url":"https://res.cloudinary.com/demo/image/upload/song-007.jpg","duration_sec":231}
{"index":{"_id":"song-008"}}
{"id":"song-008","title":"Vung Ky Uc","artist":"Chillies","album":"Vung Ky Uc","genre":"Pop","mood":["nostalgic","emotional"],"language":"vi","is_explicit":false,"is_published":true,"play_count":2700000,"cover_url":"https://res.cloudinary.com/demo/image/upload/song-008.jpg","duration_sec":256}
{"index":{"_id":"song-009"}}
{"id":"song-009","title":"Neu Nhung Tiec Nuoi","artist":"Vu.","album":"Bao Tang Cua Nuoi Tiec","genre":"Indie","mood":["ballad","emotional"],"language":"vi","is_explicit":false,"is_published":true,"play_count":3500000,"cover_url":"https://res.cloudinary.com/demo/image/upload/song-009.jpg","duration_sec":312}
{"index":{"_id":"song-010"}}
{"id":"song-010","title":"Buoc Qua Mua Co Don","artist":"Vu.","album":"Single","genre":"Indie","mood":["melancholic","pop"],"language":"vi","is_explicit":false,"is_published":true,"play_count":4100000,"cover_url":"https://res.cloudinary.com/demo/image/upload/song-010.jpg","duration_sec":289}
'

echo ""
echo "=== Seed complete. Verifying... ==="

sleep 1

COUNT=$(curl -s "$ES_URL/$INDEX/_count" | grep -o '"count":[0-9]*' | cut -d: -f2)
echo "  Documents indexed: $COUNT"

echo ""
echo "--- Fuzzy search test: 'son tug' ---"
curl -s "$ES_URL/$INDEX/_search?q=son+tug&pretty" | grep '"title"' | head -5

echo ""
echo "--- Fuzzy search test: 'ngot' ---"
curl -s "$ES_URL/$INDEX/_search?q=ngot&pretty" | grep '"artist"' | head -5

echo ""
echo "Done. Run 'curl http://localhost:9200/songs/_count' to verify."
