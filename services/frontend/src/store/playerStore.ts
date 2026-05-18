import { create } from 'zustand';

export interface CurrentSong {
  songId:     string;
  title:      string;
  artist:     string;
  coverUrl?:  string;
  /** Signal BottomPlayerBar to auto-play after stream URL loads (used by Listening Party) */
  autoPlay?:  boolean;
}

interface PlayerState {
  currentSong:      CurrentSong | null;
  queue:            CurrentSong[];
  /** Incremented each time an external caller (e.g. Listening Party) wants to pause */
  pauseSignal:      number;
  /** Incremented each time an external caller wants to resume without re-fetching URL */
  resumeSignal:     number;
  /** Incremented + position updated each time an external caller (e.g. Listening Party host) seeks */
  seekSignal:       number;
  seekPosition:     number;
  setSong:          (song: CurrentSong) => void;
  /** Alias for setSong — preferred in new components */
  playSong:         (song: CurrentSong) => void;
  /** Signal BottomPlayerBar to pause without re-fetching stream URL */
  pauseSong:        () => void;
  /** Signal BottomPlayerBar to resume without resetting the stream (same song) */
  resumeSong:       () => void;
  /** Signal BottomPlayerBar to seek to positionSec */
  seekSong:         (positionSec: number) => void;
  clearSong:        () => void;
  addToQueue:       (song: CurrentSong) => void;
  removeFromQueue:  (index: number) => void;
  clearQueue:       () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentSong:  null,
  queue:        [],
  pauseSignal:  0,
  resumeSignal: 0,
  seekSignal:   0,
  seekPosition: 0,
  setSong:  (song) => { if (!song.songId) return; set({ currentSong: song }); },
  playSong: (song) => { if (!song.songId) return; set({ currentSong: song }); },
  pauseSong:  () => set((s) => ({ pauseSignal:  s.pauseSignal  + 1 })),
  resumeSong: () => set((s) => ({ resumeSignal: s.resumeSignal + 1 })),
  seekSong:   (positionSec) => set((s) => ({ seekSignal: s.seekSignal + 1, seekPosition: positionSec })),
  clearSong: () => set({ currentSong: null }),
  addToQueue: (song) => set((s) => ({ queue: [...s.queue, song] })),
  removeFromQueue: (index) =>
    set((s) => ({ queue: s.queue.filter((_, i) => i !== index) })),
  clearQueue: () => set({ queue: [] }),
}));
