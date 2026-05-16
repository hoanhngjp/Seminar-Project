// Domain model types — shared across features

export type Role = 'Listener' | 'Creator' | 'Admin';

export type TimeContext = 'morning' | 'afternoon' | 'evening' | 'night';

export interface User {
  userId: string;
  name: string;
  email: string;
  role: Role;
  hasCompletedOnboarding?: boolean;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;       // seconds
  coverUrl?: string;
  isExplicit: boolean;
  genreId?: string;
  mood?: string;
}

export interface RecommendedSong extends Song {
  reason: {
    type: 'CONTEXT' | 'PREFERENCE' | 'TRENDING';
    text: string;         // explain_text — e.g. "Gợi ý buổi sáng"
  };
}

export interface SearchResult {
  id: string;
  name: string;
  type: 'song' | 'artist';
  score: number;
  coverUrl?: string;
  artist?: string;        // only for type=song
  duration?: number;      // seconds, only for type=song
}

export type NotificationType = 'new_release' | 'system';

export interface Notification {
  notificationId: string;
  message: string;
  read: boolean;
  createdAt: string;      // ISO 8601
  type?: NotificationType;
}

export interface Party {
  roomId: string;
  joinCode: string;
  hostId: string;
  currentSongId: string | null;
  playbackPositionSec: number;
  members: PartyMember[];
}

export interface PartyMember {
  userId: string;
  name: string;
  avatarUrl?: string;
  isHost: boolean;
}

export interface AnalyticsStats {
  songId: string;
  dailyListeners: { date: string; count: number }[];
  uniqueUsers: number;
  completionRate?: number;  // 0–1, e.g. 0.72 = 72%
}

export interface HeatmapDropOff {
  second: number;
  count: number;
}

export interface Artist {
  id: string;
  name: string;
  avatarUrl?: string;
  followerCount?: number;
  songCount?: number;
  totalPlays?: number;
}

export interface SongDetail extends Song {
  releaseDate?: string;
  language?: string;
  genreName?: string;
  moodName?: string;
  playCount?: number;
  explainText?: string;
}

export interface ArtistDetail {
  id: string;
  stageName: string;
  bio?: string;
  country?: string;
  avatarUrl?: string;
  bannerImageUrl?: string;
  verified: boolean;
  totalFollowers: number;
  totalPlays: number;
  songs: SongDetail[];
}

export interface MySong {
  songId: string;
  title: string;
  coverUrl?: string;
  genre?: string;
  uploadedAt: string;
  playCount: number;
}

export interface CreatorSongRow {
  songId: string;
  title: string;
  coverUrl?: string;
  genre?: string;
  uploadedAt: string;
  totalPlays: number;
  uniqueListeners: number;
  completionRate: number; // 0–1
}
