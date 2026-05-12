import { create } from 'zustand';

interface CurrentSong {
  songId:    string;
  title:     string;
  artist:    string;
  coverUrl?: string;
}

interface PlayerState {
  currentSong: CurrentSong | null;
  setSong:     (song: CurrentSong) => void;
  /** Alias for setSong — preferred in new components */
  playSong:    (song: CurrentSong) => void;
  clearSong:   () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentSong: null,
  setSong:  (song) => set({ currentSong: song }),
  playSong: (song) => set({ currentSong: song }),
  clearSong: () => set({ currentSong: null }),
}));
