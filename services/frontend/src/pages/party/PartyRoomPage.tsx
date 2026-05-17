import { useState, useCallback, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import RoomPlayer from '../../features/party/components/RoomPlayer';
import MemberList from '../../features/party/components/MemberList';
import { useListeningParty } from '../../features/party/hooks/useListeningParty';
import { useAuthStore } from '../../store/authStore';
import { getSong } from '../../services/musicService';
import type { Party, PartyMember, Song } from '../../types/domain';
import type { SyncState, MemberJoin, MemberLeave } from '../../types/listening-party';

// ─────────────────────────────────────────────────────────────────────────────

interface LocationState {
  party?: Party;
  isHost?: boolean;
}

export default function PartyRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const location   = useLocation();
  const navigate   = useNavigate();
  const state      = (location.state ?? {}) as LocationState;

  const currentUserId = useAuthStore((s) => s.userId) ?? '';
  const initialParty  = state.party;

  // ─── Party state ───────────────────────────────────────────────────────────
  const [members, setMembers]         = useState<PartyMember[]>(initialParty?.members ?? []);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [positionSec, setPositionSec] = useState(initialParty?.playbackPositionSec ?? 0);
  const [currentSongId, setCurrentSongId] = useState<string | null>(
    initialParty?.currentSongId ?? null,
  );
  const [currentSong, setCurrentSong] = useState<Song | null>(null);

  const hostId   = initialParty?.hostId ?? '';
  const joinCode = initialParty?.joinCode ?? '';
  const roomName = (initialParty as (Party & { name?: string }) | undefined)?.name ?? 'Phòng nghe nhạc';
  const isHost   = !!currentUserId && currentUserId === hostId;

  // Load song details whenever currentSongId changes
  useEffect(() => {
    if (!currentSongId) return;
    getSong(currentSongId).then((s) => setCurrentSong(s)).catch(() => {});
  }, [currentSongId]);

  // ─── SignalR handlers ──────────────────────────────────────────────────────
  const handleSyncState = useCallback((sync: SyncState) => {
    setIsPlaying(sync.isPlaying);
    setPositionSec(sync.positionSec);
    if (sync.songId) setCurrentSongId(sync.songId);
  }, []);

  const handleMemberJoin = useCallback((data: MemberJoin) => {
    setMembers((prev) => {
      if (prev.some((m) => m.userId === data.userId)) return prev;
      return [...prev, { userId: data.userId, name: data.displayName, avatarUrl: data.avatarUrl, isHost: false }];
    });
  }, []);

  const handleMemberLeave = useCallback((data: MemberLeave) => {
    setMembers((prev) => prev.filter((m) => m.userId !== data.userId));
  }, []);

  const { status, sendPlayerAction } = useListeningParty({
    roomId:        roomId ?? '',
    isHost,
    onSyncState:   handleSyncState,
    onMemberJoin:  handleMemberJoin,
    onMemberLeave: handleMemberLeave,
  });

  // ─── Player actions (Host only) ────────────────────────────────────────────
  const handlePlay  = () => { setIsPlaying(true);  void sendPlayerAction({ action: 'PLAY',  songId: currentSongId ?? '' }); };
  const handlePause = () => { setIsPlaying(false); void sendPlayerAction({ action: 'PAUSE' }); };
  const handleNext  = () => void sendPlayerAction({ action: 'PLAY', songId: currentSongId ?? '' });
  const handlePrev  = () => void sendPlayerAction({ action: 'PLAY', songId: currentSongId ?? '' });

  const handleLeave = () => navigate('/');

  // ─── Connection status badge ───────────────────────────────────────────────
  const statusBadge: Record<typeof status, string> = {
    connecting:    'Đang kết nối…',
    connected:     '',
    reconnecting:  'Đang kết nối lại…',
    disconnected:  'Mất kết nối',
  };

  return (
    <AppShell>
      <main className="h-full min-h-screen flex flex-col lg:flex-row p-md lg:p-xl gap-lg lg:gap-xl overflow-y-auto">

        {/* ── Left: Player section (60%) ─────────────────────────────────── */}
        <section
          className="flex-1 lg:w-[60%] flex flex-col items-center justify-center relative"
          aria-label="Phát nhạc"
        >
          {/* Room header */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between w-full">
            <div>
              <h2 className="font-section-title text-section-title text-text-emphasis flex items-center gap-2">
                🎉 {roomName}
              </h2>
              <div className="flex items-center gap-3 mt-1 text-text-secondary font-caption text-caption">
                <span
                  className="bg-mid-dark px-2 py-1 rounded-md text-text-base font-mono tracking-wider"
                  aria-label={`Mã phòng: ${joinCode}`}
                >
                  {joinCode}
                </span>
                <span aria-hidden="true">•</span>
                <span>{members.length} thành viên</span>
                {statusBadge[status] && (
                  <>
                    <span aria-hidden="true">•</span>
                    <span className="text-warning">{statusBadge[status]}</span>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={handleLeave}
              aria-label="Rời phòng"
              className="border border-negative text-negative hover:bg-negative/10 font-small-bold text-small-bold px-4 py-2 rounded-full transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">logout</span>
              Rời phòng
            </button>
          </div>

          {/* Player */}
          <div className="mt-20 lg:mt-12 w-full">
            <RoomPlayer
              song={currentSong}
              isPlaying={isPlaying}
              positionSec={positionSec}
              isHost={isHost}
              onPlay={handlePlay}
              onPause={handlePause}
              onNext={handleNext}
              onPrev={handlePrev}
            />
          </div>
        </section>

        {/* ── Right: Members section (40%) ───────────────────────────────── */}
        <section
          className="lg:w-[40%] flex flex-col h-full mt-8 lg:mt-0"
          aria-label="Thành viên"
        >
          <MemberList
            members={members}
            currentUserId={currentUserId}
          />
        </section>

      </main>
    </AppShell>
  );
}
