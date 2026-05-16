#!/usr/bin/env bash
# Elasticsearch seed: create 'songs' index + bulk-index 30 real songs
# Run from repo root: bash infra/seed/elasticsearch_seed.sh
# Requires: curl

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
echo "[3/3] Bulk indexing 30 songs..."

curl -s -X POST "$ES_URL/$INDEX/_bulk" \
  -H 'Content-Type: application/x-ndjson' \
  --data-binary '
{"index":{"_id":"b0000001-0000-0000-0000-000000000001"}}
{"id":"b0000001-0000-0000-0000-000000000001","title":"Bước Qua Nhau (Teaser)","artist":"Vũ.","genre":"Indie","mood":"sad","language":"vi","is_explicit":false,"is_published":true,"play_count":1200000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962315/smart-music/covers/buoc-qua-nhau-teaser.jpg","duration_sec":180}
{"index":{"_id":"b0000001-0000-0000-0000-000000000002"}}
{"id":"b0000001-0000-0000-0000-000000000002","title":"Anh Nhớ Ra (ft. Trang)","artist":"Vũ.","genre":"Indie","mood":"sad","language":"vi","is_explicit":false,"is_published":true,"play_count":3800000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962336/smart-music/covers/anh-nho-ra.jpg","duration_sec":240}
{"index":{"_id":"b0000001-0000-0000-0000-000000000003"}}
{"id":"b0000001-0000-0000-0000-000000000003","title":"Anh Nhớ Ra (Live Solo)","artist":"Vũ.","genre":"Acoustic","mood":"chill","language":"vi","is_explicit":false,"is_published":true,"play_count":2100000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962337/smart-music/covers/anh-nho-ra-solo.jpg","duration_sec":250}
{"index":{"_id":"b0000001-0000-0000-0000-000000000004"}}
{"id":"b0000001-0000-0000-0000-000000000004","title":"An Thần","artist":"Low G","genre":"Hip-Hop","mood":"chill","language":"vi","is_explicit":false,"is_published":true,"play_count":4500000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962337/smart-music/covers/an-than.jpg","duration_sec":210}
{"index":{"_id":"b0000001-0000-0000-0000-000000000005"}}
{"id":"b0000001-0000-0000-0000-000000000005","title":"Bút Chì Bạc","artist":"Thắng","genre":"Indie","mood":"chill","language":"vi","is_explicit":false,"is_published":true,"play_count":1900000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962338/smart-music/covers/but-chi-bac.jpg","duration_sec":220}
{"index":{"_id":"b0000001-0000-0000-0000-000000000006"}}
{"id":"b0000001-0000-0000-0000-000000000006","title":"Bước Qua Nhau","artist":"Vũ.","genre":"Indie","mood":"sad","language":"vi","is_explicit":false,"is_published":true,"play_count":8900000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962339/smart-music/covers/buoc-qua-nhau.jpg","duration_sec":255}
{"index":{"_id":"b0000001-0000-0000-0000-000000000007"}}
{"id":"b0000001-0000-0000-0000-000000000007","title":"Chúng Ta Không Thuộc Về Nhau","artist":"Sơn Tùng M-TP","genre":"Pop","mood":"energetic","language":"vi","is_explicit":false,"is_published":true,"play_count":32000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962339/smart-music/covers/chung-ta-khong-thuoc-ve-nhau.jpg","duration_sec":228}
{"index":{"_id":"b0000001-0000-0000-0000-000000000008"}}
{"id":"b0000001-0000-0000-0000-000000000008","title":"Chậm Lại","artist":"Vũ.","genre":"Indie","mood":"chill","language":"vi","is_explicit":false,"is_published":true,"play_count":5200000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962340/smart-music/covers/cham-lai.jpg","duration_sec":235}
{"index":{"_id":"b0000001-0000-0000-0000-000000000009"}}
{"id":"b0000001-0000-0000-0000-000000000009","title":"Ending Interlude","artist":"The Aaron Smith Experience","genre":"Electronic","mood":"atmospheric","language":"en","is_explicit":false,"is_published":true,"play_count":480000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962340/smart-music/covers/ending-interlude.jpg","duration_sec":120}
{"index":{"_id":"b0000001-0000-0000-0000-000000000010"}}
{"id":"b0000001-0000-0000-0000-000000000010","title":"Ghé Qua","artist":"Dick","genre":"Hip-Hop","mood":"chill","language":"vi","is_explicit":false,"is_published":true,"play_count":11000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962341/smart-music/covers/ghe-qua.jpg","duration_sec":215}
{"index":{"_id":"b0000001-0000-0000-0000-000000000011"}}
{"id":"b0000001-0000-0000-0000-000000000011","title":"Gội Đầu","artist":"Thắng","genre":"Indie","mood":"chill","language":"vi","is_explicit":false,"is_published":true,"play_count":3100000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962342/smart-music/covers/goi-dau.jpg","duration_sec":245}
{"index":{"_id":"b0000001-0000-0000-0000-000000000012"}}
{"id":"b0000001-0000-0000-0000-000000000012","title":"Intro 2022","artist":"Sơn Tùng M-TP","genre":"Electronic","mood":null,"language":"vi","is_explicit":false,"is_published":true,"play_count":4200000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962342/smart-music/covers/intro-2022.jpg","duration_sec":90}
{"index":{"_id":"b0000001-0000-0000-0000-000000000013"}}
{"id":"b0000001-0000-0000-0000-000000000013","title":"Lạ Lùng","artist":"Vũ.","genre":"Indie","mood":"sad","language":"vi","is_explicit":false,"is_published":true,"play_count":6700000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962343/smart-music/covers/la-lung.jpg","duration_sec":250}
{"index":{"_id":"b0000001-0000-0000-0000-000000000014"}}
{"id":"b0000001-0000-0000-0000-000000000014","title":"Chuyển Kênh","artist":"Ngọt","genre":"Rock","mood":"energetic","language":"vi","is_explicit":false,"is_published":true,"play_count":7800000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962344/smart-music/covers/chuyen-kenh.jpg","duration_sec":220}
{"index":{"_id":"b0000001-0000-0000-0000-000000000015"}}
{"id":"b0000001-0000-0000-0000-000000000015","title":"Lần Cuối","artist":"Ngọt","genre":"Indie","mood":"sad","language":"vi","is_explicit":false,"is_published":true,"play_count":9200000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962344/smart-music/covers/lan-cuoi.jpg","duration_sec":265}
{"index":{"_id":"b0000001-0000-0000-0000-000000000016"}}
{"id":"b0000001-0000-0000-0000-000000000016","title":"Những Lời Hứa Bỏ Quên","artist":"Vũ.","genre":"Pop","mood":"sad","language":"vi","is_explicit":false,"is_published":true,"play_count":5500000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962345/smart-music/covers/nhung-loi-hua-bo-quen.jpg","duration_sec":270}
{"index":{"_id":"b0000001-0000-0000-0000-000000000017"}}
{"id":"b0000001-0000-0000-0000-000000000017","title":"No Need","artist":"The Aaron Smith Experience","genre":"R&B","mood":"chill","language":"en","is_explicit":false,"is_published":true,"play_count":620000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962346/smart-music/covers/no-need.jpg","duration_sec":195}
{"index":{"_id":"b0000001-0000-0000-0000-000000000018"}}
{"id":"b0000001-0000-0000-0000-000000000018","title":"Nơi Này Có Anh","artist":"Sơn Tùng M-TP","genre":"Pop","mood":"romantic","language":"vi","is_explicit":false,"is_published":true,"play_count":48000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962346/smart-music/covers/noi-nay-co-anh.jpg","duration_sec":321}
{"index":{"_id":"b0000001-0000-0000-0000-000000000019"}}
{"id":"b0000001-0000-0000-0000-000000000019","title":"Nếu Những Tiếc Nuối","artist":"Vũ.","genre":"Indie","mood":"sad","language":"vi","is_explicit":false,"is_published":true,"play_count":4100000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962347/smart-music/covers/neu-nhung-tiec-nuoi.jpg","duration_sec":242}
{"index":{"_id":"b0000001-0000-0000-0000-000000000020"}}
{"id":"b0000001-0000-0000-0000-000000000020","title":"#MusicForM","artist":"PC","genre":"Hip-Hop","mood":"chill","language":"vi","is_explicit":false,"is_published":true,"play_count":7200000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962348/smart-music/covers/music-for-m.jpg","duration_sec":230}
{"index":{"_id":"b0000001-0000-0000-0000-000000000021"}}
{"id":"b0000001-0000-0000-0000-000000000021","title":"Stay with Me (Night Tempo Mix)","artist":"Miki Matsubara","genre":"Electronic","mood":"energetic","language":"ja","is_explicit":false,"is_published":true,"play_count":18000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962348/smart-music/covers/stay-with-me-remix.jpg","duration_sec":270}
{"index":{"_id":"b0000001-0000-0000-0000-000000000022"}}
{"id":"b0000001-0000-0000-0000-000000000022","title":"Cơn Mưa Xa Dần","artist":"Sơn Tùng M-TP","genre":"Pop","mood":"chill","language":"vi","is_explicit":false,"is_published":true,"play_count":22000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962349/smart-music/covers/con-mua-xa-dan.jpg","duration_sec":285}
{"index":{"_id":"b0000001-0000-0000-0000-000000000023"}}
{"id":"b0000001-0000-0000-0000-000000000023","title":"Nắng Ấm Ngang Qua","artist":"Sơn Tùng M-TP","genre":"Pop","mood":"chill","language":"vi","is_explicit":false,"is_published":true,"play_count":19000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962349/smart-music/covers/nang-am-ngang-qua.jpg","duration_sec":278}
{"index":{"_id":"b0000001-0000-0000-0000-000000000024"}}
{"id":"b0000001-0000-0000-0000-000000000024","title":"Mây Lang Thang","artist":"Tùng TeA","genre":"Hip-Hop","mood":"chill","language":"vi","is_explicit":false,"is_published":true,"play_count":13000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962350/smart-music/covers/may-lang-thang.jpg","duration_sec":225}
{"index":{"_id":"b0000001-0000-0000-0000-000000000025"}}
{"id":"b0000001-0000-0000-0000-000000000025","title":"Waiting For","artist":"The Aaron Smith Experience","genre":"R&B","mood":"chill","language":"en","is_explicit":false,"is_published":true,"play_count":890000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962351/smart-music/covers/waiting-for.jpg","duration_sec":210}
{"index":{"_id":"b0000001-0000-0000-0000-000000000026"}}
{"id":"b0000001-0000-0000-0000-000000000026","title":"Bản Tình Ca Không Hoàn Thiện (Live)","artist":"TaynguyenSound","genre":"Hip-Hop","mood":"romantic","language":"vi","is_explicit":false,"is_published":true,"play_count":9800000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962351/smart-music/covers/ban-tinh-ca-khong-hoan-thien.jpg","duration_sec":310}
{"index":{"_id":"b0000001-0000-0000-0000-000000000027"}}
{"id":"b0000001-0000-0000-0000-000000000027","title":"Linh Hồn Của Bữa Tiệc (Live)","artist":"TaynguyenSound","genre":"Hip-Hop","mood":"energetic","language":"vi","is_explicit":false,"is_published":true,"play_count":12000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962352/smart-music/covers/linh-hon-cua-bua-tiec.jpg","duration_sec":280}
{"index":{"_id":"b0000001-0000-0000-0000-000000000028"}}
{"id":"b0000001-0000-0000-0000-000000000028","title":"Thôi Trễ Rồi, Chắc Anh Phải Về Đây (Live)","artist":"TaynguyenSound","genre":"Hip-Hop","mood":"chill","language":"vi","is_explicit":false,"is_published":true,"play_count":8400000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962353/smart-music/covers/thoi-tre-roi.jpg","duration_sec":295}
{"index":{"_id":"b0000001-0000-0000-0000-000000000029"}}
{"id":"b0000001-0000-0000-0000-000000000029","title":"Âm Thầm Bên Em","artist":"Sơn Tùng M-TP","genre":"Pop","mood":"sad","language":"vi","is_explicit":false,"is_published":true,"play_count":16000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962353/smart-music/covers/am-tham-ben-em.jpg","duration_sec":252}
{"index":{"_id":"b0000001-0000-0000-0000-000000000030"}}
{"id":"b0000001-0000-0000-0000-000000000030","title":"真夜中のドア〜Stay with Me","artist":"Miki Matsubara","genre":"Electronic","mood":"romantic","language":"ja","is_explicit":false,"is_published":true,"play_count":85000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962354/smart-music/covers/mayonaka-no-door.jpg","duration_sec":248}
'

echo ""
echo "=== Seed complete. Verifying... ==="

sleep 1

COUNT=$(curl -s "$ES_URL/$INDEX/_count" | grep -o '"count":[0-9]*' | cut -d: -f2)
echo "  Documents indexed: $COUNT"

echo ""
echo "--- Fuzzy search test: 'son tung' ---"
curl -s "$ES_URL/$INDEX/_search?q=son+tung&pretty" | grep '"title"' | head -5

echo ""
echo "--- Fuzzy search test: 'vu.' ---"
curl -s "$ES_URL/$INDEX/_search?q=vu&pretty" | grep '"artist"' | head -5

echo ""
echo "Done. Run 'curl http://localhost:9200/songs/_count' to verify."
