import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { usePlayerStore } from '../store/playerStore';

afterEach(() => {
  usePlayerStore.getState().clearSong();
});
