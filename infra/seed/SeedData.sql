-- ============================================================
-- Smart Music Platform — Seed Data
-- Run AFTER EF Core migrations have applied to music_db and user_db.
-- Usage: psql -h localhost -p 5434 -U smartmusic -d music_db -f SeedData.sql
-- ============================================================

-- ============================================================
-- MUSIC_DB — Genres (9 genres matching Frontend genre picker)
-- ============================================================
\connect music_db

INSERT INTO genres ("Id", "Name", "Slug", "CreatedAt") VALUES
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'Pop',        'pop',        NOW()),
  ('e5f6a7b8-c9d0-1234-efab-567890123456', 'Rock',       'rock',       NOW()),
  ('f6a7b8c9-d0e1-2345-fabc-678901234567', 'R&B',        'rnb',        NOW()),
  ('a7b8c9d0-e1f2-3456-abcd-789012345678', 'Jazz',       'jazz',       NOW()),
  ('b8c9d0e1-f2a3-4567-bcde-890123456789', 'Classical',  'classical',  NOW()),
  ('c9d0e1f2-a3b4-5678-cdef-901234567890', 'Electronic', 'electronic', NOW()),
  ('d0e1f2a3-b4c5-6789-defa-012345678901', 'Hip-Hop',    'hip-hop',    NOW()),
  ('e1f2a3b4-c5d6-7890-efab-123456789012', 'Acoustic',   'acoustic',   NOW()),
  ('f2a3b4c5-d6e7-8901-fabc-234567890123', 'Indie',      'indie',      NOW())
ON CONFLICT ("Id") DO NOTHING;

-- ============================================================
-- MUSIC_DB — Artists (16 artists + 1 demo artist)
-- Note: UserId values are fake — no FK constraint to user_db.
--       artist_id prefix: a0000001-0000-0000-0000-0000000000XX
-- ============================================================

INSERT INTO artists (
  "Id", "UserId", "StageName", "Bio", "Country", "Verified",
  "TotalFollowers", "TotalPlays", "CreatedAt", "UpdatedAt"
) VALUES
  -- Demo artist (linked to creator@example.com in user-service DbInitializer seed)
  ('aa111111-bbbb-cccc-dddd-eeeeeeeeeeee',
   'b2c3d4e5-f6a7-8901-bcde-f12345678901',
   'Test Artist', 'Demo artist for Smart Music Platform', 'VN', true, 0, 0, NOW(), NOW()),

  ('a0000001-0000-0000-0000-000000000001',
   'f0000001-0000-0000-0000-000000000001',
   'Vũ.', 'Indie-pop singer-songwriter from Vietnam', 'VN', true, 850000, 45000000, NOW(), NOW()),

  ('a0000001-0000-0000-0000-000000000002',
   'f0000001-0000-0000-0000-000000000002',
   'Sơn Tùng M-TP', 'Vietnamese pop superstar', 'VN', true, 5200000, 210000000, NOW(), NOW()),

  ('a0000001-0000-0000-0000-000000000003',
   'f0000001-0000-0000-0000-000000000003',
   'Ngọt', 'Vietnamese indie rock band', 'VN', true, 420000, 18000000, NOW(), NOW()),

  ('a0000001-0000-0000-0000-000000000004',
   'f0000001-0000-0000-0000-000000000004',
   'TaynguyenSound', 'Vietnamese hip-hop collective', 'VN', true, 380000, 22000000, NOW(), NOW()),

  ('a0000001-0000-0000-0000-000000000005',
   'f0000001-0000-0000-0000-000000000005',
   'The Aaron Smith Experience', 'R&B / Electronic artist', 'US', true, 95000, 3200000, NOW(), NOW()),

  ('a0000001-0000-0000-0000-000000000006',
   'f0000001-0000-0000-0000-000000000006',
   'Miki Matsubara', 'Japanese city pop legend', 'JP', true, 1200000, 95000000, NOW(), NOW()),

  ('a0000001-0000-0000-0000-000000000007',
   'f0000001-0000-0000-0000-000000000007',
   'Low G', 'Vietnamese rapper', 'VN', true, 180000, 9500000, NOW(), NOW()),

  ('a0000001-0000-0000-0000-000000000008',
   'f0000001-0000-0000-0000-000000000008',
   'Thắng', 'Vietnamese indie artist', 'VN', true, 120000, 5800000, NOW(), NOW()),

  ('a0000001-0000-0000-0000-000000000009',
   'f0000001-0000-0000-0000-000000000009',
   'Dick', 'Vietnamese rapper / TaynguyenSound', 'VN', true, 290000, 14000000, NOW(), NOW()),

  ('a0000001-0000-0000-0000-000000000010',
   'f0000001-0000-0000-0000-000000000010',
   'Tùng TeA', 'Vietnamese rapper / TaynguyenSound', 'VN', true, 210000, 11000000, NOW(), NOW()),

  ('a0000001-0000-0000-0000-000000000011',
   'f0000001-0000-0000-0000-000000000011',
   'PC', 'Vietnamese rapper / TaynguyenSound', 'VN', true, 175000, 8200000, NOW(), NOW()),

  ('a0000001-0000-0000-0000-000000000012',
   'f0000001-0000-0000-0000-000000000012',
   'Trang', 'Vietnamese vocalist', 'VN', true, 65000, 2100000, NOW(), NOW()),

  ('a0000001-0000-0000-0000-000000000013',
   'f0000001-0000-0000-0000-000000000013',
   'Dear Jane', 'Hong Kong rock band', 'HK', true, 320000, 16000000, NOW(), NOW()),

  ('a0000001-0000-0000-0000-000000000014',
   'f0000001-0000-0000-0000-000000000014',
   'Night Tempo', 'Japanese city pop DJ / remixer', 'JP', true, 480000, 28000000, NOW(), NOW()),

  ('a0000001-0000-0000-0000-000000000015',
   'f0000001-0000-0000-0000-000000000015',
   'Tofu', 'Vietnamese rapper / TaynguyenSound', 'VN', true, 145000, 6500000, NOW(), NOW()),

  ('a0000001-0000-0000-0000-000000000016',
   'f0000001-0000-0000-0000-000000000016',
   'NewoulZ', 'Vietnamese rapper', 'VN', true, 88000, 3900000, NOW(), NOW())
ON CONFLICT ("Id") DO NOTHING;

-- ============================================================
-- MUSIC_DB — Songs (30 songs — storage_key = actual GCS object path)
-- Genre IDs:
--   Pop:        d4e5f6a7-b8c9-0123-defa-234567890123
--   Rock:       e5f6a7b8-c9d0-1234-efab-567890123456
--   R&B:        f6a7b8c9-d0e1-2345-fabc-678901234567
--   Electronic: c9d0e1f2-a3b4-5678-cdef-901234567890
--   Hip-Hop:    d0e1f2a3-b4c5-6789-defa-012345678901
--   Acoustic:   e1f2a3b4-c5d6-7890-efab-123456789012
--   Indie:      f2a3b4c5-d6e7-8901-fabc-234567890123
-- ============================================================

INSERT INTO songs (
  "Id", "ArtistId", "AlbumId", "Title", "DurationSec",
  "S3AudioKey", "CoverImageUrl", "Language", "Mood",
  "IsExplicit", "IsPublished", "PlayCount",
  "CreatedAt", "UpdatedAt"
) VALUES
  -- 1: Bước Qua Nhau (Teaser) — Vũ.
  ('s0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000001', NULL,
   'Bước Qua Nhau (Teaser)', 180,
   'songs/(MV TEASER) BƯỚC QUA NHAU.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/buoc-qua-nhau-teaser.jpg',
   'vi', 'sad', false, true, 1200000, NOW(), NOW()),

  -- 2: Anh Nhớ Ra (ft. Trang) — Vũ.
  ('s0000001-0000-0000-0000-000000000002',
   'a0000001-0000-0000-0000-000000000001', NULL,
   'Anh Nhớ Ra (ft. Trang)', 240,
   'songs/ANH NHỚ RA - Vũ. (Feat. Trang).mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/anh-nho-ra.jpg',
   'vi', 'sad', false, true, 3800000, NOW(), NOW()),

  -- 3: Anh Nhớ Ra (Live Solo) — Vũ.
  ('s0000001-0000-0000-0000-000000000003',
   'a0000001-0000-0000-0000-000000000001', NULL,
   'Anh Nhớ Ra (Live Solo)', 250,
   'songs/ANH NHỚ RA - Vũ. (Solo Version) Live Session.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/anh-nho-ra-solo.jpg',
   'vi', 'chill', false, true, 2100000, NOW(), NOW()),

  -- 4: An Thần — Low G
  ('s0000001-0000-0000-0000-000000000004',
   'a0000001-0000-0000-0000-000000000007', NULL,
   'An Thần', 210,
   'songs/An Thần.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/an-than.jpg',
   'vi', 'chill', false, true, 4500000, NOW(), NOW()),

  -- 5: Bút Chì Bạc — Thắng
  ('s0000001-0000-0000-0000-000000000005',
   'a0000001-0000-0000-0000-000000000008', NULL,
   'Bút Chì Bạc', 220,
   'songs/Bút Chì Bạc.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/but-chi-bac.jpg',
   'vi', 'chill', false, true, 1900000, NOW(), NOW()),

  -- 6: Bước Qua Nhau — Vũ.
  ('s0000001-0000-0000-0000-000000000006',
   'a0000001-0000-0000-0000-000000000001', NULL,
   'Bước Qua Nhau', 255,
   'songs/BƯỚC QUA NHAU Vũ. (Official MV).mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/buoc-qua-nhau.jpg',
   'vi', 'sad', false, true, 8900000, NOW(), NOW()),

  -- 7: Chúng Ta Không Thuộc Về Nhau — Sơn Tùng M-TP
  ('s0000001-0000-0000-0000-000000000007',
   'a0000001-0000-0000-0000-000000000002', NULL,
   'Chúng Ta Không Thuộc Về Nhau', 228,
   'songs/Chúng Ta Không Thuộc Về Nhau.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/chung-ta-khong-thuoc-ve-nhau.jpg',
   'vi', 'energetic', false, true, 32000000, NOW(), NOW()),

  -- 8: Chậm Lại — Vũ.
  ('s0000001-0000-0000-0000-000000000008',
   'a0000001-0000-0000-0000-000000000001', NULL,
   'Chậm Lại', 235,
   'songs/Chậm Lại.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/cham-lai.jpg',
   'vi', 'chill', false, true, 5200000, NOW(), NOW()),

  -- 9: Ending Interlude — The Aaron Smith Experience
  ('s0000001-0000-0000-0000-000000000009',
   'a0000001-0000-0000-0000-000000000005', NULL,
   'Ending Interlude', 120,
   'songs/Ending Interlude - The Aaron Smith Experience.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/ending-interlude.jpg',
   'en', 'atmospheric', false, true, 480000, NOW(), NOW()),

  -- 10: Ghé Qua — Dick
  ('s0000001-0000-0000-0000-000000000010',
   'a0000001-0000-0000-0000-000000000009', NULL,
   'Ghé Qua', 215,
   'songs/Ghé Qua - Dick x Tofu x PC [Official Audio] - TaynguyenSound Official.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/ghe-qua.jpg',
   'vi', 'chill', false, true, 11000000, NOW(), NOW()),

  -- 11: Gội Đầu — Thắng
  ('s0000001-0000-0000-0000-000000000011',
   'a0000001-0000-0000-0000-000000000008', NULL,
   'Gội Đầu', 245,
   'songs/Gội Đầu.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/goi-dau.jpg',
   'vi', 'chill', false, true, 3100000, NOW(), NOW()),

  -- 12: Intro 2022 — Sơn Tùng M-TP
  ('s0000001-0000-0000-0000-000000000012',
   'a0000001-0000-0000-0000-000000000002', NULL,
   'Intro 2022', 90,
   'songs/Intro 2022.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/intro-2022.jpg',
   'vi', NULL, false, true, 4200000, NOW(), NOW()),

  -- 13: Lạ Lùng — Vũ.
  ('s0000001-0000-0000-0000-000000000013',
   'a0000001-0000-0000-0000-000000000001', NULL,
   'Lạ Lùng', 250,
   'songs/Lạ Lùng.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/la-lung.jpg',
   'vi', 'sad', false, true, 6700000, NOW(), NOW()),

  -- 14: Chuyển Kênh — Ngọt
  ('s0000001-0000-0000-0000-000000000014',
   'a0000001-0000-0000-0000-000000000003', NULL,
   'Chuyển Kênh', 220,
   'songs/Ngọt - CHUYỂN KÊNH (sản phẩm này không phải là thuốc).mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/chuyen-kenh.jpg',
   'vi', 'energetic', false, true, 7800000, NOW(), NOW()),

  -- 15: Lần Cuối — Ngọt
  ('s0000001-0000-0000-0000-000000000015',
   'a0000001-0000-0000-0000-000000000003', NULL,
   'Lần Cuối', 265,
   'songs/Ngọt - LẦN CUỐI (đi bên em xót xa người ơi).mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/lan-cuoi.jpg',
   'vi', 'sad', false, true, 9200000, NOW(), NOW()),

  -- 16: Những Lời Hứa Bỏ Quên — Vũ.
  ('s0000001-0000-0000-0000-000000000016',
   'a0000001-0000-0000-0000-000000000001', NULL,
   'Những Lời Hứa Bỏ Quên', 270,
   'songs/Những Lời Hứa Bỏ Quên.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/nhung-loi-hua-bo-quen.jpg',
   'vi', 'sad', false, true, 5500000, NOW(), NOW()),

  -- 17: No Need — The Aaron Smith Experience
  ('s0000001-0000-0000-0000-000000000017',
   'a0000001-0000-0000-0000-000000000005', NULL,
   'No Need', 195,
   'songs/No Need - The Aaron Smith Experience.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/no-need.jpg',
   'en', 'chill', false, true, 620000, NOW(), NOW()),

  -- 18: Nơi Này Có Anh — Sơn Tùng M-TP
  ('s0000001-0000-0000-0000-000000000018',
   'a0000001-0000-0000-0000-000000000002', NULL,
   'Nơi Này Có Anh', 321,
   'songs/Nơi Này Có Anh.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/noi-nay-co-anh.jpg',
   'vi', 'romantic', false, true, 48000000, NOW(), NOW()),

  -- 19: Nếu Những Tiếc Nuối — Vũ.
  ('s0000001-0000-0000-0000-000000000019',
   'a0000001-0000-0000-0000-000000000001', NULL,
   'Nếu Những Tiếc Nuối', 242,
   'songs/Nếu Những Tiếc Nuối.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/neu-nhung-tiec-nuoi.jpg',
   'vi', 'sad', false, true, 4100000, NOW(), NOW()),

  -- 20: #MusicForM — PC
  ('s0000001-0000-0000-0000-000000000020',
   'a0000001-0000-0000-0000-000000000011', NULL,
   '#MusicForM', 230,
   'songs/PC - #MusicForM [Music Video] - TaynguyenSound Official.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/music-for-m.jpg',
   'vi', 'chill', false, true, 7200000, NOW(), NOW()),

  -- 21: Stay with Me (Night Tempo Mix) — Miki Matsubara ft. Night Tempo
  ('s0000001-0000-0000-0000-000000000021',
   'a0000001-0000-0000-0000-000000000006', NULL,
   'Stay with Me (Night Tempo Mix)', 270,
   'songs/Stay with Me - Night Tempo Showa Groove Mix.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/stay-with-me-remix.jpg',
   'ja', 'energetic', false, true, 18000000, NOW(), NOW()),

  -- 22: Cơn Mưa Xa Dần — Sơn Tùng M-TP
  ('s0000001-0000-0000-0000-000000000022',
   'a0000001-0000-0000-0000-000000000002', NULL,
   'Cơn Mưa Xa Dần', 285,
   'songs/SƠN TÙNG M-TP _ SKY DECADE _ Cơn Mưa Xa Dần.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/con-mua-xa-dan.jpg',
   'vi', 'chill', false, true, 22000000, NOW(), NOW()),

  -- 23: Nắng Ấm Ngang Qua — Sơn Tùng M-TP
  ('s0000001-0000-0000-0000-000000000023',
   'a0000001-0000-0000-0000-000000000002', NULL,
   'Nắng Ấm Ngang Qua', 278,
   'songs/SƠN TÙNG M-TP _ SKY DECADE _ Nắng Ấm Ngang Qua.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/nang-am-ngang-qua.jpg',
   'vi', 'chill', false, true, 19000000, NOW(), NOW()),

  -- 24: Mây Lang Thang — Tùng TeA ft. PC, NewoulZ
  ('s0000001-0000-0000-0000-000000000024',
   'a0000001-0000-0000-0000-000000000010', NULL,
   'Mây Lang Thang', 225,
   'songs/Tùng TeA & PC - Mây Lang Thang ft. NewoulZ (Official MV) - TaynguyenSound Official.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/may-lang-thang.jpg',
   'vi', 'chill', false, true, 13000000, NOW(), NOW()),

  -- 25: Waiting For — The Aaron Smith Experience
  ('s0000001-0000-0000-0000-000000000025',
   'a0000001-0000-0000-0000-000000000005', NULL,
   'Waiting For', 210,
   'songs/Waiting For - The Aaron Smith Experience.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/waiting-for.jpg',
   'en', 'chill', false, true, 890000, NOW(), NOW()),

  -- 26: Bản Tình Ca Không Hoàn Thiện (Live) — TaynguyenSound
  ('s0000001-0000-0000-0000-000000000026',
   'a0000001-0000-0000-0000-000000000004', NULL,
   'Bản Tình Ca Không Hoàn Thiện (Live)', 310,
   'songs/[Live] Bản Tình Ca Không Hoàn Thiện - TaynguyenSound (Show Văn Nghệ Thường Niên 2) - TaynguyenSound Official.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/ban-tinh-ca-khong-hoan-thien.jpg',
   'vi', 'romantic', false, true, 9800000, NOW(), NOW()),

  -- 27: Linh Hồn Của Bữa Tiệc (Live) — TaynguyenSound
  ('s0000001-0000-0000-0000-000000000027',
   'a0000001-0000-0000-0000-000000000004', NULL,
   'Linh Hồn Của Bữa Tiệc (Live)', 280,
   'songs/[Live] Linh Hồn Của Bữa Tiệc - TaynguyenSound Live in Hà Nội - TaynguyenSound Official.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/linh-hon-cua-bua-tiec.jpg',
   'vi', 'energetic', false, true, 12000000, NOW(), NOW()),

  -- 28: Thôi Trễ Rồi, Chắc Anh Phải Về Đây (Live) — TaynguyenSound
  ('s0000001-0000-0000-0000-000000000028',
   'a0000001-0000-0000-0000-000000000004', NULL,
   'Thôi Trễ Rồi, Chắc Anh Phải Về Đây (Live)', 295,
   'songs/[Live] Thôi Trễ Rồi, Chắc Anh Phải Về Đây - TaynguyenSound Live in Hà Nội - TaynguyenSound Official.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/thoi-tre-roi.jpg',
   'vi', 'chill', false, true, 8400000, NOW(), NOW()),

  -- 29: Âm Thầm Bên Em — Sơn Tùng M-TP
  ('s0000001-0000-0000-0000-000000000029',
   'a0000001-0000-0000-0000-000000000002', NULL,
   'Âm Thầm Bên Em', 252,
   'songs/Âm Thầm Bên Em.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/am-tham-ben-em.jpg',
   'vi', 'sad', false, true, 16000000, NOW(), NOW()),

  -- 30: 真夜中のドア〜Stay with Me — Miki Matsubara (original)
  ('s0000001-0000-0000-0000-000000000030',
   'a0000001-0000-0000-0000-000000000006', NULL,
   '真夜中のドア〜Stay with Me', 248,
   'songs/「真夜中のドア〜stay with me」_ 松原みき Official Lyric Video.mp3',
   'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/mayonaka-no-door.jpg',
   'ja', 'romantic', false, true, 85000000, NOW(), NOW())

ON CONFLICT ("Id") DO NOTHING;

-- ============================================================
-- MUSIC_DB — SongGenres
-- ============================================================

INSERT INTO song_genres ("SongId", "GenreId") VALUES
  -- 1: Bước Qua Nhau (Teaser) — Indie, Pop
  ('s0000001-0000-0000-0000-000000000001', 'f2a3b4c5-d6e7-8901-fabc-234567890123'),
  ('s0000001-0000-0000-0000-000000000001', 'd4e5f6a7-b8c9-0123-defa-234567890123'),
  -- 2: Anh Nhớ Ra — Indie, Pop
  ('s0000001-0000-0000-0000-000000000002', 'f2a3b4c5-d6e7-8901-fabc-234567890123'),
  ('s0000001-0000-0000-0000-000000000002', 'd4e5f6a7-b8c9-0123-defa-234567890123'),
  -- 3: Anh Nhớ Ra (Live Solo) — Acoustic, Indie
  ('s0000001-0000-0000-0000-000000000003', 'e1f2a3b4-c5d6-7890-efab-123456789012'),
  ('s0000001-0000-0000-0000-000000000003', 'f2a3b4c5-d6e7-8901-fabc-234567890123'),
  -- 4: An Thần — Hip-Hop
  ('s0000001-0000-0000-0000-000000000004', 'd0e1f2a3-b4c5-6789-defa-012345678901'),
  -- 5: Bút Chì Bạc — Indie, Acoustic
  ('s0000001-0000-0000-0000-000000000005', 'f2a3b4c5-d6e7-8901-fabc-234567890123'),
  ('s0000001-0000-0000-0000-000000000005', 'e1f2a3b4-c5d6-7890-efab-123456789012'),
  -- 6: Bước Qua Nhau — Indie, Pop
  ('s0000001-0000-0000-0000-000000000006', 'f2a3b4c5-d6e7-8901-fabc-234567890123'),
  ('s0000001-0000-0000-0000-000000000006', 'd4e5f6a7-b8c9-0123-defa-234567890123'),
  -- 7: Chúng Ta Không Thuộc Về Nhau — Pop, Electronic
  ('s0000001-0000-0000-0000-000000000007', 'd4e5f6a7-b8c9-0123-defa-234567890123'),
  ('s0000001-0000-0000-0000-000000000007', 'c9d0e1f2-a3b4-5678-cdef-901234567890'),
  -- 8: Chậm Lại — Indie, Pop
  ('s0000001-0000-0000-0000-000000000008', 'f2a3b4c5-d6e7-8901-fabc-234567890123'),
  ('s0000001-0000-0000-0000-000000000008', 'd4e5f6a7-b8c9-0123-defa-234567890123'),
  -- 9: Ending Interlude — Electronic
  ('s0000001-0000-0000-0000-000000000009', 'c9d0e1f2-a3b4-5678-cdef-901234567890'),
  -- 10: Ghé Qua — Hip-Hop
  ('s0000001-0000-0000-0000-000000000010', 'd0e1f2a3-b4c5-6789-defa-012345678901'),
  -- 11: Gội Đầu — Indie, Rock
  ('s0000001-0000-0000-0000-000000000011', 'f2a3b4c5-d6e7-8901-fabc-234567890123'),
  ('s0000001-0000-0000-0000-000000000011', 'e5f6a7b8-c9d0-1234-efab-567890123456'),
  -- 12: Intro 2022 — Electronic
  ('s0000001-0000-0000-0000-000000000012', 'c9d0e1f2-a3b4-5678-cdef-901234567890'),
  -- 13: Lạ Lùng — Indie, Pop
  ('s0000001-0000-0000-0000-000000000013', 'f2a3b4c5-d6e7-8901-fabc-234567890123'),
  ('s0000001-0000-0000-0000-000000000013', 'd4e5f6a7-b8c9-0123-defa-234567890123'),
  -- 14: Chuyển Kênh — Indie, Rock
  ('s0000001-0000-0000-0000-000000000014', 'f2a3b4c5-d6e7-8901-fabc-234567890123'),
  ('s0000001-0000-0000-0000-000000000014', 'e5f6a7b8-c9d0-1234-efab-567890123456'),
  -- 15: Lần Cuối — Indie, Pop
  ('s0000001-0000-0000-0000-000000000015', 'f2a3b4c5-d6e7-8901-fabc-234567890123'),
  ('s0000001-0000-0000-0000-000000000015', 'd4e5f6a7-b8c9-0123-defa-234567890123'),
  -- 16: Những Lời Hứa Bỏ Quên — Pop
  ('s0000001-0000-0000-0000-000000000016', 'd4e5f6a7-b8c9-0123-defa-234567890123'),
  -- 17: No Need — R&B
  ('s0000001-0000-0000-0000-000000000017', 'f6a7b8c9-d0e1-2345-fabc-678901234567'),
  -- 18: Nơi Này Có Anh — Pop
  ('s0000001-0000-0000-0000-000000000018', 'd4e5f6a7-b8c9-0123-defa-234567890123'),
  -- 19: Nếu Những Tiếc Nuối — Indie, Pop
  ('s0000001-0000-0000-0000-000000000019', 'f2a3b4c5-d6e7-8901-fabc-234567890123'),
  ('s0000001-0000-0000-0000-000000000019', 'd4e5f6a7-b8c9-0123-defa-234567890123'),
  -- 20: #MusicForM — Hip-Hop
  ('s0000001-0000-0000-0000-000000000020', 'd0e1f2a3-b4c5-6789-defa-012345678901'),
  -- 21: Stay with Me (Night Tempo Mix) — Electronic, Pop
  ('s0000001-0000-0000-0000-000000000021', 'c9d0e1f2-a3b4-5678-cdef-901234567890'),
  ('s0000001-0000-0000-0000-000000000021', 'd4e5f6a7-b8c9-0123-defa-234567890123'),
  -- 22: Cơn Mưa Xa Dần — Pop, R&B
  ('s0000001-0000-0000-0000-000000000022', 'd4e5f6a7-b8c9-0123-defa-234567890123'),
  ('s0000001-0000-0000-0000-000000000022', 'f6a7b8c9-d0e1-2345-fabc-678901234567'),
  -- 23: Nắng Ấm Ngang Qua — Pop, R&B
  ('s0000001-0000-0000-0000-000000000023', 'd4e5f6a7-b8c9-0123-defa-234567890123'),
  ('s0000001-0000-0000-0000-000000000023', 'f6a7b8c9-d0e1-2345-fabc-678901234567'),
  -- 24: Mây Lang Thang — Hip-Hop
  ('s0000001-0000-0000-0000-000000000024', 'd0e1f2a3-b4c5-6789-defa-012345678901'),
  -- 25: Waiting For — R&B
  ('s0000001-0000-0000-0000-000000000025', 'f6a7b8c9-d0e1-2345-fabc-678901234567'),
  -- 26: Bản Tình Ca Không Hoàn Thiện (Live) — Hip-Hop, Acoustic
  ('s0000001-0000-0000-0000-000000000026', 'd0e1f2a3-b4c5-6789-defa-012345678901'),
  ('s0000001-0000-0000-0000-000000000026', 'e1f2a3b4-c5d6-7890-efab-123456789012'),
  -- 27: Linh Hồn Của Bữa Tiệc (Live) — Hip-Hop
  ('s0000001-0000-0000-0000-000000000027', 'd0e1f2a3-b4c5-6789-defa-012345678901'),
  -- 28: Thôi Trễ Rồi (Live) — Hip-Hop
  ('s0000001-0000-0000-0000-000000000028', 'd0e1f2a3-b4c5-6789-defa-012345678901'),
  -- 29: Âm Thầm Bên Em — Pop
  ('s0000001-0000-0000-0000-000000000029', 'd4e5f6a7-b8c9-0123-defa-234567890123'),
  -- 30: 真夜中のドア〜Stay with Me — Electronic, Pop
  ('s0000001-0000-0000-0000-000000000030', 'c9d0e1f2-a3b4-5678-cdef-901234567890'),
  ('s0000001-0000-0000-0000-000000000030', 'd4e5f6a7-b8c9-0123-defa-234567890123')
ON CONFLICT DO NOTHING;

-- ============================================================
-- MUSIC_DB — SongArtists
-- Primary artist (Role='primary', DisplayOrder=0) for every song.
-- Featured artists (Role='featured', DisplayOrder>=1) for collab songs.
-- ============================================================

INSERT INTO song_artists ("SongId", "ArtistId", "DisplayName", "Role", "DisplayOrder") VALUES
  -- All primary artists
  ('s0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000001', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000007', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000008', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000001', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000002', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000001', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000005', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000009', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000008', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000002', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000013', 'a0000001-0000-0000-0000-000000000001', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000014', 'a0000001-0000-0000-0000-000000000003', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000015', 'a0000001-0000-0000-0000-000000000003', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000016', 'a0000001-0000-0000-0000-000000000001', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000017', 'a0000001-0000-0000-0000-000000000005', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000018', 'a0000001-0000-0000-0000-000000000002', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000019', 'a0000001-0000-0000-0000-000000000001', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000020', 'a0000001-0000-0000-0000-000000000011', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000021', 'a0000001-0000-0000-0000-000000000006', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000022', 'a0000001-0000-0000-0000-000000000002', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000023', 'a0000001-0000-0000-0000-000000000002', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000024', 'a0000001-0000-0000-0000-000000000010', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000025', 'a0000001-0000-0000-0000-000000000005', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000026', 'a0000001-0000-0000-0000-000000000004', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000027', 'a0000001-0000-0000-0000-000000000004', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000028', 'a0000001-0000-0000-0000-000000000004', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000029', 'a0000001-0000-0000-0000-000000000002', NULL, 'primary', 0),
  ('s0000001-0000-0000-0000-000000000030', 'a0000001-0000-0000-0000-000000000006', NULL, 'primary', 0),

  -- Featured artists (collab songs)
  -- Song 2: Anh Nhớ Ra — Trang (featured)
  ('s0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000012', NULL, 'featured', 1),
  -- Song 4: An Thần — Thắng (featured)
  ('s0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000008', NULL, 'featured', 1),
  -- Song 10: Ghé Qua — Tofu, PC (featured)
  ('s0000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000015', NULL, 'featured', 1),
  ('s0000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000011', NULL, 'featured', 2),
  -- Song 16: Những Lời Hứa Bỏ Quên — Dear Jane (featured)
  ('s0000001-0000-0000-0000-000000000016', 'a0000001-0000-0000-0000-000000000013', NULL, 'featured', 1),
  -- Song 21: Stay with Me (Night Tempo Mix) — Night Tempo (featured)
  ('s0000001-0000-0000-0000-000000000021', 'a0000001-0000-0000-0000-000000000014', NULL, 'featured', 1),
  -- Song 24: Mây Lang Thang — PC, NewoulZ (featured)
  ('s0000001-0000-0000-0000-000000000024', 'a0000001-0000-0000-0000-000000000011', NULL, 'featured', 1),
  ('s0000001-0000-0000-0000-000000000024', 'a0000001-0000-0000-0000-000000000016', NULL, 'featured', 2)
ON CONFLICT ("SongId", "DisplayOrder") DO NOTHING;

-- ============================================================
-- USER_DB — Seed listener preferences
-- listener user ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
-- ============================================================
\connect user_db

INSERT INTO user_preferences (
  "Id", "UserId",
  "PreferredGenres", "PreferredArtists",
  "AudioQuality", "Autoplay", "ExplicitContent",
  "CreatedAt", "UpdatedAt"
) VALUES (
  'cccccccc-dddd-eeee-ffff-000000000001',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '{d4e5f6a7-b8c9-0123-defa-234567890123,e5f6a7b8-c9d0-1234-efab-567890123456}',
  '{}',
  'high',
  true,
  false,
  NOW(),
  NOW()
) ON CONFLICT ("UserId") DO NOTHING;
