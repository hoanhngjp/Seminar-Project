import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { usePlayerStore } from '../store/playerStore';
import { useAuthStore } from '../store/authStore';
import { useRecommendations } from '../features/recommendation/hooks/useRecommendations';
import SongCard from '../features/recommendation/components/SongCard';
import ContextSelector from '../features/recommendation/components/ContextSelector';
import RecommendationFeedRow from '../features/recommendation/components/RecommendationFeedRow';
import SkeletonRow from '../components/ui/SkeletonRow';
import type { RecommendedSong, TimeContext } from '../types/domain';

const CONTEXT_LABEL: Record<string, string> = {
  morning:   'Gợi ý cho bạn sáng nay',
  afternoon: 'Gợi ý buổi chiều',
  evening:   'Gợi ý buổi tối',
  night:     'Nhạc khuya cho bạn',
};

const CONTEXT_SUB: Record<string, string> = {
  morning:   'Vì bạn nghe nhạc buổi sáng',
  afternoon: 'Vì bạn nghe nhạc buổi chiều',
  evening:   'Vì bạn nghe nhạc buổi tối',
  night:     'Nhạc nhẹ nhàng cho đêm muộn',
};

function HorizontalSection({
  title,
  subtitle,
  items,
  onPlay,
  showAll,
}: {
  title: string;
  subtitle?: string;
  items: RecommendedSong[];
  onPlay: (song: RecommendedSong) => void;
  showAll?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="mb-4 flex justify-between items-end">
        <div>
          <h3 className="text-[18px] font-semibold text-text-base">{title}</h3>
          {subtitle && <p className="text-text-secondary text-sm">{subtitle}</p>}
        </div>
        {showAll && (
          <span className="text-text-secondary text-sm hover:underline cursor-pointer">
            Hiển thị tất cả
          </span>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-lg px-lg snap-x">
        {items.map((song) => (
          <SongCard key={song.id} song={song} onPlay={onPlay} />
        ))}
      </div>
    </section>
  );
}

function GridSection({
  title,
  items,
  onPlay,
}: {
  title: string;
  items: RecommendedSong[];
  onPlay: (song: RecommendedSong) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="pb-10">
      <div className="mb-4">
        <h3 className="text-[18px] font-semibold text-text-base">{title}</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map((song) => (
          <SongCard key={song.id} song={song} onPlay={onPlay} />
        ))}
      </div>
    </section>
  );
}

// ── Context Feed (row layout) ─────────────────────────────────────────────────

function ContextFeedSection({
  items,
  onPlay,
  onReload,
}: {
  items: RecommendedSong[];
  onPlay: (song: RecommendedSong) => void;
  onReload: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Gợi ý theo bối cảnh">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[18px] font-[600] leading-[1.3] text-text-base">Gợi ý cho bạn</h3>
        <button
          aria-label="Làm mới gợi ý"
          onClick={onReload}
          className="w-10 h-10 rounded-full bg-mid-dark flex items-center justify-center hover:bg-[#2a2a2a] transition-colors"
        >
          <span className="material-symbols-outlined text-text-secondary">refresh</span>
        </button>
      </div>
      <div className="flex flex-col" role="list">
        {items.map((song, idx) => (
          <RecommendationFeedRow
            key={song.id}
            song={song}
            index={idx}
            onPlay={onPlay}
          />
        ))}
      </div>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate    = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const setSong     = usePlayerStore((s) => s.setSong);

  const [selectedContext, setSelectedContext] = useState<TimeContext | 'none'>('none');

  useEffect(() => {
    if (!accessToken) navigate('/login', { replace: true });
  }, [accessToken, navigate]);

  const { contextItems, trendingItems, preferenceItems, loading, error, context, reload } =
    useRecommendations(selectedContext);

  // All items for the row-layout context feed (shown together for quick access)
  const allItems = [...contextItems, ...trendingItems, ...preferenceItems];

  const handlePlay = (song: RecommendedSong) => {
    setSong({ songId: song.id, title: song.title, artist: song.artist, coverUrl: song.coverUrl });
  };

  if (!accessToken) return null;

  const allEmpty = !loading && !error && contextItems.length === 0 && trendingItems.length === 0 && preferenceItems.length === 0;

  return (
    <AppShell>
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-40 w-full bg-near-black/80 backdrop-blur-md flex justify-between items-center h-16 px-lg border-b border-transparent">
        <h2 className="text-[24px] font-bold text-text-emphasis tracking-tight">
          {CONTEXT_LABEL[context] ?? 'Chào mừng trở lại'} 👋
        </h2>
        <div className="flex items-center gap-4">
          <button className="bg-white text-near-black font-bold px-4 py-1.5 rounded-full hover:scale-105 transition-transform text-xs tracking-wider">
            Nâng cấp
          </button>
          <span className="material-symbols-outlined text-text-secondary hover:text-text-base cursor-pointer transition-colors">
            settings
          </span>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="p-lg space-y-10">

        {/* ── Context Selector ── */}
        <div>
          <ContextSelector value={selectedContext} onChange={setSelectedContext} />
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div aria-label="Đang tải danh sách nhạc" className="space-y-10">
            {[0, 1].map((s) => (
              <section key={s}>
                <div className="mb-4 h-5 w-40 bg-mid-dark rounded animate-shimmer" />
                <div className="flex gap-4 overflow-hidden">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            role="alert"
            className="flex flex-col items-center gap-4 py-16 text-center"
          >
            <p className="text-negative">{error}</p>
            <button
              onClick={reload}
              className="px-6 py-2.5 bg-spotify-green text-near-black font-bold rounded-full hover:scale-105 transition-transform text-sm tracking-wider"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Empty */}
        {allEmpty && (
          <p className="text-text-secondary text-center py-16">
            Không có gợi ý. Hãy nghe nhạc để cá nhân hoá!
          </p>
        )}

        {/* Sections */}
        {!loading && !error && (
          <>
            {/* Row-layout feed — only when a specific context is selected */}
            {selectedContext !== 'none' && (
              <ContextFeedSection
                items={allItems}
                onPlay={handlePlay}
                onReload={reload}
              />
            )}

            {/* Card sections — discovery layout */}
            <HorizontalSection
              title={CONTEXT_LABEL[context] ?? 'Gợi ý cho bạn'}
              subtitle={CONTEXT_SUB[context]}
              items={contextItems}
              onPlay={handlePlay}
            />
            <HorizontalSection
              title="Đang thịnh hành"
              items={trendingItems}
              onPlay={handlePlay}
              showAll
            />
            <GridSection
              title="Vì bạn nghe"
              items={preferenceItems}
              onPlay={handlePlay}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
