import { useState } from 'react';
import { uploadSong } from '../../../services/musicService';
import type { Song } from '../../../types/domain';

const ALLOWED_MIME_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export interface UploadForm {
  title: string;
  genre: string;
  mood: string;
  language: string;
  isExplicit: boolean;
}

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export function useUpload() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [form, setForm] = useState<UploadForm>({
    title: '',
    genre: '',
    mood: '',
    language: 'Tiếng Việt',
    isExplicit: false,
  });
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [uploadedSong, setUploadedSong] = useState<Song | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function validateAudioFile(file: File): string | null {
    if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg)$/i)) {
      return 'Chỉ chấp nhận file MP3, WAV hoặc OGG.';
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return 'File không được vượt quá 50 MB.';
    }
    return null;
  }

  function selectAudioFile(file: File) {
    const err = validateAudioFile(file);
    setFileError(err);
    if (!err) {
      setAudioFile(file);
      if (!form.title) {
        setForm((prev) => ({ ...prev, title: file.name.replace(/\.[^.]+$/, '') }));
      }
    }
  }

  function selectCoverFile(file: File) {
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function updateForm(patch: Partial<UploadForm>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function submit() {
    if (!audioFile || !form.title.trim()) return;
    setStatus('uploading');
    setUploadError(null);
    try {
      const song = await uploadSong({
        ...form,
        file: audioFile,
        coverFile,
      });
      setUploadedSong(song);
      setStatus('success');
    } catch {
      setUploadError('Tải lên thất bại. Vui lòng thử lại.');
      setStatus('error');
    }
  }

  function reset() {
    setAudioFile(null);
    setCoverFile(null);
    setCoverPreview(null);
    setFileError(null);
    setForm({ title: '', genre: '', mood: '', language: 'Tiếng Việt', isExplicit: false });
    setStatus('idle');
    setUploadedSong(null);
    setUploadError(null);
  }

  const canSubmit = !!audioFile && !fileError && form.title.trim().length > 0 && status !== 'uploading';

  return {
    audioFile,
    coverFile,
    coverPreview,
    fileError,
    form,
    status,
    uploadedSong,
    uploadError,
    canSubmit,
    selectAudioFile,
    selectCoverFile,
    updateForm,
    submit,
    reset,
  };
}
