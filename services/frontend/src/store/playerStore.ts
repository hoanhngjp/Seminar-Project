import { create } from 'zustand';

interface CurrentSong {
  songId: string;
  title: string;
  artist: string;
}

interface PlayerState {
  currentSong: CurrentSong | null;
  setSong: (song: CurrentSong) => void;
  clearSong: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentSong: null,
  setSong: (song) => set({ currentSong: song }),
  clearSong: () => set({ currentSong: null }),
}));
