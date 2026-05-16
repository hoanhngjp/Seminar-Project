import { create } from 'zustand';

export interface CurrentSong {
  songId:    string;
  title:     string;
  artist:    string;
  coverUrl?: string;
}

interface PlayerState {
  currentSong:      CurrentSong | null;
  queue:            CurrentSong[];
  setSong:          (song: CurrentSong) => void;
  /** Alias for setSong — preferred in new components */
  playSong:         (song: CurrentSong) => void;
  clearSong:        () => void;
  addToQueue:       (song: CurrentSong) => void;
  removeFromQueue:  (index: number) => void;
  clearQueue:       () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentSong: null,
  queue:       [],
  setSong:  (song) => { if (!song.songId) return; set({ currentSong: song }); },
  playSong: (song) => { if (!song.songId) return; set({ currentSong: song }); },
  clearSong: () => set({ currentSong: null }),
  addToQueue: (song) => set((s) => ({ queue: [...s.queue, song] })),
  removeFromQueue: (index) =>
    set((s) => ({ queue: s.queue.filter((_, i) => i !== index) })),
  clearQueue: () => set({ queue: [] }),
}));
