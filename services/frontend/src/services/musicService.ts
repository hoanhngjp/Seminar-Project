import { apiClient } from './api';
import type { ApiResponse } from '../types/api';
import type { Song } from '../types/domain';

export interface UploadSongRequest {
  title: string;
  genre: string;
  mood: string;
  language: string;
  isExplicit: boolean;
  file: File;
  coverFile?: File | null;
}

export async function uploadSong(req: UploadSongRequest): Promise<Song> {
  const form = new FormData();
  form.append('title', req.title);
  form.append('genre', req.genre);
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
  const res = await apiClient.get<ApiResponse<Song>>(`/api/v1/music/songs/${songId}`);
  return res.data.data!;
}
