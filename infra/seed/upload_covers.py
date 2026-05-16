#!/usr/bin/env python3
"""
Upload song cover images to Cloudinary and print the public URLs.
Run from repo root: python infra/seed/upload_covers.py
"""

import os
import cloudinary
import cloudinary.uploader

CLOUD_NAME  = "dd9umsxtf"
API_KEY     = "641689339377714"
API_SECRET  = "LueO1KWYBr9H89WriwlbqMpAQqM"
FOLDER      = "smart-music/covers"
SONGS_PIC   = os.path.join(os.path.dirname(__file__), "..", "..", "songs_pic")

# Map: cloudinary public_id  →  image filename in songs_pic/
MAPPINGS = [
    ("buoc-qua-nhau-teaser",             "buoc_qua_nhau_teaser.jpg"),
    ("anh-nho-ra",                        "anh_nho_ra_feat_trang.jpg"),
    ("anh-nho-ra-solo",                   "anh_nho_ra_solo.jpg"),
    ("an-than",                           "an_than.jpg"),
    ("but-chi-bac",                       "but_chi_bac.jpg"),
    ("buoc-qua-nhau",                     "buoc_qua_nhau.jpg"),
    ("chung-ta-khong-thuoc-ve-nhau",      "chung_ta_khong_thuoc_ve_nhau.jpg"),
    ("cham-lai",                          "cham_lai.jpg"),
    ("ending-interlude",                  "Ending Interlude - The Aaron Smith Experience.jpg"),
    ("ghe-qua",                           "Ghé Qua - Dick x Tofu x PC [Official Audio] - TaynguyenSound Official.jpg"),
    ("goi-dau",                           "goi_dau.jpg"),
    ("intro-2022",                        "intro_2022.jpg"),
    ("la-lung",                           "la_lung.jpg"),
    ("chuyen-kenh",                       "chuyen_kenh.jpg"),
    ("lan-cuoi",                          "lan_cuoi.jpg"),
    ("nhung-loi-hua-bo-quen",             "nhung_loi_hua_bo_quen.jpg"),
    ("no-need",                           "No Need - The Aaron Smith Experience..jpg"),
    ("noi-nay-co-anh",                    "noi_nay_co_anh.jpg"),
    ("neu-nhung-tiec-nuoi",               "neu_nhung_tiec_nuoi.jpg"),
    ("music-for-m",                       "PC - #MusicForM [Music Video] - TaynguyenSound Official.jpg"),
    ("stay-with-me-remix",                "Stay with Me - Night Tempo Showa Groove Mix.jpg"),
    ("con-mua-xa-dan",                    "SƠN TÙNG M-TP _ SKY DECADE _ Cơn Mưa Xa Dần.jpg"),
    ("nang-am-ngang-qua",                 "SƠN TÙNG M-TP _ SKY DECADE _ Nắng Ấm Ngang Qua.jpg"),
    ("may-lang-thang",                    "Tùng TeA & PC - Mây Lang Thang ft. NewoulZ (Official MV) - TaynguyenSound Official.jpg"),
    ("waiting-for",                       "Waiting For - The Aaron Smith Experience.jpg"),
    ("ban-tinh-ca-khong-hoan-thien",      "[Live] Bản Tình Ca Không Hoàn Thiện - TaynguyenSound (Show Văn Nghệ Thường Niên 2) - TaynguyenSound Official.jpg"),
    ("linh-hon-cua-bua-tiec",             "[Live] Linh Hồn Của Bữa Tiệc - TaynguyenSound Live in Hà Nội - TaynguyenSound Official.jpg"),
    ("thoi-tre-roi",                      "[Live] Thôi Trễ Rồi, Chắc Anh Phải Về Đây - TaynguyenSound Live in Hà Nội - TaynguyenSound Official.jpg"),
    ("am-tham-ben-em",                    "am_tham_ben_em.jpg"),
    ("mayonaka-no-door",                  "「真夜中のドア〜stay with me」_ 松原みき Official Lyric Video.jpg"),
]

cloudinary.config(
    cloud_name=CLOUD_NAME,
    api_key=API_KEY,
    api_secret=API_SECRET,
    secure=True,
)

results = []
errors  = []

for public_id, filename in MAPPINGS:
    filepath = os.path.join(SONGS_PIC, filename)
    if not os.path.exists(filepath):
        errors.append(f"  MISSING FILE: {filename}")
        continue
    try:
        res = cloudinary.uploader.upload(
            filepath,
            public_id=f"{FOLDER}/{public_id}",
            overwrite=True,
            resource_type="image",
        )
        url = res["secure_url"]
        results.append((public_id, url))
        print(f"  OK {public_id}")
        print(f"     {url}")
    except Exception as e:
        errors.append(f"  FAIL {public_id}: {e}")
        print(f"  FAIL {public_id}: {e}")

print(f"\nDone: {len(results)}/{len(MAPPINGS)} uploaded")
if errors:
    print("\nErrors:")
    for e in errors:
        print(e)
