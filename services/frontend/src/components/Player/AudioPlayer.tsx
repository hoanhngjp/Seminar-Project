import { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient } from '../../api/client';

interface AudioPlayerProps {
  songId: string;
  title: string;
  artist: string;
  coverUrl?: string;
}

interface StreamingUrlData {
  url: string;
  expiresIn: number; // seconds
}

const REFETCH_BEFORE_EXPIRY_SEC = 60;

export default function AudioPlayer({ songId, title, artist, coverUrl }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Track URL expiry for proactive re-fetch
  const urlFetchedAtRef = useRef<number>(0);
  const expiresInRef = useRef<number>(0);
  const analyticsSentRef = useRef(false);

  const fetchStreamUrl = useCallback(async () => {
    try {
      setUrlError(null);
      const res = await apiClient.get<{ success: boolean; data: StreamingUrlData }>(
        `/api/v1/streaming/${songId}/url`,
      );
      setStreamUrl(res.data.data.url);
      urlFetchedAtRef.current = Date.now() / 1000;
      expiresInRef.current = res.data.data.expiresIn;
    } catch {
      setUrlError('Không thể tải bài hát. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [songId]);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    analyticsSentRef.current = false;
    fetchStreamUrl();
  }, [fetchStreamUrl]);

  // Proactive URL refresh when playing near expiry
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() / 1000 - urlFetchedAtRef.current;
      if (expiresInRef.current - elapsed < REFETCH_BEFORE_EXPIRY_SEC) {
        fetchStreamUrl();
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [isPlaying, fetchStreamUrl]);

  // Sync audio element volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const sendPlayAnalytics = useCallback(async () => {
    if (analyticsSentRef.current) return;
    analyticsSentRef.current = true;
    try {
      await apiClient.post(
        '/api/v1/analytics/events/play',
        { songId, durationPercent: 0 },
        { headers: { 'Idempotency-Key': `${songId}-${Date.now()}` } },
      );
    } catch {
      // analytics is best-effort — do not surface to user
    }
  }, [songId]);

  const handlePlay = () => {
    audioRef.current?.play();
    setIsPlaying(true);
    sendPlayAnalytics();
  };

  const handlePause = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const handleToggle = () => (isPlaying ? handlePause() : handlePlay());

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) return <div style={styles.container}><p style={styles.info}>Đang tải bài hát…</p></div>;
  if (urlError) return <div style={styles.container}><p style={styles.error}>{urlError}</p></div>;

  return (
    <div style={styles.container}>
      {streamUrl && (
        <audio
          ref={audioRef}
          src={streamUrl}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onEnded={() => setIsPlaying(false)}
          onError={() => {
            // URL may have expired — re-fetch once
            fetchStreamUrl();
          }}
        />
      )}

      <div style={styles.info}>
        {coverUrl && <img src={coverUrl} alt={title} style={styles.cover} />}
        <div>
          <p style={styles.title}>{title}</p>
          <p style={styles.artist}>{artist}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div style={styles.progressRow}>
        <span style={styles.time}>{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.5}
          value={currentTime}
          onChange={handleSeek}
          style={styles.slider}
        />
        <span style={styles.time}>{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <button onClick={handleToggle} style={styles.playBtn} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div style={styles.volumeRow}>
          <span style={styles.volumeIcon}>🔊</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            style={{ ...styles.slider, maxWidth: 80 }}
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#1a1a1a',
    borderRadius: 12,
    padding: '1rem 1.25rem',
    color: '#fff',
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 480,
  },
  info: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.75rem',
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 6,
    objectFit: 'cover',
  },
  title: {
    margin: 0,
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  artist: {
    margin: 0,
    fontSize: '0.8rem',
    color: '#aaa',
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  time: {
    fontSize: '0.75rem',
    color: '#888',
    minWidth: 32,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    accentColor: '#1db954',
    cursor: 'pointer',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  playBtn: {
    background: '#1db954',
    border: 'none',
    borderRadius: '50%',
    width: 40,
    height: 40,
    fontSize: '1.1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  },
  volumeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  volumeIcon: {
    fontSize: '0.9rem',
  },
  error: {
    color: '#ff6b6b',
    fontSize: '0.85rem',
    margin: 0,
  },
};
