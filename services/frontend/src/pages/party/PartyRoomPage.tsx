import { useState, useCallback, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import RoomPlayer from '../../features/party/components/RoomPlayer';
import MemberList from '../../features/party/components/MemberList';
import PartyQueue from '../../features/party/components/PartyQueue';
import { usePartyWebSocket } from '../../hooks/usePartyWebSocket';
import { useAuthStore } from '../../store/authStore';
import { usePlayerStore } from '../../store/playerStore';
import { getSong } from '../../services/musicService';
import type { Party, PartyMember, Song } from '../../types/domain';
import type { SyncState, MemberJoin, MemberLeave, QueueUpdated } from '../../types/listening-party';

type RightPanelTab = 'members' | 'queue';

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
  const playSong      = usePlayerStore((s) => s.playSong);
  const pauseSong     = usePlayerStore((s) => s.pauseSong);
  const resumeSong    = usePlayerStore((s) => s.resumeSong);
  const seekSong      = usePlayerStore((s) => s.seekSong);
  const clearSong     = usePlayerStore((s) => s.clearSong);
  const audioDuration = usePlayerStore((s) => s.audioDuration);
  const songEndSignal = usePlayerStore((s) => s.songEndSignal);

  // ─── Party state ───────────────────────────────────────────────────────────
  const [members, setMembers]         = useState<PartyMember[]>(initialParty?.members ?? []);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [positionSec, setPositionSec] = useState(initialParty?.playbackPositionSec ?? 0);
  const [currentSongId, setCurrentSongId] = useState<string | null>(
    initialParty?.currentSongId ?? null,
  );
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  // Incremented on every SYNC_STATE — forces the audio sync effect to re-run even
  // when isPlaying didn't change (e.g. Member closed bar, then Host sends next action).
  const [syncTick, setSyncTick]       = useState(0);

  const hostId   = initialParty?.hostId ?? '';
  const joinCode = initialParty?.joinCode ?? '';
  const roomName = initialParty?.name ?? 'Phòng nghe nhạc';
  const isHost   = !!currentUserId && currentUserId === hostId;

  const [activeTab, setActiveTab] = useState<RightPanelTab>('members');

  // Load song details whenever currentSongId changes
  useEffect(() => {
    if (!currentSongId) return;
    getSong(currentSongId).then((s) => setCurrentSong(s)).catch(() => {});
  }, [currentSongId]);

  // Sync audio player with party state.
  // Re-runs on syncTick so every SYNC_STATE from the server is acted upon,
  // even if isPlaying hasn't changed (handles Member close-bar + reconnect cases).
  useEffect(() => {
    if (!currentSong) return;
    if (isPlaying) {
      const loadedSongId = usePlayerStore.getState().currentSong?.songId;
      if (loadedSongId === currentSong.id) {
        // Same song already in BottomPlayerBar.
        // For Members: seek to estimated Host position before resuming to correct any drift
        // (pause→play, close bar→reopen, reconnect after network blip).
        if (!isHost) {
          usePlayerStore.getState().setPreSyncPositionOnPlay(estimateCurrentPositionRef.current());
        }
        resumeSong();
      } else {
        playSong({ songId: currentSong.id, title: currentSong.title, artist: currentSong.artist, coverUrl: currentSong.coverUrl, autoPlay: true });
      }
    } else {
      pauseSong();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong, isPlaying, syncTick, isHost, playSong, pauseSong, resumeSong]);

  // Stop audio when leaving the party room
  useEffect(() => {
    return () => { clearSong(); };
  }, [clearSong]);

  // Tick positionSec every second while playing so the progress bar moves
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => setPositionSec((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  // ─── SignalR handlers ──────────────────────────────────────────────────────
  const handleSyncState = useCallback((sync: SyncState) => {
    setIsPlaying(sync.isPlaying);
    if (sync.songId) setCurrentSongId(sync.songId);
    // Only accept server positionSec when playing or when server has a meaningful position.
    if (sync.isPlaying || sync.positionSec > 0) {
      setPositionSec(sync.positionSec);
    }
    // Force the audio sync effect to re-run regardless of whether isPlaying changed.
    // This covers: Member closed bar (clearSong), reconnect, resume after pause with drift.
    setSyncTick((t) => t + 1);
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

  const handleQueueUpdated = useCallback((_data: QueueUpdated) => {}, []);

  const { status, sendPlayerAction, queueItems, sendQueueAdd, sendQueueRemove, sendQueueNext, estimateCurrentPosition } =
    usePartyWebSocket({
      roomId:         roomId ?? '',
      isHost,
      onSyncState:    handleSyncState,
      onMemberJoin:   handleMemberJoin,
      onMemberLeave:  handleMemberLeave,
      onQueueUpdated: handleQueueUpdated,
    });

  // Keep a stable ref to estimateCurrentPosition so the audio sync effect can call it
  // without adding it to deps (would cause re-render loops via useCallback identity).
  const estimateCurrentPositionRef = { current: estimateCurrentPosition };

  // Auto-advance: Host triggers QueueNext when current song ends
  useEffect(() => {
    if (songEndSignal === 0) return;
    if (!isHost) return;
    void sendQueueNext();
  }, [songEndSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Player actions (Host only) ────────────────────────────────────────────
  const handlePlay  = () => { setIsPlaying(true);  void sendPlayerAction({ action: 'PLAY',  songId: currentSongId ?? '' }); };
  const handlePause = () => { setIsPlaying(false); void sendPlayerAction({ action: 'PAUSE' }); };
  // Next: dequeue next song from party queue (same as auto-advance)
  const handleNext  = () => { void sendQueueNext(); };
  // Prev: restart current song (party has no "previous" concept)
  const handlePrev  = () => { setPositionSec(0); seekSong(0); void sendPlayerAction({ action: 'SEEK', positionSec: 0 }); };
  const handleSeek  = (sec: number) => { setPositionSec(sec); seekSong(sec); void sendPlayerAction({ action: 'SEEK', positionSec: sec }); };

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
              audioDuration={audioDuration > 0 ? audioDuration : undefined}
              onPlay={handlePlay}
              onPause={handlePause}
              onNext={handleNext}
              onPrev={handlePrev}
              onSeek={isHost ? handleSeek : undefined}
            />
          </div>
        </section>

        {/* ── Right: Members / Queue section (40%) ──────────────────────── */}
        <section
          className="lg:w-[40%] flex flex-col h-full mt-8 lg:mt-0"
          aria-label="Thành viên và Hàng chờ"
        >
          {/* Tab bar */}
          <div className="flex border-b border-border-muted mb-4" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'members'}
              onClick={() => setActiveTab('members')}
              className={`flex-1 py-2 font-small-bold text-small-bold transition-colors border-b-2 -mb-[2px] ${
                activeTab === 'members'
                  ? 'text-text-emphasis border-spotify-green'
                  : 'text-text-secondary border-transparent hover:text-text-base'
              }`}
            >
              Thành viên
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'queue'}
              onClick={() => setActiveTab('queue')}
              className={`flex-1 py-2 font-small-bold text-small-bold transition-colors border-b-2 -mb-[2px] ${
                activeTab === 'queue'
                  ? 'text-text-emphasis border-spotify-green'
                  : 'text-text-secondary border-transparent hover:text-text-base'
              }`}
            >
              Hàng chờ
            </button>
          </div>

          {/* Tab content */}
          {activeTab === 'members' ? (
            <MemberList
              members={members}
              currentUserId={currentUserId}
            />
          ) : (
            <PartyQueue
              queueItems={queueItems}
              currentSongId={currentSongId ?? undefined}
              currentUserId={currentUserId}
              onAddSong={sendQueueAdd}
              onRemoveSong={sendQueueRemove}
            />
          )}
        </section>

      </main>
    </AppShell>
  );
}
