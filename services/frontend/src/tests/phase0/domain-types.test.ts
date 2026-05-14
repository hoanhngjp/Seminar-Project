// Tests for Phase 0 — types/domain.ts additions (Artist, SongDetail, CreatorSongRow)
// and mock data structure validation
import { describe, it, expect } from 'vitest';
import type { Artist, SongDetail, CreatorSongRow } from '../../types/domain';
import {
  MOCK_SONG_DETAIL,
  MOCK_ARTIST,
  MOCK_CREATOR_SONG_ROWS,
  MOCK_RELATED_SONGS,
  MOCK_PROFILE,
} from '../../mocks/data';

// ---------------------------------------------------------------------------
// Artist type
// ---------------------------------------------------------------------------

describe('Artist type', () => {
  it('has required id and name fields', () => {
    const artist: Artist = { id: 'a1', name: 'Test Artist' };
    expect(artist.id).toBe('a1');
    expect(artist.name).toBe('Test Artist');
  });

  it('accepts all optional fields', () => {
    const artist: Artist = {
      id: 'a1',
      name: 'Test Artist',
      avatarUrl: 'https://example.com/avatar.jpg',
      followerCount: 1000,
      songCount: 20,
      totalPlays: 500000,
    };
    expect(artist.followerCount).toBe(1000);
    expect(artist.songCount).toBe(20);
    expect(artist.totalPlays).toBe(500000);
  });
});

// ---------------------------------------------------------------------------
// SongDetail type (extends Song)
// ---------------------------------------------------------------------------

describe('SongDetail type', () => {
  it('extends Song with extra metadata fields', () => {
    const detail: SongDetail = {
      id: 's1', title: 'Test Song', artist: 'Test Artist',
      duration: 180, isExplicit: false,
      genreName: 'V-Pop', moodName: 'Lãng mạn',
      language: 'Tiếng Việt', releaseDate: '2024-01-01',
      playCount: 1000000, explainText: 'Gợi ý buổi sáng',
    };
    expect(detail.genreName).toBe('V-Pop');
    expect(detail.explainText).toBe('Gợi ý buổi sáng');
  });
});

// ---------------------------------------------------------------------------
// CreatorSongRow type
// ---------------------------------------------------------------------------

describe('CreatorSongRow type', () => {
  it('has required analytics fields', () => {
    const row: CreatorSongRow = {
      songId: 's1', title: 'Test Song',
      uploadedAt: '2024-01-15',
      totalPlays: 5000, uniqueListeners: 2000, completionRate: 0.72,
    };
    expect(row.completionRate).toBeGreaterThanOrEqual(0);
    expect(row.completionRate).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// MOCK_SONG_DETAIL validation
// ---------------------------------------------------------------------------

describe('MOCK_SONG_DETAIL', () => {
  it('has id song-001 for consistent navigation', () => {
    expect(MOCK_SONG_DETAIL.id).toBe('song-001');
  });

  it('has all required Song fields', () => {
    expect(MOCK_SONG_DETAIL.title).toBeTruthy();
    expect(MOCK_SONG_DETAIL.artist).toBeTruthy();
    expect(MOCK_SONG_DETAIL.duration).toBeGreaterThan(0);
    expect(typeof MOCK_SONG_DETAIL.isExplicit).toBe('boolean');
  });

  it('has SongDetail-specific fields', () => {
    expect(MOCK_SONG_DETAIL.genreName).toBeTruthy();
    expect(MOCK_SONG_DETAIL.moodName).toBeTruthy();
    expect(MOCK_SONG_DETAIL.language).toBeTruthy();
    expect(MOCK_SONG_DETAIL.releaseDate).toBeTruthy();
    expect(MOCK_SONG_DETAIL.playCount).toBeGreaterThan(0);
    expect(MOCK_SONG_DETAIL.explainText).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// MOCK_ARTIST validation
// ---------------------------------------------------------------------------

describe('MOCK_ARTIST', () => {
  it('has all required and optional fields', () => {
    expect(MOCK_ARTIST.id).toBeTruthy();
    expect(MOCK_ARTIST.name).toBeTruthy();
    expect(MOCK_ARTIST.avatarUrl).toMatch(/^https?:\/\//);
    expect(MOCK_ARTIST.followerCount).toBeGreaterThan(0);
    expect(MOCK_ARTIST.songCount).toBeGreaterThan(0);
    expect(MOCK_ARTIST.totalPlays).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// MOCK_RELATED_SONGS validation
// ---------------------------------------------------------------------------

describe('MOCK_RELATED_SONGS', () => {
  it('has 8 items', () => {
    expect(MOCK_RELATED_SONGS).toHaveLength(8);
  });

  it('each item has a reason with type and text', () => {
    MOCK_RELATED_SONGS.forEach((song) => {
      expect(['CONTEXT', 'TRENDING', 'PREFERENCE']).toContain(song.reason.type);
      expect(song.reason.text).toBeDefined();
    });
  });

  it('each item has valid Song fields', () => {
    MOCK_RELATED_SONGS.forEach((song) => {
      expect(song.id).toBeTruthy();
      expect(song.title).toBeTruthy();
      expect(song.artist).toBeTruthy();
      expect(song.duration).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// MOCK_CREATOR_SONG_ROWS validation
// ---------------------------------------------------------------------------

describe('MOCK_CREATOR_SONG_ROWS', () => {
  it('has 7 rows', () => {
    expect(MOCK_CREATOR_SONG_ROWS).toHaveLength(7);
  });

  it('each row has completionRate between 0 and 1', () => {
    MOCK_CREATOR_SONG_ROWS.forEach((row) => {
      expect(row.completionRate).toBeGreaterThanOrEqual(0);
      expect(row.completionRate).toBeLessThanOrEqual(1);
    });
  });

  it('each row has required analytics fields', () => {
    MOCK_CREATOR_SONG_ROWS.forEach((row) => {
      expect(row.songId).toBeTruthy();
      expect(row.title).toBeTruthy();
      expect(row.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(row.totalPlays).toBeGreaterThan(0);
      expect(row.uniqueListeners).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// MOCK_PROFILE validation
// ---------------------------------------------------------------------------

describe('MOCK_PROFILE', () => {
  it('has UserProfile fields', () => {
    expect(MOCK_PROFILE.userId).toBeTruthy();
    expect(MOCK_PROFILE.displayName).toBeTruthy();
    expect(MOCK_PROFILE.email).toContain('@');
    expect(MOCK_PROFILE.role).toBeTruthy();
    expect(typeof MOCK_PROFILE.hasCompletedOnboarding).toBe('boolean');
  });

  it('has new Phase 2 fields', () => {
    expect(MOCK_PROFILE.avatarUrl).toMatch(/^https?:\/\//);
    expect(Array.isArray(MOCK_PROFILE.preferredGenres)).toBe(true);
    expect(MOCK_PROFILE.preferredGenres!.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(MOCK_PROFILE.preferredArtists)).toBe(true);
    expect(MOCK_PROFILE.preferredArtists!.length).toBeGreaterThanOrEqual(1);
  });
});
