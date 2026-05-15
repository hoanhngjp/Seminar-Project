# Plan: Add song_artists Table + Seed 29 Songs

> **Ngày tạo:** 2026-05-16
> **Trạng thái:** Approved — sẵn sàng implement

## Context
Schema hiện tại chỉ có `songs.artist_id` (single FK). Cần thêm `song_artists` junction table để model đúng collab songs (primary + featured artists). Đồng thời seed 29 bài nhạc thật từ GCS bucket `smart-music-microservices` vào DB.

---

## Approach

**Giữ `songs.artist_id` (NOT NULL)** làm primary artist denormalized — backward compat, không break Recommendation/Streaming.
**Thêm `song_artists`** với `artist_id` nullable + `display_name` cho external featured artists không có profile.

---

## Files cần thay đổi

### 1. New Domain Model
**`services/music-service/src/MusicService.Domain/Models/SongArtist.cs`** — tạo mới
```
SongId (Guid, FK)
ArtistId (Guid?, nullable FK → artists)
DisplayName (string?, dùng khi ArtistId null)
Role (string: "primary" | "featured")
DisplayOrder (int)
```

### 2. Update Existing Models
- **`Song.cs`** — thêm `ICollection<SongArtist> SongArtists`
- **`Artist.cs`** — thêm `ICollection<SongArtist> SongArtists`

### 3. DbContext
**`MusicService.Infrastructure/Data/MusicDbContext.cs`**
- Thêm `DbSet<SongArtist> SongArtists`
- Configure: composite PK (SongId, DisplayOrder), FK nullable ArtistId (SetNull on delete), FK SongId (Cascade on delete)

### 4. EF Core Migration
**`MusicService.Infrastructure/Data/Migrations/20260516100000_AddSongArtistsTable.cs`** — tạo mới
```sql
CREATE TABLE song_artists (
  SongId UUID NOT NULL REFERENCES songs(Id) ON DELETE CASCADE,
  ArtistId UUID NULL REFERENCES artists(Id) ON DELETE SET NULL,
  DisplayName VARCHAR(150) NULL,
  Role VARCHAR(20) NOT NULL DEFAULT 'primary',
  DisplayOrder INT NOT NULL DEFAULT 0,
  PRIMARY KEY (SongId, DisplayOrder)
)
```

### 5. DTO Update
**`MusicService.Application/DTOs/SongResponseDto.cs`**
- Thêm record `FeaturedArtistDto(Guid? Id, string Name)`
- Thêm field `List<FeaturedArtistDto> FeaturedArtists` vào `SongResponseDto` (default empty list — backward compat)

### 6. Repository / Service
**`MusicService.Infrastructure/Repositories/SongRepository.cs`**
- `GetByIdAsync`: thêm `.Include(s => s.SongArtists).ThenInclude(sa => sa.Artist)`

**`MusicService.Application/Services/SongService.cs`**
- Map `FeaturedArtists` từ `song.SongArtists.Where(sa => sa.Role == "featured")`

### 7. Seed Data
**`infra/seed/SeedData.sql`** — append (không xóa data cũ)

#### New Artists (16 records — bao gồm tất cả featured artists)
| UUID | StageName | UserId (fake) |
|------|-----------|---------------|
| a0000001-0000-0000-0000-000000000001 | Vũ. | f0000001-0000-0000-0000-000000000001 |
| a0000001-0000-0000-0000-000000000002 | Sơn Tùng M-TP | f0000001-0000-0000-0000-000000000002 |
| a0000001-0000-0000-0000-000000000003 | Ngọt | f0000001-0000-0000-0000-000000000003 |
| a0000001-0000-0000-0000-000000000004 | TaynguyenSound | f0000001-0000-0000-0000-000000000004 |
| a0000001-0000-0000-0000-000000000005 | The Aaron Smith Experience | f0000001-0000-0000-0000-000000000005 |
| a0000001-0000-0000-0000-000000000006 | Miki Matsubara | f0000001-0000-0000-0000-000000000006 |
| a0000001-0000-0000-0000-000000000007 | Low G | f0000001-0000-0000-0000-000000000007 |
| a0000001-0000-0000-0000-000000000008 | Thắng | f0000001-0000-0000-0000-000000000008 |
| a0000001-0000-0000-0000-000000000009 | Dick | f0000001-0000-0000-0000-000000000009 |
| a0000001-0000-0000-0000-000000000010 | Tùng TeA | f0000001-0000-0000-0000-000000000010 |
| a0000001-0000-0000-0000-000000000011 | PC | f0000001-0000-0000-0000-000000000011 |
| a0000001-0000-0000-0000-000000000012 | Trang | f0000001-0000-0000-0000-000000000012 |
| a0000001-0000-0000-0000-000000000013 | Dear Jane | f0000001-0000-0000-0000-000000000013 |
| a0000001-0000-0000-0000-000000000014 | Night Tempo | f0000001-0000-0000-0000-000000000014 |
| a0000001-0000-0000-0000-000000000015 | Tofu | f0000001-0000-0000-0000-000000000015 |
| a0000001-0000-0000-0000-000000000016 | NewoulZ | f0000001-0000-0000-0000-000000000016 |

#### 29 Songs — storage_key = `songs/FILENAME.mp3` (trỏ thẳng GCS)

Genre UUIDs dùng lại từ SeedData.sql:
- Pop: `d4e5f6a7-b8c9-0123-defa-234567890123`
- Rock: `e5f6a7b8-c9d0-1234-efab-567890123456`
- R&B: `f6a7b8c9-d0e1-2345-fabc-678901234567`
- Electronic: `c9d0e1f2-a3b4-5678-cdef-901234567890`
- Hip-Hop: `d0e1f2a3-b4c5-6789-defa-012345678901`
- Acoustic: `e1f2a3b4-c5d6-7890-efab-123456789012`
- Indie: `f2a3b4c5-d6e7-8901-fabc-234567890123`

| # | Song UUID | Title | Primary Artist | Genres | Mood | Duration |
|---|-----------|-------|----------------|--------|------|----------|
| 1 | s0000001-0000-0000-0000-000000000001 | Bước Qua Nhau (Teaser) | Vũ. | Indie, Pop | sad | 180 |
| 2 | s0000001-0000-0000-0000-000000000002 | Anh Nhớ Ra (ft. Trang) | Vũ. | Indie, Pop | sad | 240 |
| 3 | s0000001-0000-0000-0000-000000000003 | Anh Nhớ Ra (Live Solo) | Vũ. | Acoustic, Indie | chill | 250 |
| 4 | s0000001-0000-0000-0000-000000000004 | An Thần | Low G | Hip-Hop | chill | 210 |
| 5 | s0000001-0000-0000-0000-000000000005 | Bút Chì Bạc | Thắng | Indie, Acoustic | chill | 220 |
| 6 | s0000001-0000-0000-0000-000000000006 | Bước Qua Nhau | Vũ. | Indie, Pop | sad | 255 |
| 7 | s0000001-0000-0000-0000-000000000007 | Chúng Ta Không Thuộc Về Nhau | Sơn Tùng M-TP | Pop, Electronic | energetic | 228 |
| 8 | s0000001-0000-0000-0000-000000000008 | Chậm Lại | Vũ. | Indie, Pop | chill | 235 |
| 9 | s0000001-0000-0000-0000-000000000009 | Ending Interlude | The Aaron Smith Experience | Electronic | atmospheric | 120 |
| 10 | s0000001-0000-0000-0000-000000000010 | Ghé Qua | Dick | Hip-Hop | chill | 215 |
| 11 | s0000001-0000-0000-0000-000000000011 | Gội Đầu | Thắng | Indie, Rock | chill | 245 |
| 12 | s0000001-0000-0000-0000-000000000012 | Intro 2022 | Sơn Tùng M-TP | Electronic | null | 90 |
| 13 | s0000001-0000-0000-0000-000000000013 | Lạ Lùng | Vũ. | Indie, Pop | sad | 250 |
| 14 | s0000001-0000-0000-0000-000000000014 | Chuyển Kênh | Ngọt | Indie, Rock | energetic | 220 |
| 15 | s0000001-0000-0000-0000-000000000015 | Lần Cuối | Ngọt | Indie, Pop | sad | 265 |
| 16 | s0000001-0000-0000-0000-000000000016 | Những Lời Hứa Bỏ Quên | Vũ. | Pop | sad | 270 |
| 17 | s0000001-0000-0000-0000-000000000017 | No Need | The Aaron Smith Experience | R&B | chill | 195 |
| 18 | s0000001-0000-0000-0000-000000000018 | Nơi Này Có Anh | Sơn Tùng M-TP | Pop | romantic | 321 |
| 19 | s0000001-0000-0000-0000-000000000019 | Nếu Những Tiếc Nuối | Vũ. | Indie, Pop | sad | 242 |
| 20 | s0000001-0000-0000-0000-000000000020 | #MusicForM | PC | Hip-Hop | chill | 230 |
| 21 | s0000001-0000-0000-0000-000000000021 | Stay with Me (Night Tempo Mix) | Miki Matsubara | Electronic, Pop | energetic | 270 |
| 22 | s0000001-0000-0000-0000-000000000022 | Cơn Mưa Xa Dần | Sơn Tùng M-TP | Pop, R&B | chill | 285 |
| 23 | s0000001-0000-0000-0000-000000000023 | Nắng Ấm Ngang Qua | Sơn Tùng M-TP | Pop, R&B | chill | 278 |
| 24 | s0000001-0000-0000-0000-000000000024 | Mây Lang Thang | Tùng TeA | Hip-Hop | chill | 225 |
| 25 | s0000001-0000-0000-0000-000000000025 | Waiting For | The Aaron Smith Experience | R&B | chill | 210 |
| 26 | s0000001-0000-0000-0000-000000000026 | Bản Tình Ca Không Hoàn Thiện (Live) | TaynguyenSound | Hip-Hop, Acoustic | romantic | 310 |
| 27 | s0000001-0000-0000-0000-000000000027 | Linh Hồn Của Bữa Tiệc (Live) | TaynguyenSound | Hip-Hop | energetic | 280 |
| 28 | s0000001-0000-0000-0000-000000000028 | Thôi Trễ Rồi, Chắc Anh Phải Về Đây (Live) | TaynguyenSound | Hip-Hop | chill | 295 |
| 29 | s0000001-0000-0000-0000-000000000029 | Âm Thầm Bên Em | Sơn Tùng M-TP | Pop | sad | 252 |

#### song_artists records (collab songs)
| Song | Role | ArtistId |
|------|------|----------|
| 2 (Anh Nhớ Ra ft. Trang) | featured | a0000001-0000-0000-0000-000000000012 (Trang) |
| 4 (An Thần) | featured | a0000001-0000-0000-0000-000000000008 (Thắng) |
| 10 (Ghé Qua) | featured | a0000001-0000-0000-0000-000000000015 (Tofu) |
| 10 (Ghé Qua) | featured | a0000001-0000-0000-0000-000000000011 (PC) |
| 16 (Những Lời Hứa Bỏ Quên) | featured | a0000001-0000-0000-0000-000000000013 (Dear Jane) |
| 21 (Stay with Me) | featured | a0000001-0000-0000-0000-000000000014 (Night Tempo) |
| 24 (Mây Lang Thang) | featured | a0000001-0000-0000-0000-000000000011 (PC) |
| 24 (Mây Lang Thang) | featured | a0000001-0000-0000-0000-000000000016 (NewoulZ) |

> Primary artist cũng insert vào `song_artists` với Role = 'primary', DisplayOrder = 0.

### 8. Seed Scripts
**`infra/seed/redis_seed.sh`** — thêm 29 song UUIDs mới vào `rec:trending:global`
**`infra/seed/elasticsearch_seed.sh`** — thêm 29 documents mới vào index `songs`

---

## Verification
```bash
dotnet ef database update  # trong services/music-service
psql -h localhost -p 5434 -U smartmusic -d music_db -f infra/seed/SeedData.sql
psql -c "SELECT COUNT(*) FROM songs;"         -- expect 37
psql -c "SELECT COUNT(*) FROM song_artists;"  -- expect >= 29
dotnet test services/music-service/tests/MusicService.UnitTests/
curl http://localhost:5000/api/v1/music/songs/s0000001-0000-0000-0000-000000000002
# expect: featuredArtists: [{id: "...", name: "Trang"}]
```
