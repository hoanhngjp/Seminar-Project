import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UploadPage from '../../pages/creator/UploadPage';
import { useAuthStore } from '../../store/authStore';

// ---------------------------------------------------------------------------
// Mock musicService — avoid axios FormData issues in jsdom
// ---------------------------------------------------------------------------

const mockUploadSong = vi.fn();
const mockGetGenres = vi.fn().mockResolvedValue([
  { id: 'd4e5f6a7-b8c9-0123-defa-234567890123', name: 'Pop', slug: 'pop' },
  { id: 'e5f6a7b8-c9d0-1234-efab-567890123456', name: 'Rock', slug: 'rock' },
]);

vi.mock('../../services/musicService', () => ({
  uploadSong: (...args: unknown[]) => mockUploadSong(...args),
  getGenres: (...args: unknown[]) => mockGetGenres(...args),
  getSong: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage(role: 'Creator' | 'Admin' | 'Listener' | null = 'Creator') {
  if (role) useAuthStore.getState().setAuth('mock-token', 'user-001', role, true);
  return render(
    <MemoryRouter>
      <UploadPage />
    </MemoryRouter>,
  );
}

function makeAudioFile(name = 'test.mp3', type = 'audio/mpeg', sizeBytes = 1024 * 1024) {
  return new File([new ArrayBuffer(sizeBytes)], name, { type });
}

function uploadFileViaInput(file: File) {
  const dropzone = screen.getByRole('button', { name: /khu vực tải file nhạc/i });
  const input = dropzone.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

const MOCK_UPLOADED_SONG = {
  id: 'song-new-001',
  title: 'Lạc Trôi Upload',
  artist: 'Sơn Tùng',
  duration: 245,
  isExplicit: false,
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockUploadSong.mockResolvedValue(MOCK_UPLOADED_SONG);
});

afterEach(() => {
  useAuthStore.getState().clearAuth();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UploadPage', () => {
  // ── Happy path: Creator role can see form ─────────────────────────────────
  it('renders upload form for Creator role', () => {
    renderPage('Creator');
    expect(screen.getByRole('heading', { name: /tải nhạc lên/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^tải lên$/i })).toBeInTheDocument();
  });

  // ── Happy path: Admin role can see form ───────────────────────────────────
  it('renders upload form for Admin role', () => {
    renderPage('Admin');
    expect(screen.getByRole('heading', { name: /tải nhạc lên/i })).toBeInTheDocument();
  });

  // ── No role: guard fires navigate asynchronously — does not crash ─────────
  it('does not crash when no role set (RoleGuard mounts)', () => {
    renderPage(null);
    expect(document.body).toBeTruthy();
  });

  // ── Dropzone UI ───────────────────────────────────────────────────────────
  it('shows dropzone with "Kéo thả file nhạc" instruction and choose button', () => {
    renderPage();
    expect(screen.getByText(/kéo thả file nhạc/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /chọn file/i })).toBeInTheDocument();
  });

  // ── File selection: displays file name ────────────────────────────────────
  it('displays file name after valid audio file is selected', async () => {
    renderPage();
    uploadFileViaInput(makeAudioFile('my-song.mp3'));
    await waitFor(() => expect(screen.getByText('my-song.mp3')).toBeInTheDocument());
  });

  // ── Validation: invalid MIME ──────────────────────────────────────────────
  it('shows error message for invalid MIME type (non-audio file)', async () => {
    renderPage();
    uploadFileViaInput(new File(['data'], 'track.exe', { type: 'application/octet-stream' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/MP3, WAV hoặc OGG/i),
    );
  });

  // ── Validation: file too large ────────────────────────────────────────────
  it('shows error message when file exceeds 50 MB', async () => {
    renderPage();
    uploadFileViaInput(makeAudioFile('big.mp3', 'audio/mpeg', 51 * 1024 * 1024));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/50 MB/i),
    );
  });

  // ── Submit: disabled without file ─────────────────────────────────────────
  it('disables submit button when no file is selected', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /^tải lên$/i })).toBeDisabled();
  });

  // ── Submit: enabled after valid file ──────────────────────────────────────
  it('enables submit button after valid file + auto-filled title', async () => {
    renderPage();
    uploadFileViaInput(makeAudioFile('song.mp3'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^tải lên$/i })).not.toBeDisabled(),
    );
  });

  // ── Metadata: all fields present ──────────────────────────────────────────
  it('renders all metadata input fields', async () => {
    renderPage();
    expect(screen.getByLabelText(/tên bài hát/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tâm trạng/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ngôn ngữ/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nội dung người lớn/i)).toBeInTheDocument();
    // Genre pills load async after getGenres resolves
    await waitFor(() => expect(screen.getByRole('group', { name: /thể loại/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Pop' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rock' })).toBeInTheDocument();
  });

  // ── Preview: title mirrors input ──────────────────────────────────────────
  it('updates preview title when user types song name', async () => {
    renderPage();
    const titleInput = screen.getByLabelText(/tên bài hát/i);
    fireEvent.change(titleInput, { target: { value: 'Bài hát mới' } });
    await waitFor(() => expect(screen.getByText('Bài hát mới')).toBeInTheDocument());
  });

  // ── Preview section exists ────────────────────────────────────────────────
  it('renders preview section with play button', () => {
    renderPage();
    expect(screen.getByText('XEM TRƯỚC')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /xem trước bài hát/i })).toBeInTheDocument();
  });

  // ── Happy path: successful upload → success screen ────────────────────────
  it('shows success screen after successful upload', async () => {
    renderPage();
    uploadFileViaInput(makeAudioFile('lactroi.mp3'));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^tải lên$/i })).not.toBeDisabled(),
    );

    fireEvent.click(screen.getByRole('button', { name: /^tải lên$/i }));

    await waitFor(() =>
      expect(screen.getByText(/tải lên thành công/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/lạc trôi upload/i)).toBeInTheDocument();
    expect(mockUploadSong).toHaveBeenCalledOnce();
  });

  // ── Error: upload failure → error alert ───────────────────────────────────
  it('shows error alert on upload failure', async () => {
    mockUploadSong.mockRejectedValue(new Error('Upload failed'));
    renderPage();
    uploadFileViaInput(makeAudioFile('song.mp3'));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^tải lên$/i })).not.toBeDisabled(),
    );

    fireEvent.click(screen.getByRole('button', { name: /^tải lên$/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/thất bại/i),
    );
  });

  // ── Reset: back to form after success ─────────────────────────────────────
  it('resets form when "TẢI LÊN BÀI KHÁC" is clicked on success screen', async () => {
    renderPage();
    uploadFileViaInput(makeAudioFile('song.mp3'));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^tải lên$/i })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /^tải lên$/i }));

    await waitFor(() => expect(screen.getByText(/tải lên thành công/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /tải lên bài khác/i }));

    await waitFor(() =>
      expect(screen.getByText(/kéo thả file nhạc/i)).toBeInTheDocument(),
    );
  });
});
