import { http, HttpResponse, delay } from 'msw';
import {
  CURRENT_MOCK_USER,
  MOCK_NOTIFICATIONS,
  MOCK_RECOMMENDATIONS,
  MOCK_SEARCH_RESULTS,
  MOCK_SONGS,
  MOCK_ARTIST,
  MOCK_CREATOR_SONG_ROWS,
  MOCK_PARTY,
  getMockAnalyticsStats,
  getMockHeatmap,
  getSilentAudioDataUri,
  setMockUser,
} from './data';

// Simulate realistic network latency (ms)
const LATENCY = 200;

// ─── Helper: standard API response shapes ────────────────────────────────────

function ok<T>(data: T, extra?: object) {
  return HttpResponse.json({
    success: true,
    data,
    meta: { apiVersion: 'v1', requestId: crypto.randomUUID(), timestamp: new Date().toISOString(), ...extra },
    error: null,
  });
}

function created<T>(data: T) {
  return HttpResponse.json(
    {
      success: true,
      data,
      meta: { apiVersion: 'v1', requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
      error: null,
    },
    { status: 201 },
  );
}

function accepted() {
  return new HttpResponse(null, { status: 202 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

const loginHandler = http.post('*/api/v1/auth/login', async ({ request }) => {
  await delay(LATENCY);
  const body = await request.json() as { username?: string; email?: string };
  const email = body.username ?? body.email ?? '';
  setMockUser(email);
  return ok({ accessToken: 'mock-access-token-dev', expiresIn: 3600 });
});

const refreshHandler = http.post('*/api/v1/auth/refresh', async () => {
  await delay(50);
  return ok({ accessToken: 'mock-access-token-dev', expiresIn: 3600 });
});

const logoutHandler = http.post('*/api/v1/auth/logout', async () => {
  await delay(50);
  return ok(null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────────────────────

const getMeHandler = http.get('*/api/v1/users/me', async () => {
  await delay(LATENCY);
  return ok(CURRENT_MOCK_USER);
});

const updatePreferencesHandler = http.post('*/api/v1/users/me/preferences', async () => {
  await delay(LATENCY);
  return ok({ updated: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recommendations
// ─────────────────────────────────────────────────────────────────────────────

const recommendationsHandler = http.get('*/api/v1/recommendations', async () => {
  await delay(LATENCY);
  return ok({
    items: MOCK_RECOMMENDATIONS.map((r) => ({
      songId:      (r as any).song_id ?? (r as any).songId,
      title:       r.title,
      artist:      r.artist,
      thumbnail:   r.thumbnail,
      durationSec: (r as any).durationSec ?? 0,
      reason:      r.reason,
    })),
  });
});

const feedbackHandler = http.post('*/api/v1/recommendations/feedback', async () => {
  await delay(50);
  return accepted();
});

// ─────────────────────────────────────────────────────────────────────────────
// Streaming
// ─────────────────────────────────────────────────────────────────────────────

const streamingUrlHandler = http.get('*/api/v1/streaming/:songId/url', async () => {
  await delay(LATENCY);
  return ok({
    url: getSilentAudioDataUri(),
    expiresIn: 900,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Music
// ─────────────────────────────────────────────────────────────────────────────

const getMySongsHandler = http.get('*/api/v1/music/songs/my', async () => {
  await delay(LATENCY);
  const rows = MOCK_CREATOR_SONG_ROWS.map((r) => ({
    songId: r.songId,
    title: r.title,
    coverUrl: r.coverUrl,
    genre: r.genre,
    uploadedAt: r.uploadedAt,
    playCount: r.totalPlays,
  }));
  return ok(rows);
});

const getArtistHandler = http.get('*/api/v1/music/artists/:artistId', async () => {
  await delay(LATENCY);
  const artistDetail = {
    id: MOCK_ARTIST.id,
    stageName: MOCK_ARTIST.name,
    bio: 'Nghệ sĩ hàng đầu Việt Nam',
    country: 'VN',
    avatarUrl: MOCK_ARTIST.avatarUrl,
    bannerImageUrl: MOCK_ARTIST.avatarUrl,
    verified: true,
    totalFollowers: MOCK_ARTIST.followerCount ?? 0,
    totalPlays: MOCK_ARTIST.totalPlays ?? 0,
    songs: MOCK_SONGS.slice(0, 5).map((s) => ({
      ...s,
      durationSec: s.duration,
      genreName: 'V-Pop',
    })),
  };
  return ok(artistDetail);
});

const getSongHandler = http.get('*/api/v1/music/songs/:songId', async ({ params }) => {
  await delay(LATENCY);
  const song = MOCK_SONGS.find((s) => s.id === params.songId) ?? MOCK_SONGS[0];
  return ok(song);
});

const uploadSongHandler = http.post('*/api/v1/music/songs', async () => {
  await delay(800);
  return created({ ...MOCK_SONGS[0], id: `song-new-${Date.now()}` });
});

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

const searchHandler = http.get('*/api/v1/search', async ({ request }) => {
  await delay(LATENCY);
  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? '';

  if (!q.trim()) {
    return ok([], { pagination: { hasMore: false, nextCursor: null } });
  }

  const lower = q.toLowerCase();
  const results = MOCK_SEARCH_RESULTS.filter(
    (r) => r.name.toLowerCase().includes(lower) || (r.artist ?? '').toLowerCase().includes(lower),
  );

  return ok(results, { pagination: { hasMore: false, nextCursor: null } });
});

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

// In-memory mutable copy so mark-read works in the session
let _notifications = MOCK_NOTIFICATIONS.map((n) => ({ ...n }));

const getNotificationsHandler = http.get('*/api/v1/notifications/unread', async () => {
  await delay(LATENCY);
  const totalUnread = _notifications.filter((n) => !n.read).length;
  return ok(
    { items: _notifications, hasMore: false, totalUnread },
    { pagination: { hasMore: false, nextCursor: null } },
  );
});

const markReadHandler = http.patch('*/api/v1/notifications/:id/read', async ({ params }) => {
  await delay(50);
  _notifications = _notifications.map((n) =>
    n.notificationId === params.id ? { ...n, read: true } : n,
  );
  return ok(null);
});

const markAllReadHandler = http.patch('*/api/v1/notifications/read-all', async () => {
  await delay(LATENCY);
  _notifications = _notifications.map((n) => ({ ...n, read: true }));
  return ok(null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────────────────────────────────────

const analyticsPlayHandler = http.post('*/api/v1/analytics/events/play', async () => {
  await delay(30);
  return accepted();
});

const heatmapHandler = http.get('*/api/v1/analytics/creator/heatmap/:songId', async ({ params }) => {
  await delay(LATENCY);
  return ok(getMockHeatmap(params.songId as string));
});

const statsHandler = http.get('*/api/v1/analytics/creator/stats/:songId', async ({ params, request }) => {
  await delay(LATENCY);
  const url = new URL(request.url);
  const timeRange = (url.searchParams.get('timeRange') ?? '7d') as '7d' | '30d';
  return ok(getMockAnalyticsStats(params.songId as string, timeRange));
});

// ─────────────────────────────────────────────────────────────────────────────
// Listening Party
// ─────────────────────────────────────────────────────────────────────────────

const createPartyHandler = http.post('*/api/v1/parties', async () => {
  await delay(LATENCY);
  return created(MOCK_PARTY);
});

const joinPartyHandler = http.post('*/api/v1/parties/:joinCode/join', async ({ params }) => {
  await delay(LATENCY);
  return ok({ ...MOCK_PARTY, joinCode: params.joinCode as string });
});

// ─────────────────────────────────────────────────────────────────────────────
// Export all handlers
// ─────────────────────────────────────────────────────────────────────────────

export const handlers = [
  // Auth
  loginHandler,
  refreshHandler,
  logoutHandler,

  // Users
  getMeHandler,
  updatePreferencesHandler,

  // Recommendations
  recommendationsHandler,
  feedbackHandler,

  // Streaming
  streamingUrlHandler,

  // Music
  getMySongsHandler,
  getArtistHandler,
  getSongHandler,
  uploadSongHandler,

  // Search
  searchHandler,

  // Notifications
  getNotificationsHandler,
  markReadHandler,
  markAllReadHandler,

  // Analytics
  analyticsPlayHandler,
  heatmapHandler,
  statsHandler,

  // Party
  createPartyHandler,
  joinPartyHandler,
];
