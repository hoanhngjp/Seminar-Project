import { apiClient } from './api';
import type { ApiResponse } from '../types/api';
import type { Song, ArtistDetail, MySong } from '../types/domain';

export interface Genre {
  id: string;
  name: string;
  slug: string;
}

export async function getGenres(): Promise<Genre[]> {
  const res = await apiClient.get<ApiResponse<Genre[]>>('/api/v1/music/genres');
  return res.data.data ?? [];
}

export interface UploadSongRequest {
  title: string;
  genreIds: string[];
  mood: string;
  language: string;
  isExplicit: boolean;
  file: File;
  coverFile?: File | null;
}

export async function uploadSong(req: UploadSongRequest): Promise<Song> {
  const form = new FormData();
  form.append('title', req.title);
  form.append('genreIds', req.genreIds.join(','));
  form.append('mood', req.mood);
  form.append('language', req.language);
  form.append('isExplicit', String(req.isExplicit));
  form.append('file', req.file);
  if (req.coverFile) form.append('cover', req.coverFile);

  const idempotencyKey = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const res = await apiClient.post<ApiResponse<Song>>('/api/v1/music/songs', form, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'Idempotency-Key': idempotencyKey,
    },
  });
  return res.data.data!;
}

export async function getSong(songId: string): Promise<Song> {
  const res = await apiClient.get<ApiResponse<any>>(`/api/v1/music/songs/${songId}`);
  const d = res.data.data!;
  return {
    id: String(d.id ?? d.songId ?? songId),
    title: d.title ?? '',
    artist: d.artist?.stageName ?? (typeof d.artist === 'string' ? d.artist : '') ?? '',
    album: d.album?.title ?? d.album,
    duration: d.durationSec ?? d.duration ?? 0,
    coverUrl: d.coverUrl ?? d.coverImageUrl,
    isExplicit: d.isExplicit ?? false,
    genreId: d.genreId,
    mood: d.mood,
    lyrics: d.lyrics ?? undefined,
  };
}

export async function getArtist(artistId: string): Promise<ArtistDetail> {
  const res = await apiClient.get<ApiResponse<any>>(`/api/v1/music/artists/${artistId}`);
  const d = res.data.data!;
  return {
    id: String(d.id ?? artistId),
    stageName: d.stageName ?? '',
    bio: d.bio,
    country: d.country,
    avatarUrl: d.avatarUrl,
    bannerImageUrl: d.bannerImageUrl,
    verified: d.verified ?? false,
    totalFollowers: d.totalFollowers ?? 0,
    totalPlays: d.totalPlays ?? 0,
    songs: (d.songs ?? []).map((s: any) => ({
      id: String(s.songId ?? s.id ?? ''),
      title: s.title ?? '',
      artist: s.artist?.stageName ?? s.artist ?? d.stageName ?? '',
      album: s.album?.title ?? s.album,
      duration: s.durationSec ?? s.duration ?? 0,
      coverUrl: s.coverUrl,
      isExplicit: s.isExplicit ?? false,
      genreId: s.genreId,
      genreName: s.genreName,
    })),
  };
}

export async function getMySongs(): Promise<MySong[]> {
  const res = await apiClient.get<ApiResponse<MySong[]>>('/api/v1/music/songs/my');
  return res.data.data ?? [];
}
