import { create } from 'zustand';

export interface CurrentSong {
  songId:     string;
  title:      string;
  artist:     string;
  coverUrl?:  string;
  /** Signal BottomPlayerBar to auto-play after stream URL loads */
  autoPlay?:  boolean;
}

export type RepeatMode = 'none' | 'one' | 'all';

interface PlayerState {
  currentSong:      CurrentSong | null;
  queue:            CurrentSong[];
  history:          CurrentSong[];
  shuffle:          boolean;
  repeat:           RepeatMode;
  /** Actual audio duration in seconds, written by BottomPlayerBar from onDurationChange */
  audioDuration:    number;
  /** Incremented each time an external caller (e.g. Listening Party) wants to pause */
  pauseSignal:      number;
  /** Incremented each time an external caller wants to resume without re-fetching URL */
  resumeSignal:     number;
  /** Incremented + position updated each time an external caller (e.g. Listening Party host) seeks */
  seekSignal:       number;
  seekPosition:     number;
  /** Incremented by BottomPlayerBar onEnded — Party room subscribes to trigger QueueNext */
  songEndSignal:    number;
  triggerSongEnd:   () => void;
  setSong:          (song: CurrentSong) => void;
  /** Alias for setSong — preferred in new components */
  playSong:         (song: CurrentSong) => void;
  /** Signal BottomPlayerBar to pause without re-fetching stream URL */
  pauseSong:        () => void;
  /** Signal BottomPlayerBar to resume without resetting the stream (same song) */
  resumeSong:       () => void;
  /** Signal BottomPlayerBar to seek to positionSec */
  seekSong:         (positionSec: number) => void;
  /** Written by BottomPlayerBar once audio metadata loads — source of truth for duration */
  setAudioDuration: (d: number) => void;
  clearSong:        () => void;
  /** Add song to queue — silently ignored if song is already playing or already in queue */
  addToQueue:       (song: CurrentSong) => void;
  removeFromQueue:  (index: number) => void;
  clearQueue:       () => void;
  /** Play item at index from queue, push current song to history */
  playFromQueue:    (index: number) => void;
  /** Advance to next song (respects shuffle / repeat) */
  playNext:         () => void;
  /** Go back to previous song from history; seeks to 0 if history is empty */
  playPrev:         () => void;
  toggleShuffle:    () => void;
  toggleRepeat:     () => void;
  /** Move item from one queue index to another */
  reorderQueue:     (from: number, to: number) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong:   null,
  queue:         [],
  history:       [],
  shuffle:       false,
  repeat:        'none',
  audioDuration: 0,
  pauseSignal:   0,
  resumeSignal:  0,
  seekSignal:    0,
  seekPosition:  0,
  songEndSignal: 0,

  setSong: (song) => {
    if (!song.songId) return;
    const { currentSong } = get();
    set((s) => ({
      currentSong:   song,
      audioDuration: 0,
      history:       currentSong ? [...s.history, currentSong] : s.history,
    }));
  },

  playSong: (song) => {
    if (!song.songId) return;
    const { currentSong } = get();
    set((s) => ({
      currentSong:   song,
      audioDuration: 0,
      history:       currentSong ? [...s.history, currentSong] : s.history,
    }));
  },

  triggerSongEnd:   () => set((s) => ({ songEndSignal: s.songEndSignal + 1 })),
  pauseSong:        () => set((s) => ({ pauseSignal:  s.pauseSignal  + 1 })),
  resumeSong:       () => set((s) => ({ resumeSignal: s.resumeSignal + 1 })),
  seekSong:         (positionSec) => set((s) => ({ seekSignal: s.seekSignal + 1, seekPosition: positionSec })),
  setAudioDuration: (d) => set({ audioDuration: d }),
  clearSong:  () => set({ currentSong: null, audioDuration: 0 }),

  addToQueue: (song) => set((s) => {
    if (!song.songId) return s;
    if (s.currentSong?.songId === song.songId) return s;
    if (s.queue.some((q) => q.songId === song.songId)) return s;
    // If nothing is playing yet, show the bar without auto-playing
    const nextCurrent = s.currentSong ?? { ...song, autoPlay: false };
    const nextQueue   = s.currentSong ? [...s.queue, song] : s.queue;
    return { currentSong: nextCurrent, queue: nextQueue };
  }),

  removeFromQueue: (index) =>
    set((s) => ({ queue: s.queue.filter((_, i) => i !== index) })),

  clearQueue: () => set({ queue: [] }),

  playFromQueue: (index) => {
    const { queue, currentSong } = get();
    if (index < 0 || index >= queue.length) return;
    const next = { ...queue[index], autoPlay: true };
    const newQueue = queue.filter((_, i) => i !== index);
    set((s) => ({
      currentSong:   next,
      audioDuration: 0,
      queue:         newQueue,
      history:       currentSong ? [...s.history, currentSong] : s.history,
    }));
  },

  playNext: () => {
    const { queue, currentSong, shuffle, repeat } = get();
    if (repeat === 'one' && currentSong) {
      // Re-play same song from beginning
      set((s) => ({
        currentSong:   { ...currentSong, autoPlay: true },
        audioDuration: 0,
        history:       [...s.history, currentSong],
      }));
      return;
    }
    if (queue.length === 0) return;
    const index = shuffle ? Math.floor(Math.random() * queue.length) : 0;
    get().playFromQueue(index);
  },

  playPrev: () => {
    const { history, currentSong } = get();
    if (history.length === 0) {
      // No history — seek current song to start
      set((s) => ({ seekSignal: s.seekSignal + 1, seekPosition: 0 }));
      return;
    }
    const prev = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    // Push currentSong back to front of queue so user can go forward again
    set((s) => ({
      currentSong:   { ...prev, autoPlay: true },
      audioDuration: 0,
      history:       newHistory,
      queue:         currentSong ? [currentSong, ...s.queue] : s.queue,
    }));
  },

  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),

  toggleRepeat: () => set((s) => {
    const next: RepeatMode =
      s.repeat === 'none' ? 'one'
      : s.repeat === 'one' ? 'all'
      : 'none';
    return { repeat: next };
  }),

  reorderQueue: (from, to) => set((s) => {
    if (from === to || from < 0 || to < 0 || from >= s.queue.length || to >= s.queue.length) return s;
    const q = [...s.queue];
    const [moved] = q.splice(from, 1);
    q.splice(to, 0, moved);
    return { queue: q };
  }),
}));
