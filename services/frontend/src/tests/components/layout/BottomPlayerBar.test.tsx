import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import BottomPlayerBar from '../../../components/layout/BottomPlayerBar';
import { usePlayerStore } from '../../../store/playerStore';

vi.mock('../../../features/player/components/QueueDrawer', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="queue-drawer">
        <button onClick={onClose} data-testid="queue-close-btn">Close</button>
      </div>
    ) : null,
}));

const SONG = { songId: 'song-001', title: 'Chuyến Xe', artist: 'Ngọt' };
const STREAMING_HANDLER = http.get(
  'http://localhost:5000/api/v1/streaming/:songId/url',
  () => HttpResponse.json({ success: true, data: { url: 'blob:mock', expiresIn: 900 } }),
);
const ANALYTICS_HANDLER = http.post(
  'http://localhost:5000/api/v1/analytics/events/play',
  () => HttpResponse.json({ success: true, data: null }, { status: 202 }),
);

const server = setupServer(STREAMING_HANDLER, ANALYTICS_HANDLER);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  usePlayerStore.getState().clearSong();
});
afterAll(() => server.close());

function renderBar() {
  return render(<BottomPlayerBar />);
}

describe('BottomPlayerBar', () => {
  it('renders nothing when no currentSong', () => {
    renderBar();
    expect(screen.queryByTestId('bottom-player-bar')).not.toBeInTheDocument();
  });

  it('renders bar when currentSong is set', async () => {
    usePlayerStore.getState().playSong(SONG);
    renderBar();
    await waitFor(() => expect(screen.getByTestId('bottom-player-bar')).toBeInTheDocument());
  });

  it('displays song title and artist', async () => {
    usePlayerStore.getState().playSong(SONG);
    renderBar();
    await waitFor(() => {
      expect(screen.getByText('Chuyến Xe')).toBeInTheDocument();
      expect(screen.getByText('Ngọt')).toBeInTheDocument();
    });
  });

  it('renders play button', async () => {
    usePlayerStore.getState().playSong(SONG);
    renderBar();
    await waitFor(() => expect(screen.getByLabelText('Phát')).toBeInTheDocument());
  });

  it('renders seek and volume controls', async () => {
    usePlayerStore.getState().playSong(SONG);
    renderBar();
    await waitFor(() => {
      expect(screen.getByLabelText('Seek')).toBeInTheDocument();
      expect(screen.getByLabelText('Volume')).toBeInTheDocument();
    });
  });

  it('closes player when close button clicked', async () => {
    usePlayerStore.getState().playSong(SONG);
    renderBar();
    await waitFor(() => expect(screen.getByLabelText('Đóng player')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Đóng player'));
    await waitFor(() =>
      expect(screen.queryByTestId('bottom-player-bar')).not.toBeInTheDocument(),
    );
  });

  it('shows error state when streaming URL fails', async () => {
    server.use(
      http.get('http://localhost:5000/api/v1/streaming/:songId/url', () =>
        HttpResponse.json({ success: false }, { status: 500 }),
      ),
    );
    usePlayerStore.getState().playSong(SONG);
    renderBar();
    await waitFor(() =>
      expect(screen.getByText('Không thể tải bài hát.')).toBeInTheDocument(),
    );
  });

  // ── Analytics — send after duration known and user has played ─────────────

  it('sends analytics with correct body when duration loads after play', async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post('http://localhost:5000/api/v1/analytics/events/play', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ success: true, data: null }, { status: 202 });
      }),
    );

    usePlayerStore.getState().playSong(SONG);
    renderBar();

    await waitFor(() => expect(screen.getByLabelText('Phát')).toBeInTheDocument());

    // User presses play (hasStartedRef = true, but duration still 0 → no analytics yet)
    fireEvent.click(screen.getByLabelText('Phát'));

    // Audio metadata loads → onDurationChange fires with real duration
    const audio = document.querySelector('audio')!;
    Object.defineProperty(audio, 'duration', { value: 210, configurable: true });
    fireEvent.durationChange(audio);

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody).toMatchObject({
      songId: 'song-001',
      durationSec: 210,
      listenedSec: 0,
      platform: 'web',
    });
  });

  it('does not send analytics when duration loads but user has not pressed play', async () => {
    let called = false;
    server.use(
      http.post('http://localhost:5000/api/v1/analytics/events/play', () => {
        called = true;
        return HttpResponse.json({ success: true, data: null }, { status: 202 });
      }),
    );

    usePlayerStore.getState().playSong(SONG);
    renderBar();

    await waitFor(() => expect(screen.getByLabelText('Phát')).toBeInTheDocument());

    const audio = document.querySelector('audio')!;
    Object.defineProperty(audio, 'duration', { value: 210, configurable: true });
    fireEvent.durationChange(audio);

    // Wait a tick to ensure no async call slips through
    await new Promise((r) => setTimeout(r, 50));
    expect(called).toBe(false);
  });

  // ── Phase 9 — QueueDrawer integration ────────────────────────────────────

  it('renders queue button when song is playing', async () => {
    usePlayerStore.getState().playSong(SONG);
    renderBar();
    await waitFor(() =>
      expect(screen.getByTestId('open-queue-btn')).toBeInTheDocument(),
    );
  });

  it('QueueDrawer is hidden by default', async () => {
    usePlayerStore.getState().playSong(SONG);
    renderBar();
    await waitFor(() => expect(screen.getByTestId('bottom-player-bar')).toBeInTheDocument());
    expect(screen.queryByTestId('queue-drawer')).not.toBeInTheDocument();
  });

  it('clicking queue button opens QueueDrawer', async () => {
    usePlayerStore.getState().playSong(SONG);
    renderBar();
    await waitFor(() => expect(screen.getByTestId('open-queue-btn')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('open-queue-btn'));

    expect(screen.getByTestId('queue-drawer')).toBeInTheDocument();
  });

  it('QueueDrawer closes when onClose is called', async () => {
    usePlayerStore.getState().playSong(SONG);
    renderBar();
    await waitFor(() => expect(screen.getByTestId('open-queue-btn')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('open-queue-btn'));
    expect(screen.getByTestId('queue-drawer')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('queue-close-btn'));
    expect(screen.queryByTestId('queue-drawer')).not.toBeInTheDocument();
  });
});
