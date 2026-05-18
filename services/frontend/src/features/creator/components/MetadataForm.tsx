import { useEffect, useState } from 'react';
import { getGenres } from '../../../services/musicService';
import type { Genre } from '../../../services/musicService';
import type { UploadForm } from '../hooks/useUpload';

interface Props {
  form: UploadForm;
  coverPreview: string | null;
  onChange: (patch: Partial<UploadForm>) => void;
  onCoverSelect: (file: File) => void;
}

const MOOD_OPTIONS = [
  { value: '', label: 'Chọn tâm trạng' },
  { value: 'happy', label: 'Vui vẻ' },
  { value: 'sad', label: 'Buồn' },
  { value: 'energetic', label: 'Sôi động' },
  { value: 'calm', label: 'Thư giãn' },
  { value: 'romantic', label: 'Lãng mạn' },
  { value: 'morning', label: 'Buổi sáng' },
];

const LANGUAGE_OPTIONS = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'Tiếng Anh' },
  { value: 'ko', label: 'Tiếng Hàn' },
  { value: 'ja', label: 'Tiếng Nhật' },
  { value: 'zh', label: 'Tiếng Trung' },
  { value: 'fr', label: 'Tiếng Pháp' },
  { value: 'other', label: 'Khác' },
];

const SELECT_CLASS =
  'w-full bg-mid-dark rounded-full px-md py-sm font-body-regular text-body-regular text-text-base shadow-input-inset border-none focus:ring-0 focus:outline-none appearance-none cursor-pointer';

export default function MetadataForm({ form, coverPreview, onChange, onCoverSelect }: Props) {
  const [genres, setGenres] = useState<Genre[]>([]);

  useEffect(() => {
    getGenres().then(setGenres).catch(() => {});
  }, []);

  function handleGenreToggle(genreId: string) {
    const current = form.genreIds;
    if (current.includes(genreId)) {
      onChange({ genreIds: current.filter((id) => id !== genreId) });
    } else {
      onChange({ genreIds: [...current, genreId] });
    }
  }

  return (
    <section className="bg-dark-surface rounded-[8px] p-lg flex flex-col gap-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
        {/* Tên bài hát */}
        <div className="flex flex-col gap-sm">
          <label className="font-small-bold text-small-bold text-text-secondary">Tên bài hát</label>
          <input
            type="text"
            placeholder="Nhập tên bài hát"
            value={form.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="w-full bg-mid-dark rounded-full px-md py-sm font-body-regular text-body-regular text-text-base shadow-input-inset border-none focus:ring-0 focus:outline-none"
            aria-label="Tên bài hát"
          />
        </div>

        {/* Tâm trạng */}
        <div className="flex flex-col gap-sm">
          <label className="font-small-bold text-small-bold text-text-secondary">Tâm trạng</label>
          <select
            value={form.mood}
            onChange={(e) => onChange({ mood: e.target.value })}
            className={SELECT_CLASS}
            aria-label="Tâm trạng"
          >
            {MOOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-dark-surface text-text-base">
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Ngôn ngữ */}
        <div className="flex flex-col gap-sm">
          <label className="font-small-bold text-small-bold text-text-secondary">Ngôn ngữ</label>
          <select
            value={form.language}
            onChange={(e) => onChange({ language: e.target.value })}
            className={SELECT_CLASS}
            aria-label="Ngôn ngữ"
          >
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-dark-surface text-text-base">
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Thể loại — multi-select pill */}
      {genres.length > 0 && (
        <div className="flex flex-col gap-sm">
          <label className="font-small-bold text-small-bold text-text-secondary">
            Thể loại{' '}
            <span className="font-caption text-caption text-text-secondary">(chọn nhiều)</span>
          </label>
          <div className="flex flex-wrap gap-sm" role="group" aria-label="Thể loại">
            {genres.map((genre) => {
              const selected = form.genreIds.includes(genre.id);
              return (
                <button
                  key={genre.id}
                  type="button"
                  onClick={() => handleGenreToggle(genre.id)}
                  aria-pressed={selected}
                  className={`px-md py-xs rounded-full font-caption text-caption transition-colors ${
                    selected
                      ? 'bg-spotify-green text-near-black'
                      : 'bg-mid-dark text-text-secondary hover:text-text-base border border-border-muted'
                  }`}
                >
                  {genre.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bìa album + Explicit toggle */}
      <div className="flex items-start gap-lg border-t border-border-muted pt-lg mt-sm">
        <div className="flex flex-col gap-sm w-auto">
          <label className="font-small-bold text-small-bold text-text-secondary">Bìa album</label>
          <label
            className="w-[120px] h-[120px] border-2 border-dashed border-border-muted rounded-[8px] flex items-center justify-center hover:bg-mid-dark cursor-pointer transition-colors bg-mid-dark overflow-hidden"
            aria-label="Chọn ảnh bìa album"
          >
            {coverPreview ? (
              <img src={coverPreview} alt="Ảnh bìa" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-text-secondary">add_photo_alternate</span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCoverSelect(f);
              }}
            />
          </label>
        </div>

        <div className="flex-1 flex flex-col justify-center h-[120px]">
          <div className="flex items-center justify-between p-md bg-mid-dark rounded-[8px]">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-text-secondary">warning</span>
              <span className="font-body-regular text-body-regular text-text-base">🔞 Nội dung người lớn (Explicit)</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer" aria-label="Nội dung người lớn">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={form.isExplicit}
                onChange={(e) => onChange({ isExplicit: e.target.checked })}
              />
              <div className="w-11 h-6 bg-border-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-spotify-green"></div>
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
