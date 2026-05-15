-- ============================================================
-- Smart Music Platform — Seed Data
-- Run AFTER EF Core migrations have applied to music_db and user_db.
-- Usage: psql -h localhost -U smartmusic -d music_db -f SeedData.sql
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
-- MUSIC_DB — Artist (linked to creator@example.com)
-- Creator user ID from user-service DbInitializer seed:
--   b2c3d4e5-f6a7-8901-bcde-f12345678901
-- ============================================================

INSERT INTO artists (
  "Id", "UserId", "StageName", "Bio", "Country", "Verified",
  "TotalFollowers", "TotalPlays", "CreatedAt", "UpdatedAt"
) VALUES (
  'aa111111-bbbb-cccc-dddd-eeeeeeeeeeee',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'Test Artist',
  'Demo artist for Smart Music Platform',
  'VN',
  true,
  0,
  0,
  NOW(),
  NOW()
) ON CONFLICT ("Id") DO NOTHING;

-- ============================================================
-- MUSIC_DB — Songs (8 songs, GCS audio keys)
-- S3AudioKey is the object path inside GCP_BUCKET_NAME.
-- Files must already exist in the GCS bucket.
-- Cover images use Cloudinary placeholder URLs.
-- ============================================================

INSERT INTO songs (
  "Id", "ArtistId", "AlbumId", "Title", "DurationSec",
  "S3AudioKey", "CoverImageUrl", "Language",
  "IsExplicit", "IsPublished", "PlayCount",
  "CreatedAt", "UpdatedAt"
) VALUES
  (
    '11111111-0000-0000-0000-000000000001',
    'aa111111-bbbb-cccc-dddd-eeeeeeeeeeee',
    NULL,
    'Noi Nay Co Anh',
    245,
    'songs/11111111-0000-0000-0000-000000000001/audio.mp3',
    'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/song-001.jpg',
    'vi', false, true, 8500000,
    NOW(), NOW()
  ),
  (
    '11111111-0000-0000-0000-000000000002',
    'aa111111-bbbb-cccc-dddd-eeeeeeeeeeee',
    NULL,
    'Lac Troi',
    210,
    'songs/11111111-0000-0000-0000-000000000002/audio.mp3',
    'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/song-002.jpg',
    'vi', false, true, 12000000,
    NOW(), NOW()
  ),
  (
    '11111111-0000-0000-0000-000000000003',
    'aa111111-bbbb-cccc-dddd-eeeeeeeeeeee',
    NULL,
    'Dai Lo Mat Troi',
    198,
    'songs/11111111-0000-0000-0000-000000000003/audio.mp3',
    'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/song-003.jpg',
    'vi', false, true, 3200000,
    NOW(), NOW()
  ),
  (
    '11111111-0000-0000-0000-000000000004',
    'aa111111-bbbb-cccc-dddd-eeeeeeeeeeee',
    NULL,
    'May Khi',
    183,
    'songs/11111111-0000-0000-0000-000000000004/audio.mp3',
    'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/song-004.jpg',
    'vi', false, true, 1800000,
    NOW(), NOW()
  ),
  (
    '11111111-0000-0000-0000-000000000005',
    'aa111111-bbbb-cccc-dddd-eeeeeeeeeeee',
    NULL,
    'Xanh',
    201,
    'songs/11111111-0000-0000-0000-000000000005/audio.mp3',
    'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/song-005.jpg',
    'vi', false, true, 2100000,
    NOW(), NOW()
  ),
  (
    '11111111-0000-0000-0000-000000000006',
    'aa111111-bbbb-cccc-dddd-eeeeeeeeeeee',
    NULL,
    'Thay Chua',
    176,
    'songs/11111111-0000-0000-0000-000000000006/audio.mp3',
    'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/song-006.jpg',
    'vi', false, true, 980000,
    NOW(), NOW()
  ),
  (
    '11111111-0000-0000-0000-000000000007',
    'aa111111-bbbb-cccc-dddd-eeeeeeeeeeee',
    NULL,
    'Vung Ky Uc',
    222,
    'songs/11111111-0000-0000-0000-000000000007/audio.mp3',
    'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/song-007.jpg',
    'vi', false, true, 2700000,
    NOW(), NOW()
  ),
  (
    '11111111-0000-0000-0000-000000000008',
    'aa111111-bbbb-cccc-dddd-eeeeeeeeeeee',
    NULL,
    'Neu Nhung Tiec Nuoi',
    256,
    'songs/11111111-0000-0000-0000-000000000008/audio.mp3',
    'https://res.cloudinary.com/demo/image/upload/v1/smart-music/covers/song-008.jpg',
    'vi', false, true, 3500000,
    NOW(), NOW()
  )
ON CONFLICT ("Id") DO NOTHING;

-- ============================================================
-- MUSIC_DB — SongGenres (link songs to genres)
-- ============================================================

INSERT INTO song_genres ("SongId", "GenreId") VALUES
  ('11111111-0000-0000-0000-000000000001', 'd4e5f6a7-b8c9-0123-defa-234567890123'), -- Pop
  ('11111111-0000-0000-0000-000000000002', 'd4e5f6a7-b8c9-0123-defa-234567890123'), -- Pop
  ('11111111-0000-0000-0000-000000000003', 'e5f6a7b8-c9d0-1234-efab-567890123456'), -- Rock
  ('11111111-0000-0000-0000-000000000004', 'f2a3b4c5-d6e7-8901-fabc-234567890123'), -- Indie
  ('11111111-0000-0000-0000-000000000005', 'f2a3b4c5-d6e7-8901-fabc-234567890123'), -- Indie
  ('11111111-0000-0000-0000-000000000006', 'f2a3b4c5-d6e7-8901-fabc-234567890123'), -- Indie
  ('11111111-0000-0000-0000-000000000007', 'd4e5f6a7-b8c9-0123-defa-234567890123'), -- Pop
  ('11111111-0000-0000-0000-000000000008', 'f2a3b4c5-d6e7-8901-fabc-234567890123')  -- Indie
ON CONFLICT DO NOTHING;

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
