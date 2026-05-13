import { useRef, useState } from 'react';

interface Props {
  audioFile: File | null;
  fileError: string | null;
  onFileSelect: (file: File) => void;
}

export default function FileDropzone({ audioFile, fileError, onFileSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  }

  return (
    <section className="bg-dark-surface rounded-[8px] p-xl">
      <div
        role="button"
        aria-label="Khu vực tải file nhạc"
        tabIndex={0}
        className={`border-2 border-dashed rounded-[8px] p-[48px] flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
          dragging ? 'border-spotify-green bg-[#1f1f1f]' : 'border-border-muted hover:bg-[#1f1f1f]'
        }`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <span
          className="material-symbols-outlined text-[48px] text-text-secondary mb-md"
          style={{ fontVariationSettings: "'FILL' 0" }}
        >
          music_note
        </span>

        {audioFile ? (
          <>
            <p className="font-body-bold text-body-bold text-spotify-green mb-sm">
              {audioFile.name}
            </p>
            <p className="font-caption text-caption text-text-secondary">
              {(audioFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </>
        ) : (
          <>
            <h2 className="font-body-bold text-body-bold text-text-base mb-lg">
              Kéo thả file nhạc vào đây
            </h2>
            <button
              type="button"
              className="font-button-uppercase text-button-uppercase text-text-base bg-transparent border border-border-pill rounded-full px-lg py-md hover:border-text-base hover:text-text-emphasis transition-colors"
            >
              CHỌN FILE
            </button>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg"
          className="sr-only"
          onChange={handleChange}
          aria-hidden="true"
        />
      </div>

      {fileError && (
        <p role="alert" className="mt-sm font-caption text-caption text-negative">
          {fileError}
        </p>
      )}
    </section>
  );
}
