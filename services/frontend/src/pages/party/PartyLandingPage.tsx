import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import CreateRoomModal from '../../features/party/components/CreateRoomModal';
import JoinRoomModal from '../../features/party/components/JoinRoomModal';
import type { Party } from '../../types/domain';

type ModalState = 'none' | 'create' | 'join';

export default function PartyLandingPage() {
  const [modal, setModal] = useState<ModalState>('none');
  const navigate = useNavigate();

  const handleCreated = (party: Party) => {
    navigate(`/party/${party.roomId}`, {
      state: { party, isHost: true },
    });
  };

  const handleJoined = (party: Party) => {
    navigate(`/party/${party.roomId}`, {
      state: { party, isHost: false },
    });
  };

  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-lg">

        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="font-section-title text-[32px] text-text-emphasis mb-3">
            🎉 Listening Party
          </h1>
          <p className="font-body-regular text-body-regular text-text-secondary max-w-md">
            Nghe nhạc cùng bạn bè theo thời gian thực. Tạo phòng và chia sẻ mã để mọi người tham gia.
          </p>
        </div>

        {/* Action cards */}
        <div className="flex flex-col sm:flex-row gap-md w-full max-w-md">

          {/* Create room card */}
          <button
            onClick={() => setModal('create')}
            aria-label="Tạo phòng mới"
            className="flex-1 bg-dark-surface hover:bg-mid-dark border border-border-muted/50 hover:border-spotify-green rounded-[8px] p-lg flex flex-col items-center gap-md transition-all group"
          >
            <div className="w-16 h-16 rounded-full bg-spotify-green/10 group-hover:bg-spotify-green/20 flex items-center justify-center transition-colors">
              <span
                className="material-symbols-outlined text-[32px] text-spotify-green"
                style={{ fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                add_circle
              </span>
            </div>
            <div>
              <p className="font-body-bold text-body-bold text-text-emphasis">Tạo phòng mới</p>
              <p className="font-caption text-caption text-text-secondary mt-1">
                Làm Host, chọn nhạc và mời bạn bè
              </p>
            </div>
          </button>

          {/* Join room card */}
          <button
            onClick={() => setModal('join')}
            aria-label="Tham gia phòng"
            className="flex-1 bg-dark-surface hover:bg-mid-dark border border-border-muted/50 hover:border-spotify-green rounded-[8px] p-lg flex flex-col items-center gap-md transition-all group"
          >
            <div className="w-16 h-16 rounded-full bg-mid-dark group-hover:bg-spotify-green/10 flex items-center justify-center transition-colors">
              <span
                className="material-symbols-outlined text-[32px] text-text-secondary group-hover:text-spotify-green transition-colors"
                style={{ fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                login
              </span>
            </div>
            <div>
              <p className="font-body-bold text-body-bold text-text-emphasis">Tham gia phòng</p>
              <p className="font-caption text-caption text-text-secondary mt-1">
                Nhập mã 6 ký tự từ Host
              </p>
            </div>
          </button>

        </div>

      </div>

      {/* Modals */}
      {modal === 'create' && (
        <CreateRoomModal onClose={() => setModal('none')} onCreated={handleCreated} />
      )}
      {modal === 'join' && (
        <JoinRoomModal onClose={() => setModal('none')} onJoined={handleJoined} />
      )}
    </AppShell>
  );
}
