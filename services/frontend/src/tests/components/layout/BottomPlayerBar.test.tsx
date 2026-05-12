import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import BottomPlayerBar from '../../../components/layout/BottomPlayerBar';
import { usePlayerStore } from '../../../store/playerStore';

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
});
