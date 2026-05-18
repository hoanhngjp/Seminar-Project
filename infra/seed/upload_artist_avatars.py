"""Upload artist avatar images to Cloudinary smart-music/artists/ folder."""
import hashlib
import os
import time
import requests

CLOUD_NAME = "dd9umsxtf"
API_KEY = "641689339377714"
API_SECRET = "LueO1KWYBr9H89WriwlbqMpAQqM"

ARTISTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "tests", "artists_avt")

ARTIST_MAP = [
    ("Dear Jane.jpg",                   "dear-jane"),
    ("Dick.jpg",                        "dick"),
    ("Low G.jpg",                       "low-g"),
    ("Miki Matsubara.jpg",              "miki-matsubara"),
    ("NewoulZ.jpg",                     "newoulz"),
    ("Ngọt.jpg",                        "ngot"),
    ("Night Tempo.jpg",                 "night-tempo"),
    ("PC.jpg",                          "pc"),
    ("Sơn Tùng M-TP.jpg",              "son-tung-mtp"),
    ("TaynguyenSound.jpg",              "taynguyen-sound"),
    ("The Aaron Smith Experience.jpg",  "the-aaron-smith-experience"),
    ("Thắng.jpg",                       "thang"),
    ("Tofu.jpg",                        "tofu"),
    ("Trang.jpg",                       "trang"),
    ("Tùng TeA.jpg",                    "tung-tea"),
    ("vũ.jpg",                          "vu"),
]


def sign(params: dict) -> str:
    payload = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    return hashlib.sha1(f"{payload}{API_SECRET}".encode()).hexdigest()


def upload(filename: str, slug: str) -> str:
    public_id = f"smart-music/artists/{slug}"
    ts = int(time.time())
    sig = sign({"public_id": public_id, "timestamp": ts})

    filepath = os.path.join(ARTISTS_DIR, filename)
    with open(filepath, "rb") as f:
        resp = requests.post(
            f"https://api.cloudinary.com/v1_1/{CLOUD_NAME}/image/upload",
            data={
                "api_key": API_KEY,
                "timestamp": ts,
                "public_id": public_id,
                "signature": sig,
            },
            files={"file": (filename, f, "image/jpeg")},
            timeout=30,
        )
    resp.raise_for_status()
    url = resp.json()["secure_url"]
    sys.stdout.write(f"  OK {filename} -> {url}\n")
    sys.stdout.flush()
    return url


if __name__ == "__main__":
    import sys
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    results = {}
    for filename, slug in ARTIST_MAP:
        try:
            url = upload(filename, slug)
            results[slug] = url
        except Exception as e:
            sys.stdout.write(f"  FAIL {filename}: {e}\n")
            sys.stdout.flush()
            results[slug] = ""

    print("\n--- Cloudinary URLs ---")
    for slug, url in results.items():
        print(f"{slug}: {url}")
