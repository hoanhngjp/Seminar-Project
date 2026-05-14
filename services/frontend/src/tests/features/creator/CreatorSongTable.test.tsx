import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import CreatorSongTable from '../../../features/creator/components/CreatorSongTable';
import type { CreatorSongRow } from '../../../types/domain';

// ─── Test data ────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<CreatorSongRow> & { songId: string }): CreatorSongRow {
  return {
    songId: overrides.songId,
    title: overrides.title ?? `Song ${overrides.songId}`,
    genre: overrides.genre ?? 'V-Pop',
    uploadedAt: overrides.uploadedAt ?? '2024-01-01',
    totalPlays: overrides.totalPlays ?? 1000,
    uniqueListeners: overrides.uniqueListeners ?? 500,
    completionRate: overrides.completionRate ?? 0.7,
    coverUrl: overrides.coverUrl,
  };
}

const ROWS_3: CreatorSongRow[] = [
  makeRow({ songId: 'song-001', title: 'Lạc Trôi', uploadedAt: '2024-01-15', totalPlays: 15420, uniqueListeners: 8930, completionRate: 0.72 }),
  makeRow({ songId: 'song-002', title: 'Chuyến Xe', uploadedAt: '2024-02-20', totalPlays: 9870, uniqueListeners: 6540, completionRate: 0.81 }),
  makeRow({ songId: 'song-003', title: 'Lạc Trôi B', uploadedAt: '2024-03-05', totalPlays: 7650, uniqueListeners: 5120, completionRate: 0.75 }),
];

// 12 rows — spans 2 pages (10 + 2)
const ROWS_12: CreatorSongRow[] = Array.from({ length: 12 }, (_, i) =>
  makeRow({
    songId: `song-${String(i + 1).padStart(3, '0')}`,
    title: `Bài ${i + 1}`,
    uploadedAt: `2024-${String(i + 1).padStart(2, '0')}-01`,
    totalPlays: (12 - i) * 1000,
    uniqueListeners: (12 - i) * 500,
    completionRate: 0.5 + i * 0.03,
  }),
);

// ─── Basic rendering ──────────────────────────────────────────────────────────

describe('CreatorSongTable — basic rendering', () => {
  it('renders table headers', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    expect(screen.getByText('Bài hát')).toBeInTheDocument();
    expect(screen.getByText('Ngày upload')).toBeInTheDocument();
    expect(screen.getByText('Lượt nghe')).toBeInTheDocument();
    expect(screen.getByText('Người nghe')).toBeInTheDocument();
    expect(screen.getByText('Hoàn thành %')).toBeInTheDocument();
  });

  it('renders all row titles', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    expect(screen.getByText('Lạc Trôi')).toBeInTheDocument();
    expect(screen.getByText('Chuyến Xe')).toBeInTheDocument();
    expect(screen.getByText('Lạc Trôi B')).toBeInTheDocument();
  });

  it('renders genre labels for each row', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    const genreCells = screen.getAllByText('V-Pop');
    expect(genreCells.length).toBe(3);
  });

  it('renders row numbers starting from 1', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders totalPlays formatted with localeString', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    // 15420 → "15.420" (vi-VN)
    expect(screen.getByText('15.420')).toBeInTheDocument();
  });

  it('renders completion rate as percentage text', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('81%')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders progress bar with correct width for completionRate', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    // aria-label="72% hoàn thành" is on the inner progress fill div
    const bar = screen.getByLabelText('72% hoàn thành') as HTMLElement;
    expect(bar.style.width).toBe('72%');
  });

  it('renders cover image when coverUrl is provided', () => {
    const rowWithCover = makeRow({ songId: 'x', title: 'Test', coverUrl: 'https://example.com/cover.jpg' });
    render(<CreatorSongTable rows={[rowWithCover]} onViewAnalytics={vi.fn()} />);
    const img = screen.getByAltText('Test');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('https://example.com/cover.jpg');
  });

  it('renders music_note icon placeholder when coverUrl is absent', () => {
    const rowNoCover = makeRow({ songId: 'x', title: 'No Cover' });
    render(<CreatorSongTable rows={[rowNoCover]} onViewAnalytics={vi.fn()} />);
    expect(screen.queryByRole('img', { name: 'No Cover' })).not.toBeInTheDocument();
    expect(screen.getByText('music_note')).toBeInTheDocument();
  });

  it('renders "Xem phân tích" button for each row', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    const buttons = screen.getAllByText('Xem phân tích');
    expect(buttons.length).toBe(3);
  });
});

// ─── Empty and loading states ─────────────────────────────────────────────────

describe('CreatorSongTable — empty and loading states', () => {
  it('renders EmptyState title when rows is empty', () => {
    render(<CreatorSongTable rows={[]} onViewAnalytics={vi.fn()} />);
    expect(screen.getByText('Chưa có bài hát nào')).toBeInTheDocument();
  });

  it('does not render table when rows is empty', () => {
    render(<CreatorSongTable rows={[]} onViewAnalytics={vi.fn()} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows EmptyState CTA when onUpload is provided', () => {
    const onUpload = vi.fn();
    render(<CreatorSongTable rows={[]} onViewAnalytics={vi.fn()} onUpload={onUpload} />);
    expect(screen.getByRole('button', { name: 'Upload ngay' })).toBeInTheDocument();
  });

  it('does not show CTA button without onUpload', () => {
    render(<CreatorSongTable rows={[]} onViewAnalytics={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Upload ngay' })).not.toBeInTheDocument();
  });

  it('shows SkeletonRow loading indicator when loading=true', () => {
    render(<CreatorSongTable rows={ROWS_3} loading={true} onViewAnalytics={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'Đang tải…' })).toBeInTheDocument();
  });

  it('does not render table when loading=true', () => {
    render(<CreatorSongTable rows={ROWS_3} loading={true} onViewAnalytics={vi.fn()} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('does not render EmptyState when loading=true (even with empty rows)', () => {
    render(<CreatorSongTable rows={[]} loading={true} onViewAnalytics={vi.fn()} />);
    expect(screen.queryByText('Chưa có bài hát nào')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Đang tải…' })).toBeInTheDocument();
  });
});

// ─── onViewAnalytics callback ─────────────────────────────────────────────────

describe('CreatorSongTable — onViewAnalytics', () => {
  it('calls onViewAnalytics with correct songId when button is clicked', () => {
    const onViewAnalytics = vi.fn();
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={onViewAnalytics} />);
    // Find the row for 'Lạc Trôi' and click its action button
    const rows = screen.getAllByRole('row').slice(1);
    const lacTroiRow = rows.find((r) => within(r).queryByText('Lạc Trôi'))!;
    fireEvent.click(within(lacTroiRow).getByText('Xem phân tích'));
    expect(onViewAnalytics).toHaveBeenCalledWith('song-001');
    expect(onViewAnalytics).toHaveBeenCalledTimes(1);
  });

  it('calls onViewAnalytics with second row songId', () => {
    const onViewAnalytics = vi.fn();
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={onViewAnalytics} />);
    const rows = screen.getAllByRole('row').slice(1);
    const chuyenXeRow = rows.find((r) => within(r).queryByText('Chuyến Xe'))!;
    fireEvent.click(within(chuyenXeRow).getByText('Xem phân tích'));
    expect(onViewAnalytics).toHaveBeenCalledWith('song-002');
  });
});

// ─── Sorting ──────────────────────────────────────────────────────────────────

describe('CreatorSongTable — sorting', () => {
  it('clicking "Lượt nghe" header sorts by totalPlays descending (first click)', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    fireEvent.click(screen.getByText('Lượt nghe'));
    const rows = screen.getAllByRole('row').slice(1); // skip header
    // After sort desc, first row should be highest totalPlays = 15420 = Lạc Trôi
    expect(within(rows[0]).getByText('Lạc Trôi')).toBeInTheDocument();
  });

  it('clicking "Lượt nghe" twice sorts ascending (lowest first)', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    fireEvent.click(screen.getByText('Lượt nghe'));
    fireEvent.click(screen.getByText('Lượt nghe'));
    const rows = screen.getAllByRole('row').slice(1);
    // Ascending: lowest totalPlays = 7650 = Lạc Trôi B
    expect(within(rows[0]).getByText('Lạc Trôi B')).toBeInTheDocument();
  });

  it('clicking "Bài hát" sorts by title alphabetically (desc first, then asc)', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    fireEvent.click(screen.getByText('Bài hát'));
    fireEvent.click(screen.getByText('Bài hát')); // second click = asc
    const rows = screen.getAllByRole('row').slice(1);
    // Ascending alpha: 'Chuyến Xe' < 'Lạc Trôi' < 'Lạc Trôi B'
    expect(within(rows[0]).getByText('Chuyến Xe')).toBeInTheDocument();
  });

  it('clicking "Hoàn thành %" sorts by completionRate', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    fireEvent.click(screen.getByText('Hoàn thành %'));
    const rows = screen.getAllByRole('row').slice(1);
    // desc: highest completionRate = 0.81 = Chuyến Xe
    expect(within(rows[0]).getByText('Chuyến Xe')).toBeInTheDocument();
  });

  it('clicking "Người nghe" sorts by uniqueListeners', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    fireEvent.click(screen.getByText('Người nghe'));
    const rows = screen.getAllByRole('row').slice(1);
    // desc: highest uniqueListeners = 8930 = Lạc Trôi
    expect(within(rows[0]).getByText('Lạc Trôi')).toBeInTheDocument();
  });

  it('clicking "Ngày upload" after another column sorts by uploadedAt desc (most recent first)', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    // Switch active column to totalPlays first, then click Ngày upload (new column → desc)
    fireEvent.click(screen.getByText('Lượt nghe'));
    fireEvent.click(screen.getByText('Ngày upload'));
    const rows = screen.getAllByRole('row').slice(1);
    // desc: most recent = 2024-03-05 = Lạc Trôi B
    expect(within(rows[0]).getByText('Lạc Trôi B')).toBeInTheDocument();
  });

  it('shows active sort icon (expand_more) for current sort column', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    fireEvent.click(screen.getByText('Lượt nghe'));
    // After clicking Lượt nghe (default desc), icon should be expand_more
    expect(screen.getAllByText('expand_more').length).toBeGreaterThan(0);
  });

  it('shows expand_less icon when sorted ascending', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    fireEvent.click(screen.getByText('Lượt nghe'));
    fireEvent.click(screen.getByText('Lượt nghe'));
    expect(screen.getAllByText('expand_less').length).toBeGreaterThan(0);
  });

  it('resets to page 0 when sort column changes', () => {
    render(<CreatorSongTable rows={ROWS_12} onViewAnalytics={vi.fn()} />);
    // Go to page 2
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(screen.getByText('Trang 2 / 2')).toBeInTheDocument();
    // Sort by something else → should reset to page 1
    fireEvent.click(screen.getByText('Lượt nghe'));
    expect(screen.getByText('Trang 1 / 2')).toBeInTheDocument();
  });
});

// ─── Pagination ───────────────────────────────────────────────────────────────

describe('CreatorSongTable — pagination', () => {
  it('does not render pagination controls when rows fit on one page', () => {
    render(<CreatorSongTable rows={ROWS_3} onViewAnalytics={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Trang trước' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trang sau' })).not.toBeInTheDocument();
  });

  it('renders pagination controls when rows exceed PAGE_SIZE (10)', () => {
    render(<CreatorSongTable rows={ROWS_12} onViewAnalytics={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeInTheDocument();
  });

  it('shows "Trang 1 / 2" on first page', () => {
    render(<CreatorSongTable rows={ROWS_12} onViewAnalytics={vi.fn()} />);
    expect(screen.getByText('Trang 1 / 2')).toBeInTheDocument();
  });

  it('shows only 10 rows on the first page', () => {
    render(<CreatorSongTable rows={ROWS_12} onViewAnalytics={vi.fn()} />);
    const dataRows = screen.getAllByRole('row').slice(1); // skip header
    expect(dataRows.length).toBe(10);
  });

  it('"Trang trước" button is disabled on first page', () => {
    render(<CreatorSongTable rows={ROWS_12} onViewAnalytics={vi.fn()} />);
    const prevBtn = screen.getByRole('button', { name: 'Trang trước' });
    expect(prevBtn).toBeDisabled();
  });

  it('"Trang sau" button is enabled on first page', () => {
    render(<CreatorSongTable rows={ROWS_12} onViewAnalytics={vi.fn()} />);
    const nextBtn = screen.getByRole('button', { name: 'Trang sau' });
    expect(nextBtn).not.toBeDisabled();
  });

  it('clicking "Trang sau" navigates to second page', () => {
    render(<CreatorSongTable rows={ROWS_12} onViewAnalytics={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(screen.getByText('Trang 2 / 2')).toBeInTheDocument();
  });

  it('shows 2 rows on the second page (12 total, 10 per page)', () => {
    render(<CreatorSongTable rows={ROWS_12} onViewAnalytics={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows.length).toBe(2);
  });

  it('"Trang sau" button is disabled on last page', () => {
    render(<CreatorSongTable rows={ROWS_12} onViewAnalytics={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
  });

  it('"Trang trước" button is enabled on second page', () => {
    render(<CreatorSongTable rows={ROWS_12} onViewAnalytics={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(screen.getByRole('button', { name: 'Trang trước' })).not.toBeDisabled();
  });

  it('clicking "Trang trước" returns to first page', () => {
    render(<CreatorSongTable rows={ROWS_12} onViewAnalytics={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
    expect(screen.getByText('Trang 1 / 2')).toBeInTheDocument();
    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows.length).toBe(10);
  });

  it('second page row numbers start from 11', () => {
    render(<CreatorSongTable rows={ROWS_12} onViewAnalytics={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
