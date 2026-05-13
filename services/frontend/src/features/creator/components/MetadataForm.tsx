import type { UploadForm } from '../hooks/useUpload';

interface Props {
  form: UploadForm;
  coverPreview: string | null;
  onChange: (patch: Partial<UploadForm>) => void;
  onCoverSelect: (file: File) => void;
}

export default function MetadataForm({ form, coverPreview, onChange, onCoverSelect }: Props) {
  return (
    <section className="bg-dark-surface rounded-[8px] p-lg flex flex-col gap-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
        <div className="flex flex-col gap-sm">
          <label className="font-small-bold text-small-bold text-text-secondary">Tên bài hát</label>
          <input
            type="text"
            placeholder="Nhập tên bài hát"
            value={form.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="w-full bg-mid-dark rounded-full px-md py-sm font-body-regular text-body-regular text-text-base inset-input-shadow border-none focus:ring-0 focus:outline-none"
            aria-label="Tên bài hát"
          />
        </div>

        <div className="flex flex-col gap-sm">
          <label className="font-small-bold text-small-bold text-text-secondary">Thể loại</label>
          <input
            type="text"
            placeholder="VD: Pop, Rock, Rap"
            value={form.genre}
            onChange={(e) => onChange({ genre: e.target.value })}
            className="w-full bg-mid-dark rounded-full px-md py-sm font-body-regular text-body-regular text-text-base inset-input-shadow border-none focus:ring-0 focus:outline-none"
            aria-label="Thể loại"
          />
        </div>

        <div className="flex flex-col gap-sm">
          <label className="font-small-bold text-small-bold text-text-secondary">Tâm trạng</label>
          <input
            type="text"
            placeholder="Vui vẻ, Buồn, Sôi động"
            value={form.mood}
            onChange={(e) => onChange({ mood: e.target.value })}
            className="w-full bg-mid-dark rounded-full px-md py-sm font-body-regular text-body-regular text-text-base inset-input-shadow border-none focus:ring-0 focus:outline-none"
            aria-label="Tâm trạng"
          />
        </div>

        <div className="flex flex-col gap-sm">
          <label className="font-small-bold text-small-bold text-text-secondary">Ngôn ngữ</label>
          <input
            type="text"
            placeholder="Tiếng Việt"
            value={form.language}
            onChange={(e) => onChange({ language: e.target.value })}
            className="w-full bg-mid-dark rounded-full px-md py-sm font-body-regular text-body-regular text-text-base inset-input-shadow border-none focus:ring-0 focus:outline-none"
            aria-label="Ngôn ngữ"
          />
        </div>
      </div>

      <div className="flex items-start gap-lg border-t border-border-muted pt-lg mt-sm">
        <div className="flex flex-col gap-sm w-auto">
          <label className="font-small-bold text-small-bold text-text-secondary">Bìa album</label>
          <label
            className="w-[120px] h-[120px] border-2 border-dashed border-border-muted rounded-[8px] flex items-center justify-center hover:bg-[#1f1f1f] cursor-pointer transition-colors bg-mid-dark overflow-hidden"
            aria-label="Chọn ảnh bìa album"
          >
            {coverPreview ? (
              <img src={coverPreview} alt="Ảnh bìa" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-text-secondary">add_photo_alternate</span>
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onCoverSelect(f); }}
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
