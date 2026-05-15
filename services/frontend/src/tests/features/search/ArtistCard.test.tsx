import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ArtistCard from '../../../features/search/components/ArtistCard';
import type { SearchResult } from '../../../types/domain';

// ── Navigate mock ─────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Mock data ─────────────────────────────────────────────────────────────────

const ARTIST_WITH_IMAGE: SearchResult = {
  id: 'artist-1',
  name: 'Sơn Tùng M-TP',
  type: 'artist',
  score: 0.99,
  coverUrl: 'https://picsum.photos/seed/artist1/300/300',
};

const ARTIST_NO_IMAGE: SearchResult = {
  id: 'artist-2',
  name: 'Vũ.',
  type: 'artist',
  score: 0.85,
  coverUrl: '',
};

// ── Helper ────────────────────────────────────────────────────────────────────

function renderCard(artist: SearchResult) {
  return render(
    <MemoryRouter>
      <ArtistCard artist={artist} />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ArtistCard — rendering', () => {
  it('renders artist name', () => {
    renderCard(ARTIST_WITH_IMAGE);
    expect(screen.getByText('Sơn Tùng M-TP')).toBeInTheDocument();
  });

  it('renders "Nghệ sĩ" label', () => {
    renderCard(ARTIST_WITH_IMAGE);
    expect(screen.getByText('Nghệ sĩ')).toBeInTheDocument();
  });

  it('has data-testid="artist-card-{id}"', () => {
    renderCard(ARTIST_WITH_IMAGE);
    expect(screen.getByTestId('artist-card-artist-1')).toBeInTheDocument();
  });

  it('renders avatar image when coverUrl is provided', () => {
    renderCard(ARTIST_WITH_IMAGE);
    const img = screen.getByRole('img', { name: /Sơn Tùng M-TP/i });
    expect(img).toHaveAttribute('src', 'https://picsum.photos/seed/artist1/300/300');
  });

  it('renders person icon placeholder when coverUrl is empty', () => {
    renderCard(ARTIST_NO_IMAGE);
    expect(screen.queryByRole('img', { name: /Vũ\./i })).not.toBeInTheDocument();
    const card = screen.getByTestId('artist-card-artist-2');
    expect(card).toBeInTheDocument();
  });

  it('renders artist name for no-image variant', () => {
    renderCard(ARTIST_NO_IMAGE);
    expect(screen.getByText('Vũ.')).toBeInTheDocument();
  });
});

describe('ArtistCard — interaction', () => {
  it('navigates to /artists/:id when card is clicked', () => {
    renderCard(ARTIST_WITH_IMAGE);
    fireEvent.click(screen.getByTestId('artist-card-artist-1'));
    expect(mockNavigate).toHaveBeenCalledWith('/artists/artist-1');
  });

  it('navigates via keyboard Enter', () => {
    renderCard(ARTIST_WITH_IMAGE);
    const card = screen.getByTestId('artist-card-artist-1');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/artists/artist-1');
  });

  it('navigates via keyboard Space', () => {
    renderCard(ARTIST_WITH_IMAGE);
    const card = screen.getByTestId('artist-card-artist-1');
    fireEvent.keyDown(card, { key: ' ' });
    expect(mockNavigate).toHaveBeenCalledWith('/artists/artist-1');
  });

  it('play button click does not navigate (stopPropagation)', () => {
    mockNavigate.mockClear();
    renderCard(ARTIST_WITH_IMAGE);
    const playBtn = screen.getByRole('button', { name: /Phát nhạc của Sơn Tùng M-TP/i });
    fireEvent.click(playBtn);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('ArtistCard — accessibility', () => {
  it('has aria-label describing the card action', () => {
    renderCard(ARTIST_WITH_IMAGE);
    expect(screen.getByRole('button', { name: /Xem trang nghệ sĩ Sơn Tùng M-TP/i })).toBeInTheDocument();
  });
});
