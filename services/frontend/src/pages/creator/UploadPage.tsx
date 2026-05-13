import { useNavigate } from 'react-router-dom';
import { useUpload } from '../../features/creator/hooks/useUpload';
import FileDropzone from '../../features/creator/components/FileDropzone';
import MetadataForm from '../../features/creator/components/MetadataForm';
import RoleGuard from '../../components/RoleGuard';

function UploadPageContent() {
  const navigate = useNavigate();
  const {
    audioFile,
    coverPreview,
    fileError,
    form,
    status,
    uploadedSong,
    uploadError,
    canSubmit,
    selectAudioFile,
    selectCoverFile,
    updateForm,
    submit,
    reset,
  } = useUpload();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submit();
  }

  if (status === 'success' && uploadedSong) {
    return (
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-lg py-xl flex flex-col items-center gap-lg">
          <span
            className="material-symbols-outlined text-[64px] text-spotify-green"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
          <h1 className="font-section-title text-section-title text-text-base">Tải lên thành công!</h1>
          <p className="font-body-regular text-body-regular text-text-secondary text-center">
            Bài hát <span className="text-text-base font-body-bold">{uploadedSong.title}</span> đã được tải lên.
          </p>
          <div className="flex gap-md">
            <button
              type="button"
              onClick={reset}
              className="font-button-uppercase text-button-uppercase text-text-base bg-transparent border border-border-pill rounded-full px-lg py-md hover:border-text-base transition-colors"
            >
              TẢI LÊN BÀI KHÁC
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="font-button-uppercase text-button-uppercase text-near-black bg-spotify-green rounded-full px-lg py-md hover:brightness-110 transition-all"
            >
              XEM ANALYTICS
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-lg py-xl">
        {/* HEADER */}
        <header className="mb-lg">
          <h1 className="font-section-title text-section-title text-text-base mb-sm flex items-center gap-sm">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              upload
            </span>
            Tải nhạc lên
          </h1>
          <p className="font-caption text-caption text-text-secondary">
            Chia sẻ âm nhạc của bạn với thế giới
          </p>
        </header>

        <form className="flex flex-col gap-lg" onSubmit={handleSubmit}>
          {/* SECTION 1 - File Upload */}
          <FileDropzone
            audioFile={audioFile}
            fileError={fileError}
            onFileSelect={selectAudioFile}
          />

          {/* SECTION 2 - Metadata */}
          <MetadataForm
            form={form}
            coverPreview={coverPreview}
            onChange={updateForm}
            onCoverSelect={selectCoverFile}
          />

          {/* SECTION 3 - Preview */}
          <section className="bg-dark-card rounded-[8px] p-md shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
            <div className="font-micro text-micro text-text-secondary mb-md tracking-widest">XEM TRƯỚC</div>
            <div className="flex items-center justify-between bg-mid-dark rounded-[8px] p-sm">
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 bg-[#2a2a2a] rounded-[4px] flex items-center justify-center overflow-hidden">
                  {coverPreview ? (
                    <img src={coverPreview} alt="Bìa" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-text-secondary">music_note</span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="font-body-bold text-body-bold text-text-base">
                    {form.title || 'Tên bài hát'}
                  </span>
                  <span className="font-caption text-caption text-text-secondary">Tên nghệ sĩ</span>
                </div>
              </div>
              <button
                type="button"
                className="w-10 h-10 bg-spotify-green rounded-full flex items-center justify-center text-near-black hover:scale-105 transition-transform"
                aria-label="Xem trước bài hát"
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  play_arrow
                </span>
              </button>
            </div>
          </section>

          {/* Error */}
          {uploadError && (
            <p role="alert" className="font-caption text-caption text-negative text-center">
              {uploadError}
            </p>
          )}

          {/* SUBMIT */}
          <div className="flex flex-col items-center gap-md mt-md">
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-spotify-green text-near-black font-button-uppercase text-button-uppercase rounded-full py-lg hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {status === 'uploading' ? 'ĐANG TẢI LÊN...' : 'TẢI LÊN'}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="font-caption text-caption text-text-secondary hover:text-text-base transition-colors"
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function UploadPage() {
  return (
    <RoleGuard roles={['Creator', 'Admin']}>
      <div className="bg-near-black text-text-base font-body-regular min-h-screen flex">
        <UploadPageContent />
      </div>
    </RoleGuard>
  );
}
