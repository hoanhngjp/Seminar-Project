#!/usr/bin/env python3
"""Seed Elasticsearch with 30 songs. Handles UTF-8 correctly on all platforms."""

import json
import sys
import urllib.request
import urllib.error
import os

ES_URL = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")
INDEX = "songs"

# artist_name → (artist_id, artist_avatar_url)
ARTIST_META = {
    "Vũ.":                    ("a0000001-0000-0000-0000-000000000001", "https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129421/smart-music/artists/vu.jpg"),
    "Sơn Tùng M-TP":          ("a0000001-0000-0000-0000-000000000002", "https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129407/smart-music/artists/son-tung-mtp.jpg"),
    "Ngọt":                   ("a0000001-0000-0000-0000-000000000003", "https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129400/smart-music/artists/ngot.jpg"),
    "TaynguyenSound":         ("a0000001-0000-0000-0000-000000000004", "https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129408/smart-music/artists/taynguyen-sound.jpg"),
    "The Aaron Smith Experience": ("a0000001-0000-0000-0000-000000000005", "https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129411/smart-music/artists/the-aaron-smith-experience.jpg"),
    "Miki Matsubara":         ("a0000001-0000-0000-0000-000000000006", "https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129397/smart-music/artists/miki-matsubara.jpg"),
    "Low G":                  ("a0000001-0000-0000-0000-000000000007", "https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129394/smart-music/artists/low-g.jpg"),
    "Thắng":                  ("a0000001-0000-0000-0000-000000000008", "https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129412/smart-music/artists/thang.jpg"),
    "Dick":                   ("a0000001-0000-0000-0000-000000000009", "https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129392/smart-music/artists/dick.jpg"),
    "Tùng TeA":               ("a0000001-0000-0000-0000-000000000010", "https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129419/smart-music/artists/tung-tea.jpg"),
    "PC":                     ("a0000001-0000-0000-0000-000000000011", "https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129404/smart-music/artists/pc.jpg"),
    "Trang":                  ("a0000001-0000-0000-0000-000000000012", "https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129416/smart-music/artists/trang.jpg"),
}

def _enrich(song):
    """Add artist_id and artist_avatar_url fields from ARTIST_META lookup."""
    meta = ARTIST_META.get(song["artist"])
    if meta:
        song["artist_id"]         = meta[0]
        song["artist_avatar_url"] = meta[1]
    return song

SONGS = [_enrich(s) for s in [
    {"id":"b0000001-0000-0000-0000-000000000001","title":"Bước Qua Nhau (Teaser)","artist":"Vũ.","genre":"Indie","mood":"sad","language":"vi","is_explicit":False,"is_published":True,"play_count":1200000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962315/smart-music/covers/buoc-qua-nhau-teaser.jpg","duration_sec":180},
    {"id":"b0000001-0000-0000-0000-000000000002","title":"Anh Nhớ Ra (ft. Trang)","artist":"Vũ.","genre":"Indie","mood":"sad","language":"vi","is_explicit":False,"is_published":True,"play_count":3800000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962336/smart-music/covers/anh-nho-ra.jpg","duration_sec":240},
    {"id":"b0000001-0000-0000-0000-000000000003","title":"Anh Nhớ Ra (Live Solo)","artist":"Vũ.","genre":"Acoustic","mood":"chill","language":"vi","is_explicit":False,"is_published":True,"play_count":2100000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962337/smart-music/covers/anh-nho-ra-solo.jpg","duration_sec":250},
    {"id":"b0000001-0000-0000-0000-000000000004","title":"An Thần","artist":"Low G","genre":"Hip-Hop","mood":"chill","language":"vi","is_explicit":False,"is_published":True,"play_count":4500000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962337/smart-music/covers/an-than.jpg","duration_sec":210},
    {"id":"b0000001-0000-0000-0000-000000000005","title":"Bút Chì Bạc","artist":"Thắng","genre":"Indie","mood":"chill","language":"vi","is_explicit":False,"is_published":True,"play_count":1900000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962338/smart-music/covers/but-chi-bac.jpg","duration_sec":220},
    {"id":"b0000001-0000-0000-0000-000000000006","title":"Bước Qua Nhau","artist":"Vũ.","genre":"Indie","mood":"sad","language":"vi","is_explicit":False,"is_published":True,"play_count":8900000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962339/smart-music/covers/buoc-qua-nhau.jpg","duration_sec":255},
    {"id":"b0000001-0000-0000-0000-000000000007","title":"Chúng Ta Không Thuộc Về Nhau","artist":"Sơn Tùng M-TP","genre":"Pop","mood":"energetic","language":"vi","is_explicit":False,"is_published":True,"play_count":32000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962339/smart-music/covers/chung-ta-khong-thuoc-ve-nhau.jpg","duration_sec":228},
    {"id":"b0000001-0000-0000-0000-000000000008","title":"Chậm Lại","artist":"Vũ.","genre":"Indie","mood":"chill","language":"vi","is_explicit":False,"is_published":True,"play_count":5200000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962340/smart-music/covers/cham-lai.jpg","duration_sec":235},
    {"id":"b0000001-0000-0000-0000-000000000009","title":"Ending Interlude","artist":"The Aaron Smith Experience","genre":"Electronic","mood":"atmospheric","language":"en","is_explicit":False,"is_published":True,"play_count":480000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962340/smart-music/covers/ending-interlude.jpg","duration_sec":120},
    {"id":"b0000001-0000-0000-0000-000000000010","title":"Ghé Qua","artist":"Dick","genre":"Hip-Hop","mood":"chill","language":"vi","is_explicit":False,"is_published":True,"play_count":11000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962341/smart-music/covers/ghe-qua.jpg","duration_sec":215},
    {"id":"b0000001-0000-0000-0000-000000000011","title":"Gội Đầu","artist":"Thắng","genre":"Indie","mood":"chill","language":"vi","is_explicit":False,"is_published":True,"play_count":3100000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962342/smart-music/covers/goi-dau.jpg","duration_sec":245},
    {"id":"b0000001-0000-0000-0000-000000000012","title":"Intro 2022","artist":"Sơn Tùng M-TP","genre":"Electronic","mood":None,"language":"vi","is_explicit":False,"is_published":True,"play_count":4200000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962342/smart-music/covers/intro-2022.jpg","duration_sec":90},
    {"id":"b0000001-0000-0000-0000-000000000013","title":"Lạ Lùng","artist":"Vũ.","genre":"Indie","mood":"sad","language":"vi","is_explicit":False,"is_published":True,"play_count":6700000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962343/smart-music/covers/la-lung.jpg","duration_sec":250},
    {"id":"b0000001-0000-0000-0000-000000000014","title":"Chuyển Kênh","artist":"Ngọt","genre":"Rock","mood":"energetic","language":"vi","is_explicit":False,"is_published":True,"play_count":7800000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962344/smart-music/covers/chuyen-kenh.jpg","duration_sec":220},
    {"id":"b0000001-0000-0000-0000-000000000015","title":"Lần Cuối","artist":"Ngọt","genre":"Indie","mood":"sad","language":"vi","is_explicit":False,"is_published":True,"play_count":9200000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962344/smart-music/covers/lan-cuoi.jpg","duration_sec":265},
    {"id":"b0000001-0000-0000-0000-000000000016","title":"Những Lời Hứa Bỏ Quên","artist":"Vũ.","genre":"Pop","mood":"sad","language":"vi","is_explicit":False,"is_published":True,"play_count":5500000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962345/smart-music/covers/nhung-loi-hua-bo-quen.jpg","duration_sec":270},
    {"id":"b0000001-0000-0000-0000-000000000017","title":"No Need","artist":"The Aaron Smith Experience","genre":"R&B","mood":"chill","language":"en","is_explicit":False,"is_published":True,"play_count":620000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962346/smart-music/covers/no-need.jpg","duration_sec":195},
    {"id":"b0000001-0000-0000-0000-000000000018","title":"Nơi Này Có Anh","artist":"Sơn Tùng M-TP","genre":"Pop","mood":"romantic","language":"vi","is_explicit":False,"is_published":True,"play_count":48000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962346/smart-music/covers/noi-nay-co-anh.jpg","duration_sec":321},
    {"id":"b0000001-0000-0000-0000-000000000019","title":"Nếu Những Tiếc Nuối","artist":"Vũ.","genre":"Indie","mood":"sad","language":"vi","is_explicit":False,"is_published":True,"play_count":4100000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962347/smart-music/covers/neu-nhung-tiec-nuoi.jpg","duration_sec":242},
    {"id":"b0000001-0000-0000-0000-000000000020","title":"#MusicForM","artist":"PC","genre":"Hip-Hop","mood":"chill","language":"vi","is_explicit":False,"is_published":True,"play_count":7200000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962348/smart-music/covers/music-for-m.jpg","duration_sec":230},
    {"id":"b0000001-0000-0000-0000-000000000021","title":"Stay with Me (Night Tempo Mix)","artist":"Miki Matsubara","genre":"Electronic","mood":"energetic","language":"ja","is_explicit":False,"is_published":True,"play_count":18000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962348/smart-music/covers/stay-with-me-remix.jpg","duration_sec":270},
    {"id":"b0000001-0000-0000-0000-000000000022","title":"Cơn Mưa Xa Dần","artist":"Sơn Tùng M-TP","genre":"Pop","mood":"chill","language":"vi","is_explicit":False,"is_published":True,"play_count":22000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962349/smart-music/covers/con-mua-xa-dan.jpg","duration_sec":285},
    {"id":"b0000001-0000-0000-0000-000000000023","title":"Nắng Ấm Ngang Qua","artist":"Sơn Tùng M-TP","genre":"Pop","mood":"chill","language":"vi","is_explicit":False,"is_published":True,"play_count":19000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962349/smart-music/covers/nang-am-ngang-qua.jpg","duration_sec":278},
    {"id":"b0000001-0000-0000-0000-000000000024","title":"Mây Lang Thang","artist":"Tùng TeA","genre":"Hip-Hop","mood":"chill","language":"vi","is_explicit":False,"is_published":True,"play_count":13000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962350/smart-music/covers/may-lang-thang.jpg","duration_sec":225},
    {"id":"b0000001-0000-0000-0000-000000000025","title":"Waiting For","artist":"The Aaron Smith Experience","genre":"R&B","mood":"chill","language":"en","is_explicit":False,"is_published":True,"play_count":890000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962351/smart-music/covers/waiting-for.jpg","duration_sec":210},
    {"id":"b0000001-0000-0000-0000-000000000026","title":"Bản Tình Ca Không Hoàn Thiện (Live)","artist":"TaynguyenSound","genre":"Hip-Hop","mood":"romantic","language":"vi","is_explicit":False,"is_published":True,"play_count":9800000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962351/smart-music/covers/ban-tinh-ca-khong-hoan-thien.jpg","duration_sec":310},
    {"id":"b0000001-0000-0000-0000-000000000027","title":"Linh Hồn Của Bữa Tiệc (Live)","artist":"TaynguyenSound","genre":"Hip-Hop","mood":"energetic","language":"vi","is_explicit":False,"is_published":True,"play_count":12000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962352/smart-music/covers/linh-hon-cua-bua-tiec.jpg","duration_sec":280},
    {"id":"b0000001-0000-0000-0000-000000000028","title":"Thôi Trễ Rồi, Chắc Anh Phải Về Đây (Live)","artist":"TaynguyenSound","genre":"Hip-Hop","mood":"chill","language":"vi","is_explicit":False,"is_published":True,"play_count":8400000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962353/smart-music/covers/thoi-tre-roi.jpg","duration_sec":295},
    {"id":"b0000001-0000-0000-0000-000000000029","title":"Âm Thầm Bên Em","artist":"Sơn Tùng M-TP","genre":"Pop","mood":"sad","language":"vi","is_explicit":False,"is_published":True,"play_count":16000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962353/smart-music/covers/am-tham-ben-em.jpg","duration_sec":252},
    {"id":"b0000001-0000-0000-0000-000000000030","title":"真夜中のドア〜Stay with Me","artist":"Miki Matsubara","genre":"Electronic","mood":"romantic","language":"ja","is_explicit":False,"is_published":True,"play_count":85000000,"cover_url":"https://res.cloudinary.com/dd9umsxtf/image/upload/v1778962354/smart-music/covers/mayonaka-no-door.jpg","duration_sec":248},
]]

MAPPING = {
    "settings": {"number_of_shards": 1, "number_of_replicas": 0},
    "mappings": {"properties": {
        "id":                 {"type": "keyword"},
        "title":              {"type": "text", "analyzer": "standard"},
        "artist":             {"type": "text", "analyzer": "standard"},
        "artist_id":          {"type": "keyword"},
        "artist_avatar_url":  {"type": "keyword"},
        "genre":              {"type": "keyword"},
        "mood":               {"type": "keyword"},
        "language":           {"type": "keyword"},
        "is_explicit":        {"type": "boolean"},
        "is_published":       {"type": "boolean"},
        "play_count":         {"type": "long"},
        "cover_url":          {"type": "keyword"},
        "duration_sec":       {"type": "integer"},
    }}
}


def req(method, path, body=None):
    url = f"{ES_URL}{path}"
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json"}
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode("utf-8"))


def req_ndjson(path, lines):
    url = f"{ES_URL}{path}"
    data = ("\n".join(lines) + "\n").encode("utf-8")
    headers = {"Content-Type": "application/x-ndjson"}
    r = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    print(f"=== Elasticsearch Seed (Python) ===")
    print(f"Target: {ES_URL}/{INDEX}")

    # Health check
    health = req("GET", "/_cluster/health")
    status = health.get("status", "unknown")
    if status == "red":
        print(f"ERROR: cluster status RED"); sys.exit(1)
    print(f"  Cluster status: {status} (OK)")

    # Delete + recreate index
    req("DELETE", f"/{INDEX}")
    result = req("PUT", f"/{INDEX}", MAPPING)
    if not result.get("acknowledged"):
        print(f"ERROR creating index: {result}"); sys.exit(1)
    print(f"  Index '{INDEX}' created.")

    # Bulk index
    lines = []
    for song in SONGS:
        lines.append(json.dumps({"index": {"_id": song["id"]}}, ensure_ascii=False))
        lines.append(json.dumps(song, ensure_ascii=False))

    result = req_ndjson(f"/{INDEX}/_bulk", lines)
    if result.get("errors"):
        print(f"ERROR in bulk: {json.dumps(result, indent=2, ensure_ascii=False)}")
        sys.exit(1)

    print(f"  Bulk indexed {len(SONGS)} songs (errors: {result['errors']})")

    # Force refresh so count is immediately accurate
    req("POST", f"/{INDEX}/_refresh")

    count_resp = req("GET", f"/{INDEX}/_count")
    count = count_resp.get("count", "?")
    print(f"  Verified: {count} documents in index")

    search = req("POST", f"/{INDEX}/_search", {"query": {"match": {"artist": "Son Tung"}}, "size": 2, "_source": ["title", "artist", "artist_id"]})
    hits = search.get("hits", {}).get("hits", [])
    print(f"  Sample 'Son Tung' hits: {[h['_source']['title'] for h in hits]}")

    print("\nElasticsearch seed complete")


if __name__ == "__main__":
    main()
