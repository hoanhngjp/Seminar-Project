import { useState } from 'react';
import AppShell from '../components/layout/AppShell';
import { GenreGrid } from '../features/onboarding/components/GenreGrid';
import { useToast } from '../contexts/ToastContext';
import { MOCK_PROFILE } from '../mocks/data';

const MOCK_ARTIST_RESULTS = [
  'Sơn Tùng M-TP', 'Vũ.', 'Đen Vâu', 'Chillies', 'Ngọt',
  'Hòa Minzy', 'Bích Phương', 'Mỹ Tâm', 'Dương Triệu Vũ', 'Hoàng Thùy Linh',
];

export default function PreferencesPage() {
  const toast = useToast();

  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    MOCK_PROFILE.preferredGenres ?? []
  );
  const [selectedArtists, setSelectedArtists] = useState<string[]>(
    MOCK_PROFILE.preferredArtists ?? []
  );
  const [artistSearch, setArtistSearch] = useState('');

  function toggleGenre(id: string) {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  function toggleArtist(name: string) {
    setSelectedArtists((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  }

  function removeArtist(name: string) {
    setSelectedArtists((prev) => prev.filter((a) => a !== name));
  }

  function handleSave() {
    if (selectedGenres.length < 3) return;
    toast.show('Đã lưu sở thích thành công', 'success');
  }

  const filteredArtists = MOCK_ARTIST_RESULTS.filter(
    (a) =>
      a.toLowerCase().includes(artistSearch.toLowerCase()) &&
      !selectedArtists.includes(a)
  );

  const canSave = selectedGenres.length >= 3;

  return (
    <AppShell>
      <div className="max-w-[640px] mx-auto py-8 pb-[96px] lg:pb-8">
        <h1 className="text-[24px] font-bold text-text-base mb-2">Cập nhật sở thích</h1>
        <p className="text-text-secondary text-sm mb-8">
          Chọn ít nhất 3 thể loại và một số nghệ sĩ bạn yêu thích để nhận gợi ý phù hợp hơn.
        </p>

        {/* ── Genre section ── */}
        <section className="mb-8" data-testid="genre-section">
          <h2 className="text-[16px] font-semibold text-text-base mb-4">
            Thể loại yêu thích
            <span className="text-text-secondary text-sm font-normal ml-2">
              ({selectedGenres.length}/3 tối thiểu)
            </span>
          </h2>
          <GenreGrid selectedGenres={selectedGenres} toggleGenre={toggleGenre} />
          {selectedGenres.length < 3 && (
            <p className="text-negative text-xs mt-2" data-testid="genre-warning">
              Vui lòng chọn ít nhất 3 thể loại
            </p>
          )}
        </section>

        {/* ── Artist section ── */}
        <section className="mb-8" data-testid="artist-section">
          <h2 className="text-[16px] font-semibold text-text-base mb-4">Nghệ sĩ yêu thích</h2>

          {/* Search input */}
          <input
            type="text"
            placeholder="Tìm nghệ sĩ..."
            value={artistSearch}
            onChange={(e) => setArtistSearch(e.target.value)}
            className="w-full bg-dark-surface border border-border-muted rounded-[8px] px-4 py-2.5 text-sm text-text-base placeholder-text-secondary focus:outline-none focus:border-spotify-green mb-3"
            data-testid="artist-search-input"
          />

          {/* Filtered results */}
          {artistSearch.length > 0 && filteredArtists.length > 0 && (
            <div className="bg-dark-surface rounded-[8px] border border-border-muted mb-3 overflow-hidden" data-testid="artist-results">
              {filteredArtists.slice(0, 5).map((name) => (
                <button
                  key={name}
                  onClick={() => toggleArtist(name)}
                  className="w-full text-left px-4 py-2.5 text-sm text-text-base hover:bg-mid-dark transition-colors"
                  data-testid={`artist-result-${name}`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* Selected artists */}
          {selectedArtists.length > 0 && (
            <div className="flex flex-wrap gap-2" data-testid="selected-artists">
              {selectedArtists.map((name) => (
                <span
                  key={name}
                  className="flex items-center gap-1 bg-spotify-green/20 text-spotify-green text-sm px-3 py-1 rounded-full"
                  data-testid={`selected-artist-${name}`}
                >
                  {name}
                  <button
                    onClick={() => removeArtist(name)}
                    aria-label={`Xóa ${name}`}
                    data-testid={`remove-artist-${name}`}
                    className="ml-1 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Sticky save bar ── */}
      <div
        className="fixed bottom-[72px] lg:bottom-0 left-0 lg:left-[280px] right-0 bg-dark-bg border-t border-border-muted px-6 py-3 flex items-center justify-between z-[50]"
        data-testid="save-bar"
      >
        <span className="text-text-secondary text-sm">
          {!canSave && 'Chọn thêm thể loại để lưu'}
        </span>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className={`px-6 py-2 rounded-full font-medium text-sm transition-colors ${
            canSave
              ? 'bg-spotify-green text-near-black hover:scale-105'
              : 'bg-mid-dark text-text-secondary cursor-not-allowed'
          }`}
          data-testid="save-button"
        >
          Lưu sở thích
        </button>
      </div>
    </AppShell>
  );
}
