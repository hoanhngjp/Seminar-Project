import { useState } from 'react';
import type { CreatorSongRow } from '../../../types/domain';
import SkeletonRow from '../../../components/ui/SkeletonRow';
import EmptyState from '../../../components/ui/EmptyState';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortCol = 'title' | 'uploadedAt' | 'totalPlays' | 'uniqueListeners' | 'completionRate';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 10;

interface CreatorSongTableProps {
  rows: CreatorSongRow[];
  loading?: boolean;
  onViewAnalytics: (songId: string) => void;
  onUpload?: () => void;
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <span className="material-symbols-outlined text-[16px] text-text-secondary/40">
        unfold_more
      </span>
    );
  }
  return (
    <span className="material-symbols-outlined text-[16px] text-spotify-green">
      {dir === 'asc' ? 'expand_less' : 'expand_more'}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreatorSongTable({
  rows,
  loading = false,
  onViewAnalytics,
  onUpload,
}: CreatorSongTableProps) {
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir }>({
    col: 'uploadedAt',
    dir: 'desc',
  });
  const [page, setPage] = useState(0);

  function toggleSort(col: SortCol) {
    setSort((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'desc' },
    );
    setPage(0);
  }

  const sorted = [...rows].sort((a, b) => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    if (sort.col === 'title') return dir * a.title.localeCompare(b.title, 'vi');
    if (sort.col === 'uploadedAt') return dir * a.uploadedAt.localeCompare(b.uploadedAt);
    return dir * ((a[sort.col] as number) - (b[sort.col] as number));
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="bg-dark-surface rounded-[8px] p-4">
        <SkeletonRow rows={5} />
      </div>
    );
  }

  // ── Empty state ──
  if (rows.length === 0) {
    return (
      <EmptyState
        variant="music"
        title="Chưa có bài hát nào"
        ctaLabel={onUpload ? 'Upload ngay' : undefined}
        onCta={onUpload}
      />
    );
  }

  // ── Table ──
  return (
    <div className="bg-dark-surface rounded-[8px] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-muted/20 text-text-secondary text-[12px]">
              <th className="px-4 py-3 text-left w-10 font-normal">#</th>

              <th className="px-4 py-3 text-left font-normal">
                <button
                  onClick={() => toggleSort('title')}
                  className="flex items-center gap-1 hover:text-text-base transition-colors"
                >
                  Bài hát
                  <SortIcon active={sort.col === 'title'} dir={sort.dir} />
                </button>
              </th>

              <th className="px-4 py-3 text-left font-normal">
                <button
                  onClick={() => toggleSort('uploadedAt')}
                  className="flex items-center gap-1 hover:text-text-base transition-colors"
                >
                  Ngày upload
                  <SortIcon active={sort.col === 'uploadedAt'} dir={sort.dir} />
                </button>
              </th>

              <th className="px-4 py-3 text-right font-normal">
                <button
                  onClick={() => toggleSort('totalPlays')}
                  className="flex items-center gap-1 hover:text-text-base transition-colors ml-auto"
                >
                  Lượt nghe
                  <SortIcon active={sort.col === 'totalPlays'} dir={sort.dir} />
                </button>
              </th>

              <th className="px-4 py-3 text-right font-normal">
                <button
                  onClick={() => toggleSort('uniqueListeners')}
                  className="flex items-center gap-1 hover:text-text-base transition-colors ml-auto"
                >
                  Người nghe
                  <SortIcon active={sort.col === 'uniqueListeners'} dir={sort.dir} />
                </button>
              </th>

              <th className="px-4 py-3 text-left font-normal">
                <button
                  onClick={() => toggleSort('completionRate')}
                  className="flex items-center gap-1 hover:text-text-base transition-colors"
                >
                  Hoàn thành %
                  <SortIcon active={sort.col === 'completionRate'} dir={sort.dir} />
                </button>
              </th>

              <th className="px-4 py-3 w-28" />
            </tr>
          </thead>

          <tbody>
            {pageRows.map((row, idx) => (
              <tr
                key={row.songId}
                className="group border-b border-border-muted/10 hover:bg-mid-dark/50 transition-colors"
              >
                {/* # */}
                <td className="px-4 py-3 text-text-secondary text-[12px]">
                  {page * PAGE_SIZE + idx + 1}
                </td>

                {/* Song */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {row.coverUrl ? (
                      <img
                        src={row.coverUrl}
                        alt={row.title}
                        className="w-10 h-10 rounded-[4px] object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-[4px] bg-mid-dark flex-shrink-0 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[16px] text-text-secondary">
                          music_note
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-text-base text-[14px] leading-tight">
                        {row.title}
                      </div>
                      {row.genre && (
                        <div className="text-[12px] text-text-secondary">{row.genre}</div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Upload date */}
                <td className="px-4 py-3 text-text-secondary text-[13px]">
                  {new Date(row.uploadedAt).toLocaleDateString('vi-VN')}
                </td>

                {/* Total plays */}
                <td className="px-4 py-3 text-right text-[13px] text-text-base font-bold">
                  {row.totalPlays.toLocaleString('vi-VN')}
                </td>

                {/* Unique listeners */}
                <td className="px-4 py-3 text-right text-[13px] text-text-base">
                  {row.uniqueListeners.toLocaleString('vi-VN')}
                </td>

                {/* Completion rate — progress bar */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-mid-dark rounded-full h-1.5 overflow-hidden min-w-[60px]">
                      <div
                        className="h-full bg-spotify-green rounded-full"
                        style={{ width: `${Math.round(row.completionRate * 100)}%` }}
                        aria-label={`${Math.round(row.completionRate * 100)}% hoàn thành`}
                      />
                    </div>
                    <span className="text-[12px] text-text-secondary w-9 text-right flex-shrink-0">
                      {Math.round(row.completionRate * 100)}%
                    </span>
                  </div>
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <button
                    onClick={() => onViewAnalytics(row.songId)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[12px] text-spotify-green font-bold hover:underline whitespace-nowrap"
                  >
                    Xem phân tích
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-muted/20">
          <span className="text-[12px] text-text-secondary">
            Trang {page + 1} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              aria-label="Trang trước"
              className="px-3 py-1.5 text-[12px] font-bold rounded-full bg-mid-dark text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-mid-card hover:text-text-base transition-colors"
            >
              ‹ Trước
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
              aria-label="Trang sau"
              className="px-3 py-1.5 text-[12px] font-bold rounded-full bg-mid-dark text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-mid-card hover:text-text-base transition-colors"
            >
              Sau ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
