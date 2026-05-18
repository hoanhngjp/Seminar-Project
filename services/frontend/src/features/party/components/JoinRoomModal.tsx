import { useState, useRef, useCallback, useEffect } from 'react';
import { joinParty, getPartyPreview } from '../../../services/partyService';
import type { Party, PartyPreview } from '../../../types/domain';

interface Props {
  onClose: () => void;
  onJoined: (party: Party) => void;
}

export default function JoinRoomModal({ onClose, onJoined }: Props) {
  const [chars, setChars]       = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [preview, setPreview]   = useState<PartyPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  const joinCode = chars.join('').toUpperCase();
  const isComplete = joinCode.length === 6 && chars.every((c) => c !== '');

  useEffect(() => {
    if (!isComplete) { setPreview(null); return; }
    let cancelled = false;
    setPreviewLoading(true);
    setPreview(null);
    getPartyPreview(joinCode)
      .then((data) => { if (!cancelled) setPreview(data); })
      .catch(() => { if (!cancelled) setPreview(null); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [joinCode, isComplete]);

  const handleChange = useCallback((idx: number, value: string) => {
    const char = value.slice(-1).toUpperCase();
    const next = [...chars];
    next[idx] = char;
    setChars(next);
    setError('');

    if (char && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  }, [chars]);

  const handleKeyDown = useCallback((idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !chars[idx] && idx > 0) {
      const next = [...chars];
      next[idx - 1] = '';
      setChars(next);
      inputRefs.current[idx - 1]?.focus();
    }
  }, [chars]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\s/g, '').toUpperCase().slice(0, 6);
    const next = Array(6).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setChars(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }, []);

  const handleJoin = async () => {
    if (!isComplete) return;
    setLoading(true);
    setError('');
    try {
      const party = await joinParty(joinCode);
      onJoined(party);
    } catch {
      setError('Mã phòng không hợp lệ hoặc phòng đã đóng.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-md"
      role="dialog"
      aria-modal="true"
      aria-label="Tham gia phòng"
    >
      <div className="bg-dark-surface w-full max-w-[480px] rounded-[8px] shadow-[rgba(0,0,0,0.5)_0px_8px_24px] z-50 flex flex-col overflow-hidden relative">

        {/* Close button */}
        <button
          aria-label="Đóng"
          onClick={onClose}
          className="absolute top-md right-md text-text-secondary hover:text-text-emphasis transition-colors z-10"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
            close
          </span>
        </button>

        {/* Header */}
        <div className="p-lg border-b border-border-muted/30">
          <h2 className="font-section-title text-[20px] text-text-emphasis flex items-center gap-xs">
            <span className="material-symbols-outlined text-text-secondary text-[24px]" aria-hidden="true">
              link
            </span>
            Tham gia phòng
          </h2>
        </div>

        {/* Content */}
        <div className="p-lg flex flex-col gap-lg">

          {/* 6-char code input */}
          <div className="flex flex-col gap-sm">
            <label className="font-body-bold text-[14px] text-text-emphasis">Nhập mã phòng</label>
            <div className="flex justify-between gap-xs" onPaste={handlePaste} aria-label="Mã phòng 6 ký tự">
              {chars.map((char, idx) => (
                <input
                  key={idx}
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  type="text"
                  maxLength={2}
                  value={char}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  aria-label={`Ký tự ${idx + 1}`}
                  className="w-[48px] h-[56px] bg-mid-dark rounded-[8px] text-center text-[24px] font-section-title text-text-emphasis shadow-input-inset focus:outline-none focus:ring-1 focus:ring-spotify-green"
                />
              ))}
            </div>
            <p className="font-caption text-caption text-text-secondary mt-xs">
              Nhờ Host gửi mã 6 ký tự cho bạn
            </p>
          </div>

          {/* Preview card — shown when code is complete */}
          {isComplete && (
            <div
              className="bg-dark-card rounded-[8px] p-md flex flex-col gap-sm shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
              aria-label="Thông tin phòng"
            >
              {previewLoading && (
                <div className="flex items-center gap-sm animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-mid-dark" />
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="h-3 bg-mid-dark rounded w-3/4" />
                    <div className="h-2 bg-mid-dark rounded w-1/2" />
                  </div>
                </div>
              )}
              {!previewLoading && preview && (
                <>
                  <div className="flex items-center gap-sm">
                    <div className="w-10 h-10 rounded-full bg-mid-dark flex items-center justify-center overflow-hidden flex-shrink-0">
                      {preview.hostAvatarUrl ? (
                        <img src={preview.hostAvatarUrl} alt="Avatar host" className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-text-secondary text-[20px]" aria-hidden="true">person</span>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-body-bold text-body-bold text-text-emphasis flex items-center gap-xs">
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">music_note</span>
                        {preview.name}
                      </span>
                      <span className="font-caption text-[12px] text-text-secondary">
                        {preview.memberCount} thành viên
                        {preview.currentSongTitle && ` · Đang phát: ${preview.currentSongTitle}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end items-center text-spotify-green font-body-bold text-[14px] cursor-pointer hover:text-primary-fixed transition-colors">
                    Tham gia ngay
                    <span className="material-symbols-outlined ml-xs text-[18px]" aria-hidden="true">arrow_forward</span>
                  </div>
                </>
              )}
              {!previewLoading && !preview && (
                <p className="font-caption text-caption text-text-secondary text-center py-1">Không tìm thấy phòng với mã này.</p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-negative font-caption text-caption" role="alert">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-lg pt-0 flex justify-center mt-sm">
          <button
            onClick={handleJoin}
            disabled={!isComplete || loading}
            className="bg-spotify-green hover:bg-primary-fixed text-on-primary font-button-uppercase text-button-uppercase px-xl py-3 rounded-full w-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin text-[20px]">refresh</span>
            ) : (
              'THAM GIA'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
